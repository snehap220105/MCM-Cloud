/**
 * Performance › Queues Activity.
 *
 * The live queue board: the eight header KPIs, then one row per real queue with
 * its waiting / longest / interacting counts drifting on the 2-second tick and
 * its handled / service level / ASA / abandon figures derived from today's
 * interaction records. Clicking a row drills into the queue (`perfQDrill`).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { KpiHeader, dayISO, fmt, fmtL, mediaOf, qStats, recsOn, slStyle, useLive } from './_live';
import { clearFilters, filteredQueues, isFiltered, useFilters } from './_filters';

/* ------------------------------------------------------------- drill-in */

/**
 * The queue drill-in drawer.
 *
 * Rendered inline rather than through `openDrawer` so that it keeps recomputing
 * on every live tick, as the prototype's re-render loop did.
 */
function QueueDrillDrawer({ queue, onClose }) {
  const db = useDb();
  const live = useLive();
  const navigate = useNavigate();
  const s = live.q[queue.id] ?? {
    waiting: 0,
    longest: 0,
    interacting: 0,
  };
  const st = qStats(queue);
  const recs = recsOn(dayISO(0))
    .filter((x) => x.queue === queue.name)
    .slice(0, 8);
  const members = queue.members
    .map((id) => db.users.find((u) => u.id === id))
    .filter((u) => Boolean(u));
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
          <h2>{queue.name} — live</h2>
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
              <span>Waiting</span>
              <b>{s.waiting}</b>
            </div>
            <div className="kpi">
              <span>Longest</span>
              <b>{fmtL(s.longest)}</b>
            </div>
            <div className="kpi">
              <span>SL today</span>
              <b>{st.sl == null ? '—' : st.sl + '%'}</b>
            </div>
            <div className="kpi">
              <span>Handled</span>
              <b>{st.handled}</b>
            </div>
          </div>

          <div className="sect">Members ({queue.members.length})</div>
          <table className="dt">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{live.agents[u.id]?.state ?? 'Available'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sect">Today&rsquo;s interactions</div>
          <table className="dt">
            <thead>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Agent</th>
                <th>Dur</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {recs.length ? (
                recs.map((i) => (
                  <tr key={i.id}>
                    <td>{i.t}</td>
                    <td>{i.name}</td>
                    <td>{i.agent}</td>
                    <td>{i.dur}</td>
                    <td>
                      {i.result === 'Abandoned' ? (
                        <span
                          style={{
                            color: '#d0342c',
                          }}
                        >
                          Abandoned
                        </span>
                      ) : (
                        'Handled'
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'center',
                      color: '#8794a8',
                    }}
                  >
                    No interactions yet today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Close
          </button>
          <button
            className="btn"
            onClick={() => {
              onClose();
              navigate('/admin/queues');
            }}
          >
            Open queue config
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- the tab */

export default function QueuesActivityTab() {
  const db = useDb();
  const live = useLive();
  const { closeDrawer } = useUi();
  const [drillId, setDrillId] = useState(null);
  /* The same set the header KPIs are counting, so the two always agree. */
  useFilters();
  const queues = filteredQueues(db);
  const drill = (db.queues ?? []).find((q) => q.id === drillId) ?? null;
  function openDrill(id) {
    /* the prototype closed any open drawer before building its own */
    closeDrawer();
    setDrillId(id);
  }
  return (
    <div className="pbody">
      <KpiHeader />

      <div className="panel">
        <h3>
          Queues — live activity
          <span className="sp" />
          <small>SLA target: 80% in 20s · click a queue to drill in</small>
        </h3>
        <table className="dt">
          <thead>
            <tr>
              <th>Queue</th>
              <th>Media</th>
              <th>Waiting</th>
              <th>Longest</th>
              <th>Members</th>
              <th>Interacting</th>
              <th>Handled today</th>
              <th>SL today</th>
              <th>ASA</th>
              <th>Abandon</th>
            </tr>
          </thead>
          <tbody>
            {queues.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: '#8794a8', padding: 26 }}>
                  No queues match the current filters
                  {isFiltered() ? (
                    <>
                      {' — '}
                      <span
                        className="lnk"
                        style={{ cursor: 'pointer' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          clearFilters();
                        }}
                      >
                        clear them
                      </span>
                    </>
                  ) : null}
                </td>
              </tr>
            ) : null}
            {queues.map((q) => {
              const s = live.q[q.id] ?? {
                waiting: 0,
                longest: 0,
                interacting: 0,
              };
              const st = qStats(q);
              const breaching = s.longest > 120;
              return (
                <tr key={q.id} onClick={() => openDrill(q.id)}>
                  <td>
                    <b className="lnk">{q.name}</b>
                  </td>
                  <td>{mediaOf(q.name)}</td>
                  <td>{s.waiting ? <b>{s.waiting}</b> : '0'}</td>
                  <td>
                    {s.longest ? (
                      breaching ? (
                        <b
                          style={{
                            color: '#d0342c',
                          }}
                        >
                          {fmtL(s.longest)}
                        </b>
                      ) : (
                        fmtL(s.longest)
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{q.members.length}</td>
                  <td>{s.interacting}</td>
                  <td>{st.handled}</td>
                  <td style={slStyle(st.sl)}>{st.sl == null ? '—' : st.sl + '%'}</td>
                  <td>{st.asa == null ? '—' : fmt(st.asa)}</td>
                  <td>{st.ab == null ? '—' : st.ab + '%'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {drill ? <QueueDrillDrawer queue={drill} onClose={() => setDrillId(null)} /> : null}
    </div>
  );
}
