import React, { useEffect, useState } from 'react'
import { downloadCsv } from '../../utils/csv.js'

const INITIAL_TABS = [
  {
    name: 'General',
    rows: [
      { setting: 'Organization name', value: 'MCM Group PLC', status: 'Editable', field: 'text' },
      {
        setting: 'Short name',
        hint: 'Login identifier — cannot be changed after creation',
        value: 'mcmgroup',
        status: 'Locked',
        field: 'text'
      },
      {
        setting: 'Organization ID',
        hint: 'Give this to Customer Care when raising tickets',
        value: '8f14e45f-ceea-4d3b-9c7f-2b1a0d7e33aa',
        status: 'Locked',
        field: 'text'
      },
      {
        setting: 'Home region',
        hint: 'Set at org creation',
        value: 'EU (London) — euw2',
        status: 'Locked',
        field: 'text'
      },
      {
        setting: 'Default country code',
        value: '+44 (United Kingdom)',
        status: 'Editable',
        field: 'select',
        options: ['+44 (United Kingdom)', '+1 (United States)', '+353 (Ireland)', '+61 (Australia)', '+91 (India)']
      },
      {
        setting: 'Default language',
        value: 'English (United Kingdom)',
        status: 'Editable',
        field: 'select',
        options: ['English (United Kingdom)', 'English (United States)', 'French (France)', 'German (Germany)']
      },
      {
        setting: 'Time zone',
        value: 'Europe/London',
        status: 'Editable',
        field: 'select',
        options: ['Europe/London', 'Europe/Dublin', 'America/New_York', 'UTC']
      },
      {
        setting: 'Date / time format',
        value: 'DD/MM/YYYY · 24 hour',
        status: 'Editable',
        field: 'select',
        options: ['DD/MM/YYYY · 24 hour', 'MM/DD/YYYY · 12 hour', 'YYYY-MM-DD · 24 hour']
      }
    ]
  },
  {
    name: 'Security',
    rows: [
      {
        setting: 'Minimum password length',
        hint: 'Genesys default minimum is 8',
        value: '12',
        status: 'Editable',
        field: 'text'
      },
      { setting: 'Password expiry (days)', value: '90', status: 'Editable', field: 'text' },
      {
        setting: 'Password history (previous passwords blocked)',
        value: '10',
        status: 'Editable',
        field: 'text'
      },
      { setting: 'Session idle timeout (minutes)', value: '60', status: 'Editable', field: 'text' },
      {
        setting: 'Require multi-factor authentication',
        hint: 'Applies to native logins; SSO users authenticate at the IdP',
        state: 'enabled',
        status: 'Editable',
        field: 'checkbox'
      },
      {
        setting: 'Enforce SSO only (disable native passwords)',
        state: 'disabled',
        status: 'Editable',
        field: 'checkbox'
      },
      {
        setting: 'Allow MCM Care support access to configuration',
        state: 'enabled',
        status: 'Editable',
        field: 'checkbox'
      },
      {
        setting: 'Trusted IP ranges',
        value: '194.60.0.0/16, 10.20.0.0/16',
        status: 'Editable',
        field: 'text'
      }
    ]
  },
  {
    name: 'Branding',
    rows: [
      { setting: 'Use custom logo in agent UI', state: 'enabled', status: 'Editable', field: 'checkbox' },
      {
        setting: 'Theme',
        value: 'MCM Navy',
        status: 'Editable',
        field: 'select',
        options: ['MCM Navy', 'MCM Light', 'High Contrast']
      },
      { setting: 'Accent colour', value: '#FF4F1F', status: 'Editable', field: 'text' },
      { setting: 'Login page message', value: 'Welcome to MCM Cloud CX', status: 'Editable', field: 'text' }
    ]
  },
  {
    name: 'Data Residency',
    note:
      'Data residency is fixed at org creation for compliance. Media region is the only adjustable value — it affects where RTP is anchored, not where data is stored.',
    rows: [
      { setting: 'Core region (org home)', value: 'EU (London) — euw2', status: 'Locked', field: 'text' },
      {
        setting: 'Preferred media region',
        value: 'EU (London)',
        status: 'Editable',
        field: 'select',
        options: ['EU (London)', 'EU (Frankfurt)', 'US East (Virginia)']
      },
      {
        setting: 'Call recording storage',
        hint: 'Recordings stay in-region for UK-GDPR',
        value: 'EU (London)',
        status: 'Locked',
        field: 'text'
      },
      {
        setting: 'Transcript & analytics storage',
        value: 'EU (London)',
        status: 'Locked',
        field: 'text'
      }
    ]
  },
  {
    name: 'Beta Programme',
    note:
      'Beta features release "dark" and are enabled per-org here. They may change or be withdrawn; not covered by SLA.',
    rows: [
      {
        setting: 'Agent Copilot summaries',
        hint: 'AI wrap-up summaries after each call',
        state: 'enabled',
        status: 'Editable',
        field: 'checkbox'
      },
      { setting: 'New analytics workspace', state: 'enabled', status: 'Editable', field: 'checkbox' },
      { setting: 'WebRTC codec v2 (Opus FEC)', state: 'disabled', status: 'Editable', field: 'checkbox' },
      {
        setting: 'Predictive routing pilot',
        hint: 'AI-matched agent selection on eligible queues',
        state: 'disabled',
        status: 'Editable',
        field: 'checkbox'
      }
    ]
  }
]

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
  const [tabs, setTabs] = useState(INITIAL_TABS)
  const [activeTabName, setActiveTabName] = useState('General')
  const [isEditing, setIsEditing] = useState(false)
  const [quickEditRow, setQuickEditRow] = useState(null)
  const activeTab = tabs.find((tab) => tab.name === activeTabName) || tabs[0]

  const updateRow = (setting, updater) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.name !== activeTab.name) return tab
        return {
          ...tab,
          rows: tab.rows.map((row) => (row.setting === setting ? updater(row) : row))
        }
      })
    )
  }

  const handleQuickSave = (value) => {
    const row = quickEditRow
    const changed = row.field === 'checkbox' ? (row.state === 'enabled') !== value : row.value !== value
    updateRow(row.setting, (r) => {
      const updated = row.field === 'checkbox' ? { ...r, state: value ? 'enabled' : 'disabled' } : { ...r, value }
      return changed ? { ...updated, lastChanged: formatLastChanged(new Date()) } : updated
    })
    setQuickEditRow(null)
  }

  const handleSave = (draft) => {
    const now = formatLastChanged(new Date())
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.name !== activeTab.name) return tab
        return {
          ...tab,
          rows: tab.rows.map((row) => {
            const id = fieldId(tab.name, row.setting)
            if (!(id in draft)) return row
            const newValue = draft[id]
            const changed = row.field === 'checkbox' ? (row.state === 'enabled') !== newValue : row.value !== newValue
            const updatedRow = row.field === 'checkbox'
              ? { ...row, state: newValue ? 'enabled' : 'disabled' }
              : { ...row, value: newValue }
            return changed ? { ...updatedRow, lastChanged: now } : updatedRow
          })
        }
      })
    )
    setIsEditing(false)
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
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => setIsEditing(true)}>
            + Edit {activeTab.name} Settings
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExport}>Export</button>
        </div>
      </div>

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

      {quickEditRow && (
        <QuickEditModal row={quickEditRow} onCancel={() => setQuickEditRow(null)} onSave={handleQuickSave} />
      )}
    </div>
  )
}

export default OrganizationSettings
