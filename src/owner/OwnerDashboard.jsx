
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


const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '')


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
  const [trainers, setTrainers] = useState([]);
const [trainerLoading, setTrainerLoading] = useState(false);
const [trainerError, setTrainerError] = useState("");
const [trainerMessage, setTrainerMessage] = useState("");
const [trainerSaving, setTrainerSaving] = useState(false);
const [editingTrainerId, setEditingTrainerId] = useState(null);
// Membership plan management
const [membershipPlans, setMembershipPlans] = useState([]);
const [membershipLoading, setMembershipLoading] = useState(false);
const [membershipError, setMembershipError] = useState("");
const [membershipMessage, setMembershipMessage] = useState("");
const [membershipSaving, setMembershipSaving] = useState(false);
const [editingPlanId, setEditingPlanId] = useState(null);

const [membershipForm, setMembershipForm] = useState({
  name: "",
  price: "",
  duration_months: 1,
  description: "",
  benefits: "",
  display_order: 0,
  is_active: true,
});

const [trainerForm, setTrainerForm] = useState({
  name: "",
  specialization: "",
  experience_years: 0,
  qualifications: "",
  bio: "",
  image_url: "",
  image_public_id: "",
  is_published: false,
  display_order: 0,
});

const [trainerPhoto, setTrainerPhoto] = useState(null);

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

  async function loadTrainers() {
  setTrainerLoading(true);
  setTrainerError("");

  try {
    const response = await fetch(`${API_URL}/api/owner/trainers`, {
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      navigate("/owner", { replace: true });
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load trainers.");
    }

    setTrainers(data.trainers || []);
  } catch (err) {
    setTrainerError(err.message || "Unable to load trainers.");
  } finally {
    setTrainerLoading(false);
  }
}


async function loadMembershipPlans() {
  setMembershipLoading(true);
  setMembershipError("");

  try {
    const response = await fetch(
      `${API_URL}/api/owner/membership-plans`,
      {
        credentials: "include",
      }
    );

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      navigate("/owner", { replace: true });
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load membership plans."
      );
    }

    setMembershipPlans(data.plans || []);
  } catch (err) {
    setMembershipError(
      err.message || "Unable to load membership plans."
    );
  } finally {
    setMembershipLoading(false);
  }
}



async function handleMembershipSave(event) {
  event.preventDefault();

  setMembershipError("");
  setMembershipMessage("");
  setMembershipSaving(true);

  try {
    const payload = {
      name: membershipForm.name.trim(),
      price: Number(membershipForm.price),
      duration_months: Number(membershipForm.duration_months),
      description: membershipForm.description.trim(),
      benefits: membershipForm.benefits
        .split("\n")
        .map((benefit) => benefit.trim())
        .filter(Boolean),
      display_order: Number(membershipForm.display_order),
      is_active: membershipForm.is_active,
    };

    const isEditing = editingPlanId !== null;

    const url = isEditing
      ? `${API_URL}/api/owner/membership-plans/${editingPlanId}`
      : `${API_URL}/api/owner/membership-plans`;

    const response = await fetch(url, {
      method: isEditing ? "PATCH" : "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to save membership plan.");
    }

    setMembershipMessage(
      isEditing
        ? "Membership plan updated successfully."
        : "Membership plan added successfully."
    );

    setMembershipForm({
      name: "",
      price: "",
      duration_months: 1,
      description: "",
      benefits: "",
      display_order: 0,
      is_active: true,
    });

    setEditingPlanId(null);

    await loadMembershipPlans();
  } catch (err) {
    setMembershipError(
      err.message || "Unable to save membership plan."
    );
  } finally {
    setMembershipSaving(false);
  }
}



async function uploadTrainerPhoto(file) {
  if (!file) {
    throw new Error("Please select a trainer photo.");
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Trainer photos must be 5 MB or smaller.");
  }

  const signatureResponse = await fetch(
    `${API_URL}/api/owner/trainers/upload-signature`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRF-Token": csrfToken,
      },
    }
  );

  const signatureData = await signatureResponse.json().catch(() => ({}));

  if (!signatureResponse.ok || !signatureData.success) {
    throw new Error(
      signatureData.message || "Unable to prepare the photo upload."
    );
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("api_key", signatureData.apiKey);
  formData.append("timestamp", String(signatureData.timestamp));
  formData.append("folder", signatureData.folder);
  formData.append("signature", signatureData.signature);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const uploadData = await uploadResponse.json().catch(() => ({}));

  if (!uploadResponse.ok || !uploadData.secure_url || !uploadData.public_id) {
    throw new Error("Photo upload failed. Please try another image.");
  }

  return {
    image_url: uploadData.secure_url,
    image_public_id: uploadData.public_id,
  };
}

