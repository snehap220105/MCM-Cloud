import React, { useState } from 'react'

function Logo() {
  return (
    <div className="logo" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="30" fill="#FF7A33" />
        <text
          x="30"
          y="37"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="19"
          fontWeight="bold"
          fill="white"
        >
          MCM
        </text>
      </svg>
    </div>
  )
}

function IconDirectory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconActivity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function IconPerformance() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconAdmin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconApps() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

const TABS = [
  { id: 'directory', label: 'Directory', Icon: IconDirectory },
  { id: 'activity', label: 'Activity', Icon: IconActivity },
  { id: 'performance', label: 'Performance', Icon: IconPerformance },
  { id: 'admin', label: 'Admin', Icon: IconAdmin },
  { id: 'apps', label: 'Apps', Icon: IconApps }
]

function TopBar({ activeTab, onTabChange, presence }) {
  const [globalSearch, setGlobalSearch] = useState('')

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Logo />
        <span className="topbar-title">MCM Group &middot; Cloud CX</span>
      </div>

      <nav className="topbar-tabs" aria-label="Primary">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`topbar-tab${activeTab === id ? ' active' : ''}`}
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? 'page' : undefined}
          >
            <span className="topbar-tab-icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="topbar-tab-label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="topbar-search">
        <input
          type="text"
          className="topbar-search-input"
          placeholder="Search people, queues, flows..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          aria-label="Search people, queues, flows"
        />
      </div>

      <div className="topbar-actions">
        <button type="button" className="topbar-icon-button" aria-label="Inbox, 23 unread">
          <IconInbox />
          <span className="topbar-badge" aria-hidden="true">23</span>
        </button>
        <button type="button" className="topbar-icon-button" aria-label="Recent activity">
          <IconClock />
        </button>
        <button type="button" className="topbar-icon-button" aria-label="Help">
          <span className="topbar-help">?</span>
        </button>
      </div>

      <button type="button" className="topbar-user" aria-label={`Faisal Khan, ${presence?.text || 'Available'}`}>
        <span
          className="topbar-avatar"
          aria-hidden="true"
          style={presence?.color ? { boxShadow: `0 0 0 2px ${presence.color}` } : undefined}
        >
          FK
        </span>
        <span className="topbar-user-meta">
          <span className="topbar-user-name">Faisal Khan</span>
          <span className="topbar-user-status">{presence?.text || 'Available'}</span>
        </span>
      </button>
    </header>
  )
}

export default TopBar
