/**
 * Telephony › Number Plans.
 *
 * Number plans are evaluated top-down for the selected site — the first plan
 * that matches the dialed digits decides the classification and the E.164
 * normalisation. A classification with no outbound route serving it acts as a
 * block, so the plan order is the dial plan.
 *
 * Ported from the prototype's `renderNumplan` / `movePlan` / `editPlan` /
 * `savePlan` / `delPlan`. The classification engine itself lives in
 * `_telephony.js` because Outbound Routes uses it too (Simulate Call).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { currentTelSite, plansOf, siteById, useTelSite } from './_telephony';
import { ErrorBox, SimulateCallDrawer, SiteSelector } from './_telephonyUi';
const MATCH_TYPES = ['Regex', 'Number List', 'Digit Length'];
const CLASSIFICATIONS = [
  'Emergency',
  'Extension',
  'National',
  'International',
  'Premium',
  'Network',
  'Custom',
];

/** Renders the match spec column for the plan's match type. */
function MatchSpec({ plan }) {
  if (plan.match === 'Number List') return <>{plan.spec.list}</>;
  if (plan.match === 'Digit Length')
    return (
      <>
        {plan.spec.min}–{plan.spec.max} digits
      </>
    );
  return (
    <code
      style={{
        fontSize: 11,
      }}
    >
      {plan.spec.pattern}
    </code>
  );
}

/* --------------------------------------------------------------- plan drawer */

