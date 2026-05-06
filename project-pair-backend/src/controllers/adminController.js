import { User, Project, PairRequest, Task, Review, Message } from '../models/index.js'
import sequelize from '../config/database.js'
import { fn, col } from 'sequelize'

// All routes here are protected by authenticate + requireAdmin middleware in routes/index.js

export const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalProjects, totalProposals, completedProjects, ratingResult] = await Promise.all([
      User.count(),
      Project.count(),
      PairRequest.count(),
      Project.count({ where: { status: 'completed' } }),
      User.findOne({
        attributes: [[fn('AVG', col('rating')), 'avgRating']],
        raw: true,
      }),
    ])

    res.json({
      totalUsers: totalUsers || 0,
      totalProjects: totalProjects || 0,
      totalProposals: totalProposals || 0,
      completedProjects: completedProjects || 0,
      avgRating: parseFloat(ratingResult?.avgRating || 0).toFixed(2),
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' })
  }
}

export const getUsers = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)
    const offset = parseInt(req.query.offset) || 0

    const users = await User.findAndCountAll({
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry'] },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    })

    res.json({ total: users.count, users: users.rows })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' })
  }
}

export const getProjects = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)
    const offset = parseInt(req.query.offset) || 0

    const projects = await Project.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
    })

    res.json({ total: projects.count, projects: projects.rows })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
}

export const getSystemHealth = async (req, res) => {
  try {
    await sequelize.authenticate()
    res.json({
      status: 'ok',
      database: 'connected',
      onlineUsers: global.onlineUsers?.size || 0,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ status: 'degraded', database: 'disconnected', error: err.message })
  }
}
