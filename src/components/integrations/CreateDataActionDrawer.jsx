import { useEffect, useRef, useState } from "react";

export const INTEGRATION_OPTIONS = ["Salesforce", "ServiceNow", "Web Services Data Actions"];
export const METHOD_OPTIONS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const CATEGORY_OPTIONS = ["Customer lookup", "Case management", "Billing", "Verification"];

const DEFAULT_FORM = {
  name: "",
  integration: INTEGRATION_OPTIONS[0],
  category: CATEGORY_OPTIONS[0],
  method: METHOD_OPTIONS[0],
  requestUrl: "https://api.mcmgroup.example/",
  headers: "Content-Type: application/json",
  inputContract: "",
  outputContract: "",
  timeout: "4000",
  cacheResponses: false,
  publishAfterSave: true,
};

export default function CreateDataActionDrawer({ open, onClose, onSave, initialForm }) {
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
      setError("Action name is required.");
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
          <h2>Create Action</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="sect">Action</div>
          <div className="fld">
            <label>Name</label>
            <input value={form.name} placeholder="e.g. CRM_Lookup_Customer" onChange={(e) => { update("name", e.target.value); if (error) setError(""); }} />
          </div>
          <div className="fld">
            <label>Integration</label>
            <select value={form.integration} onChange={(e) => update("integration", e.target.value)}>
              {INTEGRATION_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Category</label>
            <select value={form.category} onChange={(e) => update("category", e.target.value)}>
              {CATEGORY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="sect">Request</div>
          <div className="fld">
            <label>Method</label>
            <select value={form.method} onChange={(e) => update("method", e.target.value)}>
              {METHOD_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Request URL template</label>
            <input style={{ fontFamily: "monospace" }} value={form.requestUrl} onChange={(e) => update("requestUrl", e.target.value)} />
          </div>
          <div className="fld">
            <label>Headers</label>
            <input style={{ fontFamily: "monospace" }} value={form.headers} onChange={(e) => update("headers", e.target.value)} />
          </div>

          <div className="sect">Contract</div>
          <div className="fld">
            <label>Input contract (JSON schema)</label>
            <input style={{ fontFamily: "monospace" }} value={form.inputContract} placeholder="{" onChange={(e) => update("inputContract", e.target.value)} />
          </div>
          <div className="fld">
            <label>Output contract (JSON schema)</label>
            <input style={{ fontFamily: "monospace" }} value={form.outputContract} placeholder="{" onChange={(e) => update("outputContract", e.target.value)} />
          </div>

          <div className="sect">Behaviour</div>
          <div className="fld">
            <label>Timeout (ms)</label>
            <input value={form.timeout} onChange={(e) => update("timeout", e.target.value)} />
          </div>
          <div className="tgl" onClick={() => update("cacheResponses", !form.cacheResponses)}>
            <div className={"sw" + (form.cacheResponses ? " on" : "")} />
            Cache successful responses (60 s)
          </div>
          <div className="tgl" onClick={() => update("publishAfterSave", !form.publishAfterSave)}>
            <div className={"sw" + (form.publishAfterSave ? " on" : "")} />
            Publish after save
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
