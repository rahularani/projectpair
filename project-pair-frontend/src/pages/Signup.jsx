import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Zap, ArrowRight, Code2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

const SKILLS = ['React', 'Node.js', 'Python', 'UI/UX', 'DevOps', 'Mobile', 'Web3', 'AI/ML', 'Backend', 'Frontend']

export default function Signup() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '', skills: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { register } = useAuth()
  const { showToast, onLogin } = useApp()
  const navigate = useNavigate()

  const toggleSkill = (s) => setForm(f => ({
    ...f, skills: f.skills.includes(s) ? f.skills.filter(x => x !== s) : [...f.skills, s],
  }))

  const validateStep1 = () => {
    if (!form.name.trim()) return 'Full name is required'
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) return 'Valid email is required'
    if (form.password.length < 8) return 'Password must be at least 8 characters'
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) return 'Password must include uppercase, lowercase, and a number'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
      setStep(2)
      return
    }

    if (!form.role.trim()) { setError('Please enter your role'); return }

    setLoading(true)
    try {
      await register({ name: form.name, email: form.email, password: form.password, role: form.role, skills_offered: form.skills })
      onLogin()
      showToast('Account created! Welcome to ProjectPair 🎉', 'success')
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', position: 'relative' }}>
      <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.06), transparent)', pointerEvents: 'none' }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 2 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, background: 'var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="#000" fill="#000" />
            </div>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20 }}>Project<span style={{ color: 'var(--accent)' }}>Pair</span></span>
          </Link>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
            {step === 1 ? 'Create your account' : 'Set up your profile'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>Step {step} of 2</p>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16 }}>
            {[1, 2].map(s => (
              <div key={s} style={{ height: 3, width: 40, borderRadius: 2, background: s <= step ? 'var(--accent)' : 'var(--border)', transition: 'background 0.3s' }} />
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '36px' }}>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#f87171' }}>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {step === 1 ? (
              <>
                <Field icon={User} label="Full Name" type="text" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Alex Kumar" />
                <Field icon={Mail} label="Email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="you@example.com" />
                <Field icon={Lock} label="Password" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="Min 8 chars, uppercase, number" />
              </>
            ) : (
              <>
                <Field icon={Code2} label="Your Role / Title" type="text" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} placeholder="e.g. Full-Stack Developer" />
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 12 }}>Your Skills</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {SKILLS.map(s => (
                      <motion.button key={s} type="button" onClick={() => toggleSkill(s)}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'none',
                          background: form.skills.includes(s) ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${form.skills.includes(s) ? 'rgba(249,115,22,0.4)' : 'var(--border)'}`,
                          color: form.skills.includes(s) ? 'var(--accent)' : 'var(--text-secondary)',
                          transition: 'all 0.2s',
                        }}
                      >{s}</motion.button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <motion.button type="submit" disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02, boxShadow: loading ? 'none' : '0 0 30px rgba(249,115,22,0.3)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 10,
                padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
              }}
            >
              {loading
                ? <><Loader /> Creating account...</>
                : step === 1
                  ? <><span>Continue</span><ArrowRight size={16} /></>
                  : <><span>Launch My Profile</span><ArrowRight size={16} /></>
              }
            </motion.button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Loader() {
  return <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', animation: 'spin 0.7s linear infinite' }} />
}

function Field({ icon: Icon, label, ...props }) {
  const { onChange, ...rest } = props
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <Icon size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input {...rest} onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 14px 12px 40px', color: 'var(--text-primary)',
            fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>
    </div>
  )
}
