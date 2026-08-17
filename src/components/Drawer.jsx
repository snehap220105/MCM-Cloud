// Mirrors #scrim + #drw from window.openDrawerHTML()/window.drawer() — a
// right-side panel with a header (title + close), scrollable body, and a
// footer action row. Most call sites in the original inline a per-drawer
// `style="..."` override (width, or height:auto;top:N%;bottom:auto for the
// short "confirm box" drawers) directly on the #drw div — `panelStyle` is
// that same override, passed through as-is rather than baked into the base
// #drw CSS rule, exactly matching the source.
export default function Drawer({ title, onClose, children, footer, panelStyle }) {
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw" style={panelStyle}>
        <div className="dh">
          <h2>{title}</h2>
          <div className="x" onClick={onClose}>×</div>
        </div>
        <div className="db">{children}</div>
        {footer && <div className="df">{footer}</div>}
      </div>
    </>
  );
}
