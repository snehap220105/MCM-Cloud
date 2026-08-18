import { useState } from "react";

const SAMPLE =
  "name,email,title,department,division,license,skills\n" +
  "Anna Lee,alee@mcmgroup.com,Advisor,Customer Care,UK Retail,CX 2,Billing:4\n" +
  "Tom Ford,tford@mcmgroup.com,Advisor,Customer Care,UK Retail,CX 1,Technical:3\n" +
  "Nina Gupta,ngupta@mcmgroup.com,Team Leader,Digital,UK Digital,CX 3,";

export default function CsvDrawer({ onClose, onImport, onDone }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  function handleImport() {
    if (!text.trim()) return;
    const r = onImport(text);
    setResult(r);
    if (r.ok && !r.fail.length) {
      setTimeout(onDone, 900);
    }
  }

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>Bulk Import People</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          <div className="sect">Paste CSV</div>
          <div style={{ fontSize: 12, color: "#5b6b82", marginBottom: 8, lineHeight: 1.6 }}>
            Columns: <code>name,email,title,department,division,license,skills</code>
            <br />
            Skills use <code>Skill:proficiency</code> separated by <code>;</code> — e.g. <code>Billing:5;Sales:3</code>. Name and email are mandatory. Unknown divisions fall back to Home.
          </div>
          <div className="fld">
            <textarea
              style={{ height: 170, fontFamily: "monospace", fontSize: 12 }}
              placeholder={"name,email,title,department,division,license,skills\nAnna Lee,alee@mcmgroup.com,Advisor,Customer Care,UK Retail,CX 2,Billing:4"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="fld">
            <label>&nbsp;</label>
            <button className="btn sec" onClick={() => setText(SAMPLE)}>Load sample</button>
          </div>
          {result && (
            <div style={{ fontSize: "12.5px", color: "#33425c" }}>
              <b style={{ color: "#1f9d63" }}>{result.ok} imported.</b>{" "}
              {result.fail.length > 0 && (
                <>
                  <b style={{ color: "#b3261e" }}>{result.fail.length} rejected:</b>
                  <br />
                  {result.fail.join("\n")}
                </>
              )}
            </div>
          )}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleImport}>Import</button>
        </div>
      </div>
    </>
  );
}
