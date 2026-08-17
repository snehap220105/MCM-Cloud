import { useState } from 'react';

const QUEUES = ['Retail_Billing_L1', 'Retail_Complaints', 'Digital_Messaging', 'Collections_Arrears'];

const INITIAL = [
  { id: 'p1', name: 'Record all Collections voice', media: ['Voice'], queues: ['Collections_Arrears'], retention: 365, pct: 100, on: true },
  { id: 'p2', name: 'Retail 50% sample + screen', media: ['Voice', 'Screen'], queues: ['Retail_Billing_L1', 'Retail_Complaints'], retention: 90, pct: 50, on: true },
];

let uidSeq = 100;
const uid = () => 'p' + uidSeq++;

export default function RecordingPolicies({ toast, askConfirm, onNavigate }) {
  const [policies, setPolicies] = useState(INITIAL);
  const [drawer, setDrawer] = useState(null); // policy or null
  const [menuFor, setMenuFor] = useState(null);

  function save(id, fields) {
    setPolicies((list) => {
      if (id) return list.map((p) => (p.id === id ? { ...p, ...fields } : p));
      return [...list, { id: uid(), ...fields }];
    });
    setDrawer(null);
    toast(`Policy saved — <b>${fields.name}</b>`);
  }

  function del(id, name) {
    setMenuFor(null);
    askConfirm(`Delete recording policy <b>${name}</b>? Existing recordings are kept per retention.`, () => {
      setPolicies((list) => list.filter((p) => p.id !== id));
      toast('Policy deleted');
    });
  }

  return (
    <>
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Quality</div>
        <div className="tt">
          <h1>Recording Policies</h1>
          <div className="rt"><button className="btn" onClick={() => setDrawer({ id: null, name: '', media: ['Voice'], queues: [], retention: 90, pct: 100, on: true })}>+ Create Policy</button></div>
        </div>
        <div className="tabs"><div className="tb on">Policies ({policies.length})</div></div>
      </div>

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr><th>Policy</th><th>Media</th><th>Queues</th><th>Sample</th><th>Retention</th><th>State</th><th style={{ width: 40 }}></th></tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} onClick={() => setDrawer(p)}>
                  <td><b className="lnk">{p.name}</b></td>
                  <td>{p.media.map((m) => <span className="tag" key={m}>{m}</span>)}</td>
                  <td>{p.queues.length ? p.queues.join(', ') : 'All queues'}</td>
                  <td>{p.pct}%</td>
                  <td>{p.retention} days</td>
                  <td>{p.on ? <span className="st ok"><span className="d" />Active</span> : <span className="st" style={{ color: '#8a94a6' }}><span className="d" style={{ background: '#8a94a6' }} />Disabled</span>}</td>
                  <td style={{ color: '#a9b3c2', position: 'relative' }} onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === p.id ? null : p.id); }}>
                    ⋮
                    {menuFor === p.id && (
                      <div style={{ position: 'absolute', right: 0, top: 24, background: '#fff', border: '1px solid #dde3ec', borderRadius: 6, boxShadow: '0 10px 24px rgba(16,30,60,.18)', zIndex: 5, minWidth: 120 }}>
                        <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#3c4a5c', cursor: 'pointer' }} onClick={() => { setMenuFor(null); setDrawer(p); }}>Edit</div>
                        <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#b3261e', cursor: 'pointer' }} onClick={() => del(p.id, p.name)}>Delete</div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {drawer && <PolicyDrawer policy={drawer} onCancel={() => setDrawer(null)} onSave={save} onDelete={del} />}
    </>
  );
}

function PolicyDrawer({ policy, onCancel, onSave, onDelete }) {
  const isNew = !policy.id;
  const [name, setName] = useState(policy.name);
  const [media, setMedia] = useState(policy.media);
  const [queues, setQueues] = useState(policy.queues);
  const [pct, setPct] = useState(policy.pct);
  const [retention, setRetention] = useState(policy.retention);
  const [on, setOn] = useState(policy.on);
  const [error, setError] = useState('');

  function toggleMedia(m) {
    setMedia((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]));
  }
  function toggleQueue(q) {
    setQueues((list) => (list.includes(q) ? list.filter((x) => x !== q) : [...list, q]));
  }

  function submit() {
    if (name.trim().length < 2) { setError('Policy name is required.'); return; }
    if (!media.length) { setError('Select at least one media type.'); return; }
    onSave(policy.id, {
      name: name.trim(),
      media,
      queues,
      pct: Math.max(1, Math.min(100, parseInt(pct, 10) || 100)),
      retention: Math.max(1, parseInt(retention, 10) || 90),
      on,
    });
  }

  return (
    <div id="scrim" onClick={onCancel}>
      <div id="drw" onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>{isNew ? 'Create Recording Policy' : `Edit — ${policy.name}`}</h2><button className="x" onClick={onCancel}>×</button></div>
        <div className="db">
          {error && <div className="errbox">{error}</div>}
          <div className="fld"><label>Policy name *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="fld">
            <label>Media recorded</label>
            <div>
              {['Voice', 'Screen'].map((m) => (
                <label key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 14, fontSize: '12.5px' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={media.includes(m)} onChange={() => toggleMedia(m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>
          <div className="fld">
            <label>Queues (none checked = all queues)</label>
            {QUEUES.map((q) => (
              <label key={q} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '12.5px' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={queues.includes(q)} onChange={() => toggleQueue(q)} />
                {q}
              </label>
            ))}
          </div>
          <div className="fld"><label>Sample percentage (of eligible interactions)</label><input type="number" min="1" max="100" value={pct} onChange={(e) => setPct(e.target.value)} /></div>
          <div className="fld"><label>Retention (days)</label><input type="number" value={retention} onChange={(e) => setRetention(e.target.value)} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={on} onChange={(e) => setOn(e.target.checked)} />
            Policy active
          </label>
          {!isNew && (
            <div style={{ marginTop: 10 }}>
              <button className="btn gh" onClick={() => onDelete(policy.id, policy.name)}>Delete policy</button>
            </div>
          )}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}
