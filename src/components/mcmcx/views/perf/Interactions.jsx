/**
 * Performance › Interactions — interaction search and detail.
 *
 * Ported from the prototype's "Engine v12.1 (Interactions Search & Detail)".
 * Filter by text, media, queue, agent, result, wrap-up and date range across
 * the full 14-day history, export the filtered set to CSV, and click any row
 * for the detail drawer: a segment timeline (IVR → Wait → Talk (+Hold) → ACW),
 * the IVR path that delivered the call, participant data, a simulated
 * recording player and a jump into Quality › Evaluate.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDb } from '@/store/db';
import { useUi } from '@/store/ui';

/**
 * Seeded records carry a few fields the shared `Interaction` interface does not
 * model — they were written straight onto the object by the legacy seeder.
 */

const MEDIA_ICON = {
  Voice: '📞',
  Chat: '💬',
  Email: '✉️',
  Message: '📱',
};
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** "04:12" — the mm:ss format used throughout the performance workspace. */
function fmt(s) {
  const v = Math.round(s || 0);
  return pad(Math.floor(v / 60)) + ':' + pad(v % 60);
}

/** ISO date `off` days ago. */
function dayISO(off = 0) {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function defaultFilters() {
  return {
    q: '',
    media: '',
    queue: '',
    agent: '',
    result: '',
    wrap: '',
    from: dayISO(6),
    to: dayISO(0),
  };
}

/** Quotes a CSV cell only when it needs it, exactly as the original did. */
function csvCell(value) {
  const v = String(value);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/** Builds a Blob and clicks a temporary object-URL link — the legacy download. */
function downloadCsv(lines, filename) {
  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/* ------------------------------------------------------------ timeline bits */

function seg(label, secs, color, extra = '') {
  return {
    label,
    secs: Math.max(0, secs || 0),
    color,
    extra,
  };
}
function segmentsOf(x) {
  const media = x.media || 'Voice';
  const ivrS = media === 'Voice' ? (x.ivr ? 12 : 6) : 0;
  const segs = [];
  if (media === 'Voice') segs.push(seg('IVR', ivrS, '#7b61c9', x.ivr ? x.ivr.flow : ''));
  segs.push(seg('Wait in queue', x.waitS, '#e0a200'));
  if (x.result !== 'Abandoned') {
    segs.push(
      seg(
        media === 'Voice' ? 'Talk' : media === 'Chat' ? 'Chat' : 'Handling',
        (x.talkS || 0) - (x.holdS || 0),
        '#1f9d63'
      )
    );
    if (x.holdS) segs.push(seg('Hold', x.holdS, '#d0342c'));
    if (x.acwS) segs.push(seg('ACW', x.acwS, '#5a6b85'));
  }
  return segs;
}

/* ------------------------------------------------------- recording player */

/**
 * The simulated player from `ixPlay` — the whole call scrubs past in ~40 ticks
 * of 250 ms. Pressing the button again pauses and keeps the position.
 */
function RecordingPlayer({ dur }) {
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    if (!playing) return;
    const step = Math.max(1, Math.round(dur / 40));
    timer.current = window.setInterval(() => {
      setPos((current) => {
        const next = current + step;
        if (next >= dur) {
          setPlaying(false);
          return dur;
        }
        return next;
      });
    }, 250);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, dur]);
  return (
    <>
      <div className="sect">Recording</div>
      <div
        style={{
          background: '#0f1a2e',
          borderRadius: 10,
          padding: '14px 16px',
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
            onClick={() => setPlaying((p) => !p)}
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
              width: 88,
              textAlign: 'right',
            }}
          >
            {fmt(pos)} / {fmt(dur)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 2,
            alignItems: 'flex-end',
            height: 34,
            marginTop: 10,
          }}
        >
          {Array.from(
            {
              length: 60,
            },
            (_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 6 + ((i * 37) % 29),
                  background: '#33507e',
                  borderRadius: 1,
                }}
              />
            )
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#8fa2c4',
            marginTop: 8,
          }}
        >
          Simulated playback — governed by the queue&apos;s recording policy (Admin › Quality ›
          Recording Policies)
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------- detail drawer */

