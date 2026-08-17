/**
 * Outbound Campaigns — the dialer.
 *
 * Ported from the prototype's "Functional Engine v5 (Outbound)" — the campaign
 * list, the campaign editor drawer, and the campaign monitor with its live
 * dialer simulation.
 *
 * The simulation is the same one the legacy page ran: a 900 ms tick per running
 * campaign that walks the attached contact list, suppresses DNC numbers, and
 * rolls a random dial result. Pacing follows the dialing mode — Preview dials a
 * single line per tick, Progressive one line per available agent, Predictive
 * over-dials by the pacing ratio (and can abandon), Agentless ignores agents
 * altogether. Results are written back onto the contact records, the campaign
 * stats and the campaign log, exactly as before.
 */
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { audit, divisionName, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';

/**
 * A contact row as the dialer actually stores it. The shared `ContactList`
 * type models rows as a flat `Record<string, string>`; the seed data (and the
 * legacy engine) use the richer record below, so we narrow once here instead of
 * sprinkling casts through the page.
 */

/** One line of the live dial log — `Campaign.log` holds these, not strings. */

function contactsOf(list) {
  return list.contacts;
}
function logOf(campaign) {
  if (!Array.isArray(campaign.log)) campaign.log = [];
  return campaign.log;
}
const MODES = ['Preview', 'Progressive', 'Predictive', 'Agentless'];
const SCRIPTS = ['Collections Script v3', 'Renewal Script v1', 'Sales Script v2', '—'];
const EMPTY_STATS = {
  attempted: 0,
  connected: 0,
  noanswer: 0,
  busy: 0,
  machine: 0,
  dncskip: 0,
  abandoned: 0,
};

/** Explains the selected dialing mode under the mode picker. */
function cpModeHint(mode) {
  return (
    {
      Preview:
        'Agent sees the contact record first and launches the dial — lowest risk, lowest pace.',
      Progressive:
        'Dials one line per available agent; the call is only placed when an agent is free.',
      Predictive:
        'Over-dials using the pacing ratio to minimise agent idle time — watch the abandon rate.',
      Agentless: 'Plays a recorded/IVR message with no agents; queue and script are not used.',
    }[mode] || ''
  );
}

/* ---------------------------------------------------------------- helpers */

/** "14:32:07" — the timestamp used on dial log lines. */
function clock() {
  return new Date().toTimeString().slice(0, 8);
}
function campQueueName(db, campaign) {
  return db.queues.find((q) => q.id === campaign.queue)?.name ?? '—';
}
function listOf(db, campaign) {
  return db.contactLists.find((l) => l.id === campaign.list);
}

/** Active members of the campaign's queue; Agentless campaigns use none. */
function agentsAvail(db, campaign) {
  if (campaign.mode === 'Agentless') return 0;
  const queue = db.queues.find((q) => q.id === campaign.queue);
  if (!queue) return 0;
  return queue.members
    .map((m) => db.users.find((u) => u.id === m))
    .filter((u) => u && u.state === 'Active').length;
}
function isDnc(db, campaign, num) {
  const dnc = db.dncLists.find((d) => d.id === campaign.dnc);
  return !!(dnc && dnc.numbers.indexOf(num) > -1);
}
function canDial(campaign, contact) {
  if (contact.status === 'DNC' || contact.status === 'Complete') return false;
  if (contact.attempts >= campaign.maxAttempts) return false;
  if (contact.status === 'Contacted') return false;
  return true;
}

/* ------------------------------------------------------------ status chip */

function StatusField({ status }) {
  if (status === 'On')
    return (
      <span className="st ok">
        <span className="d" />
        Running
      </span>
    );
  if (status === 'Paused')
    return (
      <span className="st wn">
        <span className="d" />
        Paused
      </span>
    );
  if (status === 'Complete')
    return (
      <span className="st ok">
        <span className="d" />
        Complete
      </span>
    );
  return (
    <span
      className="st"
      style={{
        color: '#8a94a6',
      }}
    >
      <span
        className="d"
        style={{
          background: '#8a94a6',
        }}
      />
      Off
    </span>
  );
}

/* --------------------------------------------------------------- the tick */

/**
 * One dialer tick for a campaign. Returns true when the campaign should stop
 * ticking (completed, stopped, or its contact list vanished).
 */
function dialTick(id) {
  let stop = false;
  const audits = [];
  mutate((db) => {
    const c = db.campaigns.find((x) => x.id === id);
    if (!c || c.status !== 'On') {
      stop = true;
      return;
    }
    const list = listOf(db, c);
    if (!list) {
      /* The list was deleted underneath us — stop, exactly as campStop does. */
      stop = true;
      c.status = 'Off';
      audits.push(['Stop campaign', c.name]);
      return;
    }
    const contacts = contactsOf(list);
    const log = logOf(c);
    const agents = agentsAvail(db, c);
    const linesPerTick =
      c.mode === 'Agentless'
        ? Math.max(1, Math.round(c.pace))
        : c.mode === 'Predictive'
          ? Math.max(1, Math.round(agents * c.pace))
          : c.mode === 'Progressive'
            ? Math.max(1, agents)
            : 1; /* Preview = 1 per tick */

    for (let k = 0; k < linesPerTick; k++) {
      const ct = contacts.find((x) => canDial(c, x));
      if (!ct) {
        c.status = 'Complete';
        audits.push(['Campaign complete', c.name]);
        stop = true;
        break;
      }
      const name = (ct.data.FirstName || '') + ' ' + (ct.data.LastName || '');
      const ph = ct.data.Phone || '';

      /* DNC suppression */
      if (isDnc(db, c, ph)) {
        ct.status = 'DNC';
        ct.lastResult = 'DNC suppressed';
        c.stats.dncskip++;
        const dnc = db.dncLists.find((d) => d.id === c.dnc);
        log.unshift({
          t: clock(),
          n: name,
          ph,
          r: 'DNC skip',
          x: 'number on ' + (dnc ? dnc.name : ''),
        });
        continue;
      }
      ct.attempts++;
      c.stats.attempted++;
      const r = Math.random();
      if (r < 0.45) {
        /* live answer */
        if (c.mode === 'Predictive' && Math.random() < Math.min(0.25, (c.pace - 1) * 0.15)) {
          ct.status = ct.attempts >= c.maxAttempts ? 'Complete' : 'Not attempted';
          ct.lastResult = 'Abandoned (no agent free)';
          c.stats.abandoned++;
          log.unshift({
            t: clock(),
            n: name,
            ph,
            r: 'Abandoned',
            x: 'over-dial, no agent free — counts toward abandon rate',
          });
        } else {
          ct.status = 'Contacted';
          ct.lastResult = 'Connected';
          c.stats.connected++;
          log.unshift({
            t: clock(),
            n: name,
            ph,
            r: 'Connected',
            x:
              c.mode === 'Agentless'
                ? 'message played'
                : 'bridged to agent on ' + campQueueName(db, c),
          });
        }
      } else if (r < 0.7) {
        ct.lastResult = 'No answer';
        c.stats.noanswer++;
        if (ct.attempts >= c.maxAttempts) {
          ct.status = 'Complete';
          ct.lastResult += ' (max attempts)';
        }
        log.unshift({
          t: clock(),
          n: name,
          ph,
          r: 'No answer',
          x: 'attempt ' + ct.attempts + '/' + c.maxAttempts,
        });
      } else if (r < 0.82) {
        ct.lastResult = 'Busy';
        c.stats.busy++;
        if (ct.attempts >= c.maxAttempts) ct.status = 'Complete';
        log.unshift({
          t: clock(),
          n: name,
          ph,
          r: 'Busy',
          x: 'attempt ' + ct.attempts + '/' + c.maxAttempts,
        });
      } else {
        ct.lastResult = 'Answering machine';
        c.stats.machine++;
        if (ct.attempts >= c.maxAttempts) ct.status = 'Complete';
        log.unshift({
          t: clock(),
          n: name,
          ph,
          r: 'Machine',
          x: c.mode === 'Agentless' ? 'voicemail drop played' : 'no message left',
        });
      }
    }
    if (log.length > 200) log.length = 200;
  });
  audits.forEach(([act, obj]) => audit(act, obj));
  return stop;
}

/* -------------------------------------------------------- campaign editor */

function CampaignDrawer({ id, onClose, onDeleted }) {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  const existing = id ? db.campaigns.find((c) => c.id === id) : undefined;
  const isNew = !existing;
  const [name, setName] = useState(existing?.name ?? '');
  const [division, setDivision] = useState(existing?.division ?? 'd_col');
  const [mode, setMode] = useState(existing?.mode ?? 'Preview');
  const [queue, setQueue] = useState(existing?.queue ?? db.queues[0]?.id ?? '');
  const [script, setScript] = useState(existing?.script ?? 'Collections Script v3');
  const [list, setList] = useState(existing?.list ?? db.contactLists[0]?.id ?? '');
  const [dnc, setDnc] = useState(existing?.dnc ?? db.dncLists[0]?.id ?? '');
  const [callerId, setCallerId] = useState(existing?.callerId ?? '+442071234100');
  const [callerName, setCallerName] = useState(existing?.callerName ?? 'MCM');
  const [pace, setPace] = useState(String(existing?.pace ?? 1));
  const [maxAttempts, setMaxAttempts] = useState(String(existing?.maxAttempts ?? 3));
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    const errs = [];
    if (trimmed.length < 2) errs.push('Campaign name is required.');
    if (db.campaigns.some((x) => x.name.toLowerCase() === trimmed.toLowerCase() && x.id !== id))
      errs.push('A campaign with this name already exists.');
    if (!list) errs.push('A contact list is required.');
    if (mode !== 'Agentless' && !queue) errs.push(mode + ' campaigns need a queue of agents.');
    const cid = callerId.trim();
    if (!/^\+\d{7,15}$/.test(cid)) errs.push('Caller ID must be E.164 (e.g. +442071234100).');
    const paceValue = parseFloat(pace) || 1;
    if (mode === 'Predictive' && paceValue < 1) errs.push('Predictive pacing must be ≥ 1.0.');
    if (errs.length) {
      setErrors(errs);
      return;
    }
    mutate((database) => {
      let c = id ? database.campaigns.find((x) => x.id === id) : undefined;
      if (!c) {
        c = {
          id: uid(),
          name: '',
          division: '',
          mode: '',
          queue: '',
          script: '',
          list: '',
          dnc: '',
          callerId: '',
          callerName: '',
          pace: 1,
          maxAttempts: 3,
          status: 'Off',
          stats: {
            ...EMPTY_STATS,
          },
          log: [],
        };
        database.campaigns.push(c);
      }
      c.name = trimmed;
      c.division = division;
      c.mode = mode;
      c.queue = queue;
      c.script = script;
      c.list = list;
      c.dnc = dnc;
      c.callerId = cid;
      c.callerName = callerName.trim();
      c.pace = paceValue;
      c.maxAttempts = Math.max(1, parseInt(maxAttempts, 10) || 3);
    });
    audit(isNew ? 'Create campaign' : 'Edit campaign', trimmed + ' (' + mode + ')');
    onClose();
    toast((isNew ? 'Campaign created — ' : 'Campaign saved — ') + trimmed);
  }
  function remove() {
    if (!existing) return;
    const target = existing;
    confirmBox(
      `Delete campaign ${target.name}? Dialing results already written to the contact list are kept.`,
      () => {
        mutate((database) => {
          database.campaigns = database.campaigns.filter((x) => x.id !== target.id);
        });
        audit('Delete campaign', target.name);
        toast('Campaign deleted');
        onDeleted();
      }
    );
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 560,
        }}
      >
        <div className="dh">
          <h2>{isNew ? 'Create Campaign' : 'Edit — ' + (existing?.name ?? '')}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          {errors.length ? (
            <div
              style={{
                background: '#fdecea',
                border: '1px solid #f5c6c0',
                color: '#b3261e',
                borderRadius: 5,
                padding: '8px 11px',
                fontSize: 12.5,
                marginBottom: 10,
              }}
            >
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          ) : null}

          <div className="sect">Campaign</div>
          <div className="fld">
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld">
            <label>Division</label>
            <select value={division} onChange={(e) => setDivision(e.target.value)}>
              {db.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Dialing mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: '#5b6b82',
              margin: '-4px 0 10px',
              lineHeight: 1.6,
            }}
          >
            {cpModeHint(mode)}
          </div>

          <div className="sect">Targets</div>
          <div className="fld">
            <label>Queue (agents who take connected calls)</label>
            <select value={queue} onChange={(e) => setQueue(e.target.value)}>
              <option value="">—</option>
              {db.queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Script</label>
            <select value={script} onChange={(e) => setScript(e.target.value)}>
              {SCRIPTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Contact list *</label>
            <select value={list} onChange={(e) => setList(e.target.value)}>
              {db.contactLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.contacts.length})
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>DNC list</label>
            <select value={dnc} onChange={(e) => setDnc(e.target.value)}>
              <option value="">None</option>
              {db.dncLists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.numbers.length})
                </option>
              ))}
            </select>
          </div>

          <div className="sect">Dialing controls</div>
          <div className="fld">
            <label>Caller ID (E.164) *</label>
            <input value={callerId} onChange={(e) => setCallerId(e.target.value)} />
          </div>
          <div className="fld">
            <label>Caller name</label>
            <input value={callerName} onChange={(e) => setCallerName(e.target.value)} />
          </div>
          <div className="fld">
            <label>Pacing (lines per available agent — Predictive over-dials)</label>
            <input
              type="number"
              step="0.1"
              value={pace}
              onChange={(e) => setPace(e.target.value)}
            />
          </div>
          <div className="fld">
            <label>Max attempts per contact</label>
            <input
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
            />
          </div>

          {isNew ? null : (
            <div
              style={{
                marginTop: 8,
              }}
            >
              <button className="btn gh" onClick={remove}>
                Delete campaign
              </button>
            </div>
          )}
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            {isNew ? 'Create campaign' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- stat cards */

function StatCard({ label, value, sub, warn }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        background: '#fff',
        border: '1px solid #dde3ec',
        borderRadius: 8,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: '#6b7a90',
          textTransform: 'uppercase',
          letterSpacing: '.5px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 21,
          fontWeight: 700,
          color: warn ? '#b3261e' : '#152550',
          margin: '3px 0 1px',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#8794a8',
        }}
      >
        {sub || ''}
      </div>
    </div>
  );
}
function logColour(result) {
  if (result === 'Connected') return '#1f9d63';
  if (result === 'DNC skip') return '#e0a200';
  if (result === 'Abandoned') return '#b3261e';
  return '#5b6b82';
}