async function handleTrainerSave(event) {
  event.preventDefault();

  setTrainerError("");
  setTrainerMessage("");
  setTrainerSaving(true);

  try {
    const name = trainerForm.name.trim();
    const specialization = trainerForm.specialization.trim();

    if (!name || !specialization) {
      throw new Error("Enter the trainer's name and specialization.");
    }

    let photo = {
      image_url: trainerForm.image_url,
      image_public_id: trainerForm.image_public_id,
    };

    if (trainerPhoto) {
      photo = await uploadTrainerPhoto(trainerPhoto);
    }

    if (!photo.image_url || !photo.image_public_id) {
      throw new Error("Please select a trainer photo.");
    }

    const payload = {
      ...trainerForm,
      name,
      specialization,
      experience_years: Number(trainerForm.experience_years),
      display_order: Number(trainerForm.display_order),
      qualifications: trainerForm.qualifications.trim(),
      bio: trainerForm.bio.trim(),
      ...photo,
    };

    const isEditing = editingTrainerId !== null;
    const url = isEditing
      ? `${API_URL}/api/owner/trainers/${editingTrainerId}`
      : `${API_URL}/api/owner/trainers`;

    const response = await fetch(url, {
      method: isEditing ? "PATCH" : "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to save the trainer.");
    }

    setTrainerMessage(
      isEditing ? "Trainer updated successfully." : "Trainer added successfully."
    );

    setTrainerForm({
      name: "",
      specialization: "",
      experience_years: 0,
      qualifications: "",
      bio: "",
      image_url: "",
      image_public_id: "",
      is_published: false,
      display_order: 0,
    });

    setTrainerPhoto(null);
    setEditingTrainerId(null);

    await loadTrainers();
  } catch (err) {
    setTrainerError(err.message || "Unable to save the trainer.");
  } finally {
    setTrainerSaving(false);
  }
}

  useEffect(() => {
    loadDashboard()
  }, [debouncedSearch, statusFilter, page])

  useEffect(() => {
  loadTrainers()
}, [])

