import { useState } from 'react';
import Drawer from '../Drawer';
import { USERS, ME_ID } from '../../data/workspace/users';

// Ported from agcTransferPanel() (lines 6265-6276).
export default function TransferDrawer({ state, actions, onClose }) {
  const opts = [
    ...state.queues.map((q) => ({ value: 'q:' + q.id, label: 'Queue — ' + q.name })),
    ...USERS.filter((u) => u.state === 'Active' && u.id !== ME_ID).map((u) => ({ value: 'u:' + u.id, label: u.name + (u.ext ? ' (ext ' + u.ext + ')' : '') })),
  ];
  const [target, setTarget] = useState(opts[0]?.value || '');

  return (
    <Drawer
      title="Transfer"
      onClose={onClose}
      panelStyle={{ height: 'auto', top: '18%', bottom: 'auto', borderRadius: '8px 0 0 8px', width: 380 }}
      footer={<>
      <button className="btn sec" onClick={onClose}>Cancel</button>
      <button className="btn sec" onClick={() => { actions.transferConsult(target); onClose(); }}>Consult</button>
      <button className="btn" onClick={() => { actions.transferBlind(target); onClose(); }}>Blind transfer</button>
    </>}>
      <div className="fld">
        <label>Target</label>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {opts.map((o) => <option value={o.value} key={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 11.5, color: '#8794a8', lineHeight: 1.6, marginBottom: 6 }}>
        Blind = send now. Consult = talk to the target first while the caller holds, then complete or cancel.
      </div>
    </Drawer>
  );
}
