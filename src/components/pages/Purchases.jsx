import React, { useEffect, useMemo, useState } from 'react'
import { downloadCsv } from '../../utils/csv.js'
import ColumnsMenu from '../ColumnsMenu.jsx'
import { apiGet, apiPost, apiPatch } from '../../utils/apiClient.js'

const TABS = ['Orders', 'Marketplace', 'Add-ons']
const DIVISIONS = ['Sales', 'Support', 'IT Ops']

function mapOrder(row) {
  return {
    id: row.id,
    item: row.item,
    qty: row.qty,
    status: row.status,
    requestedBy: row.requested_by,
    date: row.order_date,
    division: row.division
  }
}

const STATUS_LABEL = {
  provisioned: 'Provisioned',
  pending: 'Pending approval',
  cancelled: 'Cancelled'
}

const COLUMNS = [
  { key: 'id', label: 'Order' },
  { key: 'item', label: 'Item' },
  { key: 'qty', label: 'Quantity' },
  { key: 'status', label: 'Status' },
  { key: 'division', label: 'Division' },
  { key: 'requestedBy', label: 'Requested by' },
  { key: 'date', label: 'Date' }
]

function IconColumns() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function OrdersToolbar({ search, onSearch, division, onDivision, status, onStatus, hiddenColumns, onToggleColumn }) {
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    onSearch('')
    onDivision('All')
    onStatus('Any')
    setTimeout(() => setIsRefreshing(false), 500)
  }

  return (
    <div className="purchases-toolbar">
      <div className="toolbar-filters">
        <input
          type="text"
          className="toolbar-search"
          placeholder="Search purchases"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search purchases"
        />
        <select
          className="toolbar-filter-select"
          value={division}
          onChange={(e) => onDivision(e.target.value)}
          aria-label="Division"
        >
          <option value="All">Division: All</option>
          {DIVISIONS.map((d) => <option key={d} value={d}>Division: {d}</option>)}
        </select>
        <select
          className="toolbar-filter-select"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          aria-label="Status"
        >
          <option value="Any">Status: Any</option>
          <option value="provisioned">Status: Provisioned</option>
          <option value="pending">Status: Pending approval</option>
          <option value="cancelled">Status: Cancelled</option>
        </select>
      </div>
      <div className="toolbar-actions">
        <div className="columns-menu-wrap">
          <button
            type="button"
            className="btn-toolbar columns-menu-trigger"
            aria-expanded={columnsOpen}
            onClick={() => setColumnsOpen((v) => !v)}
          >
            <IconColumns />
            Columns
          </button>
          {columnsOpen && (
            <ColumnsMenu
              columns={COLUMNS}
              hidden={hiddenColumns}
              onToggle={onToggleColumn}
              onClose={() => setColumnsOpen(false)}
            />
          )}
        </div>
        <button type="button" className={`btn-toolbar${isRefreshing ? ' icon-spin' : ''}`} onClick={handleRefresh}>
          <IconRefresh />
          Refresh
        </button>
      </div>
    </div>
  )
}

