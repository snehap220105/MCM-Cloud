/**
 * MCM Architect — the visual flow editor.
 *
 * Ported from the prototype's `archOpen` / `drawAED` engine. The editor is three
 * columns: a toolbox of actions on the left, the canvas in the middle, and a
 * properties panel for the selected action on the right, wrapped in the dark
 * Architect chrome with Validate / Test Call / Publish.
 *
 * The canvas draws each action as a `.node` card positioned absolutely and the
 * connections between them as a real `<svg>` overlay — the same geometry the
 * legacy `drawAED()` produced, only as JSX instead of a concatenated string.
 *
 * The page is reachable on its own as `admin/architect`; `?flow=<id>` selects
 * which flow to open, and without it the first flow opens (as `openPage`
 * did with `archOpen(DB.flows[0].id)`).
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
/** The Architect action palette, in the order the toolbox lists it. */
export const NTYPES = {
  start: {
    c: 'g',
    lbl: 'Start',
  },
  play: {
    c: 'p',
    lbl: 'Play Audio',
  },
  menu: {
    c: 'y',
    lbl: 'Menu',
  },
  decision: {
    c: 'y',
    lbl: 'Decision',
  },
  schedule: {
    c: 'b',
    lbl: 'Evaluate Schedule',
  },
  data: {
    c: 'b',
    lbl: 'Call Data Action',
  },
  acd: {
    c: '',
    lbl: 'Transfer to ACD',
  },
  user: {
    c: '',
    lbl: 'Transfer to User',
  },
  vm: {
    c: '',
    lbl: 'Transfer to Voicemail',
  },
  disc: {
    c: 'r',
    lbl: 'Disconnect',
  },
};

/**
 * The seed data carries `ver` as a number while the shared `Flow` type declares
 * a string, so read it through here rather than assuming either shape.
 */
export function versionOf(flow) {
  const raw = flow.ver;
  return typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10) || 0;
}

/** Mirrors the prototype's `aedProblems()` — the publish gate. */
export function aedProblems(flow) {
  const errs = [];
  const start = flow.nodes.filter((n) => n.type === 'start')[0];
  if (!start) errs.push('Flow has no Start action.');
  flow.nodes.forEach((n) => {
    if (
      n.type !== 'disc' &&
      n.type !== 'acd' &&
      n.type !== 'user' &&
      n.type !== 'vm' &&
      !flow.links.some((l) => l[0] === n.id)
    ) {
      errs.push('"' + n.t + '" has no outgoing connection.');
    }
    if (n.type !== 'start' && !flow.links.some((l) => l[1] === n.id)) {
      errs.push('"' + n.t + '" is unreachable (no incoming connection).');
    }
    if (n.type === 'acd' && !(flow.meta.queueFor || {})[n.id]) {
      errs.push('"' + n.t + '" has no queue selected.');
    }
  });
  return errs;
}

/* ------------------------------------------------------------- the canvas */

/** `maxX` / `maxY` exactly as `drawAED()` measured them. */
function measure(flow) {
  let maxX = 0;
  let maxY = 0;
  flow.nodes.forEach((n) => {
    maxX = Math.max(maxX, n.x + 230);
    maxY = Math.max(maxY, n.y + 130);
  });
  return {
    width: maxX,
    height: maxY,
  };
}
/**
 * Connection geometry: a link that travels far enough to the right leaves the
 * source's right edge and enters the target's left edge; everything else drops
 * out of the bottom into the top.
 */
