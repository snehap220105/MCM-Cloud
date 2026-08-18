import { useCallback, useEffect, useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Kept in sync with server/forecast.js NAME_RE/NAME_MIN/NAME_MAX — applies to both the
// Planning Group name and the Service Goal template name.
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

export default function Forecasts({ toast, askConfirm, initialTab, onNavigate }) {
  const [pgs, setPgs] = useState([]);
  const [sgs, setSgs] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [options, setOptions] = useState({ queues: [], skills: [], langs: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab || 'Forecasts');
  const [pgDrawer, setPgDrawer] = useState(null);
  const [sgDrawer, setSgDrawer] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [generating, setGenerating] = useState(false);

  const reload = useCallback(() => Promise.all([
    api('/api/planning-groups').then((r) => setPgs(r.data)),
    api('/api/service-goals').then((r) => setSgs(r.data)),
    api('/api/forecasts').then((r) => setForecasts(r.data)),
  ]), []);

  useEffect(() => {
    Promise.all([reload(), api('/api/planning-groups/options').then(setOptions)])
      .catch(() => toast('Could not load forecasts from backend'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pgById = (id) => pgs.find((p) => p.id === id);

  async function genForecast() {
    setGenerating(true);
    try {
      const { data } = await api('/api/forecasts', { method: 'POST' });
      setForecasts((list) => [data, ...list]);
      toast(`Forecast generated for <b>${data.week}</b> across ${data.entries.length} planning groups`);
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function delForecast(id, week) {
    askConfirm(`Delete forecast <b>${week}</b>?`, async () => {
      try {
        await api(`/api/forecasts/${id}`, { method: 'DELETE' });
        setForecasts((list) => list.filter((f) => f.id !== id));
        toast('Deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  async function savePG(id, fields) {
    const { data } = id
      ? await api(`/api/planning-groups/${id}`, { method: 'PUT', body: JSON.stringify(fields) })
      : await api('/api/planning-groups', { method: 'POST', body: JSON.stringify(fields) });
    setPgDrawer(null);
    await reload();
    toast('Planning group saved');
    return data;
  }

  function delPG(id, name) {
    setMenuFor(null);
    askConfirm(`Delete planning group <b>${name}</b>? Forecasts for it are removed.`, async () => {
      try {
        await api(`/api/planning-groups/${id}`, { method: 'DELETE' });
        setPgDrawer(null);
        await reload();
        toast('Deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  async function saveSG(id, fields) {
    const { data } = id
      ? await api(`/api/service-goals/${id}`, { method: 'PUT', body: JSON.stringify(fields) })
      : await api('/api/service-goals', { method: 'POST', body: JSON.stringify(fields) });
    setSgDrawer(null);
    await reload();
    toast('Service goal saved');
    return data;
  }

  function delSG(id, name) {
    setMenuFor(null);
    askConfirm(`Delete service goal <b>${name}</b>?`, async () => {
      try {
        await api(`/api/service-goals/${id}`, { method: 'DELETE' });
        setSgDrawer(null);
        await reload();
        toast('Deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  return (
    <>
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Quality &amp; WEM</div>
        <div className="tt">
          <h1>Forecasts</h1>
          <div className="rt">
            {tab === 'Forecasts' && <button className="btn" onClick={genForecast} disabled={generating}>{generating ? 'Generating…' : '⚡ Generate Forecast (next week)'}</button>}
            {tab === 'Planning Groups' && <button className="btn" onClick={() => setPgDrawer({ id: null, name: '', queues: [], skills: [], langs: [] })}>+ Planning Group</button>}
            {tab === 'Service Goals' && <button className="btn" onClick={() => setSgDrawer({ id: null, name: '', sl: 80, sls: 20, asa: 30, abn: 5, pgs: [] })}>+ Service Goal</button>}
          </div>
        </div>
        <div className="tabs">
          {['Forecasts', 'Planning Groups', 'Service Goals'].map((t) => (
            <div key={t} className={'tb' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
      </div>

      <div className="pbody">
        {tab === 'Forecasts' && (
          loading ? (
            <div style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</div>
          ) : forecasts.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #ccd4e0', borderRadius: 10, padding: 26, textAlign: 'center', color: '#8794a8', fontSize: 13 }}>
              No forecast yet — Generate derives weekly volume &amp; AHT per planning group from interaction history (ABM: automatic best method).
            </div>
          ) : (
            forecasts.map((f) => (
              <div key={f.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 8px' }}>
                  <b style={{ fontSize: 14 }}>{f.week}</b>
                  <span className="st ok"><span className="d" />{f.status}</span>
                  <span style={{ color: '#8794a8', fontSize: '11.5px' }}>generated {new Date(f.t).toLocaleTimeString()}</span>
                  <div style={{ flex: 1 }} />
                  <a className="lnk" style={{ fontSize: 12 }} onClick={() => delForecast(f.id, f.week)}>Delete</a>
                </div>
                <div className="tblw">
                  <table className="dt">
                    <thead>
                      <tr><th>Planning group</th><th>Weekly vol</th><th>AHT</th>{DAYS.map((d) => <th key={d} style={{ textAlign: 'right' }}>{d}</th>)}</tr>
                    </thead>
                    <tbody>
                      {f.entries.map((e) => (
                        <tr key={e.planningGroupId}>
                          <td><b>{e.name}</b><br /><span style={{ color: '#8794a8', fontSize: 11 }}>skills: {e.skills.join(', ')}</span></td>
                          <td>{e.volume}</td>
                          <td>{e.aht}s</td>
                          {DAYS.map((day) => <td key={day} style={{ textAlign: 'right' }}>{e.days[day] || 0}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )
        )}

        {tab === 'Planning Groups' && (
          <>
            <div style={{ fontSize: 12, color: '#5b6b82', marginBottom: 10 }}>
              A planning group maps <b>route paths</b> — queue + ACD skill + language — to one forecast entity. Your live routing config is the source.
            </div>
            <div className="tblw">
              <table className="dt">
                <thead><tr><th>Planning group</th><th>Queues</th><th>ACD skills</th><th>Languages</th><th style={{ width: 40 }}></th></tr></thead>
                <tbody>
                  {loading && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</td></tr>}
                  {!loading && pgs.map((p) => (
                    <tr key={p.id} onClick={() => setPgDrawer(p)}>
                      <td><b className="lnk">{p.name}</b></td>
                      <td>{p.queues.map((q) => <span className="tag" key={q}>{q}</span>)}</td>
                      <td>{p.skills.map((s) => <span className="tag o" key={s}>{s}</span>)}</td>
                      <td>{p.langs.join(', ')}</td>
                      <td style={{ color: '#a9b3c2', position: 'relative' }} onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === p.id ? null : p.id); }}>
                        ⋮
                        {menuFor === p.id && (
                          <div style={{ position: 'absolute', right: 0, top: 24, background: '#fff', border: '1px solid #dde3ec', borderRadius: 6, boxShadow: '0 10px 24px rgba(16,30,60,.18)', zIndex: 5, minWidth: 120 }}>
                            <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#3c4a5c', cursor: 'pointer' }} onClick={() => { setMenuFor(null); setPgDrawer(p); }}>Edit</div>
                            <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#b3261e', cursor: 'pointer' }} onClick={() => delPG(p.id, p.name)}>Delete</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'Service Goals' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Template</th><th>Service level</th><th>ASA</th><th>Abandon</th><th>Planning groups</th><th style={{ width: 40 }}></th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</td></tr>}
                {!loading && sgs.map((g) => (
                  <tr key={g.id} onClick={() => setSgDrawer(g)}>
                    <td><b className="lnk">{g.name}</b></td>
                    <td>{g.sl}% in {g.sls}s</td>
                    <td>≤ {g.asa}s</td>
                    <td>{g.abn ? `≤ ${g.abn}%` : '—'}</td>
                    <td>{g.planningGroups.map((p) => <span className="tag" key={p.id}>{p.name}</span>)}</td>
                    <td style={{ color: '#a9b3c2', position: 'relative' }} onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === g.id ? null : g.id); }}>
                      ⋮
                      {menuFor === g.id && (
                        <div style={{ position: 'absolute', right: 0, top: 24, background: '#fff', border: '1px solid #dde3ec', borderRadius: 6, boxShadow: '0 10px 24px rgba(16,30,60,.18)', zIndex: 5, minWidth: 120 }}>
                          <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#3c4a5c', cursor: 'pointer' }} onClick={() => { setMenuFor(null); setSgDrawer(g); }}>Edit</div>
                          <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#b3261e', cursor: 'pointer' }} onClick={() => delSG(g.id, g.name)}>Delete</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {pgDrawer && (
        <PGDrawer pg={pgDrawer} options={options} onCancel={() => setPgDrawer(null)} onSave={savePG} onDelete={delPG} />
      )}
      {sgDrawer && (
        <SGDrawer sg={sgDrawer} pgs={pgs} onCancel={() => setSgDrawer(null)} onSave={saveSG} onDelete={delSG} />
      )}
    </>
  );
}

function PGDrawer({ pg, options, onCancel, onSave, onDelete }) {
  const isNew = !pg.id;
  const [name, setName] = useState(pg.name);
  const [queues, setQueues] = useState(pg.queues);
  const [skills, setSkills] = useState(pg.skills);
  const [langs, setLangs] = useState(pg.langs);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const toggle = (setter) => (val) => setter((list) => (list.includes(val) ? list.filter((x) => x !== val) : [...list, val]));
  const liveNameError = touched ? nameError(name) : null;

  async function submit() {
    setTouched(true);
    const e = {};
    const nErr = nameError(name);
    if (nErr) e.name = nErr;
    if (!queues.length) e.queues = 'Pick at least one queue — a planning group must cover route paths.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onSave(pg.id, { name: name.trim(), queues, skills, langs });
    } catch (err) {
      setErrors(err.fields || { name: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'New Planning Group' : `Edit — ${pg.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
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
          <div className="sect">Route paths — queues</div>
          {options.queues.map((q) => (
            <label key={q} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '12.5px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={queues.includes(q)} onChange={() => toggle(setQueues)(q)} />{q}
            </label>
          ))}
          {errors.queues && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{errors.queues}</div>}
          <div className="sect">ACD skills (from Routing › Skills)</div>
          {options.skills.map((s) => (
            <label key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, margin: '0 12px 6px 0', fontSize: '12.5px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={skills.includes(s)} onChange={() => toggle(setSkills)(s)} />{s}
            </label>
          ))}
          <div className="sect">Languages</div>
          {options.langs.map((l) => (
            <label key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, margin: '0 12px 6px 0', fontSize: '12.5px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={langs.includes(l)} onChange={() => toggle(setLangs)(l)} />{l}
            </label>
          ))}
          {!isNew && <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(pg.id, pg.name)}>Delete planning group</button></div>}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function SGDrawer({ sg, pgs, onCancel, onSave, onDelete }) {
  const isNew = !sg.id;
  const [name, setName] = useState(sg.name);
  const [sl, setSl] = useState(sg.sl);
  const [sls, setSls] = useState(sg.sls);
  const [asa, setAsa] = useState(sg.asa);
  const [abn, setAbn] = useState(sg.abn);
  const [pgIds, setPgIds] = useState(sg.pgs);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const liveNameError = touched ? nameError(name) : null;

  function togglePg(id) {
    setPgIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  async function submit() {
    setTouched(true);
    const e = {};
    const nErr = nameError(name);
    if (nErr) e.name = nErr;
    if (!(sl >= 1 && sl <= 100)) e.sl = 'Service level must be 1–100.';
    if (!(sls >= 1 && sls <= 3600)) e.sls = 'Within-seconds target must be 1–3600.';
    if (!(asa >= 1 && asa <= 3600)) e.asa = 'ASA target must be 1–3600 seconds.';
    if (abn !== '' && !(abn >= 0 && abn <= 100)) e.abn = 'Max abandon must be 0–100.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onSave(sg.id, { name: name.trim(), sl: +sl, sls: +sls, asa: +asa, abn: abn === '' ? 0 : +abn, pgs: pgIds });
    } catch (err) {
      setErrors(err.fields || { name: err.message });
    } finally {
      setSaving(false);
    }
  }

  const err = (k) => errors[k] && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{errors[k]}</div>;

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'New Service Goal' : `Edit — ${sg.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          <div className="fld">
            <label>Template name *</label>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => { setName(e.target.value); setTouched(true); }}
              onBlur={() => setTouched(true)}
              style={(liveNameError || errors.name) ? { borderColor: '#b3261e', boxShadow: '0 0 0 3px rgba(179,38,30,.1)' } : undefined}
            />
            {(liveNameError || errors.name) && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{liveNameError || errors.name}</div>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Service level %</label><input type="number" min="1" max="100" value={sl} onChange={(e) => setSl(e.target.value)} />{err('sl')}</div>
            <div className="fld" style={{ flex: 1 }}><label>within seconds</label><input type="number" min="1" max="3600" value={sls} onChange={(e) => setSls(e.target.value)} />{err('sls')}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>ASA target (s)</label><input type="number" min="1" max="3600" value={asa} onChange={(e) => setAsa(e.target.value)} />{err('asa')}</div>
            <div className="fld" style={{ flex: 1 }}><label>Max abandon %</label><input type="number" min="0" max="100" value={abn} onChange={(e) => setAbn(e.target.value)} />{err('abn')}</div>
          </div>
          <div className="sect">Applies to planning groups</div>
          {pgs.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '12.5px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={pgIds.includes(p.id)} onChange={() => togglePg(p.id)} />{p.name}
            </label>
          ))}
          {err('pgs')}
          {!isNew && <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(sg.id, sg.name)}>Delete service goal</button></div>}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
