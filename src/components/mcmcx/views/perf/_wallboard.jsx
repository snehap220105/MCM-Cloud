/**
 * The full-screen wallboard, from the prototype's `wallOpen()` / `wallBody()`.
 *
 * A dark board meant for a wall-mounted screen: the active dashboard's widgets
 * as oversized tiles, then a queue table. Tiles turn red when they breach —
 * more than 5 waiting, a longest wait over two minutes, service level under
 * 80%, or abandon over 5% — exactly the thresholds the original used. Escape
 * closes it.
 */
import { useEffect, useState } from 'react';
import { useDb } from '@/store/db';
import { fmtL, kpis, qStats, useLive } from './_live';
import { WIDGETS, widgetValue } from './Dashboards';

function isWarning(w, k) {
  return (
    (w === 'waiting' && k.waiting > 5) ||
    (w === 'longest' && k.longest > 120) ||
    (w === 'sl' && k.sl != null && k.sl < 80) ||
    (w === 'ab' && k.ab != null && k.ab > 5)
  );
}
function slColour(sl) {
  if (sl == null) return '#8fa2c4';
  return sl >= 80 ? '#5ad692' : sl >= 60 ? '#ffcf5c' : '#ff7d90';
}

export function Wallboard({ onClose }) {
  const db = useDb();
  const live = useLive();
  const [clock, setClock] = useState(() => new Date().toTimeString().slice(0, 8));

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const timer = window.setInterval(() => setClock(new Date().toTimeString().slice(0, 8)), 1000);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearInterval(timer);
    };
  }, [onClose]);

  const k = kpis();
  const widgets = db.dashboards?.[0]?.widgets ?? ['waiting', 'sl', 'ans'];

  return (
    <div
      id="wallbd"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0d1526',
        zIndex: 9999,
        padding: '34px 44px',
        overflow: 'auto',
        color: '#eef2f8',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>MCM Cloud CX — Wallboard</div>
        <div style={{ marginLeft: 14, fontSize: 13, color: '#5ad692' }}>● LIVE</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 15, color: '#8fa2c4', marginRight: 18 }}>{clock}</div>
        <button
          onClick={onClose}
          style={{
            background: '#243352',
            color: '#fff',
            border: 0,
            borderRadius: 8,
            padding: '9px 18px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Exit (Esc)
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 18,
          marginBottom: 26,
        }}
      >
        {widgets.map((w) => {
          const warn = isWarning(w, k);
          return (
            <div
              key={w}
              style={{
                background: warn ? '#3a1420' : '#152036',
                border: '1px solid ' + (warn ? '#7a2334' : '#243352'),
                borderRadius: 14,
                padding: '22px 26px',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  color: '#8fa2c4',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {WIDGETS[w]}
              </div>
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  marginTop: 6,
                  color: warn ? '#ff7d90' : '#fff',
                }}
              >
                {widgetValue(w, k)}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          background: '#121b30',
          border: '1px solid #243352',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
          <thead>
            <tr style={{ background: '#182240' }}>
              <th style={{ padding: '12px 14px', textAlign: 'left', color: '#8fa2c4' }}>Queue</th>
              <th style={{ color: '#8fa2c4' }}>Waiting</th>
              <th style={{ color: '#8fa2c4' }}>Longest</th>
              <th style={{ color: '#8fa2c4' }}>SL</th>
              <th style={{ color: '#8fa2c4' }}>Handled</th>
            </tr>
          </thead>
          <tbody>
            {(db.queues ?? []).map((q) => {
              const s = live.q[q.id] ?? { waiting: 0, longest: 0 };
              const st = qStats(q);
              return (
                <tr key={q.id}>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>{q.name}</td>
                  <td style={{ textAlign: 'center' }}>{s.waiting}</td>
                  <td style={{ textAlign: 'center' }}>{s.longest ? fmtL(s.longest) : '—'}</td>
                  <td style={{ textAlign: 'center', color: slColour(st.sl) }}>
                    {st.sl == null ? '—' : st.sl + '%'}
                  </td>
                  <td style={{ textAlign: 'center' }}>{st.handled}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
