import { useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ALL_AGENTS = ['Sofia Petrova', 'James Okafor', 'Priya Nair', 'Marco Rossi', 'Rajan Patel', 'Aisha Rahman', 'Carlos Mendez'];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function currentWeekLabel() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + 7);
  return `w/c Mon ${mon.getDate()} ${mon.toLocaleDateString('en-GB', { month: 'short' })} ${mon.getFullYear()}`;
}

const INITIAL_WP = [
  { id: 'wp1', name: 'UK Full-time', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], len: 8, flexFrom: '08:00', flexTo: '10:00', paid: 37.5, agents: ['Sofia Petrova', 'James Okafor', 'Priya Nair', 'Marco Rossi', 'Rajan Patel'] },
  { id: 'wp2', name: 'UK Part-time', days: ['Mon', 'Tue', 'Wed', 'Thu'], len: 5, flexFrom: '09:00', flexTo: '12:00', paid: 20, agents: ['Aisha Rahman'] },
];

const INITIAL_AC = [
  { id: 'ac1', name: 'On Queue', cat: 'On Queue', paid: true, adh: 'Adherent when On Queue' },
  { id: 'ac2', name: 'Break', cat: 'Break', paid: true, adh: 'Adherent during scheduled break' },
  { id: 'ac3', name: 'Lunch', cat: 'Meal', paid: false, adh: 'Adherent during scheduled meal' },
  { id: 'ac4', name: 'Team Meeting', cat: 'Meeting', paid: true, adh: 'Adherent when scheduled' },
  { id: 'ac5', name: 'Training', cat: 'Training', paid: true, adh: 'Adherent when scheduled' },
  { id: 'ac6', name: 'Time Off', cat: 'Time Off', paid: false, adh: 'Excused' },
];

const INITIAL_TIMEOFF = [
  { id: 'to1', agent: 'Sofia Petrova', code: 'Time Off', dates: 'Wed (this schedule week)', day: 'Wed', status: 'Pending' },
];
const INITIAL_TRADES = [
  { id: 'tr1', from: 'James Okafor', to: 'Priya Nair', day: 'Fri', status: 'Pending' },
];

let uidSeq = 100;
const uid = () => 's' + uidSeq++;

const wpForAgent = (wps, agent) => wps.find((w) => w.agents.includes(agent));

