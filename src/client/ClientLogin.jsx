import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, ArrowLeft, UserRound, ArrowRight, Dumbbell } from 'lucide-react';
import './ClientLogin.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function ClientLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState(null);

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
      const response = await fetch(`${API_URL}/api/client/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to find a membership account.');
      }

      const foundAccounts = data.accounts || [];
      if (foundAccounts.length === 1) {
        await selectAccount(foundAccounts[0].id);
      } else if (foundAccounts.length > 1) {
        setAccounts(foundAccounts);
      } else {
        throw new Error('No active membership accounts were found.');
      }
    } catch (err) {
      setError(err.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function selectAccount(clientId) {
    setError('');
    setSelectingId(clientId);
    try {
      const response = await fetch(`${API_URL}/api/client/select-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clientId }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to open this membership account.');
      }
      navigate('/client/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to select this account.');
      setAccounts([]);
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <main className="client-login-page">
      <div className="client-login-card">
        <Link to="/login" className="client-login-back">
          <ArrowLeft size={17} /> Back
        </Link>

        <div className="client-login-icon"><UserRound size={30} /></div>
        <p className="client-login-kicker">SYLAS MEMBER ACCESS</p>
        <h1>CLIENT <span>LOGIN</span></h1>
        <p className="client-login-description">
          Enter your registered mobile number to access your gym membership.
        </p>

        <form onSubmit={handleLogin}>
          <label htmlFor="client-phone">Mobile number</label>
          <div className="client-login-input">
            <Phone size={18} />
            <input
              id="client-phone"
              type="tel"
              inputMode="numeric"
              placeholder="Enter 10-digit mobile number"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setAccounts([]);
              }}
              autoComplete="tel"
              maxLength={15}
              pattern="[0-9+()\s-]{10,15}"
              required
            />
          </div>

          {error && <p className="client-login-error" role="alert">{error}</p>}

          <button type="submit" disabled={loading || selectingId !== null}>
            {loading ? 'SEARCHING...' : 'CONTINUE'}
            {!loading && <ArrowRight size={17} />}
          </button>
        </form>

        {accounts.length > 1 && (
          <section className="client-account-picker">
            <h2>Select your membership account</h2>
            <p className="client-login-description">
              Multiple gym accounts use this mobile number. Choose the member you want to open.
            </p>

            {accounts.map((account) => (
              <button
                type="button"
                className="client-account-option"
                key={account.id}
                onClick={() => selectAccount(account.id)}
                disabled={selectingId !== null}
              >
                <span className="client-account-avatar"><Dumbbell size={19} /></span>
                <span className="client-account-details">
                  <strong>{account.fullName}</strong>
                  <small>Member ID: {account.memberId || 'Not assigned'}</small>
                </span>
                <span className="client-account-action">
                  {selectingId === account.id ? 'OPENING...' : 'SELECT'}
                </span>
              </button>
            ))}
          </section>
        )}

        <p className="client-login-register">
          Need a gym membership? Contact the gym owner.
        </p>
      </div>
    </main>
  );
}
