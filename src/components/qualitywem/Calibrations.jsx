import { useState } from 'react';
import { downloadCsv as exportCsv } from '../../utils/csv.js';

const DIVISIONS = ['All', 'Retail', 'Collections', 'Digital'];
const STATUSES = ['Any', 'Complete', 'In progress', 'Review variance', 'Scheduled'];
const STATUS_CLASS = { Complete: 'ok', 'In progress': 'wn', 'Review variance': 'wn', Scheduled: 'of' };
const divisionOf = (form) => (form.startsWith('Retail') ? 'Retail' : form.startsWith('Complaints') || form.startsWith('Compliance') ? 'Collections' : form.startsWith('Digital') || form.startsWith('Technical') ? 'Digital' : 'All');

const INITIAL = [
  { id: 'c1', name: 'Aug — Billing tone check', interaction: 'CONV-8841204', form: 'Retail Quality v4', evaluators: 6, completed: 6, variance: '± 4.2%', status: 'Complete' },
  { id: 'c2', name: 'Aug — Complaint handling', interaction: 'CONV-8839117', form: 'Complaints v2', evaluators: 5, completed: 3, variance: '—', status: 'In progress' },
  { id: 'c3', name: 'Jul — Technical accuracy', interaction: 'CONV-8790442', form: 'Technical v3', evaluators: 4, completed: 4, variance: '± 9.8%', status: 'Review variance' },
  { id: 'c4', name: 'Jul — Chat quality', interaction: 'CONV-8788013', form: 'Digital v2', evaluators: 5, completed: 5, variance: '± 3.1%', status: 'Complete' },
  { id: 'c5', name: 'Jun — Collections compliance', interaction: 'CONV-8712880', form: 'Compliance v1', evaluators: 7, completed: 7, variance: '± 2.4%', status: 'Complete' },
  { id: 'c6', name: 'Sep — New starters', interaction: 'CONV-8850019', form: 'Retail Quality v4', evaluators: 8, completed: 0, variance: '—', status: 'Scheduled' },
];

const RESULTS = [
  { calib: 'July QA calibration', interaction: 'Oliver Smith · Retail_Billing_L1', evaluators: 3, spread: '82% / 85% / 79% — within 6 pts' },
];
const CONSISTENCY = [
  { evaluator: 'Grace Adeyemi', avg: '84%', vs: '+1.5' },
  { evaluator: 'Marco Rossi', avg: '80%', vs: '−2.5' },
];

let uidSeq = 100;
const uid = () => 'c' + uidSeq++;

const COLS = [
  { key: 'name', label: 'Calibration' },
  { key: 'interaction', label: 'Interaction' },
  { key: 'form', label: 'Form' },
  { key: 'evaluators', label: 'Evaluators' },
  { key: 'completed', label: 'Completed' },
  { key: 'variance', label: 'Variance' },
  { key: 'status', label: 'Status' },
];

export default function Calibrations({ toast, askConfirm, onNavigate }) {
  const [rows, setRows] = useState(INITIAL);
  const [tab, setTab] = useState('Calibrations');
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState('All');
  const [status, setStatus] = useState('Any');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  let visible = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  if (division !== 'All') visible = visible.filter((r) => divisionOf(r.form) === division);
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

  function save(id, fields) {
    setRows((list) => (id ? list.map((r) => (r.id === id ? { ...r, ...fields } : r)) : [...list, { id: uid(), ...fields }]));
    setDrawer(null);
    toast(`Calibration saved — <b>${fields.name}</b>`);
  }

  function del(id, name) {
    setMenuFor(null);
    askConfirm(`Delete calibration <b>${name}</b>?`, () => {
      setRows((list) => list.filter((r) => r.id !== id));
      setSelected((s) => s.filter((x) => x !== id));
      toast('Calibration deleted');
    });
  }

  return (
    <>
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Quality &amp; WEM</div>
        <div className="tt">
          <h1>Calibrations</h1>
          <div className="rt">
            <button className="btn" onClick={() => setDrawer({ id: null, name: '', interaction: '', form: '', evaluators: 1, completed: 0, variance: '—', status: 'Scheduled' })}>+ New Calibration</button>
            <button
              className="btn sec"
              onClick={() => {
                exportCsv(
                  'calibrations.csv',
                  ['Calibration', 'Interaction', 'Form', 'Evaluators', 'Completed', 'Variance', 'Status'],
                  visible.map((r) => [r.name, r.interaction, r.form, r.evaluators, `${r.completed} / ${r.evaluators}`, r.variance, r.status])
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
              <div className="chip">⚙ Columns</div>
              <div className="chip" onClick={() => { setSearch(''); setDivision('All'); setStatus('Any'); setSort({ key: null, dir: 1 }); toast('Refreshed'); }}>↻ Refresh</div>
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
                  {visible.map((r) => (
                    <tr key={r.id} onClick={() => setDrawer(r)}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleRow(r.id)} /></td>
                      <td><b className="lnk">{r.name}</b></td>
                      <td>{r.interaction}</td>
                      <td>{r.form}</td>
                      <td>{r.evaluators}</td>
                      <td>{r.completed} / {r.evaluators}</td>
                      <td>{r.variance}</td>
                      <td><span className={'st ' + (STATUS_CLASS[r.status] || 'wn')}><span className="d" />{r.status}</span></td>
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
                  {!visible.length && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>No calibrations match your filters</td></tr>}
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
                {RESULTS.map((r, i) => <tr key={i}><td><b>{r.calib}</b></td><td>{r.interaction}</td><td>{r.evaluators}</td><td>{r.spread}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Evaluator Consistency' && (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Evaluator</th><th>Avg score given</th><th>vs team avg</th></tr></thead>
              <tbody>
                {CONSISTENCY.map((r, i) => <tr key={i}><td>{r.evaluator}</td><td>{r.avg}</td><td>{r.vs}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {drawer && <CalibDrawer calib={drawer} onCancel={() => setDrawer(null)} onSave={save} onDelete={del} />}
    </>
  );
}

function CalibDrawer({ calib, onCancel, onSave, onDelete }) {
  const isNew = !calib.id;
  const [name, setName] = useState(calib.name);
  const [interaction, setInteraction] = useState(calib.interaction);
  const [form, setForm] = useState(calib.form);
  const [evaluators, setEvaluators] = useState(calib.evaluators);
  const [status, setStatus] = useState(calib.status);
  const [error, setError] = useState('');

  function submit() {
    if (name.trim().length < 2) { setError('Calibration name is required.'); return; }
    if (interaction.trim().length < 2) { setError('Interaction ID is required.'); return; }
    onSave(calib.id, { name: name.trim(), interaction: interaction.trim(), form: form.trim() || '—', evaluators: Math.max(1, parseInt(evaluators, 10) || 1), completed: calib.completed || 0, variance: calib.variance || '—', status });
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'New Calibration' : `Edit — ${calib.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="fld"><label>Calibration name *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="fld"><label>Interaction ID *</label><input value={interaction} onChange={(e) => setInteraction(e.target.value)} placeholder="CONV-XXXXXXX" /></div>
          <div className="fld"><label>Form</label><input value={form} onChange={(e) => setForm(e.target.value)} /></div>
          <div className="fld"><label>Evaluators</label><input type="number" min="1" value={evaluators} onChange={(e) => setEvaluators(e.target.value)} /></div>
          <div className="fld">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {['Scheduled', 'In progress', 'Review variance', 'Complete'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          {!isNew && <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(calib.id, calib.name)}>Delete calibration</button></div>}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}
