import { useEffect, useRef, useState } from "react";

export default function StatusFilterChip({ label, values, value, onChange, onNoColumn }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  function handleClick() {
    if (!values || !values.length) {
      onNoColumn && onNoColumn();
      return;
    }
    setOpen((v) => !v);
  }

  const displayText = value ? value.slice(0, 16) : "Any";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div className="chip" onClick={handleClick}>{label}: {displayText} ▾</div>
      {open && (
        <div
          style={{
            position: "absolute", left: 0, top: "calc(100% + 4px)", background: "#fff",
            border: "1px solid #ccd4e0", borderRadius: 6, boxShadow: "0 8px 30px rgba(0,0,0,.16)",
            zIndex: 270, minWidth: 170, maxHeight: 280, overflow: "auto", padding: "4px 0",
          }}
        >
          <div
            style={{ padding: "7px 14px", cursor: "pointer", fontSize: "12.5px" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#f4f6fa")}
            onMouseOut={(e) => (e.currentTarget.style.background = "")}
            onClick={() => { onChange(""); setOpen(false); }}
          >
            All
          </div>
          {values.map((v) => (
            <div
              key={v}
              style={{ padding: "7px 14px", cursor: "pointer", fontSize: "12.5px" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f4f6fa")}
              onMouseOut={(e) => (e.currentTarget.style.background = "")}
              onClick={() => { onChange(v); setOpen(false); }}
            >
              {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
