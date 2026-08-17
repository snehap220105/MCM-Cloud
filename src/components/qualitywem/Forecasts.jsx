import { useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_WEIGHT = { Mon: 1.15, Tue: 1.05, Wed: 1.0, Thu: 1.0, Fri: 0.95, Sat: 0.55, Sun: 0.3 };
const QUEUES = ['Retail_Billing_L1', 'Retail_Complaints', 'Digital_Messaging', 'Collections_Arrears'];
const SKILLS = ['Billing', 'Retention', 'Collections', 'Technical', 'Sales'];
const LANGS = ['English', 'Hindi'];

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

const INITIAL_PG = [
  { id: 'pg1', name: 'Retail Voice', queues: ['Retail_Billing_L1', 'Retail_Complaints'], skills: ['Billing', 'Retention'], langs: ['English'] },
  { id: 'pg2', name: 'Collections', queues: ['Collections_Arrears'], skills: ['Collections'], langs: ['English', 'Hindi'] },
  { id: 'pg3', name: 'Digital Messaging', queues: ['Digital_Messaging'], skills: ['Technical', 'Sales'], langs: ['English'] },
];

const INITIAL_SG = [
  { id: 'sg1', name: 'Voice standard', sl: 80, sls: 20, asa: 30, abn: 5, pgs: ['pg1', 'pg2'] },
  { id: 'sg2', name: 'Digital standard', sl: 85, sls: 40, asa: 60, abn: 0, pgs: ['pg3'] },
];

let uidSeq = 100;
const uid = () => 'fc' + uidSeq++;

export default function Forecasts({ toast, askConfirm, forecasts, setForecasts, initialTab, onNavigate }) {
  const [pgs, setPgs] = useState(INITIAL_PG);
  const [sgs, setSgs] = useState(INITIAL_SG);
  const [tab, setTab] = useState(initialTab || 'Forecasts');
  const [pgDrawer, setPgDrawer] = useState(null);
  const [sgDrawer, setSgDrawer] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const pgById = (id) => pgs.find((p) => p.id === id);

  function genForecast() {
    const week = currentWeekLabel();
    if (forecasts.some((f) => f.week === week)) { toast(`A forecast for ${week} already exists — delete it to regenerate`); return; }
    const data = {};
    pgs.forEach((p) => {
      const vol = 120 + (hash(p.name) % 160);
      const aht = 180 + (hash(p.name) % 140);
      const days = {};
      DAYS.forEach((d) => { days[d] = Math.round((vol * DAY_WEIGHT[d]) / 5); });
      data[p.id] = { vol, aht, days };
    });
    setForecasts((list) => [{ id: uid(), week, status: 'Generated (ABM)', t: new Date().toLocaleTimeString(), data }, ...list]);
    toast(`Forecast generated for <b>${week}</b> across ${pgs.length} planning groups`);
  }

  function delForecast(id, week) {
    askConfirm(`Delete forecast <b>${week}</b>?`, () => {
      setForecasts((list) => list.filter((f) => f.id !== id));
      toast('Deleted');
    });
  }

  function savePG(id, fields) {
    setPgs((list) => (id ? list.map((p) => (p.id === id ? { ...p, ...fields } : p)) : [...list, { id: uid(), ...fields }]));
    setPgDrawer(null);
    toast('Planning group saved');
  }

  function delPG(id, name) {
    setMenuFor(null);
    askConfirm(`Delete planning group <b>${name}</b>? Forecasts for it are removed.`, () => {
      setPgs((list) => list.filter((p) => p.id !== id));
      setSgs((list) => list.map((g) => ({ ...g, pgs: g.pgs.filter((x) => x !== id) })));
      setForecasts((list) => list.map((f) => { const d = { ...f.data }; delete d[id]; return { ...f, data: d }; }));
      toast('Deleted');
    });
  }

  function saveSG(id, fields) {
    setSgs((list) => (id ? list.map((g) => (g.id === id ? { ...g, ...fields } : g)) : [...list, { id: uid(), ...fields }]));
    setSgDrawer(null);
    toast('Service goal saved');
  }

  function delSG(id, name) {
    setMenuFor(null);
    askConfirm(`Delete service goal <b>${name}</b>?`, () => {
      setSgs((list) => list.filter((g) => g.id !== id));
      toast('Deleted');
    });
  }

  return (
    <>
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Quality &amp; WEM</div>
        <div className="tt">
          <h1>Forecasts</h1>
          <div className="rt">
            {tab === 'Forecasts' && <button className="btn" onClick={genForecast}>⚡ Generate Forecast ({currentWeekLabel()})</button>}
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
          forecasts.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #ccd4e0', borderRadius: 10, padding: 26, textAlign: 'center', color: '#8794a8', fontSize: 13 }}>
              No forecast yet — Generate derives weekly volume &amp; AHT per planning group from interaction history (ABM: automatic best method).
            </div>
          ) : (
            forecasts.map((f) => (
              <div key={f.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 8px' }}>
                  <b style={{ fontSize: 14 }}>{f.week}</b>
                  <span className="st ok"><span className="d" />{f.status}</span>
                  <span style={{ color: '#8794a8', fontSize: '11.5px' }}>generated {f.t}</span>
                  <div style={{ flex: 1 }} />
                  <a className="lnk" style={{ fontSize: 12 }} onClick={() => delForecast(f.id, f.week)}>Delete</a>
                </div>
                <div className="tblw">
                  <table className="dt">
                    <thead>
                      <tr><th>Planning group</th><th>Weekly vol</th><th>AHT</th>{DAYS.map((d) => <th key={d} style={{ textAlign: 'right' }}>{d}</th>)}</tr>
                    </thead>
                    <tbody>
                      {Object.keys(f.data).map((pgid) => {
                        const p = pgById(pgid);
                        if (!p) return null;
                        const d = f.data[pgid];
                        return (
                          <tr key={pgid}>
                            <td><b>{p.name}</b><br /><span style={{ color: '#8794a8', fontSize: 11 }}>skills: {p.skills.join(', ')}</span></td>
                            <td>{d.vol}</td>
                            <td>{d.aht}s</td>
                            {DAYS.map((day) => <td key={day} style={{ textAlign: 'right' }}>{d.days[day] || 0}</td>)}
                          </tr>
                        );
                      })}
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
                  {pgs.map((p) => (
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
                {sgs.map((g) => (
                  <tr key={g.id} onClick={() => setSgDrawer(g)}>
                    <td><b className="lnk">{g.name}</b></td>
                    <td>{g.sl}% in {g.sls}s</td>
                    <td>≤ {g.asa}s</td>
                    <td>{g.abn ? `≤ ${g.abn}%` : '—'}</td>
                    <td>{g.pgs.map((id) => { const p = pgById(id); return p ? <span className="tag" key={id}>{p.name}</span> : null; })}</td>
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
        <PGDrawer pg={pgDrawer} onCancel={() => setPgDrawer(null)} onSave={savePG} onDelete={delPG} toast={toast} />
      )}
      {sgDrawer && (
        <SGDrawer sg={sgDrawer} pgs={pgs} onCancel={() => setSgDrawer(null)} onSave={saveSG} onDelete={delSG} />
      )}
    </>
  );
}

function PGDrawer({ pg, onCancel, onSave, onDelete, toast }) {
  const isNew = !pg.id;
  const [name, setName] = useState(pg.name);
  const [queues, setQueues] = useState(pg.queues);
  const [skills, setSkills] = useState(pg.skills);
  const [langs, setLangs] = useState(pg.langs);
  const [error, setError] = useState('');

  const toggle = (setter) => (val) => setter((list) => (list.includes(val) ? list.filter((x) => x !== val) : [...list, val]));

  function submit() {
    if (name.trim().length < 2) { setError('Name is required.'); return; }
    if (!queues.length) { setError('Pick at least one queue — a planning group must cover route paths.'); return; }
    onSave(pg.id, { name: name.trim(), queues, skills, langs });
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'New Planning Group' : `Edit — ${pg.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="fld"><label>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="sect">Route paths — queues</div>
          {QUEUES.map((q) => (
            <label key={q} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '12.5px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={queues.includes(q)} onChange={() => toggle(setQueues)(q)} />{q}
            </label>
          ))}
          <div className="sect">ACD skills (from Routing › Skills)</div>
          {SKILLS.map((s) => (
            <label key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, margin: '0 12px 6px 0', fontSize: '12.5px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={skills.includes(s)} onChange={() => toggle(setSkills)(s)} />{s}
            </label>
          ))}
          <div className="sect">Languages</div>
          {LANGS.map((l) => (
            <label key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, margin: '0 12px 6px 0', fontSize: '12.5px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={langs.includes(l)} onChange={() => toggle(setLangs)(l)} />{l}
            </label>
          ))}
          {!isNew && <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(pg.id, pg.name)}>Delete planning group</button></div>}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={submit}>Save</button>
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
  const [error, setError] = useState('');

  function togglePg(id) {
    setPgIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  function submit() {
    if (name.trim().length < 2) { setError('Name is required.'); return; }
    onSave(sg.id, {
      name: name.trim(),
      sl: Math.min(100, parseInt(sl, 10) || 80),
      sls: parseInt(sls, 10) || 20,
      asa: parseInt(asa, 10) || 30,
      abn: parseInt(abn, 10) || 0,
      pgs: pgIds,
    });
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'New Service Goal' : `Edit — ${sg.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="fld"><label>Template name *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Service level %</label><input type="number" value={sl} onChange={(e) => setSl(e.target.value)} /></div>
            <div className="fld" style={{ flex: 1 }}><label>within seconds</label><input type="number" value={sls} onChange={(e) => setSls(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>ASA target (s)</label><input type="number" value={asa} onChange={(e) => setAsa(e.target.value)} /></div>
            <div className="fld" style={{ flex: 1 }}><label>Max abandon %</label><input type="number" value={abn} onChange={(e) => setAbn(e.target.value)} /></div>
          </div>
          <div className="sect">Applies to planning groups</div>
          {pgs.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '12.5px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={pgIds.includes(p.id)} onChange={() => togglePg(p.id)} />{p.name}
            </label>
          ))}
          {!isNew && <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(sg.id, sg.name)}>Delete service goal</button></div>}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}
