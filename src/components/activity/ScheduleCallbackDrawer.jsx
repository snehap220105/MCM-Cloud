import { useState } from 'react';
import Drawer from '../Drawer';

// Ported from cbNew()/cbSave() (lines 8117-8141).
export default function ScheduleCallbackDrawer({ state, actions, onClose }) {
  const queueOpts = state.queues.filter((q) => !/chat|email/i.test(q.name));
  const [name, setName] = useState('');
  const [num, setNum] = useState('');
  const [queue, setQueue] = useState(queueOpts[0]?.name || '');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');

  function save() {
    const ok = actions.cbNew({ name, num, queue, when, notes: note });
    if (ok) onClose();
  }

  return (
    <Drawer
      title="Schedule a callback"
      onClose={onClose}
      panelStyle={{ width: 420, height: 'auto', top: '16%', bottom: 'auto', borderRadius: '8px 0 0 8px' }}
      footer={<>
      <button className="btn sec" onClick={onClose}>Cancel</button>
      <button className="btn" onClick={save}>Save callback</button>
    </>}>
      <div className="fld"><label>Customer name *</label><input placeholder="e.g. Oliver Smith" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="fld"><label>Number *</label><input placeholder="+44…" value={num} onChange={(e) => setNum(e.target.value)} /></div>
      <div className="fld">
        <label>Queue</label>
        <select value={queue} onChange={(e) => setQueue(e.target.value)}>
          {queueOpts.map((q) => <option key={q.id}>{q.name}</option>)}
        </select>
      </div>
      <div className="fld">
        <label>When</label>
        <select value={when} onChange={(e) => setWhen(e.target.value)}>
          <option value="">As soon as an agent is free</option>
          <option>14:00</option><option>15:30</option><option>17:00</option>
        </select>
      </div>
      <div className="fld"><label>Note</label><input placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)} /></div>
    </Drawer>
  );
}
