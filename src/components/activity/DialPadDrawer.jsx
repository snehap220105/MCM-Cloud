import { useState } from 'react';
import Drawer from '../Drawer';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

// Ported from agcDialPad() (lines 6224-6235).
export default function DialPadDrawer({ actions, onClose }) {
  const [num, setNum] = useState('');
  return (
    <Drawer
      title="Dial Pad"
      onClose={onClose}
      panelStyle={{ width: 300, height: 'auto', top: '12%', bottom: 'auto', borderRadius: '8px 0 0 8px' }}
      footer={<>
      <button className="btn sec" onClick={onClose}>Cancel</button>
      <button className="btn" style={{ background: '#1f9d63' }} onClick={() => { actions.dial(num); onClose(); }}>📞 Call</button>
    </>}>
      <div className="fld">
        <input placeholder="Number or extension" value={num} onChange={(e) => setNum(e.target.value)} style={{ fontSize: 16, textAlign: 'center', height: 40 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,64px)', gap: 8, justifyContent: 'center', margin: '6px 0 4px' }}>
        {KEYS.map((k) => (
          <button className="btn sec" style={{ width: 64, height: 44, fontSize: 16 }} key={k} onClick={() => setNum((n) => n + k)}>{k}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#8794a8', textAlign: 'center', marginTop: 4 }}>Calls run through the London-Cloud site dial plan</div>
    </Drawer>
  );
}
