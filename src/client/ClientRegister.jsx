
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRound, Mail, Phone, Lock } from 'lucide-react';
import './ClientRegister.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ClientRegister() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/client/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      setSuccess(
        data.message ||
        'Registration successful! You can now log in to your SYLAS Gym account.'

      );

      setForm({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
      });

    } catch (err) {
      setError(
        err.message || 'Unable to connect to the server. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="client-register">
      <div className="client-register-container">

        <Link to="/login" className="register-back">
          ← Back to login
        </Link>

        <p className="register-kicker">SYLAS Gym MEMBER ACCESS</p>

        <h1>CREATE YOUR <span>ACCOUNT.</span></h1>

        <p className="register-description">
          Join Sylas Gym and start your fitness journey.
        </p>

        {success ? (
  <div className="register-success">
    <h2>WELCOME TO SYLAS Gym!</h2>

    <p>{success}</p>

    <p>
      Your account is active. You can log in immediately
      and explore the available membership plans.
    </p>

    <Link to="/client/login">LOGIN TO YOUR ACCOUNT ↗</Link>
  </div>
) : (
          <form onSubmit={handleSubmit} className="client-register-form">

            <label>FULL NAME</label>
            <div className="register-input">
              <UserRound size={18} />
              <input
                type="text"
                name="fullName"
                placeholder="Enter your full name"
                value={form.fullName}
                onChange={handleChange}
                minLength={2}
                maxLength={100}
                autoComplete="name"
                required
              />
            </div>

            <label>EMAIL ADDRESS</label>
            <div className="register-input">
              <Mail size={18} />
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
                maxLength={255}
                autoComplete="email"
                required
              />
            </div>

            <label>PHONE NUMBER</label>
            <div className="register-input">
              <Phone size={18} />
              <input
                type="tel"
                name="phone"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={handleChange}
                maxLength={20}
                autoComplete="tel"
                required
              />
            </div>

            <label>PASSWORD</label>
            <div className="register-input">
              <Lock size={18} />
              <input
                type="password"
                name="password"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={handleChange}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>

            <label>CONFIRM PASSWORD</label>
            <div className="register-input">
              <Lock size={18} />
              <input
                type="password"
                name="confirmPassword"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <p className="register-error">{error}</p>
            )}

            <button
              type="submit"
              className="register-submit"
              disabled={loading}
            >
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT ↗'}
            </button>

          </form>
        )}

        <p className="register-login">
          Already have an account? <Link to="/client/login">Login here</Link>
        </p>

      </div>
    </main>
  );
}
