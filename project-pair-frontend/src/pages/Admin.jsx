import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import '../styles/Admin.css'

export default function Admin() {
  const { user } = useAuth()
  const { showToast } = useApp()
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalProposals: 0,
    totalCompleted: 0,
    avgRating: 0,
  })
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      // Fetch admin dashboard stats
      const statsRes = await fetch('http://localhost:5000/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('pp_token')}`
        }
      })
      const statsData = await statsRes.json()
      
      if (statsRes.ok) {
        setStats(statsData)
      } else {
        throw new Error(statsData.error || 'Failed to fetch stats')
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err)
      showToast('Failed to load dashboard data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ icon, title, value, color }) => (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-icon" style={{ color }}>{icon}</div>
      <div className="stat-info">
        <p className="stat-title">{title}</p>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  )

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>🛡️ Admin Dashboard</h1>
        <p>Welcome, {user?.name || 'Admin'}! Manage your platform here.</p>
      </div>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="admin-content">
          {/* Tabs */}
          <div className="admin-tabs">
            <button
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📊 Overview
            </button>
            <button
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              👥 Users
            </button>
            <button
              className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              💼 Projects
            </button>
            <button
              className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              ⚙️ System
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-content overview-tab">
              <div className="stats-grid">
                <StatCard
                  icon="👥"
                  title="Total Users"
                  value={stats.totalUsers}
                  color="#3498db"
                />
                <StatCard
                  icon="💼"
                  title="Total Projects"
                  value={stats.totalProjects}
                  color="#2ecc71"
                />
                <StatCard
                  icon="🤝"
                  title="Pair Proposals"
                  value={stats.totalProposals}
                  color="#f39c12"
                />
                <StatCard
                  icon="✅"
                  title="Completed"
                  value={stats.totalCompleted}
                  color="#9b59b6"
                />
                <StatCard
                  icon="⭐"
                  title="Avg Rating"
                  value={`${stats.avgRating}/5`}
                  color="#e74c3c"
                />
                <StatCard
                  icon="🟢"
                  title="Online Users"
                  value={stats.onlineUsers}
                  color="#27ae60"
                />
              </div>

              <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="actions-grid">
                  <button className="action-btn">📧 Send Notification</button>
                  <button className="action-btn">📋 View Reports</button>
                  <button className="action-btn">🔎 Search Users</button>
                  <button className="action-btn">⚠️ View Flagged Issues</button>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="tab-content users-tab">
              <h3>User Management</h3>
              <p className="no-data">User management features coming soon...</p>
            </div>
          )}

          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <div className="tab-content projects-tab">
              <h3>Project Management</h3>
              <p className="no-data">Project management features coming soon...</p>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="tab-content system-tab">
              <h3>System Information</h3>
              <div className="system-info">
                <div className="info-item">
                  <span className="info-label">Database Status</span>
                  <span className="info-value status-ok">🟢 Connected</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Backend Server</span>
                  <span className="info-value status-ok">🟢 Running (http://localhost:5000)</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Frontend Server</span>
                  <span className="info-value status-ok">🟢 Running (http://localhost:5174)</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Total Projects</span>
                  <span className="info-value">{stats.totalProjects}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Total Registered Users</span>
                  <span className="info-value">{stats.totalUsers}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Active Proposals</span>
                  <span className="info-value">{stats.totalProposals}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
