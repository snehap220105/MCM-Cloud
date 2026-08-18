import { useEffect, useMemo, useState } from 'react';

// Same rule as server/managementUnit.js NAME_RE — kept in sync so the inline error the
// user sees while typing matches whatever the API would reject with.
const NAME_RE = /^[a-zA-Z\s'-]+$/;
const NAME_MIN = 2;
const NAME_MAX = 50;

function nameError(name) {
  if (!name) return null; // don't shout at an empty field before the user has typed anything
  if (name.trim().length < NAME_MIN || name.length > NAME_MAX) return `Name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  if (!NAME_RE.test(name)) return "Only letters, spaces, apostrophes and hyphens are allowed.";
  return null;
}

async function api(path, options) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw Object.assign(new Error(body.error || 'Request failed'), { fields: body.fields });
  return body;
}

/**
 * Copy-paste ready "Add Management Unit" modal.
 *
 * Props:
 *   open        boolean — render nothing when false
 *   onClose     () => void — cancel / backdrop click / after successful save
 *   onSaved     (managementUnit) => void — called with the created record on success
 *   agentsUrl   string — GET endpoint returning { data: [{ id, name, managementUnitId, managementUnitName }] }
 *               (defaults to '/api/agents')
 *   createUrl   string — POST endpoint accepting { name, agentIds } (defaults to '/api/management-units')
 */
export default function AddManagementUnitModal({ open, onClose, onSaved, agentsUrl = '/api/agents', createUrl = '/api/management-units' }) {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [search, setSearch] = useState('');
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirming, setConfirming] = useState(null); // agent pending "already in another MU" confirmation
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Reset on every open so a previous attempt never leaks into a new one.
  useEffect(() => {
    if (!open) return;
    setName(''); setTouched(false); setSearch(''); setSelected(new Set());
    setConfirming(null); setSubmitting(false); setServerError(''); setFieldErrors({});
    setLoadingAgents(true);
    api(agentsUrl)
      .then((res) => setAgents(res.data))
      .catch(() => setServerError('Could not load agents.'))
      .finally(() => setLoadingAgents(false));
  }, [open, agentsUrl]);

  const visibleAgents = useMemo(
    () => agents.filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase())),
    [agents, search]
  );
  const liveNameError = touched ? nameError(name) : null;

  function requestToggle(agent) {
    if (selected.has(agent.id)) {
      setSelected((s) => { const n = new Set(s); n.delete(agent.id); return n; });
      return;
    }
    if (agent.managementUnitId) { setConfirming(agent); return; } // needs explicit reassignment confirmation
    setSelected((s) => new Set(s).add(agent.id));
  }

  function confirmReassign() {
    setSelected((s) => new Set(s).add(confirming.id));
    setConfirming(null);
  }

  async function submit() {
    setTouched(true);
    const err = nameError(name);
    if (err) return;
    setSubmitting(true);
    setServerError('');
    setFieldErrors({});
    try {
      const res = await api(createUrl, { method: 'POST', body: JSON.stringify({ name: name.trim(), agentIds: [...selected] }) });
      onSaved?.(res.data);
      onClose();
    } catch (e) {
      if (e.fields) setFieldErrors(e.fields);
      else setServerError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div id="scrim" onClick={onClose}>
      <style>{`
        @keyframes amu-spin { to { transform: rotate(360deg); } }
        .amu-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.5); border-top-color: #fff; border-radius: 50%; animation: amu-spin .7s linear infinite; vertical-align: -2px; margin-right: 6px; }
      `}</style>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>Add Management Unit</h2><button className="x" onClick={onClose}>×</button></div>
        <div className="db">
          {serverError && <div className="errbox">{serverError}</div>}

          <div className="fld">
            <label>Name *</label>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => { setName(e.target.value); setTouched(true); }}
              onBlur={() => setTouched(true)}
              style={(liveNameError || fieldErrors.name) ? { borderColor: '#b3261e', boxShadow: '0 0 0 3px rgba(179,38,30,.1)' } : undefined}
              placeholder="e.g. UK Retail MU"
            />
            {(liveNameError || fieldErrors.name) && (
              <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{liveNameError || fieldErrors.name}</div>
            )}
          </div>

          <div className="sect">Agents (an agent belongs to one MU)</div>

          <input
            className="s"
            style={{ width: '100%', marginBottom: 10 }}
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {fieldErrors.agentIds && <div style={{ color: '#b3261e', fontSize: 11.5, marginBottom: 8 }}>{fieldErrors.agentIds}</div>}

          {loadingAgents && <div style={{ color: '#8794a8', fontSize: 12.5 }}>Loading agents…</div>}
          {!loadingAgents && !visibleAgents.length && <div style={{ color: '#8794a8', fontSize: 12.5 }}>No agents match "{search}".</div>}

          {!loadingAgents && visibleAgents.map((a) => (
            <div key={a.id} style={{ padding: '3px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '12.5px' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={selected.has(a.id)} onChange={() => requestToggle(a)} />
                {a.name}
                {a.managementUnitId && !selected.has(a.id) && (
                  <span style={{ color: '#8794a8', fontSize: 11 }}>(in another MU)</span>
                )}
              </label>

              {confirming?.id === a.id && (
                <div style={{ margin: '6px 0 6px 24px', padding: '8px 10px', background: '#fff8ec', border: '1px solid #f3ddab', borderRadius: 6, fontSize: 12 }}>
                  <b>{a.name}</b> is already in <b>{a.managementUnitName}</b>. Move them to this new MU?
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn sec" style={{ height: 26, fontSize: 11.5 }} onClick={() => setConfirming(null)}>Cancel</button>
                    <button className="btn" style={{ height: 26, fontSize: 11.5 }} onClick={confirmReassign}>Reassign</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn" onClick={submit} disabled={submitting || !!liveNameError}>
            {submitting && <span className="amu-spinner" />}
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
