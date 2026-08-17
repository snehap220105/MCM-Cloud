import { useRef, useState } from "react";
import { uid } from "./data.js";
import RoleDrawer from "./RoleDrawer.jsx";
import ConfirmBox from "./ConfirmBox.jsx";
import Toast from "./Toast.jsx";

export default function Roles({ db, setDb, onNavigate }) {
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

  function usersInRole(rid) {
    return db.users.filter((u) => u.roles.indexOf(rid) > -1);
  }

  const editingRole = drawer && drawer.type === "edit" ? db.roles.find((r) => r.id === drawer.id) || null : null;

  function saveRole(id, form) {
    const name = form.name.trim();
    const errs = [];
    if (name.length < 2) errs.push("Role name is required.");
    if (db.roles.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== id)) errs.push("A role with this name already exists.");
    if (!form.perms.length) errs.push("Select at least one permission.");
    if (errs.length) return errs;

    const isNew = !id;
    let finalName = name;
    setDb((d) => {
      if (isNew) {
        const r = { id: uid(), base: false, name, desc: form.desc.trim(), perms: form.perms };
        return { ...d, roles: [...d.roles, r] };
      }
      return {
        ...d,
        roles: d.roles.map((r) => {
          if (r.id !== id) return r;
          finalName = r.base ? r.name : name;
          return { ...r, name: finalName, desc: form.desc.trim(), perms: form.perms };
        }),
      };
    });
    audit(isNew ? "Create role" : "Edit role", `${finalName} (${form.perms.length} permissions)`);
    setDrawer(null);
    showToast((isNew ? "Role created — " : "Role saved — ") + `<b>${finalName}</b>`);
    return null;
  }

  function copyRole(id) {
    const r = db.roles.find((x) => x.id === id);
    if (!r) return;
    const n = { id: uid(), name: "Copy of " + r.name, desc: r.desc, base: false, perms: r.perms.slice() };
    setDb((d) => ({ ...d, roles: [...d.roles, n] }));
    audit("Copy role", `${r.name} → ${n.name}`);
    setDrawer(null);
    showToast(`Role copied — now edit <b>${n.name}</b>`);
  }

  function dropRole(userId, roleId) {
    setDb((d) => ({
      ...d,
      users: d.users.map((u) => (u.id === userId ? { ...u, roles: u.roles.filter((x) => x !== roleId) } : u)),
    }));
    setDrawer((dw) => (dw ? { ...dw } : dw));
  }

  function delRole(id) {
    const r = db.roles.find((x) => x.id === id);
    if (!r) return;
    const m = usersInRole(id).length;
    setConfirm({
      msg: `Delete role <b>${r.name}</b>?` + (m ? ` It is assigned to <b>${m}</b> user(s); the assignment will be removed.` : ""),
      onYes: () => {
        setDb((d) => ({
          ...d,
          roles: d.roles.filter((x) => x.id !== id),
          users: d.users.map((u) => ({ ...u, roles: u.roles.filter((x) => x !== id) })),
        }));
        audit("Delete role", r.name);
        setDrawer(null);
        showToast("Role deleted");
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
          <h1>Roles / Permissions</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawer({ type: "edit", id: null })}>+ Add Role</button>
          </div>
        </div>
        <div className="tabs">
          <div className="tb on">Roles</div>
        </div>
      </div>

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Type</th>
                <th>Permissions</th>
                <th>Members</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {db.roles.map((r) => {
                const m = usersInRole(r.id).length;
                return (
                  <tr key={r.id} onClick={() => setDrawer({ type: "edit", id: r.id })}>
                    <td><b className="lnk">{r.name}</b></td>
                    <td>{r.desc}</td>
                    <td>{r.base ? <span className="tag">Base</span> : <span className="tag o">Custom</span>}</td>
                    <td>{r.perms.length}</td>
                    <td>{m}</td>
                    <td style={{ color: "#a9b3c2" }}>⋮</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && drawer.type === "edit" && (
        <RoleDrawer
          role={editingRole}
          members={editingRole ? usersInRole(editingRole.id) : []}
          onClose={() => setDrawer(null)}
          onSave={saveRole}
          onDelete={delRole}
          onCopy={copyRole}
          onDropMember={dropRole}
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
