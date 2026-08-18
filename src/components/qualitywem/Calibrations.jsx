import { useCallback, useEffect, useState } from 'react';
import { downloadCsv as exportCsv } from '../../utils/csv.js';
import ColumnsMenu from '../ColumnsMenu.jsx';

const DIVISIONS = ['All', 'Retail', 'Collections', 'Digital'];
const STATUSES = ['Any', 'Complete', 'In progress', 'Review variance', 'Scheduled'];
const STATUS_CLASS = { Complete: 'ok', 'In progress': 'wn', 'Review variance': 'wn', Scheduled: 'of' };
const divisionOf = (form) => (form.startsWith('Retail') ? 'Retail' : form.startsWith('Complaints') || form.startsWith('Compliance') ? 'Collections' : form.startsWith('Digital') || form.startsWith('Technical') ? 'Digital' : 'All');

// Kept in sync with server/calibration.js NAME_RE/NAME_MIN/NAME_MAX.
const NAME_RE = /^[a-zA-Z\s]+$/;
const NAME_MIN = 3;
const NAME_MAX = 50;
function nameError(name) {
  if (!name) return null;
  if (name.trim().length < NAME_MIN || name.length > NAME_MAX) return `Calibration name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  if (!NAME_RE.test(name)) return 'Only letters and spaces are allowed — no numbers or symbols.';
  return null;
}

const COLS = [
  { key: 'name', label: 'Calibration' },
  { key: 'interaction', label: 'Interaction' },
  { key: 'form', label: 'Form' },
  { key: 'evaluators', label: 'Evaluators' },
  { key: 'completed', label: 'Completed' },
  { key: 'variance', label: 'Variance' },
  { key: 'status', label: 'Status' },
];

// Throws { message, fields } so the drawer can show per-field validation errors from the API.
async function api(path, options) {
  const res = await fetch('/api/calibrations' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || 'Request failed'), { fields: body.fields });
  return body;
}

export default function Calibrations({ toast, askConfirm, onNavigate }) {
  const [rows, setRows] = useState([]);
  const [results, setResults] = useState([]);
  const [consistency, setConsistency] = useState([]);
  const [options, setOptions] = useState({ forms: [], roster: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Calibrations');
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState('All');
  const [status, setStatus] = useState('Any');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [selected, setSelected] = useState([]);
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [showCols, setShowCols] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  // Results and Evaluator Consistency are aggregates of the same evaluator scores,
  // so every reload pulls all three together and they can never disagree.
  const reload = useCallback(async (announce) => {
    try {
      const [list, res, cons] = await Promise.all([api(''), api('/results'), api('/evaluator-consistency')]);
      setRows(list.data);
      setResults(res.data);
      setConsistency(cons.data);
      setSelected((s) => s.filter((id) => list.data.some((r) => r.id === id)));
      if (announce) toast('Refreshed');
    } catch {
      toast('Could not load calibrations from backend');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reload();
    api('/options').then(setOptions).catch(() => {});
  }, [reload]);

  let visible = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  if (division !== 'All') visible = visible.filter((r) => divisionOf(r.form) === division);
  if (status !== 'Any') visible = visible.filter((r) => r.status === status);
  if (sort.key) {
    visible = [...visible].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }
  const cols = COLS.filter((c) => !hiddenCols.has(c.key));

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  }

  function toggleRow(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function toggleAll() {
    setSelected((s) => (s.length === visible.length ? [] : visible.map((r) => r.id)));
  }

  // Persists first, then refreshes — evaluator count, completion, variance and status
  // are all computed by the backend from the scores, so we never guess them here.
  async function save(id, fields) {
    const { data } = id
      ? await api(`/${id}`, { method: 'PUT', body: JSON.stringify(fields) })
      : await api('', { method: 'POST', body: JSON.stringify(fields) });
    setDrawer(null);
    await reload();
    toast(`Calibration saved — <b>${data.name}</b>`);
  }

  function del(id, name) {
    setMenuFor(null);
    askConfirm(`Delete calibration <b>${name}</b>?`, async () => {
      try {
        await api(`/${id}`, { method: 'DELETE' });
        setDrawer(null);
        setSelected((s) => s.filter((x) => x !== id));
        await reload();
        toast('Calibration deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  function delSelected() {
    askConfirm(`Delete <b>${selected.length}</b> selected calibration(s)? Evaluator scores are removed with them.`, async () => {
      try {
        const { deleted } = await api('/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: selected }) });
        setSelected([]);
        await reload();
        toast(`Deleted <b>${deleted}</b> calibration(s)`);
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
          <h1>Calibrations</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawer({ id: null, name: '', interaction: '', form: options.forms[0] || '', assignments: [] })}>+ New Calibration</button>
            <button
              className="btn sec"
              onClick={() => {
                exportCsv(
                  'calibrations.csv',
                  cols.map((c) => c.label),
                  visible.map((r) => cols.map((c) => (c.key === 'completed' ? `${r.completed} / ${r.evaluators}` : r[c.key])))
                );
                toast(`Exported <b>${visible.length}</b> calibrations to CSV`);
              }}
            >
              Export
            </button>
          </div>
        </div>
        <div className="tabs">
          {['Calibrations', 'Results', 'Evaluator Consistency'].map((t) => (
            <div key={t} className={'tb' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
      </div>

      <div className="pbody">
        {tab === 'Calibrations' && (
          <>
            <div className="tbar">
              <input className="s" placeholder="Search calibrations" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <div style={{ position: 'relative' }}>
                <div className="chip columns-menu-trigger" onClick={() => setShowCols((v) => !v)}>⚙ Columns</div>
                {showCols && (
                  <ColumnsMenu
                    columns={COLS}
                    hidden={hiddenCols}
                    onToggle={(key) => setHiddenCols((h) => { const n = new Set(h); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                    onClose={() => setShowCols(false)}
                  />
                )}
              </div>
              <div className="chip" onClick={() => { setSearch(''); setDivision('All'); setStatus('Any'); setSort({ key: null, dir: 1 }); reload(true); }}>↻ Refresh</div>
            </div>

            <div className="tblw">
              <table className="dt">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}><input type="checkbox" checked={selected.length > 0 && selected.length === visible.length} onChange={toggleAll} /></th>
                    {cols.map((c) => (
                      <th key={c.key} className="sortable" onClick={() => toggleSort(c.key)}>
                        {c.label} {sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : '⇅'}
                      </th>
                    ))}
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={cols.length + 2} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</td></tr>}
                  {!loading && visible.map((r) => (
                    <tr key={r.id} onClick={() => setDrawer(r)}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleRow(r.id)} /></td>
                      {cols.map((c) => (
                        <td key={c.key}>
                          {c.key === 'name' ? <b className="lnk">{r.name}</b>
                            : c.key === 'completed' ? `${r.completed} / ${r.evaluators}`
                            : c.key === 'status' ? <span className={'st ' + (STATUS_CLASS[r.status] || 'wn')}><span className="d" />{r.status}</span>
                            : r[c.key]}
                        </td>
                      ))}
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
                  {!loading && !visible.length && <tr><td colSpan={cols.length + 2} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>No calibrations match your filters</td></tr>}
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

        {tab === 'Results' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Calibration</th><th>Interaction</th><th>Evaluators</th><th>Spread</th></tr></thead>
              <tbody>
                {results.map((r, i) => <tr key={i}><td><b>{r.calib}</b></td><td>{r.interaction}</td><td>{r.evaluators}</td><td>{r.spread}</td></tr>)}
                {!results.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>No scores submitted yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Evaluator Consistency' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Evaluator</th><th>Avg score given</th><th>Scores submitted</th><th>vs team avg</th></tr></thead>
              <tbody>
                {consistency.map((r, i) => <tr key={i}><td>{r.evaluator}</td><td>{r.avg}</td><td>{r.scored}</td><td>{r.vs}</td></tr>)}
                {!consistency.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>No scores submitted yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {drawer && <CalibDrawer calib={drawer} options={options} onCancel={() => setDrawer(null)} onSave={save} onDelete={del} />}
    </>
  );
}

function CalibDrawer({ calib, options, onCancel, onSave, onDelete }) {
  const isNew = !calib.id;
  const [name, setName] = useState(calib.name);
  const [interaction, setInteraction] = useState(calib.interaction);
  const [form, setForm] = useState(calib.form);
  const [assignments, setAssignments] = useState(calib.assignments || []);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const liveNameError = touched ? nameError(name) : null;

  function toggleEvaluator(person) {
    setAssignments((list) => (list.some((a) => a.evaluator === person)
      ? list.filter((a) => a.evaluator !== person)
      : [...list, { evaluator: person, score: null }]));
  }
  function setScore(person, score) {
    setAssignments((list) => list.map((a) => (a.evaluator === person ? { ...a, score } : a)));
  }

  // Live preview of what the backend will derive, so the read-only status is never a surprise.
  const scores = assignments.map((a) => a.score).filter((s) => s !== null && String(s).trim() !== '' && !isNaN(+s)).map(Number);
  const allIn = assignments.length >= 2 && scores.length === assignments.length;
  const half = allIn ? (Math.max(...scores) - Math.min(...scores)) / 2 : null;
  const preview = scores.length === 0 ? 'Scheduled' : scores.length < assignments.length ? 'In progress' : half > 5 ? 'Review variance' : 'Complete';

  // Mirrors the server rules so the same messages appear whichever side rejects.
  function check() {
    const e = {};
    const nErr = nameError(name);
    if (nErr) e.name = nErr;
    if (!/^CONV-\d{5,10}$/i.test(interaction.trim())) e.interaction = 'Interaction ID must look like CONV-8841204.';
    if (!options.forms.includes(form)) e.form = 'Choose an evaluation form from the list.';
    if (assignments.length < 2) e.evaluators = 'Select at least 2 evaluators — a calibration compares scorers.';
    if (assignments.some((a) => a.score !== null && String(a.score).trim() !== '' && (!/^\d{1,3}(\.\d{1,2})?$/.test(String(a.score).trim()) || +a.score > 100)))
      e.scores = 'Scores must be 0–100 with at most 2 decimals.';
    return e;
  }

  async function submit() {
    setTouched(true);
    const e = check();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onSave(calib.id, {
        name: name.trim(),
        interaction: interaction.trim().toUpperCase(),
        form,
        evaluators: assignments.map((a) => ({ evaluator: a.evaluator, score: a.score === '' ? null : a.score })),
      });
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
        <div className="dh"><h2>{isNew ? 'New Calibration' : `Edit — ${calib.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          <div className="fld">
            <label>Calibration name *</label>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => { setName(e.target.value); setTouched(true); }}
              onBlur={() => setTouched(true)}
              style={(liveNameError || errors.name) ? { borderColor: '#b3261e', boxShadow: '0 0 0 3px rgba(179,38,30,.1)' } : undefined}
            />
            {(liveNameError || errors.name) && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{liveNameError || errors.name}</div>}
          </div>
          <div className="fld"><label>Interaction ID *</label><input value={interaction} onChange={(e) => setInteraction(e.target.value)} placeholder="CONV-8841204" />{err('interaction')}</div>
          <div className="fld">
            <label>Form *</label>
            <select value={form} onChange={(e) => setForm(e.target.value)}>
              <option value="">— Select a form —</option>
              {options.forms.map((f) => <option key={f}>{f}</option>)}
            </select>
            {err('form')}
          </div>
          <div className="fld">
            <label>Evaluators * (tick to assign, enter a score once they submit)</label>
            {options.roster.map((person) => {
              const a = assignments.find((x) => x.evaluator === person);
              return (
                // The score box sits outside the label so clicking it cannot toggle the assignment.
                <div key={person} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '12.5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={!!a} onChange={() => toggleEvaluator(person)} />
                    {person}
                  </label>
                  {a && (
                    <input
                      type="number" min="0" max="100" step="0.1" placeholder="score"
                      style={{ width: 78 }}
                      value={a.score ?? ''}
                      onChange={(e) => setScore(person, e.target.value === '' ? null : e.target.value)}
                    />
                  )}
                </div>
              );
            })}
            {err('evaluators')}
            {err('scores')}
          </div>
          <div className="fld">
            <label>Status (derived from submitted scores)</label>
            <div style={{ fontSize: 12.5, color: '#3c4a5c' }}>
              <b>{preview}</b> — {scores.length} of {assignments.length} scored
              {half != null && `, variance ± ${half.toFixed(1)}% (over ± 5% needs review)`}
            </div>
          </div>
          {!isNew && <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(calib.id, calib.name)}>Delete calibration</button></div>}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
