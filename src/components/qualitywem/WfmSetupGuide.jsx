import { useCallback, useEffect, useState } from 'react';
import AddManagementUnitModal from './AddManagementUnitModal.jsx';

async function saveToBackend(data) {
  const res = await fetch('/api/wfm-setup', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error('Failed to save WFM setup');
}

async function mgmtApi(path, options) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw Object.assign(new Error(body.error || 'Request failed'), { fields: body.fields });
  return body;
}

const INITIAL = {
  bu: { name: 'UK Contact Centre', tz: 'Europe/London', weekStart: 'Monday' },
  activityCodes: 6,
  planningGroups: ['Retail Voice', 'Collections', 'Digital Messaging'],
  serviceGoals: [{ name: 'Voice standard', sl: 80, sls: 20 }, { name: 'Digital standard', sl: 85, sls: 40 }],
  workPlans: { count: 2, agents: 6 },
  forecast: null,
  schedule: null,
  published: false,
};

export default function WfmSetupGuide({ toast, askConfirm, onNavigate }) {
  const [data, setData] = useState(INITIAL);
  const [buDrawer, setBuDrawer] = useState(false);
  const [addMuOpen, setAddMuOpen] = useState(false);
  const [editMu, setEditMu] = useState(null); // { id, name, agents: [{id,name}] } or null

  // Management units / agents live in their own relational tables (management_units, agents),
  // not the JSONB wfm_setup blob — an agent belongs to at most one MU, which a document store
  // can't enforce.
  const [mus, setMus] = useState([]);
  const reloadMUs = useCallback(() => {
    mgmtApi('/api/management-units').then((res) => setMus(res.data)).catch(() => toast('Could not load management units'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load persisted setup from the backend once; fall back to INITIAL (and seed the row) if none exists yet.
  useEffect(() => {
    fetch('/api/wfm-setup')
      .then((r) => r.json())
      .then(({ data: saved }) => {
        if (saved) setData(saved);
        else saveToBackend(INITIAL).catch(() => toast('Could not reach WFM backend'));
      })
      .catch(() => toast('Could not reach WFM backend'));
    reloadMUs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Updates local state and persists the full setup object to Postgres via the API.
  function update(updater) {
    setData((d) => {
      const next = updater(d);
      saveToBackend(next).catch(() => toast('Could not save to backend'));
      return next;
    });
  }

  const totalAgents = mus.reduce((a, m) => a + m.agents.length, 0);

  const steps = [
    {
      n: 1,
      t: 'Business Unit & Management Units',
      d: 'The Business Unit sets timezone and week start; Management Units group agents for scheduling and adherence. Configure below — MU membership drives who gets scheduled.',
      ok: mus.length > 0,
      detail: `BU "${data.bu.name}" · ${mus.length} MUs, ${totalAgents} agents`,
      onGo: () => document.getElementById('bu-anchor')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      n: 2,
      t: 'Activity codes',
      d: 'Categories of schedulable time (On Queue, Break, Meal, Meeting, Training, Time Off) with paid and adherence behaviour.',
      ok: data.activityCodes > 0,
      detail: `${data.activityCodes} codes`,
      nav: { page: 'schedules-wfm', tab: 'Activity Codes' },
    },
    {
      n: 3,
      t: 'Planning groups (queue + ACD skill + language)',
      d: 'The forecasting unit. Each planning group is a set of route paths — your real queues, ACD skills and languages. This is where WFM plugs into your ACD configuration.',
      ok: data.planningGroups.length > 0,
      detail: data.planningGroups.join(', '),
      nav: { page: 'forecasts', tab: 'Planning Groups' },
    },
    {
      n: 4,
      t: 'Service goal templates',
      d: 'Service level %, ASA and abandon targets per planning group — the goals staffing requirements are computed against.',
      ok: data.serviceGoals.length > 0,
      detail: data.serviceGoals.map((g) => `${g.name} (${g.sl}/${g.sls})`).join(' · '),
      nav: { page: 'forecasts', tab: 'Service Goals' },
    },
    {
      n: 5,
      t: 'Work plans',
      d: 'Shift rules per agent: days, length, flexible start window, paid hours. Agents without a work plan cannot be scheduled.',
      ok: data.workPlans.count > 0,
      detail: `${data.workPlans.count} plans covering ${data.workPlans.agents} agents`,
      nav: { page: 'schedules-wfm', tab: 'Work Plans' },
    },
    {
      n: 6,
      t: 'Generate the forecast',
      d: 'Volume + AHT per planning group per weekday, derived from historical interaction load (ABM — automatic best method in real Genesys).',
      ok: !!data.forecast,
      detail: data.forecast ? `${data.forecast} generated` : 'no forecast yet',
      nav: { page: 'forecasts', tab: 'Forecasts' },
    },
    {
      n: 7,
      t: 'Generate & publish the schedule',
      d: 'Schedules are generated against the forecast honouring work plans, then published so agents see them. Coverage vs requirement is shown per day.',
      ok: data.published,
      detail: data.schedule ? `${data.schedule} — ${data.published ? 'Published' : 'Draft'}` : 'no schedule yet',
      nav: { page: 'schedules-wfm', tab: 'Schedules' },
    },
    {
      n: 8,
      t: 'Monitor adherence',
      d: 'Real-time scheduled-vs-actual per agent, with exception handling. Time-off approvals and shift trades update the schedule.',
      ok: data.published,
      detail: data.published ? 'live on the Adherence page' : 'publish a schedule first',
      nav: { page: 'adherence' },
    },
  ];
  const done = steps.filter((s) => s.ok).length;

  function handleStepAction(s) {
    if (s.onGo) return s.onGo();
    if (s.nav) return onNavigate(s.nav.page, s.nav.tab);
    toast(`Step "${s.t}" isn’t built in this prototype.`);
  }

  function saveBU(name, tz, weekStart) {
    update((d) => ({ ...d, bu: { name, tz, weekStart } }));
    setBuDrawer(false);
    toast('Business unit saved');
  }

// Edits an existing MU: same validated PUT the "Add Management Unit" modal uses for POST.
  async function saveEditMU(id, name, agentIds) {
    try {
      await mgmtApi(`/api/management-units/${id}`, { method: 'PUT', body: JSON.stringify({ name, agentIds }) });
      setEditMu(null);
      reloadMUs();
      toast('Management unit saved');
    } catch (e) {
      throw e; // surfaced as an inline field error by MUDrawer
    }
  }

  function deleteMU(id, name) {
    askConfirm(`Delete MU <b>${name}</b>? Its agents will be unscheduled.`, async () => {
      try {
        await mgmtApi(`/api/management-units/${id}`, { method: 'DELETE' });
        setEditMu(null);
        reloadMUs();
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
          <h1>WFM Setup Guide</h1>
          <div className="rt">
            <span className="tag" style={{ fontSize: 12, padding: '6px 12px' }}>{done} of 8 steps complete</span>
          </div>
        </div>
        <div className="tabs"><div className="tb on">Genesys workforce-management build order</div></div>
      </div>

      <div className="pbody">
        <div style={{ height: 6, background: '#eef1f6', borderRadius: 3, marginBottom: 16 }}>
          <div style={{ height: 6, borderRadius: 3, background: '#1f9d63', width: `${(done / 8) * 100}%` }} />
        </div>

        {steps.map((s) => (
          <div key={s.n} style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: 10, padding: '14px 18px', marginBottom: 10, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', background: s.ok ? '#1f9d63' : '#c9d2df' }}>
              {s.ok ? '✓' : s.n}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <b style={{ fontSize: 14, color: '#152550' }}>{s.t}</b>
                {s.ok ? <span className="st ok"><span className="d" />Done</span> : <span className="st wn"><span className="d" />To do</span>}
              </div>
              <div style={{ fontSize: '12.5px', color: '#5b6b82', lineHeight: 1.6, margin: '4px 0 6px' }}>{s.d}</div>
              <div style={{ fontSize: '11.5px', color: '#8794a8' }}>Status: {s.detail}</div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <button className={'btn' + (s.ok ? ' sec' : '')} style={{ height: 30 }} onClick={() => handleStepAction(s)}>
                {s.ok ? 'Review' : 'Configure'}
              </button>
            </div>
          </div>
        ))}

        <h1 id="bu-anchor" style={{ fontSize: 15, margin: '18px 0 8px' }}>Business Unit &amp; Management Units</h1>
        <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: 10, padding: '14px 18px', marginBottom: 10, display: 'flex', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase' }}>Business unit</div>
            <b style={{ fontSize: 14 }}>{data.bu.name}</b>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase' }}>Time zone</div>
            {data.bu.tz}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase' }}>Week starts</div>
            {data.bu.weekStart}
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn sec" onClick={() => setBuDrawer(true)}>Edit BU</button>
          <button className="btn" onClick={() => setAddMuOpen(true)}>+ Add MU</button>
        </div>

        <div className="tblw">
          <table className="dt">
            <thead><tr><th>Management unit</th><th>Agents</th><th></th></tr></thead>
            <tbody>
              {mus.map((m) => (
                <tr key={m.id}>
                  <td><b className="lnk" onClick={() => setEditMu(m)}>{m.name}</b></td>
                  <td>{m.agents.map((a) => <span className="tag" key={a.id}>{a.name}</span>)}</td>
                  <td style={{ width: 70 }}><a className="lnk" style={{ fontSize: 12 }} onClick={() => deleteMU(m.id, m.name)}>Delete</a></td>
                </tr>
              ))}
              {!mus.length && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>No management units yet</td></tr>}
            </tbody>
          </table>
        </div>

      </div>

      {buDrawer && <BUDrawer bu={data.bu} onCancel={() => setBuDrawer(false)} onSave={saveBU} />}

      <AddManagementUnitModal open={addMuOpen} onClose={() => setAddMuOpen(false)} onSaved={reloadMUs} />

      {editMu && <MUDrawer mu={editMu} onCancel={() => setEditMu(null)} onSave={saveEditMU} onDelete={deleteMU} />}
    </>
  );
}

function BUDrawer({ bu, onCancel, onSave }) {
  const [name, setName] = useState(bu.name);
  const [tz, setTz] = useState(bu.tz);
  const [weekStart, setWeekStart] = useState(bu.weekStart);
  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" className="short" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>Business Unit</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          <div className="fld"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="fld">
            <label>Time zone</label>
            <select value={tz} onChange={(e) => setTz(e.target.value)}>
              {['Europe/London', 'Asia/Kolkata', 'America/New_York', 'UTC'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Week start day</label>
            <select value={weekStart} onChange={(e) => setWeekStart(e.target.value)}>
              {['Monday', 'Sunday'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={() => onSave(name.trim() || bu.name, tz, weekStart)}>Save</button>
        </div>
      </div>
    </div>
  );
}

// Edits an existing management unit against the same relational backend the "Add" modal
// writes to. Loads the live agent roster (with current MU assignments) on open so
// "(in another MU)" tags and reassignment reflect whatever anyone else just saved.
function MUDrawer({ mu, onCancel, onSave, onDelete }) {
  const [name, setName] = useState(mu.name);
  const [selected, setSelected] = useState(new Set(mu.agents.map((a) => a.id)));
  const [agents, setAgents] = useState(mu.agents);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/agents').then((r) => r.json()).then((res) => setAgents(res.data)).finally(() => setLoadingAgents(false));
  }, []);

  function requestToggle(agent) {
    if (selected.has(agent.id)) {
      setSelected((s) => { const n = new Set(s); n.delete(agent.id); return n; });
      return;
    }
    if (agent.managementUnitId && agent.managementUnitId !== mu.id) { setConfirming(agent); return; }
    setSelected((s) => new Set(s).add(agent.id));
  }

  async function submit() {
    if (name.trim().length < 2) { setError('MU name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(mu.id, name.trim(), [...selected]);
    } catch (e) {
      setError(e.fields?.name || e.fields?.agentIds || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{`Edit — ${mu.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="fld"><label>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="sect">Agents (an agent belongs to one MU)</div>
          {loadingAgents && <div style={{ color: '#8794a8', fontSize: 12.5 }}>Loading agents…</div>}
          {!loadingAgents && agents.map((a) => (
            <div key={a.id} style={{ padding: '3px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '12.5px' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={selected.has(a.id)} onChange={() => requestToggle(a)} />
                {a.name}
                {a.managementUnitId && a.managementUnitId !== mu.id && !selected.has(a.id) && (
                  <span style={{ color: '#8794a8', fontSize: 11 }}>(in another MU)</span>
                )}
              </label>
              {confirming?.id === a.id && (
                <div style={{ margin: '6px 0 6px 24px', padding: '8px 10px', background: '#fff8ec', border: '1px solid #f3ddab', borderRadius: 6, fontSize: 12 }}>
                  <b>{a.name}</b> is already in <b>{a.managementUnitName}</b>. Move them here?
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn sec" style={{ height: 26, fontSize: 11.5 }} onClick={() => setConfirming(null)}>Cancel</button>
                    <button className="btn" style={{ height: 26, fontSize: 11.5 }} onClick={() => { setSelected((s) => new Set(s).add(a.id)); setConfirming(null); }}>Reassign</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ marginTop: 10 }}><button className="btn gh" onClick={() => onDelete(mu.id, mu.name)}>Delete management unit</button></div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
