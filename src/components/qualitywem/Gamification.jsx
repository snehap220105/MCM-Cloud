import { useCallback, useEffect, useState } from 'react';
import { downloadCsv as exportCsv } from '../../utils/csv.js';

const DIVISIONS = ['All', 'Retail', 'Digital', 'Collections', 'Onboarding', 'Leadership', 'Partner'];
const STATUSES = ['Any', 'Active', 'Pilot'];
const divisionOf = (applies) => {
  const a = applies.toLowerCase();
  if (a.includes('retail')) return 'Retail';
  if (a.includes('digital')) return 'Digital';
  if (a.includes('collections')) return 'Collections';
  if (a.includes('onboarding')) return 'Onboarding';
  if (a.includes('team leader')) return 'Leadership';
  if (a.includes('partner')) return 'Partner';
  return 'All';
};

// Kept in sync with server/gamification.js NAME_RE/NAME_MIN/NAME_MAX.
const NAME_RE = /^[a-zA-Z\s]+$/;
const NAME_MIN = 3;
const NAME_MAX = 50;
function nameError(name) {
  if (!name) return null;
  if (name.trim().length < NAME_MIN || name.length > NAME_MAX) return `Profile name must be ${NAME_MIN}-${NAME_MAX} characters.`;
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

const COLS = [
  { key: 'name', label: 'Metric profile' },
  { key: 'applies', label: 'Applies to' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'target', label: 'Target' },
  { key: 'points', label: 'Points' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'status', label: 'Status' },
];

export default function Gamification({ toast, askConfirm, onNavigate }) {
  const [rows, setRows] = useState([]);
  const [leaderboards, setLeaderboards] = useState([]);
  const [badges, setBadges] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Profiles');
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState('All');
  const [status, setStatus] = useState('Any');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const reload = useCallback(() => Promise.all([
    api('/api/metric-profiles').then((r) => setRows(r.data)),
    api('/api/leaderboards').then((r) => setLeaderboards(r.data)),
    api('/api/badges').then((r) => setBadges(r.data)),
    api('/api/challenges').then((r) => setChallenges(r.data)),
  ]), []);

  useEffect(() => {
    reload().catch(() => toast('Could not load gamification data from backend')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let visible = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  if (division !== 'All') visible = visible.filter((r) => divisionOf(r.applies) === division);
  if (status !== 'Any') visible = visible.filter((r) => r.status === status);
  if (sort.key) {
    visible = [...visible].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  }
  function toggleRow(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function toggleAll() {
    setSelected((s) => (s.length === visible.length ? [] : visible.map((r) => r.id)));
  }

  // Persists first, then refreshes — the table shown always matches the DB.
  async function save(id, fields) {
    const { data } = id
      ? await api(`/api/metric-profiles/${id}`, { method: 'PUT', body: JSON.stringify(fields) })
      : await api('/api/metric-profiles', { method: 'POST', body: JSON.stringify(fields) });
    setDrawer(null);
    await reload();
    toast(`Profile saved — <b>${data.name}</b>`);
  }

  function del(id, name) {
    setMenuFor(null);
    askConfirm(`Delete metric profile <b>${name}</b>?`, async () => {
      try {
        await api(`/api/metric-profiles/${id}`, { method: 'DELETE' });
        setDrawer(null);
        setSelected((s) => s.filter((x) => x !== id));
        await reload();
        toast('Profile deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  function delSelected() {
    askConfirm(`Delete <b>${selected.length}</b> selected profile(s)?`, async () => {
      try {
        const { deleted } = await api('/api/metric-profiles/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: selected }) });
        setSelected([]);
        await reload();
        toast(`Deleted <b>${deleted}</b> profile(s)`);
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
          <h1>Gamification</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawer({ id: null, name: '', applies: '', metrics: 1, target: '', points: 500, leaderboard: 'Enabled', status: 'Active' })}>+ Create Profile</button>
            <button
              className="btn sec"
              onClick={() => {
                exportCsv(
                  'gamification-profiles.csv',
                  ['Metric profile', 'Applies to', 'Metrics', 'Target', 'Points', 'Leaderboard', 'Status'],
                  visible.map((r) => [r.name, r.applies, r.metrics, r.target, r.points, r.leaderboard, r.status])
                );
                toast(`Exported <b>${visible.length}</b> profiles to CSV`);
              }}
            >
              Export
            </button>
          </div>
        </div>
        <div className="tabs">
          {['Profiles', 'Leaderboards', 'Badges', 'Challenges'].map((t) => (
            <div key={t} className={'tb' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
      </div>

      <div className="pbody">
        {tab === 'Profiles' && (
          <>
            <div className="tbar">
              <input className="s" placeholder="Search gamification" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="chip" value={division} onChange={(e) => setDivision(e.target.value)}>
                {DIVISIONS.map((d) => <option key={d} value={d}>Division: {d}</option>)}
              </select>
              <select className="chip" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>Status: {s}</option>)}
              </select>
              <div className="sp" />
              {selected.length > 0 && (
                <div className="chip" style={{ color: '#b3261e' }} onClick={delSelected}>🗑 Delete {selected.length} selected</div>
              )}
              <div className="chip">⚙ Columns</div>
              <div className="chip" onClick={() => { setSearch(''); setDivision('All'); setStatus('Any'); setSort({ key: null, dir: 1 }); reload().then(() => toast('Refreshed')); }}>↻ Refresh</div>
            </div>

            <div className="tblw">
              <table className="dt">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}><input type="checkbox" checked={selected.length > 0 && selected.length === visible.length} onChange={toggleAll} /></th>
                    {COLS.map((c) => (
                      <th key={c.key} className="sortable" onClick={() => toggleSort(c.key)}>
                        {c.label} {sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : '⇅'}
                      </th>
                    ))}
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</td></tr>}
                  {!loading && visible.map((r) => (
                    <tr key={r.id} onClick={() => setDrawer(r)}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleRow(r.id)} /></td>
                      <td><b className="lnk">{r.name}</b></td>
                      <td>{r.applies}</td>
                      <td>{r.metrics}</td>
                      <td>{r.target}</td>
                      <td>{r.points.toLocaleString()}</td>
                      <td>{r.leaderboard === 'Enabled' ? <span className="st ok"><span className="d" />Enabled</span> : <span className="st of"><span className="d" />Hidden</span>}</td>
                      <td>{r.status === 'Active' ? <span className="st ok"><span className="d" />Active</span> : <span className="st wn"><span className="d" />Pilot</span>}</td>
                      <td style={{ color: '#a9b3c2', position: 'relative' }} onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === r.id ? null : r.id); }}>
                        ⋮
                        {menuFor === r.id && (
                          <div style={{ position: 'absolute', right: 0, top: 24, background: '#fff', border: '1px solid #dde3ec', borderRadius: 6, boxShadow: '0 10px 24px rgba(16,30,60,.18)', zIndex: 5, minWidth: 120 }}>
                            <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#3c4a5c', cursor: 'pointer' }} onClick={() => { setMenuFor(null); setDrawer(r); }}>Edit</div>
                            <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#b3261e', cursor: 'pointer' }} onClick={() => del(r.id, r.name)}>Delete</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && !visible.length && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>No profiles match your filters</td></tr>}
                </tbody>
              </table>
              <div className="pgr">
                <span>Showing <b>{visible.length ? 1 : 0}–{visible.length}</b> of <b>{rows.length}</b></span>
                <div className="sp" />
                <span>Rows per page 25 ▾</span>
                <span>‹ ›</span>
              </div>
            </div>
          </>
        )}

        {tab === 'Leaderboards' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Leaderboard</th><th>Metric profile</th><th>Period</th><th>Participants</th><th>Status</th></tr></thead>
              <tbody>
                {leaderboards.map((r, i) => (
                  <tr key={i}><td><b>{r.name}</b></td><td>{r.profile}</td><td>{r.period}</td><td>{r.participants}</td><td><span className="st ok"><span className="d" />{r.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Badges' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Badge</th><th>Criteria</th><th>Points</th><th>Awarded</th></tr></thead>
              <tbody>
                {badges.map((r, i) => (
                  <tr key={i}><td><b>{r.name}</b></td><td>{r.criteria}</td><td>{r.points}</td><td>{r.awarded}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Challenges' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Challenge</th><th>Metric</th><th>Goal</th><th>Duration</th><th>Status</th></tr></thead>
              <tbody>
                {challenges.map((r, i) => (
                  <tr key={i}><td><b>{r.name}</b></td><td>{r.metric}</td><td>{r.goal}</td><td>{r.duration}</td><td><span className={'st ' + (r.status === 'Running' ? 'ok' : 'wn')}><span className="d" />{r.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {drawer && <ProfileDrawer profile={drawer} onCancel={() => setDrawer(null)} onSave={save} onDelete={del} />}
    </>
  );
}

function ProfileDrawer({ profile, onCancel, onSave, onDelete }) {
  const isNew = !profile.id;
  const [name, setName] = useState(profile.name);
  const [applies, setApplies] = useState(profile.applies);
  const [metrics, setMetrics] = useState(profile.metrics);
  const [target, setTarget] = useState(profile.target);
  const [points, setPoints] = useState(profile.points);
  const [leaderboard, setLeaderboard] = useState(profile.leaderboard);
  const [status, setStatus] = useState(profile.status);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const liveNameError = touched ? nameError(name) : null;

  async function submit() {
    setTouched(true);
    const e = {};
    const nErr = nameError(name);
    if (nErr) e.name = nErr;
    if (applies.trim().length < 2) e.applies = '"Applies to" is required.';
    const m = parseInt(metrics, 10);
    if (!(m >= 1 && m <= 20)) e.metrics = 'Metrics count must be 1–20.';
    const p = parseInt(points, 10);
    if (!(p >= 0 && p <= 100000)) e.points = 'Points must be 0–100,000.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onSave(profile.id, { name: name.trim(), applies: applies.trim(), metrics: m, target: target.trim(), points: p, leaderboard, status });
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
        <div className="dh"><h2>{isNew ? 'New Metric Profile' : `Edit — ${profile.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          <div className="fld">
            <label>Profile name *</label>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => { setName(e.target.value); setTouched(true); }}
              onBlur={() => setTouched(true)}
              style={(liveNameError || errors.name) ? { borderColor: '#b3261e', boxShadow: '0 0 0 3px rgba(179,38,30,.1)' } : undefined}
            />
            {(liveNameError || errors.name) && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{liveNameError || errors.name}</div>}
          </div>
          <div className="fld"><label>Applies to *</label><input value={applies} onChange={(e) => setApplies(e.target.value)} placeholder="e.g. Retail Billing, Retail Technical" />{err('applies')}</div>
          <div className="fld"><label>Target</label><input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. SL 85%, QA 90%" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label>Metrics count</label><input type="number" min="1" max="20" value={metrics} onChange={(e) => setMetrics(e.target.value)} />{err('metrics')}</div>
            <div className="fld" style={{ flex: 1 }}><label>Points</label><input type="number" min="0" max="100000" value={points} onChange={(e) => setPoints(e.target.value)} />{err('points')}</div>
          </div>
          <div className="fld">
            <label>Leaderboard</label>
            <select value={leaderboard} onChange={(e) => setLeaderboard(e.target.value)}>
              {['Enabled', 'Hidden'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {['Active', 'Pilot'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          {!isNew && <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(profile.id, profile.name)}>Delete profile</button></div>}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
