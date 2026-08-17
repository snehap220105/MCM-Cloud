export default function ColumnsDrawer({ columns, hidden, onToggle, onClose }) {
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw" style={{ height: "auto", top: "18%", bottom: "auto", borderRadius: "8px 0 0 8px", width: 300 }}>
        <div className="dh">
          <h2>Columns</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">
          {columns.map((label, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: "12.5px", borderBottom: "1px solid #f2f5f9" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={!hidden.has(i)} onChange={() => onToggle(i)} />
              {label}
            </label>
          ))}
        </div>
        <div className="df">
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
}
