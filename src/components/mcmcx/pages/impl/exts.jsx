/**
 * Telephony › Extensions.
 *
 * Extension pools reserve blocks of internal numbers; individual extensions are
 * then handed out to users. An extension must fall inside a pool and must be
 * unique across the organisation.
 *
 * Ported from the prototype's `renderExts`, `addExtPool` / `saveExtPool` /
 * `delExtPool` and `assignExt` / `saveExtAssign` / `dropExt`.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { ErrorBox } from './_telephonyUi';

/** Extensions are compared as strings, as they were in the original. */
function usedInPool(db, pool) {
  return db.users.filter((u) => u.ext && u.ext >= pool.start && u.ext <= pool.end).length;
}

/* ---------------------------------------------------------------- add a pool */

function AddPoolDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [errors, setErrors] = useState([]);
  function save() {
    const s = start.trim();
    const e = end.trim();
    const errs = [];
    if (!/^\d{3,6}$/.test(s) || !/^\d{3,6}$/.test(e)) errs.push('Extensions are 3–6 digits.');
    else if (s.length !== e.length || Number(e) < Number(s))
      errs.push('End must be ≥ start and the same length.');
    else if (
      db.extPools.some(
        (p) =>
          !(Number(e) < Number(p.start) || Number(s) > Number(p.end)) && s.length === p.start.length
      )
    )
      errs.push('Pool overlaps an existing pool.');
    if (errs.length) {
      setErrors(errs);
      return;
    }
    mutate((database) => {
      database.extPools.push({
        id: uid(),
        start: s,
        end: e,
      });
    });
    audit('Add extension pool', `${s} – ${e}`);
    onClose();
    toast('Extension pool added');
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
          <h2>Add Extension Pool</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="fld">
            <label>Start *</label>
            <input value={start} placeholder="8000" onChange={(e) => setStart(e.target.value)} />
          </div>

          <div className="fld">
            <label>End *</label>
            <input value={end} placeholder="8999" onChange={(e) => setEnd(e.target.value)} />
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

/* ------------------------------------------------------- assign an extension */

function AssignExtensionDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const available = db.users.filter((u) => !u.ext);
  const [userId, setUserId] = useState(available[0]?.id ?? '');
  const [ext, setExt] = useState('');
  const [errors, setErrors] = useState([]);
  function save() {
    const n = ext.trim();
    const errs = [];
    if (!userId) errs.push('Pick a user.');
    if (!db.extPools.some((p) => n.length === p.start.length && n >= p.start && n <= p.end))
      errs.push('Extension is not inside any pool.');
    if (db.users.some((u) => u.ext === n))
      errs.push('Extension already assigned — extensions must be unique.');
    if (errs.length) {
      setErrors(errs);
      return;
    }
    const user = db.users.find((x) => x.id === userId);
    if (!user) return;
    mutate((database) => {
      const target = database.users.find((x) => x.id === userId);
      if (target) target.ext = n;
    });
    audit('Assign extension', `${n} → ${user.name}`);
    onClose();
    toast(`Extension ${n} assigned to ${user.name}`);
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
          <h2>Assign Extension</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="fld">
            <label>User</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              {available.length ? (
                available.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))
              ) : (
                <option value="">Everyone already has an extension</option>
              )}
            </select>
          </div>

          <div className="fld">
            <label>Extension *</label>
            <input value={ext} placeholder="7101" onChange={(e) => setExt(e.target.value)} />
          </div>
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

export default function ExtensionsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const [drawer, setDrawer] = useState(null);
  const assigned = db.users.filter((u) => u.ext);
  function removePool(id) {
    const pool = db.extPools.find((x) => x.id === id);
    if (!pool) return;
    const used = usedInPool(db, pool);
    if (used) {
      toast(`Cannot delete — ${used} extension(s) from this pool are assigned`);
      return;
    }
    confirmBox(`Delete pool ${pool.start} – ${pool.end}?`, () => {
      mutate((database) => {
        database.extPools = database.extPools.filter((x) => x.id !== id);
      });
      audit('Delete extension pool', `${pool.start} – ${pool.end}`);
      toast('Pool deleted');
    });
  }
  function dropExt(id) {
    const user = db.users.find((x) => x.id === id);
    if (!user) return;
    audit('Unassign extension', `${user.ext} from ${user.name}`);
    mutate((database) => {
      const target = database.users.find((x) => x.id === id);
      if (target) target.ext = '';
    });
    toast('Extension unassigned');
  }
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Telephony
          </>
        }
        title="Extensions"
        actions={
          <>
            <button className="btn" onClick={() => setDrawer('pool')}>
              + Add Pool
            </button>
            <button className="btn sec" onClick={() => setDrawer('assign')}>
              + Assign Extension
            </button>
          </>
        }
        tabs={[
          {
            id: 'pools',
            label: `Extension Pools (${db.extPools.length})`,
          },
        ]}
        activeTab="pools"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Pool</th>
                <th>Size</th>
                <th>Assigned</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {db.extPools.map((pool) => (
                <tr key={pool.id}>
                  <td>
                    <b>{pool.start}</b> — <b>{pool.end}</b>
                  </td>
                  <td>{Number(pool.end) - Number(pool.start) + 1}</td>
                  <td>{usedInPool(db, pool)}</td>
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
                      onClick={() => removePool(pool.id)}
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
          Assignments
        </h1>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Extension</th>
                <th>User</th>
                <th>Title</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assigned.length ? (
                assigned.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <b>{user.ext}</b>
                    </td>
                    <td>{user.name}</td>
                    <td>{user.title || ''}</td>
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
                        onClick={() => dropExt(user.id)}
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
                    No extensions assigned yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drawer === 'pool' ? <AddPoolDrawer onClose={() => setDrawer(null)} /> : null}
      {drawer === 'assign' ? <AssignExtensionDrawer onClose={() => setDrawer(null)} /> : null}
    </>
  );
}
