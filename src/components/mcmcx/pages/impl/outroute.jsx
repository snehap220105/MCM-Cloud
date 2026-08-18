/**
 * Telephony › Outbound Routes.
 *
 * An outbound route maps the classifications produced by the site's number
 * plans onto an ordered list of external trunks. Sequential distribution uses
 * the first trunk until capacity then fails over; Random load-balances. A
 * classification with no enabled route is blocked — the banner at the top calls
 * those out.
 *
 * Ported from the prototype's `renderOutroute` / `togRoute` / `editRoute` /
 * `saveRoute` / `delRoute`.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import {
  currentTelSite,
  groupName,
  plansOf,
  routesOf,
  siteById,
  trunkById,
  useTelSite,
} from './_telephony';
import { classificationsOf, ErrorBox, SimulateCallDrawer, SiteSelector } from './_telephonyUi';
const DISTRIBUTIONS = ['Sequential', 'Random'];

/* -------------------------------------------------------------- route drawer */

function RouteDrawer({ site, routeId, onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const routes = routesOf(site);
  const existing = routeId ? routes.find((x) => x.id === routeId) : undefined;
  const isNew = !existing;

  /* Extension is internal — it is never served by an outbound route. */
  const classifications = classificationsOf(site).filter((c) => c !== 'Extension');
  /* Phone and WebRTC trunks are internal-facing and cannot carry outbound PSTN. */
  const externalTrunks = db.trunks.filter(
    (t) => t.type !== 'Phone Trunk' && t.type !== 'WebRTC Trunk'
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [cls, setCls] = useState([...(existing?.cls ?? [])]);
  const [trunks, setTrunks] = useState([...(existing?.trunks ?? [])]);
  const [dist, setDist] = useState(existing?.dist ?? 'Sequential');
  const [errors, setErrors] = useState([]);
  function toggleCls(value, on) {
    setCls((current) =>
      on
        ? classifications.filter((c) => c === value || current.indexOf(c) > -1)
        : current.filter((c) => c !== value)
    );
  }

  /** Checked order is the failover order, so keep the on-screen order. */
  function toggleTrunk(id, on) {
    setTrunks((current) =>
      on
        ? externalTrunks.map((t) => t.id).filter((t) => t === id || current.indexOf(t) > -1)
        : current.filter((t) => t !== id)
    );
  }
  function save() {
    const trimmed = name.trim();
    const errs = [];
    if (trimmed.length < 2) errs.push('Route name is required.');
    if (!cls.length) errs.push('Select at least one classification.');
    if (errs.length) {
      setErrors(errs);
      return;
    }
    mutate((database) => {
      const target = siteById(database, site.id);
      if (!target) return;
      const targetRoutes = routesOf(target);
      let route = routeId ? targetRoutes.find((x) => x.id === routeId) : undefined;
      if (!route) {
        route = {
          id: uid(),
          name: '',
          cls: [],
          trunks: [],
          dist: 'Sequential',
          on: true,
        };
        targetRoutes.push(route);
      }
      route.name = trimmed;
      route.cls = cls;
      route.trunks = trunks;
      route.dist = dist;
    });
    audit(
      `${isNew ? 'Create' : 'Edit'} outbound route`,
      `${site.name} › ${trimmed} [${cls.join(', ')}]`
    );
    onClose();
    toast(`Route saved — ${trimmed}` + (trunks.length ? '' : ' (no trunks — calls will fail)'));
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? 'New Outbound Route' : `Edit — ${existing.name}`}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="fld">
            <label>Route name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="sect">Classifications served</div>
          {classifications.map((c) => (
            <label
              key={c}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                margin: '0 12px 6px 0',
                fontSize: 12.5,
              }}
            >
              <input
                type="checkbox"
                checked={cls.indexOf(c) > -1}
                onChange={(e) => toggleCls(c, e.target.checked)}
                style={{
                  width: 'auto',
                }}
              />
              {c}
            </label>
          ))}

          <div className="sect">External trunks (checked order = failover order)</div>
          {externalTrunks.map((trunk) => (
            <label
              key={trunk.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 0',
                fontSize: 12.5,
              }}
            >
              <input
                type="checkbox"
                checked={trunks.indexOf(trunk.id) > -1}
                onChange={(e) => toggleTrunk(trunk.id, e.target.checked)}
                style={{
                  width: 'auto',
                }}
              />
              <b>{trunk.name}</b>
              <span
                style={{
                  color: '#8794a8',
                  fontSize: 11,
                }}
              >
                {trunk.type} · {groupName(db, trunk.group)}
              </span>
              {trunk.state !== 'In-Service' ? <span className="tag o">disabled</span> : null}
            </label>
          ))}

          <div
            className="fld"
            style={{
              marginTop: 8,
            }}
          >
            <label>Distribution</label>
            <select value={dist} onChange={(e) => setDist(e.target.value)}>
              {DISTRIBUTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
            }}
          >
            Sequential = first trunk until capacity, then next (failover). Random = load-balanced.
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            {isNew ? 'Create route' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- the page */

export default function OutboundRoutesPage() {
  const db = useDb();
  useTelSite();
  const site = currentTelSite(db);
  if (!site) return null;
  return <OutboundRoutesView db={db} site={site} />;
}
function OutboundRoutesView({ db, site }) {
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();

  /** `null` = closed, `''` = create, otherwise the route id being edited. */
  const [editing, setEditing] = useState(null);
  const [showSim, setShowSim] = useState(false);
  const routes = routesOf(site);
  const plans = plansOf(site);

  /* Classifications the site can produce that no enabled route serves. */
  const allClasses = [];
  plans.forEach((p) => {
    if (allClasses.indexOf(p.cls) < 0) allClasses.push(p.cls);
  });
  const unrouted = allClasses.filter(
    (c) => c !== 'Extension' && !routes.some((r) => r.on && r.cls.indexOf(c) > -1)
  );
  function toggleRoute(id) {
    mutate((database) => {
      const target = siteById(database, site.id);
      if (!target) return;
      const route = routesOf(target).find((x) => x.id === id);
      if (!route) return;
      route.on = !route.on;
      audit('Toggle route', `${site.name} › ${route.name} → ${route.on ? 'enabled' : 'disabled'}`);
    });
  }
  function removeRoute(id) {
    const route = routes.find((x) => x.id === id);
    if (!route) return;
    confirmBox(
      `Delete route ${route.name}? Its classifications may become unrouted (blocked).`,
      () => {
        mutate((database) => {
          const target = siteById(database, site.id);
          if (target) target.routes = routesOf(target).filter((x) => x.id !== id);
        });
        audit('Delete route', `${site.name} › ${route.name}`);
        toast('Route deleted');
      }
    );
  }
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Telephony ›{' '}
            <a onClick={() => navigate('/admin/sites')}>Sites</a>
          </>
        }
        title={`Outbound Routes — ${site.name}`}
        actions={
          <>
            <button className="btn" onClick={() => setEditing('')}>
              + New Route
            </button>
            <button className="btn sec" onClick={() => navigate('/admin/numplan')}>
              Number Plans
            </button>
          </>
        }
        tabs={[
          {
            id: 'routes',
            label: `Routes (${routes.length})`,
          },
        ]}
        activeTab="routes"
      />

      <div className="pbody">
        <div className="tbar">
          <SiteSelector sites={db.sites} current={site.id} />
          <div className="sp"></div>
          <div className="chip" onClick={() => setShowSim(true)}>
            📞 Simulate Call
          </div>
        </div>

        {unrouted.length ? (
          <div
            style={{
              background: '#fff8e6',
              border: '1px solid #f2dfa7',
              borderRadius: 6,
              padding: '8px 12px',
              marginBottom: 10,
              fontSize: 12.5,
            }}
          >
            ⚠ Classifications with <b>no enabled route</b> (calls are blocked):{' '}
            {unrouted.map((c) => (
              <span key={c} className="tag o">
                {c}
              </span>
            ))}
          </div>
        ) : null}

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Route</th>
                <th>Classifications</th>
                <th>Trunks (order = failover)</th>
                <th>Distribution</th>
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => {
                const routeTrunks = route.trunks
                  .map((id) => trunkById(db, id))
                  .filter((t) => Boolean(t));
                return (
                  <tr key={route.id}>
                    <td>
                      <b className="lnk" onClick={() => setEditing(route.id)}>
                        {route.name}
                      </b>
                    </td>
                    <td>
                      {route.cls.map((c) => (
                        <span key={c} className="tag">
                          {c}
                        </span>
                      ))}
                    </td>
                    <td>
                      {routeTrunks.length ? (
                        routeTrunks.map((trunk, index) => (
                          <span key={trunk.id}>
                            {index > 0 ? ', ' : ''}
                            {trunk.name}
                            {trunk.state !== 'In-Service' ? (
                              <>
                                {' '}
                                <span className="tag o">disabled</span>
                              </>
                            ) : null}
                          </span>
                        ))
                      ) : (
                        <span
                          style={{
                            color: '#b3261e',
                          }}
                        >
                          none — calls fail
                        </span>
                      )}
                    </td>
                    <td>{route.dist}</td>
                    <td>
                      {route.on ? (
                        <span className="st ok">
                          <span className="d"></span>Enabled
                        </span>
                      ) : (
                        <span
                          className="st"
                          style={{
                            color: '#8a94a6',
                          }}
                        >
                          <span
                            className="d"
                            style={{
                              background: '#8a94a6',
                            }}
                          ></span>
                          Disabled
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        width: 120,
                      }}
                    >
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                        }}
                        onClick={() => toggleRoute(route.id)}
                      >
                        {route.on ? 'Disable' : 'Enable'}
                      </a>
                      {' · '}
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                        }}
                        onClick={() => removeRoute(route.id)}
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

      {editing !== null ? (
        <RouteDrawer site={site} routeId={editing || null} onClose={() => setEditing(null)} />
      ) : null}
      {showSim ? (
        <SimulateCallDrawer db={db} site={site} onClose={() => setShowSim(false)} />
      ) : null}
    </>
  );
}
