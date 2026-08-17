/**
 * Telephony › Edges.
 *
 * Edges are the media appliances (cloud instances or customer VMs/hardware)
 * that terminate RTP. Provisioning one here stands in for generating a pairing
 * PIN and entering it on the Edge console.
 *
 * Ported from the prototype's `renderEdges` / `addEdge` / `saveEdge` /
 * `togEdge` / `delEdge`.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { groupName } from './_telephony';
import { ErrorBox } from './_telephonyUi';
const EDGE_MODELS = ['Customer VM', 'Customer Hardware (HPE)', 'Cloud (virtual)'];

/* ------------------------------------------------------ provision new edge */

function AddEdgeDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [model, setModel] = useState(EDGE_MODELS[0]);
  const [group, setGroup] = useState(db.edgeGroups[0]?.id ?? '');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    if (
      trimmed.length < 2 ||
      db.edges.some((x) => x.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setErrors(['A unique edge name is required.']);
      return;
    }
    mutate((database) => {
      database.edges.push({
        id: uid(),
        name: trimmed,
        model,
        group,
        state: 'Online',
      });
    });
    audit('Provision edge', trimmed);
    onClose();
    toast(`Edge ${trimmed} paired and online`);
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          height: 'auto',
          top: '22%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>Provision New Edge</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="fld">
            <label>Edge name *</label>
            <input
              value={name}
              placeholder="MUM-EDGE-03"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="fld">
            <label>Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {EDGE_MODELS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Edge group</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {db.edgeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
            }}
          >
            A device pairing PIN would be generated here; enter it on the Edge console to pair.
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Provision
          </button>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- the page */

export default function EdgesPage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const [showAdd, setShowAdd] = useState(false);
  function toggle(id) {
    mutate((database) => {
      const edge = database.edges.find((x) => x.id === id);
      if (!edge) return;
      edge.state = edge.state === 'Online' ? 'Offline' : 'Online';
      audit('Edge state change', `${edge.name} → ${edge.state}`);
    });
  }
  function remove(id) {
    const edge = db.edges.find((x) => x.id === id);
    if (!edge) return;
    confirmBox(`Delete edge ${edge.name}?`, () => {
      mutate((database) => {
        database.edges = database.edges.filter((x) => x.id !== id);
      });
      audit('Delete edge', edge.name);
      toast('Edge deleted');
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
        title="Edges"
        actions={
          <button className="btn" onClick={() => setShowAdd(true)}>
            + Provision New Edge
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `All Edges (${db.edges.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Edge</th>
                <th>Model</th>
                <th>Edge group</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {db.edges.map((edge) => (
                <tr key={edge.id}>
                  <td>
                    <b>{edge.name}</b>
                  </td>
                  <td>{edge.model}</td>
                  <td>{groupName(db, edge.group)}</td>
                  <td>
                    {edge.state === 'Online' ? (
                      <span className="st ok">
                        <span className="d"></span>Online
                      </span>
                    ) : (
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
                        ></span>
                        Offline
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      width: 170,
                    }}
                  >
                    <a
                      className="lnk"
                      style={{
                        fontSize: 12,
                      }}
                      onClick={() => toggle(edge.id)}
                    >
                      {edge.state === 'Online' ? 'Take offline' : 'Bring online'}
                    </a>
                    {' · '}
                    <a
                      className="lnk"
                      style={{
                        fontSize: 12,
                      }}
                      onClick={() => remove(edge.id)}
                    >
                      Delete
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd ? <AddEdgeDrawer onClose={() => setShowAdd(false)} /> : null}
    </>
  );
}
