import { useState } from "react";
import { PERMS } from "./data.js";

export default function RoleDrawer({ role, members, onClose, onSave, onDelete, onCopy, onDropMember }) {
  const isNew = !role;
  const [name, setName] = useState(role ? role.name : "");
  const [desc, setDesc] = useState(role ? role.desc : "");
  const [perms, setPerms] = useState(role ? [...role.perms] : []);
  const [errs, setErrs] = useState([]);

  function togglePerm(full) {
    setPerms((p) => (p.includes(full) ? p.filter((x) => x !== full) : [...p, full]));
  }
  function permAll(dm, v) {
    const domainPerms = PERMS[dm].map((p) => dm + ":" + p);
    setPerms((cur) => {
      const rest = cur.filter((p) => !domainPerms.includes(p));
      return v ? [...rest, ...domainPerms] : rest;
    });
  }

  function handleSave() {
    const result = onSave(role ? role.id : null, { name, desc, perms });
    if (result) setErrs(result);
  }

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw" style={{ width: 560 }}>
        <div className="dh">
          <h2>
            {isNew ? "Add Role" : "Edit — " + role.name}
            {role && role.base && <span className="tag" style={{ marginLeft: 6 }}>Base</span>}
          </h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {errs.length > 0 && <div className="perr" dangerouslySetInnerHTML={{ __html: errs.join("<br>") }} />}

          <div className="sect">Role</div>
          <div className="fld">
            <label>Name *</label>
            <input value={name} disabled={role && role.base} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld">
            <label>Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>

          <div className="sect">Permissions (domain : entity : action)</div>
          {Object.keys(PERMS).map((dm) => (
            <div key={dm} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <b style={{ fontSize: "12.5px", textTransform: "uppercase", letterSpacing: ".4px", color: "#33425c" }}>{dm}</b>
                <a className="lnk" style={{ fontSize: 11 }} onClick={() => permAll(dm, true)}>all</a>
                <a className="lnk" style={{ fontSize: 11 }} onClick={() => permAll(dm, false)}>none</a>
              </div>
              {PERMS[dm].map((p) => {
                const full = dm + ":" + p;
                return (
                  <label key={full} style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: "0 10px 6px 0", fontSize: 12, fontFamily: "monospace" }}>
                    <input type="checkbox" style={{ width: "auto" }} checked={perms.includes(full)} onChange={() => togglePerm(full)} />
                    {p}
                  </label>
                );
              })}
            </div>
          ))}

          {role && (
            <>
              <div className="sect">Members ({members.length})</div>
              {members.length ? (
                members.map((u) => (
                  <div key={u.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f2f5f9", fontSize: "12.5px" }}>
                    <span>{u.name}</span>
                    <a className="lnk" style={{ fontSize: 11 }} onClick={() => onDropMember(u.id, role.id)}>remove</a>
                  </div>
                ))
              ) : (
                <div style={{ color: "#8794a8", fontSize: 12 }}>No members</div>
              )}
            </>
          )}

          {role && !role.base && (
            <div style={{ marginTop: 10 }}>
              <button className="btn gh" onClick={() => onDelete(role.id)}>Delete role</button>
            </div>
          )}
          {role && (
            <div style={{ marginTop: 8 }}>
              <button className="btn sec" onClick={() => onCopy(role.id)}>Copy as new role</button>
            </div>
          )}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleSave}>{isNew ? "Create role" : "Save changes"}</button>
        </div>
      </div>
    </>
  );
}
