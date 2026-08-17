import { useMemo, useState } from "react";
import ColumnsDrawer from "../people/ColumnsDrawer.jsx";
import StatusFilterChip from "../people/StatusFilterChip.jsx";
import InstallIntegrationDrawer from "./InstallIntegrationDrawer.jsx";
import { downloadCsv } from "../../utils/csv.js";

const INTEGRATIONS = [
  { id: 1, name: "Salesforce", category: "CRM", type: "Client application + Data actions", credentials: "OAuth — sf-prod", usedBy: "Architect, Agent UI", status: "Active" },
  { id: 2, name: "Microsoft Teams", category: "Collaboration", type: "Directory presence sync", credentials: "OAuth — entra", usedBy: "Directory", status: "Active" },
  { id: 3, name: "ServiceNow", category: "ITSM", type: "Data actions", credentials: "Basic auth — snow-int", usedBy: "Architect, Scripts", status: "Active" },
  { id: 4, name: "Web Services Data Actions", category: "Custom", type: "Data actions", credentials: "Static — api-key", usedBy: "Architect, Scripts", status: "Active" },
  { id: 5, name: "Amazon Lex V2", category: "Bot", type: "Bot connector", credentials: "AWS role", usedBy: "Architect", status: "Active" },
  { id: 6, name: "Google Dialogflow CX", category: "Bot", type: "Bot connector", credentials: "Service account", usedBy: "Architect", status: "Quota 82%" },
  { id: 7, name: "Zoom Phone", category: "Telephony", type: "Client application", credentials: "OAuth — zoom", usedBy: "Agent UI", status: "Disabled" },
  { id: 8, name: "Tableau Wallboard", category: "Analytics", type: "Client application", credentials: "Implicit grant", usedBy: "Supervisors", status: "Active" },
  { id: 9, name: "MCM Agent Copilot", category: "AI", type: "Native", credentials: "—", usedBy: "Agent UI", status: "Beta" },
];

const CATALOGUE_DATA = [
  { integration: "Salesforce CTI", category: "CRM" },
  { integration: "Microsoft Teams", category: "UC" },
  { integration: "Zendesk", category: "Ticketing" },
  { integration: "Power BI Export", category: "Analytics" },
];
const CLIENT_APPLICATIONS_DATA = [{ app: "Salesforce CTI", type: "Embedded client", status: "Active" }];
const CREDENTIALS_DATA = [{ credential: "sf-oauth-client", integration: "Salesforce CTI", rotated: "30 Jun 2026" }];

const TABS = ["Installed", "Catalogue", "Client Applications", "Credentials"];
const COLUMNS = ["Column 1", "Integration", "Category", "Type", "Credentials", "Used by", "Status", "Column 8"];
const STATUS_CLASS = { Active: "ok", Disabled: "of", Beta: "wn" };

function statusPill(status) {
  if (!status || status === "—") return <span style={{ color: "#a9b3c2" }}>—</span>;
  if (status.startsWith("Quota")) return <span className="st wn"><span className="d" />{status}</span>;
  const cls = STATUS_CLASS[status] || "of";
  return <span className={"st " + cls}><span className="d" />{status}</span>;
}

function formToRow(form, existingRow) {
  return {
    name: form.name.trim(),
    category: form.category,
    type: form.catalogue,
    credentials: form.credentialName.trim() || form.credentialType,
    usedBy: existingRow ? existingRow.usedBy : "0 agents",
    status: form.enabled ? "Active" : "Disabled",
  };
}

