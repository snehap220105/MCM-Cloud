import { useState } from 'react';
import Card from './Card';
import { fmt } from '../../lib/workspace/helpers';

// Ported from drawA()'s panel-building logic (lines 6000-6050).
export default function CallPanel({ state, actions, onTransfer }) {
  const { callState, call, secs, consult, onQueue } = state;

  if (callState === 'alerting' && call) {
    return (
      <Card style={{ border: '2px solid #FF4F1F', maxWidth: 460, boxShadow: '0 10px 34px rgba(255,79,31,.16)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#c9401a', textTransform: 'uppercase', letterSpacing: .6 }}>
          ● Incoming {call.type || 'call'} — {call.queue || 'direct'}
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#152550', margin: '6px 0 2px' }}>{call.name}</div>
        <div style={{ fontSize: 13, color: '#5b6b82' }}>
          {call.ani}{call.skills && call.skills.length ? ` · skills [${call.skills.join(', ')}]` : ''}
        </div>
        <div style={{ fontSize: 11.5, color: '#8794a8', marginTop: 4 }}>alerting {secs}s / {call.alertTimeout}s</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="btn" style={{ background: '#1f9d63' }} onClick={actions.answer}>Answer</button>
          <button className="btn sec" onClick={actions.decline}>Decline</button>
        </div>
      </Card>
    );
  }

  if ((callState === 'talking' || callState === 'dialing') && call) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {callState === 'dialing'
            ? <span className="st wn"><span className="d" />Dialing…</span>
            : <span className="st ok"><span className="d" />{call.conference ? 'Conference' : 'Connected'}</span>}
          <b style={{ fontSize: 16, color: '#152550' }}>{call.name}</b>
          <span style={{ color: '#8794a8' }}>{call.ani}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 16, color: '#152550' }}>{fmt(secs)}</span>
        </div>
        <div style={{ fontSize: 12, color: '#8794a8', margin: '4px 0 10px' }}>
          {call.via || call.queue || ''}
          {call.held ? <> · <b style={{ color: '#e0a200' }}>CALLER ON HOLD</b></> : null}
          {call.muted ? <> · <b style={{ color: '#b3261e' }}>MUTED</b></> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sec" onClick={actions.hold}>{call.held ? 'Retrieve' : 'Hold'}</button>
          <button className="btn sec" onClick={actions.mute}>{call.muted ? 'Unmute' : 'Mute'}</button>
          <button className="btn sec" onClick={onTransfer}>Transfer</button>
          <button className="btn sec" onClick={actions.dtmf}>Keypad</button>
          <button className="btn" style={{ background: '#d0342c' }} onClick={actions.endCall}>End Call</button>
        </div>
        {consult && (
          <div style={{ marginTop: 10, background: '#f5f7fa', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={'st ' + (consult.state === 'connected' ? 'ok' : 'wn')}>
              <span className="d" />Consult: {consult.name} — {consult.state === 'connected' ? fmt(consult.secs) : 'ringing…'}
            </span>
            <div style={{ flex: 1 }} />
            {consult.state === 'connected' && (
              <>
                <button className="btn" style={{ height: 28 }} onClick={actions.completeTransfer}>Complete transfer</button>
                <button className="btn sec" style={{ height: 28 }} onClick={actions.conference}>Conference</button>
              </>
            )}
            <button className="btn gh" style={{ height: 28 }} onClick={actions.cancelConsult}>Cancel</button>
          </div>
        )}
        <div style={{ marginTop: 12, background: '#f5f7fa', borderLeft: '3px solid #FF4F1F', borderRadius: '0 6px 6px 0', padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7a90', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 }}>Script — screen pop</div>
          <div style={{ fontSize: 12.5, color: '#33425c', lineHeight: 1.8 }}>Customer <b>{call.name}</b> · ANI {call.ani}</div>
        </div>
      </Card>
    );
  }

  if (callState === 'acw' && call) {
    return <AcwPanel call={call} secs={secs} actions={actions} state={state} />;
  }

  return (
    <Card style={{ border: '1px dashed #dde3ec', maxWidth: 460 }}>
      <div style={{ color: '#8794a8', fontSize: 13, textAlign: 'center' }}>
        {onQueue
          ? 'Waiting for interactions… simulate an inbound call, start a campaign, or use the dial pad.'
          : <>You are <b>Off Queue</b> — go On Queue to receive ACD work. The dial pad works either way.</>}
      </div>
    </Card>
  );
}

function AcwPanel({ call, secs, actions, state }) {
  const q = state.queues.find((x) => x.id === call.qid);
  const codes = q ? q.wrapup : [];
  const [picked, setPicked] = useState('');
  return (
    <Card style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="st wn"><span className="d" />After-call work</span>
        <b>{call.name}</b>
        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', color: '#e0a200' }}>{fmt(secs)}</span>
      </div>
      <div style={{ fontSize: 12, color: '#8794a8', margin: '4px 0 8px' }}>Select a wrap-up code</div>
      {codes.length ? codes.map((name) => (
        <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 }}>
          <input type="radio" name="wrap" value={name} checked={picked === name} onChange={() => setPicked(name)} style={{ width: 'auto' }} />
          <b>{name}</b>
        </label>
      )) : <div style={{ color: '#8794a8', fontSize: 12 }}>No wrap-up codes configured</div>}
      <div style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => actions.wrap(picked)}>Complete interaction</button>
      </div>
    </Card>
  );
}
