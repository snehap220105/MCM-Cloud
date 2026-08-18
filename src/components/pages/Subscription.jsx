import React, { useEffect, useState } from 'react'
import { downloadTextFile } from '../../utils/csv.js'

const DEFAULT_PLAN_LABEL = 'CX 3 (Annual, named users)'

const LICENCES = [
  { licence: 'CX 1', purchased: 40, assigned: 2, available: 38, price: '£60/seat' },
  { licence: 'CX 2', purchased: 60, assigned: 5, available: 55, price: '£95/seat' },
  { licence: 'CX 3', purchased: 25, assigned: 3, available: 22, price: '£125/seat' },
  { licence: 'CX 4', purchased: 10, assigned: 0, available: 10, price: '£150/seat' },
  { licence: 'Communicate', purchased: 50, assigned: 0, available: 50, price: '£18/seat' }
]

const USAGE = [
  { item: 'Telephony minutes (this month)', usage: '1193 min', charge: '£14.32' },
  { item: 'SMS / WhatsApp messages', usage: '59 conversations', charge: '£2.36' },
  { item: 'Recording storage', usage: '42.1 GB (234 recordings)', charge: '£14.74' }
]

const INVOICES = [
  { period: 'August 2026', seats: '£970', total: '£1,090', status: 'open' },
  { period: 'July 2026', seats: '£970', total: '£1,083', status: 'paid' },
  { period: 'June 2026', seats: '£970', total: '£1,076', status: 'paid' }
]

const STATUS_LABEL = { open: 'Open', paid: 'Paid' }

function LicencesCard() {
  return (
    <div className="card">
      <div className="card-header-row">
        <h3>Licences — purchased vs assigned</h3>
        <span className="card-header-note">assignments update live from People</span>
      </div>
      <table className="plain-table">
        <thead>
          <tr>
            <th scope="col">Licence</th>
            <th scope="col">Purchased</th>
            <th scope="col">Assigned</th>
            <th scope="col">Available</th>
            <th scope="col">Utilisation</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {LICENCES.map((row) => {
            const pct = row.purchased === 0 ? 0 : Math.round((row.assigned / row.purchased) * 100)
            return (
              <tr key={row.licence}>
                <th scope="row">{row.licence}</th>
                <td className="num-accent">{row.purchased}</td>
                <td className="num-accent">{row.assigned}</td>
                <td className="num-accent">{row.available}</td>
                <td>
                  <div className="utilisation">
                    <div className="utilisation-track">
                      <div className="utilisation-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </td>
                <td>{row.price}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function UsageCard() {
  return (
    <div className="card">
      <div className="card-header-row">
        <h3>Usage-based charges</h3>
        <span className="card-header-note">computed from real traffic in this workspace</span>
      </div>
      <table className="plain-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Usage</th>
            <th scope="col">Charge</th>
          </tr>
        </thead>
        <tbody>
          {USAGE.map((row) => (
            <tr key={row.item}>
              <th scope="row">{row.item}</th>
              <td>{row.usage}</td>
              <td>{row.charge}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InvoicesCard({ planLabel }) {
  const handleStatement = (invoice) => {
    const content = [
      'MCM GROUP PLC — SUBSCRIPTION STATEMENT',
      '========================================',
      `Billing period : ${invoice.period}`,
      `Plan           : ${planLabel}`,
      `Seats          : ${invoice.seats}`,
      `Total          : ${invoice.total}`,
      `Status         : ${STATUS_LABEL[invoice.status]}`,
      '',
      'Thank you for your business.'
    ].join('\n')

    const filename = `statement-${invoice.period.toLowerCase().replace(/\s+/g, '-')}.txt`
    downloadTextFile(filename, content)
  }

  return (
    <div className="card">
      <div className="card-header-row">
        <h3>Invoices</h3>
      </div>
      <table className="plain-table">
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Seats</th>
            <th scope="col">Total</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {INVOICES.map((row) => (
            <tr key={row.period}>
              <th scope="row">{row.period}</th>
              <td>{row.seats}</td>
              <td>{row.total}</td>
              <td>
                <span className={`status-cell status-${row.status === 'open' ? 'pending' : 'provisioned'}`}>
                  <span className="status-dot-lg" aria-hidden="true" />
                  {STATUS_LABEL[row.status]}
                </span>
              </td>
              <td>
                <button type="button" className="statement-link" onClick={() => handleStatement(row)}>
                  ⭳ Statement
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PLAN_TIERS = LICENCES.map((l) => ({ id: l.licence, price: l.price }))

function ChangePlanDrawer({ currentPlan, onCancel, onSave }) {
  const currentTier = PLAN_TIERS.find((t) => currentPlan.startsWith(t.id))?.id || PLAN_TIERS[0].id
  const [selected, setSelected] = useState(currentTier)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-plan-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="change-plan-title">Change Plan</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <h3 className="drawer-section-heading">Plan</h3>
          {PLAN_TIERS.map((tier) => (
            <label key={tier.id} className="plan-option-row">
              <input
                type="radio"
                name="plan-tier"
                value={tier.id}
                checked={selected === tier.id}
                onChange={() => setSelected(tier.id)}
              />
              <span className="plan-option-name">{tier.id}</span>
              <span className="plan-option-price">{tier.price}</span>
            </label>
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSave(`${selected} (Annual, named users)`)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Subscription() {
  const [planLabel, setPlanLabel] = useState(DEFAULT_PLAN_LABEL)
  const [isChangingPlan, setIsChangingPlan] = useState(false)

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Admin</span>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span>Account Settings</span>
      </nav>

      <div className="page-head">
        <h1 className="page-title">Subscription</h1>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => setIsChangingPlan(true)}>
            Change plan
          </button>
        </div>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Subscription plan">
        <span className="page-tab active static">Plan: {planLabel}</span>
      </div>

      <LicencesCard />

      <div className="subscription-grid">
        <UsageCard />
        <InvoicesCard planLabel={planLabel} />
      </div>

      {isChangingPlan && (
        <ChangePlanDrawer
          currentPlan={planLabel}
          onCancel={() => setIsChangingPlan(false)}
          onSave={(newPlan) => {
            setPlanLabel(newPlan)
            setIsChangingPlan(false)
          }}
        />
      )}
    </div>
  )
}

export default Subscription
