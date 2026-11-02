
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, UserRound } from 'lucide-react';
import './ClientLogin.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ClientLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/client/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      navigate('/client/dashboard');
    } catch (err) {
      setError(err.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="client-login-page">
      <div className="client-login-card">
        <Link to="/login" className="client-login-back">
          <ArrowLeft size={17} /> Back
        </Link>

        <div className="client-login-icon">
          <UserRound size={30} />
        </div>

        <p className="client-login-kicker">AURAFIT MEMBER ACCESS</p>
        <h1>CLIENT <span>LOGIN</span></h1>
        <p className="client-login-description">
          Log in to access your membership and personal dashboard.
        </p>

        <form onSubmit={handleLogin}>
          <label>Email address</label>
          <div className="client-login-input">
            <Mail size={18} />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label>Password</label>
          <div className="client-login-input">
            <Lock size={18} />
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="client-login-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'LOGGING IN...' : 'LOGIN TO YOUR ACCOUNT'}
          </button>
        </form>

        <p className="client-login-register">
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </main>
  );
}
