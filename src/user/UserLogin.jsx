import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, ArrowRight, UserRound } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function UserLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(event) {
    event.preventDefault();
    setError('');

    const normalizedPhone = phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Login failed.');
      }
      navigate('/user/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="owner-page">
      <div className="owner-login-card">
        <div className="owner-login-icon"><UserRound size={30} /></div>
        <p className="owner-kicker">AURAFIT GYM / MEMBER ACCESS</p>
        <h1>MOBILE LOGIN</h1>
        <p className="owner-subtitle">
          Enter your registered mobile number to access your website account.
        </p>

        <form onSubmit={handleLogin} className="owner-form">
          <label htmlFor="user-phone">Mobile number</label>
          <input
            id="user-phone" type="tel" inputMode="numeric"
            placeholder="Enter 10-digit mobile number"
            value={phone} onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel" maxLength={15}
            pattern="[0-9+()\s-]{10,15}" required
          />

          {error && <p className="owner-error" role="alert">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'SIGNING IN...' : 'CONTINUE'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="owner-subtitle">
          Don't have an account? <Link to="/register">Create account</Link>
        </p>
        <Link to="/" className="owner-back-link">← Back to AURAFIT Gym</Link>
      </div>
    </main>
  );
}
