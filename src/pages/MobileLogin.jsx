import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, UserRound, Dumbbell, Globe } from 'lucide-react';
import './MobileLogin.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function MobileLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState('');

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setAccounts([]);

    const normalizedPhone = phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/mobile-login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Login failed.');
      }

      setAccounts(data.accounts || []);
      if ((data.accounts || []).length === 1) {
        await selectAccount(data.accounts[0]);
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  }

  async function selectAccount(account) {
    setError('');
    const key = `${account.type}-${account.id}`;
    setSelecting(key);

    try {
      const response = await fetch(`${API_URL}/api/auth/select-account`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: account.type, id: account.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to open this account.');
      }

      navigate(data.redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to select this account.');
      setAccounts([]);
    } finally {
      setSelecting('');
    }
  }

  return (
    <main className="mobile-login-page">
      <div className="mobile-login-card">
        <Link to="/" className="mobile-login-back">← Back to AURAFIT</Link>

        <div className="mobile-login-icon"><UserRound size={30} /></div>
        <p className="mobile-login-kicker">AURAFIT GYM / MEMBER ACCESS</p>
        <h1>MOBILE LOGIN</h1>
        <p className="mobile-login-description">
          Enter your registered mobile number to find your AURAFIT account.
        </p>

        <form onSubmit={handleLogin}>
          <label htmlFor="mobile-login-phone">Mobile number</label>
          <div className="mobile-login-input">
            <Phone size={18} />
            <input
              id="mobile-login-phone"
              type="tel"
              inputMode="numeric"
              placeholder="Enter 10-digit mobile number"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setAccounts([]);
                setError('');
              }}
              autoComplete="tel"
              maxLength={15}
              required
            />
          </div>

          {error && <p className="mobile-login-error" role="alert">{error}</p>}

          <button type="submit" disabled={loading || Boolean(selecting)}>
            {loading ? 'SEARCHING...' : 'CONTINUE'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {accounts.length > 1 && (
          <section className="mobile-account-picker">
            <h2>Select an account</h2>
            <p className="mobile-login-description">
              More than one account uses this mobile number. Choose which dashboard to open.
            </p>

            {accounts.map((account) => {
              const key = `${account.type}-${account.id}`;
              return (
                <button
                  type="button"
                  className="mobile-account-option"
                  key={key}
                  onClick={() => selectAccount(account)}
                  disabled={Boolean(selecting)}
                >
                  <span className="mobile-account-avatar">
                    {account.type === 'client' ? <Dumbbell size={19} /> : <Globe size={19} />}
                  </span>
                  <span className="mobile-account-details">
                    <strong>{account.fullName}</strong>
                    <small>
                      {account.type === 'client'
                        ? `Gym Membership · Member ID: ${account.memberId || 'Not assigned'}`
                        : 'Website Account'}
                    </small>
                  </span>
                  <span className="mobile-account-action">
                    {selecting === key ? 'OPENING...' : 'SELECT'}
                  </span>
                </button>
              );
            })}
          </section>
        )}

        <p className="mobile-login-register">
          New to AURAFIT? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
