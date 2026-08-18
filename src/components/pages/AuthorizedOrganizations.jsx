import React, { useEffect, useMemo, useState } from 'react'
import { downloadCsv } from '../../utils/csv.js'
import ColumnsMenu from '../ColumnsMenu.jsx'

const DIVISION_FILTERS = ['UK Retail', 'UK Digital']

const TABS = ['Trustees', 'Trustors', 'Audit']

const TRUSTEES = [
  { org: 'MCM Retail Ireland', orgId: 'a19c...44f', relationship: 'Trustee', scope: 'Contact Centre Admin', divisions: 'UK Retail, IE Retail', expires: '31 Dec 2026', status: 'active' },
  { org: 'Northstar BPO', orgId: '77bd...9a1', relationship: 'Trustee', scope: 'Supervisor, Agent', divisions: 'Partner — Manila', expires: '30 Sep 2026', status: 'active' },
  { org: 'MCM Group PLC', orgId: '8f14...3aa', relationship: 'Trustor', scope: '—', divisions: 'All', expires: '—', status: 'owner' },
  { org: 'Cloudline Partners', orgId: '32ee...0c8', relationship: 'Trustee', scope: 'Read-only Admin', divisions: 'UK Digital', expires: '11 Aug 2026', status: 'expiring' },
  { org: 'Vertex Consulting', orgId: 'be40...712', relationship: 'Trustee', scope: 'Implementation', divisions: 'All', expires: '—', status: 'revoked' }
]

const STATUS_LABEL = {
  active: 'Active',
  owner: 'Owner',
  expiring: 'Expiring soon',
  revoked: 'Revoked'
}

const COLUMNS = [
  { key: 'org', label: 'Organization' },
  { key: 'orgId', label: 'Org ID' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'scope', label: 'Scope (roles)' },
  { key: 'divisions', label: 'Divisions' },
  { key: 'expires', label: 'Expires' },
  { key: 'status', label: 'Status' }
]

const TRUSTORS = [
  { org: 'mcm-sandbox', roles: 'Full admin', expiry: '—', status: 'active' }
]

const TRUST_AUDIT = [
  {
    when: '15 Aug 15:32',
    org: 'mcmgroup',
    who: 'Faisal Khan',
    type: 'alert',
    label: 'ALERT: Queue backlog — Retail Billing',
    detail: 'Interactions waiting is 10 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'
  },
  {
    when: '15 Aug 15:27',
    org: 'mcmgroup',
    who: 'Faisal Khan',
    type: 'alert',
    label: 'ALERT: Agent away too long',
    detail: 'Time in Away status (min) is 28 (> 15) — notified Marco Rossi'
  },
  {
    when: '15 Aug 2026 15:27',
    org: 'mcmgroup',
    who: 'Faisal Khan',
    type: 'auth',
    label: 'Sign in',
    detail: 'Faisal Khan (admin)'
  },
  {
    when: '04 Jan 2026 09:12',
    org: 'mcmgroup',
    who: 'System',
    type: 'system',
    label: 'Org provisioned',
    detail: 'mcmgroup'
  },
  {
    when: '04 Jan 2026 09:30',
    org: 'mcmgroup',
    who: 'F. Khan',
    type: 'import',
    label: 'Bulk import',
    detail: '12 users created'
  }
]

