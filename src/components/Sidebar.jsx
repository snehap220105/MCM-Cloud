import React from 'react'

function SidebarSearch({ value, onChange }) {
  return (
    <div className="sidebar-search">
      <input
        type="text"
        className="search-input"
        placeholder="Search admin"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search admin"
      />
    </div>
  )
}

function NavSection({ heading, items, activeId, onSelect, filter }) {
  const q = filter.trim().toLowerCase()
  const itemVisibility = items.map((item) => {
    if (!q) return true
    return item.label.toLowerCase().includes(q)
  })
  const visibleCount = itemVisibility.filter(Boolean).length
  const sectionHidden = q.length > 0 && visibleCount === 0

  return (
    <section className={`nav-section${sectionHidden ? ' section-hidden' : ''}`}>
      <h2 className="section-heading">{heading}</h2>
      <ul className="nav-list">
        {items.map((item, idx) => {
          const hidden = q.length > 0 && !itemVisibility[idx]
          const isActive = activeId === item.id
          return (
            <li
              key={item.id}
              className={`nav-item${hidden ? ' nav-item-hidden' : ''}`}
            >
              <button
                type="button"
                className={`nav-link${isActive ? ' active' : ''}`}
                onClick={() => onSelect(item.id)}
                title={item.label}
              >
                {item.starred && <span className="star" aria-hidden="true">★</span>}
                <span>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function SidebarNav({ sections, activeId, onSelect, filter }) {
  return (
    <nav className="sidebar-nav" aria-label="Admin navigation">
      {sections.map((section) => (
        <NavSection
          key={section.heading}
          heading={section.heading}
          items={section.items}
          activeId={activeId}
          onSelect={onSelect}
          filter={filter}
        />
      ))}
    </nav>
  )
}

function Sidebar({ sections, activeId, onSelect, searchValue, onSearchChange }) {
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <SidebarSearch value={searchValue} onChange={onSearchChange} />
      <SidebarNav
        sections={sections}
        activeId={activeId}
        onSelect={onSelect}
        filter={searchValue}
      />
    </aside>
  )
}

export default Sidebar
