/**
 * Call Routing — the DID → flow bindings.
 *
 * Ported from the prototype's `renderCallroute` / `newCallRoute` /
 * `saveCallRoute` / `delCallRoute`. A call route answers an inbound DID with an
 * Architect flow; the DID must be E.164 and must sit inside one of the ranges
 * defined in Telephony › DID Numbers.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';

/* -------------------------------------------------------- new route form */

function NewCallRouteDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [did, setDid] = useState('');
  const [flowId, setFlowId] = useState(db.flows[0]?.id ?? '');
  const [errors, setErrors] = useState([]);
  function save() {
    const routeName = name.trim();
    const number = did.trim();
    const errs = [];
    if (routeName.length < 2) errs.push('Route name is required.');
    if (!/^\+\d{7,15}$/.test(number)) {
      errs.push('DID must be E.164.');
    } else {
      const inRange = db.didRanges.some(
        (r) => number.length === r.start.length && number >= r.start && number <= r.end
      );
      if (!inRange) {
        errs.push('DID is not inside any defined range (Telephony › DID Numbers).');
      }
    }
    if (db.callRoutes.some((r) => r.did === number)) {
      errs.push('That DID already has a call route.');
    }
    if (errs.length) {
      setErrors(errs);
      return;
    }
    mutate((database) => {
      database.callRoutes.push({
        id: uid(),
        name: routeName,
        did: number,
        flow: flowId,
      });
    });
    const flow = db.flows.filter((f) => f.id === flowId)[0];
    audit('Create call route', number + ' → ' + (flow ? flow.name : '?'));
    onClose();
    toast(
      `${number} now answered by ${flow ? flow.name : ''}` +
        (flow && flow.status !== 'Published' ? ' — ⚠ flow is draft, publish it to go live' : '')
    );
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
          <h2>New Call Route</h2>
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
            <label>Route name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>DID (E.164, must be in a DID range) *</label>
            <input
              value={did}
              placeholder="+442071234111"
              onChange={(e) => setDid(e.target.value)}
            />
          </div>

          <div className="fld">
            <label>Flow</label>
            <select value={flowId} onChange={(e) => setFlowId(e.target.value)}>
              {db.flows.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.status})
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
            Create
          </button>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- the page */

export default function CallroutePage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const [creating, setCreating] = useState(false);
  function delCallRoute(id) {
    const route = db.callRoutes.filter((x) => x.id === id)[0];
    if (!route) return;
    confirmBox(
      `Delete call route for ${route.did}? Calls to this DID will get busy/reorder.`,
      () => {
        mutate((database) => {
          database.callRoutes = database.callRoutes.filter((x) => x.id !== id);
        });
        audit('Delete call route', route.did);
        toast('Call route deleted');
      }
    );
  }
  return (
    <>
      <PageHeader
        breadcrumb="Admin › Routing"
        title="Call Routing"
        actions={
          <button className="btn" onClick={() => setCreating(true)}>
            + New Call Route
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `DID → Flow bindings (${db.callRoutes.length})`,
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
          A call route answers an inbound DID with a published Architect flow. DIDs must exist in
          Telephony › DID Numbers.
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Route</th>
                <th>DID</th>
                <th>Flow</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.callRoutes.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      color: '#8794a8',
                      padding: 22,
                    }}
                  >
                    No call routes yet
                  </td>
                </tr>
              ) : (
                db.callRoutes.map((route) => {
                  const flow = db.flows.filter((f) => f.id === route.flow)[0];
                  return (
                    <tr key={route.id}>
                      <td>
                        <b>{route.name}</b>
                      </td>
                      <td>
                        <span className="tag">{route.did}</span>
                      </td>
                      <td>
                        {flow ? (
                          <>
                            <b
                              className="lnk"
                              onClick={() => navigate(`/admin/architect?flow=${flow.id}`)}
                            >
                              {flow.name}
                            </b>{' '}
                            {flow.status === 'Published' ? (
                              <span
                                className="st ok"
                                style={{
                                  fontSize: 11,
                                }}
                              >
                                <span className="d" />v{flow.ver}
                              </span>
                            ) : (
                              <span
                                className="st wn"
                                style={{
                                  fontSize: 11,
                                }}
                              >
                                <span className="d" />
                                draft — not answering
                              </span>
                            )}
                          </>
                        ) : (
                          <span
                            style={{
                              color: '#b3261e',
                            }}
                          >
                            missing flow
                          </span>
                        )}
                      </td>
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
                          onClick={() => delCallRoute(route.id)}
                        >
                          Delete
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating ? <NewCallRouteDrawer onClose={() => setCreating(false)} /> : null}
    </>
  );
}
