/**
 * Performance › Dashboards — saved dashboards and their widgets.
 *
 * Ported from the prototype's `renderDashFx` (Engine v13), which replaced the
 * single hard-wired dashboard of Engine v12 with a set of them: create, rename,
 * delete and switch dashboards, each with its own widget list, each openable as
 * its own wallboard. Widget add/remove is `dashAdd` / `dashDel`.
 *
 * The widget values come from the live board metrics. In the prototype those
 * were published on `window.__perfMetrics` by the Queues Activity engine, whose
 * 2-second tick drifted a seeded per-queue / per-agent state; that simulation is
 * reproduced here with the same seeding so the numbers line up with the board.
 */
import { useEffect, useReducer, useState } from 'react';
import { audit, mutate, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
export const WIDGETS = {
  waiting: 'Interactions waiting',
  longest: 'Longest wait',
  sl: 'Service level (today)',
  ans: 'Answered (today)',
  ab: 'Abandon rate',
  aht: 'Avg handle time',
  onq: 'Agents on queue',
  occ: 'Occupancy',
};
const WIDGET_KEYS = Object.keys(WIDGETS);

/* ------------------------------------------------------------- utilities */

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
function fmt(s) {
  const v = Math.round(s || 0);
  return pad(Math.floor(v / 60)) + ':' + pad(v % 60);
}
function dayISO(off = 0) {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/** The prototype's seeded LCG — same seed, same drift, every session. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
function hashN(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

/* ------------------------------------------------------- live board state */

/** Module-level so the board keeps drifting across tab switches, as `PERF` did. */
const live = {
  q: {},
  agents: {},
};
const AGENT_STATES = ['On Queue', 'Available', 'Busy', 'Away', 'Meal'];

/** One 2-second tick of the simulated board. */
function liveTick(db) {
  const now = Date.now();
  db.queues.forEach((q) => {
    let s = live.q[q.id];
    if (!s) {
      s = live.q[q.id] = {
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
      const s = live.agents[u.id];
      if (!s) {
        const h = hashN(u.name);
        live.agents[u.id] = {
          state: AGENT_STATES[h % AGENT_STATES.length] ?? 'Available',
          since: now - ((h % 40) + 5) * 60000,
          drift: rng(h + 13),
        };
      } else if (s.drift() > 0.965) {
        s.state = AGENT_STATES[Math.floor(s.drift() * AGENT_STATES.length)] ?? 'Available';
        s.since = now;
      }
    });
}

/* ------------------------------------------------------ metric computation */

function kpisOf(db) {
  const today = db.interactions.filter((x) => x.d === dayISO(0));
  const slOf = (rows) => {
    const v = rows.filter(
      (x) => x.media !== 'Email' && x.result !== 'Abandoned' && x.waitS != null
    );
    if (!v.length) return null;
    return Math.round((100 * v.filter((x) => x.waitS <= 20).length) / v.length);
  };
  const abOf = (rows) => {
    const v = rows.filter((x) => x.media === 'Voice');
    if (!v.length) return null;
    return Math.round((1000 * v.filter((x) => x.result === 'Abandoned').length) / v.length) / 10;
  };
  const ahtOf = (rows) => {
    const h = rows.filter((x) => x.result !== 'Abandoned' && x.talkS);
    if (!h.length) return null;
    return h.reduce((a, x) => a + x.talkS + (x.acwS || 0) + (x.holdS || 0), 0) / h.length;
  };
  let waiting = 0;
  let longest = 0;
  let interactingTotal = 0;
  Object.keys(live.q).forEach((k) => {
    const s = live.q[k];
    if (!s) return;
    waiting += s.waiting;
    if (s.longest > longest) longest = s.longest;
    interactingTotal += s.interacting;
  });
  const active = db.users.filter((u) => u.state === 'Active');
  let onQ = 0;
  let inter = 0;
  active.forEach((u) => {
    const s = live.agents[u.id];
    if (s && (s.state === 'On Queue' || s.state === 'Interacting')) {
      onQ++;
      if (s.state === 'Interacting') inter++;
    }
  });
  return {
    waiting,
    longest,
    sl: slOf(today),
    ans: today.filter((x) => x.result !== 'Abandoned').length,
    ab: abOf(today),
    aht: ahtOf(today),
    onQ,
    occ: onQ
      ? Math.min(99, Math.round((100 * (inter + interactingTotal)) / Math.max(1, onQ * 1.6)))
      : 0,
  };
}

/** The `wVal` mapping from the prototype's dashboard renderer. */
export function widgetValue(w, k) {
  if (w === 'waiting') return k.waiting;
  if (w === 'longest') return fmt(k.longest);
  if (w === 'sl') return k.sl == null ? '—' : k.sl + '%';
  if (w === 'ans') return k.ans;
  if (w === 'ab') return k.ab == null ? '—' : k.ab + '%';
  if (w === 'aht') return k.aht == null ? '—' : fmt(k.aht);
  if (w === 'onq') return k.onQ;
  if (w === 'occ') return k.occ + '%';
  return '—';
}

/* --------------------------------------------------------------- the tab */

export default function DashboardsTab({ onOpenWallboard }) {
  const db = useDb();
  const { toast } = useUi();
  const [tick, forceTick] = useReducer((n) => n + 1, 0);
  const [index, setIndex] = useReducer((_, next) => next, 0);
  /** The widget currently chosen in the "+ Add widget" picker. */
  const [pending, setPending] = useState('');

  /* the board drifts every two seconds, exactly as the prototype's engine did */
  useEffect(() => {
    liveTick(db);
    forceTick();
    const id = window.setInterval(() => {
      liveTick(db);
      forceTick();
    }, 2000);
    return () => window.clearInterval(id);
  }, [db]);
  const dashboards = db.dashboards ?? [];
  const active = Math.min(index, Math.max(0, dashboards.length - 1));
  const current = dashboards[active];
  const kpis = kpisOf(db);
  void tick; /* re-render trigger for the live values */

  if (!current) {
    return (
      <div className="pbody">
        <div className="panel">
          <h3>Dashboards</h3>
        </div>
      </div>
    );
  }
  const available = WIDGET_KEYS.filter((w) => current.widgets.indexOf(w) < 0);
  /* Fall back to the first option whenever the pending pick is no longer
     offered — it was just added, or the dashboard was switched. */
  const choice = available.includes(pending) ? pending : (available[0] ?? '');
  function dashNew() {
    const n = dashboards.length + 1;
    mutate((d) => {
      d.dashboards.push({
        id: 'id' + Math.random().toString(36).slice(2, 10),
        name: 'Dashboard ' + n,
        widgets: ['waiting', 'sl', 'ans'],
      });
    });
    setIndex(dashboards.length);
    audit('Create dashboard', 'Dashboard ' + n);
    toast('Dashboard created — add widgets and rename it');
  }
  function dashRename() {
    if (!current) return;
    const name = window.prompt('Dashboard name:', current.name);
    if (name && name.trim().length > 1) {
      const trimmed = name.trim();
      mutate((d) => {
        const target = d.dashboards[active];
        if (target) target.name = trimmed;
      });
      audit('Rename dashboard', trimmed);
    }
  }
  function dashDelete() {
    if (!current) return;
    const name = current.name;
    mutate((d) => {
      d.dashboards.splice(active, 1);
    });
    setIndex(0);
    audit('Delete dashboard', name);
    toast('Dashboard deleted');
  }

  /**
   * The wallboard is the Queues Activity engine's full-screen overlay. It always
   * renders `dashboards[0]`, so the prototype's `dashWall()` promoted the
   * selected dashboard to slot 0 before opening it — do the same.
   */
  function dashWall() {
    if (active > 0) {
      mutate((d) => {
        const [moved] = d.dashboards.splice(active, 1);
        if (moved) d.dashboards.unshift(moved);
      });
      setIndex(0);
    }
    onOpenWallboard?.();
  }
  function dashAdd(widget) {
    if (!widget) return;
    mutate((d) => {
      d.dashboards[active]?.widgets.push(widget);
    });
  }
  function dashDel(widget) {
    mutate((d) => {
      const target = d.dashboards[active];
      if (target) target.widgets = target.widgets.filter((x) => x !== widget);
    });
  }
  return (
    <div className="pbody">
      <div
        className="tbar"
        style={{
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {dashboards.map((x, i) => (
          <div
            key={x.id}
            className="chip"
            style={
              i === active
                ? {
                    cursor: 'pointer',
                    background: '#fff4f0',
                    borderColor: '#FF4F1F',
                    color: '#c9401a',
                    fontWeight: 700,
                  }
                : {
                    cursor: 'pointer',
                  }
            }
            onClick={() => setIndex(i)}
          >
            {x.name}
          </div>
        ))}
        <div
          className="chip"
          style={{
            cursor: 'pointer',
          }}
          onClick={dashNew}
        >
          ＋ New dashboard
        </div>
        <div className="sp" />
        <button
          className="btn sec"
          style={{
            fontSize: 12,
          }}
          onClick={dashRename}
        >
          Rename
        </button>
        {dashboards.length > 1 ? (
          <button
            className="btn sec"
            style={{
              fontSize: 12,
              color: '#c9401a',
            }}
            onClick={dashDelete}
          >
            Delete
          </button>
        ) : null}
        <button
          className="btn"
          style={{
            fontSize: 12,
          }}
          onClick={dashWall}
        >
          ▣ Open as wallboard
        </button>
      </div>

      <div className="panel">
        <h3>
          {current.name} <span className="sp" />
          <select
            id="dx_addw"
            style={{
              fontSize: 12,
              padding: '4px 8px',
            }}
            value={choice}
            disabled={!available.length}
            onChange={(event) => setPending(event.target.value)}
          >
            {available.length ? (
              available.map((w) => (
                <option key={w} value={w}>
                  {WIDGETS[w]}
                </option>
              ))
            ) : (
              <option value="">All widgets added</option>
            )}
          </select>{' '}
          <button
            className="btn sec"
            style={{
              fontSize: 12,
            }}
            disabled={!choice}
            onClick={() => {
              dashAdd(choice);
              setPending('');
            }}
          >
            + Add widget
          </button>
        </h3>
        <div
          style={{
            padding: '0 15px 14px',
          }}
        >
          <div
            className="kpis"
            style={{
              marginTop: 10,
            }}
          >
            {current.widgets.map((w) => (
              <div
                className="kpi"
                key={w}
                style={{
                  position: 'relative',
                }}
              >
                <span>{WIDGETS[w]}</span>
                <b>{widgetValue(w, kpis)}</b>
                <div
                  onClick={() => dashDel(w)}
                  title="Remove"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 9,
                    cursor: 'pointer',
                    color: '#a9b3c2',
                    fontSize: 13,
                  }}
                >
                  ×
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
              marginTop: 8,
            }}
          >
            {dashboards.length} dashboard{dashboards.length === 1 ? '' : 's'} — each opens as its
            own full-screen wallboard. Widgets recompute live every 2 seconds.
          </div>
        </div>
      </div>
    </div>
  );
}