function linkGeometry(a, b, label) {
  const right = b.x > a.x + 150;
  const ax = right ? a.x + 210 : a.x + 105;
  const ay = right ? a.y + 46 : a.y + 92;
  const bx = right ? b.x : b.x + 105;
  const by = right ? b.y + 46 : b.y;
  const c1x = ax + 40;
  const c1y = ay + (right ? 0 : 30);
  const c2x = bx - (right ? 40 : 0);
  const c2y = by - (right ? 0 : 30);
  return {
    d: `M${ax} ${ay} C${c1x} ${c1y} ${c2x} ${c2y} ${bx} ${by}`,
    label,
    lx: (ax + bx) / 2,
    ly: (ay + by) / 2 - 4,
  };
}
function Canvas({ flow, selected, onSelect }) {
  const { width, height } = measure(flow);
  const edges = [];
  flow.links.forEach((l) => {
    const a = flow.nodes.filter((n) => n.id === l[0])[0];
    const b = flow.nodes.filter((n) => n.id === l[1])[0];
    if (!a || !b) return;
    edges.push(linkGeometry(a, b, l[2]));
  });
  return (
    <div className="canvas">
      <div
        style={{
          position: 'relative',
          width: width + 60,
          height: height + 80,
        }}
      >
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: width + 60,
            height: height + 60,
            pointerEvents: 'none',
          }}
        >
          <defs>
            <marker id="ar2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="#9fb0c8" />
            </marker>
          </defs>
          {edges.map((edge, index) => (
            <path
              key={index}
              d={edge.d}
              stroke="#9fb0c8"
              strokeWidth="1.6"
              fill="none"
              markerEnd="url(#ar2)"
            />
          ))}
          {edges.map((edge, index) =>
            edge.label ? (
              <text
                key={index}
                x={edge.lx}
                y={edge.ly}
                fontSize="10"
                fill="#c9401a"
                textAnchor="middle"
              >
                {edge.label}
              </text>
            ) : null
          )}
        </svg>

        {flow.nodes.map((n) => (
          <div
            key={n.id}
            className={'node' + (selected === n.id ? ' sel' : '')}
            style={{
              left: n.x,
              top: n.y,
            }}
            onClick={() => onSelect(n.id)}
          >
            <div className="nh">
              <span className={'dot ' + (NTYPES[n.type]?.c ?? '')} />
              {n.t}
            </div>
            <div className="nb">{n.b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- connect panel */

/**
 * "Connect this action to…" — its own component so that the target and label
 * inputs reset whenever the selection changes (the legacy editor rebuilt the
 * panel from scratch on every redraw).
 */
function ConnectPanel({ flow, selectedId }) {
  const { toast } = useUi();
  const others = flow.nodes.filter((n) => n.id !== selectedId);
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const [label, setLabel] = useState('');
  function connect() {
    const to = target;
    const lbl = label.trim();
    if (flow.links.some((l) => l[0] === selectedId && l[1] === to && l[2] === lbl)) {
      toast('That connection already exists');
      return;
    }
    mutate((db) => {
      const f = db.flows.find((x) => x.id === flow.id);
      if (!f) return;
      f.links.push([selectedId, to, lbl]);
      f.status = 'Draft';
    });
  }
  return (
    <div className="pf">
      <label>Connect this action to…</label>
      <div
        style={{
          display: 'flex',
          gap: 6,
        }}
      >
        <select
          style={{
            flex: 1,
          }}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {others.map((n) => (
            <option key={n.id} value={n.id}>
              {n.t}
            </option>
          ))}
        </select>
        <input
          placeholder="label"
          style={{
            width: 70,
          }}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <button
        className="btn sec"
        style={{
          marginTop: 6,
          height: 28,
        }}
        onClick={connect}
      >
        + Add connection
      </button>
    </div>
  );
}

/* ------------------------------------------------------- properties panel */

function Properties({ flow, selected, onDeleted }) {
  const db = useDb();
  const { toast } = useUi();
  if (!selected)
    return (
      <div className="props">
        <div className="ph">Properties</div>
      </div>
    );
  const sel = selected;

  /** `aedProp()` — live-edit the action's name and notes. */
  function setField(field, value) {
    mutate((database) => {
      const f = database.flows.find((x) => x.id === flow.id);
      const n = f?.nodes.filter((x) => x.id === sel.id)[0];
      if (!n) return;
      n[field] = value;
    });
  }
  function setQueue(queueId) {
    mutate((database) => {
      const f = database.flows.find((x) => x.id === flow.id);
      if (!f) return;
      f.meta.queueFor = f.meta.queueFor || {};
      f.meta.queueFor[sel.id] = queueId;
    });
  }
  function setSkills(names) {
    mutate((database) => {
      const f = database.flows.find((x) => x.id === flow.id);
      if (!f) return;
      f.meta.skills = f.meta.skills || {};
      f.meta.skills[sel.id] = names;
    });
  }
  function setSchedule(groupId) {
    mutate((database) => {
      const f = database.flows.find((x) => x.id === flow.id);
      if (!f) return;
      f.sched = groupId;
    });
  }
  function unlink(index) {
    mutate((database) => {
      const f = database.flows.find((x) => x.id === flow.id);
      if (!f) return;
      f.links.splice(index, 1);
      f.status = 'Draft';
    });
  }

  /** `aedDel()` — remove the action and every connection touching it. */
  function remove() {
    let nextId = null;
    mutate((database) => {
      const f = database.flows.find((x) => x.id === flow.id);
      if (!f) return;
      f.nodes = f.nodes.filter((n) => n.id !== sel.id);
      f.links = f.links.filter((l) => l[0] !== sel.id && l[1] !== sel.id);
      f.status = 'Draft';
      nextId = f.nodes[0] ? f.nodes[0].id : null;
    });
    onDeleted(nextId);
    toast('Action deleted');
  }
  const skillsSelected = (flow.meta.skills || {})[sel.id] || [];
  const outgoing = flow.links
    .map((l, i) => ({
      l,
      i,
    }))
    .filter((x) => x.l[0] === sel.id);
  return (
    <div className="props">
      <div className="ph">{sel.t}</div>

      <div className="pf">
        <label>Name</label>
        <input value={sel.t} onChange={(e) => setField('t', e.target.value)} />
      </div>
      <div className="pf">
        <label>Details / notes</label>
        <input value={sel.b} onChange={(e) => setField('b', e.target.value)} />
      </div>

      {sel.type === 'acd' ? (
        <>
          <div className="pf">
            <label>Queue</label>
            {/* Uncontrolled + keyed, so an unset queue shows the first option
                exactly as the legacy `selected`-attribute markup did. */}
            <select
              key={sel.id}
              defaultValue={(flow.meta.queueFor || {})[sel.id] ?? ''}
              onChange={(e) => setQueue(e.target.value)}
            >
              {db.queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>
          <div className="pf">
            <label>Required skills</label>
            <select
              key={sel.id + '_sk'}
              multiple
              style={{
                height: 64,
              }}
              defaultValue={skillsSelected}
              onChange={(e) => setSkills(Array.from(e.target.selectedOptions, (o) => o.value))}
            >
              {db.skills.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {sel.type === 'schedule' ? (
        <div className="pf">
          <label>Schedule group</label>
          <select value={flow.sched} onChange={(e) => setSchedule(e.target.value)}>
            <option value="">—</option>
            {db.schedGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <ConnectPanel key={sel.id} flow={flow} selectedId={sel.id} />

      {outgoing.length ? (
        <div className="pf">
          <label>Outgoing connections</label>
          {outgoing.map((x) => {
            const tgt = flow.nodes.filter((n) => n.id === x.l[1])[0];
            return (
              <div
                key={x.i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  padding: '3px 0',
                  borderBottom: '1px solid #f2f5f9',
                }}
              >
                <span>
                  {x.l[2] ? (
                    <>
                      <span className="tag o">{x.l[2]}</span>{' '}
                    </>
                  ) : null}
                  → {tgt ? tgt.t : '?'}
                </span>
                <a
                  className="lnk"
                  style={{
                    fontSize: 11,
                  }}
                  onClick={() => unlink(x.i)}
                >
                  remove
                </a>
              </div>
            );
          })}
        </div>
      ) : null}

      {sel.type !== 'start' ? (
        <div className="pf">
          <button className="btn gh" onClick={remove}>
            Delete action
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- call-path test */

function TestCallDrawer({ flow, onClose }) {
  const db = useDb();
  const [sched, setSched] = useState('Open');
  const [digit, setDigit] = useState('1');
  const [log, setLog] = useState(null);
  const [looped, setLooped] = useState(false);
  function nextNode(link) {
    if (!link) return null;
    return flow.nodes.filter((n) => n.id === link[1])[0] || null;
  }

  /** `runTestCall()` — walks the flow with the chosen conditions. */
  function run() {
    let cur = flow.nodes.filter((n) => n.type === 'start')[0] ?? null;
    const steps = [];
    let hops = 0;
    let ended = false;
    while (cur && hops < 25 && !ended) {
      hops++;
      const node = cur;
      const outs = flow.links.filter((l) => l[0] === node.id);
      if (node.type === 'schedule') {
        const pick =
          outs.filter((l) => (l[2] || '').toLowerCase() === sched.toLowerCase())[0] || outs[0];
        const group = db.schedGroups.filter((g) => g.id === flow.sched)[0];
        steps.push({
          n: node,
          x: 'schedule is ' + sched + (flow.sched ? ' (' + String(group?.name) + ')' : ''),
        });
        cur = nextNode(pick);
        continue;
      }
      if (node.type === 'menu') {
        const pick = outs.filter((l) => l[2] === digit)[0] || outs[0];
        steps.push({
          n: node,
          x:
            'caller pressed ' +
            digit +
            (pick && pick[2] !== digit ? ' — no branch for ' + digit + ', taking first' : ''),
        });
        cur = nextNode(pick);
        continue;
      }
      if (node.type === 'acd') {
        const qid = (flow.meta.queueFor || {})[node.id];
        const q = db.queues.filter((x) => x.id === qid)[0];
        const sk = (flow.meta.skills || {})[node.id] || [];
        let elig = 0;
        if (q) {
          q.members.forEach((m) => {
            const u = db.users.filter((x) => x.id === m)[0];
            if (u && u.state === 'Active' && sk.every((s) => (u.skills || {})[s])) elig++;
          });
        }
        steps.push({
          n: node,
          x: q
            ? 'queued on ' +
              q.name +
              (sk.length ? ' requiring [' + sk.join(', ') + ']' : '') +
              ' — ' +
              elig +
              ' eligible agent(s)' +
              (elig ? '' : ' ⚠ call will wait')
            : '⚠ no queue configured',
        });
        ended = true;
        continue;
      }
      if (node.type === 'disc' || node.type === 'vm' || node.type === 'user') {
        steps.push({
          n: node,
          x: 'call ends here',
        });
        ended = true;
        continue;
      }
      steps.push({
        n: node,
        x: '',
      });
      cur = nextNode(outs[0]);
      if (!cur) ended = true;
    }
    setLooped(hops >= 25);
    setLog(steps);
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
          <h2>Test Call — {flow.name}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div
            style={{
              fontSize: 12,
              color: '#5b6b82',
              marginBottom: 10,
              lineHeight: 1.6,
            }}
          >
            Walks a simulated call through the flow. Choose the conditions; at each Menu the chosen
            digit decides the branch.
          </div>

          <div className="fld">
            <label>Schedule state</label>
            <select value={sched} onChange={(e) => setSched(e.target.value)}>
              <option>Open</option>
              <option>Closed</option>
            </select>
          </div>

          <div className="fld">
            <label>Menu digit pressed</label>
            <select value={digit} onChange={(e) => setDigit(e.target.value)}>
              <option>1</option>
              <option>2</option>
              <option>0</option>
            </select>
          </div>

          <div className="fld">
            <label>&nbsp;</label>
            <button className="btn" onClick={run}>
              Run test call
            </button>
          </div>

          <div
            style={{
              fontSize: 12.5,
              color: '#33425c',
            }}
          >
            {log ? (
              <>
                <div
                  style={{
                    marginTop: 6,
                  }}
                >
                  {log.map((e, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 9,
                        padding: '6px 0',
                        borderBottom: '1px solid #f2f5f9',
                      }}
                    >
                      <span
                        style={{
                          color: '#8794a8',
                          width: 20,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        style={{
                          width: 170,
                        }}
                      >
                        <b>{e.n.t}</b>
                        <br />
                        <span
                          style={{
                            color: '#8794a8',
                            fontSize: 11,
                          }}
                        >
                          {NTYPES[e.n.type]?.lbl ?? e.n.type}
                        </span>
                      </span>
                      <span
                        style={{
                          flex: 1,
                          color: '#5b6b82',
                        }}
                      >
                        {e.x || e.n.b || ''}
                      </span>
                    </div>
                  ))}
                </div>
                {looped ? (
                  <div
                    style={{
                      color: '#b3261e',
                      fontSize: 12,
                      marginTop: 6,
                    }}
                  >
                    ⚠ Stopped after 25 hops — possible loop.
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
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

/* ---------------------------------------------------------------- editor */

function FlowEditor({ flow }) {
  const navigate = useNavigate();
  const { toast, openDrawer, closeDrawer } = useUi();
  const [selectedId, setSelectedId] = useState(flow.nodes[0]?.id ?? null);
  const [testing, setTesting] = useState(false);
  const selected = flow.nodes.filter((n) => n.id === selectedId)[0];

  /** `aedAdd()` — drop a new action on the canvas and select it. */
  function addAction(type) {
    const spec = NTYPES[type];
    if (!spec) return;
    let maxY = 0;
    flow.nodes.forEach((n) => {
      maxY = Math.max(maxY, n.y);
    });
    const node = {
      id: uid(),
      type,
      t: spec.lbl,
      b: 'configure me',
      x: 300,
      y: maxY + 110 > 560 ? 80 + Math.floor(Math.random() * 300) : maxY + 110,
    };
    mutate((db) => {
      const f = db.flows.find((x) => x.id === flow.id);
      if (!f) return;
      f.nodes.push(node);
      f.status = 'Draft';
    });
    setSelectedId(node.id);
    toast(spec.lbl + ' added — set its properties and connections');
  }
  function showProblems(errs) {
    openDrawer({
      title: `Validation — ${errs.length} problem(s)`,
      body: (
        <>
          {errs.map((e, i) => (
            <div
              key={i}
              style={{
                fontSize: 12.5,
                color: '#b3261e',
                padding: '4px 0',
                borderBottom: '1px solid #f2f5f9',
              }}
            >
              ✗ {e}
            </div>
          ))}
        </>
      ),
      footer: (
        <button className="btn sec" onClick={closeDrawer}>
          Close
        </button>
      ),
    });
  }
  function validate() {
    const errs = aedProblems(flow);
    if (!errs.length) {
      toast('✓ Flow validated — 0 errors');
      return;
    }
    showProblems(errs);
  }
  function publish() {
    const errs = aedProblems(flow);
    if (errs.length) {
      toast('Cannot publish — fix ' + errs.length + ' validation problem(s) first');
      showProblems(errs);
      return;
    }
    const next = versionOf(flow) + 1;
    mutate((db) => {
      const f = db.flows.find((x) => x.id === flow.id);
      if (!f) return;
      f.ver = String(next);
      f.status = 'Published';
    });
    audit('Publish flow', flow.name + ' v' + next);
    toast(flow.name + ' published as v' + next);
  }
  return (
    <>
      <div className="arch">
        <div className="archbar">
          <span className="ttl">MCM Architect</span>
          <span className="crumb">
            › {flow.type} ›{' '}
            <b
              style={{
                color: '#fff',
              }}
            >
              {flow.name}
            </b>{' '}
            &nbsp;
            {flow.status === 'Published' ? 'v' + flow.ver + ' published' : 'draft'}
          </span>
          <span className="sp" />
          <button className="abtn" onClick={validate}>
            Validate
          </button>
          <button className="abtn" onClick={() => setTesting(true)}>
            Test Call
          </button>
          <button className="abtn pri" onClick={publish}>
            Publish
          </button>
          <button className="abtn" onClick={() => navigate('/admin/flows')}>
            Close
          </button>
        </div>

        <div className="archmain">
          <div className="tbox">
            <div className="th">Toolbox</div>
            <div className="tcat">
              Add action<span>▾</span>
            </div>
            {Object.keys(NTYPES)
              .filter((k) => k !== 'start')
              .map((k) => (
                <div key={k} className="titem" onClick={() => addAction(k)}>
                  <span className={'ic ' + (NTYPES[k]?.c ?? '')} />
                  {NTYPES[k]?.lbl}
                </div>
              ))}
          </div>

          <Canvas flow={flow} selected={selectedId} onSelect={setSelectedId} />

          <Properties flow={flow} selected={selected} onDeleted={setSelectedId} />
        </div>

        <div className="archfoot">
          <span>{flow.nodes.length} actions</span>
          <span>{flow.links.length} connections</span>
          <span>{flow.status === 'Published' ? 'Published v' + flow.ver : 'Draft — not live'}</span>
          <span>Checked out by Faisal Khan</span>
        </div>
      </div>

      {testing ? <TestCallDrawer flow={flow} onClose={() => setTesting(false)} /> : null}
    </>
  );
}

/* ------------------------------------------------------------- the page */

export default function ArchitectPage() {
  const db = useDb();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requested = params.get('flow');
  const flow = (requested ? db.flows.find((f) => f.id === requested) : undefined) ?? db.flows[0];
  if (!flow) {
    return (
      <div className="pbody">
        <div
          style={{
            fontSize: 12.5,
            color: '#5b6b82',
          }}
        >
          No flows yet —{' '}
          <a className="lnk" onClick={() => navigate('/admin/flows')}>
            create one in Architect Flows
          </a>
          .
        </div>
      </div>
    );
  }
  return <FlowEditor key={flow.id} flow={flow} />;
}
