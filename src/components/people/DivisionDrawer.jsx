import { useState } from "react";

export default function DivisionDrawer({ division, members, onClose, onSave, onDelete }) {
  const isNew = !division;
  const [name, setName] = useState(division ? division.name : "");
  const [desc, setDesc] = useState(division ? division.desc || "" : "");
  const [errs, setErrs] = useState([]);

  function handleSave() {
    const result = onSave(division ? division.id : null, { name, desc });
    if (result) setErrs(result);
  }

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? "Add Division" : "Edit — " + division.name}</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {errs.length > 0 && <div className="perr" dangerouslySetInnerHTML={{ __html: errs.join("<br>") }} />}

          <div className="fld">
            <label>Name *</label>
            <input value={name} disabled={division && division.home} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld">
            <label>Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>

          {division && (
            <>
              <div className="sect">Users ({members.length})</div>
              {members.length ? (
                members.map((u) => (
                  <div key={u.id} style={{ padding: "3px 0", fontSize: "12.5px", borderBottom: "1px solid #f2f5f9" }}>
                    {u.name} <span style={{ color: "#8794a8" }}>{u.title || ""}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: "#8794a8", fontSize: 12 }}>No users in this division</div>
              )}
            </>
          )}

          {division && !division.home && (
            <div style={{ marginTop: 10 }}>
              <button className="btn gh" onClick={() => onDelete(division.id)}>Delete division</button>
            </div>
          )}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleSave}>{isNew ? "Create division" : "Save changes"}</button>
        </div>
      </div>
    </>
  );
}
