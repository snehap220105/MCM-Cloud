import { useState } from 'react';
import Drawer from '../Drawer';
import { hash } from '../../lib/workspace/helpers';

// Ported from aiSettings()/aiSave() (lines 9196-9222).
export default function AISettingsDrawer({ state, actions, onClose }) {
  const [copilot, setCopilot] = useState(state.ai.copilot);
  const [predictive, setPredictive] = useState({ ...state.ai.predictive });

  function save() {
    actions.aiSettingsSave(copilot, predictive);
    onClose();
  }

  return (
    <Drawer
      title="AI settings"
      onClose={onClose}
      panelStyle={{ width: 470, height: 'auto', top: '12%', bottom: 'auto', borderRadius: '8px 0 0 8px' }}
      footer={<>
      <button className="btn sec" onClick={onClose}>Cancel</button>
      <button className="btn" onClick={save}>Save</button>
    </>}>
      <div className="tgl" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={copilot} onChange={(e) => setCopilot(e.target.checked)} style={{ width: 'auto', marginRight: 5 }} />
        <b>Agent Copilot</b> — suggestions, knowledge &amp; summaries in the workspace
      </div>
      <div className="sect">Predictive routing per queue</div>
      <div style={{ fontSize: 11.5, color: '#8794a8', marginBottom: 6 }}>
        Instead of longest-idle, the AI picks the agent with the best predicted outcome for each customer. Falls back to standard ACD when scores are close.
      </div>
      {state.queues.map((q) => {
        const h = hash(q.name);
        const aht = 6 + (h % 9), sl = 2 + (h % 4);
        return (
          <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f2f5f9', fontSize: 12.5 }}>
            <input type="checkbox" checked={!!predictive[q.id]} onChange={(e) => setPredictive({ ...predictive, [q.id]: e.target.checked })} style={{ width: 'auto' }} />
            <b style={{ width: 170 }}>{q.name}</b>
            <span style={{ color: '#8794a8', fontSize: 11.5 }}>est. benefit: −{aht}% AHT · +{sl}% SL <span style={{ color: '#a9b3c2' }}>(from outcome history)</span></span>
          </div>
        );
      })}
      <div style={{ fontSize: 11.5, color: '#8794a8', marginTop: 8 }}>Copilot suggestions used so far: <b>{state.ai.used}</b></div>
    </Drawer>
  );
}