function IconColumns() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function TrusteesToolbar({ search, onSearch, division, onDivision, status, onStatus, hiddenColumns, onToggleColumn }) {
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    onSearch('')
    onDivision('All')
    onStatus('Any')
    setTimeout(() => setIsRefreshing(false), 500)
  }

  return (
    <div className="purchases-toolbar">
      <div className="toolbar-filters">
        <input
          type="text"
          className="toolbar-search"
          placeholder="Search authorized organizations"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search authorized organizations"
        />
        <select
          className="toolbar-filter-select"
          value={division}
          onChange={(e) => onDivision(e.target.value)}
          aria-label="Division"
        >
          <option value="All">Division: All</option>
          {DIVISION_FILTERS.map((d) => <option key={d} value={d}>Division: {d}</option>)}
        </select>
        <select
          className="toolbar-filter-select"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          aria-label="Status"
        >
          <option value="Any">Status: Any</option>
          <option value="active">Status: Active</option>
          <option value="owner">Status: Owner</option>
          <option value="expiring">Status: Expiring soon</option>
          <option value="revoked">Status: Revoked</option>
        </select>
      </div>
      <div className="toolbar-actions">
        <div className="columns-menu-wrap">
          <button
            type="button"
            className="btn-toolbar columns-menu-trigger"
            aria-expanded={columnsOpen}
            onClick={() => setColumnsOpen((v) => !v)}
          >
            <IconColumns />
            Columns
          </button>
          {columnsOpen && (
            <ColumnsMenu
              columns={COLUMNS}
              hidden={hiddenColumns}
              onToggle={onToggleColumn}
              onClose={() => setColumnsOpen(false)}
            />
          )}
        </div>
        <button type="button" className={`btn-toolbar${isRefreshing ? ' icon-spin' : ''}`} onClick={handleRefresh}>
          <IconRefresh />
          Refresh
        </button>
      </div>
    </div>
  )
}

function TrusteesTable({ rows, onOpenTrust, hiddenColumns }) {
  const [checked, setChecked] = useState(() => new Set())
  const allChecked = rows.length > 0 && checked.size === rows.length
  const visibleColumns = COLUMNS.filter((col) => !hiddenColumns.has(col.key))

  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.orgId)))
  const toggleOne = (orgId) =>
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(orgId) ? next.delete(orgId) : next.add(orgId)
      return next
    })

  const renderCell = (col, row) => {
    if (col.key === 'org') {
      return (
        <button type="button" className="order-link" onClick={() => onOpenTrust(row)}>
          {row.org}
        </button>
      )
    }
    if (col.key === 'status') {
      return (
        <span className={`status-cell status-${row.status}`}>
          <span className="status-dot-lg" aria-hidden="true" />
          {STATUS_LABEL[row.status]}
        </span>
      )
    }
    return row[col.key]
  }

  return (
    <div className="card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="col-check">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Select all organizations"
                />
              </th>
              {visibleColumns.map((col) => (
                <th scope="col" key={col.key}>
                  {col.label}
                  <span className="sort-icon" aria-hidden="true">⇅</span>
                </th>
              ))}
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.orgId}>
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={checked.has(row.orgId)}
                    onChange={() => toggleOne(row.orgId)}
                    aria-label={`Select ${row.org}`}
                  />
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.key}>{renderCell(col, row)}</td>
                ))}
                <td className="col-actions">
                  <button type="button" className="kebab" aria-label={`Actions for ${row.org}`} onClick={() => onOpenTrust(row)}>
                    ⋮
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="table-empty">No organizations match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>
          Showing <strong>{rows.length === 0 ? 0 : 1}–{rows.length}</strong> of {rows.length}
        </span>
        <div className="rows-per-page">
          <span className="rows-per-page-select">
            Rows per page 25
            <span className="rows-per-page-caret" aria-hidden="true">▾</span>
          </span>
          <div className="pagination-arrows">
            <button type="button" disabled aria-label="Previous page">‹</button>
            <button type="button" disabled aria-label="Next page">›</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrustorsTable({ rows }) {
  return (
    <>
      <p className="page-note">
        Organisations that let MCM administer them (we are the trustee).
      </p>
      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Organisation</th>
                <th scope="col">Granted roles</th>
                <th scope="col">Expiry</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.org}>
                  <td><span className="order-link">{row.org}</span></td>
                  <td><span className="requested-link">{row.roles}</span></td>
                  <td>{row.expiry}</td>
                  <td>
                    <span className={`status-cell status-${row.status}`}>
                      <span className="status-dot-lg" aria-hidden="true" />
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty">No trustor organizations yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function TrustAuditActionCell({ row }) {
  const isAlert = row.type === 'alert'
  return (
    <span>
      {isAlert && <span aria-hidden="true">🔔 </span>}
      <span className={`audit-label-inline${isAlert ? ' audit-action-alert' : ''}`}>{row.label}</span>
      {' — '}
      <span className="audit-detail-inline">{row.detail}</span>
    </span>
  )
}

