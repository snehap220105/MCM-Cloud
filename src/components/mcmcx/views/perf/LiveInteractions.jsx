/**
 * Performance › Live Interactions.
 *
 * Ported from the prototype's "Engine v12.4 (Supervisor Monitoring)" patch:
 * every conversation in progress right now, with Listen / Whisper / Barge-in
 * carrying the real Genesys semantics — Listen is silent, Whisper is heard only
 * by the agent, Barge joins the call — plus the agent board actions (set
 * status, log off, monitor the active interaction).
 *
 * Finished live interactions flow into `db.interactions`, so Answered / AHT and
 * the reports keep moving all day, exactly as in the original.
 *
 * The floor state (which agent is interacting) lived on the prototype's global
 * `PERF.agents`, owned by the Queues Activity engine. That state is not shared
 * between the ported tabs, so this view runs its own equivalent simulation;
 * unlike the legacy rotation it can also put an agent into `Interacting`, which
 * is what puts conversations on the board.
 *
 * The signed-in agent's own call mirrored the agent desktop in the original —
 * that half belongs to the agent desktop view and is not ported here.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { audit, db as store, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { AssignCoachingDrawer } from './_coaching';
import { ensureAgent } from './_live';

/* --------------------------------------------------------------- helpers */

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
function fmt(seconds) {
  const s = Math.round(seconds || 0);
  return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
}
function dayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function hash(value) {
  const s = String(value);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

const CUST = [
  'Oliver Smith',
  'Amelia Jones',
  'Zara Khan',
  'Tom Hughes',
  'Nina Gupta',
  'Sam Carter',
  'Lucy Ford',
  'Harry Cole',
  'Mia Torres',
  'Ethan Brooks',
  'Ava Patel',
  'Leo Grant',
];
const MEDIA_ICON = {
  Voice: '📞',
  Chat: '💬',
  Email: '✉️',
  Message: '📱',
};

/* ------------------------------------------------- live floor simulation */

/** `window.LIVEIX` in the prototype — module state so it survives tab switches. */
const LIVE = [];
/** Notified whenever an interaction leaves the board, so monitoring can stop. */
let finishListener = null;

/**
 * This agent's entry on the shared floor.
 *
 * The prototype read `PERF.agents[u.id]` here — one floor behind every
 * Performance tab. Using it means an agent on a call in this board also reads
 * "Interacting" on the Agents tab, instead of the two disagreeing.
 */
function floorState(u) {
  return ensureAgent(u);
}
function agentQueues(u) {
  return (store.queues || []).filter((q) => q.members.indexOf(u.id) > -1);
}
function spawnFor(u) {
  const qs = agentQueues(u);
  const q = qs.length ? qs[(hash(u.name) + LIVE.length) % qs.length] : (store.queues || [])[0];
  if (!q) return;
  const media = /chat/i.test(q.name) ? 'Chat' : /email/i.test(q.name) ? 'Email' : 'Voice';
  const c = CUST[Math.floor(Math.random() * CUST.length)];
  LIVE.push({
    id: uid(),
    agentId: u.id,
    agent: u.name,
    customer: c,
    ani:
      media === 'Voice'
        ? '+4477' + String(Math.floor(Math.random() * 90000000) + 10000000)
        : media === 'Chat'
          ? 'web chat'
          : 'email',
    queue: q.name,
    media,
    state: 'Talking',
    secs: 5 + Math.floor(Math.random() * 40),
    wait: 4 + Math.floor(Math.random() * 20),
    holdS: 0,
    sent: 0,
  });
}

/** Ends a live conversation and files it in the interaction store. */
function finishIx(ix, reason) {
  const i = LIVE.indexOf(ix);
  if (i > -1) LIVE.splice(i, 1);
  const wraps = (store.wrapup || []).map((w) => w.name);
  mutate((d) => {
    d.interactions.unshift({
      id: uid(),
      name: ix.customer,
      ani: ix.ani,
      queue: ix.queue,
      agent: ix.agent,
      dur: fmt(ix.secs),
      wrap: wraps.length ? wraps[hash(ix.customer) % wraps.length] : 'Resolved',
      t: new Date().toTimeString().slice(0, 8),
      d: dayISO(),
      media: ix.media,
      dir: 'inbound',
      waitS: ix.wait,
      talkS: ix.secs,
      holdS: ix.holdS,
      acwS: 15 + (hash(ix.agent) % 40),
      result: 'Handled',
    });
  });
  finishListener?.(ix, reason);
}

/**
 * Agents who could take an ACD interaction: active, in at least one queue, and
 * not the signed-in user — their row mirrors the real workspace, so the
 * simulation leaves it alone exactly as the prototype's `!s.real` guard did.
 */
function staffedAgents() {
  return store.users.filter(
    (u) => u.state === 'Active' && agentQueues(u).length && !ensureAgent(u).real
  );
}

/**
 * How many conversations the floor should be carrying.
 *
 * About a third of staffed agents busy at once, and never fewer than two, so the
 * board always shows something.
 */
function targetLive() {
  const staffed = staffedAgents().length;
  if (!staffed) return 0;
  return Math.max(2, Math.min(staffed, Math.round(staffed * 0.35)));
}

/**
 * Keep the floor populated.
 *
 * In the prototype the board was already busy by the time anyone opened it: the
 * engine had been drifting agents since page load and shared `PERF.agents` with
 * the Queues Activity tab. Here the simulation only runs while this tab is
 * mounted, so relying on drift alone left the board empty — a conversation ends
 * whenever its agent drifts out of `Interacting`, but drifting *into* it is rare,
 * so the board starved and never recovered.
 *
 * Instead of seeding once, this tops the floor back up to `targetLive()` on
 * every tick, which is what a real contact centre does: as one call wraps up,
 * the next is offered to whoever is free.
 */
let floorFilled = false;
function maintainFloor() {
  const target = targetLive();
  const busy = new Set(LIVE.map((x) => x.agentId));
  // Prefer agents who are ready for work before pulling anyone else in.
  const candidates = staffedAgents()
    .filter((u) => !busy.has(u.id))
    .sort((a, b) => {
      const rank = (u) => {
        const st = floorState(u).state;
        return st === 'On Queue' ? 0 : st === 'Available' ? 1 : 2;
      };
      return rank(a) - rank(b);
    });
  for (const u of candidates) {
    if (LIVE.length >= target) break;
    const s = floorState(u);
    s.state = 'Interacting';
    s.since = Date.now() - (30 + (hash(u.name) % 180)) * 1000;
    spawnFor(u);
    // On the first fill, age the conversations so durations do not all start
    // at 00:00 as though the centre had just opened.
    if (!floorFilled) {
      const ix = LIVE[LIVE.length - 1];
      if (ix) ix.secs = 20 + (hash(u.name) % 200);
    }
  }
  floorFilled = true;
}

/**
 * The prototype's `liveIxTick()` — runs every two seconds.
 *
 * Agents are drifted by the shared board engine in `_live.jsx`, exactly as the
 * original left that to the Queues Activity engine. This pass only reacts to the
 * result: start a conversation for anyone who is Interacting without one, and
 * end the conversation of anyone who has moved on.
 */
function liveIxTick() {
  if (!store.queues) return;
  const active = store.users.filter((u) => u.state === 'Active');
  active.forEach((u) => {
    const s = floorState(u);
    if (s.real) return; /* the signed-in agent mirrors their real workspace */
    const mine = LIVE.filter((x) => x.agentId === u.id);
    if (s.state === 'Interacting' && !mine.length) spawnFor(u);
    if (s.state !== 'Interacting' && mine.length) mine.forEach((x) => finishIx(x));
  });
  LIVE.slice().forEach((ix) => {
    ix.secs += 2;
    const r = Math.random();
    if (ix.state === 'Talking' && r < 0.04) {
      ix.state = 'Hold';
    } else if (ix.state === 'Hold') {
      ix.holdS += 2;
      if (r < 0.3) ix.state = 'Talking';
    }
    ix.sent = Math.max(-100, Math.min(100, ix.sent + (r < 0.45 ? -6 : 6)));
    if (ix.secs > 420 && r < 0.12) finishIx(ix);
  });

  // Last, after this tick's calls have ended: offer the free agents new work.
  maintainFloor();
}

/* ------------------------------------------------------------- rendering */

function SentBadge({ value }) {
  const colour = value > 15 ? '#1f9d63' : value < -15 ? '#d0342c' : '#e0a200';
  const label = value > 15 ? 'Positive' : value < -15 ? 'Negative' : 'Neutral';
  return (
    <>
      <span
        style={{
          color: colour,
          fontWeight: 700,
        }}
      >
        {label}
      </span>{' '}
      <span
        style={{
          color: '#8794a8',
          fontSize: 11,
        }}
      >
        ({value > 0 ? '+' : ''}
        {value})
      </span>
    </>
  );
}
const MODE_ICON = {
  Listen: '👂',
  Whisper: '🗣',
  Barge: '⚡',
};
function MonitorDrawer({ mon, ix, tick, onMode, onEnd }) {
  const mode = mon.mode;
  const barColour = mode === 'Listen' ? '#33507e' : mode === 'Whisper' ? '#c47f16' : '#c93a4e';
  /* The prototype re-randomised the level meter on every tick. */
  const bars = useMemo(
    () =>
      Array.from(
        {
          length: 26,
        },
        () => 4 + Math.random() * 26
      ),
    [tick, mode]
  );
  function ModeButton({ m, ico, desc, danger }) {
    const on = mode === m;
    return (
      <div
        onClick={() => onMode(m)}
        style={{
          flex: 1,
          border: '2px solid ' + (on ? (danger ? '#d0342c' : '#FF4F1F') : '#dde3ec'),
          borderRadius: 10,
          padding: 12,
          textAlign: 'center',
          cursor: 'pointer',
          background: on ? (danger ? '#fdecea' : '#fff4f0') : '#fff',
        }}
      >
        <div
          style={{
            fontSize: 20,
          }}
        >
          {ico}
        </div>
        <b
          style={{
            fontSize: 13,
          }}
        >
          {m}
        </b>
        <div
          style={{
            fontSize: 10.5,
            color: '#8794a8',
            marginTop: 3,
            lineHeight: 1.4,
          }}
        >
          {desc}
        </div>
      </div>
    );
  }
  return (
    <>
      <div id="scrim" onClick={onEnd} />
      <div
        id="drw"
        style={{
          width: 520,
        }}
      >
        <div className="dh">
          <h2>
            {MODE_ICON[mode]} Monitoring — {ix.agent}
          </h2>
          <div className="x" onClick={onEnd} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div
            className="kpis"
            style={{
              gridTemplateColumns: 'repeat(3,1fr)',
            }}
          >
            <div className="kpi">
              <span>Customer</span>
              <b
                style={{
                  fontSize: 14,
                }}
              >
                {ix.customer}
              </b>
              <i>{ix.ani}</i>
            </div>
            <div className="kpi">
              <span>Queue</span>
              <b
                style={{
                  fontSize: 14,
                }}
              >
                {ix.queue}
              </b>
              <i>
                {ix.media} · {ix.state}
              </i>
            </div>
            <div className="kpi">
              <span>Monitoring for</span>
              <b
                style={{
                  fontSize: 14,
                }}
              >
                {fmt(mon.secs)}
              </b>
              <i>call at {fmt(ix.secs)}</i>
            </div>
          </div>

          <div
            style={{
              background: '#0f1a2e',
              borderRadius: 10,
              padding: '14px 16px',
              marginTop: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 2,
                height: 32,
                alignItems: 'flex-end',
              }}
            >
              {bars.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    background: barColour,
                    borderRadius: 1,
                    alignSelf: 'flex-end',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#8fa2c4',
                marginTop: 8,
              }}
            >
              {mode === 'Listen' ? (
                'Silent monitoring — the agent and customer cannot hear you. The agent is not notified.'
              ) : mode === 'Whisper' ? (
                <>
                  Whisper coaching —{' '}
                  <b
                    style={{
                      color: '#ffcf5c',
                    }}
                  >
                    only the agent hears you
                  </b>
                  . Use it to coach through a tough moment.
                </>
              ) : (
                <>
                  <b
                    style={{
                      color: '#ff7d90',
                    }}
                  >
                    You are live on the call
                  </b>{' '}
                  — both the agent and the customer can hear you.
                </>
              )}
            </div>
          </div>

          <div className="sect">Switch mode</div>
          <div
            style={{
              display: 'flex',
              gap: 10,
            }}
          >
            <ModeButton m="Listen" ico="👂" desc="Silent — nobody hears you" />
            <ModeButton m="Whisper" ico="🗣" desc="Coach — agent only" />
            <ModeButton m="Barge" ico="⚡" desc="Join — everyone hears you" danger />
          </div>

          {ix.media === 'Voice' ? null : (
            <div
              style={{
                fontSize: 11.5,
                color: '#8794a8',
                marginTop: 8,
              }}
            >
              Digital interaction — you are viewing the live transcript; whisper appears to the
              agent as a private note.
            </div>
          )}
        </div>

        <div className="df">
          <button className="btn sec" onClick={onEnd}>
            End monitoring
          </button>
          <button className="btn" onClick={onEnd}>
            Back to live view
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------- agent actions */

function AgentDrawer({ user, onClose, onMonitor, onSetStatus, onLogoff, onAssignCoaching }) {
  const db = useDb();
  const s = floorState(user);
  const ix = LIVE.find((x) => x.agentId === user.id);
  const mins = Math.floor((Date.now() - s.since) / 60000);
  const sessions = (db.coaching ?? []).filter((c) => c.agent === user.name);
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 440,
          height: 'auto',
          top: '14%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>{user.name}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div
            style={{
              fontSize: 12.5,
              color: '#33425c',
              marginBottom: 10,
            }}
          >
            Status: <b>{s.state}</b> for {mins < 1 ? '<1' : mins} min · {user.title || ''}
          </div>

          {ix ? (
            <div
              style={{
                background: '#e8f7ef',
                border: '1px solid #bfe6cf',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12.5,
                marginBottom: 10,
              }}
            >
              On a {ix.media.toLowerCase()} with <b>{ix.customer}</b> ({ix.queue}, {fmt(ix.secs)}){' '}
              {ix.media === 'Voice' ? (
                <div
                  style={{
                    marginTop: 6,
                  }}
                >
                  <a
                    className="lnk"
                    style={{
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      onClose();
                      onMonitor(ix.id, 'Listen');
                    }}
                  >
                    👂 Listen
                  </a>
                  {' · '}
                  <a
                    className="lnk"
                    style={{
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      onClose();
                      onMonitor(ix.id, 'Whisper');
                    }}
                  >
                    🗣 Whisper
                  </a>
                  {' · '}
                  <a
                    className="lnk"
                    style={{
                      cursor: 'pointer',
                      color: '#c9401a',
                    }}
                    onClick={() => {
                      onClose();
                      onMonitor(ix.id, 'Barge');
                    }}
                  >
                    ⚡ Barge
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="sect">Set status</div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {AGENT_STATES.map((st) => (
              <button
                key={st}
                className={'btn' + (s.state === st ? '' : ' sec')}
                style={{
                  fontSize: 12,
                }}
                onClick={() => onSetStatus(user.id, st)}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="sect">Actions</div>
          <button
            className="btn gh"
            style={{
              color: '#c9401a',
              fontSize: 12,
            }}
            onClick={() => onLogoff(user.id)}
          >
            Log agent off
          </button>
          <div
            style={{
              fontSize: 11,
              color: '#8794a8',
              marginTop: 6,
            }}
          >
            Status changes and log-offs are audited, and the agent sees the change immediately — as
            in Genesys.
          </div>

          <div className="sect">Coaching</div>
          {sessions.length ? (
            sessions.map((c) => (
              <div
                key={c.id}
                style={{
                  fontSize: 12,
                  padding: '5px 0',
                  borderBottom: '1px solid #f2f5f9',
                }}
              >
                <b>{c.topic}</b> · due {c.due} ·{' '}
                {c.state === 'Scheduled' ? (
                  <span
                    style={{
                      color: '#e0a200',
                      fontWeight: 700,
                    }}
                  >
                    Scheduled
                  </span>
                ) : (
                  <span
                    style={{
                      color: '#1f9d63',
                      fontWeight: 700,
                    }}
                  >
                    Completed
                  </span>
                )}
              </div>
            ))
          ) : (
            <div
              style={{
                fontSize: 12,
                color: '#8794a8',
              }}
            >
              No sessions yet.
            </div>
          )}
          <button
            className="btn sec"
            style={{
              fontSize: 12,
              marginTop: 8,
            }}
            onClick={() => onAssignCoaching(user.id)}
          >
            ＋ Assign coaching
          </button>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- tab */

export default function LiveInteractionsTab() {
  const db = useDb();
  const { toast } = useUi();
  const [tick, setTick] = useState(0);
  const [mon, setMon] = useState(null);
  const [agentDrawer, setAgentDrawer] = useState(null);
  const [coachingFor, setCoachingFor] = useState(null);
  const monRef = useRef(null);
  monRef.current = mon;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  /* Monitoring stops by itself when the conversation it watched ends. */
  useEffect(() => {
    finishListener = (ix, reason) => {
      if (monRef.current && monRef.current.ixId === ix.id) {
        setMon(null);
        toastRef.current(
          'The monitored interaction ended' +
            (reason ? ' — ' + reason : '') +
            '; monitoring stopped.'
        );
      }
    };
    return () => {
      finishListener = null;
    };
  }, []);

  /* The floor simulation — two-second cadence, stopped when the tab unmounts.
     Seed on mount so the board is populated on the first paint. */
  useEffect(() => {
    liveIxTick();
    setTick((t) => t + 1);
    const timer = window.setInterval(() => {
      liveIxTick();
      setMon((current) =>
        current
          ? {
              ...current,
              secs: current.secs + 2,
            }
          : current
      );
      setTick((t) => t + 1);
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);
  const monitored = mon ? LIVE.find((x) => x.id === mon.ixId) : undefined;
  const drawerUser = agentDrawer ? db.users.find((u) => u.id === agentDrawer) : undefined;

  /** The prototype's `monStart()`. */
  function monStart(ixId, mode) {
    const ix = LIVE.find((x) => x.id === ixId);
    if (!ix) return;
    setMon({
      ixId,
      mode,
      secs: 0,
    });
    audit(
      'Monitor — ' + mode,
      ix.agent +
        ' ↔ ' +
        ix.customer +
        ' (' +
        ix.queue +
        ')' +
        (mode === 'Barge'
          ? ' — supervisor joined the call'
          : mode === 'Whisper'
            ? ' — coaching, customer cannot hear'
            : ' — silent')
    );
    toast(
      mode === 'Listen'
        ? '👂 Listening silently — neither party can hear you'
        : mode === 'Whisper'
          ? `🗣 Whisper coaching ${ix.agent} — the customer cannot hear you`
          : '⚡ You barged into the call — both parties can hear you'
    );
  }

  /** The prototype's `monMode()`. */
  function monMode(mode) {
    if (!mon) return;
    const ix = LIVE.find((x) => x.id === mon.ixId);
    if (ix) audit('Monitor mode → ' + mode, ix.agent + ' ↔ ' + ix.customer);
    setMon({
      ...mon,
      mode,
    });
  }

  /** The prototype's `monEnd()`. */
  function monEnd() {
    if (mon) {
      const ix = LIVE.find((x) => x.id === mon.ixId);
      audit(
        'Monitoring ended',
        ix ? ix.agent + ' ↔ ' + ix.customer + ' after ' + fmt(mon.secs) : ''
      );
    }
    setMon(null);
  }

  /** The prototype's `monSetStatus()`. */
  function monSetStatus(userId, st) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    const s = floorState(u);
    const was = s.state;
    s.state = st;
    s.since = Date.now();
    if (st !== 'On Queue' && st !== 'Interacting')
      LIVE.filter((x) => x.agentId === userId && !x.real).forEach((x) =>
        finishIx(x, 'agent status changed')
      );
    audit('Supervisor set status', u.name + ': ' + was + ' → ' + st);
    setAgentDrawer(null);
    setTick((t) => t + 1);
    toast(`${u.name} set to ${st}`);
  }

  /** The prototype's `monLogoff()`. */
  function monLogoff(userId) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    const s = floorState(u);
    s.state = 'Logged off';
    s.since = Date.now();
    LIVE.filter((x) => x.agentId === userId && !x.real).forEach((x) =>
      finishIx(x, 'agent logged off')
    );
    audit('Supervisor log-off', u.name + ' logged off by supervisor');
    setAgentDrawer(null);
    setTick((t) => t + 1);
    toast(`${u.name} logged off — their queues re-route to other members`);
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
          ● Live — {LIVE.length} interaction{LIVE.length === 1 ? '' : 's'} in progress
        </div>
        <div className="sp" />
        <div className="chip">Monitoring is recorded in the audit log, like Genesys</div>
      </div>

      <div className="panel">
        <h3>
          Interactions in progress <span className="sp" />
          <small>
            Listen is silent · Whisper coaches the agent privately · Barge joins the call
          </small>
        </h3>
        <table className="dt">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Customer</th>
              <th>Remote</th>
              <th>Media</th>
              <th>Queue</th>
              <th>State</th>
              <th>Duration</th>
              <th>Live sentiment</th>
              <th
                style={{
                  width: 220,
                }}
              >
                Monitor
              </th>
            </tr>
          </thead>
          <tbody>
            {LIVE.length ? (
              LIVE.map((ix) => {
                const stCol =
                  ix.state === 'Talking' ? '#1f9d63' : ix.state === 'Hold' ? '#d0342c' : '#5a6b85';
                return (
                  <tr key={ix.id}>
                    <td>
                      {/* Clicking the agent opens the supervisor actions the
                          prototype reached from the Agents board. */}
                      <b
                        style={{
                          cursor: 'pointer',
                        }}
                        title="Supervisor actions"
                        onClick={() => setAgentDrawer(ix.agentId)}
                      >
                        {ix.agent}
                      </b>
                      {ix.real ? (
                        <>
                          {' '}
                          <span className="tag o">real</span>
                        </>
                      ) : null}
                    </td>
                    <td>{ix.customer}</td>
                    <td
                      style={{
                        fontSize: 11.5,
                        color: '#5a6b85',
                      }}
                    >
                      {ix.ani}
                    </td>
                    <td>
                      {MEDIA_ICON[ix.media]} {ix.media}
                    </td>
                    <td>{ix.queue}</td>
                    <td>
                      <span
                        className="st"
                        style={{
                          color: stCol,
                        }}
                      >
                        <span
                          className="d"
                          style={{
                            background: stCol,
                          }}
                        />
                        {ix.state}
                      </span>
                    </td>
                    <td>{fmt(ix.secs)}</td>
                    <td>{ix.media === 'Voice' ? <SentBadge value={ix.sent} /> : '—'}</td>
                    <td
                      style={{
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ix.media === 'Voice' ? (
                        <>
                          <a
                            className="lnk"
                            style={{
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                            onClick={() => monStart(ix.id, 'Listen')}
                          >
                            👂 Listen
                          </a>
                          {' · '}
                          <a
                            className="lnk"
                            style={{
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                            onClick={() => monStart(ix.id, 'Whisper')}
                          >
                            🗣 Whisper
                          </a>
                          {' · '}
                          <a
                            className="lnk"
                            style={{
                              fontSize: 12,
                              color: '#c9401a',
                              cursor: 'pointer',
                            }}
                            onClick={() => monStart(ix.id, 'Barge')}
                          >
                            ⚡ Barge
                          </a>
                        </>
                      ) : (
                        <a
                          className="lnk"
                          style={{
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                          onClick={() => monStart(ix.id, 'Listen')}
                        >
                          👁 View live
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    textAlign: 'center',
                    color: '#8794a8',
                    padding: 20,
                  }}
                >
                  Nothing in progress right now — agents connect within a few seconds as the floor
                  simulation runs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {mon && monitored ? (
        <MonitorDrawer mon={mon} ix={monitored} tick={tick} onMode={monMode} onEnd={monEnd} />
      ) : null}

      {drawerUser && !coachingFor ? (
        <AgentDrawer
          user={drawerUser}
          onClose={() => setAgentDrawer(null)}
          onMonitor={monStart}
          onSetStatus={monSetStatus}
          onLogoff={monLogoff}
          onAssignCoaching={(userId) => setCoachingFor(userId)}
        />
      ) : null}

      {coachingFor ? (
        <AssignCoachingDrawer
          agentId={coachingFor}
          onClose={() => {
            setCoachingFor(null);
            setAgentDrawer(null);
          }}
        />
      ) : null}
    </div>
  );
}