function OrdersTable({ rows, onOpenOrder, hiddenColumns }) {
  const [checked, setChecked] = useState(() => new Set())
  const allChecked = rows.length > 0 && checked.size === rows.length
  const visibleColumns = COLUMNS.filter((col) => !hiddenColumns.has(col.key))

  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.id)))
  const toggleOne = (id) =>
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const renderCell = (col, row) => {
    if (col.key === 'id') {
      return (
        <button type="button" className="order-link" onClick={() => onOpenOrder(row)}>
          {row.id}
        </button>
      )
    }
    if (col.key === 'status') {
      return (
        <span className={`status-cell status-${row.status}`}>
          <span className="status-dot-lg" aria-hidden="true" />
          {STATUS_LABEL[row.status]}
        </span>
      )
    }
    if (col.key === 'requestedBy') {
      return <span className="requested-link">{row.requestedBy}</span>
    }
    return row[col.key]
  }

  return (
    <div className="card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="col-check">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Select all orders"
                />
              </th>
              {visibleColumns.map((col) => (
                <th scope="col" key={col.key}>
                  {col.label}
                  <span className="sort-icon" aria-hidden="true">⇅</span>
                </th>
              ))}
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={checked.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    aria-label={`Select ${row.id}`}
                  />
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.key}>{renderCell(col, row)}</td>
                ))}
                <td className="col-actions">
                  <button type="button" className="kebab" aria-label={`Actions for ${row.id}`} onClick={() => onOpenOrder(row)}>
                    ⋮
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="table-empty">No purchases match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>
          Showing <strong>{rows.length === 0 ? 0 : 1}–{rows.length}</strong> of {rows.length}
        </span>
        <div className="rows-per-page">
          <span className="rows-per-page-select">
            Rows per page 25
            <span className="rows-per-page-caret" aria-hidden="true">▾</span>
          </span>
          <div className="pagination-arrows">
            <button type="button" disabled aria-label="Previous page">‹</button>
            <button type="button" disabled aria-label="Next page">›</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MarketplaceTable({ rows, onAddToOrder }) {
  return (
    <div className="card">
      <table className="plain-table">
        <thead>
          <tr>
            <th scope="col">Add-on</th>
            <th scope="col">Category</th>
            <th scope="col">Price</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{row.category}</td>
              <td><span className="requested-link">{row.price}</span></td>
              <td>
                <button type="button" className="btn-toolbar" onClick={() => onAddToOrder(row)}>
                  Add to order
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AddonsTable({ rows }) {
  return (
    <div className="card">
      <table className="plain-table">
        <thead>
          <tr>
            <th scope="col">Active add-on</th>
            <th scope="col">Since</th>
            <th scope="col">Monthly</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{row.since}</td>
              <td><span className="requested-link">{row.monthly}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ORDER_STATUSES = ['provisioned', 'pending', 'cancelled']

function OrderDetailsDrawer({ order, onCancel, onSave }) {
  const [form, setForm] = useState({
    item: order.item,
    qty: String(order.qty),
    status: order.status,
    requestedBy: order.requestedBy,
    date: order.date
  })

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="order-details-title">{order.id}</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <h3 className="drawer-section-heading">Order</h3>

          <div className="modal-field">
            <label className="modal-label" htmlFor="od-item">Item</label>
            <input
              id="od-item"
              type="text"
              className="modal-input"
              value={form.item}
              onChange={(e) => setField('item', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="od-qty">Quantity</label>
            <input
              id="od-qty"
              type="text"
              className="modal-input"
              value={form.qty}
              onChange={(e) => setField('qty', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="od-status">Status</label>
            <select
              id="od-status"
              className="modal-select"
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
            >
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="od-requested-by">Requested by</label>
            <input
              id="od-requested-by"
              type="text"
              className="modal-input"
              value={form.requestedBy}
              onChange={(e) => setField('requestedBy', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="od-date">Date</label>
            <input
              id="od-date"
              type="text"
              className="modal-input"
              value={form.date}
              onChange={(e) => setField('date', e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              onSave(order.id, {
                item: form.item,
                qty: Number(form.qty) || 0,
                status: form.status,
                requestedBy: form.requestedBy,
                date: form.date
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

const PRODUCTS = ['MCM CX 1', 'MCM CX 2', 'MCM CX 3 — WEM (Named)', 'AI Experience token pack']
const LICENCE_MODELS = ['Named', 'Concurrent']
const APPROVERS = ['Finance Director', 'Ops Director', 'IT Director']

function NewPurchaseDrawer({ onCancel, onSave }) {
  const [form, setForm] = useState({
    product: PRODUCTS[0],
    licenceModel: LICENCE_MODELS[0],
    quantity: '25',
    startDate: '01 Sep 2026',
    division: DIVISIONS[0],
    costCentre: 'CC-1180 Contact Centre',
    approver: APPROVERS[0],
    autoAssign: false
  })

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-purchase-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="new-purchase-title">New Purchase</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <h3 className="drawer-section-heading">Order</h3>

          <div className="modal-field">
            <label className="modal-label" htmlFor="np-product">Product</label>
            <select
              id="np-product"
              className="modal-select"
              value={form.product}
              onChange={(e) => setField('product', e.target.value)}
            >
              {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="np-licence">Licence model</label>
            <select
              id="np-licence"
              className="modal-select"
              value={form.licenceModel}
              onChange={(e) => setField('licenceModel', e.target.value)}
            >
              {LICENCE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="np-quantity">Quantity</label>
            <input
              id="np-quantity"
              type="text"
              className="modal-input"
              value={form.quantity}
              onChange={(e) => setField('quantity', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="np-start-date">Start date</label>
            <input
              id="np-start-date"
              type="text"
              className="modal-input"
              value={form.startDate}
              onChange={(e) => setField('startDate', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="np-division">Division</label>
            <select
              id="np-division"
              className="modal-select"
              value={form.division}
              onChange={(e) => setField('division', e.target.value)}
            >
              {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <h3 className="drawer-section-heading">Approval</h3>

          <div className="modal-field">
            <label className="modal-label" htmlFor="np-cost-centre">Cost centre</label>
            <input
              id="np-cost-centre"
              type="text"
              className="modal-input"
              value={form.costCentre}
              onChange={(e) => setField('costCentre', e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="np-approver">Approver</label>
            <select
              id="np-approver"
              className="modal-select"
              value={form.approver}
              onChange={(e) => setField('approver', e.target.value)}
            >
              {APPROVERS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <label className="toggle-row">
            <span className="toggle-switch">
              <input
                type="checkbox"
                checked={form.autoAssign}
                onChange={(e) => setField('autoAssign', e.target.checked)}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </span>
            <span>Auto-assign licences on provisioning</span>
          </label>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  )
}

function Purchases() {
  const [activeTab, setActiveTab] = useState('Orders')
  const [isCreating, setIsCreating] = useState(false)
  const [orders, setOrders] = useState([])
  const [marketplaceAddons, setMarketplaceAddons] = useState([])
  const [activeAddons, setActiveAddons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Any')
  const [viewingOrder, setViewingOrder] = useState(null)
  const [hiddenColumns, setHiddenColumns] = useState(() => new Set())

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiGet('/purchases/orders'),
      apiGet('/purchases/marketplace'),
      apiGet('/purchases/addons')
    ])
      .then(([ordersRes, marketplaceRes, addonsRes]) => {
        if (cancelled) return
        setOrders(ordersRes.map(mapOrder))
        setMarketplaceAddons(marketplaceRes)
        setActiveAddons(addonsRes)
      })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const toggleColumn = (key) =>
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((row) => {
      const matchesSearch =
        !q ||
        row.id.toLowerCase().includes(q) ||
        row.item.toLowerCase().includes(q) ||
        row.requestedBy.toLowerCase().includes(q)
      const matchesDivision = divisionFilter === 'All' || row.division === divisionFilter
      const matchesStatus = statusFilter === 'Any' || row.status === statusFilter
      return matchesSearch && matchesDivision && matchesStatus
    })
  }, [orders, search, divisionFilter, statusFilter])

  const handleSave = async (form) => {
    try {
      const row = await apiPost('/purchases/orders', form)
      setOrders((prev) => [mapOrder(row), ...prev])
      setIsCreating(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdateOrder = async (orderId, updated) => {
    try {
      const row = await apiPatch(`/purchases/orders/${orderId}`, updated)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? mapOrder(row) : o)))
      setViewingOrder(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddToOrder = async (addon) => {
    try {
      const row = await apiPost(`/purchases/marketplace/${addon.id}/add-to-order`, {})
      setOrders((prev) => [mapOrder(row), ...prev])
      setActiveTab('Orders')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleExport = () => {
    downloadCsv(
      'purchases-orders.csv',
      ['Order', 'Item', 'Quantity', 'Status', 'Requested by', 'Date', 'Division'],
      filteredRows.map((row) => [row.id, row.item, row.qty, STATUS_LABEL[row.status], row.requestedBy, row.date, row.division])
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
        <h1 className="page-title">Purchases</h1>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => setIsCreating(true)}>
            + New Purchase
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExport}>Export</button>
        </div>
      </div>

      {error && <p className="page-note" style={{ color: '#c0392b' }}>Couldn&rsquo;t load purchases: {error}</p>}

      {loading ? (
        <p className="page-note">Loading purchases…</p>
      ) : (
        <>
          <div className="page-tabs" role="tablist" aria-label="Purchases sections">
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

          {activeTab === 'Orders' && (
            <>
              <OrdersToolbar
                search={search}
                onSearch={setSearch}
                division={divisionFilter}
                onDivision={setDivisionFilter}
                status={statusFilter}
                onStatus={setStatusFilter}
                hiddenColumns={hiddenColumns}
                onToggleColumn={toggleColumn}
              />
              <OrdersTable rows={filteredRows} onOpenOrder={setViewingOrder} hiddenColumns={hiddenColumns} />
            </>
          )}

          {activeTab === 'Marketplace' && (
            <MarketplaceTable rows={marketplaceAddons} onAddToOrder={handleAddToOrder} />
          )}

          {activeTab === 'Add-ons' && <AddonsTable rows={activeAddons} />}
        </>
      )}

      {isCreating && <NewPurchaseDrawer onCancel={() => setIsCreating(false)} onSave={handleSave} />}

      {viewingOrder && (
        <OrderDetailsDrawer
          order={viewingOrder}
          onCancel={() => setViewingOrder(null)}
          onSave={handleUpdateOrder}
        />
      )}
    </div>
  )
}

export default Purchases
