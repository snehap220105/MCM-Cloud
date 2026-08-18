import React, { useEffect, useState } from 'react'
import { downloadCsv } from '../../utils/csv.js'
import { apiGet, apiPatch } from '../../utils/apiClient.js'

// Descriptive copy for tabs that need it — not stored in the backend since
// it's static page content, not a setting.
const TAB_NOTES = {
  'Data Residency':
    'Data residency is fixed at org creation for compliance. Media region is the only adjustable value — it affects where RTP is anchored, not where data is stored.',
  'Beta Programme':
    'Beta features release "dark" and are enabled per-org here. They may change or be withdrawn; not covered by SLA.'
}

const TAB_ORDER = ['General', 'Security', 'Branding', 'Data Residency', 'Beta Programme']

function mapRow(r) {
  return {
    id: r.id,
    setting: r.setting_label,
    hint: r.hint || undefined,
    value: r.value,
    state: r.state || undefined,
    status: r.status,
    field: r.field_type,
    options: r.options || undefined,
    lastChanged: r.last_changed ? formatLastChanged(new Date(r.last_changed)) : undefined
  }
}

function groupIntoTabs(apiRows) {
  return TAB_ORDER.map((name) => ({
    name,
    note: TAB_NOTES[name],
    rows: apiRows.filter((r) => r.tab_name === name).map(mapRow)
  })).filter((tab) => tab.rows.length > 0)
}

function SettingValue({ row }) {
  if (!row.state) return row.value

  return (
    <span className={`state state-${row.state}`}>
      <span className="state-dot" aria-hidden="true" />
      {row.state === 'enabled' ? 'Enabled' : 'Disabled'}
    </span>
  )
}

