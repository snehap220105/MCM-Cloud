import { useCallback, useEffect, useState } from 'react';
import HelpResourcesPanel from './HelpResourcesPanel.jsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Kept in sync with server/schedule.js NAME_RE/NAME_MIN/NAME_MAX — applies to both the Work
// Plan name and the Activity Code name.
const NAME_RE = /^[a-zA-Z\s]+$/;
const NAME_MIN = 3;
const NAME_MAX = 50;
function nameError(name) {
  if (!name) return null;
  if (name.trim().length < NAME_MIN || name.length > NAME_MAX) return `Name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  if (!NAME_RE.test(name)) return 'Only letters and spaces are allowed — no numbers or symbols.';
  return null;
}

async function api(path, options) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw Object.assign(new Error(body.error || 'Request failed'), { fields: body.fields });
  return body;
}

const wpForAgentId = (wps, agentId) => wps.find((w) => w.agentIds.includes(agentId));

export default function SchedulesWfm({ toast, askConfirm, onNavigate, initialTab }) {
  const [tab, setTab] = useState(initialTab || 'Schedules');
  const [agents, setAgents] = useState([]);
  const [workPlans, setWorkPlans] = useState([]);
  const [actCodes, setActCodes] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [trades, setTrades] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [options, setOptions] = useState({ days: DAYS, categories: [] });
  const [loading, setLoading] = useState(true);
  const [wpDrawer, setWpDrawer] = useState(null);
  const [acDrawer, setAcDrawer] = useState(false);
  const [generating, setGenerating] = useState(false);

  const reload = useCallback(() => Promise.all([
    api('/api/agents').then((r) => setAgents(r.data)),
    api('/api/work-plans').then((r) => setWorkPlans(r.data)),
    api('/api/activity-codes').then((r) => setActCodes(r.data)),
    api('/api/time-off').then((r) => setTimeOff(r.data)),
    api('/api/shift-trades').then((r) => setTrades(r.data)),
    api('/api/schedules').then((r) => setSchedules(r.data)),
    api('/api/forecasts').then((r) => setForecasts(r.data)),
  ]), []);

  useEffect(() => {
    Promise.all([reload(), api('/api/work-plans/options').then(setOptions)])
      .catch(() => toast('Could not load schedules from backend'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function genSchedule() {
    setGenerating(true);
    try {
      const { data, scheduledCount } = await api('/api/schedules', { method: 'POST' });
      setSchedules((list) => [data, ...list]);
      const skipped = agents.length - scheduledCount;
      toast(`Schedule generated for <b>${scheduledCount}</b> agents${skipped ? ` — ${skipped} skipped (no work plan)` : ''}`);
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function publish(id, week) {
    try {
      await api(`/api/schedules/${id}/publish`, { method: 'PUT' });
      setSchedules((list) => list.map((s) => (s.id === id ? { ...s, status: 'Published' } : s)));
      toast(`Schedule <b>${week}</b> published — agents now see it in their workspace`);
    } catch (e) {
      toast(e.message);
    }
  }

  function delSchedule(id, week) {
    askConfirm(`Delete schedule <b>${week}</b>?`, async () => {
      try {
        await api(`/api/schedules/${id}`, { method: 'DELETE' });
        setSchedules((list) => list.filter((s) => s.id !== id));
        toast('Deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  async function saveWP(id, fields) {
    const { data } = id
      ? await api(`/api/work-plans/${id}`, { method: 'PUT', body: JSON.stringify(fields) })
      : await api('/api/work-plans', { method: 'POST', body: JSON.stringify(fields) });
    setWpDrawer(null);
    await reload();
    toast('Work plan saved');
    return data;
  }

  function delWP(id, name) {
    askConfirm(`Delete work plan <b>${name}</b>? Its agents become unschedulable.`, async () => {
      try {
        await api(`/api/work-plans/${id}`, { method: 'DELETE' });
        setWpDrawer(null);
        await reload();
        toast('Deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  async function saveAC(name, category, paid) {
    try {
      const { data } = await api('/api/activity-codes', { method: 'POST', body: JSON.stringify({ name, category, paid }) });
      setActCodes((list) => [...list, data]);
      setAcDrawer(false);
      toast('Activity code added');
      return null;
    } catch (e) {
      return e.fields?.name || e.message;
    }
  }

  function delAC(id, name) {
    askConfirm(`Delete activity code <b>${name}</b>?`, async () => {
      try {
        await api(`/api/activity-codes/${id}`, { method: 'DELETE' });
        setActCodes((list) => list.filter((a) => a.id !== id));
        toast('Deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  async function toDecide(id, ok) {
    try {
      const { data } = await api(`/api/time-off/${id}/decide`, { method: 'PUT', body: JSON.stringify({ approve: ok }) });
      setTimeOff((list) => list.map((x) => (x.id === id ? data : x)));
      if (ok) await reload(); // approval can mutate schedule_entries across every existing schedule
      toast(ok ? `Approved — ${data.agent}'s ${data.day} shift replaced with Time Off on the schedule` : `Denied — ${data.agent}`);
    } catch (e) {
      toast(e.message);
    }
  }

  async function tradeDecide(id) {
    try {
      const { data } = await api(`/api/shift-trades/${id}/approve`, { method: 'PUT' });
      setTrades((list) => list.map((x) => (x.id === id ? data : x)));
      await reload(); // swap can mutate schedule_entries across every existing schedule
      toast(`Trade approved — ${data.day} shifts swapped on the schedule`);
    } catch (e) {
      toast(e.message);
    }
  }

  const latestForecast = forecasts[0];

  return (
    <>
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Quality &amp; WEM</div>
        <div className="tt">
          <h1>Schedules (WFM)</h1>
          <div className="rt">
            {tab === 'Schedules' && (forecasts.length
              ? <button className="btn" onClick={genSchedule} disabled={generating}>{generating ? 'Generating…' : '⚡ Generate Schedule (next week)'}</button>
              : <button className="btn sec" onClick={() => onNavigate('forecasts')}>Generate a forecast first</button>)}
            {tab === 'Work Plans' && <button className="btn" onClick={() => setWpDrawer({ id: null, name: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], len: 8, flexFrom: '08:00', flexTo: '10:00', paid: 37.5, agentIds: [] })}>+ Work Plan</button>}
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
          loading ? (
            <div style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</div>
          ) : schedules.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #ccd4e0', borderRadius: 10, padding: 26, textAlign: 'center', color: '#8794a8', fontSize: 13 }}>
              No schedule yet — generation places each work-planned agent's shift inside their flex window, inserts breaks and lunch.
            </div>
          ) : (
            schedules.map((s) => {
              const agentIds = [...new Set(s.entries.map((e) => e.agentId))];
              return (
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
                        {agentIds.map((agentId) => {
                          const agent = agents.find((a) => a.id === agentId);
                          const wp = wpForAgentId(workPlans, agentId);
                          return (
                            <tr key={agentId}>
                              <td><b>{agent?.name || `Agent #${agentId}`}</b><br /><span style={{ color: '#8794a8', fontSize: 11 }}>{wp?.name || 'no work plan'}</span></td>
                              {DAYS.map((d) => {
                                const e = s.entries.find((x) => x.agentId === agentId && x.day === d);
                                return (
                                  <td key={d} style={{ textAlign: 'center' }}>
                                    {!e ? <span style={{ color: '#c9d2df' }}>—</span> : e.isOff ? <span className="tag o">Time Off</span> : <span className="tag" title={e.breaks}>{e.start}–{e.end}</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        {latestForecast && (
                          <tr style={{ background: '#f5f7fa' }}>
                            <td><b>Coverage vs requirement</b><br /><span style={{ color: '#8794a8', fontSize: 11 }}>staffed / required (Erlang-lite @ 75% occupancy)</span></td>
                            {DAYS.map((d) => {
                              let vol = 0, aht = 0, n = 0;
                              latestForecast.entries.forEach((entry) => { vol += entry.days[d] || 0; aht += entry.aht; n++; });
                              aht = n ? aht / n : 240;
                              const req = Math.max(1, Math.ceil((vol * aht) / (8 * 3600 * 0.75)));
                              const have = agentIds.filter((agentId) => { const e = s.entries.find((x) => x.agentId === agentId && x.day === d); return e && !e.isOff; }).length;
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
              );
            })
          )
        )}

        {tab === 'Work Plans' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Work plan</th><th>Days</th><th>Shift</th><th>Start window</th><th>Paid h/wk</th><th>Agents</th><th style={{ width: 40 }}></th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</td></tr>}
                {!loading && workPlans.map((w) => (
                  <tr key={w.id} onClick={() => setWpDrawer(w)}>
                    <td><b className="lnk">{w.name}</b></td>
                    <td>{w.days.join(' ')}</td>
                    <td>{w.len}h</td>
                    <td>{w.flexFrom}–{w.flexTo}</td>
                    <td>{w.paid}</td>
                    <td>{w.agents.map((a) => <span className="tag" key={a.id}>{a.name.split(' ')[0]}</span>)}</td>
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
                {loading && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</td></tr>}
                {!loading && actCodes.map((a) => (
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
                  {loading && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</td></tr>}
                  {!loading && timeOff.map((r) => (
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
                {loading && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</td></tr>}
                {!loading && trades.map((r) => (
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

        <HelpResourcesPanel pageKey="wfmsched" toast={toast} />
      </div>

      {wpDrawer && <WPDrawer wp={wpDrawer} agents={agents} workPlans={workPlans} options={options} onCancel={() => setWpDrawer(null)} onSave={saveWP} onDelete={delWP} />}
      {acDrawer && <ACDrawer options={options} onCancel={() => setAcDrawer(false)} onSave={saveAC} />}
    </>
  );
}

function WPDrawer({ wp, agents, workPlans, options, onCancel, onSave, onDelete }) {
  const isNew = !wp.id;
  const [name, setName] = useState(wp.name);
  const [days, setDays] = useState(wp.days);
  const [len, setLen] = useState(wp.len);
  const [flexFrom, setFlexFrom] = useState(wp.flexFrom);
  const [flexTo, setFlexTo] = useState(wp.flexTo);
  const [paid, setPaid] = useState(wp.paid);
  const [agentIds, setAgentIds] = useState(wp.agentIds);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const liveNameError = touched ? nameError(name) : null;

  function toggleDay(d) {
    setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));
  }
  function toggleAgent(id) {
    setAgentIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  async function submit() {
    setTouched(true);
    const e = {};
    const nErr = nameError(name);
    if (nErr) e.name = nErr;
    if (!days.length) e.days = 'Pick at least one working day.';
    const l = parseInt(len, 10);
    if (!(l >= 2 && l <= 12)) e.len = 'Shift length must be 2–12 hours.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onSave(wp.id, { name: name.trim(), days, len: l, flexFrom: flexFrom.trim() || '08:00', flexTo: flexTo.trim() || '10:00', paid: parseFloat(paid) || 37.5, agentIds });
    } catch (err) {
      setErrors(err.fields || { name: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'New Work Plan' : `Edit — ${wp.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          <div className="fld">
            <label>Name *</label>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => { setName(e.target.value); setTouched(true); }}
              onBlur={() => setTouched(true)}
              style={(liveNameError || errors.name) ? { borderColor: '#b3261e', boxShadow: '0 0 0 3px rgba(179,38,30,.1)' } : undefined}
            />
            {(liveNameError || errors.name) && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{liveNameError || errors.name}</div>}
          </div>
          <div className="sect">Shift rules</div>
          <div className="fld">
            <label>Working days</label>
            <div>
              {options.days.map((d) => (
                <label key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 10, fontSize: '12.5px' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={days.includes(d)} onChange={() => toggleDay(d)} />{d}
                </label>
              ))}
            </div>
            {errors.days && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{errors.days}</div>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Shift length (h)</label><input type="number" min="2" max="12" value={len} onChange={(e) => setLen(e.target.value)} />{errors.len && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{errors.len}</div>}</div>
            <div className="fld" style={{ flex: 1 }}><label>Earliest start</label><input value={flexFrom} onChange={(e) => setFlexFrom(e.target.value)} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Latest start</label><input value={flexTo} onChange={(e) => setFlexTo(e.target.value)} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Paid h/week</label><input type="number" step="0.5" value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
          </div>
          <div className="sect">Agents on this plan (one plan per agent)</div>
          {agents.map((a) => {
            const other = workPlans.find((x) => x.id !== wp.id && x.agentIds.includes(a.id));
            return (
              <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', fontSize: '12.5px' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={agentIds.includes(a.id)} onChange={() => toggleAgent(a.id)} />
                {a.name}
                {other && <span style={{ color: '#8794a8', fontSize: 11 }}>(currently on {other.name})</span>}
              </label>
            );
          })}
          {!isNew && <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(wp.id, wp.name)}>Delete work plan</button></div>}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function ACDrawer({ options, onCancel, onSave }) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState('On Queue');
  const [paid, setPaid] = useState(true);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const liveNameError = touched ? nameError(name) : null;

  async function submit() {
    setTouched(true);
    if (nameError(name)) return;
    setSaving(true);
    const err = await onSave(name.trim(), cat, paid);
    if (err) setError(err);
    setSaving(false);
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" className="short" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>New Activity Code</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="fld">
            <label>Name *</label>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => { setName(e.target.value); setTouched(true); }}
              onBlur={() => setTouched(true)}
              style={liveNameError ? { borderColor: '#b3261e', boxShadow: '0 0 0 3px rgba(179,38,30,.1)' } : undefined}
            />
            {liveNameError && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{liveNameError}</div>}
          </div>
          <div className="fld">
            <label>Category</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {options.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Counts as paid time
          </label>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
