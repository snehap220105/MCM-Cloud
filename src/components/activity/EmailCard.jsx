import Card from './Card';
import { fmt } from '../../lib/workspace/helpers';

// Ported from drawA()'s email-card markup (lines 6066-6073). `reply` is
// controlled by the parent so Agent Copilot's "Insert into reply" can fill it.
export default function EmailCard({ email, actions, reply, onReplyChange }) {
  return (
    <Card style={{ maxWidth: 560, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="st ok"><span className="d" />Email</span>
        <b>{email.from}</b>
        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', color: '#152550' }}>{fmt(email.secs)}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, margin: '6px 0 3px' }}>{email.subject}</div>
      <div style={{ fontSize: 12.5, color: '#5b6b82', background: '#f5f7fa', borderRadius: 6, padding: 10, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{email.body}</div>
      <div className="fld" style={{ marginTop: 8 }}>
        <textarea style={{ height: 70 }} placeholder="Type your reply…" value={reply} onChange={(e) => onReplyChange(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => actions.emailSend(reply)}>Send reply &amp; complete</button>
        <button className="btn gh" onClick={actions.emailDiscard}>Discard</button>
      </div>
    </Card>
  );
}