/* ----------------------------------------------------------------- page */

export default function CampaignsPage() {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);

  /** Live dialer intervals, keyed by campaign id — the legacy `CAMPTIMERS`. */
  const timers = useRef({});
  function clearTimer(id) {
    const handle = timers.current[id];
    if (handle) {
      window.clearInterval(handle);
      delete timers.current[id];
    }
  }
  function ensureTimer(id) {
    if (timers.current[id]) return;
    timers.current[id] = window.setInterval(() => {
      if (dialTick(id)) clearTimer(id);
    }, 900);
  }

  /* Keep the running timers in step with the campaign statuses. */
  useEffect(() => {
    db.campaigns.forEach((c) => {
      if (c.status === 'On') ensureTimer(c.id);
      else clearTimer(c.id);
    });
  });

  /* Never leave a dialer ticking after the page goes away. */
  useEffect(() => {
    const running = timers.current;
    return () => {
      Object.keys(running).forEach((key) => {
        window.clearInterval(running[key]);
        delete running[key];
      });
    };
  }, []);
  const campaign = selected ? db.campaigns.find((c) => c.id === selected) : undefined;

  /* ------------------------------------------------------- dialer controls */

  function campStart(id) {
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) return;
    const list = listOf(db, c);
    if (!list) {
      toast('Campaign has no contact list');
      return;
    }
    if (c.mode !== 'Agentless' && !agentsAvail(db, c)) {
      toast(`No active agents in queue ${campQueueName(db, c)} — activate members first`);
      return;
    }
    mutate((database) => {
      const target = database.campaigns.find((x) => x.id === id);
      if (target) target.status = 'On';
    });
    audit('Start campaign', c.name);
    toast(`Campaign ${c.name} started (${c.mode})`);
    clearTimer(id);
    ensureTimer(id);
    setSelected(id);
  }
  function campPause(id) {
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) return;
    mutate((database) => {
      const target = database.campaigns.find((x) => x.id === id);
      if (target) target.status = 'Paused';
    });
    clearTimer(id);
    audit('Pause campaign', c.name);
    setSelected(id);
  }
  function campStop(id, silent) {
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) return;
    clearTimer(id);
    if (c.status !== 'Off') {
      mutate((database) => {
        const target = database.campaigns.find((x) => x.id === id);
        if (target) target.status = 'Off';
      });
      audit('Stop campaign', c.name);
    }
    if (!silent) setSelected(id);
  }
  function campReset(id) {
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) return;
    confirmBox(
      `Reset all dialing results for ${c.name}? Contact statuses and stats go back to Not attempted.`,
      () => {
        campStop(id, true);
        mutate((database) => {
          const target = database.campaigns.find((x) => x.id === id);
          if (!target) return;
          target.stats = {
            ...EMPTY_STATS,
          };
          target.log = [];
          const list = listOf(database, target);
          if (list)
            contactsOf(list).forEach((ct) => {
              if (ct.status !== 'DNC') {
                ct.status = 'Not attempted';
                ct.attempts = 0;
                ct.lastResult = '';
              }
            });
        });
        audit('Reset campaign', c.name);
        toast('Campaign results reset');
        setSelected(id);
      }
    );
  }

  /* ------------------------------------------------------------ detail view */

  if (campaign) {
    const c = campaign;
    const list = listOf(db, c);
    const s = c.stats;
    const remaining = list ? contactsOf(list).filter((x) => canDial(c, x)).length : 0;
    const agents = agentsAvail(db, c);
    const conn = s.attempted ? Math.round((s.connected / s.attempted) * 100) : 0;
    const abn =
      s.connected + s.abandoned ? Math.round((s.abandoned / (s.connected + s.abandoned)) * 100) : 0;
    const log = logOf(c).slice(0, 40);
    return (
      <>
        <PageHeader
          breadcrumb={
            <>
              Admin ›{' '}
              <a
                style={{
                  cursor: 'pointer',
                }}
                onClick={() => setSelected(null)}
              >
                Outbound
              </a>{' '}
              › Campaigns
            </>
          }
          title={
            <>
              {c.name} &nbsp;
              <StatusField status={c.status} />
            </>
          }
          actions={
            <>
              {c.status === 'On' ? (
                <>
                  <button className="btn sec" onClick={() => campPause(c.id)}>
                    Pause
                  </button>
                  <button className="btn gh" onClick={() => campStop(c.id)}>
                    Stop
                  </button>
                </>
              ) : (
                <>
                  <button className="btn" onClick={() => campStart(c.id)}>
                    {c.status === 'Paused' ? 'Resume' : 'Start campaign'}
                  </button>
                  {c.status !== 'Off' ? (
                    <button className="btn gh" onClick={() => campStop(c.id)}>
                      Stop
                    </button>
                  ) : null}
                </>
              )}
              <button
                className="btn sec"
                onClick={() =>
                  setEditing({
                    id: c.id,
                  })
                }
              >
                Settings
              </button>
              <button className="btn sec" onClick={() => campReset(c.id)}>
                Reset results
              </button>
            </>
          }
          tabs={[
            {
              id: 'monitor',
              label: `${c.mode} · ${campQueueName(db, c)} · list: ${list ? list.name : '—'} · CLI ${c.callerId}`,
            },
          ]}
          activeTab="monitor"
        />

        <div className="pbody">
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <StatCard label="Remaining" value={remaining} sub="contacts dialable" />
            <StatCard label="Attempted" value={s.attempted} sub="total dials" />
            <StatCard label="Connected" value={s.connected} sub={`${conn}% connect rate`} />
            <StatCard label="No answer" value={s.noanswer} />
            <StatCard label="Busy" value={s.busy} />
            <StatCard label="Machine" value={s.machine} sub="answering machine" />
            <StatCard label="DNC skips" value={s.dncskip} sub="suppressed" warn={s.dncskip > 0} />
            {c.mode === 'Predictive' ? (
              <StatCard
                label="Abandoned"
                value={s.abandoned}
                sub={`${abn}% abandon rate`}
                warn={abn > 3}
              />
            ) : null}
            <StatCard
              label="Agents"
              value={agents}
              sub={c.mode === 'Agentless' ? 'not used' : 'available in queue'}
            />
          </div>

          <h1
            style={{
              fontSize: 15,
              margin: '4px 0 6px',
            }}
          >
            Live dial log
          </h1>
          <div
            className="tblw"
            id="camp_log"
            style={{
              background: '#fff',
              border: '1px solid #dde3ec',
              borderRadius: 8,
              padding: '6px 14px',
              maxHeight: 340,
              overflow: 'auto',
            }}
          >
            {log.length ? (
              log.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '5px 0',
                    borderBottom: '1px solid #f2f5f9',
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      color: '#8794a8',
                      width: 64,
                    }}
                  >
                    {e.t}
                  </span>
                  <span
                    style={{
                      width: 150,
                    }}
                  >
                    <b>{e.n}</b>
                  </span>
                  <span
                    style={{
                      width: 130,
                    }}
                  >
                    {e.ph}
                  </span>
                  <span
                    style={{
                      color: logColour(e.r),
                      fontWeight: 600,
                      width: 100,
                    }}
                  >
                    {e.r}
                  </span>
                  <span
                    style={{
                      color: '#8794a8',
                    }}
                  >
                    {e.x || ''}
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  color: '#8794a8',
                  fontSize: 12,
                  padding: '10px 0',
                }}
              >
                No dial attempts yet — start the campaign.
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <CampaignDrawer
            id={editing.id}
            onClose={() => setEditing(null)}
            onDeleted={() => {
              setEditing(null);
              setSelected(null);
            }}
          />
        ) : null}
      </>
    );
  }

  /* -------------------------------------------------------------- list view */

  return (
    <>
      <PageHeader
        breadcrumb="Admin › Outbound"
        title="Campaigns"
        actions={
          <button
            className="btn"
            onClick={() =>
              setEditing({
                id: null,
              })
            }
          >
            + Create Campaign
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `All Campaigns (${db.campaigns.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Mode</th>
                <th>Queue</th>
                <th>Contact list</th>
                <th>Attempted</th>
                <th>Connected</th>
                <th>Status</th>
                <th
                  style={{
                    width: 40,
                  }}
                ></th>
              </tr>
            </thead>
            <tbody>
              {db.campaigns.map((c) => {
                const list = listOf(db, c);
                const remaining = list
                  ? contactsOf(list).filter(
                      (x) => x.status === 'Not attempted' && x.attempts < c.maxAttempts
                    ).length
                  : 0;
                return (
                  <tr key={c.id} onClick={() => setSelected(c.id)}>
                    <td>
                      <b className="lnk">{c.name}</b>
                      <br />
                      <span
                        style={{
                          color: '#8794a8',
                          fontSize: 11,
                        }}
                      >
                        {divisionName(c.division)}
                      </span>
                    </td>
                    <td>
                      <span className={'tag' + (c.mode === 'Predictive' ? ' o' : '')}>
                        {c.mode}
                      </span>
                    </td>
                    <td>{campQueueName(db, c)}</td>
                    <td>
                      {list ? (
                        <>
                          {list.name}{' '}
                          <span
                            style={{
                              color: '#8794a8',
                              fontSize: 11,
                            }}
                          >
                            ({remaining} left)
                          </span>
                        </>
                      ) : (
                        <span
                          style={{
                            color: '#b3261e',
                          }}
                        >
                          missing
                        </span>
                      )}
                    </td>
                    <td>{c.stats.attempted}</td>
                    <td>{c.stats.connected}</td>
                    <td>
                      <StatusField status={c.status} />
                    </td>
                    <td
                      style={{
                        color: '#a9b3c2',
                      }}
                    >
                      ⋮
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <CampaignDrawer
          id={editing.id}
          onClose={() => setEditing(null)}
          onDeleted={() => {
            setEditing(null);
            setSelected(null);
          }}
        />
      ) : null}
    </>
  );
}
