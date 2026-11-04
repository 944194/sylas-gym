

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {

  Search,

  UserRound,

  CreditCard,

  RefreshCw,

  UserPlus,

  Pencil,

  X,

  Clock,

  KeyRound,

} from 'lucide-react';

import './ClientManagement.css';
import './ClientManagement.layout.css';



const API_URL = (

  import.meta.env.VITE_API_URL || 'http://localhost:5000'

).replace(/\/+$/, '');



function getToday() {

  const today = new Date();

  const year = today.getFullYear();

  const month = String(today.getMonth() + 1).padStart(2, '0');

  const day = String(today.getDate()).padStart(2, '0');



  return `${year}-${month}-${day}`;

}



function addMonthsMinusOneDay(dateString, months) {

  const [year, month, day] = dateString.split('-').map(Number);

  const targetMonth = month - 1 + Number(months);

  const targetYear = year + Math.floor(targetMonth / 12);

  const normalizedMonth = ((targetMonth % 12) + 12) % 12;



  // First day of the month after the target month.

  const nextMonth = new Date(

    targetYear,

    normalizedMonth + 1,

    1

  );



  // Last day of the target month.

  const lastDay = new Date(

    nextMonth.getFullYear(),

    nextMonth.getMonth(),

    0

  ).getDate();



  const validDay = Math.min(day, lastDay);

  const start = new Date(targetYear, normalizedMonth, validDay);



  // Subtract one day from the calculated plan end date.

  start.setDate(start.getDate() - 1);



  const y = start.getFullYear();

  const m = String(start.getMonth() + 1).padStart(2, '0');

  const d = String(start.getDate()).padStart(2, '0');



  return `${y}-${m}-${d}`;

}



function formatDate(value) {

  if (!value) return '—';



  const dateString = String(value).slice(0, 10);

  const [year, month, day] = dateString.split('-');



  if (!year || !month || !day) return dateString;



  return `${day}-${month}-${year}`;

}



function formatCurrency(value) {

  return `₹${Number(value || 0).toLocaleString('en-IN')}`;

}



