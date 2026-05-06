import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import xssClean from 'xss-clean'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { mkdirSync } from 'fs'
import routes from './routes/index.js'
import { logger, requestLogger } from './services/logger.js'
import { Message, User } from './models/index.js'

dotenv.config()

// ── Validate required env vars at startup ─────────────
const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASS']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

mkdirSync('uploads', { recursive: true })

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 5000
const JWT_SECRET = process.env.JWT_SECRET
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const allowedOrigins = CLIENT_URL.split(',').map(o => o.trim())

// ── Security ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...allowedOrigins],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}))
app.use(xssClean())
app.use(cookieParser())

// ── CORS ──────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static('uploads'))

// ── Request logger ────────────────────────────────────
app.use(requestLogger)
app.use('/api', routes)

app.get('/health', (_, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  db: global.dbConnected ? 'connected' : 'disconnected',
  onlineUsers: global.onlineUsers ? global.onlineUsers.size : 0,
}))

// ── Global error handler ──────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path })
  const status = err.status || 500
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : err.message
  res.status(status).json({ error: message })
})

// ── Socket.io ─────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`CORS blocked: ${origin}`))
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// Map: userId → Set<socketId> (multi-tab support)
global.onlineUsers = new Map()

const getSocketIds = (userId) => global.onlineUsers.get(userId) || new Set()
const emitToUser = (userId, event, data) => {
  getSocketIds(userId).forEach(sid => io.to(sid).emit(event, data))
}

// Socket auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('No token'))
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    socket.userId = decoded.id
    socket.userName = decoded.name || decoded.email
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

io.on('connection', (socket) => {
  const userId = socket.userId
  if (!global.onlineUsers.has(userId)) global.onlineUsers.set(userId, new Set())
  global.onlineUsers.get(userId).add(socket.id)
  logger.info(`🟢 User ${userId} connected (socket: ${socket.id})`)

  // Only notify relevant users, not broadcast to everyone
  emitToUser(userId, 'user_online', { userId })

  socket.on('send_message', async (data) => {
    try {
      const { receiver_id, content } = data
      if (!receiver_id || !content?.trim()) return
      const msg = await Message.create({ sender_id: userId, receiver_id, content: content.trim() })
      const full = await Message.findByPk(msg.id, {
        include: [
          { model: User, as: 'sender', attributes: ['id', 'name', 'email'] },
          { model: User, as: 'receiver', attributes: ['id', 'name', 'email'] },
        ],
      })
      const payload = full.toJSON()
      socket.emit('receive_message', payload)
      emitToUser(receiver_id, 'receive_message', payload)
    } catch (err) {
      logger.error('Socket send_message error', { error: err.message })
      socket.emit('message_error', { error: 'Failed to send message' })
    }
  })

  socket.on('typing', ({ receiver_id, isTyping }) => {
    if (receiver_id) emitToUser(receiver_id, 'typing', { userId, isTyping })
  })

  socket.on('mark_read', async ({ sender_id }) => {
    try {
      await Message.update(
        { is_read: true },
        { where: { sender_id, receiver_id: userId, is_read: false } }
      )
      emitToUser(sender_id, 'messages_read', { by: userId })
    } catch (err) {
      logger.error('Socket mark_read error', { error: err.message })
    }
  })

  socket.on('disconnect', () => {
    const sockets = global.onlineUsers.get(userId)
    if (sockets) {
      sockets.delete(socket.id)
      if (sockets.size === 0) {
        global.onlineUsers.delete(userId)
        emitToUser(userId, 'user_offline', { userId })
      }
    }
    logger.info(`🔴 User ${userId} disconnected`)
  })
})

export { io }
global.io = io

// ── Graceful shutdown ─────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`)
  httpServer.close(async () => {
    try {
      const { default: sequelize } = await import('./config/database.js')
      await sequelize.close()
      logger.info('Database connection closed')
    } catch {}
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ── Start server ──────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`)
  logger.info(`   Health check: http://localhost:${PORT}/health`)
  connectDB()
})

async function connectDB() {
  try {
    const { default: sequelize } = await import('./config/database.js')
    await sequelize.authenticate()
    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' })
    logger.info('✅ MySQL connected and tables synced')
    global.dbConnected = true
  } catch (err) {
    global.dbConnected = false
    logger.error('❌ MySQL connection failed', { error: err.message })
    logger.warn('⚠️  API routes will fail until DB is connected.')
  }
}
