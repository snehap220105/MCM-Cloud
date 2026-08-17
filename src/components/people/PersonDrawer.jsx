import { useState } from "react";

const EMPTY = {
  name: "", email: "", title: "", dept: "", division: "d_home",
  license: "CX 2", roles: [], skills: {}, langs: ["English"],
  station: "WebRTC softphone", state: "Pending invite",
};

export default function PersonDrawer({ db, user, onClose, onSave, onDelete, onInvite, onResetPassword }) {
  const isNew = !user;
  const employeeRoleId = db.roles.find((r) => r.name === "Employee").id;
  const init = user
    ? { name: user.name, email: user.email, title: user.title, dept: user.dept, division: user.division, license: user.license, roles: user.roles, skills: { ...user.skills }, langs: [...user.langs], station: user.station, state: user.state }
    : { ...EMPTY, roles: [employeeRoleId] };

  const [form, setForm] = useState(init);
  const [errs, setErrs] = useState([]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggleRole(id) {
    if (id === employeeRoleId) return;
    setForm((f) => ({ ...f, roles: f.roles.includes(id) ? f.roles.filter((r) => r !== id) : [...f.roles, id] }));
  }
  function setSkill(name, v) {
    setForm((f) => {
      const skills = { ...f.skills };
      if (v > 0) skills[name] = v;
      else delete skills[name];
      return { ...f, skills };
    });
  }
  function toggleLang(name) {
    setForm((f) => ({ ...f, langs: f.langs.includes(name) ? f.langs.filter((l) => l !== name) : [...f.langs, name] }));
  }

  function handleSave() {
    const result = onSave(user ? user.id : null, form);
    if (result) setErrs(result);
  }

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? "Add Person" : "Edit — " + user.name}</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {errs.length > 0 && (
            <div className="perr" dangerouslySetInnerHTML={{ __html: errs.join("<br>") }} />
          )}

          <div className="sect">Identity</div>
          <div className="fld">
            <label>Full name *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="fld">
            <label>Email *</label>
            <input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="fld">
            <label>Title</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="fld">
            <label>Department</label>
            <input value={form.dept} onChange={(e) => set("dept", e.target.value)} />
          </div>

          <div className="sect">Access</div>
          <div className="fld">
            <label>Licence</label>
            <select value={form.license} onChange={(e) => set("license", e.target.value)}>
              {Object.keys(db.licenses).map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Home division</label>
            <select value={form.division} onChange={(e) => set("division", e.target.value)}>
              {db.divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Roles</label>
            {db.roles.map((r) => (
              <div className="tgl" key={r.id}>
                <input
                  type="checkbox"
                  disabled={r.id === employeeRoleId}
                  checked={r.id === employeeRoleId ? true : form.roles.includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                />
                {r.name}
                <span style={{ color: "#8794a8", fontSize: 11, marginLeft: 6 }}>{r.perms.length} perms</span>
              </div>
            ))}
          </div>

          <div className="sect">Contact Centre</div>
          <div className="fld">
            <label>ACD skills &amp; proficiency</label>
            {db.skills.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                <span style={{ flex: 1, fontSize: "12.5px" }}>{s.name}</span>
                <select
                  style={{ width: 110, height: 28, border: "1px solid #ccd4e0", borderRadius: 4 }}
                  value={form.skills[s.name] || 0}
                  onChange={(e) => setSkill(s.name, parseInt(e.target.value, 10))}
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n === 0 ? "Not assigned" : "Proficiency " + n}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="fld">
            <label>Languages</label>
            <div>
              {db.langs.map((l) => (
                <label key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: "0 12px 6px 0", fontSize: "12.5px" }}>
                  <input type="checkbox" style={{ width: "auto" }} checked={form.langs.includes(l.name)} onChange={() => toggleLang(l.name)} />
                  {l.name}
                </label>
              ))}
            </div>
          </div>
          <div className="fld">
            <label>Station type</label>
            <select value={form.station} onChange={(e) => set("station", e.target.value)}>
              {["WebRTC softphone", "Physical phone", "Remote station"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {!isNew && (
            <>
              <div className="sect">Account</div>
              <div className="fld">
                <label>Status</label>
                <select value={form.state} onChange={(e) => set("state", e.target.value)}>
                  {["Active", "Pending invite", "Inactive"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {user.state !== "Active" && (
                  <button className="btn sec" onClick={() => onInvite(user.id)}>Send invite</button>
                )}
                <button className="btn sec" onClick={() => onResetPassword(user.email)}>Reset password</button>
                <button className="btn gh" onClick={() => onDelete(user.id)}>Delete person</button>
              </div>
            </>
          )}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleSave}>{isNew ? "Create & invite" : "Save changes"}</button>
        </div>
      </div>
    </>
  );
}