function IxDetailDrawer({ rec, onClose, onEvaluate }) {
  const media = rec.media || 'Voice';
  const segs = segmentsOf(rec);
  const total = segs.reduce((a, s) => a + s.secs, 0) || 1;
  const skills = rec.skills ?? [];
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 640,
        }}
      >
        <div className="dh">
          <h2>
            {MEDIA_ICON[media]} {rec.name} — interaction detail
          </h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div
            className="kpis"
            style={{
              gridTemplateColumns: 'repeat(4,1fr)',
            }}
          >
            <div className="kpi">
              <span>Date · time</span>
              <b
                style={{
                  fontSize: 15,
                }}
              >
                {rec.d || dayISO(0)}
              </b>
              <i>{rec.t}</i>
            </div>
            <div className="kpi">
              <span>Queue</span>
              <b
                style={{
                  fontSize: 15,
                }}
              >
                {rec.queue}
              </b>
              <i>{rec.dir || 'inbound'}</i>
            </div>
            <div className="kpi">
              <span>Agent</span>
              <b
                style={{
                  fontSize: 15,
                }}
              >
                {rec.agent}
              </b>
              <i>{media}</i>
            </div>
            <div className="kpi">
              <span>Result</span>
              <b
                style={{
                  fontSize: 15,
                  color: rec.result === 'Abandoned' ? '#d0342c' : '#1f9d63',
                }}
              >
                {rec.result === 'Abandoned' ? 'Abandoned' : 'Handled'}
              </b>
              <i>{rec.wrap || 'no wrap-up'}</i>
            </div>
          </div>

          <div className="sect">Timeline — total {fmt(total)}</div>
          <div
            style={{
              display: 'flex',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid #dfe5ee',
            }}
          >
            {segs.map((s, i) => (
              <div
                key={i}
                title={s.label + ' ' + fmt(s.secs)}
                style={{
                  width: Math.max(3, Math.round((100 * s.secs) / total)) + '%',
                  background: s.color,
                  height: 26,
                }}
              />
            ))}
          </div>
          <div
            style={{
              marginTop: 8,
            }}
          >
            {segs.map((s, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  marginRight: 14,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: s.color,
                  }}
                />
                {s.label} <b>{fmt(s.secs)}</b>
                {s.extra ? (
                  <span
                    style={{
                      color: '#8794a8',
                    }}
                  >
                    ({s.extra})
                  </span>
                ) : null}
              </span>
            ))}
          </div>

          {rec.ivr ? (
            <>
              <div className="sect">IVR path that delivered this call</div>
              <div
                style={{
                  background: '#f4f0fb',
                  border: '1px solid #ddd0f0',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 12.5,
                }}
              >
                <b>{rec.ivr.flow}</b>
                <br />
                <span
                  style={{
                    color: '#5a4a80',
                  }}
                >
                  {rec.ivr.path}
                </span>
              </div>
            </>
          ) : null}

          {media === 'Voice' && rec.result !== 'Abandoned' ? (
            <RecordingPlayer dur={rec.talkS || 60} />
          ) : null}

          <div className="sect">Remote party</div>
          <table className="dt">
            <tbody>
              <tr>
                <td
                  style={{
                    width: 140,
                    color: '#8794a8',
                  }}
                >
                  Name
                </td>
                <td>
                  <b>{rec.name}</b>
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    color: '#8794a8',
                  }}
                >
                  Address
                </td>
                <td>{rec.ani}</td>
              </tr>
              {skills.length ? (
                <tr>
                  <td
                    style={{
                      color: '#8794a8',
                    }}
                  >
                    Required skills
                  </td>
                  <td>
                    {skills.map((s) => (
                      <span className="tag" key={s}>
                        {s}
                      </span>
                    ))}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Close
          </button>
          {rec.result !== 'Abandoned' ? (
            <button
              className="btn"
              onClick={() => {
                onClose();
                onEvaluate();
              }}
            >
              Evaluate this interaction
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- the tab */

export default function InteractionsTab() {
  const db = useDb();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(defaultFilters);
  const [detail, setDetail] = useState(null);
  const records = db.interactions;

  /* filter option lists, built the way the prototype built its <select>s */
  const queues = db.queues.map((q) => q.name);
  if (queues.indexOf('Email') < 0) queues.push('Email');
  const agents = db.users.filter((u) => u.state === 'Active').map((u) => u.name);
  const wraps = db.wrapup.map((w) => w.name);
  ['Resolved', 'Follow-up required', 'Escalated', 'Transferred'].forEach((w) => {
    if (wraps.indexOf(w) < 0) wraps.push(w);
  });
  const rows = records.filter((x) => {
    const d = x.d || dayISO(0);
    if (filters.from && d < filters.from) return false;
    if (filters.to && d > filters.to) return false;
    if (filters.media && (x.media || 'Voice') !== filters.media) return false;
    if (filters.queue && x.queue !== filters.queue) return false;
    if (filters.agent && x.agent !== filters.agent) return false;
    if (filters.result === 'Abandoned' && x.result !== 'Abandoned') return false;
    if (filters.result === 'Handled' && x.result === 'Abandoned') return false;
    if (filters.wrap && (x.wrap || '') !== filters.wrap) return false;
    if (filters.q) {
      const s = (x.name + ' ' + x.ani + ' ' + x.agent + ' ' + x.queue).toLowerCase();
      if (s.indexOf(filters.q.toLowerCase()) < 0) return false;
    }
    return true;
  });
  const shown = rows.slice(0, 200);
  let totTalk = 0;
  let totWait = 0;
  let ab = 0;
  rows.forEach((x) => {
    totTalk += x.talkS || 0;
    totWait += x.waitS || 0;
    if (x.result === 'Abandoned') ab++;
  });
  function set(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }
  function ixReset() {
    setFilters(defaultFilters());
  }
  function ixCsv() {
    const head = [
      'Date',
      'Time',
      'Customer',
      'Remote',
      'Media',
      'Direction',
      'Queue',
      'Agent',
      'WaitSec',
      'TalkSec',
      'HoldSec',
      'ACWSec',
      'Result',
      'WrapUp',
    ];
    const lines = [head.join(',')].concat(
      rows.map((x) =>
        [
          x.d || dayISO(0),
          x.t,
          x.name,
          x.ani,
          x.media || 'Voice',
          x.dir || 'inbound',
          x.queue,
          x.agent,
          x.waitS || 0,
          x.talkS || 0,
          x.holdS || 0,
          x.acwS || 0,
          x.result || 'Handled',
          x.wrap || '',
        ]
          .map(csvCell)
          .join(',')
      )
    );
    downloadCsv(lines, 'interactions_' + filters.from + '_' + filters.to + '.csv');
    toast(`Exported ${rows.length} interactions to CSV`);
  }

  /**
   * `ixEvaluate` first tried the Quality module's in-page evaluator and
   * otherwise jumped to Admin › Quality › Evaluation Forms. That admin page is
   * its own module here, so the jump is the whole behaviour.
   */
  function ixEvaluate() {
    navigate('/admin/evalforms');
  }
  return (
    <div className="pbody">
      <div
        className="tbar"
        style={{
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <input
          placeholder="Search name, number, agent…"
          value={filters.q}
          style={{
            width: 210,
            fontSize: 12.5,
          }}
          onChange={(e) => set('q', e.target.value)}
        />
        <select
          style={{
            fontSize: 12.5,
          }}
          value={filters.media}
          onChange={(e) => set('media', e.target.value)}
        >
          <option value="">All media</option>
          {['Voice', 'Chat', 'Email', 'Message'].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select
          style={{
            fontSize: 12.5,
            maxWidth: 170,
          }}
          value={filters.queue}
          onChange={(e) => set('queue', e.target.value)}
        >
          <option value="">All</option>
          {queues.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <select
          style={{
            fontSize: 12.5,
            maxWidth: 150,
          }}
          value={filters.agent}
          onChange={(e) => set('agent', e.target.value)}
        >
          <option value="">All</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          style={{
            fontSize: 12.5,
          }}
          value={filters.result}
          onChange={(e) => set('result', e.target.value)}
        >
          <option value="">All results</option>
          <option>Handled</option>
          <option>Abandoned</option>
        </select>
        <select
          style={{
            fontSize: 12.5,
            maxWidth: 150,
          }}
          value={filters.wrap}
          onChange={(e) => set('wrap', e.target.value)}
        >
          <option value="">All</option>
          {wraps.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          style={{
            fontSize: 12,
          }}
          onChange={(e) => set('from', e.target.value)}
        />
        <span
          style={{
            color: '#8794a8',
          }}
        >
          →
        </span>
        <input
          type="date"
          value={filters.to}
          style={{
            fontSize: 12,
          }}
          onChange={(e) => set('to', e.target.value)}
        />
        <div className="sp" />
        <button
          className="btn sec"
          style={{
            fontSize: 12,
          }}
          onClick={ixReset}
        >
          Reset
        </button>
        <button
          className="btn sec"
          style={{
            fontSize: 12,
          }}
          onClick={ixCsv}
        >
          ⭳ Export CSV
        </button>
      </div>

      <div className="panel">
        <h3>
          Interactions{' '}
          <small>
            {rows.length} match{rows.length === 1 ? '' : 'es'}
            {rows.length > 200 ? ' — showing first 200' : ''}
          </small>
          <span className="sp" />
          <small>
            Handled {rows.length - ab} · Abandoned {ab} · Avg wait{' '}
            {rows.length ? fmt(totWait / rows.length) : '—'} · Avg talk{' '}
            {rows.length - ab ? fmt(totTalk / Math.max(1, rows.length - ab)) : '—'}
          </small>
        </h3>
        <table className="dt">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Customer</th>
              <th>Remote</th>
              <th>Media</th>
              <th>Queue</th>
              <th>Agent</th>
              <th>Wait</th>
              <th>Talk</th>
              <th>Result</th>
              <th>Wrap-up</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  style={{
                    textAlign: 'center',
                    color: '#8794a8',
                    padding: 20,
                  }}
                >
                  No interactions match these filters
                </td>
              </tr>
            ) : (
              shown.map((x) => (
                <tr key={x.id} onClick={() => setDetail(x)}>
                  <td>{x.d || dayISO(0)}</td>
                  <td>{x.t}</td>
                  <td>
                    <b className="lnk">{x.name}</b>
                  </td>
                  <td
                    style={{
                      fontSize: 11.5,
                      color: '#5a6b85',
                    }}
                  >
                    {x.ani}
                  </td>
                  <td>
                    {MEDIA_ICON[x.media || 'Voice']} {x.media || 'Voice'}
                  </td>
                  <td>{x.queue}</td>
                  <td>{x.agent}</td>
                  <td>{x.waitS != null ? fmt(x.waitS) : '—'}</td>
                  <td>{x.result === 'Abandoned' ? '—' : x.dur}</td>
                  <td>
                    {x.result === 'Abandoned' ? (
                      <span
                        style={{
                          color: '#d0342c',
                          fontWeight: 700,
                        }}
                      >
                        Abandoned
                      </span>
                    ) : (
                      'Handled'
                    )}
                  </td>
                  <td>{x.wrap || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detail ? (
        <IxDetailDrawer rec={detail} onClose={() => setDetail(null)} onEvaluate={ixEvaluate} />
      ) : null}
    </div>
  );
}