export default function SchedulesWfm({ toast, askConfirm, schedules, setSchedules, forecasts, onNavigate, initialTab }) {
  const [tab, setTab] = useState(initialTab || 'Schedules');
  const [workPlans, setWorkPlans] = useState(INITIAL_WP);
  const [actCodes, setActCodes] = useState(INITIAL_AC);
  const [timeOff, setTimeOff] = useState(INITIAL_TIMEOFF);
  const [trades, setTrades] = useState(INITIAL_TRADES);
  const [wpDrawer, setWpDrawer] = useState(null);
  const [acDrawer, setAcDrawer] = useState(false);

  function genSchedule() {
    const week = currentWeekLabel();
    if (!forecasts.length) { toast('Generate a forecast first — schedules are built against it'); return; }
    if (schedules.some((s) => s.week === week)) { toast(`Schedule for ${week} exists — delete it to regenerate`); return; }
    const entries = {};
    const skipped = [];
    let scheduled = 0;
    ALL_AGENTS.forEach((agent) => {
      const wp = wpForAgent(workPlans, agent);
      if (!wp) { skipped.push(agent); return; }
      entries[agent] = {};
      const span = Math.max(1, parseInt(wp.flexTo, 10) - parseInt(wp.flexFrom, 10) + 1);
      const startH = parseInt(wp.flexFrom, 10) + (hash(agent) % span);
      DAYS.forEach((d) => {
        if (!wp.days.includes(d)) return;
        entries[agent][d] = {
          start: String(startH).padStart(2, '0') + ':00',
          end: String(startH + wp.len).padStart(2, '0') + ':00',
          breaks: `Break ${startH + 2}:00 · Lunch ${startH + 4}:00 · Break ${startH + 6}:15`,
        };
      });
      scheduled++;
    });
    timeOff.forEach((r) => {
      if (r.status === 'Approved' && entries[r.agent] && entries[r.agent][r.day]) entries[r.agent][r.day] = { off: true };
    });
    setSchedules((list) => [{ id: uid(), week, status: 'Draft', entries }, ...list]);
    toast(`Schedule generated for <b>${scheduled}</b> agents${skipped.length ? ` — skipped (no work plan): ${skipped.join(', ')}` : ''}`);
  }

  function publish(id, week) {
    setSchedules((list) => list.map((s) => (s.id === id ? { ...s, status: 'Published' } : s)));
    toast(`Schedule <b>${week}</b> published — agents now see it in their workspace`);
  }

  function delSchedule(id, week) {
    askConfirm(`Delete schedule <b>${week}</b>?`, () => {
      setSchedules((list) => list.filter((s) => s.id !== id));
      toast('Deleted');
    });
  }

  function saveWP(id, fields) {
    const targetId = id || uid();
    setWorkPlans((list) => {
      const cleared = list.map((w) => (w.id === targetId ? w : { ...w, agents: w.agents.filter((a) => !fields.agents.includes(a)) }));
      return id ? cleared.map((w) => (w.id === id ? { ...w, ...fields } : w)) : [...cleared, { id: targetId, ...fields }];
    });
    setWpDrawer(null);
    toast('Work plan saved');
  }

  function delWP(id, name) {
    askConfirm(`Delete work plan <b>${name}</b>? Its agents become unschedulable.`, () => {
      setWorkPlans((list) => list.filter((w) => w.id !== id));
      toast('Deleted');
    });
    setWpDrawer(null);
  }

  function saveAC(name, cat, paid) {
    if (name.trim().length < 2 || actCodes.some((a) => a.name.toLowerCase() === name.trim().toLowerCase())) {
      return 'A unique name is required.';
    }
    setActCodes((list) => [...list, { id: uid(), name: name.trim(), cat, paid, adh: 'Adherent when scheduled' }]);
    setAcDrawer(false);
    toast('Activity code added');
    return null;
  }

  function delAC(id, name) {
    askConfirm(`Delete activity code <b>${name}</b>?`, () => {
      setActCodes((list) => list.filter((a) => a.id !== id));
      toast('Deleted');
    });
  }

  function toDecide(id, ok) {
    const r = timeOff.find((x) => x.id === id);
    setTimeOff((list) => list.map((x) => (x.id === id ? { ...x, status: ok ? 'Approved' : 'Denied' } : x)));
    if (ok) {
      setSchedules((list) => list.map((s) => {
        if (s.entries[r.agent] && s.entries[r.agent][r.day]) {
          return { ...s, entries: { ...s.entries, [r.agent]: { ...s.entries[r.agent], [r.day]: { off: true } } } };
        }
        return s;
      }));
    }
    toast(ok ? `Approved — ${r.agent}'s ${r.day} shift replaced with Time Off on the schedule` : `Denied — ${r.agent}`);
  }

  function tradeDecide(id) {
    const r = trades.find((x) => x.id === id);
    setTrades((list) => list.map((x) => (x.id === id ? { ...x, status: 'Approved' } : x)));
    setSchedules((list) => list.map((s) => {
      const a = s.entries[r.from], b = s.entries[r.to];
      if (a && b) {
        const next = { ...s, entries: { ...s.entries, [r.from]: { ...a, [r.day]: b[r.day] }, [r.to]: { ...b, [r.day]: a[r.day] } } };
        return next;
      }
      return s;
    }));
    toast(`Trade approved — ${r.day} shifts swapped on the schedule`);
  }

  return (
    <>
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Quality &amp; WEM</div>
        <div className="tt">
          <h1>Schedules (WFM)</h1>
          <div className="rt">
            {tab === 'Schedules' && (forecasts.length
              ? <button className="btn" onClick={genSchedule}>⚡ Generate Schedule ({currentWeekLabel()})</button>
              : <button className="btn sec" onClick={() => onNavigate('forecasts')}>Generate a forecast first</button>)}
            {tab === 'Work Plans' && <button className="btn" onClick={() => setWpDrawer({ id: null, name: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], len: 8, flexFrom: '08:00', flexTo: '10:00', paid: 37.5, agents: [] })}>+ Work Plan</button>}
            {tab === 'Activity Codes' && <button className="btn" onClick={() => setAcDrawer(true)}>+ Activity Code</button>}
          </div>
        </div>
        <div className="tabs">
          {['Schedules', 'Work Plans', 'Activity Codes', 'Time Off', 'Shift Trades'].map((t) => (
            <div key={t} className={'tb' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
      </div>

      <div className="pbody">
        {tab === 'Schedules' && (
          schedules.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #ccd4e0', borderRadius: 10, padding: 26, textAlign: 'center', color: '#8794a8', fontSize: 13 }}>
              No schedule yet — generation places each work-planned agent's shift inside their flex window, inserts breaks and lunch.
            </div>
          ) : (
            schedules.map((s) => (
              <div key={s.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 8px' }}>
                  <b style={{ fontSize: 14 }}>{s.week}</b>
                  {s.status === 'Published' ? <span className="st ok"><span className="d" />Published — agents can see it</span> : <span className="st wn"><span className="d" />Draft</span>}
                  <div style={{ flex: 1 }} />
                  {s.status !== 'Published' && <button className="btn" style={{ height: 28 }} onClick={() => publish(s.id, s.week)}>Publish</button>}
                  <a className="lnk" style={{ fontSize: 12 }} onClick={() => delSchedule(s.id, s.week)}>Delete</a>
                </div>
                <div className="tblw">
                  <table className="dt">
                    <thead><tr><th>Agent</th>{DAYS.map((d) => <th key={d} style={{ textAlign: 'center' }}>{d}</th>)}</tr></thead>
                    <tbody>
                      {Object.keys(s.entries).map((agent) => (
                        <tr key={agent}>
                          <td><b>{agent}</b><br /><span style={{ color: '#8794a8', fontSize: 11 }}>{(wpForAgent(workPlans, agent) || {}).name || 'no work plan'}</span></td>
                          {DAYS.map((d) => {
                            const e = s.entries[agent][d];
                            return (
                              <td key={d} style={{ textAlign: 'center' }}>
                                {!e ? <span style={{ color: '#c9d2df' }}>—</span> : e.off ? <span className="tag o">Time Off</span> : <span className="tag" title={e.breaks}>{e.start}–{e.end}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {forecasts.length > 0 && (
                        <tr style={{ background: '#f5f7fa' }}>
                          <td><b>Coverage vs requirement</b><br /><span style={{ color: '#8794a8', fontSize: 11 }}>staffed / required (Erlang-lite @ 75% occupancy)</span></td>
                          {DAYS.map((d) => {
                            const f = forecasts[0];
                            let vol = 0, aht = 0, n = 0;
                            Object.values(f.data).forEach((pgData) => { vol += pgData.days[d] || 0; aht += pgData.aht; n++; });
                            aht = n ? aht / n : 240;
                            const req = Math.max(1, Math.ceil((vol * aht) / (8 * 3600 * 0.75)));
                            const have = Object.keys(s.entries).filter((agent) => { const e = s.entries[agent][d]; return e && !e.off; }).length;
                            const col = have >= req ? '#1f9d63' : have >= req - 1 ? '#e0a200' : '#b3261e';
                            return (
                              <td key={d} style={{ textAlign: 'center' }}>
                                <b style={{ color: col }}>{have}</b><span style={{ color: '#8794a8' }}>/{req}</span>
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )
        )}

        {tab === 'Work Plans' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Work plan</th><th>Days</th><th>Shift</th><th>Start window</th><th>Paid h/wk</th><th>Agents</th><th style={{ width: 40 }}></th></tr></thead>
              <tbody>
                {workPlans.map((w) => (
                  <tr key={w.id} onClick={() => setWpDrawer(w)}>
                    <td><b className="lnk">{w.name}</b></td>
                    <td>{w.days.join(' ')}</td>
                    <td>{w.len}h</td>
                    <td>{w.flexFrom}–{w.flexTo}</td>
                    <td>{w.paid}</td>
                    <td>{w.agents.map((a) => <span className="tag" key={a}>{a.split(' ')[0]}</span>)}</td>
                    <td style={{ color: '#a9b3c2' }}>⋮</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Activity Codes' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Code</th><th>Category</th><th>Paid</th><th>Adherence</th><th style={{ width: 70 }}></th></tr></thead>
              <tbody>
                {actCodes.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.name}</b></td>
                    <td><span className={'tag' + (a.cat === 'On Queue' ? '' : ' o')}>{a.cat}</span></td>
                    <td>{a.paid ? 'Yes' : 'No'}</td>
                    <td style={{ fontSize: 12, color: '#5b6b82' }}>{a.adh}</td>
                    <td><a className="lnk" style={{ fontSize: 12 }} onClick={() => delAC(a.id, a.name)}>Delete</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Time Off' && (
          <>
            <div className="tblw">
              <table className="dt">
                <thead><tr><th>Agent</th><th>Type</th><th>Dates</th><th>Status</th><th style={{ width: 150 }}></th></tr></thead>
                <tbody>
                  {timeOff.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.agent}</b></td>
                      <td>{r.code}</td>
                      <td>{r.dates}</td>
                      <td>
                        {r.status === 'Pending' ? <span className="st wn"><span className="d" />Pending</span>
                          : r.status === 'Approved' ? <span className="st ok"><span className="d" />Approved</span>
                          : <span className="st" style={{ color: '#b3261e' }}><span className="d" style={{ background: '#b3261e' }} />Denied</span>}
                      </td>
                      <td>
                        {r.status === 'Pending' ? (
                          <>
                            <button className="btn sec" style={{ height: 26 }} onClick={() => toDecide(r.id, true)}>Approve</button>{' '}
                            <button className="btn gh" style={{ height: 26 }} onClick={() => toDecide(r.id, false)}>Deny</button>
                          </>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: '11.5px', color: '#8794a8', marginTop: 8 }}>Approving time off replaces that agent's scheduled shift with a Time Off activity on the schedule.</div>
          </>
        )}

        {tab === 'Shift Trades' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Day</th><th>From</th><th>To</th><th>Status</th><th style={{ width: 150 }}></th></tr></thead>
              <tbody>
                {trades.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.day}</b></td>
                    <td>{r.from}</td>
                    <td>{r.to}</td>
                    <td>{r.status === 'Pending' ? <span className="st wn"><span className="d" />Pending</span> : <span className="st ok"><span className="d" />{r.status}</span>}</td>
                    <td>{r.status === 'Pending' ? <button className="btn sec" style={{ height: 26 }} onClick={() => tradeDecide(r.id)}>Approve trade</button> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {wpDrawer && <WPDrawer wp={wpDrawer} workPlans={workPlans} onCancel={() => setWpDrawer(null)} onSave={saveWP} onDelete={delWP} />}
      {acDrawer && <ACDrawer onCancel={() => setAcDrawer(false)} onSave={saveAC} />}
    </>
  );
}

function WPDrawer({ wp, workPlans, onCancel, onSave, onDelete }) {
  const isNew = !wp.id;
  const [name, setName] = useState(wp.name);
  const [days, setDays] = useState(wp.days);
  const [len, setLen] = useState(wp.len);
  const [flexFrom, setFlexFrom] = useState(wp.flexFrom);
  const [flexTo, setFlexTo] = useState(wp.flexTo);
  const [paid, setPaid] = useState(wp.paid);
  const [agents, setAgents] = useState(wp.agents);
  const [error, setError] = useState('');

  function toggleDay(d) {
    setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));
  }
  function toggleAgent(a) {
    setAgents((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  }

  function submit() {
    if (name.trim().length < 2) { setError('Name is required.'); return; }
    if (!days.length) { setError('Pick at least one working day.'); return; }
    const l = parseInt(len, 10) || 8;
    if (l < 2 || l > 12) { setError('Shift length must be 2–12 hours.'); return; }
    onSave(wp.id, { name: name.trim(), days, len: l, flexFrom: flexFrom.trim() || '08:00', flexTo: flexTo.trim() || '10:00', paid: parseFloat(paid) || 37.5, agents });
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'New Work Plan' : `Edit — ${wp.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="fld"><label>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="sect">Shift rules</div>
          <div className="fld">
            <label>Working days</label>
            <div>
              {DAYS.map((d) => (
                <label key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 10, fontSize: '12.5px' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={days.includes(d)} onChange={() => toggleDay(d)} />{d}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Shift length (h)</label><input type="number" value={len} onChange={(e) => setLen(e.target.value)} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Earliest start</label><input value={flexFrom} onChange={(e) => setFlexFrom(e.target.value)} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Latest start</label><input value={flexTo} onChange={(e) => setFlexTo(e.target.value)} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Paid h/week</label><input type="number" step="0.5" value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
          </div>
          <div className="sect">Agents on this plan (one plan per agent)</div>
          {ALL_AGENTS.map((a) => {
            const other = workPlans.find((x) => x.id !== wp.id && x.agents.includes(a));
            return (
              <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', fontSize: '12.5px' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={agents.includes(a)} onChange={() => toggleAgent(a)} />
                {a}
                {other && <span style={{ color: '#8794a8', fontSize: 11 }}>(currently on {other.name})</span>}
              </label>
            );
          })}
          {!isNew && <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(wp.id, wp.name)}>Delete work plan</button></div>}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ACDrawer({ onCancel, onSave }) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState('On Queue');
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState('');

  function submit() {
    const err = onSave(name, cat, paid);
    if (err) setError(err);
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" className="short" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>New Activity Code</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="fld"><label>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="fld">
            <label>Category</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {['On Queue', 'Off Queue', 'Break', 'Meal', 'Meeting', 'Training', 'Time Off'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Counts as paid time
          </label>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}