function SettingsTable({ rows, onEditRow }) {
  return (
    <table className="settings-table">
      <thead>
        <tr>
          <th scope="col">Setting</th>
          <th scope="col">Value</th>
          <th scope="col"><span className="visually-hidden">Status</span></th>
          <th scope="col">Last changed</th>
          <th scope="col"><span className="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const editable = row.status !== 'Locked'
          return (
            <tr key={row.setting}>
              <th scope="row" className="cell-setting">
                {editable ? (
                  <button type="button" className="setting-name setting-name-link" onClick={() => onEditRow(row)}>
                    {row.setting}
                  </button>
                ) : (
                  <span className="setting-name">{row.setting}</span>
                )}
                {row.hint && <span className="setting-hint">{row.hint}</span>}
              </th>
              <td className="cell-value">
                <SettingValue row={row} />
              </td>
              <td className="cell-status">
                <span className={`badge badge-${row.status.toLowerCase()}`}>{row.status}</span>
              </td>
              <td className="cell-changed">{row.lastChanged || '—'}</td>
              <td className="cell-actions">
                <button
                  type="button"
                  className="kebab"
                  aria-label={`Actions for ${row.setting}`}
                  onClick={editable ? () => onEditRow(row) : undefined}
                  disabled={!editable}
                >
                  ⋮
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function QuickEditModal({ row, onCancel, onSave }) {
  const isCheckbox = row.field === 'checkbox'
  const [value, setValue] = useState(isCheckbox ? row.state === 'enabled' : row.value)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="modal-backdrop modal-backdrop-center" onMouseDown={onCancel}>
      <div
        className="modal modal-compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-edit-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="quick-edit-title">{row.setting}</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            {row.hint && <p className="setting-hint quick-edit-hint">{row.hint}</p>}
            <label className="modal-label" htmlFor="quick-edit-field">{row.setting}</label>
            {isCheckbox ? (
              <label className="modal-checkbox-row" htmlFor="quick-edit-field">
                <input
                  id="quick-edit-field"
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setValue(e.target.checked)}
                />
                <span>Enabled</span>
              </label>
            ) : row.field === 'select' ? (
              <select
                id="quick-edit-field"
                className="modal-select"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              >
                {row.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input
                id="quick-edit-field"
                type="text"
                className="modal-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(value)}>Save</button>
        </div>
      </div>
    </div>
  )
}

function fieldId(tabName, setting) {
  return `${tabName}::${setting}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatLastChanged(date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = MONTHS[date.getMonth()]
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year} · ${hours}:${minutes}`
}

function EditSettingsModal({ tab, onCancel, onSave }) {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(
      tab.rows.map((row) => [fieldId(tab.name, row.setting), row.field === 'checkbox' ? row.state === 'enabled' : row.value])
    )
  )

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const setField = (id, value) => setDraft((prev) => ({ ...prev, [id]: value }))

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="edit-modal-title">Edit {tab.name} Settings</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {tab.rows.map((row) => {
            const id = fieldId(tab.name, row.setting)
            const locked = row.status === 'Locked'

            if (row.field === 'checkbox') {
              return (
                <label key={id} className="modal-checkbox-row" htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={draft[id]}
                    onChange={(e) => setField(id, e.target.checked)}
                  />
                  <span>{row.setting}</span>
                </label>
              )
            }

            return (
              <div className="modal-field" key={id}>
                <label className="modal-label" htmlFor={id}>
                  {row.setting}
                  {locked && ' (locked)'}
                </label>
                {row.field === 'select' ? (
                  <select
                    id={id}
                    className="modal-select"
                    value={draft[id]}
                    disabled={locked}
                    onChange={(e) => setField(id, e.target.value)}
                  >
                    {row.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type="text"
                    className="modal-input"
                    value={draft[id]}
                    disabled={locked}
                    onChange={(e) => setField(id, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)}>Save all</button>
        </div>
      </div>
    </div>
  )
}

function OrganizationSettings() {
  const [tabs, setTabs] = useState([])
  const [activeTabName, setActiveTabName] = useState('General')
  const [isEditing, setIsEditing] = useState(false)
  const [quickEditRow, setQuickEditRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const activeTab = tabs.find((tab) => tab.name === activeTabName) || tabs[0]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiGet('/organization-settings')
      .then((rows) => { if (!cancelled) setTabs(groupIntoTabs(rows)) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const applyUpdatedRow = (tabName, updated) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.name !== tabName) return tab
        return { ...tab, rows: tab.rows.map((row) => (row.id === updated.id ? mapRow(updated) : row)) }
      })
    )
  }

  const handleQuickSave = async (value) => {
    const row = quickEditRow
    setQuickEditRow(null)
    try {
      const body = row.field === 'checkbox' ? { state: value ? 'enabled' : 'disabled' } : { value }
      const updated = await apiPatch(`/organization-settings/${row.id}`, body)
      applyUpdatedRow(activeTab.name, updated)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSave = async (draft) => {
    setIsEditing(false)
    const changedRows = activeTab.rows.filter((row) => {
      const id = fieldId(activeTab.name, row.setting)
      if (!(id in draft)) return false
      const newValue = draft[id]
      return row.field === 'checkbox' ? (row.state === 'enabled') !== newValue : row.value !== newValue
    })
    if (changedRows.length === 0) return

    try {
      const updates = await Promise.all(
        changedRows.map((row) => {
          const newValue = draft[fieldId(activeTab.name, row.setting)]
          const body = row.field === 'checkbox' ? { state: newValue ? 'enabled' : 'disabled' } : { value: newValue }
          return apiPatch(`/organization-settings/${row.id}`, body)
        })
      )
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.name !== activeTab.name) return tab
          return {
            ...tab,
            rows: tab.rows.map((row) => {
              const match = updates.find((u) => u.id === row.id)
              return match ? mapRow(match) : row
            })
          }
        })
      )
    } catch (err) {
      setError(err.message)
    }
  }

  const handleExport = () => {
    downloadCsv(
      `organization-settings-${activeTab.name.toLowerCase().replace(/\s+/g, '-')}.csv`,
      ['Setting', 'Value', 'Status'],
      activeTab.rows.map((row) => [
        row.setting,
        row.state ? (row.state === 'enabled' ? 'Enabled' : 'Disabled') : row.value,
        row.status
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
        <h1 className="page-title">Organization Settings</h1>
        {activeTab && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setIsEditing(true)}>
              + Edit {activeTab.name} Settings
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExport}>Export</button>
          </div>
        )}
      </div>

      {error && <p className="page-note" style={{ color: '#c0392b' }}>Couldn&rsquo;t load settings: {error}</p>}

      {loading ? (
        <p className="page-note">Loading organization settings…</p>
      ) : activeTab ? (
        <>
          <div className="page-tabs" role="tablist" aria-label="Organization settings sections">
            {tabs.map((tab) => (
              <button
                key={tab.name}
                type="button"
                role="tab"
                aria-selected={activeTab.name === tab.name}
                className={`page-tab${activeTab.name === tab.name ? ' active' : ''}`}
                onClick={() => setActiveTabName(tab.name)}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {activeTab.note && <p className="page-note">{activeTab.note}</p>}

          <div className="card">
            <SettingsTable rows={activeTab.rows} onEditRow={setQuickEditRow} />
          </div>

          {isEditing && (
            <EditSettingsModal tab={activeTab} onCancel={() => setIsEditing(false)} onSave={handleSave} />
          )}
        </>
      ) : null}

      {quickEditRow && (
        <QuickEditModal row={quickEditRow} onCancel={() => setQuickEditRow(null)} onSave={handleQuickSave} />
      )}
    </div>
  )
}

export default OrganizationSettings
