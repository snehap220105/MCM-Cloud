/**
 * Emergency Groups — the big red switch that overrides schedule logic.
 *
 * Ported from the prototype's `renderEmergencyFx` and `togEmer`. Activating a
 * group still forces every schedule group Closed, which is what makes the
 * attached flows take their emergency path.
 */
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
export default function EmergencyPage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast } = useUi();
  function toggle(id) {
    const group = db.emerGroups.find((x) => x.id === id);
    if (!group) return;
    const nextActive = !group.active;
    mutate((database) => {
      const target = database.emerGroups.find((x) => x.id === id);
      if (!target) return;
      target.active = nextActive;
      // Activating an emergency group closes every schedule so the attached
      // flows fall through to their Closed / emergency branch.
      if (target.active) (database.schedGroups || []).forEach((sg) => (sg.state = 'Closed'));
    });
    audit(nextActive ? 'ACTIVATE emergency group' : 'Deactivate emergency group', group.name);
    toast(
      nextActive
        ? `⚠ ${group.name} ACTIVE — attached flows now take the Closed/emergency path`
        : 'Emergency deactivated — normal schedules resume'
    );
  }
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Routing
          </>
        }
        title="Emergency Groups"
        actions={
          <button
            className="btn"
            onClick={() =>
              toast('Add group: name it and tick the flows it overrides — demo has one')
            }
          >
            + Add Group
          </button>
        }
        tabs={[
          {
            id: 'groups',
            label: `Groups (${db.emerGroups.length})`,
          },
        ]}
        activeTab="groups"
      />

      <div className="pbody">
        <div
          style={{
            fontSize: 12,
            color: '#5b6b82',
            marginBottom: 10,
          }}
        >
          Activating an emergency group instantly overrides schedule logic on the attached flows —
          callers hear the emergency path (evacuation/outage) until deactivated. Flow Test Call
          respects this.
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Emergency group</th>
                <th>Overrides flows</th>
                <th>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.emerGroups.map((group) => {
                const flowNames = group.flows
                  .map((fid) => (db.flows || []).find((x) => x.id === fid)?.name ?? '')
                  .filter(Boolean);
                return (
                  <tr key={group.id}>
                    <td>
                      <b>{group.name}</b>
                    </td>
                    <td>
                      {flowNames.length
                        ? flowNames.map((flowName) => (
                            <span className="tag" key={flowName}>
                              {flowName}
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td>
                      {group.active ? (
                        <span
                          className="st"
                          style={{
                            color: '#b3261e',
                          }}
                        >
                          <span
                            className="d"
                            style={{
                              background: '#b3261e',
                            }}
                          />
                          ACTIVE — emergency routing on
                        </span>
                      ) : (
                        <span className="st ok">
                          <span className="d" />
                          Standing by
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        width: 150,
                      }}
                    >
                      <button
                        className={'btn ' + (group.active ? 'sec' : '')}
                        style={{
                          height: 28,
                        }}
                        onClick={() => toggle(group.id)}
                      >
                        {group.active ? 'Deactivate' : 'Activate emergency'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
