import { useEffect, useRef, useState } from 'react';
import Drawer from '../Drawer';
import { fmt } from '../../lib/workspace/helpers';

// Ported from vmPlay()/vmToggle() (lines 8145-8176).
export default function VoicemailDrawer({ vm, actions, onClose, onCallBack }) {
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    actions.vmHeard(vm.id);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    if (playing) {
      clearInterval(timer.current);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    timer.current = setInterval(() => {
      setPos((p) => {
        const next = p + Math.max(1, Math.round(vm.dur / 25));
        if (next >= vm.dur) {
          clearInterval(timer.current);
          setPlaying(false);
          return vm.dur;
        }
        return next;
      });
    }, 300);
  }

  return (
    <Drawer
      title={<>📼 Voicemail — {vm.from}</>}
      onClose={onClose}
      panelStyle={{ width: 460, height: 'auto', top: '16%', bottom: 'auto', borderRadius: '8px 0 0 8px' }}
      footer={<>
      <button className="btn sec" onClick={onClose}>Close</button>
      <button className="btn" onClick={() => { onClose(); onCallBack(vm.id); }}>📞 Call {vm.from.split(' ')[0]} back</button>
    </>}>
      <div style={{ fontSize: 12.5, color: '#5a6b85', marginBottom: 8 }}>{vm.ani} · {vm.queue} · left at {vm.at} · {fmt(vm.dur)}</div>
      <div style={{ background: '#0f1a2e', borderRadius: 10, padding: '12px 14px', color: '#dfe7f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn" style={{ width: 44 }} onClick={toggle}>{playing ? '❚❚' : '▶'}</button>
          <div style={{ flex: 1, height: 8, background: '#23324e', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (100 * pos / vm.dur) + '%', background: '#FF4F1F' }} />
          </div>
          <span style={{ fontSize: 12, width: 84, textAlign: 'right' }}>{fmt(pos)} / {fmt(vm.dur)}</span>
        </div>
      </div>
      <div className="sect">Transcript (speech-to-text)</div>
      <div style={{ background: '#f4f7fb', border: '1px solid #dfe5ee', borderRadius: 8, padding: '10px 13px', fontSize: 12.5, lineHeight: 1.6, fontStyle: 'italic' }}>
        “{vm.transcript}”
      </div>
    </Drawer>
  );
}
