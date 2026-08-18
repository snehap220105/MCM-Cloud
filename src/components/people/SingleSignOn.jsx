import { useRef, useState } from "react";
import ProviderDrawer from "./ProviderDrawer.jsx";
import StatusFilterChip from "./StatusFilterChip.jsx";
import ColumnsDrawer from "./ColumnsDrawer.jsx";
import Toast from "./Toast.jsx";
import { exportTableCsv } from "./csvExport.js";

const PROVIDERS = [
  { name: "Microsoft Entra ID", type: "SAML 2.0", status: "Enabled", cls: "ok", expiry: "14 Feb 2027", users: "612", def: "Default" },
  { name: "Okta", type: "SAML 2.0", status: "Disabled", cls: "of", expiry: "—", users: "0", def: "—" },
  { name: "PingFederate", type: "SAML 2.0", status: "Not configured", cls: "of", expiry: "—", users: "0", def: "—" },
  { name: "ADFS", type: "SAML 2.0", status: "Not configured", cls: "of", expiry: "—", users: "0", def: "—" },
  { name: "Generic SAML", type: "SAML 2.0", status: "Not configured", cls: "of", expiry: "—", users: "0", def: "—" },
  { name: "SCIM provisioning", type: "SCIM 2.0", status: "Enabled", cls: "ok", expiry: "—", users: "612 synced", def: "—" },
  { name: "Entra ID — Partner tenant", type: "SAML 2.0", status: "Certificate expires in 21 days", cls: "wn", expiry: "30 Aug 2026", users: "48", def: "—" },
];

const TABS = ["Providers", "SCIM Provisioning", "Sign-in Policy"];
const COLUMNS = ["Column 1", "Provider", "Type", "Status", "Certificate expiry", "Users", "Default", "Column 8"];

export default function SingleSignOn({ onNavigate }) {
  const [tab, setTab] = useState("Providers");
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

  const statusValues = [...new Set(PROVIDERS.map((p) => p.status))];

  const rows = PROVIDERS.filter(
    (p) =>
      (!q || (p.name + " " + p.type).toLowerCase().indexOf(q.toLowerCase()) > -1) &&
      (!statusFilter || p.status.indexOf(statusFilter) > -1)
  );

  return (
    <div className="pg legacy-shell">
      <div className="phd">
        <div className="bc">
          <a onClick={() => onNavigate('admin-hub')}>Admin</a> › People &amp; Permissions
        </div>
        <div className="tt">
          <h1>Single Sign-on</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawerOpen(true)}>+ Configure Provider</button>
            <button
              className="btn sec"
              onClick={() => {
                const ok = exportTableCsv("sso.csv");
                showToast(ok ? "Page exported to <b>sso.csv</b>" : "No table on this page to export");
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
        {tab === "SCIM Provisioning" ? (
          <>
            <div style={{ fontSize: 12, color: "#5b6b82", margin: "0 0 10px", lineHeight: 1.6 }}>
              One-way sync from the identity provider into MCM Cloud CX. Changes made here can be overwritten at the next sync.
            </div>
            <div className="tblw">
              <table className="dt">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Mapping</th>
                    <th>Last sync</th>
                    <th>Result</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>Microsoft Entra ID</b></td>
                    <td>12 attributes · groups → roles</td>
                    <td>Today 06:00</td>
                    <td>
                      <span className="st ok">
                        <span className="d" />
                        12 users updated
                      </span>
                    </td>
                    <td>
                      <button className="btn sec" style={{ height: 26 }} onClick={() => showToast("SCIM sync started — users update within minutes")}>
                        Run sync now
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : tab === "Sign-in Policy" ? (
          <>
            <div className="tblw">
              <table className="dt">
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Allowed methods", "SSO (Entra ID) + native fallback"],
                    ["MFA", "Required for native logins"],
                    ["Session timeout", "60 minutes idle"],
                    ["Lockout", "6 failures → 5 minute lock"],
                  ].map((r) => (
                    <tr key={r[0]}>
                      <td><b>{r[0]}</b></td>
                      <td>{r[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: "#5b6b82", margin: "10px 0 0", lineHeight: 1.6 }}>
              Password rules are managed under Organization Settings › Security.
            </div>
          </>
        ) : (
          <>
            <div className="tbar">
              <input className="s" placeholder="Search single sign-on" value={q} onChange={(e) => setQ(e.target.value)} />
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
                    {!hiddenCols.has(1) && <th>Provider ⇅</th>}
                    {!hiddenCols.has(2) && <th>Type ⇅</th>}
                    {!hiddenCols.has(3) && <th>Status ⇅</th>}
                    {!hiddenCols.has(4) && <th>Certificate expiry ⇅</th>}
                    {!hiddenCols.has(5) && <th>Users ⇅</th>}
                    {!hiddenCols.has(6) && <th>Default ⇅</th>}
                    {!hiddenCols.has(7) && <th style={{ width: 40 }} />}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8 - hiddenCols.size} style={{ textAlign: "center", color: "#8794a8", padding: 26 }}>
                        No providers match the current filters
                      </td>
                    </tr>
                  ) : (
                    rows.map((p) => (
                      <tr key={p.name} onClick={() => setDrawerOpen(true)}>
                        {!hiddenCols.has(0) && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>}
                        {!hiddenCols.has(1) && <td><b className="lnk">{p.name}</b></td>}
                        {!hiddenCols.has(2) && <td>{p.type}</td>}
                        {!hiddenCols.has(3) && (
                          <td>
                            <span className={"st " + p.cls}>
                              <span className="d" />
                              {p.status}
                            </span>
                          </td>
                        )}
                        {!hiddenCols.has(4) && <td>{p.expiry}</td>}
                        {!hiddenCols.has(5) && <td>{p.users}</td>}
                        {!hiddenCols.has(6) && <td>{p.def === "Default" ? <span className="tag o">Default</span> : "—"}</td>}
                        {!hiddenCols.has(7) && <td style={{ color: "#a9b3c2" }}>⋮</td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="pgr">
                <span>Showing <b>{rows.length ? "1–" + rows.length : 0}</b> of <b>{PROVIDERS.length}</b></span>
                <div className="sp" />
                <span>Rows per page 25 ▾</span>
                <span>‹ ›</span>
              </div>
            </div>
          </>
        )}
      </div>

      {drawerOpen && (
        <ProviderDrawer
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
