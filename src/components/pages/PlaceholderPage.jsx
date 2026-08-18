import React from 'react'

function PlaceholderPage({ title, section }) {
  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Admin</span>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span>{section}</span>
      </nav>

      <div className="page-head">
        <h1 className="page-title">{title}</h1>
      </div>

      <div className="card">
        <div className="card-empty">
          <p>This screen has not been built yet.</p>
        </div>
      </div>
    </div>
  )
}

export default PlaceholderPage
