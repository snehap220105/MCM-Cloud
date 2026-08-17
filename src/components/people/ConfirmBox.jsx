export default function ConfirmBox({ msg, onCancel, onConfirm }) {
  return (
    <>
      <div id="scrim" onClick={onCancel} />
      <div id="drw" style={{ height: "auto", top: "30%", bottom: "auto", borderRadius: "8px 0 0 8px" }}>
        <div className="dh">
          <h2>Please confirm</h2>
          <div className="x" onClick={onCancel}>×</div>
        </div>
        <div className="db">
          <div style={{ fontSize: "13px", color: "#33425c", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: msg }} />
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </>
  );
}
