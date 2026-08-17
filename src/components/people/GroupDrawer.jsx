import { useState } from "react";

export default function GroupDrawer({ db, group, onClose, onSave, onDelete }) {
  const isNew = !group;
  const [name, setName] = useState(group ? group.name : "");
  const [type, setType] = useState(group ? group.type : "Official");
  const [ext, setExt] = useState(group ? group.ext : "");
  const [ring, setRing] = useState(group ? group.ring : "Broadcast");
  const [vm, setVm] = useState(group ? group.vm : true);
  const [members, setMembers] = useState(group ? [...group.members] : []);
  const [errs, setErrs] = useState([]);

  function toggleMember(id) {
    setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  function handleSave() {
    const result = onSave(group ? group.id : null, { name, type, ext, ring, vm, members });
    if (result) setErrs(result);
  }

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? "Add Group" : "Edit — " + group.name}</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {errs.length > 0 && <div className="perr" dangerouslySetInnerHTML={{ __html: errs.join("<br>") }} />}

          <div className="fld">
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {["Official", "Social"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="sect">Group ring</div>
          <div className="fld">
            <label>Group number / extension</label>
            <input value={ext} onChange={(e) => setExt(e.target.value)} placeholder="7100" />
          </div>
          <div className="fld">
            <label>Ring style</label>
            <select value={ring} onChange={(e) => setRing(e.target.value)}>
              {["Broadcast", "Sequential", "Rotary"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: "11.5px", color: "#8794a8", marginBottom: 8 }}>
            Broadcast alerts 15 members at a time; Sequential rings in ranked order; Rotary starts after the last answerer.
          </div>
          <div className="tgl">
            <input type="checkbox" checked={vm} onChange={(e) => setVm(e.target.checked)} style={{ width: "auto", marginRight: 4 }} />
            Enable group voicemail
          </div>

          <div className="sect">Members</div>
          {db.users.map((u) => (
            <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0", fontSize: "12.5px" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={members.includes(u.id)} onChange={() => toggleMember(u.id)} />
              {u.name}
            </label>
          ))}

          {!isNew && (
            <div style={{ marginTop: 10 }}>
              <button className="btn gh" onClick={() => onDelete(group.id)}>Delete group</button>
            </div>
          )}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </>
  );
}
