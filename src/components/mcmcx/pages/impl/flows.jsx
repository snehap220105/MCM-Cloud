/**
 * Architect Flows — the flow inventory.
 *
 * Ported from the prototype's `renderFlows` / `newFlow` / `delFlow`. Every row
 * opens the flow in the Architect editor; creating a flow seeds it with a Start
 * and a Disconnect action already wired together and drops you into the editor.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
/** `divName()` — unknown divisions render as an em dash, not as their id. */
function divName(id, divisions) {
  const d = divisions.filter((x) => x.id === id)[0];
  return d ? d.name : '—';
}

/* ------------------------------------------------------- create flow form */

function CreateFlowDrawer({ onClose, onCreated }) {
  const db = useDb();
  const [name, setName] = useState('');
  const [type, setType] = useState('Inbound Call');
  const [division, setDivision] = useState(db.divisions[0]?.id ?? '');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    if (
      trimmed.length < 2 ||
      db.flows.some((x) => x.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setErrors(['A unique flow name is required.']);
      return;
    }
    const startId = uid();
    const discId = uid();
    const flow = {
      id: uid(),
      name: trimmed,
      type,
      division,
      status: 'Draft',
      ver: '0',
      sched: '',
      nodes: [
        {
          id: startId,
          type: 'start',
          t: 'Start',
          b: 'Entry point',
          x: 40,
          y: 40,
        },
        {
          id: discId,
          type: 'disc',
          t: 'Disconnect',
          b: 'end of flow',
          x: 40,
          y: 260,
        },
      ],
      links: [[startId, discId, '']],
      meta: {
        queueFor: {},
        skills: {},
      },
    };
    mutate((database) => {
      database.flows.push(flow);
    });
    audit('Create flow', trimmed);
    onCreated(flow.id);
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
          <h2>Create Flow</h2>
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

          <div className="fld">
            <label>Flow name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option>Inbound Call</option>
              <option>In-Queue Call</option>
              <option>Outbound Call</option>
              <option>Inbound Email</option>
            </select>
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
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Create &amp; open editor
          </button>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- the page */

export default function FlowsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const [creating, setCreating] = useState(false);

  /** `archOpen()` — the editor is its own page id, addressed by `?flow=`. */
  function archOpen(id) {
    navigate(`/admin/architect?flow=${id}`);
  }
  function delFlow(id) {
    const flow = db.flows.filter((x) => x.id === id)[0];
    if (!flow) return;
    const used = db.callRoutes.filter((r) => r.flow === id);
    confirmBox(
      `Delete flow ${flow.name}?` +
        (used.length ? ` ${used.length} call route(s) bound to it will be removed.` : ''),
      () => {
        mutate((database) => {
          database.flows = database.flows.filter((x) => x.id !== id);
          database.callRoutes = database.callRoutes.filter((r) => r.flow !== id);
        });
        audit('Delete flow', flow.name);
        toast('Flow deleted');
      }
    );
  }
  return (
    <>
      <PageHeader
        breadcrumb="Admin › Routing"
        title="Architect Flows"
        actions={
          <>
            <button className="btn" onClick={() => setCreating(true)}>
              + Create Flow
            </button>
            <button className="btn sec" onClick={() => navigate('/admin/callroute')}>
              Call Routing
            </button>
          </>
        }
        tabs={[
          {
            id: 'all',
            label: `All Flows (${db.flows.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Flow</th>
                <th>Type</th>
                <th>Division</th>
                <th>Status</th>
                <th>Actions</th>
                <th>Bound DIDs</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.flows.map((flow) => {
                const routes = db.callRoutes.filter((r) => r.flow === flow.id);
                return (
                  <tr key={flow.id} onClick={() => archOpen(flow.id)}>
                    <td>
                      <b className="lnk">{flow.name}</b>
                    </td>
                    <td>{flow.type}</td>
                    <td>{divName(flow.division, db.divisions)}</td>
                    <td>
                      {flow.status === 'Published' ? (
                        <span className="st ok">
                          <span className="d" />
                          Published v{flow.ver}
                        </span>
                      ) : (
                        <span className="st wn">
                          <span className="d" />
                          Draft
                        </span>
                      )}
                    </td>
                    <td>{flow.nodes.length}</td>
                    <td>
                      {routes.length
                        ? routes.map((r, i) => (
                            <span key={r.id}>
                              {i ? ' ' : ''}
                              <span className="tag">{r.did}</span>
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td
                      style={{
                        width: 70,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                        }}
                        onClick={() => delFlow(flow.id)}
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

      {creating ? (
        <CreateFlowDrawer
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            toast('Flow created — opening editor');
            archOpen(id);
          }}
        />
      ) : null}
    </>
  );
}
