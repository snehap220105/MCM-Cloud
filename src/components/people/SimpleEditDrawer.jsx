import { useState } from "react";

export default function SimpleEditDrawer({ label, item, onClose, onSave }) {
  const isNew = !item;
  const [name, setName] = useState(item ? item.name : "");
  const [desc, setDesc] = useState(item ? item.desc || "" : "");
  const [errs, setErrs] = useState([]);

  function handleSave() {
    const result = onSave(item ? item.id : null, { name, desc });
    if (result) setErrs(result);
  }

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw" style={{ height: "auto", top: "25%", bottom: "auto", borderRadius: "8px 0 0 8px" }}>
        <div className="dh">
          <h2>{isNew ? "Add " + label : "Edit " + label}</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {errs.length > 0 && <div className="perr" dangerouslySetInnerHTML={{ __html: errs.join("<br>") }} />}
          <div className="fld">
            <label>{label} name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld">
            <label>Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </>
  );
}
