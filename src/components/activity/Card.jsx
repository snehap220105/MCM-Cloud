// Ported from the Activity IIFE's card() helper (line 5973).
export default function Card({ style, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: 10, padding: '16px 18px', ...style }}>
      {children}
    </div>
  );
}
