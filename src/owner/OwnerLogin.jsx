
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockKeyhole, ArrowRight } from 'lucide-react'
import './Owner.css'

const API_URL = 'http://localhost:5000'

export default function OwnerLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/owner/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Login failed.')
      }

      navigate('/owner/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="owner-page">
      <div className="owner-login-card">
        <div className="owner-login-icon">
          <LockKeyhole size={30} />
        </div>

        <p className="owner-kicker">SYLAS GYM / PRIVATE ACCESS</p>
        <h1>OWNER LOGIN</h1>
        <p className="owner-subtitle">
          Sign in to manage your gym membership enquiries.
        </p>

        <form onSubmit={handleLogin} className="owner-form">
          <label htmlFor="owner-username">Username</label>
          <input
            id="owner-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="owner-password">Password</label>
          <input
            id="owner-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p className="owner-error" role="alert">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <a href="/" className="owner-back-link">
          ← Back to Sylas Gym
        </a>
      </div>
    </main>
  )
}
