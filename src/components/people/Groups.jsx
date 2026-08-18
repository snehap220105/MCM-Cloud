import { useRef, useState } from "react";
import { uid } from "./data.js";
import GroupDrawer from "./GroupDrawer.jsx";
import ConfirmBox from "./ConfirmBox.jsx";
import Toast from "./Toast.jsx";

export default function Groups({ db, setDb, onNavigate }) {
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

  const editingGroup = drawer && drawer.type === "edit" ? db.groupsList.find((g) => g.id === drawer.id) || null : null;

  function saveGroup(id, form) {
    const name = form.name.trim();
    const errs = [];
    if (name.length < 2) errs.push("Group name is required.");
    if (db.groupsList.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== id)) errs.push("Group name already exists.");
    const ext = form.ext.trim();
    if (ext && !/^\d{3,6}$/.test(ext)) errs.push("Group number must be 3–6 digits.");
    if (errs.length) return errs;

    const isNew = !id;
    setDb((d) => {
      if (isNew) {
        const g = { id: uid(), name, type: form.type, ext, ring: form.ring, vm: form.vm, members: form.members };
        return { ...d, groupsList: [...d.groupsList, g] };
      }
      return {
        ...d,
        groupsList: d.groupsList.map((g) =>
          g.id === id ? { ...g, name, type: form.type, ext, ring: form.ring, vm: form.vm, members: form.members } : g
        ),
      };
    });
    audit((isNew ? "Create" : "Edit") + " group", name);
    setDrawer(null);
    showToast(`Group saved — <b>${name}</b>`);
    return null;
  }

  function delGroup(id) {
    const g = db.groupsList.find((x) => x.id === id);
    if (!g) return;
    setConfirm({
      msg: `Delete group <b>${g.name}</b>?`,
      onYes: () => {
        setDb((d) => ({ ...d, groupsList: d.groupsList.filter((x) => x.id !== id) }));
        audit("Delete group", g.name);
        setDrawer(null);
        showToast("Group deleted");
      },
    });
  }

  return (
    <div className="pg legacy-shell">
      <div className="phd">
        <div className="bc">
          <a onClick={() => onNavigate('admin-hub')}>Admin</a> › Directory
        </div>
        <div className="tt">
          <h1>Groups</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawer({ type: "edit", id: null })}>+ Add Group</button>
          </div>
        </div>
        <div className="tabs">
          <div className="tb on">All Groups ({db.groupsList.length})</div>
        </div>
      </div>

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Group</th>
                <th>Type</th>
                <th>Members</th>
                <th>Group number</th>
                <th>Ring style</th>
                <th>Voicemail</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {db.groupsList.map((g) => (
                <tr key={g.id} onClick={() => setDrawer({ type: "edit", id: g.id })}>
                  <td><b className="lnk">{g.name}</b></td>
                  <td><span className={"tag" + (g.type === "Social" ? " o" : "")}>{g.type}</span></td>
                  <td>{g.members.length}</td>
                  <td>{g.ext || "—"}</td>
                  <td>{g.ring || "—"}</td>
                  <td>{g.vm ? "Yes" : "No"}</td>
                  <td style={{ color: "#a9b3c2" }}>⋮</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && drawer.type === "edit" && (
        <GroupDrawer
          db={db}
          group={editingGroup}
          onClose={() => setDrawer(null)}
          onSave={saveGroup}
          onDelete={delGroup}
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