useEffect(() => {
  loadMembershipPlans();
}, []);

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
          <p className="owner-kicker">AURAFIT GYM / MANAGEMENT</p>
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
                    <th>MEMBERSHIP PLAN</th>
                    <th>FITNESS GOAL</th>
                    <th>STATUS</th>
                    <th>DATE</th>
                  </tr>
                </thead>

                <tbody>
                  {enquiries.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="owner-empty">
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
  {enquiry.message?.match(/Fitness goal:\s*([^.]*)/)?.[1] || '—'}
</td>
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


<section className="owner-memberships">
  <div className="owner-section-heading">
    <h2>MEMBERSHIP PLAN MANAGEMENT</h2>
    <span>{membershipPlans.length} plans</span>
  </div>

  <form
    className="membership-admin-form"
    onSubmit={handleMembershipSave}
  >
    <h3>{editingPlanId ? "EDIT MEMBERSHIP PLAN" : "ADD NEW MEMBERSHIP PLAN"}</h3>

    <label>
      Plan name *
      <input
        value={membershipForm.name}
        onChange={(e) =>
          setMembershipForm({ ...membershipForm, name: e.target.value })
        }
        maxLength={100}
        required
      />
    </label>

    <label>
      Price (₹) *
      <input
        type="number"
        min="0"
        step="0.01"
        value={membershipForm.price}
        onChange={(e) =>
          setMembershipForm({ ...membershipForm, price: e.target.value })
        }
        required
      />
    </label>

    <label>
      Duration (months) *
      <input
        type="number"
        min="1"
        max="60"
        value={membershipForm.duration_months}
        onChange={(e) =>
          setMembershipForm({
            ...membershipForm,
            duration_months: e.target.value,
          })
        }
        required
      />
    </label>

    <label>
      Description
      <textarea
        value={membershipForm.description}
        onChange={(e) =>
          setMembershipForm({
            ...membershipForm,
            description: e.target.value,
          })
        }
      />
    </label>

    <label>
      Benefits (enter one benefit per line)
      <textarea
        rows={5}
        placeholder={"Gym access\nPersonal trainer guidance\nLocker access"}
        value={membershipForm.benefits}
        onChange={(e) =>
          setMembershipForm({
            ...membershipForm,
            benefits: e.target.value,
          })
        }
      />
    </label>

    <label>
      Display order
      <input
        type="number"
        min="0"
        value={membershipForm.display_order}
        onChange={(e) =>
          setMembershipForm({
            ...membershipForm,
            display_order: e.target.value,
          })
        }
      />
    </label>

    <label>
      <input
        type="checkbox"
        checked={membershipForm.is_active}
        onChange={(e) =>
          setMembershipForm({
            ...membershipForm,
            is_active: e.target.checked,
          })
        }
      />
      Active — show this plan on the public website
    </label>

    {membershipError && (
      <p className="owner-error" role="alert">{membershipError}</p>
    )}

    {membershipMessage && (
      <p role="status">{membershipMessage}</p>
    )}

    <div className="membership-form-actions">
  <button type="submit" disabled={membershipSaving}>
    {membershipSaving
      ? "SAVING..."
      : editingPlanId
        ? "SAVE CHANGES"
        : "ADD MEMBERSHIP PLAN"}
  </button>

  {editingPlanId !== null && (
    <button
      type="button"
      onClick={() => {
        setEditingPlanId(null);
        setMembershipError("");
        setMembershipMessage("");
        setMembershipForm({
          name: "",
          price: "",
          duration_months: 1,
          description: "",
          benefits: "",
          display_order: 0,
          is_active: true,
        });
      }}
    >
      CANCEL EDITING
    </button>
  )}
</div>
  </form>

{membershipLoading ? (
  <p className="owner-loading">Loading membership plans...</p>
) : (
  <div className="membership-admin-list">
    {membershipPlans.length === 0 ? (
      <p>No membership plans available.</p>
    ) : (
      membershipPlans.map((plan) => (
        <article className="membership-admin-card" key={plan.id}>
          <div>
            <h3>{plan.name}</h3>
            <h4>
              ₹{Number(plan.price).toLocaleString("en-IN")}
            </h4>
            <p>{plan.duration_months} month plan</p>
            <p>{plan.description}</p>
            <p>
              Status: {plan.is_active ? "Active" : "Inactive"}
            </p>
            <ul>
              {plan.benefits.map((benefit, index) => (
                <li key={`${plan.id}-${index}`}>{benefit}</li>
              ))}
            </ul>
          </div>

          <div className="membership-admin-actions">
            <button
              type="button"
              onClick={() => {
                setEditingPlanId(plan.id);
                setMembershipForm({
                  name: plan.name,
                  price: String(plan.price),
                  duration_months: plan.duration_months,
                  description: plan.description || "",
                  benefits: plan.benefits.join("\n"),
                  display_order: plan.display_order,
                  is_active: plan.is_active,
                });
                setMembershipError("");
                setMembershipMessage("");
              }}
            >
              EDIT
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Delete ${plan.name} membership plan?`)) {
                  return;
                }

                setMembershipError("");
                setMembershipMessage("");

                try {
                  const response = await fetch(
                    `${API_URL}/api/owner/membership-plans/${plan.id}`,
                    {
                      method: "DELETE",
                      credentials: "include",
                      headers: {
                        "X-CSRF-Token": csrfToken,
                      },
                    }
                  );

                  const data = await response.json().catch(() => ({}));

                  if (!response.ok || !data.success) {
                    throw new Error(data.message || "Unable to delete plan.");
                  }

                  setMembershipMessage("Membership plan deleted successfully.");
                  await loadMembershipPlans();
                } catch (err) {
                  setMembershipError(err.message);
                }
              }}
            >
              DELETE
            </button>
          </div>
        </article>
      ))
    )}
  </div>
)}

</section>



<section className="owner-trainers">
  <div className="owner-section-heading">
    <h2>TRAINER MANAGEMENT</h2>
    <span>{trainers.length} trainers</span>
  </div>

  <form className="trainer-form" onSubmit={handleTrainerSave}>
    <h3>{editingTrainerId ? "EDIT TRAINER" : "ADD NEW TRAINER"}</h3>

    <label>
      Trainer name *
      <input
        value={trainerForm.name}
        onChange={(e) =>
          setTrainerForm({ ...trainerForm, name: e.target.value })
        }
        maxLength={100}
        required
      />
    </label>

    <label>
      Specialization *
      <input
        value={trainerForm.specialization}
        onChange={(e) =>
          setTrainerForm({ ...trainerForm, specialization: e.target.value })
        }
        maxLength={150}
        required
      />
    </label>

    <label>
      Experience (years) *
      <input
        type="number"
        min="0"
        max="80"
        value={trainerForm.experience_years}
        onChange={(e) =>
          setTrainerForm({
            ...trainerForm,
            experience_years: Number(e.target.value),
          })
        }
        required
      />
    </label>

    <label>
      Qualifications
      <input
        value={trainerForm.qualifications}
        onChange={(e) =>
          setTrainerForm({ ...trainerForm, qualifications: e.target.value })
        }
        maxLength={250}
      />
    </label>

    <label>
      Short biography
      <textarea
        value={trainerForm.bio}
        onChange={(e) =>
          setTrainerForm({ ...trainerForm, bio: e.target.value })
        }
        maxLength={2000}
        rows={4}
      />
    </label>

    <label>
      Trainer photo * (JPG, PNG or WebP; max 5 MB)
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => setTrainerPhoto(e.target.files?.[0] || null)}
        required={!editingTrainerId}
      />
    </label>

    <label>
      Display order
      <input
        type="number"
        min="0"
        max="10000"
        value={trainerForm.display_order}
        onChange={(e) =>
          setTrainerForm({
            ...trainerForm,
            display_order: Number(e.target.value),
          })
        }
      />
    </label>

    <label className="trainer-publish-option">
      <input
        type="checkbox"
        checked={trainerForm.is_published}
        onChange={(e) =>
          setTrainerForm({
            ...trainerForm,
            is_published: e.target.checked,
          })
        }
      />
      Publish trainer on public website
    </label>

    {trainerError && <p className="owner-error" role="alert">{trainerError}</p>}
    {trainerMessage && <p role="status">{trainerMessage}</p>}

    <button type="submit" disabled={trainerSaving}>
      {trainerSaving
        ? "SAVING..."
        : editingTrainerId
          ? "SAVE CHANGES"
          : "ADD TRAINER"}
    </button>
  </form>

  {trainerLoading ? (
    <p className="owner-loading">Loading trainers...</p>
  ) : (
    <div className="trainer-management-list">
      {trainers.length === 0 ? (
        <p>No trainer profiles yet. Add your first trainer above.</p>
      ) : (
        trainers.map((trainer) => (
          <article className="trainer-management-card" key={trainer.id}>
            <img src={trainer.image_url} alt={trainer.name} />

            <div>
              <h3>{trainer.name}</h3>
              <p>{trainer.specialization}</p>
              <p>{trainer.experience_years} years of experience</p>
              <p>
                Status: {trainer.is_published ? "Published" : "Unpublished"}
              </p>

              <button
                type="button"
                onClick={() => {
                  setEditingTrainerId(trainer.id);
                  setTrainerForm({
                    name: trainer.name,
                    specialization: trainer.specialization,
                    experience_years: trainer.experience_years,
                    qualifications: trainer.qualifications || "",
                    bio: trainer.bio || "",
                    image_url: trainer.image_url,
                    image_public_id: trainer.image_public_id,
                    is_published: trainer.is_published,
                    display_order: trainer.display_order,
                  });
                  setTrainerPhoto(null);
                  setTrainerError("");
                  setTrainerMessage("");
                }}
              >
                EDIT
              </button>
              <button
  type="button"
  onClick={async () => {
    const confirmed = window.confirm(
      `Delete trainer "${trainer.name}" and their photo? This cannot be undone.`
    );

    if (!confirmed) return;

    setTrainerError("");
    setTrainerMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/owner/trainers/${trainer.id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete trainer.");
      }

      setTrainerMessage("Trainer deleted successfully.");
      await loadTrainers();
    } catch (err) {
      setTrainerError(err.message || "Unable to delete trainer.");
    }
  }}
>
  DELETE
</button>
            </div>
          </article>
        ))
      )}
    </div>
  )}

  {editingTrainerId !== null && (
    <button
      type="button"
      onClick={() => {
        setEditingTrainerId(null);
        setTrainerPhoto(null);
        setTrainerError("");
        setTrainerMessage("");
        setTrainerForm({
          name: "",
          specialization: "",
          experience_years: 0,
          qualifications: "",
          bio: "",
          image_url: "",
          image_public_id: "",
          is_published: false,
          display_order: 0,
        });
      }}
    >
      CANCEL EDITING
    </button>
  )}
</section>

    </main>
  )
}
