import { useEffect, useState } from 'react';

// Kept in sync with server/policy.js NAME_RE/NAME_MIN/NAME_MAX/MEDIA — the inline error the
// user sees while typing should always match whatever the API would reject with.
const NAME_RE = /^[a-zA-Z\s]+$/; // letters and spaces only — no digits or punctuation
const NAME_MIN = 3;
const NAME_MAX = 50;
const MEDIA = ['Voice', 'Screen'];

function nameError(name) {
  if (!name) return null; // don't shout at an empty field before the user has typed anything
  if (name.trim().length < NAME_MIN || name.length > NAME_MAX) return `Policy name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  if (!NAME_RE.test(name)) return 'Only letters and spaces are allowed — no numbers or symbols.';
  return null;
}
function pctError(pct) {
  if (pct === '' || pct === null || pct === undefined) return 'Sample percentage is required.';
  if (!/^\d+$/.test(String(pct).trim())) return 'Sample percentage must be a whole number.';
  if (+pct < 0 || +pct > 100) return 'Sample percentage must be between 0 and 100.';
  return null;
}
function retentionError(retention) {
  if (retention === '' || retention === null || retention === undefined) return 'Retention is required.';
  if (!/^\d+$/.test(String(retention).trim())) return 'Retention must be a whole number.';
  if (+retention < 1 || +retention > 3650) return 'Retention must be between 1 and 3650 days.';
  return null;
}

async function api(path, options) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw Object.assign(new Error(body.error || 'Request failed'), { fields: body.fields });
  return body;
}

/**
 * Copy-paste ready "Recording Policy Config" modal — creates a new policy when `policy.id`
 * is falsy, otherwise edits the given one.
 *
 * Props:
 *   open        boolean — render nothing when false
 *   policy      { id, name, media, queues, pct, retention, on } — null/blank id = create mode
 *   queues      string[] — the full list of queues the org has (checkbox options)
 *   onClose     () => void — cancel / backdrop click
 *   onSuccess   (policy) => void — called with the saved record, then the modal closes
 *   onDelete    (id, name) => void — optional; shows a "Delete policy" button in edit mode
 *   baseUrl     string — defaults to '/api/recording-policies'
 */
export default function RecordingPolicyConfigModal({ open, policy, queues = [], onClose, onSuccess, onDelete, baseUrl = '/api/recording-policies' }) {
  const isNew = !policy?.id;
  const [name, setName] = useState('');
  const [media, setMedia] = useState(['Voice']);
  const [selectedQueues, setSelectedQueues] = useState([]);
  const [pct, setPct] = useState('100');
  const [retention, setRetention] = useState('90');
  const [active, setActive] = useState(true);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Reset on every open so a previous attempt (or a different policy) never leaks in.
  useEffect(() => {
    if (!open) return;
    setName(policy?.name ?? '');
    setMedia(policy?.media?.length ? policy.media : ['Voice']);
    setSelectedQueues(policy?.queues ?? []);
    setPct(policy?.pct ?? 100);
    setRetention(policy?.retention ?? 90);
    setActive(policy?.on ?? true);
    setTouched({});
    setSubmitting(false);
    setServerError('');
    setFieldErrors({});
  }, [open, policy]);

  const errors = {
    name: nameError(name),
    media: media.length ? null : 'Select at least one media type.',
    pct: pctError(pct),
    retention: retentionError(retention),
  };
  const show = (key) => (touched[key] || touched.all) && (errors[key] || fieldErrors[key]);
  const borderStyle = (key) => (show(key) ? { borderColor: '#b3261e', boxShadow: '0 0 0 3px rgba(179,38,30,.1)' } : undefined);

  function toggleMedia(m) {
    setMedia((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]));
  }
  function toggleQueue(q) {
    setSelectedQueues((list) => (list.includes(q) ? list.filter((x) => x !== q) : [...list, q]));
  }

  async function submit() {
    setTouched({ all: true });
    if (Object.values(errors).some(Boolean)) return;

    setSubmitting(true);
    setServerError('');
    setFieldErrors({});
    const payload = { name: name.trim(), media, queues: selectedQueues, pct: +pct, retention: +retention, on: active };
    try {
      const res = isNew
        ? await api(baseUrl, { method: 'POST', body: JSON.stringify(payload) })
        : await api(`${baseUrl}/${policy.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      onSuccess?.(res.data);
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
        @keyframes rpc-spin { to { transform: rotate(360deg); } }
        .rpc-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.5); border-top-color: #fff; border-radius: 50%; animation: rpc-spin .7s linear infinite; vertical-align: -2px; margin-right: 6px; }
      `}</style>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'Create Recording Policy' : `Edit — ${policy.name}`}</h2><button className="x" onClick={onClose}>×</button></div>
        <div className="db">
          {serverError && <div className="errbox">{serverError}</div>}

          <div className="fld">
            <label>Policy name *</label>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              style={borderStyle('name')}
            />
            {show('name') && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{errors.name || fieldErrors.name}</div>}
          </div>

          <div className="fld">
            <label>Media recorded *</label>
            <div>
              {MEDIA.map((m) => (
                <label key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 14, fontSize: '12.5px' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={media.includes(m)} onChange={() => { toggleMedia(m); setTouched((t) => ({ ...t, media: true })); }} />
                  {m}
                </label>
              ))}
            </div>
            {show('media') && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{errors.media || fieldErrors.media}</div>}
          </div>

          <div className="fld">
            <label>Queues (none checked = all queues)</label>
            {queues.map((q) => (
              <label key={q} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '12.5px' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={selectedQueues.includes(q)} onChange={() => toggleQueue(q)} />
                {q}
              </label>
            ))}
            {fieldErrors.queues && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{fieldErrors.queues}</div>}
          </div>

          <div className="fld">
            <label>Sample percentage (of eligible interactions)</label>
            <input
              type="number" min="0" max="100"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, pct: true }))}
              style={borderStyle('pct')}
            />
            {show('pct') && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{errors.pct || fieldErrors.pct}</div>}
          </div>

          <div className="fld">
            <label>Retention (days)</label>
            <input
              type="number" min="1" max="3650"
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, retention: true }))}
              style={borderStyle('retention')}
            />
            {show('retention') && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{errors.retention || fieldErrors.retention}</div>}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={active} onChange={(e) => setActive(e.target.checked)} />
            Policy active
          </label>

          {!isNew && onDelete && (
            <div style={{ marginTop: 14 }}>
              <button className="btn gh" onClick={() => onDelete(policy.id, policy.name)} disabled={submitting}>Delete policy</button>
            </div>
          )}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn" onClick={submit} disabled={submitting}>
            {submitting && <span className="rpc-spinner" />}
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
