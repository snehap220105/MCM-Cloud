import { useEffect, useRef, useState } from "react";

export const PROVIDER_OPTIONS = ["Amazon Lex V2", "Dialogflow CX", "MCM Native", "Custom webhook"];

const DEFAULT_FORM = {
  provider: PROVIDER_OPTIONS[0],
  name: "",
  language: "en-GB",
  channels: "",
  confidenceThreshold: "0.70",
  enabled: true,
};

export default function CreateBotConnectorDrawer({ open, onClose, onSave, initialForm }) {
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
          <h2>Add Bot</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="sect">Bot</div>
          <div className="fld">
            <label>Name</label>
            <input value={form.name} placeholder="e.g. Retail_Triage_Bot" onChange={(e) => { update("name", e.target.value); if (error) setError(""); }} />
          </div>
          <div className="fld">
            <label>Provider</label>
            <select value={form.provider} onChange={(e) => update("provider", e.target.value)}>
              {PROVIDER_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="sect">Configuration</div>
          <div className="fld">
            <label>Language</label>
            <input value={form.language} placeholder="e.g. en-GB" onChange={(e) => update("language", e.target.value)} />
          </div>
          <div className="fld">
            <label>Channels</label>
            <input value={form.channels} placeholder="e.g. Voice, Web Messenger" onChange={(e) => update("channels", e.target.value)} />
          </div>
          <div className="fld">
            <label>Confidence threshold</label>
            <input value={form.confidenceThreshold} placeholder="e.g. 0.70" onChange={(e) => update("confidenceThreshold", e.target.value)} />
          </div>

          <div className="sect">Status</div>
          <div className="tgl" onClick={() => update("enabled", !form.enabled)}>
            <div className={"sw" + (form.enabled ? " on" : "")} />
            Bot is live
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
