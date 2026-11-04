import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserRound, ArrowRight, Phone, Mail } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function UserRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const phone = form.phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Registration failed.');
      }

      setSuccess('Account created successfully. Redirecting to mobile login...');
      window.setTimeout(() => {
        navigate('/user/login', { replace: true, state: { phone } });
      }, 900);
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
        <p className="owner-kicker">SYLAS GYM / JOIN US</p>
        <h1>CREATE ACCOUNT</h1>
        <p className="owner-subtitle">
          Register to explore membership plans and connect with our gym.
        </p>

        <form onSubmit={handleRegister} className="owner-form">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName" name="fullName" type="text"
            placeholder="Enter your full name" value={form.fullName}
            onChange={handleChange} autoComplete="name"
            minLength={2} maxLength={100} required
          />

          <label htmlFor="email">Email address</label>
          <input
            id="email" name="email" type="email"
            placeholder="Enter your email" value={form.email}
            onChange={handleChange} autoComplete="email"
            maxLength={255} required
          />

          <label htmlFor="phone">Mobile number</label>
          <input
            id="phone" name="phone" type="tel" inputMode="numeric"
            placeholder="Enter 10-digit mobile number" value={form.phone}
            onChange={handleChange} autoComplete="tel"
            maxLength={15} pattern="[0-9+()\s-]{10,15}" required
          />

          {error && <p className="owner-error" role="alert">{error}</p>}
          {success && <p role="status" style={{ color: '#22c55e' }}>{success}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="owner-subtitle">
          Already have an account? <Link to="/user/login">Sign in</Link>
        </p>
        <Link to="/" className="owner-back-link">← Back to SYLAS Gym</Link>
      </div>
    </main>
  );
}
