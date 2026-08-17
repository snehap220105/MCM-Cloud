/**
 * Alert Rules — threshold alerts on queue and agent metrics.
 *
 * Ported from the prototype's `renderAlertsFx`, `editAlertFx`, `saveAlertFx`,
 * `fireAlert` and `delAlertFx`. Only non-agent users can be notified, exactly
 * as the original's `userRoleClass` filter decided.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
const METRICS = [
  'Interactions waiting',
  'Longest wait (min)',
  'Agents on queue',
  'Service level %',
  'Time in Away status (min)',
  'Abandon rate %',
];
const OPERATORS = ['>', '<', '>=', '<='];

/** admin / supervisor / agent — the same role bucketing the login used. */
function userRoleClass(database, user) {
  const names = user.roles.map((rid) => database.roles.find((r) => r.id === rid)?.name ?? '');
  if (names.indexOf('Master Admin') > -1 || names.indexOf('Admin') > -1) return 'admin';
  if (names.indexOf('Supervisor') > -1) return 'supervisor';
  return 'agent';
}

/** The red validation panel the legacy drawers showed above the form. */
function ErrorBox({ errors }) {
  if (!errors.length) return null;
  return (
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
      {errors.map((error) => (
        <div key={error}>{error}</div>
      ))}
    </div>
  );
}
function AlertDrawer({ rule, onClose }) {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  const isNew = !rule;
  const [name, setName] = useState(rule?.name ?? '');
  const [metric, setMetric] = useState(rule?.metric ?? 'Interactions waiting');
  const [cond, setCond] = useState(rule?.cond ?? '>');
  const [threshold, setThreshold] = useState(String(rule?.threshold ?? 5));
  const [dur, setDur] = useState(String(rule?.dur ?? 2));
  const [notify, setNotify] = useState(rule?.notify ?? []);
  const [on, setOn] = useState(rule ? rule.on : true);
  const [errors, setErrors] = useState([]);
  const candidates = db.users.filter((u) => userRoleClass(db, u) !== 'agent');
  function toggleNotify(id, checked) {
    setNotify((current) => (checked ? [...current, id] : current.filter((x) => x !== id)));
  }
  function save() {
    const trimmed = name.trim();
    const found = [];
    if (trimmed.length < 2) found.push('Rule name is required.');
    if (!notify.length) found.push('Pick at least one person to notify.');
    if (found.length) {
      setErrors(found);
      return;
    }
    mutate((database) => {
      let target = rule ? database.alertRules.find((x) => x.id === rule.id) : undefined;
      if (!target) {
        target = {
          id: uid(),
          name: '',
          metric: '',
          cond: '>',
          threshold: 0,
          dur: 0,
          notify: [],
          on: true,
        };
        database.alertRules.push(target);
      }
      target.name = trimmed;
      target.metric = metric;
      target.cond = cond;
      target.threshold = parseInt(threshold, 10) || 0;
      target.dur = parseInt(dur, 10) || 0;
      target.notify = notify.slice();
      target.on = on;
    });
    audit((isNew ? 'Create' : 'Edit') + ' alert rule', trimmed);
    onClose();
    toast('Alert rule saved');
  }
  function fire() {
    if (!rule) return;
    audit('ALERT fired (test)', `${rule.name} — ${rule.metric} ${rule.cond} ${rule.threshold}`);
    toast(
      `🔔 Alert fired — notification sent to ${rule.notify.length} supervisor(s); see the bell icon`
    );
  }
  function remove() {
    if (!rule) return;
    onClose();
    confirmBox(`Delete alert rule ${rule.name}?`, () => {
      mutate((database) => {
        database.alertRules = database.alertRules.filter((x) => x.id !== rule.id);
      });
      audit('Delete alert rule', rule.name);
      toast('Rule deleted');
    });
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? 'Add Alert Rule' : `Edit — ${rule.name}`}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox errors={errors} />

          <div className="fld">
            <label>Rule name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="sect">Condition</div>

          <div className="fld">
            <label>Metric</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {METRICS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
            }}
          >
            <div
              className="fld"
              style={{
                flex: 1,
              }}
            >
              <label>Operator</label>
              <select value={cond} onChange={(e) => setCond(e.target.value)}>
                {OPERATORS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div
              className="fld"
              style={{
                flex: 1,
              }}
            >
              <label>Threshold</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
            <div
              className="fld"
              style={{
                flex: 1,
              }}
            >
              <label>Sustained (min)</label>
              <input type="number" value={dur} onChange={(e) => setDur(e.target.value)} />
            </div>
          </div>

          <div className="sect">Notify</div>
          {candidates.map((user) => (
            <label
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '3px 0',
                fontSize: 12.5,
              }}
            >
              <input
                type="checkbox"
                checked={notify.includes(user.id)}
                style={{
                  width: 'auto',
                }}
                onChange={(e) => toggleNotify(user.id, e.target.checked)}
              />
              {user.name}{' '}
              <span
                style={{
                  color: '#8794a8',
                  fontSize: 11,
                }}
              >
                {userRoleClass(db, user)}
              </span>
            </label>
          ))}

          <div
            className="tgl"
            style={{
              marginTop: 8,
            }}
          >
            <input
              type="checkbox"
              checked={on}
              style={{
                width: 'auto',
                marginRight: 4,
              }}
              onChange={(e) => setOn(e.target.checked)}
            />
            Rule enabled
          </div>

          {isNew ? null : (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 8,
              }}
            >
              <button className="btn sec" onClick={fire}>
                Test-fire this alert
              </button>
              <button className="btn gh" onClick={remove}>
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}
export default function AlertsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Contact Center
          </>
        }
        title="Alert Rules"
        actions={
          <button className="btn" onClick={() => setEditing('new')}>
            + Add Rule
          </button>
        }
        tabs={[
          {
            id: 'rules',
            label: `Rules (${db.alertRules.length})`,
          },
        ]}
        activeTab="rules"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Condition</th>
                <th>Notifies</th>
                <th>State</th>
                <th
                  style={{
                    width: 40,
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {db.alertRules.map((rule) => (
                <tr key={rule.id} onClick={() => setEditing(rule)}>
                  <td>
                    <b className="lnk">{rule.name}</b>
                  </td>
                  <td>
                    {rule.metric} {rule.cond} {rule.threshold}
                    {rule.dur ? ` for ${rule.dur} min` : ''}
                  </td>
                  <td>
                    {rule.notify
                      .map((id) => db.users.find((u) => u.id === id)?.name ?? '')
                      .filter(Boolean)
                      .join(', ')}
                  </td>
                  <td>
                    {rule.on ? (
                      <span className="st ok">
                        <span className="d" />
                        Enabled
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
                        />
                        Disabled
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      color: '#a9b3c2',
                    }}
                  >
                    ⋮
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <AlertDrawer rule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
