import { useRef, useState } from "react";
import { uid } from "./data.js";
import SimpleEditDrawer from "./SimpleEditDrawer.jsx";
import ConfirmBox from "./ConfirmBox.jsx";
import Toast from "./Toast.jsx";

const TITLES = { skills: "ACD Skills", langs: "ACD Languages" };
const LABELS = { skills: "Skill", langs: "Language" };

export default function SimpleListPage({ kind, db, setDb, onNavigate }) {
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

  function assignedCount(name) {
    return db.users.filter((u) => (kind === "skills" ? u.skills && u.skills[name] : u.langs.indexOf(name) > -1)).length;
  }

  const list = db[kind];
  const editingItem = drawer && drawer.type === "edit" ? list.find((x) => x.id === drawer.id) || null : null;

  function saveItem(id, form) {
    const name = form.name.trim();
    if (name.length < 2 || list.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== id)) {
      return ["A unique name of at least 2 characters is required."];
    }
    const old = id ? (list.find((x) => x.id === id) || {}).name : null;
    setDb((d) => {
      let nextUsers = d.users;
      if (old && old !== name) {
        nextUsers = d.users.map((u) => {
          if (kind === "skills" && u.skills && u.skills[old] !== undefined) {
            const skills = { ...u.skills };
            skills[name] = skills[old];
            delete skills[old];
            return { ...u, skills };
          }
          if (kind === "langs") {
            const i = u.langs.indexOf(old);
            if (i > -1) {
              const langs = [...u.langs];
              langs[i] = name;
              return { ...u, langs };
            }
          }
          return u;
        });
      }
      const nextList = id
        ? d[kind].map((x) => (x.id === id ? { ...x, name, desc: form.desc.trim() } : x))
        : [...d[kind], { id: uid(), name, desc: form.desc.trim() }];
      return { ...d, users: nextUsers, [kind]: nextList };
    });
    audit((id ? "Edit " : "Create ") + (kind === "skills" ? "skill" : "language"), name);
    setDrawer(null);
    showToast(`Saved — <b>${name}</b>`);
    return null;
  }

  function delItem(id) {
    const s = list.find((x) => x.id === id);
    if (!s) return;
    const cnt = assignedCount(s.name);
    setConfirm({
      msg: `Delete <b>${s.name}</b>?` + (cnt ? ` It is assigned to <b>${cnt}</b> agent(s); the assignment will be removed.` : ""),
      onYes: () => {
        setDb((d) => ({
          ...d,
          [kind]: d[kind].filter((x) => x.id !== id),
          users: d.users.map((u) => {
            if (kind === "skills" && u.skills && u.skills[s.name] !== undefined) {
              const skills = { ...u.skills };
              delete skills[s.name];
              return { ...u, skills };
            }
            if (kind === "langs" && u.langs.indexOf(s.name) > -1) {
              return { ...u, langs: u.langs.filter((l) => l !== s.name) };
            }
            return u;
          }),
        }));
        audit("Delete " + (kind === "skills" ? "skill" : "language"), s.name);
        showToast("Deleted");
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
          <h1>{TITLES[kind]}</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawer({ type: "edit", id: null })}>+ Add</button>
          </div>
        </div>
        <div className="tabs">
          <div className="tb on">All</div>
        </div>
      </div>

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Assigned to</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const cnt = assignedCount(s.name);
                return (
                  <tr key={s.id}>
                    <td>
                      <b className="lnk" onClick={() => setDrawer({ type: "edit", id: s.id })}>{s.name}</b>
                    </td>
                    <td>{s.desc || ""}</td>
                    <td>{cnt} agent{cnt === 1 ? "" : "s"}</td>
                    <td style={{ width: 80 }}>
                      <a className="lnk" style={{ fontSize: 12 }} onClick={() => delItem(s.id)}>Delete</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && drawer.type === "edit" && (
        <SimpleEditDrawer
          label={LABELS[kind]}
          item={editingItem}
          onClose={() => setDrawer(null)}
          onSave={(id, form) => saveItem(id, form)}
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