function TrustAuditTable({ rows }) {
  return (
    <div className="card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Org</th>
              <th scope="col">Who</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.when}-${idx}`}>
                <td className="audit-when">{row.when}</td>
                <td><span className="requested-link">{row.org}</span></td>
                <td><span className="requested-link">{row.who}</span></td>
                <td className="audit-action-cell"><TrustAuditActionCell row={row} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const TRUST_STATUSES = ['active', 'owner', 'expiring', 'revoked']

function TrustDetailsDrawer({ trust, onCancel, onSave }) {
  const [form, setForm] = useState({
    orgId: trust.orgId,
    relationship: trust.relationship,
    scope: trust.scope,
    divisions: trust.divisions,
    expires: trust.expires,
    status: trust.status
  })

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trust-details-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="trust-details-title">{trust.org}</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <h3 className="drawer-section-heading">Trust</h3>

          <div className="modal-field">
            <label className="modal-label" htmlFor="td-org-id">Organization ID</label>
            <input
              id="td-org-id"
              type="text"
              className="modal-input"
              value={form.orgId}
              onChange={(e) => setField('orgId', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="td-relationship">Relationship</label>
            <select
              id="td-relationship"
              className="modal-select"
              value={form.relationship}
              onChange={(e) => setField('relationship', e.target.value)}
            >
              <option value="Trustee">Trustee</option>
              <option value="Trustor">Trustor</option>
            </select>
          </div>

          <h3 className="drawer-section-heading">Scope</h3>

          <div className="modal-field">
            <label className="modal-label" htmlFor="td-roles">Roles granted</label>
            <input
              id="td-roles"
              type="text"
              className="modal-input"
              value={form.scope}
              onChange={(e) => setField('scope', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="td-divisions">Divisions</label>
            <input
              id="td-divisions"
              type="text"
              className="modal-input"
              value={form.divisions}
              onChange={(e) => setField('divisions', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="td-expiry">Expiry date</label>
            <input
              id="td-expiry"
              type="text"
              className="modal-input"
              value={form.expires}
              onChange={(e) => setField('expires', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="td-status">Status</label>
            <select
              id="td-status"
              className="modal-select"
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
            >
              {TRUST_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(trust.orgId, form)}>Save</button>
        </div>
      </div>
    </div>
  )
}

const RELATIONSHIPS = ['Trustee (they administer us)', 'Trustor (we administer them)']
const ROLES = ['Contact Centre Admin', 'Supervisor', 'Agent', 'Read-only Admin', 'Implementation']
const DIVISIONS = ['All', 'UK Retail', 'IE Retail', 'UK Digital', 'Partner — Manila']

function AddTrustDrawer({ onCancel, onSave }) {
  const [form, setForm] = useState({
    orgId: '',
    relationship: RELATIONSHIPS[0],
    rolesGranted: ROLES[0],
    divisions: DIVISIONS[0],
    expiryDate: '31 Dec 2026',
    allowCloning: false,
    notifyOnSignIn: true
  })

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-trust-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="add-trust-title">Add Trust</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <h3 className="drawer-section-heading">Trust</h3>

          <div className="modal-field">
            <label className="modal-label" htmlFor="at-org-id">Organization ID</label>
            <input
              id="at-org-id"
              type="text"
              className="modal-input"
              value={form.orgId}
              onChange={(e) => setField('orgId', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="at-relationship">Relationship</label>
            <select
              id="at-relationship"
              className="modal-select"
              value={form.relationship}
              onChange={(e) => setField('relationship', e.target.value)}
            >
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <h3 className="drawer-section-heading">Scope</h3>

          <div className="modal-field">
            <label className="modal-label" htmlFor="at-roles">Roles granted</label>
            <select
              id="at-roles"
              className="modal-select"
              value={form.rolesGranted}
              onChange={(e) => setField('rolesGranted', e.target.value)}
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="at-divisions">Divisions</label>
            <select
              id="at-divisions"
              className="modal-select"
              value={form.divisions}
              onChange={(e) => setField('divisions', e.target.value)}
            >
              {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="at-expiry">Expiry date</label>
            <input
              id="at-expiry"
              type="text"
              className="modal-input"
              value={form.expiryDate}
              onChange={(e) => setField('expiryDate', e.target.value)}
            />
          </div>

          <label className="toggle-row">
            <span className="toggle-switch">
              <input
                type="checkbox"
                checked={form.allowCloning}
                onChange={(e) => setField('allowCloning', e.target.checked)}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </span>
            <span>Allow cloning of configuration</span>
          </label>

          <label className="toggle-row">
            <span className="toggle-switch">
              <input
                type="checkbox"
                checked={form.notifyOnSignIn}
                onChange={(e) => setField('notifyOnSignIn', e.target.checked)}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </span>
            <span>Notify on every trustee sign-in</span>
          </label>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  )
}

function AuthorizedOrganizations() {
  const [activeTab, setActiveTab] = useState('Trustees')
  const [isAdding, setIsAdding] = useState(false)
  const [trustees, setTrustees] = useState(TRUSTEES)
  const [search, setSearch] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Any')
  const [viewingTrust, setViewingTrust] = useState(null)
  const [hiddenColumns, setHiddenColumns] = useState(() => new Set())

  const toggleColumn = (key) =>
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return trustees.filter((row) => {
      const matchesSearch = !q || row.org.toLowerCase().includes(q) || row.orgId.toLowerCase().includes(q)
      const matchesDivision =
        divisionFilter === 'All' || row.divisions === 'All' || row.divisions.includes(divisionFilter)
      const matchesStatus = statusFilter === 'Any' || row.status === statusFilter
      return matchesSearch && matchesDivision && matchesStatus
    })
  }, [trustees, search, divisionFilter, statusFilter])

  const handleSave = (form) => {
    const relationship = form.relationship.startsWith('Trustee') ? 'Trustee' : 'Trustor'
    setTrustees((prev) => [
      {
        org: form.orgId || 'New Organization',
        orgId: (form.orgId || '—').slice(0, 8),
        relationship,
        scope: form.rolesGranted,
        divisions: form.divisions,
        expires: form.expiryDate,
        status: 'active'
      },
      ...prev
    ])
    setIsAdding(false)
  }

  const handleUpdateTrust = (orgId, updated) => {
    setTrustees((prev) => prev.map((t) => (t.orgId === orgId ? { ...t, ...updated } : t)))
    setViewingTrust(null)
  }

  const handleExport = () => {
    downloadCsv(
      'authorized-organizations.csv',
      ['Organization', 'Org ID', 'Relationship', 'Scope (roles)', 'Divisions', 'Expires', 'Status'],
      filteredRows.map((row) => [
        row.org,
        row.orgId,
        row.relationship,
        row.scope,
        row.divisions,
        row.expires,
        STATUS_LABEL[row.status]
      ])
    )
  }

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Admin</span>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span>Account Settings</span>
      </nav>

      <div className="page-head">
        <h1 className="page-title">Authorized Organizations</h1>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => setIsAdding(true)}>
            + Add Trust
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExport}>Export</button>
        </div>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Authorized organizations sections">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`page-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Trustees' && (
        <>
          <TrusteesToolbar
            search={search}
            onSearch={setSearch}
            division={divisionFilter}
            onDivision={setDivisionFilter}
            status={statusFilter}
            onStatus={setStatusFilter}
            hiddenColumns={hiddenColumns}
            onToggleColumn={toggleColumn}
          />
          <TrusteesTable rows={filteredRows} onOpenTrust={setViewingTrust} hiddenColumns={hiddenColumns} />
        </>
      )}

      {activeTab === 'Trustors' && <TrustorsTable rows={TRUSTORS} />}

      {activeTab === 'Audit' && <TrustAuditTable rows={TRUST_AUDIT} />}

      {isAdding && <AddTrustDrawer onCancel={() => setIsAdding(false)} onSave={handleSave} />}

      {viewingTrust && (
        <TrustDetailsDrawer
          trust={viewingTrust}
          onCancel={() => setViewingTrust(null)}
          onSave={handleUpdateTrust}
        />
      )}
    </div>
  )
}

export default AuthorizedOrganizations