export default function ClientManagement({ csrfToken, enquiry }) {
  const navigate = useNavigate();
  const { clientId } = useParams();

  const [clients, setClients] = useState([]);

  const [plans, setPlans] = useState([]);

  const [search, setSearch] = useState(enquiry?.phone || '');

  const [selectedClient, setSelectedClient] = useState(null);

  const [memberships, setMemberships] = useState([]);



  const [loading, setLoading] = useState(true);

  const [historyLoading, setHistoryLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [creating, setCreating] = useState(false);



  const [showCreateForm, setShowCreateForm] = useState(false);

  const [temporaryPassword, setTemporaryPassword] = useState('');



  const [createForm, setCreateForm] = useState({

  fullName: enquiry?.name || '',

  email: '',

  phone: enquiry?.phone || '',

});



  const [membershipForm, setMembershipForm] = useState({

    membershipPlanId: '',

    startDate: getToday(),

    expiryDate: '',

    amountPaid: '',

    paymentMethod: '',

  });



  const [editingMembershipId, setEditingMembershipId] = useState(null);

  const [error, setError] = useState('');

  const [message, setMessage] = useState('');



  async function loadData() {

    setLoading(true);

    setError('');



    try {

      const [clientResponse, planResponse] = await Promise.all([

        fetch(

          `${API_URL}/api/owner/clients?search=${encodeURIComponent(search)}`,

          { credentials: 'include' }

        ),

        fetch(`${API_URL}/api/owner/membership-plans`, {

          credentials: 'include',

        }),

      ]);



      const clientData = await clientResponse.json();

      const planData = await planResponse.json();



      if (!clientResponse.ok || !clientData.success) {

        throw new Error(clientData.message || 'Unable to load clients.');

      }



      if (!planResponse.ok || !planData.success) {

        throw new Error(

          planData.message || 'Unable to load membership plans.'

        );

      }



      setClients(clientData.clients || []);

      setPlans(planData.plans || []);

      return clientData.clients || [];

    } catch (err) {

      setError(err.message || 'Unable to load client management.');

    } finally {

      setLoading(false);

    }

  }



  useEffect(() => {

    loadData();

  }, [search]);

  useEffect(() => {
    if (!clientId || loading || clients.length === 0) return;
    const client = clients.find((item) => String(item.id) === String(clientId));
    if (!client) {
      setError('Client not found. Please return to the client list.');
      return;
    }
    if (String(selectedClient?.id) !== String(client.id)) {
      setSelectedClient(client);
      loadMembershipHistory(client.id);
    }
  }, [clientId, loading, clients]);



  async function loadMembershipHistory(clientId) {

    setHistoryLoading(true);

    setMemberships([]);

    setError('');



    try {

      const response = await fetch(

        `${API_URL}/api/owner/clients/${clientId}/memberships`,

        { credentials: 'include' }

      );



      const result = await response.json();



      if (!response.ok || !result.success) {

        throw new Error(

          result.message || 'Unable to load membership history.'

        );

      }



      setMemberships(result.memberships || []);

    } catch (err) {

      setError(err.message || 'Unable to load membership history.');

    } finally {

      setHistoryLoading(false);

    }

  }



  function selectClient(client) {

    navigate(`/owner/clients/${client.id}`);
    setSelectedClient(client);

    setMemberships([]);

    setEditingMembershipId(null);

    setTemporaryPassword('');

    setMessage('');

    setError('');



    setMembershipForm({

      membershipPlanId: '',

      startDate: getToday(),

      expiryDate: '',

      amountPaid: '',

      paymentMethod: '',

    });



    loadMembershipHistory(client.id);

  }



  function handlePlanChange(planId) {

    const plan = plans.find(

      (item) => String(item.id) === String(planId)

    );



    setMembershipForm((current) => ({

      ...current,

      membershipPlanId: planId,

      amountPaid: plan ? String(plan.price) : '',

      expiryDate: plan

        ? addMonthsMinusOneDay(

            current.startDate || getToday(),

            plan.duration_months

          )

        : '',

    }));

  }



  function handleStartDateChange(startDate) {

    const plan = plans.find(

      (item) =>

        String(item.id) === String(membershipForm.membershipPlanId)

    );



    setMembershipForm((current) => ({

      ...current,

      startDate,

      expiryDate: plan

        ? addMonthsMinusOneDay(startDate, plan.duration_months)

        : current.expiryDate,

    }));

  }





async function handleCreateClient(event) {

  event.preventDefault();



  const {

    membershipPlanId,

    startDate,

    expiryDate,

    amountPaid,

    paymentMethod,

  } = membershipForm;



  const selectedPlan = plans.find(

    (plan) => String(plan.id) === String(membershipPlanId)

  );



  if (!selectedPlan) {

    setError('Please select a membership plan.');

    return;

  }



  if (!startDate || !expiryDate || expiryDate < startDate) {

    setError('Please select valid membership dates.');

    return;

  }



  const numericAmount = Number(amountPaid);



  if (

    amountPaid === '' ||

    !Number.isFinite(numericAmount) ||

    numericAmount < 0 ||

    numericAmount > Number(selectedPlan.price)

  ) {

    setError('Please enter a valid payment amount.');

    return;

  }



  if (!['cash', 'upi', 'other'].includes(paymentMethod)) {

    setError('Please select a payment method.');

    return;

  }



  setCreating(true);

  setError('');

  setMessage('');

  setTemporaryPassword('');



  try {

    const response = await fetch(`${API_URL}/api/owner/clients`, {

      method: 'POST',

      credentials: 'include',

      headers: {

        'Content-Type': 'application/json',

        'X-CSRF-Token': csrfToken,

      },

      body: JSON.stringify({

        ...createForm,

        membershipPlanId: Number(membershipPlanId),

        startDate,

        expiryDate,

        amountPaid: numericAmount,

        paymentMethod,

      }),

    });



    const result = await response.json();



    if (!response.ok || !result.success) {

      throw new Error(

        result.message || 'Unable to create client and membership.'

      );

    }



    setTemporaryPassword(result.temporaryPassword || '');

    setMessage(

      `Client created and membership assigned successfully. Member ID: ${result.memberId}`

    );



    setCreateForm({

      fullName: '',

      email: '',

      phone: '',

    });



    setShowCreateForm(false);



    const refreshedClients = await loadData();



    if (result.client) {

      const newClient =

        refreshedClients.find(

          (client) => client.id === result.client.id

        ) || result.client;



      setSelectedClient(newClient);

      await loadMembershipHistory(newClient.id);

    }



    setMembershipForm({

      membershipPlanId: '',

      startDate: getToday(),

      expiryDate: '',

      amountPaid: '',

      paymentMethod: '',

    });

  } catch (err) {

    setError(

      err.message || 'Unable to create client and membership.'

    );

  } finally {

    setCreating(false);

  }

}





  function resetMembershipForm() {

    setEditingMembershipId(null);



    setMembershipForm({

      membershipPlanId: '',

      startDate: getToday(),

      expiryDate: '',

      amountPaid: '',

      paymentMethod: '',

    });

  }



  function startEditingMembership(membership) {

    setEditingMembershipId(membership.id);



    setMembershipForm({

      membershipPlanId: String(membership.membership_plan_id),

      startDate: String(membership.start_date).slice(0, 10),

      expiryDate: String(membership.expiry_date).slice(0, 10),

      amountPaid: String(membership.amount_paid),

      paymentMethod: membership.payment_method || '',

    });



    setError('');

    setMessage('');

  }



  async function handleSaveMembership(event) {

    event.preventDefault();



    if (!selectedClient) {

      setError('Please select a client first.');

      return;

    }



    const {

      membershipPlanId,

      startDate,

      expiryDate,

      amountPaid,

      paymentMethod,

    } = membershipForm;



    const selectedPlan = plans.find(

      (plan) => String(plan.id) === String(membershipPlanId)

    );



    if (!selectedPlan) {

      setError('Please select a membership plan.');

      return;

    }



    if (!startDate || !expiryDate || expiryDate < startDate) {

      setError('Please select valid membership dates.');

      return;

    }



    const numericAmount = Number(amountPaid);



    if (

      amountPaid === '' ||

      !Number.isFinite(numericAmount) ||

      numericAmount < 0

    ) {

      setError('Please enter a valid payment amount.');

      return;

    }



    if (numericAmount > Number(selectedPlan.price)) {

      setError('Amount paid cannot exceed the plan price.');

      return;

    }



    if (!['cash', 'upi', 'other'].includes(paymentMethod)) {

      setError('Please select a payment method.');

      return;

    }



    setSaving(true);

    setError('');

    setMessage('');



    try {

      const isEditing = editingMembershipId !== null;



      const url = isEditing

        ? `${API_URL}/api/owner/clients/${selectedClient.id}/membership/${editingMembershipId}`

        : `${API_URL}/api/owner/clients/${selectedClient.id}/membership`;



      const response = await fetch(url, {

        method: isEditing ? 'PATCH' : 'POST',

        credentials: 'include',

        headers: {

          'Content-Type': 'application/json',

          'X-CSRF-Token': csrfToken,

        },

        body: JSON.stringify({

          membershipPlanId: Number(membershipPlanId),

          startDate,

          expiryDate,

          amountPaid: numericAmount,

          paymentMethod,

        }),

      });



      const result = await response.json();



      if (!response.ok || !result.success) {

        throw new Error(

          result.message || 'Unable to save membership.'

        );

      }



      setMessage(

        isEditing

          ? 'Membership updated successfully.'

          : `Membership assigned successfully. Member ID: ${result.memberId}`

      );



      resetMembershipForm();



const refreshedClients = await loadData();



const updatedClient = refreshedClients.find(

  (client) => client.id === selectedClient.id

);



if (updatedClient) {

  setSelectedClient(updatedClient);

}



await loadMembershipHistory(selectedClient.id);

    } catch (err) {

      setError(err.message || 'Unable to save membership.');

    } finally {

      setSaving(false);

    }

  }



  const activeMembership = memberships.find(

    (membership) => membership.status === 'active'

  );





const processedEnquiryRef = useRef('');



useEffect(() => {

  if (!enquiry || loading) return;



  const enquiryKey = String(

    enquiry.id ?? `${enquiry.phone}-${enquiry.name}`

  );



  // Prevent processing the same enquiry more than once.

  if (processedEnquiryRef.current === enquiryKey) return;



  processedEnquiryRef.current = enquiryKey;



  // Compare phone numbers without spaces or symbols.

  const normalizePhone = (phone) =>

    String(phone || '').replace(/\D/g, '');



  const enquiryPhone = normalizePhone(enquiry.phone);



  const matchingClient = clients.find(

    (client) =>

      normalizePhone(client.phone) === enquiryPhone

  );



  // Find the requested membership plan.

  const requestedPlan = String(enquiry.membership || '')

    .trim()

    .toLowerCase();



  const matchingPlan = plans.find(

    (plan) =>

      plan.name.trim().toLowerCase() === requestedPlan

  );



  if (matchingClient) {

    // Client already exists: select automatically.

    selectClient(matchingClient);

  } else {

    // Client doesn't exist: open registration form.

    setSelectedClient(null);

    setShowCreateForm(true);



    setCreateForm({

      fullName: enquiry.name || '',

      email: '',

      phone: enquiry.phone || '',

    });

  }



  // Automatically select the requested plan if available.

  if (matchingPlan) {

    handlePlanChange(String(matchingPlan.id));

  }

}, [enquiry, loading, clients, plans]);





  return (

    <section className="client-management">

      <div className="client-management-heading">

        <div>

          <p className="client-management-kicker">

            AURAFIT MEMBER ADMINISTRATION

          </p>

          <h2>CLIENT MANAGEMENT</h2>

          <p>Register clients, assign memberships and manage payments.</p>

        </div>



        <button

          type="button"

          className="client-refresh-button"

          onClick={loadData}

          disabled={loading}

        >

          <RefreshCw size={16} />

          REFRESH

        </button>

      </div>



      {error && (

        <p className="client-management-error" role="alert">

          {error}

        </p>

      )}



      {message && (

        <p className="client-management-success" role="status">

          {message}

        </p>

      )}



      {temporaryPassword && (

        <div className="temporary-password-box">

          <h3>

            <KeyRound size={18} /> Temporary client password

          </h3>

          <p>

            Share this password securely with the client. It will not be

            displayed again after you leave this page.

          </p>

          <strong>{temporaryPassword}</strong>

          <button

            type="button"

            onClick={() => {

              navigator.clipboard.writeText(temporaryPassword);

              setMessage('Temporary password copied.');

            }}

          >

            COPY PASSWORD

          </button>

        </div>

      )}



      {!clientId && <div className="client-management-actions">

        <button

          type="button"

          className="client-assign-button"

          onClick={() => {

            setShowCreateForm((current) => !current);

            setError('');

            setMessage('');

          }}

        >

          {showCreateForm ? <X size={17} /> : <UserPlus size={17} />}

          {showCreateForm ? 'CLOSE FORM' : 'ADD NEW CLIENT'}

        </button>

      </div>}



      {!clientId && showCreateForm && (

        <form

          className="client-create-form"

          onSubmit={handleCreateClient}

        >

          <h3>Create a new client account</h3>



          <div className="client-form-grid">

            <label>

              Full name

              <input

                type="text"

                value={createForm.fullName}

                minLength={2}

                maxLength={100}

                required

                onChange={(event) =>

                  setCreateForm((current) => ({

                    ...current,

                    fullName: event.target.value,

                  }))

                }

                placeholder="Enter client's full name"

              />

            </label>



            <label>

              Email address

              <input

                type="email"

                value={createForm.email}

                maxLength={255}

                required

                onChange={(event) =>

                  setCreateForm((current) => ({

                    ...current,

                    email: event.target.value,

                  }))

                }

                placeholder="client@example.com"

              />

            </label>



            <label>

              Phone number

              <input

                type="tel"

                value={createForm.phone}

                required

                onChange={(event) =>

                  setCreateForm((current) => ({

                    ...current,

                    phone: event.target.value,

                  }))

                }

                placeholder="Enter phone number"

              />

            </label>

          </div>



          <p className="client-form-note">

            A random temporary password will be generated when the account

            is created.

          </p>





<h4>Membership details</h4>



<div className="client-form-grid">

  <label>

    Membership plan

    <select

      value={membershipForm.membershipPlanId}

      required

      onChange={(event) =>

        handlePlanChange(event.target.value)

      }

    >

      <option value="">Select a membership plan</option>



      {plans.map((plan) => (

        <option key={plan.id} value={plan.id}>

          {plan.name} — {formatCurrency(plan.price)} (

          {plan.duration_months} months)

        </option>

      ))}

    </select>

  </label>



  <label>

    Start date

    <input

      type="date"

      value={membershipForm.startDate}

      required

      onChange={(event) =>

        handleStartDateChange(event.target.value)

      }

    />

  </label>



  <label>

    Expiry date

    <input

      type="date"

      value={membershipForm.expiryDate}

      min={membershipForm.startDate}

      required

      onChange={(event) =>

        setMembershipForm((current) => ({

          ...current,

          expiryDate: event.target.value,

        }))

      }

    />

  </label>



  <label>

    Amount paid (₹)

    <input

      type="number"

      min="0"

      step="0.01"

      value={membershipForm.amountPaid}

      required

      onChange={(event) =>

        setMembershipForm((current) => ({

          ...current,

          amountPaid: event.target.value,

        }))

      }

    />

  </label>



  <label>

    Payment method

    <select

      value={membershipForm.paymentMethod}

      required

      onChange={(event) =>

        setMembershipForm((current) => ({

          ...current,

          paymentMethod: event.target.value,

        }))

      }

    >

      <option value="">Select payment method</option>

      <option value="cash">Cash</option>

      <option value="upi">UPI</option>

      <option value="other">Other</option>

    </select>

  </label>

</div>



<p className="client-form-note">

  A temporary password and permanent Member ID will be generated

  when the client and membership are created successfully.

</p>





          <button

            type="submit"

            className="client-assign-button"

            disabled={creating}

          >

            <UserPlus size={16} />

            {creating

  ? 'CREATING CLIENT...'

  : 'CREATE CLIENT & ASSIGN MEMBERSHIP'}

          </button>

        </form>

      )}



      {!clientId && <div className="client-management-search">

        <Search size={18} />

        <input

          type="search"

          placeholder="Search by name, email, phone or Member ID..."

          value={search}

          onChange={(event) => setSearch(event.target.value)}

        />

      </div>}



      <div className="client-management-layout">

        {!clientId && <div className="client-management-list">

          <h3>Registered clients ({clients.length})</h3>



          {loading ? (

            <p className="client-management-empty">Loading clients...</p>

          ) : clients.length === 0 ? (

            <p className="client-management-empty">

              No registered clients found.

            </p>

          ) : (

            <div className="client-table-wrap">

              <table className="client-members-table">

                <thead>

                  <tr>

                    <th>Member ID</th>

                    <th>Name</th>

                    <th>Phone</th>

                    <th>Membership</th>

                    <th>Expiry date</th>

                    <th>Status</th>

                    <th>Inactive for</th>

                  </tr>

                </thead>

                <tbody>

                  {clients.map((client) => {

                    const status = client.membership_status || 'no_membership';

                    const statusLabel = status === 'no_membership'

                      ? 'No membership'

                      : status === 'inactive'

                        ? 'Inactive'

                        : status === 'suspended'

                          ? 'Suspended'

                          : 'Active';

                    return (

                      <tr

                        key={client.id}

                        className={selectedClient?.id === client.id ? 'selected' : ''}

                        onClick={() => selectClient(client)}

                        tabIndex={0}

                        onKeyDown={(event) => {

                          if (event.key === 'Enter' || event.key === ' ') {

                            event.preventDefault();

                            selectClient(client);

                          }

                        }}

                      >

                        <td>{client.member_id || '—'}</td>

                        <td><strong>{client.full_name}</strong><small>{client.email}</small></td>

                        <td>{client.phone}</td>

                        <td>{client.latest_plan_name || '—'}</td>

                        <td>{formatDate(client.latest_expiry_date)}</td>

                        <td><span className={`client-account-status ${status}`}>{statusLabel}</span></td>

                        <td>{status === 'inactive' ? `${client.inactive_days} day${Number(client.inactive_days) === 1 ? '' : 's'}` : '—'}</td>

                      </tr>

                    );

                  })}

                </tbody>

              </table>

            </div>

          )}

        </div>}



        {clientId && <div className="client-management-workspace">

          {!selectedClient ? (

            <div className="client-management-empty">

              <UserRound size={35} />

              <h3>Select a client</h3>

              <p>

                Select a registered client to view membership details or

                assign a new membership.

              </p>

            </div>

          ) : (

            <>

              <div className="selected-client-heading">

                <div>

                  <p className="client-management-kicker">

                    SELECTED CLIENT

                  </p>

                  <h3>{selectedClient.full_name}</h3>

                  <p>{selectedClient.email}</p>

                  <p>{selectedClient.phone}</p>

                  <p>

                    Member ID:{' '}

                    <strong>

                      {selectedClient.member_id || 'Not assigned yet'}

                    </strong>

                  </p>

                </div>



                <span

                  className={`client-account-status ${selectedClient.status}`}

                >

                  {selectedClient.status}

                </span>

              </div>



              <div className="membership-history-section">

                <h3>

                  <Clock size={18} /> Membership history

                </h3>



                {historyLoading ? (

                  <p>Loading membership history...</p>

                ) : memberships.length === 0 ? (

                  <p className="client-management-empty">

                    No membership has been assigned to this client yet.

                  </p>

                ) : (

                  <div className="membership-history-list">

                    {memberships.map((membership) => (

                      <article

                        className="membership-history-card"

                        key={membership.id}

                      >

                        <div>

                          <strong>{membership.plan_name}</strong>

                          <p>

                            {formatDate(membership.start_date)} to{' '}

                            {formatDate(membership.expiry_date)}

                          </p>

                          <p>

                            Price: {formatCurrency(membership.price)} |

                            Paid: {formatCurrency(membership.amount_paid)}

                          </p>

                          <p>

                            Payment: {membership.payment_method || '—'} |

                            {membership.payment_status}

                          </p>

                        </div>



                        <div className="membership-history-actions">

                          <span

                            className={`client-account-status ${membership.status}`}

                          >

                            {membership.status}

                          </span>



                          <button

                            type="button"

                            className="client-refresh-button"

                            onClick={() =>

                              startEditingMembership(membership)

                            }

                            disabled={selectedClient.status !== 'active'}

                          >

                            <Pencil size={15} /> EDIT

                          </button>

                        </div>

                      </article>

                    ))}

                  </div>

                )}

              </div>



              <form

                className="membership-assignment-form"

                onSubmit={handleSaveMembership}

              >

                <div className="membership-form-heading">

                  <h3>

                    {editingMembershipId

                      ? 'Edit membership'

                      : 'Assign new membership'}

                  </h3>



                  {editingMembershipId && (

                    <button

                      type="button"

                      className="client-refresh-button"

                      onClick={resetMembershipForm}

                    >

                      <X size={15} /> CANCEL EDIT

                    </button>

                  )}

                </div>



                {selectedClient.status !== 'active' && (

                  <p className="client-management-error">

                    This client account is suspended. Membership changes

                    are disabled.

                  </p>

                )}



                <label>

                  Membership plan

                  <select

                    value={membershipForm.membershipPlanId}

                    required

                    onChange={(event) =>

                      handlePlanChange(event.target.value)

                    }

                    disabled={selectedClient.status !== 'active'}

                  >

                    <option value="">Select a membership plan</option>

                    {plans.map((plan) => (

                      <option key={plan.id} value={plan.id}>

                        {plan.name} — {formatCurrency(plan.price)} (

                        {plan.duration_months} months)

                      </option>

                    ))}

                  </select>

                </label>



                <div className="client-form-grid">

                  <label>

                    Start date

                    <input

                      type="date"

                      value={membershipForm.startDate}

                      required

                      onChange={(event) =>

                        handleStartDateChange(event.target.value)

                      }

                      disabled={selectedClient.status !== 'active'}

                    />

                  </label>



                  <label>

                    Expiry date

                    <input

                      type="date"

                      value={membershipForm.expiryDate}

                      min={membershipForm.startDate}

                      required

                      onChange={(event) =>

                        setMembershipForm((current) => ({

                          ...current,

                          expiryDate: event.target.value,

                        }))

                      }

                      disabled={selectedClient.status !== 'active'}

                    />

                  </label>



                  <label>

                    Amount paid (₹)

                    <input

                      type="number"

                      min="0"

                      step="0.01"

                      value={membershipForm.amountPaid}

                      required

                      onChange={(event) =>

                        setMembershipForm((current) => ({

                          ...current,

                          amountPaid: event.target.value,

                        }))

                      }

                      disabled={selectedClient.status !== 'active'}

                    />

                  </label>



                  <label>

                    Payment method

                    <select

                      value={membershipForm.paymentMethod}

                      required

                      onChange={(event) =>

                        setMembershipForm((current) => ({

                          ...current,

                          paymentMethod: event.target.value,

                        }))

                      }

                      disabled={selectedClient.status !== 'active'}

                    >

                      <option value="">Select payment method</option>

                      <option value="cash">Cash</option>

                      <option value="upi">UPI</option>

                      <option value="other">Other</option>

                    </select>

                  </label>

                </div>



                <button

                  type="submit"

                  className="client-assign-button"

                  disabled={

                    saving ||

                    selectedClient.status !== 'active' ||

                    plans.length === 0

                  }

                >

                  <CreditCard size={17} />

                  {saving

                    ? 'SAVING...'

                    : editingMembershipId

                      ? 'UPDATE MEMBERSHIP'

                      : 'ASSIGN MEMBERSHIP'}

                </button>

              </form>



              {activeMembership && (

                <p className="client-form-note">

                  This client currently has an active membership. A new

                  membership must use dates that do not overlap with it.

                </p>

              )}

            </>

          )}

          <button type="button" className="client-back-button" onClick={() => navigate('/owner/clients')}>← BACK TO CLIENTS</button>
        </div>}
      </div>

    </section>

  );

}
