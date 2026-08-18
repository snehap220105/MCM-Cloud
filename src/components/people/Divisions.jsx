import { useRef, useState } from "react";
import { uid } from "./data.js";
import DivisionDrawer from "./DivisionDrawer.jsx";
import ConfirmBox from "./ConfirmBox.jsx";
import Toast from "./Toast.jsx";

export default function Divisions({ db, setDb, onNavigate }) {
  const [drawer, setDrawer] = useState(null); // {type:'edit', id}
  const [confirm, setConfirm] = useState(null);
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

  function usersInDiv(did) {
    return db.users.filter((u) => u.division === did);
  }

  const editingDiv = drawer && drawer.type === "edit" ? db.divisions.find((x) => x.id === drawer.id) || null : null;

  function saveDivision(id, form) {
    const name = form.name.trim();
    const errs = [];
    if (name.length < 2) errs.push("Division name is required.");
    if (db.divisions.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== id)) errs.push("A division with this name already exists.");
    if (!id && db.divisions.length >= 50) errs.push("Division limit reached (50).");
    if (errs.length) return errs;

    const isNew = !id;
    let finalName = name;
    setDb((d) => {
      if (isNew) {
        const nd = { id: uid(), name, desc: form.desc.trim() };
        return { ...d, divisions: [...d.divisions, nd] };
      }
      return {
        ...d,
        divisions: d.divisions.map((x) => {
          if (x.id !== id) return x;
          finalName = x.home ? x.name : name;
          return { ...x, name: finalName, desc: form.desc.trim() };
        }),
      };
    });
    audit(isNew ? "Create division" : "Edit division", finalName);
    setDrawer(null);
    showToast((isNew ? "Division created — " : "Saved — ") + `<b>${finalName}</b>`);
    return null;
  }

  function delDivision(id) {
    const d = db.divisions.find((x) => x.id === id);
    if (!d || d.home) return;
    const n = usersInDiv(id).length;
    setConfirm({
      msg: `Delete division <b>${d.name}</b>?` + (n ? ` <b>${n}</b> user(s) will be moved to the Home division.` : ""),
      onYes: () => {
        setDb((db2) => ({
          ...db2,
          users: db2.users.map((u) => (u.division === id ? { ...u, division: "d_home" } : u)),
          divisions: db2.divisions.filter((x) => x.id !== id),
        }));
        audit("Delete division", d.name + (n ? ` (${n} users moved to Home)` : ""));
        setDrawer(null);
        showToast("Division deleted" + (n ? ` — ${n} users moved to Home` : ""));
      },
    });
  }

  return (
    <div className="pg legacy-shell">
      <div className="phd">
        <div className="bc">
          <a onClick={() => onNavigate('admin-hub')}>Admin</a> › People &amp; Permissions
        </div>
        <div className="tt">
          <h1>Divisions</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawer({ type: "edit", id: null })}>+ Add Division</button>
          </div>
        </div>
        <div className="tabs">
          <div className="tb on">All Divisions ({db.divisions.length}/50)</div>
        </div>
      </div>

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Division</th>
                <th>Description</th>
                <th>Users</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {db.divisions.map((d) => (
                <tr key={d.id} onClick={() => setDrawer({ type: "edit", id: d.id })}>
                  <td>
                    <b className="lnk">{d.name}</b>
                    {d.home && <span className="tag" style={{ marginLeft: 6 }}>Home</span>}
                  </td>
                  <td>{d.desc || ""}</td>
                  <td>{usersInDiv(d.id).length}</td>
                  <td style={{ color: "#a9b3c2" }}>⋮</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && drawer.type === "edit" && (
        <DivisionDrawer
          division={editingDiv}
          members={editingDiv ? usersInDiv(editingDiv.id) : []}
          onClose={() => setDrawer(null)}
          onSave={saveDivision}
          onDelete={delDivision}
        />
      )}
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
