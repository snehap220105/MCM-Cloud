/**
 * Contact Center › Queues — the ACD queue list and the tabbed queue editor.
 *
 * A queue holds members, a routing method (Standard / Bullseye / Preferred
 * Agent / Conditional Group Routing), an evaluation method that decides which
 * member is eligible, per-channel media settings with SLA targets, wrap-up
 * codes and the voice extras (calling party, whisper, hold music, in-queue
 * flow).
 *
 * Ported from the prototype's `renderQueues` engine plus the "Queue editor v2"
 * depth pack that added screen pop & identity, language routing, preferred
 * agents, conditional group routing and the voice extras. The editor keeps a
 * working copy of the queue (`QED` in the original) and only writes it back to
 * the database on save. The routing simulator is the original ACD eligibility
 * logic, unchanged.
 */
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { audit, divisionName, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { MEDIA_TYPES } from '@/types';

/* ------------------------------------------------------------------ model */

/** Conditional Group Routing rule — carried in the seed but not in `Queue`. */

/**
 * The editor's working copy. Identical to `Queue` plus the conditional group
 * routing rule the depth pack stores on the record.
 */

const EDITOR_TABS = [
  'General',
  'Members',
  'Routing',
  'Media Settings',
  'Wrap-up Codes',
  'Test Routing',
];
const ACW_MODES = ['Optional', 'Mandatory, time-boxed', 'Mandatory, discretionary'];
const MUSIC_OPTIONS = ['MCM Default Hold', 'Calm Strings', 'Upbeat Marimba', 'Silence'];
const ROUTING_METHODS = ['Standard', 'Bullseye', 'Preferred Agent', 'Conditional Group Routing'];
const EVAL_METHODS = ['All Skills Matching', 'Best Available Skills', 'Disregard Skills'];
const ROUTING_HELP = {
  Standard: 'Longest-idle eligible agent receives the interaction.',
  Bullseye:
    'Start with a small preferred pool; each ring expands the pool and can drop skill requirements.',
  'Preferred Agent': "Try the customer's preferred agent(s) first, then fall back to the queue.",
  'Conditional Group Routing':
    'Route to agent groups based on live queue conditions (e.g. estimated wait).',
};

/** Media defaults for a brand-new queue. */
function defaultMedia() {
  return {
    Voice: {
      alert: 12,
      slaPct: 80,
      slaSec: 20,
      auto: false,
    },
    Callback: {
      alert: 30,
      slaPct: 80,
      slaSec: 60,
      auto: false,
    },
    Chat: {
      alert: 24,
      slaPct: 80,
      slaSec: 40,
      auto: false,
    },
    Email: {
      alert: 300,
      slaPct: 90,
      slaSec: 3600,
      auto: false,
    },
    Message: {
      alert: 60,
      slaPct: 80,
      slaSec: 120,
      auto: false,
    },
  };
}

/** Deep-clones an existing queue into a working copy, filling depth-pack gaps. */
function toDraft(queue) {
  if (!queue) {
    return {
      id: '',
      name: '',
      desc: '',
      division: 'd_home',
      members: [],
      routing: 'Standard',
      evalm: 'All Skills Matching',
      rings: [
        {
          timeout: 20,
          drop: [],
        },
      ],
      acw: 'Optional',
      acwSec: 30,
      media: defaultMedia(),
      wrapup: [],
      music: 'MCM Default Hold',
      inqFlow: '',
      whisper: '',
      cpn: '',
      cpname: '',
      script: '',
      lang: '',
      callbacks: true,
      preferred: [],
      cgr: {
        secs: 60,
        target: '',
      },
    };
  }
  const clone = structuredClone(queue);
  clone.inqFlow = clone.inqFlow ?? '';
  clone.whisper = clone.whisper ?? '';
  clone.cpn = clone.cpn ?? '';
  clone.cpname = clone.cpname ?? '';
  clone.script = clone.script ?? '';
  clone.lang = clone.lang ?? '';
  if (clone.callbacks === undefined) clone.callbacks = true;
  if (!clone.preferred) clone.preferred = [];
  if (!clone.cgr)
    clone.cgr = {
      secs: 60,
      target: '',
    };
  return clone;
}

/** `parseInt(x,10)||fallback` — the coercion the original `syncQ` applied. */
function orDefault(value, fallback) {
  return Number.isFinite(value) && value ? value : fallback;
}

/** Reads the selected values out of a `<select multiple>` change event. */
function selectedValues(select) {
  return Array.from(select.selectedOptions).map((o) => o.value);
}

/* -------------------------------------------------- routing simulation (ACD) */

/**
 * The ACD eligibility rule, straight from the prototype: filter by state and
 * language, then apply the queue's evaluation method. "Best Available Skills"
 * additionally orders by summed proficiency.
 */
function eligibleFor(members, reqSkills, lang, evalm, users) {
  const out = [];
  members.forEach((mid) => {
    const u = users.find((x) => x.id === mid);
    if (!u || u.state !== 'Active') return;
    if (lang && u.langs.indexOf(lang) < 0) return;
    const have = u.skills || {};
    const missing = reqSkills.filter((s) => !have[s]);
    const prof = reqSkills.reduce((a, s) => a + (have[s] || 0), 0);
    if (evalm === 'Disregard Skills') {
      out.push({
        u,
        prof,
      });
      return;
    }
    if (evalm === 'All Skills Matching') {
      if (!missing.length)
        out.push({
          u,
          prof,
        });
      return;
    }
    /* Best Available Skills */
    if (!missing.length)
      out.push({
        u,
        prof,
      });
  });
  if (evalm === 'Best Available Skills') out.sort((a, b) => b.prof - a.prof);
  return out;
}
function EligibleRow({ entry, first }) {
  const skills = Object.keys(entry.u.skills || {})
    .map((k) => `${k}:${entry.u.skills[k]}`)
    .join(' ');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 0',
        borderBottom: '1px solid #f2f5f9',
      }}
    >
      {first ? (
        <span
          className="tag"
          style={{
            background: '#e8f7ef',
            color: '#1f9d63',
          }}
        >
          would receive
        </span>
      ) : (
        <span
          style={{
            width: 8,
          }}
        />
      )}
      <b>{entry.u.name}</b>
      <span
        style={{
          color: '#8794a8',
          fontSize: 11,
        }}
      >
        {skills || '—'}
      </span>
      {entry.prof ? <span className="tag o">skill score {entry.prof}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------ queue editor */

function QueueEditorDrawer({ queue, onClose }) {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  const isNew = !queue;
  const [draft, setDraft] = useState(() => toDraft(queue));
  const [tab, setTab] = useState('General');
  const [errors, setErrors] = useState([]);

  /* Members tab — the "add member" picker. */
  const [addMember, setAddMember] = useState('');
  /* Test Routing tab. */
  const [testSkills, setTestSkills] = useState([]);
  const [testLang, setTestLang] = useState('');
  const [simOutput, setSimOutput] = useState(null);

  /** Applies a change to the working copy. */
  function edit(change) {
    setDraft((current) => {
      const next = {
        ...current,
      };
      change(next);
      return next;
    });
  }

  /** Switching tab redraws the body — errors and simulation output clear, as
      they did when the original re-rendered the drawer. */
  function goTab(next) {
    setTab(next);
    setErrors([]);
    setSimOutput(null);
  }
  const candidates = db.users.filter(
    (u) => draft.members.indexOf(u.id) < 0 && u.state === 'Active'
  );
  const addValue = candidates.some((c) => c.id === addMember)
    ? addMember
    : (candidates[0]?.id ?? '');
  const inQueueFlows = (db.flows || []).filter((f) => f.type === 'In-Queue Call');

  /* ------------------------------------------------------------ mutations */

  function addToQueue() {
    if (!addValue) return;
    edit((d) => {
      d.members = [...d.members, addValue];
    });
    setAddMember('');
  }
  function dropMember(id) {
    edit((d) => {
      d.members = d.members.filter((x) => x !== id);
      d.preferred = (d.preferred ?? []).filter((x) => x !== id);
    });
  }
  function addRing() {
    edit((d) => {
      if (d.rings.length < 3)
        d.rings = [
          ...d.rings,
          {
            timeout: 30,
            drop: [],
          },
        ];
    });
  }
  function delRing(index) {
    edit((d) => {
      d.rings = d.rings.filter((_, i) => i !== index);
    });
  }
  function setRing(index, change) {
    edit((d) => {
      d.rings = d.rings.map((r, i) => {
        if (i !== index) return r;
        const copy = {
          ...r,
        };
        change(copy);
        return copy;
      });
    });
  }
  function setMedia(channel, change) {
    edit((d) => {
      const copy = {
        ...d.media[channel],
      };
      change(copy);
      d.media = {
        ...d.media,
        [channel]: copy,
      };
    });
  }
  function toggleWrapup(id, on) {
    edit((d) => {
      const idx = d.wrapup.indexOf(id);
      if (on && idx < 0) d.wrapup = [...d.wrapup, id];
      if (!on && idx > -1) d.wrapup = d.wrapup.filter((x) => x !== id);
    });
  }
  function togglePreferred(id, on) {
    edit((d) => {
      const preferred = d.preferred ?? [];
      if (on && preferred.indexOf(id) < 0) d.preferred = [...preferred, id];
      if (!on) d.preferred = preferred.filter((x) => x !== id);
    });
  }

  /* --------------------------------------------------------------- save */

  function save() {
    const name = draft.name.trim();
    const errs = [];
    if (!name || name.length < 2) errs.push('Queue name is required.');
    if (db.queues.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== draft.id))
      errs.push('A queue with this name already exists.');
    if (!draft.members.length)
      errs.push('Add at least one member — an empty queue can never route.');
    if (draft.routing === 'Bullseye' && !draft.rings.length)
      errs.push('Bullseye routing needs at least one ring.');
    if (errs.length) {
      setTab(errs[0].indexOf('member') > -1 ? 'Members' : 'General');
      setErrors(errs);
      return;
    }

    /* Normalise the numeric fields exactly as the original `syncQ` did. */
    const record = {
      ...draft,
      name,
      desc: draft.desc.trim(),
      acwSec: orDefault(draft.acwSec, 30),
      rings: draft.rings.map((r) => ({
        ...r,
        timeout: orDefault(r.timeout, 20),
      })),
      media: MEDIA_TYPES.reduce((acc, ch) => {
        const m = draft.media[ch];
        acc[ch] = {
          alert: orDefault(m.alert, 10),
          slaPct: Math.min(100, orDefault(m.slaPct, 80)),
          slaSec: orDefault(m.slaSec, 20),
          auto: m.auto,
        };
        return acc;
      }, {}),
      cgr: {
        ...draft.cgr,
        secs: orDefault(draft.cgr.secs, 60),
      },
    };
    mutate((database) => {
      if (isNew) {
        record.id = uid();
        database.queues.unshift(record);
      } else {
        const index = database.queues.findIndex((x) => x.id === record.id);
        if (index > -1) database.queues[index] = record;
      }
    });
    audit(isNew ? 'Create queue' : 'Edit queue', `${name} (${record.routing} / ${record.evalm})`);
    onClose();
    toast((isNew ? 'Queue created — ' : 'Queue saved — ') + name);
  }
  function remove() {
    if (!queue) return;
    confirmBox(
      `Delete queue ${queue.name}? Interactions can no longer be routed to it. Historical reporting is retained.`,
      () => {
        mutate((database) => {
          database.queues = database.queues.filter((x) => x.id !== queue.id);
        });
        audit('Delete queue', queue.name);
        toast('Queue deleted');
      }
    );
    onClose();
  }

  /* --------------------------------------------------------- simulation */

  function simulate() {
    const blocks = [];
    if (draft.routing === 'Bullseye' && draft.rings.length) {
      let dropped = [];
      draft.rings.forEach((ring, i) => {
        dropped = dropped.concat(ring.drop || []);
        const effective = testSkills.filter((s) => dropped.indexOf(s) < 0);
        const list = eligibleFor(draft.members, effective, testLang, draft.evalm, db.users);
        blocks.push(
          <div
            key={`h${i}`}
            style={{
              margin: '10px 0 4px',
            }}
          >
            <b>Ring {i + 1}</b>{' '}
            <span
              style={{
                color: '#8794a8',
                fontSize: 11.5,
              }}
            >
              (after {ring.timeout}s
              {ring.drop && ring.drop.length ? `; skills dropped: ${ring.drop.join(', ')}` : ''}) —
              requires [{effective.join(', ') || 'no skills'}]
            </span>
          </div>
        );
        blocks.push(
          list.length ? (
            <div key={`b${i}`}>
              {list.map((entry, index) => (
                <EligibleRow key={entry.u.id} entry={entry} first={index === 0} />
              ))}
            </div>
          ) : (
            <div
              key={`b${i}`}
              style={{
                color: '#b3261e',
                fontSize: 12,
              }}
            >
              No eligible members in this ring — call keeps waiting
            </div>
          )
        );
      });
    } else {
      const list = eligibleFor(draft.members, testSkills, testLang, draft.evalm, db.users);
      blocks.push(
        <div
          key="h"
          style={{
            margin: '10px 0 4px',
          }}
        >
          <b>Eligible members</b>{' '}
          <span
            style={{
              color: '#8794a8',
              fontSize: 11.5,
            }}
          >
            requires [{testSkills.join(', ') || 'no skills'}]{testLang ? ` + ${testLang}` : ''}{' '}
            under {draft.evalm}
          </span>
        </div>
      );
      blocks.push(
        list.length ? (
          <div key="b">
            {list.map((entry, index) => (
              <EligibleRow key={entry.u.id} entry={entry} first={index === 0} />
            ))}
          </div>
        ) : (
          <div
            key="b"
            style={{
              color: '#b3261e',
              fontSize: 12,
            }}
          >
            No eligible members — the interaction would wait in queue (or overflow via in-queue
            flow)
          </div>
        )
      );
    }
    setSimOutput(<>{blocks}</>);
  }

  /* ------------------------------------------------------------- the tabs */

  const general = (
    <>
      <div className="sect">Queue</div>
      <div className="fld">
        <label>Queue name *</label>
        <input
          value={draft.name}
          onChange={(e) =>
            edit((d) => {
              d.name = e.target.value;
            })
          }
        />
      </div>
      <div className="fld">
        <label>Description</label>
        <input
          value={draft.desc}
          onChange={(e) =>
            edit((d) => {
              d.desc = e.target.value;
            })
          }
        />
      </div>
      <div className="fld">
        <label>Division</label>
        <select
          value={draft.division}
          onChange={(e) =>
            edit((d) => {
              d.division = e.target.value;
            })
          }
        >
          {db.divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sect">After-call work</div>
      <div className="fld">
        <label>ACW mode</label>
        <select
          value={draft.acw}
          onChange={(e) =>
            edit((d) => {
              d.acw = e.target.value;
            })
          }
        >
          {ACW_MODES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div className="fld">
        <label>ACW timeout (seconds)</label>
        <input
          type="number"
          value={draft.acwSec}
          onChange={(e) =>
            edit((d) => {
              d.acwSec = Number(e.target.value);
            })
          }
        />
      </div>

      <div className="sect">Audio</div>
      <div className="fld">
        <label>In-queue / hold music</label>
        <select
          value={draft.music}
          onChange={(e) =>
            edit((d) => {
              d.music = e.target.value;
            })
          }
        >
          {MUSIC_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div className="sect">Screen pop &amp; identity</div>
      <div className="fld">
        <label>Default script (screen pop)</label>
        <select
          value={draft.script ?? ''}
          onChange={(e) =>
            edit((d) => {
              d.script = e.target.value;
            })
          }
        >
          <option value="">None</option>
          {(db.scriptsList || []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.published ? '' : ' (draft)'}
            </option>
          ))}
        </select>
      </div>
      <div className="fld">
        <label>Calling party number (outbound from this queue)</label>
        <input
          value={draft.cpn ?? ''}
          onChange={(e) =>
            edit((d) => {
              d.cpn = e.target.value;
            })
          }
        />
      </div>
      <div className="fld">
        <label>Calling party name</label>
        <input
          value={draft.cpname ?? ''}
          onChange={(e) =>
            edit((d) => {
              d.cpname = e.target.value;
            })
          }
        />
      </div>
      <div className="tgl">
        <input
          type="checkbox"
          checked={!!draft.callbacks}
          style={{
            width: 'auto',
            marginRight: 4,
          }}
          onChange={(e) =>
            edit((d) => {
              d.callbacks = e.target.checked;
            })
          }
        />
        Enable in-queue callbacks (keep place in line)
      </div>
    </>
  );
  const members = (
    <>
      <div className="sect">Members ({draft.members.length})</div>
      {draft.members.length ? (
        draft.members.map((mid) => {
          const u = db.users.find((x) => x.id === mid);
          if (!u) return null;
          const skills =
            Object.keys(u.skills || {})
              .map((k) => `${k} (${u.skills[k]})`)
              .join(', ') || '—';
          return (
            <div
              key={mid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 0',
                borderBottom: '1px solid #f2f5f9',
                fontSize: 12.5,
              }}
            >
              <span
                style={{
                  flex: 1,
                }}
              >
                <b>{u.name}</b>
                <br />
                <span
                  style={{
                    color: '#8794a8',
                    fontSize: 11,
                  }}
                >
                  {skills}
                </span>
              </span>
              <span className="tag o">{u.license}</span>
              <a
                className="lnk"
                style={{
                  fontSize: 11.5,
                  cursor: 'pointer',
                }}
                onClick={() => dropMember(mid)}
              >
                remove
              </a>
            </div>
          );
        })
      ) : (
        <div
          style={{
            color: '#8794a8',
            fontSize: 12,
            padding: '8px 0',
          }}
        >
          No members yet — add agents below
        </div>
      )}

      <div className="sect">Add member</div>
      <div className="fld">
        <label>Agent</label>
        <select value={addValue} onChange={(e) => setAddMember(e.target.value)}>
          {candidates.length ? (
            candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.title || ''}
              </option>
            ))
          ) : (
            <option value="">No more active users</option>
          )}
        </select>
      </div>
      <div className="fld">
        <label>&nbsp;</label>
        <button className="btn sec" onClick={addToQueue}>
          + Add to queue
        </button>
      </div>
    </>
  );
  const routing = (
    <>
      <div className="sect">Routing method</div>
      <div className="fld">
        <label>Method</label>
        <select
          value={draft.routing}
          onChange={(e) =>
            edit((d) => {
              d.routing = e.target.value;
            })
          }
        >
          {ROUTING_METHODS.map((o) => (
            <option key={o} value={o}>
              {o}
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
        {ROUTING_HELP[draft.routing] || ''}
      </div>

      <div className="sect">Evaluation method</div>
      <div className="fld">
        <label>Method</label>
        <select
          value={draft.evalm}
          onChange={(e) =>
            edit((d) => {
              d.evalm = e.target.value;
            })
          }
        >
          {EVAL_METHODS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {draft.routing === 'Bullseye' ? (
        <>
          <div className="sect">Bullseye rings</div>
          {draft.rings.map((ring, i) => (
            <div
              key={i}
              style={{
                border: '1px solid #e4e9f0',
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <b
                  style={{
                    fontSize: 12.5,
                  }}
                >
                  Ring {i + 1}
                </b>
                <div
                  className="sp"
                  style={{
                    flex: 1,
                  }}
                />
                {i > 0 ? (
                  <a
                    className="lnk"
                    style={{
                      fontSize: 11.5,
                      cursor: 'pointer',
                    }}
                    onClick={() => delRing(i)}
                  >
                    remove ring
                  </a>
                ) : null}
              </div>
              <div className="fld">
                <label>Ring timeout (seconds)</label>
                <input
                  type="number"
                  value={ring.timeout}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setRing(i, (r) => {
                      r.timeout = value;
                    });
                  }}
                />
              </div>
              <div className="fld">
                <label>Skills to remove when expanding past this ring</label>
                <select
                  multiple
                  style={{
                    height: 70,
                  }}
                  value={ring.drop}
                  onChange={(e) => {
                    const values = selectedValues(e.target);
                    setRing(i, (r) => {
                      r.drop = values;
                    });
                  }}
                >
                  {db.skills.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {draft.rings.length < 3 ? (
            <button className="btn sec" onClick={addRing}>
              + Add ring
            </button>
          ) : (
            <div
              style={{
                fontSize: 11.5,
                color: '#8794a8',
              }}
            >
              Maximum 3 rings in this prototype
            </div>
          )}
        </>
      ) : null}

      <div className="sect">Language routing</div>
      <div className="fld">
        <label>Required language (interactions must match)</label>
        <select
          value={draft.lang ?? ''}
          onChange={(e) =>
            edit((d) => {
              d.lang = e.target.value;
            })
          }
        >
          <option value="">Any language</option>
          {db.langs.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {draft.routing === 'Preferred Agent' ? (
        <>
          <div className="sect">Preferred agents (tried in order before the queue)</div>
          {db.users
            .filter((u) => draft.members.indexOf(u.id) > -1)
            .map((u) => (
              <label
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '3px 0',
                  fontSize: 12.5,
                }}
              >
                <input
                  type="checkbox"
                  style={{
                    width: 'auto',
                  }}
                  checked={(draft.preferred ?? []).indexOf(u.id) > -1}
                  onChange={(e) => togglePreferred(u.id, e.target.checked)}
                />
                {u.name}
              </label>
            ))}
          {!draft.members.length ? (
            <div
              style={{
                fontSize: 12,
                color: '#8794a8',
              }}
            >
              Add members first — preferred agents come from queue membership.
            </div>
          ) : null}
        </>
      ) : null}

      {draft.routing === 'Conditional Group Routing' ? (
        <>
          <div className="sect">Conditional rule</div>
          <div
            style={{
              fontSize: 12,
              color: '#5b6b82',
              marginBottom: 6,
            }}
          >
            When estimated wait exceeds the threshold, also alert the overflow queue&apos;s agents.
          </div>
          <div className="fld">
            <label>Estimated wait threshold (seconds)</label>
            <input
              type="number"
              value={draft.cgr.secs}
              onChange={(e) => {
                const value = Number(e.target.value);
                edit((d) => {
                  d.cgr = {
                    ...d.cgr,
                    secs: value,
                  };
                });
              }}
            />
          </div>
          <div className="fld">
            <label>Overflow queue</label>
            <select
              value={draft.cgr.target}
              onChange={(e) => {
                const value = e.target.value;
                edit((d) => {
                  d.cgr = {
                    ...d.cgr,
                    target: value,
                  };
                });
              }}
            >
              <option value="">— overflow target —</option>
              {db.queues
                .filter((x) => x.id !== draft.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </div>
        </>
      ) : null}
    </>
  );
  const mediaSettings = (
    <>
      <div className="sect">Per-channel settings</div>
      {MEDIA_TYPES.map((channel) => {
        const m = draft.media[channel];
        return (
          <div
            key={channel}
            style={{
              border: '1px solid #e4e9f0',
              borderRadius: 6,
              padding: '10px 12px',
              marginBottom: 8,
            }}
          >
            <b
              style={{
                fontSize: 12.5,
              }}
            >
              {channel}
            </b>
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 8,
              }}
            >
              <div
                className="fld"
                style={{
                  flex: 1,
                }}
              >
                <label>Alerting timeout (s)</label>
                <input
                  type="number"
                  value={m.alert}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMedia(channel, (x) => {
                      x.alert = value;
                    });
                  }}
                />
              </div>
              <div
                className="fld"
                style={{
                  flex: 1,
                }}
              >
                <label>SLA target %</label>
                <input
                  type="number"
                  value={m.slaPct}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMedia(channel, (x) => {
                      x.slaPct = value;
                    });
                  }}
                />
              </div>
              <div
                className="fld"
                style={{
                  flex: 1,
                }}
              >
                <label>SLA seconds</label>
                <input
                  type="number"
                  value={m.slaSec}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMedia(channel, (x) => {
                      x.slaSec = value;
                    });
                  }}
                />
              </div>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <input
                type="checkbox"
                checked={m.auto}
                style={{
                  width: 'auto',
                }}
                onChange={(e) => {
                  const value = e.target.checked;
                  setMedia(channel, (x) => {
                    x.auto = value;
                  });
                }}
              />
              Auto-answer
            </label>
          </div>
        );
      })}

      <div className="sect">Voice extras</div>
      <div className="fld">
        <label>In-queue flow (what waiting callers hear)</label>
        <select
          value={draft.inqFlow ?? ''}
          onChange={(e) =>
            edit((d) => {
              d.inqFlow = e.target.value;
            })
          }
        >
          <option value="">Default hold experience</option>
          {inQueueFlows.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.status === 'Published' ? '' : ' (draft)'}
            </option>
          ))}
        </select>
      </div>
      <div className="fld">
        <label>Whisper audio (played to the agent before connect)</label>
        <input
          value={draft.whisper ?? ''}
          placeholder="TTS e.g. “Retail billing call”"
          onChange={(e) =>
            edit((d) => {
              d.whisper = e.target.value;
            })
          }
        />
      </div>
    </>
  );
  const wrapupCodes = (
    <>
      <div className="sect">Codes available on this queue</div>
      {db.wrapup.map((w) => (
        <label
          key={w.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 0',
            borderBottom: '1px solid #f2f5f9',
            fontSize: 12.5,
          }}
        >
          <input
            type="checkbox"
            style={{
              width: 'auto',
            }}
            checked={draft.wrapup.indexOf(w.id) > -1}
            onChange={(e) => toggleWrapup(w.id, e.target.checked)}
          />
          <b>{w.name}</b>
          <span
            style={{
              color: '#8794a8',
            }}
          >
            {w.desc || ''}
          </span>
        </label>
      ))}
      <div
        style={{
          fontSize: 11.5,
          color: '#8794a8',
          marginTop: 8,
        }}
      >
        Manage the code list under Contact Center › Wrap-up Codes.
      </div>
    </>
  );
  const testRouting = (
    <>
      <div className="sect">Simulate an incoming interaction</div>
      <div
        style={{
          fontSize: 11.5,
          color: '#5b6b82',
          marginBottom: 10,
          lineHeight: 1.6,
        }}
      >
        Pick the skills/language the flow would attach, then see which members are eligible under{' '}
        <b>{draft.evalm}</b>
        {draft.routing === 'Bullseye' ? ' ring by ring' : ''}.
      </div>
      <div className="fld">
        <label>Required skills</label>
        <select
          multiple
          style={{
            height: 80,
          }}
          value={testSkills}
          onChange={(e) => setTestSkills(selectedValues(e.target))}
        >
          {db.skills.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="fld">
        <label>Language</label>
        <select value={testLang} onChange={(e) => setTestLang(e.target.value)}>
          <option value="">Any</option>
          {db.langs.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="fld">
        <label>&nbsp;</label>
        <button className="btn" onClick={simulate}>
          Run simulation
        </button>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: '#33425c',
        }}
      >
        {simOutput}
      </div>
    </>
  );
  const body = {
    General: general,
    Members: members,
    Routing: routing,
    'Media Settings': mediaSettings,
    'Wrap-up Codes': wrapupCodes,
    'Test Routing': testRouting,
  };
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 600,
        }}
      >
        <div className="dh">
          <h2>{isNew ? 'Create Queue' : `Edit — ${draft.name || 'Queue'}`}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div
          className="tabs"
          style={{
            display: 'flex',
            gap: 2,
            padding: '0 18px',
            borderBottom: '1px solid #e4e9f0',
            background: '#fff',
          }}
        >
          {EDITOR_TABS.map((t) => (
            <div
              key={t}
              className={'tb' + (tab === t ? ' on' : '')}
              style={{
                cursor: 'pointer',
              }}
              onClick={() => goTab(t)}
            >
              {t}
            </div>
          ))}
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
          {body[tab]}
        </div>

        <div className="df">
          {isNew ? null : (
            <button className="btn gh" onClick={remove}>
              Delete queue
            </button>
          )}
          <div
            style={{
              flex: 1,
            }}
          />
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            {isNew ? 'Create queue' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- the page */

export default function QueuesPage() {
  const db = useDb();
  const [filter, setFilter] = useState({
    q: '',
    div: '',
  });
  /** `null` = editor closed; `{ queue: null }` = the create drawer. */
  const [editing, setEditing] = useState(null);
  const [, setRefresh] = useState(0);

  /* Filtered on every render — `db.queues` is mutated in place, so memoising
     on its identity would go stale after a create or delete. */
  const list = db.queues.filter((q) => {
    if (filter.q && `${q.name} ${q.desc}`.toLowerCase().indexOf(filter.q.toLowerCase()) < 0)
      return false;
    if (filter.div && q.division !== filter.div) return false;
    return true;
  });
  return (
    <>
      <PageHeader
        breadcrumb="Admin › Contact Center"
        title="Queues"
        actions={
          <button
            className="btn"
            onClick={() =>
              setEditing({
                queue: null,
              })
            }
          >
            + Create Queue
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `All Queues (${db.queues.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tbar">
          <input
            className="s"
            placeholder="Search queues"
            value={filter.q}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                q: e.target.value,
              }))
            }
          />
          <select
            className="chip"
            style={{
              cursor: 'pointer',
            }}
            value={filter.div}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                div: e.target.value,
              }))
            }
          >
            <option value="">Division: All</option>
            {db.divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="sp" />
          <div className="chip" onClick={() => setRefresh((n) => n + 1)}>
            ↻ Refresh
          </div>
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Queue</th>
                <th>Division</th>
                <th>Members</th>
                <th>Routing</th>
                <th>Evaluation</th>
                <th>SLA %/s</th>
                <th>ACW</th>
                <th
                  style={{
                    width: 40,
                  }}
                ></th>
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                list.map((q) => {
                  const v = q.media.Voice;
                  return (
                    <tr
                      key={q.id}
                      style={{
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        setEditing({
                          queue: q,
                        })
                      }
                    >
                      <td>
                        <b className="lnk">{q.name}</b>
                        <br />
                        <span
                          style={{
                            color: '#8794a8',
                            fontSize: 11,
                          }}
                        >
                          {q.desc || ''}
                        </span>
                      </td>
                      <td>{divisionName(q.division)}</td>
                      <td>{q.members.length}</td>
                      <td>
                        {q.routing}
                        {q.routing === 'Bullseye' ? (
                          <>
                            {' '}
                            <span className="tag o">{q.rings.length} rings</span>
                          </>
                        ) : null}
                      </td>
                      <td>{q.evalm}</td>
                      <td>
                        {v.slaPct}/{v.slaSec}
                      </td>
                      <td>
                        {q.acw}
                        {q.acw !== 'Optional' ? ` · ${q.acwSec}s` : ''}
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
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      textAlign: 'center',
                      color: '#8794a8',
                      padding: 26,
                    }}
                  >
                    No queues match
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="pgr">
            <span>
              Showing <b>{list.length}</b> of <b>{db.queues.length}</b> queues
            </span>
          </div>
        </div>
      </div>

      {editing ? (
        <QueueEditorDrawer queue={editing.queue} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
