import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, CalendarDays, CreditCard, Dumbbell, LogOut,
  Mail, Phone, RefreshCw, ShieldCheck, UserRound
} from 'lucide-react';
import './ClientDashboard.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(amount);
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/client/me`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();

      if (response.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load your dashboard.');
      }

      setClient(data.client);
      setMemberships(Array.isArray(data.memberships) ? data.memberships : []);
      setCsrfToken(data.csrfToken || '');
    } catch (err) {
      setError(err.message || 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const latestMembership = memberships[0] || null;
  const membershipStatus = useMemo(() => {
    if (!latestMembership) return 'No membership';
    if (latestMembership.status === 'cancelled') return 'Cancelled';
    if (latestMembership.status === 'expired') return 'Expired';
    if (latestMembership.expiry_date) {
      const expiry = new Date(latestMembership.expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!Number.isNaN(expiry.getTime()) && expiry < today) return 'Expired';
    }
    return latestMembership.status || '—';
  }, [latestMembership]);

  async function handleLogout() {
    setLoggingOut(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/client/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to log out.');
      }
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Logout failed. Please try again.');
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="client-dashboard-state">
        <div className="client-dashboard-state-card">
          <span className="client-dashboard-spinner" />
          <p>Loading your AURAFIT dashboard...</p>
        </div>
      </main>
    );
  }

  if (error && !client) {
    return (
      <main className="client-dashboard-state">
        <div className="client-dashboard-state-card">
          <p className="client-dashboard-error" role="alert">{error}</p>
          <button className="client-dashboard-primary" onClick={loadDashboard}>
            <RefreshCw size={17} /> Try again
          </button>
          <Link className="client-dashboard-back" to="/login">Back to login</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="client-dashboard">
      <header className="client-dashboard-header">
        <Link to="/" className="client-dashboard-brand">
          <span className="client-dashboard-brand-icon"><Dumbbell size={20} /></span>
          <span>AURAFIT <small>MEMBER AREA</small></span>
        </Link>
        <div className="client-dashboard-header-actions">
          <button className="client-dashboard-refresh" onClick={loadDashboard} title="Refresh dashboard">
            <RefreshCw size={17} /> <span>Refresh</span>
          </button>
          <button className="client-dashboard-logout" onClick={handleLogout} disabled={loggingOut}>
            <LogOut size={17} /> {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </header>

      <section className="client-dashboard-content">
        <div className="client-dashboard-welcome">
          <div>
            <p className="client-dashboard-eyebrow">YOUR FITNESS JOURNEY</p>
            <h1>Welcome, {client?.full_name || 'Member'}.</h1>
            <p>Here’s your membership overview and account information.</p>
          </div>
          <div className="client-dashboard-member-chip">
            <span>MEMBER ID</span>
            <strong>{client?.member_id || 'Not assigned'}</strong>
          </div>
        </div>

        {error && <p className="client-dashboard-inline-error" role="alert">{error}</p>}

        <div className="client-dashboard-summary-grid">
          <article className="client-dashboard-summary-card">
            <span className="client-dashboard-summary-icon"><ShieldCheck size={20} /></span>
            <p>Membership status</p>
            <strong className={`client-status-${String(membershipStatus).toLowerCase().replace(/\s+/g, '-')}`}>
              {membershipStatus}
            </strong>
          </article>
          <article className="client-dashboard-summary-card">
            <span className="client-dashboard-summary-icon"><CreditCard size={20} /></span>
            <p>Latest plan</p>
            <strong>{latestMembership?.plan_name || 'No plan assigned'}</strong>
          </article>
          <article className="client-dashboard-summary-card">
            <span className="client-dashboard-summary-icon"><CalendarDays size={20} /></span>
            <p>Membership expiry</p>
            <strong>{formatDate(latestMembership?.expiry_date)}</strong>
          </article>
        </div>

        <div className="client-dashboard-columns">
          <section className="client-dashboard-panel">
            <div className="client-dashboard-panel-heading">
              <div>
                <p className="client-dashboard-eyebrow">ACCOUNT</p>
                <h2>Personal details</h2>
              </div>
              <span className="client-dashboard-panel-icon"><UserRound size={20} /></span>
            </div>
            <div className="client-dashboard-detail-row">
              <span><UserRound size={16} /> Full name</span>
              <strong>{client?.full_name || '—'}</strong>
            </div>
            <div className="client-dashboard-detail-row">
              <span><Mail size={16} /> Email</span>
              <strong>{client?.email || 'Not provided'}</strong>
            </div>
            <div className="client-dashboard-detail-row">
              <span><Phone size={16} /> Mobile</span>
              <strong>{client?.phone || '—'}</strong>
            </div>
            <div className="client-dashboard-detail-row">
              <span><Activity size={16} /> Account status</span>
              <strong>{client?.status || '—'}</strong>
            </div>
          </section>

          <section className="client-dashboard-panel">
            <div className="client-dashboard-panel-heading">
              <div>
                <p className="client-dashboard-eyebrow">YOUR PLAN</p>
                <h2>Latest membership</h2>
              </div>
              <span className="client-dashboard-panel-icon"><Dumbbell size={20} /></span>
            </div>
            {latestMembership ? (
              <>
                <div className="client-dashboard-plan-name">{latestMembership.plan_name || 'Membership plan'}</div>
                <div className="client-dashboard-price">{money(latestMembership.price)}</div>
                <div className="client-dashboard-detail-row">
                  <span>Start date</span><strong>{formatDate(latestMembership.start_date)}</strong>
                </div>
                <div className="client-dashboard-detail-row">
                  <span>Expiry date</span><strong>{formatDate(latestMembership.expiry_date)}</strong>
                </div>
                <div className="client-dashboard-detail-row">
                  <span>Payment status</span><strong>{latestMembership.payment_status || '—'}</strong>
                </div>
                <div className="client-dashboard-detail-row">
                  <span>Amount paid</span><strong>{money(latestMembership.amount_paid)}</strong>
                </div>
                <div className="client-dashboard-detail-row">
                  <span>Payment method</span><strong>{latestMembership.payment_method || '—'}</strong>
                </div>
              </>
            ) : (
              <p className="client-dashboard-empty">No membership has been assigned to this account yet. Please contact the gym owner.</p>
            )}
          </section>
        </div>

        <section className="client-dashboard-panel client-dashboard-history">
          <div className="client-dashboard-panel-heading">
            <div>
              <p className="client-dashboard-eyebrow">RECORDS</p>
              <h2>Membership history</h2>
            </div>
          </div>
          {memberships.length ? (
            <div className="client-dashboard-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Plan</th><th>Start date</th><th>Expiry date</th>
                    <th>Amount paid</th><th>Payment</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((membership) => (
                    <tr key={membership.id}>
                      <td>{membership.plan_name || '—'}</td>
                      <td>{formatDate(membership.start_date)}</td>
                      <td>{formatDate(membership.expiry_date)}</td>
                      <td>{money(membership.amount_paid)}</td>
                      <td>{membership.payment_status || '—'}</td>
                      <td>{membership.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="client-dashboard-empty">Your membership records will appear here after the owner assigns a plan.</p>
          )}
        </section>
        <p className="client-dashboard-readonly-note">This dashboard is read-only. Contact the gym owner for membership or payment changes.</p>
      </section>
    </main>
  );
}
