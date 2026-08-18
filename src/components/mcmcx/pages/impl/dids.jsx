/**
 * Telephony › DID Numbers.
 *
 * Two related tables: the E.164 ranges bought from a service provider, and the
 * individual numbers assigned out of those ranges to a person, a call flow or a
 * phone. A number can only be assigned if it falls inside a defined range.
 *
 * Ported from the prototype's `renderDids`, `addDidRange` / `saveDidRange` /
 * `delDidRange` and `addDidAssign` / `saveDidAssign` / `delDidAssign`.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { ErrorBox } from './_telephonyUi';
const COUNTRIES = ['United Kingdom', 'India', 'United States', 'Singapore', 'UAE'];
const ASSIGN_TYPES = ['Person', 'Call Flow', 'Phone'];

/** True when the number falls inside one of the configured DID ranges. */
function numInRanges(db, num) {
  const n = num.replace(/[^\d+]/g, '');
  return db.didRanges.some((r) => {
    if (n.length !== r.start.length) return false;
    return n >= r.start && n <= r.end;
  });
}

/* -------------------------------------------------------------- add a range */

function AddRangeDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [provider, setProvider] = useState('');
  const [errors, setErrors] = useState([]);
  function save() {
    const s = start.trim();
    const e = end.trim();
    const errs = [];
    if (!/^\+\d{7,15}$/.test(s) || !/^\+\d{7,15}$/.test(e)) {
      errs.push('Start and end must be E.164 numbers (e.g. +442071235000).');
    } else {
      if (s.length !== e.length || e < s) errs.push('End must be ≥ start and the same length.');
      else if (Number(e.slice(1)) - Number(s.slice(1)) > 100000)
        errs.push('Range exceeds 100,000 numbers.');
      const overlap = db.didRanges.some(
        (r) => s.length === r.start.length && !(e < r.start || s > r.end)
      );
      if (overlap) errs.push('Range overlaps an existing range.');
    }
    if (errs.length) {
      setErrors(errs);
      return;
    }
    mutate((database) => {
      database.didRanges.push({
        id: uid(),
        country,
        start: s,
        end: e,
        provider: provider.trim() || '—',
      });
    });
    audit('Add DID range', `${s} – ${e}`);
    onClose();
    toast('DID range added');
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
          <h2>Add DID Range</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="fld">
            <label>Country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>DID start (E.164) *</label>
            <input
              value={start}
              placeholder="+442071235000"
              onChange={(e) => setStart(e.target.value)}
            />
          </div>

          <div className="fld">
            <label>DID end (E.164) *</label>
            <input
              value={end}
              placeholder="+442071235099"
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>

          <div className="fld">
            <label>Service provider</label>
            <input
              value={provider}
              placeholder="Carrier name"
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
            }}
          >
            Enter the same value in start and end for a single number. Max 100,000 numbers per
            range; ranges cannot overlap.
          </div>
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

/* ------------------------------------------------------------ assign a number */

function AssignNumberDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const flowOptions = (db.queues ?? []).map((q) => `Flow: ${q.name}_IVR`);
  const [num, setNum] = useState('');
  const [type, setType] = useState(ASSIGN_TYPES[0]);
  const [person, setPerson] = useState(db.users[0]?.name ?? '');
  const [flow, setFlow] = useState(flowOptions[0] ?? 'Main_IVR');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState([]);
  function save() {
    const n = num.trim();
    const errs = [];
    if (!/^\+\d{7,15}$/.test(n)) errs.push('Enter an E.164 number.');
    else if (!numInRanges(db, n))
      errs.push('Number is not inside any defined DID range — add the range first.');
    if (db.didAssign.some((a) => a.num === n))
      errs.push('Number is already assigned — unassign it first.');
    if (errs.length) {
      setErrors(errs);
      return;
    }
    let target = '';
    if (type === 'Person') target = person;
    if (type === 'Call Flow') target = flow;
    if (type === 'Phone') target = phone.trim() || 'Unnamed phone';
    mutate((database) => {
      database.didAssign.push({
        id: uid(),
        num: n,
        type,
        target,
      });
    });
    audit('Assign DID', `${n} → ${type}: ${target}`);
    onClose();
    toast(`${n} assigned to ${target}`);
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          height: 'auto',
          top: '20%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>Assign DID Number</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="fld">
            <label>Number (must fall inside a defined range) *</label>
            <input
              value={num}
              placeholder="+442071234120"
              onChange={(e) => setNum(e.target.value)}
            />
          </div>

          <div className="fld">
            <label>Assign to</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {ASSIGN_TYPES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          {type === 'Person' ? (
            <div className="fld">
              <label>Person</label>
              <select value={person} onChange={(e) => setPerson(e.target.value)}>
                {db.users.map((u) => (
                  <option key={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {type === 'Call Flow' ? (
            <div className="fld">
              <label>Call flow</label>
              <select value={flow} onChange={(e) => setFlow(e.target.value)}>
                {flowOptions.length ? (
                  flowOptions.map((option) => <option key={option}>{option}</option>)
                ) : (
                  <option>Main_IVR</option>
                )}
              </select>
            </div>
          ) : null}

          {type === 'Phone' ? (
            <div className="fld">
              <label>Phone</label>
              <input
                value={phone}
                placeholder="Phone name / line key"
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Assign
          </button>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- the page */

export default function DidsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const [drawer, setDrawer] = useState(null);
  function removeRange(id) {
    const range = db.didRanges.find((x) => x.id === id);
    if (!range) return;
    const assigned = db.didAssign.filter(
      (a) => a.num.length === range.start.length && a.num >= range.start && a.num <= range.end
    ).length;
    if (assigned) {
      toast(`Cannot delete — ${assigned} number(s) in this range are still assigned`);
      return;
    }
    confirmBox(`Delete range ${range.start} – ${range.end}?`, () => {
      mutate((database) => {
        database.didRanges = database.didRanges.filter((x) => x.id !== id);
      });
      audit('Delete DID range', `${range.start} – ${range.end}`);
      toast('Range deleted');
    });
  }
  function unassign(id) {
    const assignment = db.didAssign.find((x) => x.id === id);
    if (!assignment) return;
    mutate((database) => {
      database.didAssign = database.didAssign.filter((x) => x.id !== id);
    });
    audit('Unassign DID', assignment.num);
    toast(`${assignment.num} unassigned`);
  }
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Telephony
          </>
        }
        title="DID Numbers"
        actions={
          <>
            <button className="btn" onClick={() => setDrawer('range')}>
              + Add Range
            </button>
            <button className="btn sec" onClick={() => setDrawer('assign')}>
              + Assign Number
            </button>
          </>
        }
        tabs={[
          {
            id: 'ranges',
            label: `DID Ranges (${db.didRanges.length})`,
          },
        ]}
        activeTab="ranges"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Range</th>
                <th>Country</th>
                <th>Service provider</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {db.didRanges.map((range) => (
                <tr key={range.id}>
                  <td>
                    <b>{range.start}</b> — <b>{range.end}</b>
                  </td>
                  <td>{range.country}</td>
                  <td>{range.provider}</td>
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
                      onClick={() => removeRange(range.id)}
                    >
                      Delete
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h1
          style={{
            fontSize: 16,
            margin: '18px 0 8px',
          }}
        >
          Assignments ({db.didAssign.length})
        </h1>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Number</th>
                <th>Assigned to</th>
                <th>Target</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {db.didAssign.length ? (
                db.didAssign.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <b>{assignment.num}</b>
                    </td>
                    <td>
                      <span className={'tag' + (assignment.type === 'Call Flow' ? ' o' : '')}>
                        {assignment.type}
                      </span>
                    </td>
                    <td>{assignment.target}</td>
                    <td
                      style={{
                        width: 80,
                      }}
                    >
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                        }}
                        onClick={() => unassign(assignment.id)}
                      >
                        Unassign
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      color: '#8794a8',
                      padding: 20,
                    }}
                  >
                    No assignments yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drawer === 'range' ? <AddRangeDrawer onClose={() => setDrawer(null)} /> : null}
      {drawer === 'assign' ? <AssignNumberDrawer onClose={() => setDrawer(null)} /> : null}
    </>
  );
}
