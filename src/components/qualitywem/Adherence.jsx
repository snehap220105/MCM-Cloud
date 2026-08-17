import { useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SIM_STATES = ['On Queue', 'On Queue', 'Available', 'Break', 'On Queue'];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function Adherence({ toast, schedules, onNavigate }) {
  const [exceptions, setExceptions] = useState({});
  const [tick, setTick] = useState(0);
  const pub = (schedules || []).find((s) => s.status === 'Published');
  const today = DAYS[(new Date().getDay() + 6) % 7];

  function excuse(agent, day) {
    setExceptions((ex) => ({ ...ex, [agent + day]: 'System outage' }));
    toast('Exception recorded — the interval counts as excused');
  }

  return (
    <>
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Quality &amp; WEM</div>
        <div className="tt">
          <h1>Adherence</h1>
          <div className="rt"><div className="chip" onClick={() => { setTick((t) => t + 1); toast('Refreshed'); }}>↻ Refresh</div></div>
        </div>
        <div className="tabs"><div className="tb on">Real-time</div></div>
      </div>

      <div className="pbody">
        {!pub ? (
          <div style={{ background: '#fff', border: '1px dashed #ccd4e0', borderRadius: 10, padding: 26, textAlign: 'center', color: '#8794a8', fontSize: 13 }}>
            Publish a schedule (Quality &amp; WEM › Schedules) to see real-time adherence. Adherence compares each agent's <b>scheduled activity</b> with their <b>actual status</b>.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#5b6b82', marginBottom: 10 }}>
              Live view for <b>{today}</b>, schedule {pub.week}. Agent status is simulated in this prototype.
            </div>
            <div className="tblw">
              <table className="dt">
                <thead><tr><th>Agent</th><th>Scheduled now</th><th>Actual status</th><th>Adherence</th><th>7-day %</th><th></th></tr></thead>
                <tbody>
                  {Object.keys(pub.entries).map((agent) => {
                    const e = pub.entries[agent][today];
                    const scheduled = e ? (e.off ? 'Time Off' : `On Queue ${e.start}–${e.end}`) : 'Not scheduled today';
                    const actual = SIM_STATES[hash(agent) % 5];
                    let adherent;
                    if (!e) adherent = '—';
                    else if (e.off) adherent = 'Excused';
                    else adherent = actual === 'On Queue' ? 'Adherent' : 'Out of adherence';
                    const exc = exceptions[agent + today];
                    if (exc) adherent = `Excused (${exc})`;
                    const col = adherent === 'Adherent' ? '#1f9d63' : adherent.startsWith('Excused') || adherent === '—' ? '#8794a8' : '#b3261e';
                    const pct = 87 + (hash(agent) % 12);
                    return (
                      <tr key={agent}>
                        <td><b>{agent}</b></td>
                        <td>{scheduled}</td>
                        <td>{actual}</td>
                        <td><b style={{ color: col }}>{adherent}</b></td>
                        <td>{pct}%</td>
                        <td style={{ width: 120 }}>
                          {adherent === 'Out of adherence' ? <button className="btn sec" style={{ height: 26 }} onClick={() => excuse(agent, today)}>Add exception</button> : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </>
  );
}
