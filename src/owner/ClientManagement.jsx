
import { useEffect, useState } from 'react'
import { Search, UserRound, CreditCard, RefreshCw } from 'lucide-react'
import './ClientManagement.css'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '')

export default function ClientManagement({ csrfToken }) {
  const [clients, setClients] = useState([])
  const [plans, setPlans] = useState([])
  const [search, setSearch] = useState('')
  const [selectedPlans, setSelectedPlans] = useState({})
  const [amounts, setAmounts] = useState({})
  const [methods, setMethods] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [clientResponse, planResponse] = await Promise.all([
        fetch(`${API_URL}/api/owner/clients?search=${encodeURIComponent(search)}`, {
          credentials: 'include',
        }),
        fetch(`${API_URL}/api/owner/membership-plans`, {
          credentials: 'include',
        }),
      ])

      if (clientResponse.status === 401 || planResponse.status === 401) {
        throw new Error('Owner session expired. Please log in again.')
      }

      const clientData = await clientResponse.json()
      const planData = await planResponse.json()

      if (!clientResponse.ok || !clientData.success) {
        throw new Error(clientData.message || 'Unable to load clients.')
      }

      if (!planResponse.ok || !planData.success) {
        throw new Error(planData.message || 'Unable to load membership plans.')
      }

      setClients(clientData.clients || [])
      setPlans(planData.plans || [])
    } catch (err) {
      setError(err.message || 'Unable to load client management.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [search])

  function handlePlanChange(clientId, planId) {
    const plan = plans.find((item) => String(item.id) === planId)

    setSelectedPlans((current) => ({
      ...current,
      [clientId]: planId,
    }))

    setAmounts((current) => ({
      ...current,
      [clientId]: plan ? String(plan.price) : '',
    }))
  }

  async function handleAssign(client) {
    const planId = selectedPlans[client.id]
    const amountPaid = Number(amounts[client.id])
    const paymentMethod = methods[client.id]

    if (!planId) {
      setError('Please select a membership plan.')
      return
    }

    if (
      !Number.isFinite(amountPaid) ||
      amountPaid < 0
    ) {
      setError('Please enter a valid payment amount.')
      return
    }

    if (!paymentMethod) {
      setError('Please select a payment method.')
      return
    }

    setSavingId(client.id)
    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `${API_URL}/api/owner/clients/${client.id}/membership`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({
            membershipPlanId: Number(planId),
            amountPaid,
            paymentMethod,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Membership assignment failed.')
      }

      setMessage(
        `Membership assigned to ${result.clientName}. Member ID: ${result.memberId}`
      )

      await loadData()
    } catch (err) {
      setError(err.message || 'Membership assignment failed.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="client-management">
      <div className="client-management-heading">
        <div>
          <p className="client-management-kicker">MEMBER ADMINISTRATION</p>
          <h2>CLIENT MANAGEMENT</h2>
          <p>Manage registered clients and assign gym memberships.</p>
        </div>

        <button
          type="button"
          className="client-refresh-button"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={16} /> REFRESH
        </button>
      </div>

      {error && <p className="client-management-error">{error}</p>}
      {message && <p className="client-management-success">{message}</p>}

      <div className="client-management-search">
        <Search size={18} />
        <input
          type="search"
          placeholder="Search by name, email, phone or Member ID..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading ? (
        <p className="client-management-empty">Loading clients...</p>
      ) : clients.length === 0 ? (
        <p className="client-management-empty">No registered clients found.</p>
      ) : (
        <div className="client-management-list">
          {clients.map((client) => (
            <article className="client-management-card" key={client.id}>
              <div className="client-management-profile">
                <div className="client-avatar">
                  <UserRound size={22} />
                </div>

                <div>
                  <h3>{client.full_name}</h3>
                  <p>{client.email}</p>
                  <p>{client.phone}</p>
                  <span className={`client-account-status ${client.status}`}>
                    {client.status}
                  </span>
                </div>
              </div>

              <div className="client-member-id">
                <span>MEMBER ID</span>
                <strong>
                  {client.member_id || 'Not assigned yet'}
                </strong>
              </div>

              <div className="client-assignment">
                <label>
                  Membership plan
                  <select
                    value={selectedPlans[client.id] || ''}
                    onChange={(event) =>
                      handlePlanChange(client.id, event.target.value)
                    }
                    disabled={client.status !== 'active'}
                  >
                    <option value="">Select a plan</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — ₹{Number(plan.price).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Amount paid (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amounts[client.id] ?? ''}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [client.id]: event.target.value,
                      }))
                    }
                    disabled={client.status !== 'active'}
                  />
                </label>

                <label>
                  Payment method
                  <select
                    value={methods[client.id] || ''}
                    onChange={(event) =>
                      setMethods((current) => ({
                        ...current,
                        [client.id]: event.target.value,
                      }))
                    }
                    disabled={client.status !== 'active'}
                  >
                    <option value="">Select payment method</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <button
                  type="button"
                  className="client-assign-button"
                  onClick={() => handleAssign(client)}
                  disabled={
                    savingId === client.id ||
                    client.status !== 'active' ||
                    plans.length === 0
                  }
                >
                  <CreditCard size={16} />
                  {savingId === client.id ? 'SAVING...' : 'ASSIGN MEMBERSHIP'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
