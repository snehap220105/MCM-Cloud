import React, { useMemo, useState } from 'react'
import { downloadCsv } from '../../utils/csv.js'

const ACTION_TYPES = [
  { value: 'sign-in', label: 'Sign in' },
  { value: 'create', label: 'Create' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'alert', label: 'ALERT' },
  { value: 'callback', label: 'Callback' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'copilot', label: 'Copilot' },
  { value: 'export', label: 'Export' },
  { value: 'supervisor', label: 'Supervisor' }
]

const ENTRIES = [
  { when: '15 Aug 14:58', who: 'Faisal Khan', type: 'alert', action: 'ALERT: Queue backlog — Retail Billing', detail: 'Interactions waiting is 20 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan' },
  { when: '15 Aug 14:53', who: 'Faisal Khan', type: 'alert', action: 'ALERT: Queue backlog — Retail Billing', detail: 'Interactions waiting is 16 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan' },
  { when: '15 Aug 14:48', who: 'Faisal Khan', type: 'alert', action: 'ALERT: Queue backlog — Retail Billing', detail: 'Interactions waiting is 15 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan' },
  { when: '15 Aug 14:43', who: 'Faisal Khan', type: 'alert', action: 'ALERT: Queue backlog — Retail Billing', detail: 'Interactions waiting is 10 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan' },
  { when: '15 Aug 14:38', who: 'Faisal Khan', type: 'alert', action: 'ALERT: Queue backlog — Retail Billing', detail: 'Interactions waiting is 24 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan' },
  { when: '15 Aug 14:33', who: 'Faisal Khan', type: 'alert', action: 'ALERT: Queue backlog — Retail Billing', detail: 'Interactions waiting is 21 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan' },
  { when: '15 Aug 14:28', who: 'System', type: 'alert', action: 'ALERT: Queue backlog — Retail Billing', detail: 'Interactions waiting is 18 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan' },
  { when: '15 Aug 14:23', who: 'System', type: 'alert', action: 'ALERT: Queue backlog — Retail Billing', detail: 'Interactions waiting is 12 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan' },
  { when: '15 Aug 14:18', who: 'System', type: 'alert', action: 'ALERT: Queue backlog — Retail Billing', detail: 'Interactions waiting is 9 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan' },
  { when: '15 Aug 14:13', who: 'System', type: 'alert', action: 'ALERT: Queue backlog resolved — Retail Billing', detail: 'Interactions waiting dropped below threshold — auto-cleared' },
  { when: '15 Aug 12:04', who: 'Faisal Khan', type: 'edit', action: 'Updated Organization Settings — General', detail: 'Default language changed to English (United Kingdom)' },
  { when: '15 Aug 11:47', who: 'Faisal Khan', type: 'edit', action: 'Updated Organization Settings — Security', detail: 'Minimum password length changed from 10 to 12' },
  { when: '15 Aug 11:20', who: 'S. Patel', type: 'create', action: 'Created Purchase ORD-4455', detail: 'Speech & Text Analytics — Qty 50 — Pending approval' },
  { when: '15 Aug 10:58', who: 'Faisal Khan', type: 'create', action: 'Added Trust — Cloudline Partners', detail: 'Relationship: Trustee — Scope: Read-only Admin' },
  { when: '15 Aug 10:31', who: 'Faisal Khan', type: 'delete', action: 'Revoked Trust — Vertex Consulting', detail: 'Reason: contract ended' },
  { when: '15 Aug 09:52', who: 'IT Ops', type: 'sign-in', action: 'Signed in', detail: 'Method: SSO — IP 194.60.12.4' },
  { when: '15 Aug 09:15', who: 'Marco Rossi', type: 'sign-in', action: 'Signed in', detail: 'Method: SSO — IP 194.60.12.9' },
  { when: '14 Aug 18:40', who: 'Faisal Khan', type: 'export', action: 'Exported CSV — Purchases', detail: '6 rows exported' },
  { when: '14 Aug 17:22', who: 'Faisal Khan', type: 'edit', action: 'Updated Organization Settings — Branding', detail: 'Accent colour changed to #FF4F1F' },
  { when: '14 Aug 16:05', who: 'S. Patel', type: 'create', action: 'Created Purchase ORD-4441', detail: 'Predictive Engagement — Qty 50 — Provisioned' },
  { when: '14 Aug 15:38', who: 'Faisal Khan', type: 'edit', action: 'Updated Roles / Permissions — S. Patel', detail: 'Role changed to Supervisor' },
  { when: '14 Aug 14:12', who: 'IT Ops', type: 'create', action: 'Created Purchase ORD-4402', detail: 'Additional storage — 5 TB — Qty 1 — Provisioned' },
  { when: '14 Aug 11:03', who: 'Faisal Khan', type: 'create', action: 'Added Trust — Northstar BPO', detail: 'Relationship: Trustee — Scope: Supervisor, Agent' },
  { when: '13 Aug 17:47', who: 'Marco Rossi', type: 'sign-in', action: 'Signed in', detail: 'Method: Native — IP 10.20.4.18' },
  { when: '13 Aug 16:20', who: 'Faisal Khan', type: 'edit', action: 'Updated Organization Settings — Data Residency', detail: 'Preferred media region changed to EU (London)' },
  { when: '13 Aug 09:44', who: 'S. Patel', type: 'delete', action: 'Cancelled Purchase ORD-4388', detail: 'MCM CX 2 Concurrent — Qty 20' },
  { when: '12 Aug 18:02', who: 'Faisal Khan', type: 'edit', action: 'Updated Organization Settings — Beta Programme', detail: 'Predictive routing pilot disabled' },
  { when: '12 Aug 15:16', who: 'IT Ops', type: 'sign-in', action: 'Signed in', detail: 'Method: SSO — IP 194.60.12.4' },
  { when: '12 Aug 10:33', who: 'Faisal Khan', type: 'export', action: 'Exported CSV — Audit Log', detail: '27 rows exported' },
  { when: '11 Aug 19:05', who: 'Faisal Khan', type: 'create', action: 'Added Trust — MCM Retail Ireland', detail: 'Relationship: Trustee — Scope: Contact Centre Admin' },
  { when: '11 Aug 12:48', who: 'S. Patel', type: 'create', action: 'Created Purchase ORD-4471', detail: 'MCM CX 3 — WEM (Named) — Qty 25 — Provisioned' },
  { when: '10 Aug 09:27', who: 'Faisal Khan', type: 'sign-in', action: 'Signed in', detail: 'Method: SSO — IP 194.60.12.4' }
]

