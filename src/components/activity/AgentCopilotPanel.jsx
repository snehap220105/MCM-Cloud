import { useState } from 'react';

// Ported from copHtml() (lines 9054-9112).
export default function AgentCopilotPanel({ state, actions, onManageKb, onAiSettings, onInsertChat, onInsertEmail }) {
  const { call, callState, chats, email, ai } = state;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState('');
  const [suggestedWrap, setSuggestedWrap] = useState('');

  if (!ai.copilot) return null;

  let inner = null;
  let ctx = '';

  if (callState === 'alerting' && call) {
    const q = state.queues.find((x) => x.name === call.queue);
    if (q && ai.predictive[q.id]) {
      const fit = actions.hashFit(call.name);
      inner = (
        <div style={{ background: '#f4f0fb', border: '1px solid #ddd0f0', borderRadius: 8, padding: '10px 13px', fontSize: 12.5 }}>
          ⚡ <b>Predictive routing</b> matched this customer to you — fit score <b>{fit}</b> (outcome history on {call.queue}).
        </div>
      );
    }
  } else if (callState === 'talking' && call) {
    const secs = state.secs;
    const steps = [
      ['Greet & confirm who you\'re speaking with', secs > 8],
      ['Verify the account (DOB or postcode)', secs > 25],
      ['Diagnose & resolve the request', secs > 60],
      ['Recap and confirm next steps', secs > 120],
    ];
    const kb = actions.copForText(call.queue + ' ' + (call.name || '') + ' billing');
    ctx = call.queue || '';
    inner = (
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase', marginBottom: 5 }}>Call checklist</div>
          {steps.map(([label, done]) => (
            <div key={label} style={{ fontSize: 12, padding: '2px 0', color: done ? '#1f9d63' : '#5a6b85' }}>{done ? '✓' : '○'} {label}</div>
          ))}
          {call.held && <div style={{ fontSize: 12, color: '#d0342c', marginTop: 4 }}>⚠ Customer on hold — check back in.</div>}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase', marginBottom: 5 }}>Suggested knowledge</div>
          {kb.length ? kb.map((a) => (
            <div style={{ padding: '2px 0' }} key={a.id}><a className="lnk" style={{ fontSize: 12 }} onClick={() => onManageKb(a.id)}>📖 {a.title}</a></div>
          )) : <div style={{ fontSize: 12, color: '#8794a8' }}>No matches.</div>}
        </div>
      </div>
    );
  } else if (callState === 'acw' && call) {
    inner = (
      <div>
        <div style={{ fontSize: 12.5, marginBottom: 6 }}>✨ Let Copilot draft the interaction summary from the call data:</div>
        <button className="btn sec" style={{ fontSize: 12 }} onClick={() => {
          const r = actions.copSummary();
          if (r) { setSummary(r.text); setSuggestedWrap(r.suggestedWrap); }
        }}>✨ Generate summary</button>
        <textarea
          style={{ width: '100%', height: 64, marginTop: 8, fontSize: 12 }}
          placeholder="Summary appears here — edit before saving…"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        {suggestedWrap && <div style={{ fontSize: 12, color: '#5a6b85', marginTop: 4 }}>Suggested wrap-up: <b>{suggestedWrap}</b></div>}
      </div>
    );
  }

  const chatSugg = [];
  chats.forEach((ch, i) => {
    const lastC = [...ch.msgs].reverse().find((m) => m.who === 'cust');
    if (!lastC) return;
    const s = actions.suggFor(lastC.t);
    const kb = actions.copForText(lastC.t);
    chatSugg.push(
      <div style={{ borderTop: '1px dashed #e4e9f0', marginTop: 8, paddingTop: 8 }} key={'c' + i}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase', marginBottom: 4 }}>{ch.channel || 'Chat'} — {ch.name}</div>
        <div style={{ fontSize: 12, background: '#f6f8fb', borderRadius: 6, padding: '7px 10px', fontStyle: 'italic' }}>“{s}”</div>
        <div style={{ marginTop: 5 }}>
          <a className="lnk" style={{ fontSize: 12 }} onClick={() => { actions.copInsert(); onInsertChat(i, s); }}>↳ Insert into reply</a>
          {kb.length ? <> · <a className="lnk" style={{ fontSize: 12 }} onClick={() => onManageKb(kb[0].id)}>📖 {kb[0].title}</a></> : null}
        </div>
      </div>
    );
  });
  if (email) {
    const s2 = actions.suggFor(email.body);
    chatSugg.push(
      <div style={{ borderTop: '1px dashed #e4e9f0', marginTop: 8, paddingTop: 8 }} key="email">
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase', marginBottom: 4 }}>Email — {email.name || ''}</div>
        <div style={{ fontSize: 12, background: '#f6f8fb', borderRadius: 6, padding: '7px 10px', fontStyle: 'italic' }}>“{s2}”</div>
        <div style={{ marginTop: 5 }}>
          <a className="lnk" style={{ fontSize: 12 }} onClick={() => { actions.copInsert(); onInsertEmail(s2); }}>↳ Insert into reply</a>
        </div>
      </div>
    );
  }

  const idle = !inner && !chatSugg.length;

  function runSearch() {
    setResults(actions.copSearch(query));
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #d9d0f0', borderLeft: '4px solid #7b61c9', borderRadius: 10, padding: '12px 16px', margin: '0 0 14px', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: idle ? 6 : 9 }}>
        <span style={{ fontSize: 15 }}>🤖</span>
        <b style={{ fontSize: 13 }}>Agent Copilot</b>
        {ctx && <span style={{ color: '#8794a8', fontSize: 11.5 }}>{ctx}</span>}
        <span style={{ marginLeft: 'auto' }} />
        <a className="lnk" style={{ fontSize: 11.5 }} onClick={() => onManageKb()}>Knowledge</a>
        <a className="lnk" style={{ fontSize: 11.5 }} onClick={onAiSettings}>AI settings</a>
      </div>
      {idle ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Search the knowledge base…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              style={{ flex: 1, height: 30, border: '1px solid #ccd4e0', borderRadius: 5, padding: '0 10px', fontSize: 12 }}
            />
            <button className="btn sec" style={{ height: 30, fontSize: 12 }} onClick={runSearch}>Search</button>
          </div>
          <div style={{ marginTop: 6 }}>
            {results && (results.length
              ? results.slice(0, 4).map((a) => (
                <div style={{ padding: '3px 0' }} key={a.id}>
                  <a className="lnk" style={{ fontSize: 12 }} onClick={() => onManageKb(a.id)}>📖 {a.title}</a>{' '}
                  <span style={{ color: '#8794a8', fontSize: 11 }}>{a.cat}</span>
                </div>
              ))
              : <div style={{ fontSize: 12, color: '#8794a8', padding: '3px 0' }}>No articles match “{query}”.</div>)}
          </div>
        </>
      ) : (
        <>{inner}{chatSugg}</>
      )}
    </div>
  );
}
