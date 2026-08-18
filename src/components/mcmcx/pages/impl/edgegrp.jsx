/**
 * Telephony › Edge Groups.
 *
 * An edge group is the sharing boundary for telephony resources: trunks and
 * phone resources connected to one edge are available to every edge in the same
 * group, and to no other group.
 *
 * Ported from the prototype's `renderEdgeGroups` / `addEdgeGroup` /
 * `saveEdgeGroup` / `delEdgeGroup`.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { ErrorBox } from './_telephonyUi';

/* --------------------------------------------------------- create the group */

function AddEdgeGroupDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    if (
      trimmed.length < 2 ||
      db.edgeGroups.some((x) => x.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setErrors(['A unique group name is required.']);
      return;
    }
    mutate((database) => {
      database.edgeGroups.push({
        id: uid(),
        name: trimmed,
        desc: desc.trim(),
      });
    });
    audit('Create edge group', trimmed);
    onClose();
    toast('Edge group created');
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          height: 'auto',
          top: '25%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>Create Edge Group</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="fld">
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Create
          </button>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- the page */

export default function EdgeGroupsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const [showAdd, setShowAdd] = useState(false);
  function remove(id) {
    const group = db.edgeGroups.find((x) => x.id === id);
    if (!group) return;
    const used =
      db.edges.some((e) => e.group === id) ||
      db.trunks.some((t) => t.group === id) ||
      db.sites.some((s) => s.group === id);
    if (used) {
      toast('Cannot delete — edges, trunks or sites still reference this group');
      return;
    }
    confirmBox(`Delete edge group ${group.name}?`, () => {
      mutate((database) => {
        database.edgeGroups = database.edgeGroups.filter((x) => x.id !== id);
      });
      audit('Delete edge group', group.name);
      toast('Deleted');
    });
  }
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Telephony
          </>
        }
        title="Edge Groups"
        actions={
          <button className="btn" onClick={() => setShowAdd(true)}>
            + Create Edge Group
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `All Groups (${db.edgeGroups.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div
          style={{
            fontSize: 12,
            color: '#5b6b82',
            marginBottom: 10,
          }}
        >
          Trunks and phone resources connected to one edge are shared by every edge in its group.
          Groups do not share resources with other groups.
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Group</th>
                <th>Description</th>
                <th>Edges</th>
                <th>Trunks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {db.edgeGroups.map((group) => {
                const edges = db.edges.filter((e) => e.group === group.id);
                const trunks = db.trunks.filter((t) => t.group === group.id);
                return (
                  <tr key={group.id}>
                    <td>
                      <b>{group.name}</b>
                    </td>
                    <td>{group.desc || ''}</td>
                    <td>
                      {edges.length
                        ? edges.map((edge) => (
                            <span
                              key={edge.id}
                              className={'tag' + (edge.state === 'Online' ? '' : ' o')}
                            >
                              {edge.name}
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td>{trunks.length}</td>
                    <td
                      style={{
                        width: 70,
                      }}
                    >
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                        }}
                        onClick={() => remove(group.id)}
                      >
                        Delete
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd ? <AddEdgeGroupDrawer onClose={() => setShowAdd(false)} /> : null}
    </>
  );
}
