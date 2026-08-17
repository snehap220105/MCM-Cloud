/**
 * Performance › Flows.
 *
 * Outcome per Architect flow for today. A flow's traffic is attributed through
 * the queues its Transfer-to-ACD nodes point at (`meta.queueFor`), so "Entries"
 * counts today's records landing in any of those queues and "Abandoned in
 * queue" the ones the caller gave up on.
 *
 * Selecting a flow opens its live activity in a drawer, mirroring the drill-in
 * the prototype gave queues (`perfQDrill`): live KPIs, the queues the flow feeds
 * with their current waiting / SL, and today's interactions that came through
 * it. The Architect editor is one button away in the drawer footer, which is
 * where the prototype's `archOpen()` went.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDb } from '@/store/db';
import { KpiHeader, dayISO, fmtL, qStats, recsOn, slStyle, useLive } from './_live';

/** The queues a flow's Transfer-to-ACD nodes point at. */
function queuesOf(db, flow) {
  const queueFor = flow.meta?.queueFor ?? {};
  return Object.keys(queueFor)
    .map((nodeId) => queueFor[nodeId])
    .filter(Boolean)
    .map((id) => (db.queues ?? []).find((q) => q.id === id))
    .filter(Boolean);
}

function FlowStatus({ flow }) {
  return flow.status === 'Published' ? (
    <span className="st ok">
      <span className="d" />v{flow.ver}
    </span>
  ) : (
    <span className="st wn">
      <span className="d" />
      Draft
    </span>
  );
}

/* ------------------------------------------------------- live drill-in */

function FlowLiveDrawer({ flow, onClose }) {
  const db = useDb();
  const live = useLive();
  const navigate = useNavigate();

  const queues = queuesOf(db, flow);
  const names = queues.map((q) => q.name);
  const today = recsOn(dayISO(0)).filter((x) => names.indexOf(x.queue) > -1);
  const abandoned = today.filter((x) => x.result === 'Abandoned').length;

  const waiting = queues.reduce((total, q) => total + (live.q[q.id]?.waiting ?? 0), 0);
  const longest = queues.reduce((max, q) => Math.max(max, live.q[q.id]?.longest ?? 0), 0);
  const handled = queues.reduce((total, q) => total + qStats(q).handled, 0);
  const sls = queues.map((q) => qStats(q).sl).filter((sl) => sl != null);
  const sl = sls.length ? Math.round(sls.reduce((a, b) => a + b, 0) / sls.length) : null;

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw" style={{ width: 560 }}>
        <div className="dh">
          <h2>{flow.name} — live</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div className="tbar" style={{ marginBottom: 12 }}>
            <span className="tag">{flow.type}</span>
            <FlowStatus flow={flow} />
            <div className="sp" />
            <span style={{ fontSize: 11.5, color: '#1f9d63' }}>● Live — updates every 2s</span>
          </div>

          <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="kpi">
              <span>Entries today</span>
              <b>{today.length}</b>
            </div>
            <div className="kpi">
              <span>In queue now</span>
              <b>{waiting}</b>
            </div>
            <div className="kpi">
              <span>Longest</span>
              <b>{longest ? fmtL(longest) : '—'}</b>
            </div>
            <div className="kpi">
              <span>Abandoned</span>
              <b style={abandoned ? { color: '#d0342c' } : undefined}>{abandoned}</b>
            </div>
          </div>

          <div className="sect">Routes to queues ({queues.length})</div>
          <table className="dt">
            <thead>
              <tr>
                <th>Queue</th>
                <th>Waiting</th>
                <th>Longest</th>
                <th>SL today</th>
                <th>Handled</th>
              </tr>
            </thead>
            <tbody>
              {queues.length ? (
                queues.map((q) => {
                  const s = live.q[q.id] ?? { waiting: 0, longest: 0 };
                  const st = qStats(q);
                  return (
                    <tr key={q.id}>
                      <td>
                        <b className="lnk">{q.name}</b>
                      </td>
                      <td>{s.waiting}</td>
                      <td>{s.longest ? fmtL(s.longest) : '—'}</td>
                      <td style={slStyle(st.sl)}>{st.sl == null ? '—' : st.sl + '%'}</td>
                      <td>{st.handled}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#8794a8' }}>
                    This flow has no Transfer-to-ACD node yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="sect">Today's interactions</div>
          <table className="dt">
            <thead>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Queue</th>
                <th>Agent</th>
                <th>Dur</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {today.length ? (
                today.slice(0, 10).map((i) => (
                  <tr key={i.id}>
                    <td>{i.t}</td>
                    <td>{i.name}</td>
                    <td>{i.queue}</td>
                    <td>{i.agent}</td>
                    <td>{i.dur}</td>
                    <td>
                      {i.result === 'Abandoned' ? (
                        <span style={{ color: '#d0342c' }}>Abandoned</span>
                      ) : (
                        'Handled'
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#8794a8' }}>
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
              navigate('/admin/architect');
            }}
          >
            Open in Architect
          </button>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- the tab */

export default function FlowsTab() {
  const db = useDb();
  const [selected, setSelected] = useState(null);
  const today = recsOn(dayISO(0));
  const flow = selected ? (db.flows ?? []).find((f) => f.id === selected) : undefined;
  return (
    <div className="pbody">
      <KpiHeader />

      <div className="panel">
        <h3>
          Flow performance — today <span className="sp" />
          <small>click a flow to see its live activity</small>
        </h3>
        <table className="dt">
          <thead>
            <tr>
              <th>Flow</th>
              <th>Type</th>
              <th>Status</th>
              <th>Entries</th>
              <th>To queue</th>
              <th>Abandoned in queue</th>
            </tr>
          </thead>
          <tbody>
            {(db.flows ?? []).map((f) => {
              const qnames = queuesOf(db, f).map((q) => q.name);
              const recs = today.filter((x) => qnames.indexOf(x.queue) > -1);
              const ab = recs.filter((x) => x.result === 'Abandoned').length;
              return (
                <tr key={f.id} onClick={() => setSelected(f.id)}>
                  <td>
                    <b className="lnk">{f.name}</b>
                  </td>
                  <td>{f.type}</td>
                  <td>
                    <FlowStatus flow={f} />
                  </td>
                  <td>{recs.length}</td>
                  <td>{qnames.join(', ')}</td>
                  <td>{ab ? <b style={{ color: '#d0342c' }}>{ab}</b> : '0'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {flow ? <FlowLiveDrawer flow={flow} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
