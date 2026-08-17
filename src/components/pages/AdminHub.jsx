import React, { useEffect, useMemo, useRef, useState } from 'react'
import navigationData from '../navigationData.js'

const TABS = ['All', 'Recently used', 'Favourites']
const HUB_SECTIONS = navigationData
const DEFAULT_FAVOURITE_IDS = ['people', 'queues', 'architect-flows']

// Explicit column placement for the "All" tab so layout doesn't depend on the
// browser's CSS multi-column balancing heuristics — UI MAP sits right under
// DIRECTORY rather than wherever auto-balancing happens to land it.
const HUB_COLUMN_HEADINGS = [
  ['ACCOUNT SETTINGS', 'PEOPLE & PERMISSIONS', 'DIRECTORY', 'UI MAP'],
  ['CONTACT CENTER', 'TELEPHONY'],
  ['ROUTING', 'INTEGRATIONS', 'OUTBOUND', 'QUALITY & WEM']
]
const HUB_COLUMNS = HUB_COLUMN_HEADINGS.map((headings) =>
  headings.map((h) => HUB_SECTIONS.find((s) => s.heading === h)).filter(Boolean)
)

const AUDIT_VIEWER_ENTRIES = [
  {
    when: '15 Aug 16:21',
    who: 'Faisal Khan',
    type: 'alert',
    label: 'ALERT: Queue backlog — Retail Billing',
    detail: 'Interactions waiting is 17 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'
  },
  {
    when: '15 Aug 16:16',
    who: 'Faisal Khan',
    type: 'alert',
    label: 'ALERT: Queue backlog — Retail Billing',
    detail: 'Interactions waiting is 9 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'
  },
  {
    when: '15 Aug 16:11',
    who: 'Faisal Khan',
    type: 'alert',
    label: 'ALERT: Agent away too long',
    detail: 'Time in Away status (min) is 28 (> 15) — notified Marco Rossi'
  },
  { when: '15 Aug 2026 16:11', who: 'Faisal Khan', type: 'auth', label: 'Sign in', detail: 'Faisal Khan (admin)' },
  { when: '04 Jan 2026 09:12', who: 'System', type: 'system', label: 'Org provisioned', detail: 'mcmgroup' },
  { when: '04 Jan 2026 09:30', who: 'F. Khan', type: 'import', label: 'Bulk import', detail: '12 users created' }
]

const WHATS_NEW = [
  { version: 'v7', text: 'UI audit fix pack — every control now works' },
  { version: 'v6', text: 'Architect editor, Test Call, Agent Workspace, Quality' },
  { version: 'v5', text: 'Outbound campaigns with live dialer, contact lists, DNC' },
  { version: 'v4', text: 'Telephony: sites, trunks, number plans, Simulate Call' },
  { version: 'v3', text: 'Queues with ACD routing logic, wrap-up, utilization' },
  { version: 'v2', text: 'People & Permissions on a live data layer' }
]

function findItem(id) {
  for (const section of navigationData) {
    const item = section.items.find((i) => i.id === id)
    if (item) return { ...item, section: section.heading }
  }
  return null
}