function PlanDrawer({ site, planId, onClose }) {
  const { toast } = useUi();
  const plans = plansOf(site);
  const existing = planId ? plans.find((x) => x.id === planId) : undefined;
  const isNew = !existing;
  const [name, setName] = useState(existing?.name ?? '');
  const [match, setMatch] = useState(existing?.match ?? 'Regex');
  const [pattern, setPattern] = useState(existing?.spec.pattern ?? '');
  const [list, setList] = useState(existing?.spec.list ?? '');
  const [min, setMin] = useState(String(existing?.spec.min ?? 4));
  const [max, setMax] = useState(String(existing?.spec.max ?? 4));
  const [cls, setCls] = useState(existing?.cls || CLASSIFICATIONS[0]);
  const [norm, setNorm] = useState(existing?.norm ?? '');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    const errs = [];
    if (trimmed.length < 2) errs.push('Plan name is required.');
    if (plans.length >= 200 && !planId)
      errs.push('Plan limit reached (200 per org in Genesys; per site here).');
    const spec = {};
    if (match === 'Regex') {
      spec.pattern = pattern.trim();
      if (!spec.pattern) errs.push('Regular expression is required.');
      else {
        try {
          new RegExp(spec.pattern);
        } catch (error) {
          errs.push('Invalid regular expression: ' + error.message);
        }
      }
    }
    if (match === 'Number List') {
      spec.list = list.trim();
      if (!spec.list) errs.push('Provide at least one number.');
    }
    if (match === 'Digit Length') {
      spec.min = parseInt(min, 10) || 0;
      spec.max = parseInt(max, 10) || 0;
      if (spec.min < 1 || spec.max < spec.min) errs.push('Digit lengths are invalid.');
    }
    if (errs.length) {
      setErrors(errs);
      return;
    }
    mutate((database) => {
      const target = siteById(database, site.id);
      if (!target) return;
      const targetPlans = plansOf(target);
      let plan = planId ? targetPlans.find((x) => x.id === planId) : undefined;
      if (!plan) {
        plan = {
          id: uid(),
          name: '',
          match: 'Regex',
          spec: {},
          cls: '',
          norm: '',
        };
        targetPlans.unshift(plan);
      }
      plan.name = trimmed;
      plan.match = match;
      plan.spec = spec;
      plan.cls = cls;
      plan.norm = norm.trim();
    });
    audit(`${isNew ? 'Create' : 'Edit'} number plan`, `${site.name} › ${trimmed} → ${cls}`);
    onClose();
    toast(`Number plan saved — ${trimmed}` + (isNew ? ' (placed first — reorder as needed)' : ''));
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? 'New Number Plan' : `Edit — ${existing.name}`}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="fld">
            <label>Plan name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Match type</label>
            <select value={match} onChange={(e) => setMatch(e.target.value)}>
              {MATCH_TYPES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          {match === 'Regex' ? (
            <div className="fld">
              <label>Regular expression (use capture groups for normalisation)</label>
              <input
                value={pattern}
                placeholder="^0(\d{10})$"
                onChange={(e) => setPattern(e.target.value)}
              />
            </div>
          ) : null}

          {match === 'Number List' ? (
            <div className="fld">
              <label>Numbers list (comma separated)</label>
              <input value={list} placeholder="999,112" onChange={(e) => setList(e.target.value)} />
            </div>
          ) : null}

          {match === 'Digit Length' ? (
            <div
              className="fld"
              style={{
                display: 'flex',
                gap: 10,
              }}
            >
              <span
                style={{
                  flex: 1,
                }}
              >
                <label>Min digits</label>
                <input type="number" value={min} onChange={(e) => setMin(e.target.value)} />
              </span>
              <span
                style={{
                  flex: 1,
                }}
              >
                <label>Max digits</label>
                <input type="number" value={max} onChange={(e) => setMax(e.target.value)} />
              </span>
            </div>
          ) : null}

          <div className="fld">
            <label>Classification *</label>
            <select value={cls} onChange={(e) => setCls(e.target.value)}>
              {CLASSIFICATIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>
              Number normalisation (e.g. +44$1 — $1 = first capture group; blank = unchanged)
            </label>
            <input value={norm} onChange={(e) => setNorm(e.target.value)} />
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
              lineHeight: 1.6,
            }}
          >
            A classification with <b>no outbound route</b> serving it acts as a block — the call
            cannot complete.
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            {isNew ? 'Add plan' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- the page */

export default function NumberPlansPage() {
  const db = useDb();
  useTelSite();
  const site = currentTelSite(db);
  if (!site) return null;
  return <NumberPlansView db={db} site={site} />;
}
function NumberPlansView({ db, site }) {
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();

  /** `null` = closed, `''` = create, otherwise the plan id being edited. */
  const [editing, setEditing] = useState(null);
  const [showSim, setShowSim] = useState(false);
  const plans = plansOf(site);
  function movePlan(index, delta) {
    mutate((database) => {
      const target = siteById(database, site.id);
      if (!target) return;
      const targetPlans = plansOf(target);
      const [plan] = targetPlans.splice(index, 1);
      if (plan) targetPlans.splice(index + delta, 0, plan);
    });
    audit('Reorder number plans', site.name);
  }
  function removePlan(id) {
    const plan = plans.find((x) => x.id === id);
    if (!plan) return;
    confirmBox(
      `Delete number plan ${plan.name}? Calls matching it will fall through to later plans.`,
      () => {
        mutate((database) => {
          const target = siteById(database, site.id);
          if (target) target.plans = plansOf(target).filter((x) => x.id !== id);
        });
        audit('Delete number plan', `${site.name} › ${plan.name}`);
        toast('Plan deleted');
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
        title={`Number Plans — ${site.name}`}
        actions={
          <>
            <button className="btn" onClick={() => setEditing('')}>
              + New Number Plan
            </button>
            <button className="btn sec" onClick={() => navigate('/admin/outroute')}>
              Outbound Routes
            </button>
          </>
        }
        tabs={[
          {
            id: 'plans',
            label: 'Plans (evaluated top-down, first match wins)',
          },
        ]}
        activeTab="plans"
      />

      <div className="pbody">
        <div className="tbar">
          <SiteSelector sites={db.sites} current={site.id} />
          <div className="sp"></div>
          <div className="chip" onClick={() => setShowSim(true)}>
            📞 Simulate Call
          </div>
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Order</th>
                <th>Plan</th>
                <th>Match type</th>
                <th>Match spec</th>
                <th>Classification</th>
                <th>Normalisation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan, index) => (
                <tr key={plan.id}>
                  <td
                    style={{
                      width: 64,
                    }}
                  >
                    <b>{index + 1}</b>{' '}
                    {index > 0 ? (
                      <a className="lnk" onClick={() => movePlan(index, -1)}>
                        ▲
                      </a>
                    ) : null}
                    {index < plans.length - 1 ? (
                      <>
                        {' '}
                        <a className="lnk" onClick={() => movePlan(index, 1)}>
                          ▼
                        </a>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <b className="lnk" onClick={() => setEditing(plan.id)}>
                      {plan.name}
                    </b>
                  </td>
                  <td>{plan.match}</td>
                  <td>
                    <MatchSpec plan={plan} />
                  </td>
                  <td>
                    <span className={'tag' + (plan.cls === 'Premium' ? ' o' : '')}>{plan.cls}</span>
                  </td>
                  <td>
                    {plan.norm ? (
                      <code
                        style={{
                          fontSize: 11,
                        }}
                      >
                        {plan.norm}
                      </code>
                    ) : (
                      '—'
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
                      onClick={() => removePlan(plan.id)}
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

      {editing !== null ? (
        <PlanDrawer site={site} planId={editing || null} onClose={() => setEditing(null)} />
      ) : null}
      {showSim ? (
        <SimulateCallDrawer db={db} site={site} onClose={() => setShowSim(false)} />
      ) : null}
    </>
  );
}
