export default function AuditDrawer({ db, onClose }) {
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>Audit Log</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {db.audit.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid #eef1f6", fontSize: "12.5px" }}>
              <span style={{ color: "#8794a8", width: 118, flexShrink: 0 }}>{a.t}</span>
              <span style={{ width: 90, flexShrink: 0 }}>{a.who}</span>
              <span><b>{a.act}</b> — {a.obj}</span>
            </div>
          ))}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
