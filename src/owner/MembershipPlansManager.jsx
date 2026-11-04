import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')
const EMPTY_FORM = { name: '', price: '', duration_months: '1', description: '', benefitsText: '', display_order: '0', is_active: true }

export default function MembershipPlansManager({ csrfToken }) {
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadPlans() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/owner/membership-plans`, { credentials: 'include' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load membership plans.')
      setPlans(data.plans || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadPlans() }, [])

  function startEdit(plan) {
    setEditingId(plan.id)
    setForm({
      name: plan.name || '', price: String(plan.price ?? ''), duration_months: String(plan.duration_months ?? 1),
      description: plan.description || '', benefitsText: (Array.isArray(plan.benefits) ? plan.benefits : []).join('\n'),
      display_order: String(plan.display_order ?? 0), is_active: Boolean(plan.is_active),
    })
    setShowForm(true); setMessage(''); setError('')
  }

  async function savePlan(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    const payload = {
      name: form.name.trim(), price: Number(form.price), duration_months: Number(form.duration_months),
      description: form.description.trim(), benefits: form.benefitsText.split('\n').map(x => x.trim()).filter(Boolean),
      display_order: Number(form.display_order), is_active: Boolean(form.is_active),
    }
    try {
      const response = await fetch(`${API_URL}/api/owner/membership-plans${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PATCH' : 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save membership plan.')
      setMessage(data.message || 'Membership plan saved.')
      setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); await loadPlans()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function deletePlan(plan) {
    if (!window.confirm(`Delete the ${plan.name} plan? Existing client memberships may prevent deletion.`)) return
    setError(''); setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/owner/membership-plans/${plan.id}`, {
        method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': csrfToken },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to delete plan.')
      setMessage('Membership plan deleted.'); await loadPlans()
    } catch (err) { setError(err.message) }
  }

  return <section className="owner-memberships">
    <div className="owner-section-heading">
      <div><p className="owner-kicker">PLANS & PRICING</p><h2>MEMBERSHIP MANAGEMENT</h2></div>
      <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(v => !v); setError('') }}>
        {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'CLOSE' : 'ADD MEMBERSHIP'}
      </button>
    </div>
    {error && <p className="owner-error" role="alert">{error}</p>}
    {message && <p className="owner-success" role="status">{message}</p>}
    {showForm && <form className="membership-admin-form" onSubmit={savePlan}>
      <h3>{editingId ? 'EDIT MEMBERSHIP PLAN' : 'ADD NEW MEMBERSHIP PLAN'}</h3>
      <label>Plan name<input required minLength={2} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>Price (₹)<input required type="number" min="0" max="10000000" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label>
      <label>Duration (months)<input required type="number" min="1" max="60" value={form.duration_months} onChange={e => setForm({ ...form, duration_months: e.target.value })} /></label>
      <label>Display order<input type="number" min="0" max="10000" value={form.display_order} onChange={e => setForm({ ...form, display_order: e.target.value })} /></label>
      <label className="membership-admin-wide">Description<textarea rows="3" maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <label className="membership-admin-wide">Benefits (one per line)<textarea rows="5" value={form.benefitsText} onChange={e => setForm({ ...form, benefitsText: e.target.value })} placeholder={'Access to gym equipment\nLocker facility\nPersonal training support'} /></label>
      {editingId && <label className="membership-admin-check"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Show this plan on the public website</label>}
      <div className="membership-admin-actions">
  <button type="submit" disabled={saving}>
    {saving ? 'SAVING...' : editingId ? 'SAVE CHANGES' : 'CREATE PLAN'}
  </button>

  <button
    type="button"
    className="membership-cancel"
    onClick={() => {
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      setError('')
    }}
  >
    CLOSE FORM
  </button>
</div>
    </form>}
    {loading ? <p className="owner-loading">Loading membership plans...</p> : <div className="membership-admin-list">
      {plans.length === 0 ? <p>No membership plans have been created yet.</p> : plans.map(plan => <article className="membership-admin-card" key={plan.id}>
        <p className="owner-kicker">{plan.is_active ? 'ACTIVE PLAN' : 'HIDDEN PLAN'}</p><h3>{plan.name}</h3>
        <h4>₹{Number(plan.price).toLocaleString('en-IN')}</h4><p>{plan.duration_months} month{Number(plan.duration_months) === 1 ? '' : 's'}</p>
        <p>{plan.description || 'No description added.'}</p>
        <ul>{(Array.isArray(plan.benefits) ? plan.benefits : []).map((benefit, i) => <li key={`${plan.id}-${i}`}>{benefit}</li>)}</ul>
        <div className="membership-admin-actions"><button type="button" onClick={() => startEdit(plan)}><Pencil size={15} /> EDIT</button><button type="button" className="membership-delete" onClick={() => deletePlan(plan)}><Trash2 size={15} /> DELETE</button></div>
      </article>)}
    </div>}
  </section>
}
