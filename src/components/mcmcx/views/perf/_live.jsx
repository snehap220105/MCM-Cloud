/**
 * The live Performance board — shared engine for the Performance tabs.
 *
 * Ported from the prototype's "Engine v12 (Live Performance Workspace)". That
 * script kept a module-level `window.PERF` object holding a small amount of
 * simulated live state per queue and per agent, drifted it on a 2-second
 * `setInterval`, and re-rendered the whole Performance body on every tick.
 *
 * The simulation is kept verbatim — same seeded RNG, same drift thresholds, same
 * clamps — so the board behaves exactly as it did. What changed is the plumbing:
 * the tick publishes through `useSyncExternalStore`, the interval only runs while
 * a Performance tab is mounted, and the signed-in agent's row is mirrored from
 * the session presence rather than from the old `window.AGT` global.
 *
 * The historic metrics are *derived*, never generated: the prototype's
 * `ensureAll()` / `seedHistory()` pass already ran, and its 14 days of records
 * were captured into `db.interactions`.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { db, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import {
  availableMedia,
  clearFilters,
  filteredQueues,
  isFiltered,
  setFilter,
  useFilters,
} from './_filters';
/* ------------------------------------------------------------- formatting */

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** "04:12" — minutes:seconds. */
export function fmt(seconds) {
  const s = Math.round(seconds);
  return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
}

