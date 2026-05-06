import jwt from 'jsonwebtoken'
import { User } from '../models/index.js'

export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Middleware to require admin role
export const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'role'] })
    if (!user || user.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  } catch {
    res.status(500).json({ error: 'Authorization check failed' })
  }
}
