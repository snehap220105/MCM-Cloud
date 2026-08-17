import { useState } from "react";

export default function ClientDrawer({ onClose, onSave }) {
  const [restrictIp, setRestrictIp] = useState(false);
  const [rotateSecret, setRotateSecret] = useState(true);

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>Create Client</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          <div className="sect">Client</div>
          <div className="fld">
            <label>Name</label>
            <input defaultValue="" />
          </div>
          <div className="fld">
            <label>Description</label>
            <input defaultValue="" />
          </div>
          <div className="fld">
            <label>Grant type</label>
            <select defaultValue="Client Credentials">
              {["Client Credentials", "Code Authorization", "Implicit Grant", "SAML2 Bearer", "Token Implicit"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Token duration (seconds)</label>
            <input defaultValue="86400" />
          </div>

          <div className="sect">Scope</div>
          <div className="fld">
            <label>Roles</label>
            <select defaultValue="Integration Admin">
              {["Integration Admin", "Analytics Read", "Agent", "Supervisor", "WFM Read"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Divisions</label>
            <select defaultValue="All">
              {["All", "UK Retail", "UK Digital", "Partner — Manila"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Redirect URIs</label>
            <input defaultValue="https://app.mcmgroup.example/callback" />
          </div>

          <div className="tgl" onClick={() => setRestrictIp((v) => !v)}>
            <div className={"sw" + (restrictIp ? " on" : "")} />
            Restrict to listed IP ranges
          </div>
          <div className="tgl" onClick={() => setRotateSecret((v) => !v)}>
            <div className={"sw" + (rotateSecret ? " on" : "")} />
            Rotate secret every 90 days
          </div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={onSave}>Save</button>
        </div>
      </div>
    </>
  );
}
