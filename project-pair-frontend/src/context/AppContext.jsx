import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { notificationsAPI } from '../services/api'
import { getSocket } from '../services/socket'
import { setLogoutCallback } from './AuthContext'

const AppContext = createContext(null)

export const AppProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const [toast, setToast] = useState(null)
  const boundSocket = useRef(null)

  const fetchNotifications = useCallback(async () => {
    if (!localStorage.getItem('pp_token')) return
    try {
      const res = await notificationsAPI.getAll()
      setNotifications(res.data)
    } catch {}
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const bindSocket = useCallback(() => {
    const socket = getSocket()
    if (!socket || socket === boundSocket.current) return
    if (boundSocket.current) boundSocket.current.off('notification')
    boundSocket.current = socket
    socket.on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev])
    })
  }, [])

  useEffect(() => {
    bindSocket()
    const t = setInterval(bindSocket, 1000)
    const stop = setTimeout(() => clearInterval(t), 10000)
    return () => { clearInterval(t); clearTimeout(stop) }
  }, [bindSocket])

  const onLogin = useCallback(() => {
    fetchNotifications()
    setTimeout(bindSocket, 500)
  }, [fetchNotifications, bindSocket])

  const onLogout = useCallback(() => {
    if (boundSocket.current) {
      boundSocket.current.off('notification')
      boundSocket.current = null
    }
    setNotifications([])
  }, [])

  useEffect(() => { setLogoutCallback(onLogout) }, [onLogout])

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    try { await notificationsAPI.markAllRead() } catch {}
  }

  const markOneRead = async (id) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, is_read: true } : n
    ))
    try { await notificationsAPI.markOneRead(id) } catch {}
  }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  return (
    <AppContext.Provider value={{
      notifications, markAllRead, markOneRead,
      fetchNotifications, onLogin, onLogout, toast, showToast,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
