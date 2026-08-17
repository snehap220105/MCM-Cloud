/**
 * Performance › Agents.
 *
 * The agent board: every active user with their live presence, how long they
 * have held it, and what they have handled today. Rows are ordered the way a
 * supervisor scans them — interacting first, idle states last. The signed-in
 * agent's row is driven by the real workspace presence rather than by the
 * simulation, and is flagged "live".
 */
import { useDb } from '@/store/db';
import { KpiHeader, agStats, fmt, useLive } from './_live';

/** Scan order for the board: who needs attention first. */
const STATE_ORDER = {
  Interacting: 0,
  'On Queue': 1,
  Available: 2,
  Busy: 3,
  Away: 4,
  Meal: 5,
};

/** Presence dot / label colour, matching the workspace palette. */
function stateColour(state) {
  if (state === 'On Queue') return '#FF4F1F';
  if (state === 'Interacting') return '#1f6feb';
  if (state === 'Available') return '#1f9d63';
  if (state === 'Away' || state === 'Meal') return '#e0a200';
  return '#8a94a6';
}
export default function AgentsTab() {
  const db = useDb();
  const live = useLive();
  const now = Date.now();
  const rows = db.users
    .filter((u) => u.state === 'Active')
    .map((u) => {
      const s = live.agents[u.id] ?? {
        state: 'Available',
        since: now,
        drift: () => 0,
      };
      return {
        user: u,
        live: s,
        stats: agStats(u.name),
        mins: Math.floor((now - s.since) / 60000),
        queues: (db.queues ?? []).filter((q) => q.members.indexOf(u.id) > -1).length,
      };
    })
    .sort((a, b) => (STATE_ORDER[a.live.state] ?? 9) - (STATE_ORDER[b.live.state] ?? 9));
  return (
    <div className="pbody">
      <KpiHeader />

      <div className="panel">
        <h3>
          Agents — status &amp; today&rsquo;s performance
          <span className="sp" />
          <small>the signed-in agent&rsquo;s row is driven by the real workspace</small>
        </h3>
        <table className="dt">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Status</th>
              <th>Time in status</th>
              <th>Handled today</th>
              <th>AHT</th>
              <th>Queues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const colour = stateColour(row.live.state);
              return (
                <tr key={row.user.id}>
                  <td>
                    <b>{row.user.name}</b>
                    {row.live.real ? (
                      <>
                        {' '}
                        <span className="tag o">live</span>
                      </>
                    ) : null}
                  </td>
                  <td>
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
                      {row.live.state}
                    </span>
                  </td>
                  <td>{row.mins < 1 ? '<1 min' : row.mins + ' min'}</td>
                  <td>{row.stats.handled}</td>
                  <td>{row.stats.aht == null ? '—' : fmt(row.stats.aht)}</td>
                  <td>{row.queues}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
