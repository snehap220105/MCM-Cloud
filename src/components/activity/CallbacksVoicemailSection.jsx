import { fmt } from '../../lib/workspace/helpers';
import { USERS, ME_ID } from '../../data/workspace/users';

// Ported from window.__wsExtra (base at lines 8053-8085) — the coaching
// banner (v12.7) is skipped since no coaching data exists in this
// conversion pass, so it would never render in the original either.
export default function CallbacksVoicemailSection({ state, actions, onSchedule, onPlayVoicemail }) {
  const myQueues = state.queues.filter((q) => q.members.indexOf(ME_ID) > -1).map((q) => q.name);
  const offer = state.cbOffer ? state.callbacks.find((x) => x.id === state.cbOffer && x.state === 'Waiting') : null;
  const waiting = state.callbacks.filter((x) => x.state === 'Waiting' && myQueues.indexOf(x.queue) > -1);
  const vms = state.voicemails.filter((x) => myQueues.indexOf(x.queue) > -1);
  const newVm = vms.filter((x) => x.state === 'New').length;

  return (
    <>
      {offer && (
        <div style={{ background: '#fff8e6', border: '2px solid #f0c36d', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>↩</span>
            <div style={{ flex: 1 }}>
              <b>Callback ready — {offer.customer}</b>{' '}
              <span style={{ color: '#8794a8', fontSize: 12 }}>{offer.ani} · {offer.queue} · requested {offer.reqAt}{offer.by ? ' · ' + offer.by : ''}</span>
              {offer.notes && <div style={{ fontSize: 12, color: '#5a6b85', marginTop: 2 }}>Note: {offer.notes}</div>}
            </div>
            <button className="btn" onClick={() => actions.cbAccept(offer.id)}>📞 Place callback</button>
            <button className="btn sec" onClick={() => actions.cbSkip(offer.id)}>Later</button>
          </div>
        </div>
      )}
      <h1 style={{ fontSize: 15, margin: '20px 0 6px' }}>
        Callbacks &amp; voicemail{' '}
        <span className="tag o">{waiting.length} callback{waiting.length === 1 ? '' : 's'} waiting</span>
        {newVm ? <span className="tag" style={{ background: '#e3ecfc', color: '#2c4a76' }}>{newVm} new voicemail{newVm === 1 ? '' : 's'}</span> : null}
        {' '}<a className="lnk" style={{ fontSize: 12, fontWeight: 400 }} onClick={onSchedule}>＋ Schedule a callback</a>
      </h1>
      <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: 8, padding: '6px 14px' }}>
        {vms.length ? vms.slice(0, 4).map((v) => (
          <div key={v.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f2f5f9', fontSize: 12.5, fontWeight: v.state === 'New' ? 600 : undefined }}>
            <span>{v.state === 'New' ? '🔵' : '✓'}</span>
            <span style={{ width: 110 }}>{v.from}</span>
            <span style={{ width: 120, color: '#5a6b85', fontWeight: 400 }}>{v.ani}</span>
            <span style={{ width: 110, fontWeight: 400 }}>{v.queue}</span>
            <span style={{ width: 44, color: '#8794a8', fontWeight: 400 }}>{v.at}</span>
            <span style={{ width: 44, fontFamily: 'monospace', fontWeight: 400 }}>{fmt(v.dur)}</span>
            <a className="lnk" style={{ fontSize: 12 }} onClick={() => onPlayVoicemail(v.id)}>▶ Play</a>
            <a className="lnk" style={{ fontSize: 12 }} onClick={() => actions.vmCall(v.id)}>📞 Call back</a>
          </div>
        )) : <div style={{ color: '#8794a8', fontSize: 12, padding: '8px 0' }}>No voicemails in your queues.</div>}
      </div>
    </>
  );
}
