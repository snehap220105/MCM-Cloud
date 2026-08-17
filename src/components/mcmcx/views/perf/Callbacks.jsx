/**
 * Performance › Callbacks.
 *
 * Ported from the prototype's "Engine v12.5 (Callbacks & Voicemail)" patch —
 * the supervisor side of it: the scheduled callback list (callers who pressed 1
 * in queue keep their place), manual scheduling, cancellation, and the queue
 * voicemail inbox with playback and speech-to-text transcripts.
 *
 * The floor simulation that fed the list is kept: roughly every 40 seconds a
 * waiting caller either opts for a callback or leaves a voicemail. The legacy
 * tick picked the busiest voice queue from the live board's queue state; that
 * state belongs to the Queues Activity view, so here any voice queue is
 * eligible — the cadence and the caps (5 waiting callbacks, 4 new voicemails)
 * are unchanged.
 *
 * The agent-workspace half of the original patch (the callback offer, accept
 * and defer) belongs to the agent desktop and is not part of this view.
 */
import { useEffect, useRef, useState } from 'react';
import { audit, db as store, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
/* --------------------------------------------------------------- helpers */

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
function fmt(seconds) {
  const s = Math.round(seconds || 0);
  return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
}
function clock() {
  return new Date().toTimeString().slice(0, 5);
}

/** The prototype stamped the assigned agent and the completion time too. */

function callbacksOf(database) {
  return database.callbacks ?? [];
}

/** Voicemail durations are stored in seconds. */
function vmSeconds(vm) {
  return Number(vm.dur) || 0;
}
const CUST = [
  ['Oliver Smith', '+447700900101'],
  ['Amelia Jones', '+447700900102'],
  ['Zara Khan', '+447811223344'],
  ['Tom Hughes', '+447922334455'],
  ['Lucy Ford', '+447700111222'],
  ['Harry Cole', '+447700333444'],
];
const VMTXT = [
  "Hi, I was on hold for ages about my bill being wrong this month. Please call me back — it's urgent.",
  'Hello, my direct debit bounced and I want to sort a payment plan before it goes further. Thanks.',
  'Hi, I tried to upgrade online but the page errored at the last step. Can someone ring me back today?',
  'Calling about the engineer visit — nobody turned up in the slot. I need this rebooked please.',
];

/** Queues that take voice — chat and email queues never get callbacks. */
function voiceQueues(database) {
  return (database.queues || []).filter((q) => !/chat|email/i.test(q.name));
}

/** The prototype's `ensureCBVM()`. */
function ensureCallbacksSeed() {
  if (store.__cbSeed) return;
  const qs = store.queues || [];
  if (!qs.length) return;
  mutate((d) => {
    const vq = voiceQueues(d);
    const q0 = (vq[0] || qs[0]).name;
    const q1 = (vq[1] || qs[0]).name;
    d.callbacks = d.callbacks || [];
    d.voicemails = d.voicemails || [];
    d.callbacks.push(
      {
        id: uid(),
        customer: CUST[0][0],
        ani: CUST[0][1],
        queue: q0,
        reqAt: '09:12',
        due: '',
        state: 'Waiting',
        attempts: 0,
        by: 'IVR offer (pressed 1 in queue)',
        notes: 'Billing dispute — kept queue position',
      },
      {
        id: uid(),
        customer: CUST[1][0],
        ani: CUST[1][1],
        queue: q0,
        reqAt: '09:48',
        due: '',
        state: 'Waiting',
        attempts: 0,
        by: 'IVR offer (pressed 1 in queue)',
        notes: '',
      },
      {
        id: uid(),
        customer: CUST[2][0],
        ani: CUST[2][1],
        queue: q1,
        reqAt: '10:05',
        due: '15:30',
        state: 'Waiting',
        attempts: 0,
        by: 'Agent scheduled',
        notes: 'Asked for an afternoon call',
      }
    );
    d.voicemails.push(
      {
        id: uid(),
        from: CUST[3][0],
        ani: CUST[3][1],
        queue: q0,
        at: '08:41',
        dur: '34',
        transcript: VMTXT[0],
        state: 'New',
      },
      {
        id: uid(),
        from: CUST[4][0],
        ani: CUST[4][1],
        queue: q1,
        at: '09:15',
        dur: '27',
        transcript: VMTXT[1],
        state: 'New',
      },
      {
        id: uid(),
        from: CUST[5][0],
        ani: CUST[5][1],
        queue: q0,
        at: '09:52',
        dur: '41',
        transcript: VMTXT[2],
        state: 'Heard',
      }
    );
    d.__cbSeed = true;
  });
}

/* --------------------------------------------------- schedule a callback */

const WHEN_OPTIONS = [
  ['', 'As soon as an agent is free'],
  ['14:00', '14:00'],
  ['15:30', '15:30'],
  ['17:00', '17:00'],
];
function NewCallbackDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const queues = voiceQueues(db);
  const [name, setName] = useState('');
  const [num, setNum] = useState('');
  const [queue, setQueue] = useState(queues[0]?.name ?? '');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  function save() {
    const n = name.trim();
    const number = num.trim();
    if (n.length < 2 || number.length < 6) {
      toast('Enter a customer name and a valid number');
      return;
    }
    mutate((d) => {
      d.callbacks.push({
        id: uid(),
        customer: n,
        ani: number,
        queue,
        reqAt: clock(),
        due: when,
        state: 'Waiting',
        attempts: 0,
        by: 'Supervisor scheduled',
        notes: note.trim(),
      });
    });
    audit('Callback scheduled', n + ' (' + number + ')');
    onClose();
    toast('Callback saved — it will be offered when due');
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 420,
          height: 'auto',
          top: '16%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>Schedule a callback</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div className="fld">
            <label>Customer name *</label>
            <input
              value={name}
              placeholder="e.g. Oliver Smith"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="fld">
            <label>Number *</label>
            <input value={num} placeholder="+44…" onChange={(e) => setNum(e.target.value)} />
          </div>
          <div className="fld">
            <label>Queue</label>
            <select value={queue} onChange={(e) => setQueue(e.target.value)}>
              {queues.map((q) => (
                <option key={q.id}>{q.name}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>When</label>
            <select value={when} onChange={(e) => setWhen(e.target.value)}>
              {WHEN_OPTIONS.map(([value, label]) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Note</label>
            <input value={note} placeholder="optional" onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Save callback
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------- voicemail player */

function VoicemailDrawer({ vm, onClose, onCallBack }) {
  const dur = vmSeconds(vm);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);

  /* The prototype's `vmToggle()` — a 300 ms ticker walking the progress bar. */
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPos((current) => {
        const next = current + Math.max(1, Math.round(dur / 25));
        if (next >= dur) {
          setPlaying(false);
          return dur;
        }
        return next;
      });
    }, 300);
    return () => window.clearInterval(timer);
  }, [playing, dur]);
  function toggle() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (pos >= dur) setPos(0);
    setPlaying(true);
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 460,
          height: 'auto',
          top: '16%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>📼 Voicemail — {vm.from}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div
            style={{
              fontSize: 12.5,
              color: '#5a6b85',
              marginBottom: 8,
            }}
          >
            {vm.ani} · {vm.queue} · left at {vm.at} · {fmt(dur)}
          </div>

          <div
            style={{
              background: '#0f1a2e',
              borderRadius: 10,
              padding: '12px 14px',
              color: '#dfe7f5',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <button
                className="btn"
                style={{
                  width: 44,
                }}
                onClick={toggle}
              >
                {playing ? '❚❚' : '▶'}
              </button>
              <div
                style={{
                  flex: 1,
                  height: 8,
                  background: '#23324e',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: (dur ? (100 * pos) / dur : 0) + '%',
                    background: '#FF4F1F',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  width: 84,
                  textAlign: 'right',
                }}
              >
                {fmt(pos)} / {fmt(dur)}
              </span>
            </div>
          </div>

          <div className="sect">Transcript (speech-to-text)</div>
          <div
            style={{
              background: '#f4f7fb',
              border: '1px solid #dfe5ee',
              borderRadius: 8,
              padding: '10px 13px',
              fontSize: 12.5,
              lineHeight: 1.6,
              fontStyle: 'italic',
            }}
          >
            “{vm.transcript}”
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Close
          </button>
          <button
            className="btn"
            onClick={() => {
              onClose();
              onCallBack(vm.id);
            }}
          >
            📞 Call {vm.from.split(' ')[0]} back
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- tab */

/** Keeps the simulation cadence across tab switches, as the global tick did. */
let simN = 0;
function StateTag({ state }) {
  const colour =
    state === 'Waiting'
      ? '#e0a200'
      : state === 'In progress'
        ? '#1f6feb'
        : state === 'Completed'
          ? '#1f9d63'
          : '#8a94a6';
  return (
    <span
      className="st"
      style={{
        color: colour,
      }}
    >
      <span
        className="d"
        style={{
          background: colour,
        }}
      />
      {state}
    </span>
  );
}
export default function CallbacksTab() {
  const db = useDb();
  const { toast } = useUi();
  const [showNew, setShowNew] = useState(false);
  const [playing, setPlaying] = useState(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    ensureCallbacksSeed();
  }, []);

  /* The prototype's `cbTick()` — every ~40 s a waiting caller opts for a
     callback or leaves a voicemail. */
  useEffect(() => {
    const timer = window.setInterval(() => {
      simN++;
      if (simN % 20 !== 0) return;
      const busyQ = voiceQueues(store)[0];
      if (!busyQ) return;
      const c = CUST[Math.floor(Math.random() * CUST.length)];
      const waitingCb = callbacksOf(store).filter((x) => x.state === 'Waiting').length;
      const newVm = (store.voicemails ?? []).filter((x) => x.state === 'New').length;
      if (Math.random() < 0.6 && waitingCb < 5) {
        mutate((d) => {
          d.callbacks.push({
            id: uid(),
            customer: c[0],
            ani: c[1],
            queue: busyQ.name,
            reqAt: clock(),
            due: '',
            state: 'Waiting',
            attempts: 0,
            by: 'IVR offer (pressed 1 in queue)',
            notes: '',
          });
        });
        toastRef.current(
          `↩ A caller in ${busyQ.name} opted for a callback — kept their queue position`
        );
      } else if (newVm < 4) {
        mutate((d) => {
          d.voicemails.push({
            id: uid(),
            from: c[0],
            ani: c[1],
            queue: busyQ.name,
            at: clock(),
            dur: String(20 + Math.floor(Math.random() * 30)),
            transcript: VMTXT[Math.floor(Math.random() * VMTXT.length)],
            state: 'New',
          });
        });
        toastRef.current(`📼 New voicemail left in ${busyQ.name}`);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);
  const callbacks = callbacksOf(db);
  const voicemails = db.voicemails ?? [];
  const rows = callbacks.slice().reverse();
  const vmRows = voicemails.slice().reverse();
  const waitingN = callbacks.filter((x) => x.state === 'Waiting').length;
  const newVmN = voicemails.filter((x) => x.state === 'New').length;
  const playingVm = playing ? voicemails.find((v) => v.id === playing) : undefined;

  /** The prototype's `cbCancel()`. */
  function cbCancel(id) {
    const c = callbacks.find((x) => x.id === id);
    if (!c) return;
    mutate((d) => {
      const target = callbacksOf(d).find((x) => x.id === id);
      if (target) target.state = 'Cancelled';
    });
    audit('Callback cancelled', c.customer + ' (' + c.queue + ')');
    toast('Callback cancelled');
  }

  /** The prototype's `vmPlay()` — opens the player and marks the message heard. */
  function vmPlay(id) {
    mutate((d) => {
      const vm = d.voicemails.find((x) => x.id === id);
      if (vm && vm.state === 'New') vm.state = 'Heard';
    });
    setPlaying(id);
  }

  /**
   * The prototype's `vmCall()`. Placing the outbound leg belongs to the agent
   * desktop, so here the message is marked heard and the call-back is audited.
   */
  function vmCall(id) {
    const vm = voicemails.find((x) => x.id === id);
    if (!vm) return;
    mutate((d) => {
      const target = d.voicemails.find((x) => x.id === id);
      if (target) target.state = 'Heard';
    });
    audit('Voicemail call-back', vm.from + ' (' + vm.ani + ')');
    toast(`Dialling ${vm.from} back…`);
  }
  return (
    <div className="pbody">
      <div className="tbar">
        <div
          className="chip"
          style={{
            color: '#1f9d63',
          }}
        >
          ● Live
        </div>
        <div className="chip">
          {waitingN} callback{waitingN === 1 ? '' : 's'} waiting
        </div>
        <div className="chip">{newVmN} new voicemails</div>
        <div className="sp" />
        <button
          className="btn"
          style={{
            fontSize: 12,
          }}
          onClick={() => setShowNew(true)}
        >
          ＋ Schedule callback
        </button>
      </div>

      <div className="panel">
        <h3>
          Scheduled callbacks <span className="sp" />
          <small>
            callers keep their queue position — agents get them offered when idle &amp; On Queue
          </small>
        </h3>
        <table className="dt">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Number</th>
              <th>Queue</th>
              <th>Requested</th>
              <th>Due</th>
              <th>Origin</th>
              <th>State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.customer}</b>
                  </td>
                  <td
                    style={{
                      fontSize: 11.5,
                      color: '#5a6b85',
                    }}
                  >
                    {c.ani}
                  </td>
                  <td>{c.queue}</td>
                  <td>{c.reqAt}</td>
                  <td>{c.due ? c.due : 'ASAP'}</td>
                  <td
                    style={{
                      fontSize: 11.5,
                    }}
                  >
                    {c.by}
                  </td>
                  <td>
                    <StateTag state={c.state} />
                    {c.agent ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#8794a8',
                        }}
                      >
                        {c.agent}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {c.state === 'Waiting' ? (
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                          color: '#c9401a',
                          cursor: 'pointer',
                        }}
                        onClick={() => cbCancel(c.id)}
                      >
                        Cancel
                      </a>
                    ) : c.doneAt ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#8794a8',
                        }}
                      >
                        done {c.doneAt}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: 'center',
                    color: '#8794a8',
                    padding: 16,
                  }}
                >
                  No callbacks yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>
          Queue voicemail <span className="sp" />
          <small>with speech-to-text transcripts</small>
        </h3>
        <table className="dt">
          <thead>
            <tr>
              <th>From</th>
              <th>Number</th>
              <th>Queue</th>
              <th>Left at</th>
              <th>Length</th>
              <th>Transcript</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vmRows.length ? (
              vmRows.map((v) => (
                <tr key={v.id}>
                  <td>
                    {v.state === 'New' ? (
                      <>
                        🔵 <b>{v.from}</b>
                      </>
                    ) : (
                      v.from
                    )}
                  </td>
                  <td
                    style={{
                      fontSize: 11.5,
                      color: '#5a6b85',
                    }}
                  >
                    {v.ani}
                  </td>
                  <td>{v.queue}</td>
                  <td>{v.at}</td>
                  <td>{fmt(vmSeconds(v))}</td>
                  <td
                    style={{
                      fontSize: 11.5,
                      color: '#5a6b85',
                      maxWidth: 320,
                    }}
                  >
                    {v.transcript.slice(0, 80)}…
                  </td>
                  <td>
                    <a
                      className="lnk"
                      style={{
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                      onClick={() => vmPlay(v.id)}
                    >
                      ▶ Play
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    color: '#8794a8',
                    padding: 16,
                  }}
                >
                  No voicemails
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew ? <NewCallbackDrawer onClose={() => setShowNew(false)} /> : null}
      {playingVm ? (
        <VoicemailDrawer vm={playingVm} onClose={() => setPlaying(null)} onCallBack={vmCall} />
      ) : null}
    </div>
  );
}
