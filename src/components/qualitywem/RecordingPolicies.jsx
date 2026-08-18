import { useCallback, useEffect, useState } from 'react';
import RecordingPolicyConfigModal from './RecordingPolicyConfigModal.jsx';

const FALLBACK_QUEUES = ['Retail_Billing_L1', 'Retail_Complaints', 'Digital_Messaging', 'Collections_Arrears'];

async function api(path, options) {
  const res = await fetch('/api/recording-policies' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw Object.assign(new Error(body.error || 'Request failed'), { fields: body.fields });
  return body;
}

export default function RecordingPolicies({ toast, askConfirm, onNavigate }) {
  const [policies, setPolicies] = useState([]);
  const [options, setOptions] = useState({ media: ['Voice', 'Screen'], queues: FALLBACK_QUEUES });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // policy (edit) | {} (create) | null (closed)
  const [menuFor, setMenuFor] = useState(null);

  const reload = useCallback(() => {
    return api('').then((res) => setPolicies(res.data)).catch(() => toast('Could not load recording policies from backend'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all([reload(), api('/options').then(setOptions)])
      .catch(() => toast('Could not load recording policies from backend'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function del(id, name) {
    setMenuFor(null);
    askConfirm(`Delete recording policy <b>${name}</b>? Existing recordings are kept per retention.`, async () => {
      try {
        await api(`/${id}`, { method: 'DELETE' });
        setPolicies((list) => list.filter((p) => p.id !== id));
        setModal(null); // close the edit drawer if the deleted policy was open in it
        toast('Policy deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  return (
    <>
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Quality</div>
        <div className="tt">
          <h1>Recording Policies</h1>
          <div className="rt"><button className="btn" onClick={() => setModal({})}>+ Create Policy</button></div>
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
              {loading && <tr><td colSpan={7} style={{ color: '#8a94a6' }}>Loading…</td></tr>}
              {!loading && !policies.length && <tr><td colSpan={7} style={{ color: '#8a94a6' }}>No recording policies yet.</td></tr>}
              {policies.map((p) => (
                <tr key={p.id} onClick={() => setModal(p)}>
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
                        <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#3c4a5c', cursor: 'pointer' }} onClick={() => { setMenuFor(null); setModal(p); }}>Edit</div>
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

      <RecordingPolicyConfigModal
        open={!!modal}
        policy={modal}
        queues={options.queues}
        onClose={() => setModal(null)}
        onSuccess={(saved) => { setPolicies((list) => (modal?.id ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved])); toast(`Policy saved — <b>${saved.name}</b>`); }}
        onDelete={del}
      />
    </>
  );
}
