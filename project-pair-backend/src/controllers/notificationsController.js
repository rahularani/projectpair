import { Notification } from '../models/index.js'
import { logger } from '../services/logger.js'

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 30, 100)
    const offset = (page - 1) * limit

    const { rows, count } = await Notification.findAndCountAll({
      where: { user_id: req.user.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    })
    res.json({ notifications: rows, total: count, page })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
}

// PUT /api/notifications/read-all
export const markAllRead = async (req, res) => {
  try {
    await Notification.update({ is_read: true }, { where: { user_id: req.user.id, is_read: false } })
    res.json({ message: 'All marked as read' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications as read' })
  }
}

// PUT /api/notifications/:id/read
export const markOneRead = async (req, res) => {
  try {
    const [updated] = await Notification.update(
      { is_read: true },
      { where: { id: req.params.id, user_id: req.user.id } }
    )
    if (!updated) return res.status(404).json({ error: 'Notification not found' })
    res.json({ message: 'Marked as read' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
}

// Helper — called internally to create + emit a notification
export const createNotification = async ({ user_id, type, title, body, link }) => {
  try {
    const notif = await Notification.create({ user_id, type, title, body, link })
    const socketIds = global.onlineUsers?.get(user_id)
    if (socketIds && global.io) {
      socketIds.forEach(sid => global.io.to(sid).emit('notification', notif.toJSON()))
    }
    return notif
  } catch (err) {
    logger.error('Failed to create notification', { error: err.message, user_id, type })
  }
}
