import { useRef, useState } from "react";
import ClientDrawer from "./ClientDrawer.jsx";
import StatusFilterChip from "./StatusFilterChip.jsx";
import ColumnsDrawer from "./ColumnsDrawer.jsx";
import Toast from "./Toast.jsx";
import { exportTableCsv } from "./csvExport.js";

const CLIENTS = [
  { name: "MCM Integration Service", grant: "Client Credentials", id: "c4f1...9ab", scope: "Integration Admin (All divisions)", duration: "86,400 s", used: "Today 09:40", status: "Active", cls: "ok" },
  { name: "Salesforce Connector", grant: "Client Credentials", id: "7a20...1de", scope: "Data Action Runner", duration: "43,200 s", used: "Today 09:38", status: "Active", cls: "ok" },
  { name: "Supervisor Wallboard", grant: "Implicit Grant", id: "ee81...c07", scope: "Analytics Read (UK Retail)", duration: "3,600 s", used: "Today 09:12", status: "Active", cls: "ok" },
  { name: "WFM Data Export", grant: "Client Credentials", id: "1bb9...44a", scope: "WFM Read", duration: "86,400 s", used: "Today 04:00", status: "Active", cls: "ok" },
  { name: "Mobile Agent App", grant: "Code Authorization", id: "9df3...b62", scope: "Agent", duration: "7,200 s", used: "Yesterday", status: "Active", cls: "ok" },
  { name: "Legacy Reporting Job", grant: "Client Credentials", id: "5c77...20f", scope: "Analytics Read", duration: "86,400 s", used: "14 Apr 2026", status: "Disabled", cls: "of" },
  { name: "Partner API — Northstar", grant: "SAML2 Bearer", id: "a8e2...771", scope: "Agent (Partner — Manila)", duration: "3,600 s", used: "Today 02:15", status: "Secret rotation due", cls: "wn" },
];

const TABS = ["Clients", "Scopes", "Activity"];
const COLUMNS = ["Column 1", "Client name", "Grant type", "Client ID", "Roles / scope", "Token duration", "Last used", "Status", "Column 9"];

export default function OAuthClients({ onNavigate }) {
  const [tab, setTab] = useState("Clients");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hiddenCols, setHiddenCols] = useState(() => new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  function toggleCol(i) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const statusValues = [...new Set(CLIENTS.map((c) => c.status))];

  const rows = CLIENTS.filter(
    (c) =>
      (!q || (c.name + " " + c.grant + " " + c.scope).toLowerCase().indexOf(q.toLowerCase()) > -1) &&
      (!statusFilter || c.status.indexOf(statusFilter) > -1)
  );

  return (
    <div className="pg legacy-shell">
      <div className="phd">
        <div className="bc">
          <a onClick={() => onNavigate('admin-hub')}>Admin</a> › People &amp; Permissions
        </div>
        <div className="tt">
          <h1>OAuth Clients</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawerOpen(true)}>+ Create Client</button>
            <button
              className="btn sec"
              onClick={() => {
                const ok = exportTableCsv("oauth.csv");
                showToast(ok ? "Page exported to <b>oauth.csv</b>" : "No table on this page to export");
              }}
            >
              Export
            </button>
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <div key={t} className={"tb" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
      </div>

      <div className="pbody">
        {tab === "Scopes" ? (
          <div className="tblw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Grants</th>
                  <th>Used by</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["users:readonly", "Read user directory", "HR Sync Client"],
                  ["routing", "Manage queues & skills", "Provisioning API"],
                  ["conversations", "Read interactions", "BI Extract"],
                  ["recordings:readonly", "Download recordings", "QA Export"],
                ].map((r) => (
                  <tr key={r[0]}>
                    <td><code style={{ fontSize: 12 }}>{r[0]}</code></td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "Activity" ? (
          <div className="tblw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Last used</th>
                  <th>Calls (24h)</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["BI Extract", "02:00 today", "1,420", "0"],
                  ["HR Sync Client", "06:00 today", "96", "0"],
                  ["Provisioning API", "Yesterday", "12", "2"],
                ].map((r) => (
                  <tr key={r[0]}>
                    <td><b>{r[0]}</b></td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                    <td>{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="tbar">
              <input className="s" placeholder="Search oauth clients" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="chip" onClick={() => showToast('No "Division" column on this table — filter not applicable')}>Division: All ▾</div>
              <StatusFilterChip label="Status" values={statusValues} value={statusFilter} onChange={setStatusFilter} />
              <div className="sp" />
              <div className="chip" onClick={() => setColumnsOpen(true)}>⚙ Columns</div>
              <div className="chip" onClick={() => { setQ(""); setStatusFilter(""); }}>↻ Refresh</div>
            </div>

            <div className="tblw">
              <table className="dt">
                <thead>
                  <tr>
                    {!hiddenCols.has(0) && <th style={{ width: 34 }}><input type="checkbox" /></th>}
                    {!hiddenCols.has(1) && <th>Client name ⇅</th>}
                    {!hiddenCols.has(2) && <th>Grant type ⇅</th>}
                    {!hiddenCols.has(3) && <th>Client ID ⇅</th>}
                    {!hiddenCols.has(4) && <th>Roles / scope ⇅</th>}
                    {!hiddenCols.has(5) && <th>Token duration ⇅</th>}
                    {!hiddenCols.has(6) && <th>Last used ⇅</th>}
                    {!hiddenCols.has(7) && <th>Status ⇅</th>}
                    {!hiddenCols.has(8) && <th style={{ width: 40 }} />}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9 - hiddenCols.size} style={{ textAlign: "center", color: "#8794a8", padding: 26 }}>
                        No clients match the current filters
                      </td>
                    </tr>
                  ) : (
                    rows.map((c) => (
                      <tr key={c.name} onClick={() => setDrawerOpen(true)}>
                        {!hiddenCols.has(0) && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>}
                        {!hiddenCols.has(1) && <td><b className="lnk">{c.name}</b></td>}
                        {!hiddenCols.has(2) && <td>{c.grant}</td>}
                        {!hiddenCols.has(3) && <td>{c.id}</td>}
                        {!hiddenCols.has(4) && <td>{c.scope}</td>}
                        {!hiddenCols.has(5) && <td>{c.duration}</td>}
                        {!hiddenCols.has(6) && <td>{c.used}</td>}
                        {!hiddenCols.has(7) && (
                          <td>
                            <span className={"st " + c.cls}>
                              <span className="d" />
                              {c.status}
                            </span>
                          </td>
                        )}
                        {!hiddenCols.has(8) && <td style={{ color: "#a9b3c2" }}>⋮</td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="pgr">
                <span>Showing <b>{rows.length ? "1–" + rows.length : 0}</b> of <b>{CLIENTS.length}</b></span>
                <div className="sp" />
                <span>Rows per page 25 ▾</span>
                <span>‹ ›</span>
              </div>
            </div>
          </>
        )}
      </div>

      {drawerOpen && (
        <ClientDrawer
          onClose={() => setDrawerOpen(false)}
          onSave={() => { setDrawerOpen(false); showToast("Saved — prototype only"); }}
        />
      )}
      {columnsOpen && (
        <ColumnsDrawer
          columns={COLUMNS}
          hidden={hiddenCols}
          onToggle={toggleCol}
          onClose={() => setColumnsOpen(false)}
        />
      )}
      {toast && <Toast html={toast} />}
    </div>
  );
}