export default function IntegrationsPage({ onNavigate }) {
  const [tab, setTab] = useState("Installed");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hiddenCols, setHiddenCols] = useState(() => new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [list, setList] = useState(INTEGRATIONS);
  const [installOpen, setInstallOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);

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

  const statusValues = [...new Set(INTEGRATIONS.map((r) => r.status))];
  const filtered = useMemo(() => list.filter((r) =>
    (!q || (r.name + " " + r.category + " " + r.type).toLowerCase().includes(q.toLowerCase())) &&
    (!statusFilter || r.status === statusFilter)
  ), [list, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const rows = filtered.slice(start, start + rowsPerPage);

  function openInstall() { setEditingRow(null); setInstallOpen(true); }
  function openEdit(row) { setEditingRow(row); setInstallOpen(true); }
  function closeInstall() { setInstallOpen(false); setEditingRow(null); }

  function saveIntegration(form) {
    if (editingRow) {
      setList((prev) => prev.map((r) => (r.id === editingRow.id ? { ...formToRow(form, editingRow), id: editingRow.id } : r)));
      showToast("Integration saved");
    } else if (form.enabled) {
      const nextId = list.reduce((max, r) => Math.max(max, r.id), 0) + 1;
      setList((prev) => [...prev, { ...formToRow(form, null), id: nextId }]);
      showToast("Integration installed");
    }
    closeInstall();
  }

  function handleExport() {
    if (tab === "Catalogue") downloadCsv("integrations-catalogue.csv", ["Integration", "Category"], CATALOGUE_DATA.map((r) => [r.integration, r.category]));
    else if (tab === "Client Applications") downloadCsv("integrations-client-applications.csv", ["App", "Type", "Status"], CLIENT_APPLICATIONS_DATA.map((r) => [r.app, r.type, r.status]));
    else if (tab === "Credentials") downloadCsv("integrations-credentials.csv", ["Credential", "Integration", "Rotated"], CREDENTIALS_DATA.map((r) => [r.credential, r.integration, r.rotated]));
    else downloadCsv("integrations.csv", ["Integration", "Category", "Type", "Credentials", "Used by", "Status"], filtered.map((r) => [r.name, r.category, r.type, r.credentials, r.usedBy, r.status]));
    showToast("Exported to CSV");
  }

  return (
    <div className="pg legacy-shell">
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Integrations</div>
        <div className="tt">
          <h1>Integrations</h1>
          <div className="rt">
            <button className="btn" onClick={openInstall}>+ Install Integration</button>
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
        {tab === "Catalogue" ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Integration</th><th>Category</th><th /></tr></thead>
              <tbody>
                {CATALOGUE_DATA.map((r) => (
                  <tr key={r.integration}>
                    <td><b>{r.integration}</b></td>
                    <td>{r.category}</td>
                    <td style={{ textAlign: "right" }}><button className="btn sec" style={{ height: 28 }} onClick={openInstall}>Install</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "Client Applications" ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>App</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {CLIENT_APPLICATIONS_DATA.map((r) => (
                  <tr key={r.app}><td><b>{r.app}</b></td><td>{r.type}</td><td>{statusPill(r.status)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "Credentials" ? (
          <>
            <div style={{ fontSize: 12, color: "#5b6b82", margin: "0 0 10px" }}>
              Integration credentials are write-only: values are never displayed after saving.
            </div>
            <div className="tblw">
              <table className="dt">
                <thead><tr><th>Credential</th><th>Integration</th><th>Rotated</th></tr></thead>
                <tbody>
                  {CREDENTIALS_DATA.map((r) => (
                    <tr key={r.credential}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.credential}</td>
                      <td><b>{r.integration}</b></td>
                      <td>{r.rotated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="tbar">
              <input className="s" placeholder="Search integrations" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
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
                    {!hiddenCols.has(1) && <th>Integration ⇅</th>}
                    {!hiddenCols.has(2) && <th>Category ⇅</th>}
                    {!hiddenCols.has(3) && <th>Type ⇅</th>}
                    {!hiddenCols.has(4) && <th>Credentials ⇅</th>}
                    {!hiddenCols.has(5) && <th>Used by ⇅</th>}
                    {!hiddenCols.has(6) && <th>Status ⇅</th>}
                    {!hiddenCols.has(7) && <th style={{ width: 40 }} />}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8 - hiddenCols.size} style={{ textAlign: "center", color: "#8794a8", padding: 26 }}>No integrations match the current filters</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} onClick={() => openEdit(r)}>
                        {!hiddenCols.has(0) && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>}
                        {!hiddenCols.has(1) && <td><b className="lnk">{r.name}</b></td>}
                        {!hiddenCols.has(2) && <td>{r.category}</td>}
                        {!hiddenCols.has(3) && <td>{r.type}</td>}
                        {!hiddenCols.has(4) && <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.credentials}</td>}
                        {!hiddenCols.has(5) && <td>{r.usedBy}</td>}
                        {!hiddenCols.has(6) && <td>{statusPill(r.status)}</td>}
                        {!hiddenCols.has(7) && <td style={{ color: "#a9b3c2" }}>⋮</td>}
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

      {installOpen && (
        <InstallIntegrationDrawer
          open={installOpen}
          onClose={closeInstall}
          onSave={saveIntegration}
          initialForm={editingRow ? {
            catalogue: editingRow.type,
            name: editingRow.name,
            category: editingRow.category,
            credentialType: "OAuth 2.0",
            credentialName: editingRow.credentials,
            showIn: "Agent UI panel",
            permission: "All users",
            enabled: editingRow.status !== "Disabled",
          } : undefined}
        />
      )}
      {columnsOpen && <ColumnsDrawer columns={COLUMNS} hidden={hiddenCols} onToggle={toggleCol} onClose={() => setColumnsOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
