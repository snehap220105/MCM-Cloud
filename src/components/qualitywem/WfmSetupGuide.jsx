import { useState } from 'react';

const ALL_AGENTS = ['Sofia Petrova', 'James Okafor', 'Priya Nair', 'Marco Rossi', 'Rajan Patel', 'Aisha Rahman', 'Carlos Mendez'];

const INITIAL = {
  bu: { name: 'UK Contact Centre', tz: 'Europe/London', weekStart: 'Monday' },
  mus: [
    { id: 'mu1', name: 'UK Retail MU', agents: ['Sofia Petrova', 'James Okafor', 'Priya Nair', 'Marco Rossi'] },
    { id: 'mu2', name: 'Collections MU', agents: ['Rajan Patel'] },
    { id: 'mu3', name: 'Digital MU', agents: ['Aisha Rahman', 'Carlos Mendez'] },
  ],
  activityCodes: 6,
  planningGroups: ['Retail Voice', 'Collections', 'Digital Messaging'],
  serviceGoals: [{ name: 'Voice standard', sl: 80, sls: 20 }, { name: 'Digital standard', sl: 85, sls: 40 }],
  workPlans: { count: 2, agents: 6 },
  forecast: null,
  schedule: null,
  published: false,
};

let uidSeq = 100;
const uid = () => 'mu' + uidSeq++;

export default function WfmSetupGuide({ toast, askConfirm, onNavigate }) {
  const [data, setData] = useState(INITIAL);
  const [buDrawer, setBuDrawer] = useState(false);
  const [muDrawer, setMuDrawer] = useState(null); // { id, name, agents } or null

  const totalAgents = data.mus.reduce((a, m) => a + m.agents.length, 0);

  const steps = [
    {
      n: 1,
      t: 'Business Unit & Management Units',
      d: 'The Business Unit sets timezone and week start; Management Units group agents for scheduling and adherence. Configure below — MU membership drives who gets scheduled.',
      ok: data.mus.length > 0,
      detail: `BU "${data.bu.name}" · ${data.mus.length} MUs, ${totalAgents} agents`,
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
    setData((d) => ({ ...d, bu: { name, tz, weekStart } }));
    setBuDrawer(false);
    toast('Business unit saved');
  }

  function saveMU(id, name, agents) {
    setData((d) => {
      let mus = d.mus.map((m) => ({ ...m, agents: m.agents.filter((a) => !agents.includes(a) || m.id === id) }));
      if (id) {
        mus = mus.map((m) => (m.id === id ? { ...m, name, agents } : m));
      } else {
        mus = [...mus, { id: uid(), name, agents }];
      }
      return { ...d, mus };
    });
    setMuDrawer(null);
    toast('Management unit saved');
  }

  function deleteMU(id, name) {
    askConfirm(`Delete MU <b>${name}</b>? Its agents will be unscheduled.`, () => {
      setData((d) => ({ ...d, mus: d.mus.filter((m) => m.id !== id) }));
      toast('Deleted');
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
          <button className="btn" onClick={() => setMuDrawer({ id: null, name: '', agents: [] })}>+ Add MU</button>
        </div>

        <div className="tblw">
          <table className="dt">
            <thead><tr><th>Management unit</th><th>Agents</th><th></th></tr></thead>
            <tbody>
              {data.mus.map((m) => (
                <tr key={m.id}>
                  <td><b className="lnk" onClick={() => setMuDrawer(m)}>{m.name}</b></td>
                  <td>{m.agents.map((a) => <span className="tag" key={a}>{a}</span>)}</td>
                  <td style={{ width: 70 }}><a className="lnk" style={{ fontSize: 12 }} onClick={() => deleteMU(m.id, m.name)}>Delete</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {buDrawer && <BUDrawer bu={data.bu} onCancel={() => setBuDrawer(false)} onSave={saveBU} />}
      {muDrawer && (
        <MUDrawer
          mu={muDrawer}
          onCancel={() => setMuDrawer(null)}
          onSave={saveMU}
          takenElsewhere={(agent) => data.mus.some((m) => m.id !== muDrawer.id && m.agents.includes(agent))}
        />
      )}
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

function MUDrawer({ mu, onCancel, onSave, takenElsewhere }) {
  const isNew = !mu.id;
  const [name, setName] = useState(mu.name);
  const [agents, setAgents] = useState(mu.agents);
  const [error, setError] = useState('');

  function toggle(agent) {
    setAgents((a) => (a.includes(agent) ? a.filter((x) => x !== agent) : [...a, agent]));
  }

  function submit() {
    if (name.trim().length < 2) { setError('MU name is required.'); return; }
    onSave(mu.id, name.trim(), agents);
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'Add Management Unit' : `Edit — ${mu.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="fld"><label>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="sect">Agents (an agent belongs to one MU)</div>
          {ALL_AGENTS.map((a) => (
            <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', fontSize: '12.5px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={agents.includes(a)} onChange={() => toggle(a)} />
              {a}
              {takenElsewhere(a) && !agents.includes(a) && <span style={{ color: '#8794a8', fontSize: 11 }}>(in another MU)</span>}
            </label>
          ))}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}
