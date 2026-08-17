import { useEffect, useRef, useState } from "react";

export const CATALOGUE_OPTIONS = ["AppFoundry", "Custom client application", "Web services data actions", "Bot connector"];
export const CATEGORY_OPTIONS = ["CRM", "ITSM", "Collaboration", "Bot", "Analytics", "Custom"];
export const CREDENTIAL_TYPE_OPTIONS = ["OAuth 2.0", "Basic auth", "API key", "Service account", "None"];
export const SHOW_IN_OPTIONS = ["Agent UI panel", "Standalone app", "Admin only", "Hidden"];
export const PERMISSION_OPTIONS = ["All users", "Agents", "Supervisors", "Admins"];

const DEFAULT_FORM = {
  catalogue: CATALOGUE_OPTIONS[0],
  name: "",
  category: CATEGORY_OPTIONS[0],
  credentialType: CREDENTIAL_TYPE_OPTIONS[0],
  credentialName: "",
  showIn: SHOW_IN_OPTIONS[0],
  permission: PERMISSION_OPTIONS[0],
  enabled: true,
};

// Doubles as "+ Install Integration" (blank form) and the row "⋮" edit
// (pre-filled via initialForm) — same pattern as ProviderDrawer/ClientDrawer.
export default function InstallIntegrationDrawer({ open, onClose, onSave, initialForm }) {
  const [form, setForm] = useState(initialForm ?? DEFAULT_FORM);
  const [error, setError] = useState("");
  const initialFormRef = useRef(initialForm);
  useEffect(() => { initialFormRef.current = initialForm; });
  useEffect(() => {
    if (open) {
      setForm(initialFormRef.current ?? DEFAULT_FORM);
      setError("");
    }
  }, [open]);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    onSave(form);
  }

  if (!open) return null;

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>Install Integration</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="sect">Integration</div>
          <div className="fld">
            <label>Catalogue</label>
            <select value={form.catalogue} onChange={(e) => update("catalogue", e.target.value)}>
              {CATALOGUE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Name</label>
            <input value={form.name} onChange={(e) => { update("name", e.target.value); if (error) setError(""); }} />
          </div>
          <div className="fld">
            <label>Category</label>
            <select value={form.category} onChange={(e) => update("category", e.target.value)}>
              {CATEGORY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="sect">Credentials</div>
          <div className="fld">
            <label>Credential type</label>
            <select value={form.credentialType} onChange={(e) => update("credentialType", e.target.value)}>
              {CREDENTIAL_TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Credential name</label>
            <input value={form.credentialName} onChange={(e) => update("credentialName", e.target.value)} />
          </div>

          <div className="sect">Placement</div>
          <div className="fld">
            <label>Show in</label>
            <select value={form.showIn} onChange={(e) => update("showIn", e.target.value)}>
              {SHOW_IN_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Permission</label>
            <select value={form.permission} onChange={(e) => update("permission", e.target.value)}>
              {PERMISSION_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="tgl" onClick={() => update("enabled", !form.enabled)}>
            <div className={"sw" + (form.enabled ? " on" : "")} />
            Enable integration now
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
