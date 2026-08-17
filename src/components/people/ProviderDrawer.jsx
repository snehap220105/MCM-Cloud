import { useState } from "react";

export default function ProviderDrawer({ onClose, onSave }) {
  const [fallback, setFallback] = useState(false);
  const [autoProvision, setAutoProvision] = useState(true);
  const [signRequests, setSignRequests] = useState(true);

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>Configure Provider</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          <div className="sect">Identity provider</div>
          <div className="fld">
            <label>Provider</label>
            <select defaultValue="Microsoft Entra ID">
              {["Microsoft Entra ID", "Okta", "PingFederate", "ADFS", "Generic SAML"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Display name</label>
            <input defaultValue="Sign in with Entra ID" />
          </div>

          <div className="sect">SAML settings</div>
          <div className="fld">
            <label>Issuer URI</label>
            <input defaultValue="https://sts.windows.net/8f14e45f/" />
          </div>
          <div className="fld">
            <label>Target URL (SSO endpoint)</label>
            <input defaultValue="https://login.microsoftonline.com/.../saml2" />
          </div>
          <div className="fld">
            <label>Certificate</label>
            <input defaultValue="entra-signing-2026.cer" />
          </div>
          <div className="fld">
            <label>NameID format</label>
            <select defaultValue="emailAddress">
              {["emailAddress", "persistent", "unspecified"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="sect">Behaviour</div>
          <div className="tgl" onClick={() => setFallback((v) => !v)}>
            <div className={"sw" + (fallback ? " on" : "")} />
            Allow MCM password sign-in as fallback
          </div>
          <div className="tgl" onClick={() => setAutoProvision((v) => !v)}>
            <div className={"sw" + (autoProvision ? " on" : "")} />
            Auto-provision new users (SCIM)
          </div>
          <div className="tgl" onClick={() => setSignRequests((v) => !v)}>
            <div className={"sw" + (signRequests ? " on" : "")} />
            Sign authentication requests
          </div>
          <div className="fld">
            <label>Relying party identifier</label>
            <input defaultValue="https://login.mcmcloud.com" />
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
