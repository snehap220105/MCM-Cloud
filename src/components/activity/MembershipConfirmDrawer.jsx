import Drawer from '../Drawer';
import { USERS, ME_ID } from '../../data/workspace/users';

const ME = USERS.find((u) => u.id === ME_ID);

// Ported from agtSimulate()'s inline "ACD membership" confirm drawer
// (lines 6161-6170).
export default function MembershipConfirmDrawer({ queue, actions, onClose }) {
  return (
    <Drawer
      title="ACD membership"
      onClose={onClose}
      panelStyle={{ height: 'auto', top: '30%', bottom: 'auto', borderRadius: '8px 0 0 8px' }}
      footer={<>
      <button className="btn sec" onClick={onClose}>Cancel</button>
      <button className="btn" onClick={() => { actions.confirmMembership(queue.id); onClose(); }}>Add me &amp; continue</button>
    </>}>
      <div style={{ fontSize: 13, color: '#33425c', lineHeight: 1.7 }}>
        <b>{ME.name}</b> is not a member of <b>{queue.name}</b>. ACD only alerts queue members who are On Queue. Add yourself now?
      </div>
    </Drawer>
  );
}
