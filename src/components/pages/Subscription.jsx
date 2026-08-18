import React, { useEffect, useState } from 'react'
import { downloadTextFile } from '../../utils/csv.js'
import { apiGet, apiPatch } from '../../utils/apiClient.js'

const STATUS_LABEL = { open: 'Open', paid: 'Paid' }

function LicencesCard({ licences }) {
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
          {licences.map((row) => {
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

function UsageCard({ usage }) {
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
          {usage.map((row) => (
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

function InvoicesCard({ invoices, planLabel }) {
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
          {invoices.map((row) => (
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

function ChangePlanDrawer({ currentPlan, planTiers, onCancel, onSave }) {
  const currentTier = planTiers.find((t) => currentPlan.startsWith(t.id))?.id || planTiers[0].id
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
          {planTiers.map((tier) => (
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isChangingPlan, setIsChangingPlan] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiGet('/subscription')
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleChangePlan = async (newPlanLabel) => {
    setIsChangingPlan(false)
    try {
      await apiPatch('/subscription/plan', { planLabel: newPlanLabel })
      setData((prev) => ({ ...prev, planLabel: newPlanLabel }))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Admin</span>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span>Account Settings</span>
      </nav>

      <div className="page-head">
        <h1 className="page-title">Subscription</h1>
        {data && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setIsChangingPlan(true)}>
              Change plan
            </button>
          </div>
        )}
      </div>

      {error && <p className="page-note" style={{ color: '#c0392b' }}>Couldn&rsquo;t load subscription: {error}</p>}

      {loading ? (
        <p className="page-note">Loading subscription…</p>
      ) : data ? (
        <>
          <div className="page-tabs" role="tablist" aria-label="Subscription plan">
            <span className="page-tab active static">Plan: {data.planLabel}</span>
          </div>

          <LicencesCard licences={data.licences} />

          <div className="subscription-grid">
            <UsageCard usage={data.usage} />
            <InvoicesCard invoices={data.invoices} planLabel={data.planLabel} />
          </div>

          {isChangingPlan && (
            <ChangePlanDrawer
              currentPlan={data.planLabel}
              planTiers={data.licences.map((l) => ({ id: l.licence, price: l.price }))}
              onCancel={() => setIsChangingPlan(false)}
              onSave={handleChangePlan}
            />
          )}
        </>
      ) : null}
    </div>
  )
}

export default Subscription