/** Like `fmt`, but rolls over to "1h 20m" past the hour. */
export function fmtL(seconds) {
  const s = Math.round(seconds);
  return s >= 3600 ? Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm' : fmt(s);
}
function isoOf(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

/**
 * The day the board treats as "today".
 *
 * The prototype generated its history relative to the wall clock, so "today"
 * was always the real date. The captured seed is fixed in time, so we anchor on
 * the real date when it has records and otherwise fall back to the most recent
 * day present — without it every "today" metric would read zero.
 */
function anchorISO() {
  const today = isoOf(new Date());
  const recs = db.interactions ?? [];
  let latest = '';
  for (const r of recs) {
    if (r.d === today) return today;
    if (r.d && r.d > latest) latest = r.d;
  }
  return latest || today;
}

/** `dayISO(0)` is today, `dayISO(1)` yesterday — as in the prototype. */
export function dayISO(offset = 0) {
  const parts = anchorISO().split('-');
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setDate(date.getDate() - offset);
  return isoOf(date);
}

/* --------------------------------------------------------- seeded randomness */

/** The prototype's linear congruential generator — deterministic per seed. */
function rng(seed) {
  let s = seed;
  return function next() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
function hashN(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

/* -------------------------------------------------------------- board state */

const P = {
  q: {},
  agents: {},
};
const AGENT_STATES = ['On Queue', 'Available', 'Busy', 'Away', 'Meal'];

/**
 * The shared floor — the prototype's `PERF` global.
 *
 * Queues Activity, Agents and Live Interactions all read this one object, as
 * they did in the original: `liveIxTick()` there spawned and ended conversations
 * off `PERF.agents[u.id].state`, so an agent shown as Interacting on the live
 * board also read Interacting on the Agents tab. Exported so the live-interaction
 * engine can share it instead of simulating a second, contradictory floor.
 */
export function floor() {
  return P;
}

/** Seed an agent's floor entry if the perf tick has not reached them yet. */
export function ensureAgent(user, now = Date.now()) {
  let s = P.agents[user.id];
  if (!s) {
    const h = hashN(user.name);
    s = P.agents[user.id] = {
      state: AGENT_STATES[h % AGENT_STATES.length],
      since: now - ((h % 40) + 5) * 60000,
      drift: rng(h + 13),
    };
  }
  return s;
}

/** The signed-in agent, mirrored from the session so their row reads true. */
let sessionEmail = null;
let sessionState = 'Available';
let mirroredUserId = null;
function applySession(now) {
  const user = sessionEmail ? db.users.find((u) => u.email === sessionEmail) : undefined;
  if (mirroredUserId && mirroredUserId !== user?.id) {
    const previous = P.agents[mirroredUserId];
    if (previous) delete previous.real;
    mirroredUserId = null;
  }
  if (!user) return;
  let s = P.agents[user.id];
  if (!s) {
    s = P.agents[user.id] = {
      state: sessionState,
      since: now,
      drift: rng(1),
    };
  }
  if (s.state !== sessionState) {
    s.state = sessionState;
    s.since = now;
  }
  s.real = true;
  mirroredUserId = user.id;
}

/** One 2-second step of the simulation — the prototype's `liveTick()`. */
function tick() {
  const now = Date.now();
  (db.queues ?? []).forEach((q) => {
    let s = P.q[q.id];
    if (!s) {
      s = P.q[q.id] = {
        waiting: hashN(q.name) % 4,
        longest: 0,
        interacting: Math.min(q.members.length, 1 + (hashN(q.name) % 3)),
        drift: rng(hashN(q.name) + 7),
      };
    }
    const r = s.drift;
    const dW = r();
    s.waiting += dW < 0.3 ? -1 : dW > 0.72 ? 1 : 0;
    if (s.waiting < 0) s.waiting = 0;
    if (s.waiting > 9) s.waiting = 9;
    s.longest = s.waiting > 0 ? s.longest + 2 : 0;
    const dI = r();
    s.interacting += dI < 0.3 ? -1 : dI > 0.7 ? 1 : 0;
    const cap = Math.max(1, q.members.length);
    if (s.interacting < 0) s.interacting = 0;
    if (s.interacting > cap) s.interacting = cap;
  });
  db.users
    .filter((u) => u.state === 'Active')
    .forEach((u) => {
      const s = P.agents[u.id];
      if (!s) {
        const h = hashN(u.name);
        P.agents[u.id] = {
          state: AGENT_STATES[h % AGENT_STATES.length],
          since: now - ((h % 40) + 5) * 60000,
          drift: rng(h + 13),
        };
      } else if (s.drift() > 0.965) {
        s.state = AGENT_STATES[Math.floor(s.drift() * AGENT_STATES.length)];
        s.since = now;
      }
    });
  applySession(now);
}

/* --------------------------------------------------- publishing to React */

const listeners = new Set();
let version = 0;
let timer = null;
function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}
function getVersion() {
  return version;
}
function subscribe(listener) {
  listeners.add(listener);
  if (timer === null) {
    timer = window.setInterval(() => {
      tick();
      emit();
    }, 2000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

/* The prototype's interval started with the page, so the board was already
   drifting by the time anyone opened Performance. Prime it the same way. */
tick();

/**
 * Subscribe a component to the live board, and keep the signed-in agent's row
 * in step with their workspace presence.
 */
export function useLive() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const { user, presence } = useUi();
  useEffect(() => {
    if (user.email === sessionEmail && presence === sessionState) return;
    sessionEmail = user.email;
    sessionState = presence;
    applySession(Date.now());
    emit();
  }, [user.email, presence]);
  return P;
}

/* ------------------------------------------------------------ metrics */

export function recsOn(dISO) {
  return (db.interactions ?? []).filter((x) => x.d === dISO);
}

/** The media type a queue carries, inferred from its name as the engine did. */
export function mediaOf(queueName) {
  if (/chat/i.test(queueName)) return 'Chat';
  if (/email/i.test(queueName)) return 'Email';
  if (/messag|sms|whats/i.test(queueName)) return 'Message';
  return 'Voice';
}
function slOf(rs) {
  const v = rs.filter((x) => x.media !== 'Email' && x.result !== 'Abandoned' && x.waitS != null);
  if (!v.length) return null;
  return Math.round((100 * v.filter((x) => x.waitS <= 20).length) / v.length);
}
function abOf(rs) {
  const v = rs.filter((x) => x.media === 'Voice');
  if (!v.length) return null;
  return Math.round((1000 * v.filter((x) => x.result === 'Abandoned').length) / v.length) / 10;
}
function ahtOf(rs) {
  const h = rs.filter((x) => x.result !== 'Abandoned' && x.talkS);
  if (!h.length) return null;
  return h.reduce((a, x) => a + x.talkS + (x.acwS || 0) + (x.holdS || 0), 0) / h.length;
}

/** The header KPIs — today against yesterday, plus the live board totals. */
export function kpis(scope) {
  /* `scope` narrows every figure to one set of queues, so the header always
     describes the same queues the table below is showing. Omit it for the org. */
  const ids = scope ? new Set(scope.map((q) => q.id)) : null;
  const names = scope ? new Set(scope.map((q) => q.name)) : null;
  const inScope = (rs) => (names ? rs.filter((x) => names.has(x.queue)) : rs);

  const t = inScope(recsOn(dayISO(0)));
  const y = inScope(recsOn(dayISO(1)));
  let waiting = 0;
  let longest = 0;
  Object.keys(P.q).forEach((k) => {
    if (ids && !ids.has(k)) return;
    const s = P.q[k];
    waiting += s.waiting;
    if (s.longest > longest) longest = s.longest;
  });
  const act = db.users.filter((u) => u.state === 'Active');
  let onQ = 0;
  let inter = 0;
  act.forEach((u) => {
    const s = P.agents[u.id];
    if (s && (s.state === 'On Queue' || s.state === 'Interacting')) {
      onQ++;
      if (s.state === 'Interacting') inter++;
    }
  });
  const busy = Object.keys(P.q).reduce(
    (a, k) => (ids && !ids.has(k) ? a : a + P.q[k].interacting),
    0
  );
  return {
    waiting,
    longest,
    sl: slOf(t),
    slY: slOf(y),
    ans: t.filter((x) => x.result !== 'Abandoned').length,
    ansY: y.filter((x) => x.result !== 'Abandoned').length,
    ab: abOf(t),
    abY: abOf(y),
    aht: ahtOf(t),
    ahtY: ahtOf(y),
    onQ,
    logged: act.length,
    occ: onQ ? Math.min(99, Math.round((100 * (inter + busy)) / Math.max(1, onQ * 1.6))) : 0,
  };
}
/** Today's handled / service level / ASA / abandon rate for one queue. */
export function qStats(queue) {
  const t = recsOn(dayISO(0)).filter((x) => x.queue === queue.name);
  const ans = t.filter((x) => x.result !== 'Abandoned');
  let sl = null;
  let asa = null;
  let ab = null;
  const v = t.filter((x) => x.media !== 'Email');
  if (v.length) {
    sl = Math.round(
      (100 * v.filter((x) => x.waitS <= 20 && x.result !== 'Abandoned').length) / v.length
    );
  }
  if (ans.length) asa = ans.reduce((a, x) => a + (x.waitS || 0), 0) / ans.length;
  const vv = t.filter((x) => x.media === 'Voice');
  if (vv.length) {
    ab = Math.round((1000 * vv.filter((x) => x.result === 'Abandoned').length) / vv.length) / 10;
  }
  return {
    handled: ans.length,
    sl,
    asa,
    ab,
  };
}
/** Today's handled count and AHT for one agent, by display name. */
export function agStats(name) {
  const t = recsOn(dayISO(0)).filter((x) => x.agent === name && x.result !== 'Abandoned');
  const aht = t.length
    ? t.reduce((a, x) => a + (x.talkS || 0) + (x.acwS || 0) + (x.holdS || 0), 0) / t.length
    : null;
  return {
    handled: t.length,
    aht,
  };
}

/* -------------------------------------------------------- shared chrome */

/** Service-level colour thresholds: green at 80, amber at 60, red below. */
export function slStyle(sl) {
  if (sl == null) return undefined;
  return {
    color: sl >= 80 ? '#1f9d63' : sl >= 60 ? '#e0a200' : '#d0342c',
    fontWeight: 700,
  };
}
/** "▲ 4% vs yesterday", coloured by whether the movement is the good one. */
function Trend({ cur, prev, goodUp, format }) {
  if (cur == null || prev == null) return null;
  const up = cur > prev;
  const same = cur === prev;
  const good = same ? null : up === goodUp;
  const delta = Math.abs(cur - prev);
  return (
    <i className={good === null ? '' : good ? 'up' : 'dn'}>
      {same ? '—' : up ? '▲' : '▼'}{' '}
      {format ? format(delta) : Math.abs(Math.round((cur - prev) * 10) / 10)} vs yesterday
    </i>
  );
}

/**
 * The filter bar and eight KPI tiles that head every Performance tab.
 * Recomputed on each live tick, exactly like the prototype's `kpiHeader()`.
 */
/**
 * A header filter chip with a dropdown.
 *
 * `options` is a list of [value, label] pairs; "All" is always offered first and
 * is represented by the empty string.
 */
function FilterChip({ label, value, options, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);
  const current = options.find(([v]) => v === value)?.[1] ?? 'All';
  const all = [['', 'All'], ...options];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        className="chip"
        style={{ cursor: 'pointer', ...(value ? { borderColor: '#FF4F1F', color: '#c9401a' } : null) }}
        onClick={() => setOpen((v) => !v)}
      >
        {label}: {current} ▾
      </div>
      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 35,
            left: 0,
            minWidth: 170,
            background: '#fff',
            border: '1px solid #ccd4e0',
            borderRadius: 6,
            boxShadow: '0 10px 34px rgba(16,30,60,.22)',
            zIndex: 60,
            overflow: 'hidden',
          }}
        >
          {all.map(([v, text]) => (
            <div
              key={v || '__all'}
              onClick={() => {
                onPick(v);
                setOpen(false);
              }}
              style={{
                padding: '9px 14px',
                fontSize: 12.5,
                cursor: 'pointer',
                color: v === value ? '#c9401a' : '#3c4a5c',
                fontWeight: v === value ? 700 : 400,
                background: v === value ? '#fff4f0' : '#fff',
              }}
            >
              {text}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function KpiHeader() {
  const database = useDb();
  useLive();
  const filters = useFilters();
  const scope = filteredQueues(database);
  const k = kpis(scope);
  return (
    <>
      <div className="tbar">
        <div className="chip">Today · 00:00 – now ▾</div>
        <FilterChip
          label="Division"
          value={filters.division}
          options={(database.divisions ?? []).map((d) => [d.id, d.name])}
          onPick={(v) => setFilter('division', v)}
        />
        <FilterChip
          label="Media"
          value={filters.media}
          options={availableMedia(database).map((m) => [m, m])}
          onPick={(v) => setFilter('media', v)}
        />
        {isFiltered() ? (
          <div className="chip" style={{ cursor: 'pointer' }} onClick={clearFilters}>
            ✕ Clear
          </div>
        ) : null}
        <div className="sp" />
        <div
          className="chip"
          id="pf_live"
          style={{
            color: '#1f9d63',
          }}
        >
          ● Live — updates every 2s
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span>Waiting</span>
          <b>{k.waiting}</b>
          <i>
            across {scope.length} queue{scope.length === 1 ? '' : 's'}
          </i>
        </div>
        <div className="kpi">
          <span>Longest wait</span>
          <b>{fmtL(k.longest)}</b>
          <i>
            {k.longest > 120 ? (
              <span
                style={{
                  color: '#d0342c',
                }}
              >
                breaching
              </span>
            ) : (
              'within target'
            )}
          </i>
        </div>
        <div className="kpi">
          <span>Service level</span>
          <b style={slStyle(k.sl)}>{k.sl == null ? '—' : k.sl + '%'}</b>
          <Trend cur={k.sl} prev={k.slY} goodUp format={(v) => Math.round(v) + '%'} />
        </div>
        <div className="kpi">
          <span>Answered</span>
          <b>{k.ans}</b>
          <Trend cur={k.ans} prev={k.ansY} goodUp />
        </div>
        <div className="kpi">
          <span>Abandon rate</span>
          <b>{k.ab == null ? '—' : k.ab + '%'}</b>
          <Trend
            cur={k.ab}
            prev={k.abY}
            goodUp={false}
            format={(v) => Math.round(v * 10) / 10 + '%'}
          />
        </div>
        <div className="kpi">
          <span>Avg handle time</span>
          <b>{k.aht == null ? '—' : fmt(k.aht)}</b>
          <Trend cur={k.aht} prev={k.ahtY} goodUp={false} format={(v) => fmt(v)} />
        </div>
        <div className="kpi">
          <span>On queue agents</span>
          <b>{k.onQ}</b>
          <i>of {k.logged} active</i>
        </div>
        <div className="kpi">
          <span>Occupancy</span>
          <b>{k.occ}%</b>
          <i>target 75–85%</i>
        </div>
      </div>
    </>
  );
}
