import { useRef, useState } from "react";
import Toast from "./Toast.jsx";

function divName(db, id) {
  const d = db.divisions.find((x) => x.id === id);
  return d ? d.name : "—";
}

function StatusPill({ state }) {
  if (state === "Active")
    return (
      <span className="st ok">
        <span className="d" />
        Active
      </span>
    );
  if (state === "Pending invite")
    return (
      <span className="st wn">
        <span className="d" />
        Pending invite
      </span>
    );
  return (
    <span className="st" style={{ color: "#8a94a6" }}>
      <span className="d" style={{ background: "#8a94a6" }} />
      Inactive
    </span>
  );
}

export default function Licences({ db, setDb, onNavigate }) {
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  function audit(act, obj) {
    setDb((d) => ({
      ...d,
      audit: [{ t: new Date().toLocaleString("en-GB"), who: "Faisal Khan", act, obj }, ...d.audit].slice(0, 200),
    }));
  }

  function setLic(id, lic) {
    const u = db.users.find((x) => x.id === id);
    if (!u) return;
    const old = u.license;
    setDb((d) => ({ ...d, users: d.users.map((x) => (x.id === id ? { ...x, license: lic } : x)) }));
    audit("Change licence", `${u.name}: ${old} → ${lic}`);
    showToast(`<b>${u.name}</b> moved to <b>${lic}</b>`);
  }

  const counts = {};
  Object.keys(db.licenses).forEach((l) => (counts[l] = 0));
  db.users.forEach((u) => {
    if (counts[u.license] !== undefined) counts[u.license]++;
  });

  return (
    <div className="pg legacy-shell">
      <div className="phd">
        <div className="bc">
          <a onClick={() => onNavigate('admin-hub')}>Admin</a> › People &amp; Permissions
        </div>
        <div className="tt">
          <h1>Licence Assignment</h1>
          <div className="rt">
            <button className="btn sec" onClick={() => onNavigate("subscription")}>View subscription</button>
          </div>
        </div>
        <div className="tabs">
          <div className="tb on">Seats</div>
        </div>
      </div>

      <div className="pbody">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          {Object.keys(db.licenses).map((l) => {
            const used = counts[l];
            const tot = db.licenses[l];
            const over = used > tot;
            const pct = Math.min(100, Math.round((used / tot) * 100));
            const barColor = over ? "#d0342c" : used / tot > 0.9 ? "#e0a200" : "#1f9d63";
            return (
              <div key={l} style={{ flex: 1, minWidth: 150, background: "#fff", border: "1px solid #dde3ec", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7a90", textTransform: "uppercase", letterSpacing: ".5px" }}>{l}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: over ? "#b3261e" : "#152550", margin: "4px 0 2px" }}>{used} / {tot}</div>
                <div style={{ fontSize: "11.5px", color: over ? "#b3261e" : "#8794a8" }}>{over ? "Over-assigned!" : "seats assigned"}</div>
                <div style={{ height: 5, background: "#eef1f6", borderRadius: 3, marginTop: 8 }}>
                  <div style={{ height: 5, borderRadius: 3, width: pct + "%", background: barColor }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>User</th>
                <th>Division</th>
                <th>Status</th>
                <th>Licence</th>
              </tr>
            </thead>
            <tbody>
              {db.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    <br />
                    <span style={{ color: "#8794a8", fontSize: 11 }}>{u.email}</span>
                  </td>
                  <td>{divName(db, u.division)}</td>
                  <td><StatusPill state={u.state} /></td>
                  <td>
                    <select
                      style={{ height: 30, border: "1px solid #ccd4e0", borderRadius: 4 }}
                      value={u.license}
                      onChange={(e) => setLic(u.id, e.target.value)}
                    >
                      {Object.keys(db.licenses).map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <Toast html={toast} />}
    </div>
  );
}