function ItemList({ items, onNavigate, emptyText }) {
  if (items.length === 0) {
    return (
      <div className="card">
        <div className="card-empty">
          <p>{emptyText}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <ul className="admin-hub-list admin-hub-list-flat">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="admin-hub-link" onClick={() => onNavigate(item.id)}>
              {item.label}
            </button>
            <span className="admin-hub-item-section">{item.section}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HubCard({ section, onNavigate }) {
  return (
    <div className="admin-hub-card">
      <h2 className="admin-hub-card-heading">{section.heading}</h2>
      <ul className="admin-hub-list">
        {section.items.map((item) => (
          <li key={item.id}>
            <button type="button" className="admin-hub-link" onClick={() => onNavigate(item.id)}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectionGrid({ sections, onNavigate }) {
  return (
    <div className="admin-hub-grid">
      {sections.map((section) => (
        <HubCard section={section} onNavigate={onNavigate} key={section.heading} />
      ))}
    </div>
  )
}

function AllSectionsGrid({ columns, onNavigate }) {
  return (
    <div className="admin-hub-columns">
      {columns.map((col, i) => (
        <div className="admin-hub-columns-col" key={i}>
          {col.map((section) => (
            <HubCard section={section} onNavigate={onNavigate} key={section.heading} />
          ))}
        </div>
      ))}
    </div>
  )
}

function AuditActionCell({ row }) {
  if (row.type === 'alert') {
    return (
      <span>
        <span aria-hidden="true">🔔</span> <span className="audit-label-inline audit-action-alert">{row.label}</span>
        {' — '}
        <span className="audit-detail-inline">{row.detail}</span>
      </span>
    )
  }
  return (
    <span>
      <span className="audit-label-inline">{row.label}</span>
      {' — '}
      <span className="audit-detail-inline">{row.detail}</span>
    </span>
  )
}

function AuditViewerDrawer({ onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-viewer-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="audit-viewer-title">Audit Log</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body audit-viewer-body">
          <table className="audit-viewer-table">
            <thead className="visually-hidden">
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {AUDIT_VIEWER_ENTRIES.map((row, idx) => (
                <tr key={`${row.when}-${idx}`}>
                  <td className="audit-when">{row.when}</td>
                  <td className="audit-who">{row.who}</td>
                  <td className="audit-action-cell"><AuditActionCell row={row} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function WhatsNewPanel({ onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.whats-new-trigger')) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [onClose])

  return (
    <div className="whats-new-panel" role="menu" aria-label="What's new" ref={ref}>
      <h3 className="whats-new-heading">What&rsquo;s New in MCM Cloud CX</h3>
      <ul className="whats-new-list">
        {WHATS_NEW.map((entry) => (
          <li key={entry.version} className="whats-new-item">
            <span className="version-badge">{entry.version}</span>
            <span className="whats-new-text">{entry.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AdminHub({ onNavigate, recentIds }) {
  const [activeTab, setActiveTab] = useState('All')
  const [isAuditViewerOpen, setIsAuditViewerOpen] = useState(false)
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false)
  const [favouriteIds] = useState(() => new Set(DEFAULT_FAVOURITE_IDS))

  const recentItems = useMemo(() => recentIds.map(findItem).filter(Boolean), [recentIds])

  const favouriteSections = useMemo(
    () =>
      HUB_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => favouriteIds.has(item.id))
      })).filter((section) => section.items.length > 0),
    [favouriteIds]
  )

  return (
    <div className="page">
      <nav className="breadcrumb breadcrumb-muted" aria-label="Breadcrumb">
        <span>MCM Cloud CX</span>
      </nav>

      <div className="page-head">
        <h1 className="page-title">Admin</h1>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setIsAuditViewerOpen(true)}>
            Audit Viewer
          </button>
          <div className="whats-new-wrap">
            <button
              type="button"
              className="btn btn-primary whats-new-trigger"
              aria-expanded={isWhatsNewOpen}
              onClick={() => setIsWhatsNewOpen((v) => !v)}
            >
              What&rsquo;s New
            </button>
            {isWhatsNewOpen && <WhatsNewPanel onClose={() => setIsWhatsNewOpen(false)} />}
          </div>
        </div>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Admin hub sections">
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

      {activeTab === 'All' && <AllSectionsGrid columns={HUB_COLUMNS} onNavigate={onNavigate} />}

      {activeTab === 'Recently used' && (
        <ItemList
          items={recentItems}
          onNavigate={onNavigate}
          emptyText="Nothing visited yet — items you open will show up here."
        />
      )}

      {activeTab === 'Favourites' &&
        (favouriteSections.length > 0 ? (
          <SectionGrid sections={favouriteSections} onNavigate={onNavigate} />
        ) : (
          <div className="card">
            <div className="card-empty">
              <p>No favourites yet.</p>
            </div>
          </div>
        ))}

      {isAuditViewerOpen && <AuditViewerDrawer onClose={() => setIsAuditViewerOpen(false)} />}
    </div>
  )
}

export default AdminHub
