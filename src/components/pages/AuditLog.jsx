import React, { useEffect, useMemo, useState } from 'react'
import { downloadCsv } from '../../utils/csv.js'
import { apiGet } from '../../utils/apiClient.js'

function mapEntry(row) {
  return {
    when: row.when_display,
    who: row.who,
    type: row.action_type,
    action: row.action_label,
    detail: row.detail
  }
}

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
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [who, setWho] = useState('Everyone')
  const [actionType, setActionType] = useState('All')

  useEffect(() => {
    let cancelled = false
    apiGet('/audit-log')
      .then((rows) => { if (!cancelled) setEntries(rows.map(mapEntry)) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const whoOptions = useMemo(() => Array.from(new Set(entries.map((e) => e.who))).sort(), [entries])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((row) => {
      const matchesSearch =
        !q || row.action.toLowerCase().includes(q) || row.detail.toLowerCase().includes(q)
      const matchesWho = who === 'Everyone' || row.who === who
      const matchesType = actionType === 'All' || row.type === actionType
      return matchesSearch && matchesWho && matchesType
    })
  }, [entries, search, who, actionType])

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

      {error && <p className="page-note" style={{ color: '#c0392b' }}>Couldn&rsquo;t load audit log: {error}</p>}

      {loading ? (
        <p className="page-note">Loading audit log…</p>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}

export default AuditLog
