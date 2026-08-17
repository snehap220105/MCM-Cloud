import Card from './Card';
import { fmt } from '../../lib/workspace/helpers';
import { CANNED } from '../../data/workspace/kb';

function Bubble({ mg }) {
  const agent = mg.who === 'agent';
  return (
    <div style={{ display: 'flex', justifyContent: agent ? 'flex-end' : undefined }}>
      <div style={{ maxWidth: '75%', background: agent ? '#152550' : '#f0f3f8', color: agent ? '#fff' : '#20303f', borderRadius: 10, padding: '7px 11px', margin: '3px 0', fontSize: 12.5 }}>
        {mg.t}
      </div>
    </div>
  );
}

// Ported from drawA()'s chat-card markup (lines 6053-6064). `draft` is
// controlled by the parent so Agent Copilot's "Insert into reply" can fill it.
export default function ChatCard({ chat, index, actions, draft, onDraftChange }) {
  function send() {
    actions.chatSend(index, draft);
    onDraftChange('');
  }
  function canned(e) {
    const text = actions.chatCanned(index, e.target.value);
    if (text) onDraftChange(text);
    e.target.value = '';
  }

  return (
    <Card style={{ maxWidth: 560, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="st ok"><span className="d" />{chat.channel || 'Chat'}</span>
        <b>{chat.name}</b>
        {chat.ani && chat.ani !== 'web chat' && <span style={{ color: '#8794a8', fontSize: 11 }}>{chat.ani}</span>}
        <span style={{ color: '#8794a8', fontSize: 11.5 }}>{chat.queue}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', color: '#152550' }}>{fmt(chat.secs)}</span>
      </div>
      <div style={{ margin: '8px 0', maxHeight: 170, overflow: 'auto' }}>
        {chat.msgs.slice(-6).map((mg, i) => <Bubble mg={mg} key={i} />)}
        {chat.typing && <div style={{ color: '#8794a8', fontSize: 11.5 }}>customer is typing…</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          placeholder="Type a reply…"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          style={{ flex: 1, height: 32, border: '1px solid #ccd4e0', borderRadius: 5, padding: '0 10px', fontSize: 12.5 }}
        />
        <select onChange={canned} defaultValue="" style={{ height: 32, border: '1px solid #ccd4e0', borderRadius: 5, fontSize: 12, maxWidth: 120 }}>
          <option value="">Canned…</option>
          {CANNED.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
        <button className="btn sec" style={{ height: 32 }} onClick={send}>Send</button>
        <button className="btn gh" style={{ height: 32 }} onClick={() => actions.chatEnd(index)}>End</button>
      </div>
    </Card>
  );
}
