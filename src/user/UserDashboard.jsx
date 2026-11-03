
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserRound,
  LayoutDashboard,
  CreditCard,
  MessageSquare,
  LogOut,
  Dumbbell,
  CheckCircle,
  Clock,
  Save,
  Send,
  RefreshCw,
} from 'lucide-react';

import './UserDashboard.css';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

export default function UserDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [profile, setProfile] = useState({
    fullName: '',
    phone: '',
  });

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (response.status === 401) {
        navigate('/user/login', { replace: true });
      }

      throw new Error(data.message || 'Something went wrong.');
    }

    return data;
  }

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const [profileData, planData, enquiryData] = await Promise.all([
        apiRequest('/api/user/me'),
        apiRequest('/api/membership-plans'),
        apiRequest('/api/user/enquiries'),
      ]);

      setUser(profileData.user);
      setCsrfToken(profileData.csrfToken);

      setProfile({
        fullName: profileData.user.full_name,
        phone: profileData.user.phone,
      });

      setPlans(planData.plans || []);
      setEnquiries(enquiryData.enquiries || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleProfileSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const data = await apiRequest('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(profile),
      });

      setUser(data.user);
      setMessage('Your profile has been updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEnquirySubmit(event) {
    event.preventDefault();

    if (!selectedPlan) return;

    setSending(true);
    setMessage('');
    setError('');

    try {
      await apiRequest('/api/user/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          membershipPlanId: selectedPlan.id,
          message: enquiryMessage,
        }),
      });

      setMessage('Your membership enquiry has been submitted.');
      setSelectedPlan(null);
      setEnquiryMessage('');

      const data = await apiRequest('/api/user/enquiries');
      setEnquiries(data.enquiries || []);

      setActiveTab('enquiries');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleLogout() {
    setError('');

    try {
      await apiRequest('/api/user/logout', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      navigate('/user/login', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="user-dashboard-loading">
        Loading your dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-dashboard-loading">
        <p>{error || 'Unable to load your account.'}</p>
        <button onClick={() => navigate('/user/login')}>
          Go to Login
        </button>
      </div>
    );
  }

  const firstName = user.full_name?.split(' ')[0] || 'User';

  return (
    <div className="user-dashboard">
      <aside className="user-sidebar">
        <div className="user-brand">
          <Dumbbell size={27} />
          <span>AURAFIT</span>
        </div>

        <div className="user-sidebar-profile">
          <div className="user-avatar">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{user.full_name}</strong>
            <small>Website Account</small>
          </div>
        </div>

        <nav className="user-navigation">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={19} />
            Overview
          </button>

          <button
            className={activeTab === 'profile' ? 'active' : ''}
            onClick={() => setActiveTab('profile')}
          >
            <UserRound size={19} />
            My Profile
          </button>

          <button
            className={activeTab === 'plans' ? 'active' : ''}
            onClick={() => setActiveTab('plans')}
          >
            <CreditCard size={19} />
            Membership Plans
          </button>

          <button
            className={activeTab === 'enquiries' ? 'active' : ''}
            onClick={() => setActiveTab('enquiries')}
          >
            <MessageSquare size={19} />
            My Enquiries
          </button>
        </nav>

        <button className="user-logout" onClick={handleLogout}>
          <LogOut size={19} />
          Sign Out
        </button>
      </aside>

      <main className="user-main">
        <header className="user-topbar">
          <div>
            <p>AURAFIT GYM / PERSONAL SPACE</p>
            <h1>
              {activeTab === 'overview' && 'Dashboard'}
              {activeTab === 'profile' && 'My Profile'}
              {activeTab === 'plans' && 'Membership Plans'}
              {activeTab === 'enquiries' && 'My Enquiries'}
            </h1>
          </div>

          <button
            className="user-refresh"
            onClick={loadDashboard}
            title="Refresh dashboard"
          >
            <RefreshCw size={18} />
          </button>
        </header>

        {error && <div className="user-alert error">{error}</div>}
        {message && <div className="user-alert success">{message}</div>}

        {activeTab === 'overview' && (
          <section>
            <div className="user-welcome">
              <div>
                <p>WELCOME BACK</p>
                <h2>Let's get stronger, {firstName}.</h2>
                <span>
                  Explore our plans and take the next step in your fitness journey.
                </span>
              </div>
              <Dumbbell size={75} />
            </div>

            <div className="user-stats">
              <div className="user-stat-card">
                <MessageSquare size={23} />
                <h2>{enquiries.length}</h2>
                <p>Total Enquiries</p>
              </div>

              <div className="user-stat-card">
                <CreditCard size={23} />
                <h2>{plans.length}</h2>
                <p>Available Plans</p>
              </div>

              <div className="user-stat-card">
                <CheckCircle size={23} />
                <h2>{user.status}</h2>
                <p>Account Status</p>
              </div>
            </div>

            <div className="user-content-card">
              <h2>Explore AURAFIT Memberships</h2>
              <p>
                Compare available plans and submit an enquiry to our gym team.
              </p>
              <button
                className="user-primary-button"
                onClick={() => setActiveTab('plans')}
              >
                EXPLORE PLANS
              </button>
            </div>

            <div className="user-content-card">
              <h2>Account Information</h2>
              <p><strong>Name:</strong> {user.full_name}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Phone:</strong> {user.phone}</p>
              <p>
                <strong>Registered:</strong>{' '}
                {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="user-content-card">
            <h2>Personal Information</h2>
            <p>Manage your public website account details.</p>

            <form className="user-profile-form" onSubmit={handleProfileSave}>
              <label>Full Name</label>
              <input
                value={profile.fullName}
                onChange={(e) =>
                  setProfile({ ...profile, fullName: e.target.value })
                }
                minLength={2}
                maxLength={100}
                required
              />

              <label>Email Address</label>
              <input value={user.email} disabled />

              <label>Phone Number</label>
              <input
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                required
              />

              <button
                className="user-primary-button"
                type="submit"
                disabled={saving}
              >
                <Save size={17} />
                {saving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            </form>
          </section>
        )}

        {activeTab === 'plans' && (
          <section>
            <div className="user-section-heading">
              <h2>Choose Your Fitness Plan</h2>
              <p>Explore our currently available membership plans.</p>
            </div>

            <div className="user-plans-grid">
              {plans.map((plan) => (
                <article className="user-plan-card" key={plan.id}>
                  <div className="user-plan-icon">
                    <Dumbbell size={25} />
                  </div>

                  <h2>{plan.name}</h2>

                  <div className="user-plan-price">
                    ₹{Number(plan.price).toLocaleString('en-IN')}
                  </div>

                  <p>{plan.duration_months} Month(s)</p>

                  <p className="user-plan-description">
                    {plan.description}
                  </p>

                  <ul>
                    {(Array.isArray(plan.benefits) ? plan.benefits : []).map(
                      (benefit, index) => (
                        <li key={index}>
                          <CheckCircle size={15} />
                          {benefit}
                        </li>
                      )
                    )}
                  </ul>

                  <button
                    className="user-primary-button"
                    onClick={() => {
                      setSelectedPlan(plan);
                      setEnquiryMessage('');
                      setError('');
                    }}
                  >
                    ENQUIRE ABOUT THIS PLAN
                  </button>
                </article>
              ))}
            </div>

            {plans.length === 0 && (
              <div className="user-content-card">
                No membership plans are currently available.
              </div>
            )}
          </section>
        )}

        {activeTab === 'enquiries' && (
          <section className="user-content-card">
            <h2>My Membership Enquiries</h2>
            <p>Track the enquiries you have submitted to AURAFIT.</p>

            {enquiries.length === 0 ? (
              <div className="user-empty">
                <MessageSquare size={40} />
                <h3>No enquiries yet</h3>
                <p>Explore our plans and send your first enquiry.</p>
                <button
                  className="user-primary-button"
                  onClick={() => setActiveTab('plans')}
                >
                  VIEW PLANS
                </button>
              </div>
            ) : (
              <div className="user-enquiry-list">
                {enquiries.map((enquiry) => (
                  <div className="user-enquiry-item" key={enquiry.id}>
                    <div>
                      <h3>{enquiry.plan_name || 'Membership Plan'}</h3>
                      <p>{enquiry.message || 'No additional message'}</p>
                      <small>
                        {new Date(enquiry.created_at).toLocaleDateString()}
                      </small>
                    </div>

                    <span className={`user-status ${enquiry.status}`}>
                      <Clock size={14} />
                      {enquiry.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {selectedPlan && (
        <div
          className="user-modal-overlay"
          onClick={() => setSelectedPlan(null)}
        >
          <div
            className="user-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="user-modal-close"
              onClick={() => setSelectedPlan(null)}
            >
              ×
            </button>

            <p className="user-kicker">AURAFIT GYM</p>
            <h2>Membership Enquiry</h2>

            <div className="user-selected-plan">
              <strong>{selectedPlan.name}</strong>
              <span>
                ₹{Number(selectedPlan.price).toLocaleString('en-IN')} /{' '}
                {selectedPlan.duration_months} month(s)
              </span>
            </div>

            <form onSubmit={handleEnquirySubmit}>
              <label>Message (optional)</label>
              <textarea
                rows={4}
                maxLength={1000}
                placeholder="Tell us if you have any questions..."
                value={enquiryMessage}
                onChange={(e) => setEnquiryMessage(e.target.value)}
              />

              <button
                className="user-primary-button"
                type="submit"
                disabled={sending}
              >
                <Send size={17} />
                {sending ? 'SUBMITTING...' : 'SUBMIT ENQUIRY'}
              </button>
            </form>

            <small>
              Submitting an enquiry does not activate a gym membership.
              Our team will contact you.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