function ActionCell({ row }) {
  if (row.type === 'alert') {
    return (
      <span className="audit-action audit-action-alert">
        <span aria-hidden="true">🔔</span> {row.action}
      </span>
    )
  }
  return <span className="audit-action">{row.action}</span>
}

function AuditLog() {
  const [search, setSearch] = useState('')
  const [who, setWho] = useState('Everyone')
  const [actionType, setActionType] = useState('All')

  const whoOptions = useMemo(() => Array.from(new Set(ENTRIES.map((e) => e.who))).sort(), [])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ENTRIES.filter((row) => {
      const matchesSearch =
        !q || row.action.toLowerCase().includes(q) || row.detail.toLowerCase().includes(q)
      const matchesWho = who === 'Everyone' || row.who === who
      const matchesType = actionType === 'All' || row.type === actionType
      return matchesSearch && matchesWho && matchesType
    })
  }, [search, who, actionType])

  const handleReset = () => {
    setSearch('')
    setWho('Everyone')
    setActionType('All')
  }

  const handleExport = () => {
    downloadCsv(
      'audit-log.csv',
      ['When', 'Who', 'Action', 'Detail'],
      filteredRows.map((row) => [row.when, row.who, row.action, row.detail])
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
        <h1 className="page-title">Audit Log</h1>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExport}>
            ⭳ Export CSV
          </button>
        </div>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Audit log entry count">
        <span className="page-tab active static">{filteredRows.length} entries</span>
      </div>

      <div className="purchases-toolbar">
        <div className="toolbar-filters">
          <input
            type="text"
            className="toolbar-search"
            placeholder="Search actions & detail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search actions and detail"
          />
          <select
            className="toolbar-filter-select"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            aria-label="Who"
          >
            <option value="Everyone">Everyone</option>
            {whoOptions.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <select
            className="toolbar-filter-select"
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            aria-label="Action type"
          >
            <option value="All">All action types</option>
            {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn-toolbar" onClick={handleReset}>Reset</button>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={`${row.when}-${idx}`}>
                  <td className="audit-when">{row.when}</td>
                  <td className="audit-who">{row.who}</td>
                  <td><ActionCell row={row} /></td>
                  <td className="audit-detail">{row.detail}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty">No entries match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AuditLog
