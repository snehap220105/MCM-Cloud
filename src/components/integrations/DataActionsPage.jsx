import { useMemo, useState } from "react";
import ColumnsDrawer from "../people/ColumnsDrawer.jsx";
import StatusFilterChip from "../people/StatusFilterChip.jsx";
import CreateDataActionDrawer, { INTEGRATION_OPTIONS } from "./CreateDataActionDrawer.jsx";
import { downloadCsv } from "../../utils/csv.js";

const DATA_ACTIONS = [
  { id: 1, name: "CRM_Lookup_Customer", integration: "Salesforce", method: "GET", endpoint: "/services/data/v60.0/query", contract: "ani → tier, name, accountId", avgLatency: "410 ms", status: "Published" },
  { id: 2, name: "CRM_Create_Case", integration: "Salesforce", method: "POST", endpoint: "/services/data/v60.0/sobjects/Case", contract: "subject, desc → caseId", avgLatency: "620 ms", status: "Published" },
  { id: 3, name: "Verify_Account_PIN", integration: "Web Services Data Actions", method: "POST", endpoint: "https://api.mcmgroup.example/verify", contract: "accountId, pin → valid", avgLatency: "180 ms", status: "Published" },
  { id: 4, name: "Get_Invoice_Balance", integration: "Web Services Data Actions", method: "GET", endpoint: "https://api.mcmgroup.example/billing/{id}", contract: "accountId → balance, dueDate", avgLatency: "240 ms", status: "Published" },
  { id: 5, name: "SNOW_Open_Incident", integration: "ServiceNow", method: "POST", endpoint: "/api/now/table/incident", contract: "short_desc → number", avgLatency: "780 ms", status: "Published" },
  { id: 6, name: "SNOW_Get_Incident", integration: "ServiceNow", method: "GET", endpoint: "/api/now/table/incident", contract: "number → state, assignee", avgLatency: "350 ms", status: "Published" },
  { id: 7, name: "Post_Callback_Request", integration: "Web Services Data Actions", method: "POST", endpoint: "https://api.mcmgroup.example/callback", contract: "number, window → ref", avgLatency: "200 ms", status: "Published" },
  { id: 8, name: "Get_Delivery_Status", integration: "Web Services Data Actions", method: "GET", endpoint: "https://api.mcmgroup.example/track", contract: "orderId → status, eta", avgLatency: "1,240 ms", status: "Slow" },
  { id: 9, name: "Legacy_Balance_Lookup", integration: "Web Services Data Actions", method: "GET", endpoint: "https://legacy.mcm.local/bal", contract: "accountId → balance", avgLatency: "—", status: "Failing — 503" },
];

const CONTRACTS_DATA = [
  { contract: "GetContactByPhone", direction: "input", fields: "phone (string)" },
  { contract: "GetContactByPhone", direction: "output", fields: "name, tier, openCases" },
];
const RUN_HISTORY_DATA = [
  { when: "13:02", action: "GetContactByPhone", duration: "212 ms", result: "200 OK", cls: "ok" },
  { when: "12:47", action: "GetContactByPhone", duration: "1,904 ms", result: "Timeout retry", cls: "wn" },
];
const TEST_RESULT = { status: 200, name: "Oliver Smith", tier: "Gold", openCases: 1, balance: "£240.50" };

const TABS = ["Actions", "Contracts", "Test", "Run History"];
const COLUMNS = ["Column 1", "Action", "Integration", "Method", "Endpoint", "Contract", "Avg latency", "Status", "Column 9"];
const STATUS_CLASS = { Published: "ok", Slow: "wn", "Failing — 503": "er" };

function statusPill(status) {
  const cls = STATUS_CLASS[status] || "of";
  return <span className={"st " + cls}><span className="d" />{status}</span>;
}

function formToRow(form, existingRow) {
  const input = form.inputContract.trim();
  const output = form.outputContract.trim();
  const contract = input && output ? `${input} → ${output}` : input || output;
  return {
    name: form.name.trim(),
    integration: form.integration,
    method: form.method,
    endpoint: form.requestUrl.trim(),
    contract,
    avgLatency: existingRow ? existingRow.avgLatency : "—",
    status: existingRow ? existingRow.status : form.publishAfterSave ? "Published" : "Failing — 503",
  };
}

