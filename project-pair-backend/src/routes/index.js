import { Router } from 'express'
import { body, query, validationResult } from 'express-validator'
import rateLimit from 'express-rate-limit'
import { register, login, refreshToken, logout, getMe, forgotPassword, resetPassword } from '../controllers/authController.js'
import { getProjects, getProject, createProject, updateProject, deleteProject } from '../controllers/projectController.js'
import { sendProposal, getMyProposals, getReceivedProposals, respondToProposal } from '../controllers/pairController.js'
import { getProjectTasks, createTask, updateTask, deleteTask } from '../controllers/tasksController.js'
import { getConversation, getConversations, sendMessage } from '../controllers/messagesController.js'
import { getUser, updateMe } from '../controllers/userController.js'
import { getUserReviews, createReview } from '../controllers/reviewsController.js'
import { getNotifications, markAllRead, markOneRead } from '../controllers/notificationsController.js'
import { getAnalytics } from '../controllers/analyticsController.js'
import { uploadAvatar as uploadAvatarCtrl, uploadChatFile } from '../controllers/uploadController.js'
import { getDashboardStats, getUsers, getProjects as getAdminProjects, getSystemHealth } from '../controllers/adminController.js'
import { uploadAvatar, uploadFile, uploadLocal, isCloudinaryConfigured } from '../services/upload.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const refreshLimiter = rateLimit({ // 🟠 FIX: rate limit refresh endpoint
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many refresh attempts.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })
  next()
}

// ── Auth ──────────────────────────────────────────────
router.post('/auth/register', authLimiter,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate, register
)
router.post('/auth/login', authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate, login
)
router.get('/auth/me', authenticate, getMe)
router.post('/auth/refresh', refreshLimiter, refreshToken)
router.post('/auth/logout', logout)
router.post('/auth/forgot-password', authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  validate, forgotPassword
)
router.post('/auth/reset-password',
  body('token').notEmpty().withMessage('Token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate, resetPassword
)

// ── Users ─────────────────────────────────────────────
router.get('/users/:id', getUser)
router.put('/users/me', authenticate,
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  validate, updateMe
)

// ── Projects ──────────────────────────────────────────
router.get('/projects', getProjects)
router.get('/projects/:id', getProject)
router.post('/projects', authenticate,
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  validate, createProject
)
router.put('/projects/:id', authenticate, updateProject)
router.delete('/projects/:id', authenticate, deleteProject)

// ── Tasks ─────────────────────────────────────────────
router.get('/tasks/project/:projectId', authenticate, getProjectTasks)
router.post('/tasks', authenticate,
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('project_id').isInt().withMessage('project_id is required'),
  validate, createTask
)
router.put('/tasks/:id', authenticate, updateTask)
router.delete('/tasks/:id', authenticate, deleteTask)

// ── Messages ──────────────────────────────────────────
router.get('/messages/conversations', authenticate, getConversations)
router.get('/messages/:userId', authenticate, getConversation)
router.post('/messages', authenticate,
  body('receiver_id').isInt().withMessage('receiver_id is required'),
  body('content').trim().notEmpty().withMessage('Message content is required'),
  validate, sendMessage
)

// ── Notifications ─────────────────────────────────────
router.get('/notifications', authenticate, getNotifications)
router.put('/notifications/read-all', authenticate, markAllRead)
router.put('/notifications/:id/read', authenticate, markOneRead)

// ── Reviews ───────────────────────────────────────────
router.get('/reviews/:userId', getUserReviews)
router.post('/reviews', authenticate,
  body('reviewee_id').isInt().withMessage('reviewee_id is required'),
  body('project_id').isInt().withMessage('project_id is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5'),
  validate, createReview
)

// ── Proposals ─────────────────────────────────────────
router.post('/proposals', authenticate,
  body('project_id').isInt().withMessage('project_id is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  validate, sendProposal
)
router.get('/proposals/mine', authenticate, getMyProposals)
router.get('/proposals/received', authenticate, getReceivedProposals)
router.put('/proposals/:id', authenticate,
  body('status').isIn(['accepted', 'rejected']).withMessage('Status must be accepted or rejected'),
  validate, respondToProposal
)

// ── Upload ────────────────────────────────────────────
const avatarMiddleware = isCloudinaryConfigured() ? uploadAvatar : uploadLocal
const fileMiddleware = isCloudinaryConfigured() ? uploadFile : uploadLocal
router.post('/upload/avatar', authenticate, avatarMiddleware, uploadAvatarCtrl)
router.post('/upload/file', authenticate, fileMiddleware, uploadChatFile)

// ── Analytics ─────────────────────────────────────────
router.get('/analytics', authenticate, getAnalytics)

// ── Admin ─────────────────────────────────────────────
router.get('/admin/dashboard', authenticate, getDashboardStats)
router.get('/admin/users', authenticate, getUsers)
router.get('/admin/projects', authenticate, getAdminProjects)
router.get('/admin/health', authenticate, getSystemHealth)

export default router
