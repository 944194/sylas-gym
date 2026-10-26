
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  UserPlus,
  PhoneCall,
  CheckCircle2,
  LogOut,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import './Owner.css'

const API_URL = 'http://localhost:5000'

const EMPTY_STATS = {
  total: 0,
  new: 0,
  contacted: 0,
  converted: 0,
  closed: 0,
}

export default function OwnerDashboard() {
  const navigate = useNavigate()

  const [enquiries, setEnquiries] = useState([])
  const [owner, setOwner] = useState(null)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [csrfToken, setCsrfToken] = useState("");

  // Wait briefly after typing before searching the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setPage(1)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  async function loadDashboard() {
    setLoading(true)
    setError('')

    try {
      const ownerResponse = await fetch(`${API_URL}/api/owner/me`, {
        credentials: 'include',
      })

      if (ownerResponse.status === 401) {
        navigate('/owner', { replace: true })
        return
      }

      if (!ownerResponse.ok) {
        throw new Error('Unable to verify owner session.')
      }

      const ownerData = await ownerResponse.json()
setOwner(ownerData.owner || null)
setCsrfToken(ownerData.csrfToken || "")

      const params = new URLSearchParams({
        search: debouncedSearch,
        status: statusFilter,
        page: String(page),
      })

      const enquiryResponse = await fetch(
        `${API_URL}/api/enquiries?${params.toString()}`,
        { credentials: 'include' }
      )

      if (enquiryResponse.status === 401) {
        navigate('/owner', { replace: true })
        return
      }

      if (!enquiryResponse.ok) {
        const result = await enquiryResponse.json().catch(() => ({}))
        throw new Error(result.message || 'Unable to load enquiries.')
      }

      const data = await enquiryResponse.json()

      // If the last page disappeared after a status update,
      // return to the last available page.
      if (
        data.pagination?.totalPages > 0 &&
        page > data.pagination.totalPages
      ) {
        setPage(data.pagination.totalPages)
        return
      }

      setEnquiries(data.enquiries || [])
      setPagination(data.pagination || {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
      })

      if (data.stats) {
        setStats(data.stats)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [debouncedSearch, statusFilter, page])

  async function handleStatusChange(enquiryId, newStatus) {
    const previousEnquiries = enquiries

    setEnquiries((current) =>
      current.map((enquiry) =>
        enquiry.id === enquiryId
          ? { ...enquiry, status: newStatus }
          : enquiry
      )
    )

    try {
      const response = await fetch(
        `${API_URL}/api/enquiries/${enquiryId}/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not update status.')
      }

      // Reload the current page and all dashboard totals from PostgreSQL.
      await loadDashboard()
    } catch (err) {
      setEnquiries(previousEnquiries)
      setError(err.message || 'Status update failed.')
    }
  }

  async function handleLogout() {
    try {
      const response = await fetch(`${API_URL}/api/owner/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
    "X-CSRF-Token": csrfToken,
  },
      })

      if (!response.ok) {
        throw new Error('Logout failed. Please try again.')
      }

      navigate('/owner', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  function clearFilters() {
    setSearchTerm('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setPage(1)
  }

  const statCards = [
    {
      label: 'TOTAL ENQUIRIES',
      value: stats.total,
      icon: Users,
    },
    {
      label: 'NEW ENQUIRIES',
      value: stats.new,
      icon: UserPlus,
    },
    {
      label: 'CONTACTED',
      value: stats.contacted,
      icon: PhoneCall,
    },
    {
      label: 'CONVERTED',
      value: stats.converted,
      icon: CheckCircle2,
    },
  ]

  const startRecord =
    pagination.total === 0 ? 0 : (page - 1) * pagination.limit + 1

  const endRecord = Math.min(
    page * pagination.limit,
    pagination.total
  )

  return (
    <main className="owner-dashboard">
      <header className="owner-dashboard-header">
        <div>
          <p className="owner-kicker">SYLAS GYM / MANAGEMENT</p>
          <h1>OWNER DASHBOARD</h1>
          {owner && (
            <p className="owner-subtitle">
              Welcome, {owner.username}
            </p>
          )}
        </div>

        <div className="owner-header-actions">
          <button onClick={loadDashboard} disabled={loading}>
            <RefreshCw size={17} /> REFRESH
          </button>
          <button onClick={handleLogout}>
            <LogOut size={17} /> LOG OUT
          </button>
        </div>
      </header>

      {error && (
        <p className="owner-error" role="alert">
          {error}
        </p>
      )}

      <section className="owner-stats">
        {statCards.map((stat) => {
          const Icon = stat.icon

          return (
            <article className="owner-stat-card" key={stat.label}>
              <Icon size={24} />
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
            </article>
          )
        })}
      </section>

      <section className="owner-enquiries">
        <div className="owner-section-heading">
          <h2>MEMBERSHIP ENQUIRIES</h2>
          <span>
            Showing {startRecord}–{endRecord} of {pagination.total} enquiries
          </span>
        </div>

        <div className="owner-filters">
          <input
            type="search"
            className="owner-search"
            placeholder="Search by name or phone..."
            aria-label="Search enquiries by name or phone"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <select
            className="owner-filter-select"
            aria-label="Filter enquiries by status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
          </select>

          <button type="button" onClick={clearFilters}>
            CLEAR FILTERS
          </button>
        </div>

        {loading ? (
          <p className="owner-loading">Loading enquiries...</p>
        ) : (
          <>
            <div className="owner-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>NAME</th>
                    <th>PHONE</th>
                    <th>FITNESS GOAL</th>
                    <th>STATUS</th>
                    <th>DATE</th>
                  </tr>
                </thead>

                <tbody>
                  {enquiries.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="owner-empty">
                        {pagination.total === 0
                          ? 'No enquiries match your search or selected filter.'
                          : 'No enquiries on this page.'}
                      </td>
                    </tr>
                  ) : (
                    enquiries.map((enquiry) => (
                      <tr key={enquiry.id}>
                        <td>#{enquiry.id}</td>
                        <td>{enquiry.name}</td>
                        <td>
                          <a href={`tel:${enquiry.phone}`}>
                            {enquiry.phone}
                          </a>
                        </td>
                        <td>{enquiry.membership || '—'}</td>
                        <td>
                          <select
                            className={`owner-status-select owner-status-${enquiry.status}`}
                            value={enquiry.status}
                            onChange={(event) =>
                              handleStatusChange(
                                enquiry.id,
                                event.target.value
                              )
                            }
                            aria-label={`Change status for ${enquiry.name}`}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="converted">Converted</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                        <td>
                          {new Date(enquiry.created_at).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="owner-pagination">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={loading || page <= 1}
              >
                <ChevronLeft size={17} /> PREVIOUS
              </button>

              <span>
                Page {page} of {Math.max(1, pagination.totalPages)}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1)
                  )
                }
                disabled={
                  loading ||
                  pagination.totalPages === 0 ||
                  page >= pagination.totalPages
                }
              >
                NEXT <ChevronRight size={17} />
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
