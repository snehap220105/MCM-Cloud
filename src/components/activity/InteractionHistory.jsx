// Ported from drawA()'s history list (lines 6085-6091).
export default function InteractionHistory({ history }) {
  return (
    <>
      <h1 style={{ fontSize: 15, margin: '20px 0 6px' }}>My interactions</h1>
      <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: 8, padding: '6px 14px' }}>
        {history.length ? history.slice(0, 8).map((h, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #f2f5f9', fontSize: 12.5 }}>
            <span style={{ color: '#8794a8', width: 60 }}>{h.t}</span>
            <span style={{ width: 60 }}><span className={'tag' + (h.kind === 'Voice' ? '' : ' o')}>{h.kind || 'Voice'}</span></span>
            <span style={{ width: 150 }}><b>{h.name}</b></span>
            <span style={{ width: 130 }}>{h.ani || ''}</span>
            <span style={{ width: 110 }}>{h.queue || ''}</span>
            <span style={{ width: 60, fontFamily: 'monospace' }}>{h.dur}</span>
            <span style={{ color: h.result === 'Handled' ? '#1f9d63' : '#b3261e', fontWeight: 600 }}>{h.result}</span>
            <span style={{ color: '#8794a8' }}>{h.wrap || ''}</span>
          </div>
        )) : <div style={{ color: '#8794a8', fontSize: 12, padding: '8px 0' }}>No interactions yet this session.</div>}
      </div>
    </>
  );
}