export default function DataActionsPage({ onNavigate }) {
  const [tab, setTab] = useState("Actions");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hiddenCols, setHiddenCols] = useState(() => new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [list, setList] = useState(DATA_ACTIONS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [testPhone, setTestPhone] = useState("+447700900101");
  const [testResult, setTestResult] = useState(null);

  function showToast(msg) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }

  function toggleCol(i) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  const statusValues = [...new Set(DATA_ACTIONS.map((r) => r.status))];
  const filtered = useMemo(() => list.filter((r) =>
    (!q || (r.name + " " + r.integration + " " + r.method + " " + r.endpoint).toLowerCase().includes(q.toLowerCase())) &&
    (!statusFilter || r.status === statusFilter)
  ), [list, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const rows = filtered.slice(start, start + rowsPerPage);

  function openCreate() { setEditingRow(null); setDrawerOpen(true); }
  function openEdit(row) { setEditingRow(row); setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); setEditingRow(null); }

  function saveAction(form) {
    if (editingRow) {
      setList((prev) => prev.map((r) => (r.id === editingRow.id ? { ...formToRow(form, editingRow), id: editingRow.id } : r)));
      showToast("Action saved");
    } else {
      const nextId = list.reduce((max, r) => Math.max(max, r.id), 0) + 1;
      setList((prev) => [...prev, { ...formToRow(form, null), id: nextId }]);
      showToast("Action created");
    }
    closeDrawer();
  }

  function handleExport() {
    downloadCsv("data-actions.csv", ["Action", "Integration", "Method", "Endpoint", "Contract", "Avg latency", "Status"],
      filtered.map((r) => [r.name, r.integration, r.method, r.endpoint, r.contract, r.avgLatency, r.status]));
    showToast("Exported to CSV");
  }

  return (
    <div className="pg legacy-shell">
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Integrations</div>
        <div className="tt">
          <h1>Data Actions</h1>
          <div className="rt">
            <button className="btn" onClick={openCreate}>+ Create Action</button>
            <button className="btn sec" onClick={handleExport}>Export</button>
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <div key={t} className={"tb" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
      </div>

      <div className="pbody">
        {tab === "Contracts" ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Contract</th><th>Direction</th><th>Fields</th></tr></thead>
              <tbody>
                {CONTRACTS_DATA.map((r, i) => (
                  <tr key={i}><td><b>{r.contract}</b> {r.direction}</td><td>{r.direction === "input" ? "→" : "←"}</td><td>{r.fields}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "Test" ? (
          <div style={{ maxWidth: 480 }}>
            <div style={{ fontSize: 12, color: "#5b6b82", marginBottom: 14 }}>Run the data action against the mock endpoint:</div>
            <div className="fld">
              <label>Input: phone</label>
              <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            </div>
            <button className="btn" style={{ marginBottom: 14 }} onClick={() => setTestResult(TEST_RESULT)}>Run action</button>
            {testResult && (
              <pre style={{ background: "#0f1c3f", color: "#e4e9f0", borderRadius: 8, padding: 16, fontSize: 12.5, overflowX: "auto" }}>
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>
        ) : tab === "Run History" ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>When</th><th>Action</th><th>Duration</th><th>Result</th></tr></thead>
              <tbody>
                {RUN_HISTORY_DATA.map((r, i) => (
                  <tr key={i}>
                    <td>{r.when}</td><td>{r.action}</td><td>{r.duration}</td>
                    <td><span className={"st " + r.cls}><span className="d" />{r.result}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="tbar">
              <input className="s" placeholder="Search data actions" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
              <select className="chip" value="All" onChange={() => {}}>
                <option>Division: All</option>
              </select>
              <StatusFilterChip label="Status" values={statusValues} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              <div className="sp" />
              <div className="chip" onClick={() => setColumnsOpen(true)}>⚙ Columns</div>
              <div className="chip" onClick={() => { setQ(""); setStatusFilter(""); }}>↻ Refresh</div>
            </div>

            <div className="tblw">
              <table className="dt">
                <thead>
                  <tr>
                    {!hiddenCols.has(0) && <th style={{ width: 34 }}><input type="checkbox" /></th>}
                    {!hiddenCols.has(1) && <th>Action ⇅</th>}
                    {!hiddenCols.has(2) && <th>Integration ⇅</th>}
                    {!hiddenCols.has(3) && <th>Method ⇅</th>}
                    {!hiddenCols.has(4) && <th>Endpoint ⇅</th>}
                    {!hiddenCols.has(5) && <th>Contract ⇅</th>}
                    {!hiddenCols.has(6) && <th>Avg latency ⇅</th>}
                    {!hiddenCols.has(7) && <th>Status ⇅</th>}
                    {!hiddenCols.has(8) && <th style={{ width: 40 }} />}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={9 - hiddenCols.size} style={{ textAlign: "center", color: "#8794a8", padding: 26 }}>No data actions match the current filters</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} onClick={() => openEdit(r)}>
                        {!hiddenCols.has(0) && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>}
                        {!hiddenCols.has(1) && <td><b className="lnk">{r.name}</b></td>}
                        {!hiddenCols.has(2) && <td>{r.integration}</td>}
                        {!hiddenCols.has(3) && <td>{r.method}</td>}
                        {!hiddenCols.has(4) && <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.endpoint}</td>}
                        {!hiddenCols.has(5) && <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.contract}</td>}
                        {!hiddenCols.has(6) && <td>{r.avgLatency}</td>}
                        {!hiddenCols.has(7) && <td>{statusPill(r.status)}</td>}
                        {!hiddenCols.has(8) && <td style={{ color: "#a9b3c2" }}>⋮</td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="pgr">
                <span>Showing <b>{filtered.length ? start + 1 + "–" + Math.min(start + rowsPerPage, filtered.length) : 0}</b> of <b>{filtered.length}</b></span>
                <div className="sp" />
                <span>Rows per page{" "}
                  <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }} style={{ border: "none", background: "transparent", fontWeight: 600 }}>
                    {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </span>
                <span style={{ display: "flex", gap: 4 }}>
                  <button className="btn sec" style={{ height: 26, padding: "0 8px" }} disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                  <button className="btn sec" style={{ height: 26, padding: "0 8px" }} disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {drawerOpen && (
        <CreateDataActionDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          onSave={saveAction}
          initialForm={editingRow ? {
            name: editingRow.name,
            integration: INTEGRATION_OPTIONS.includes(editingRow.integration) ? editingRow.integration : INTEGRATION_OPTIONS[0],
            category: "Customer lookup",
            method: editingRow.method,
            requestUrl: editingRow.endpoint,
            headers: "Content-Type: application/json",
            inputContract: (editingRow.contract || "").split("→")[0]?.trim() || "",
            outputContract: (editingRow.contract || "").split("→")[1]?.trim() || "",
            timeout: "4000",
            cacheResponses: false,
            publishAfterSave: editingRow.status !== "Failing — 503",
          } : undefined}
        />
      )}
      {columnsOpen && <ColumnsDrawer columns={COLUMNS} hidden={hiddenCols} onToggle={toggleCol} onClose={() => setColumnsOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
