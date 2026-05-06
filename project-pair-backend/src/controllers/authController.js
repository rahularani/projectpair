import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { User } from '../models/index.js'
import { sendPasswordResetEmail } from '../services/email.js'
import { logger } from '../services/logger.js'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET
const ACCESS_EXPIRY = '15m'
const REFRESH_EXPIRY = '7d'

// Password strength: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

const signAccess = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY })
const signRefresh = (payload) => jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY })

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

// Track failed login attempts: email → { count, lockedUntil }
const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

const checkLock = (email) => {
  const entry = loginAttempts.get(email)
  if (!entry) return false
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(email)
  }
  return false
}

const recordFailure = (email) => {
  const entry = loginAttempts.get(email) || { count: 0 }
  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_DURATION_MS
    logger.warn(`Account locked due to too many failed attempts: ${email}`)
  }
  loginAttempts.set(email, entry)
}

const clearAttempts = (email) => loginAttempts.delete(email)

export const register = async (req, res) => {
  try {
    const { name, email, password, role, skills_offered, skills_needed } = req.body

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and a number',
      })
    }

    // Prevent self-assigning admin role
    const safeRole = role === 'admin' ? 'developer' : (role || 'developer')

    const exists = await User.findOne({ where: { email } })
    if (exists) return res.status(400).json({ error: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, password: hashed, role: safeRole, skills_offered, skills_needed })
    const payload = { id: user.id, email: user.email }
    const token = signAccess(payload)
    const refreshToken = signRefresh(payload)
    res.cookie('pp_refresh', refreshToken, cookieOpts)
    logger.info(`New user registered: ${email}`)
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (err) {
    logger.error('Register error', { error: err.message })
    res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (checkLock(email)) {
      return res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' })
    }

    const user = await User.findOne({ where: { email } })
    // Always run bcrypt to prevent timing-based email enumeration
    const DUMMY = '$2a$12$dummyhashtopreventtimingattacksonloginflowinproduction'
    const valid = await bcrypt.compare(password, user?.password || DUMMY)

    if (!user || !valid) {
      if (user) recordFailure(email)
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    clearAttempts(email)
    const payload = { id: user.id, email: user.email }
    const token = signAccess(payload)
    const refreshToken = signRefresh(payload)
    res.cookie('pp_refresh', refreshToken, cookieOpts)
    logger.info(`User logged in: ${email}`)
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (err) {
    logger.error('Login error', { error: err.message })
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
}

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.pp_refresh
    if (!token) return res.status(401).json({ error: 'No refresh token' })
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET)
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'email'] })
    if (!user) return res.status(401).json({ error: 'User not found' })
    const newAccess = signAccess({ id: user.id, email: user.email })
    res.json({ token: newAccess })
  } catch {
    res.clearCookie('pp_refresh')
    res.status(401).json({ error: 'Invalid refresh token' })
  }
}

export const logout = (req, res) => {
  res.clearCookie('pp_refresh', cookieOpts)
  res.json({ message: 'Logged out' })
}

export const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry'] },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ where: { email } })
    // Always return same message to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link was sent.' })
    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
    await user.update({ reset_token: hashedToken, reset_token_expiry: new Date(Date.now() + 3600000) })
    await sendPasswordResetEmail(email, rawToken)
    const isDev = process.env.NODE_ENV !== 'production'
    res.json({
      message: 'If that email exists, a reset link was sent.',
      ...(isDev && { dev_token: rawToken }),
    })
  } catch (err) {
    logger.error('Forgot password error', { error: err.message })
    res.status(500).json({ error: 'Failed to process request. Please try again.' })
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and a number',
      })
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    const user = await User.findOne({ where: { reset_token: hashedToken } })
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' })
    if (new Date() > new Date(user.reset_token_expiry)) {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' })
    }
    const hashed = await bcrypt.hash(password, 12)
    await user.update({ password: hashed, reset_token: null, reset_token_expiry: null })
    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    logger.error('Reset password error', { error: err.message })
    res.status(500).json({ error: 'Failed to reset password. Please try again.' })
  }
}
