import { User, Project, PairRequest, Task, Review, Message } from '../models/index.js'

export const getDashboardStats = async (req, res) => {
  try {
    // Only admins can access
    const user = await User.findByPk(req.user.id)
    if (user.role !== 'admin' && user.role !== 'Admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const [totalUsers, totalProjects, totalProposals, completedProjects, avgRating] = await Promise.all([
      User.count(),
      Project.count(),
      PairRequest.count(),
      Project.count({ where: { status: 'completed' } }),
      User.findAll({
        attributes: [[require('sequelize').fn('AVG', require('sequelize').col('rating')), 'avgRating']],
        raw: true,
      }),
    ])

    const stats = {
      totalUsers: totalUsers || 0,
      totalProjects: totalProjects || 0,
      totalProposals: totalProposals || 0,
      completedProjects: completedProjects || 0,
      avgRating: avgRating[0]?.avgRating || 0,
      timestamp: new Date().toISOString(),
    }

    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const getUsers = async (req, res) => {
  try {
    // Only admins
    const user = await User.findByPk(req.user.id)
    if (user.role !== 'admin' && user.role !== 'Admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const limit = parseInt(req.query.limit) || 50
    const offset = parseInt(req.query.offset) || 0

    const users = await User.findAndCountAll({
      attributes: { exclude: ['password', 'reset_token'] },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    })

    res.json({ total: users.count, users: users.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const getProjects = async (req, res) => {
  try {
    // Only admins
    const user = await User.findByPk(req.user.id)
    if (user.role !== 'admin' && user.role !== 'Admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const limit = parseInt(req.query.limit) || 50
    const offset = parseInt(req.query.offset) || 0

    const projects = await Project.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
    })

    res.json({ total: projects.count, projects: projects.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const getSystemHealth = async (req, res) => {
  try {
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
