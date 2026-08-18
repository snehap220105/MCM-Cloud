import { useMemo, useRef, useState } from "react";
import { freshDB, uid } from "./data.js";
import PersonDrawer from "./PersonDrawer.jsx";
import CsvDrawer from "./CsvDrawer.jsx";
import AuditDrawer from "./AuditDrawer.jsx";
import ConfirmBox from "./ConfirmBox.jsx";
import Toast from "./Toast.jsx";

function divName(db, id) {
  const d = db.divisions.find((x) => x.id === id);
  return d ? d.name : "—";
}
function roleName(db, id) {
  const r = db.roles.find((x) => x.id === id);
  return r ? r.name : "—";
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

export default function People({ db, setDb, onNavigate }) {
  const [pf, setPf] = useState({ q: "", div: "", state: "", lic: "" });
  const [sort, setSort] = useState(null); // {key, dir}
  const [selP, setSelP] = useState({});
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState(null); // {type:'edit', id} | {type:'csv'} | {type:'audit'}
  const [confirm, setConfirm] = useState(null); // {msg, onYes}
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

  const list = useMemo(() => {
    let l = db.users.filter((u) => {
      if (pf.q && (u.name + " " + u.email + " " + u.title + " " + u.dept).toLowerCase().indexOf(pf.q.toLowerCase()) < 0)
        return false;
      if (pf.div && u.division !== pf.div) return false;
      if (pf.state && u.state !== pf.state) return false;
      if (pf.lic && u.license !== pf.lic) return false;
      return true;
    });
    if (sort) {
      l = l.slice().sort((a, b) => {
        const g = (u) =>
          (sort.key === "name" ? u.name : sort.key === "email" ? u.email : sort.key === "division" ? divName(db, u.division) : sort.key === "license" ? u.license : u.state).toLowerCase();
        const x = g(a), y = g(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
    }
    return l;
  }, [db, pf, sort]);

  const nSel = Object.values(selP).filter(Boolean).length;

  function sortP(key) {
    setSort((s) => (s && s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  }
  function arrow(key) {
    return sort && sort.key === key ? (sort.dir > 0 ? " ▲" : " ▼") : " ⇅";
  }
  function togSelP(id, v) {
    setSelP((s) => ({ ...s, [id]: v }));
  }
  function selAllP(v) {
    if (!v) return setSelP({});
    const s = {};
    db.users.forEach((u) => (s[u.id] = true));
    setSelP(s);
  }

  function bulkPeople(act) {
    const ids = Object.keys(selP).filter((k) => selP[k]);
    if (!ids.length) return;
    if (act === "delete") {
      setConfirm({
        msg: `Delete <b>${ids.length}</b> selected people? Their history is retained but they are removed from the directory.`,
        onYes: () => {
          setDb((d) => ({ ...d, users: d.users.filter((u) => ids.indexOf(u.id) < 0) }));
          audit("Bulk delete", ids.length + " users");
          setSelP({});
          showToast(ids.length + " people deleted");
        },
      });
      return;
    }
    setDb((d) => ({
      ...d,
      users: d.users.map((u) => {
        if (ids.indexOf(u.id) < 0) return u;
        if (act === "activate") return { ...u, state: "Active" };
        if (act === "deactivate") return { ...u, state: "Inactive" };
        if (act === "invite" && u.state !== "Active") return { ...u, state: "Pending invite" };
        return u;
      }),
    }));
    audit("Bulk " + act, ids.length + " users");
    setSelP({});
    showToast("Done — " + ids.length + " people updated");
  }

  function exportPeopleCsv() {
    const hdr = "name,email,title,department,division,license,roles,skills,state";
    const lines = db.users.map((u) =>
      [
        u.name, u.email, u.title, u.dept, divName(db, u.division), u.license,
        u.roles.map((r) => roleName(db, r)).join(";"),
        Object.keys(u.skills || {}).map((k) => k + ":" + u.skills[k]).join(";"),
        u.state,
      ]
        .map((x) => '"' + String(x).replace(/"/g, '""') + '"')
        .join(",")
    );
    const blob = new Blob([hdr + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mcm-people.csv";
    a.click();
    showToast("People exported to CSV");
  }

  function savePerson(id, form) {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const errs = [];
    if (name.length < 2) errs.push("Full name is required.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.push("A valid email address is required.");
    const dup = db.users.find((x) => x.email.toLowerCase() === email && x.id !== id);
    if (dup) errs.push("Email is already used by " + dup.name + ".");
    if (errs.length) return errs;

    const isNew = !id;
    setDb((d) => {
      if (isNew) {
        const u = {
          id: uid(), created: new Date().toLocaleString("en-GB"), state: "Pending invite",
          name, email, title: form.title.trim(), dept: form.dept.trim(),
          license: form.license, division: form.division, roles: form.roles,
          skills: form.skills, langs: form.langs, station: form.station,
        };
        return { ...d, users: [u, ...d.users] };
      }
      return {
        ...d,
        users: d.users.map((u) =>
          u.id === id
            ? {
                ...u, name, email, title: form.title.trim(), dept: form.dept.trim(),
                license: form.license, division: form.division, roles: form.roles,
                skills: form.skills, langs: form.langs, station: form.station,
                state: form.state || u.state,
              }
            : u
        ),
      };
    });
    audit(isNew ? "Create person" : "Edit person", `${name} <${email}>`);
    setDrawer(null);
    showToast(isNew ? `<b>${name}</b> created — invitation email queued` : `Changes saved for <b>${name}</b>`);
    return null;
  }

  function delPerson(id) {
    const u = db.users.find((x) => x.id === id);
    if (!u) return;
    setConfirm({
      msg: `Delete <b>${u.name}</b>? They are removed from the directory; interaction history is retained. Users in a custom division fall back to Home.`,
      onYes: () => {
        setDb((d) => ({ ...d, users: d.users.filter((x) => x.id !== id) }));
        audit("Delete person", u.name);
        setDrawer(null);
        showToast(`${u.name} deleted`);
      },
    });
  }

  function inviteUser(id) {
    const u = db.users.find((x) => x.id === id);
    if (!u) return;
    setDb((d) => ({ ...d, users: d.users.map((x) => (x.id === id ? { ...x, state: "Pending invite" } : x)) }));
    audit("Send invite", u.email);
    setDrawer(null);
    showToast(`Invitation sent to <b>${u.email}</b>`);
  }

  function runCsvImport(text) {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length && lines[0].toLowerCase().indexOf("name") === 0) lines.shift();
    const empRole = db.roles.find((r) => r.name === "Employee").id;
    const agentRole = db.roles.find((r) => r.name === "Agent").id;
    const created = [];
    const fail = [];
    const existingEmails = new Set(db.users.map((u) => u.email.toLowerCase()));

    lines.forEach((l, i) => {
      const c = l.split(",").map((x) => x.trim());
      const name = c[0] || "";
      const email = (c[1] || "").toLowerCase();
      if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        fail.push(`Row ${i + 1}: invalid name/email`);
        return;
      }
      if (existingEmails.has(email)) {
        fail.push(`Row ${i + 1}: ${email} already exists`);
        return;
      }
      existingEmails.add(email);
      const div = db.divisions.find((d) => d.name.toLowerCase() === (c[4] || "").toLowerCase());
      const skills = {};
      (c[6] || "").split(";").forEach((s) => {
        const p = s.split(":");
        if (p[0] && parseInt(p[1], 10) > 0) skills[p[0].trim()] = Math.min(5, parseInt(p[1], 10));
      });
      created.push({
        id: uid(), name, email, title: c[2] || "", dept: c[3] || "", division: div ? div.id : "d_home",
        roles: [empRole, agentRole], license: db.licenses[c[5]] !== undefined ? c[5] : "CX 1",
        skills, langs: ["English"], station: "WebRTC softphone", state: "Pending invite",
        created: new Date().toLocaleString("en-GB"),
      });
    });

    if (created.length) {
      setDb((d) => ({ ...d, users: [...created, ...d.users] }));
      audit("CSV import", `${created.length} users created, ${fail.length} rejected`);
      showToast(created.length + " people imported — invites queued");
    }
    return { ok: created.length, fail };
  }

  const divOpts = db.divisions;
  const licOpts = Object.keys(db.licenses);

  const editingUser = drawer && drawer.type === "edit" ? db.users.find((u) => u.id === drawer.id) || null : null;

  return (
    <div className="pg legacy-shell">
      <div className="phd">
        <div className="bc">
          <a onClick={() => onNavigate('admin-hub')}>Admin</a> › People &amp; Permissions
        </div>
        <div className="tt">
          <h1>People</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawer({ type: "edit", id: null })}>+ Add Person</button>
            <button className="btn sec" onClick={() => setDrawer({ type: "csv" })}>Bulk Import</button>
            <button className="btn sec" onClick={exportPeopleCsv}>Export CSV</button>
            <button className="btn sec" onClick={() => setDataMenuOpen((v) => !v)}>Data ▾</button>
            {dataMenuOpen && (
              <div className="ddm">
                <div className="ddi" onClick={() => { setDataMenuOpen(false); showToast("Configuration exported to <b>mcm-cloudcx-data.json</b>"); }}>
                  Export all data (JSON)
                </div>
                <div className="ddi" onClick={() => { setDataMenuOpen(false); showToast("Import data (JSON) — choose a file"); }}>
                  Import data (JSON)
                </div>
                <div className="ddi" onClick={() => { setDataMenuOpen(false); setDrawer({ type: "audit" }); }}>
                  View audit log
                </div>
                <div className="ddi" style={{ color: "#c9401a" }} onClick={() => { setDataMenuOpen(false); setConfirm({ msg: "Reset all demo data? Every change you made will be lost.", onYes: () => { setDb(freshDB()); setSelP({}); showToast("Demo data reset"); } }); }}>
                  Reset demo data
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="tabs">
          <div className="tb on">All People</div>
        </div>
      </div>

      <div className="pbody">
        {nSel > 0 && (
          <div className="bulkbar">
            <b style={{ fontSize: "12.5px" }}>{nSel} selected</b>
            <button className="btn sec" style={{ height: 28 }} onClick={() => bulkPeople("activate")}>Activate</button>
            <button className="btn sec" style={{ height: 28 }} onClick={() => bulkPeople("deactivate")}>Deactivate</button>
            <button className="btn sec" style={{ height: 28 }} onClick={() => bulkPeople("invite")}>Send invite</button>
            <button className="btn gh" style={{ height: 28 }} onClick={() => bulkPeople("delete")}>Delete</button>
          </div>
        )}

        <div className="tbar">
          <input
            className="s"
            placeholder="Search name, email, title, department"
            value={pf.q}
            onChange={(e) => setPf((f) => ({ ...f, q: e.target.value }))}
          />
          <select className="chip" value={pf.div} onChange={(e) => setPf((f) => ({ ...f, div: e.target.value }))}>
            <option value="">Division: All</option>
            {divOpts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select className="chip" value={pf.state} onChange={(e) => setPf((f) => ({ ...f, state: e.target.value }))}>
            <option value="">Status: Any</option>
            <option>Active</option>
            <option>Pending invite</option>
            <option>Inactive</option>
          </select>
          <select className="chip" value={pf.lic} onChange={(e) => setPf((f) => ({ ...f, lic: e.target.value }))}>
            <option value="">Licence: All</option>
            {licOpts.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <div className="sp" />
          <div className="chip" onClick={() => { setPf({ q: "", div: "", state: "", lic: "" }); }}>↻ Refresh</div>
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input type="checkbox" checked={nSel > 0 && nSel === db.users.length} onChange={(e) => selAllP(e.target.checked)} />
                </th>
                <th className="lnk" onClick={() => sortP("name")}>Name{arrow("name")}</th>
                <th className="lnk" onClick={() => sortP("email")}>Email{arrow("email")}</th>
                <th className="lnk" onClick={() => sortP("division")}>Division{arrow("division")}</th>
                <th className="lnk" onClick={() => sortP("license")}>Licence{arrow("license")}</th>
                <th>Roles</th>
                <th>Skills</th>
                <th className="lnk" onClick={() => sortP("state")}>Status{arrow("state")}</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "#8794a8", padding: 26 }}>
                    No people match the current filters
                  </td>
                </tr>
              ) : (
                list.map((u) => {
                  const rl = u.roles.map((r) => roleName(db, r)).filter((n) => n !== "Employee").join(", ") || "Employee";
                  const sk = Object.keys(u.skills || {}).length;
                  return (
                    <tr key={u.id} onClick={() => setDrawer({ type: "edit", id: u.id })}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={!!selP[u.id]} onChange={(e) => togSelP(u.id, e.target.checked)} />
                      </td>
                      <td>
                        <b className="lnk">{u.name}</b>
                        <br />
                        <span style={{ color: "#8794a8", fontSize: 11 }}>{u.title || ""}</span>
                      </td>
                      <td>{u.email}</td>
                      <td>{divName(db, u.division)}</td>
                      <td><span className="tag o">{u.license}</span></td>
                      <td style={{ maxWidth: 180 }}>{rl}</td>
                      <td>{sk ? sk + " skill" + (sk > 1 ? "s" : "") : "—"}</td>
                      <td><StatusPill state={u.state} /></td>
                      <td style={{ color: "#a9b3c2" }}>⋮</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="pgr">
            <span>Showing <b>{list.length}</b> of <b>{db.users.length}</b> people</span>
            <div className="sp" />
            <span>
              {db.users.filter((u) => u.state === "Active").length} active ·{" "}
              {db.users.filter((u) => u.state === "Pending invite").length} pending ·{" "}
              {db.users.filter((u) => u.state === "Inactive").length} inactive
            </span>
          </div>
        </div>
      </div>

      {drawer && drawer.type === "edit" && (
        <PersonDrawer
          db={db}
          user={editingUser}
          onClose={() => setDrawer(null)}
          onSave={savePerson}
          onDelete={delPerson}
          onInvite={inviteUser}
          onResetPassword={(email) => showToast(`Password reset email sent to ${email}`)}
        />
      )}
      {drawer && drawer.type === "csv" && (
        <CsvDrawer onClose={() => setDrawer(null)} onImport={runCsvImport} onDone={() => setDrawer(null)} />
      )}
      {drawer && drawer.type === "audit" && <AuditDrawer db={db} onClose={() => setDrawer(null)} />}
      {confirm && (
        <ConfirmBox
          msg={confirm.msg}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const fn = confirm.onYes; setConfirm(null); fn(); }}
        />
      )}
      {toast && <Toast html={toast} />}
    </div>
  );
}
