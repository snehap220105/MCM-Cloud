/**
 * Schedules — the schedule groups that flows branch on.
 *
 * Ported from the prototype's `renderSchedules` / `editSched` / `saveSched` /
 * `togSched` / `delSched`. A group bundles open hours and holidays; an Evaluate
 * Schedule action in a flow reads the group's current state to pick its
 * Open / Closed branch, and the toggle here simulates that state for Test Calls.
 */
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
/**
 * The seed stores `holidays` as a comma-separated string while the shared type
 * declares a list, so read and write it through these two helpers rather than
 * assuming one shape. Splitting and re-joining round-trips the original text.
 */
function holidayText(group) {
  const raw = group.holidays;
  if (Array.isArray(raw)) return raw.join(', ');
  return raw == null ? '' : String(raw);
}
function holidayList(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/,\s*/) : [];
}

/* ------------------------------------------------------ schedule group form */

function SchedGroupDrawer({ group, onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const isNew = !group;
  const [name, setName] = useState(group?.name ?? '');
  const [open, setOpen] = useState(group?.open ?? 'Mon–Fri 09:00–17:00');
  const [holidays, setHolidays] = useState(group ? holidayText(group) : '');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    const id = group?.id ?? '';
    if (
      trimmed.length < 2 ||
      db.schedGroups.some((x) => x.name.toLowerCase() === trimmed.toLowerCase() && x.id !== id)
    ) {
      setErrors(['A unique name is required.']);
      return;
    }
    mutate((database) => {
      let target = id ? database.schedGroups.filter((x) => x.id === id)[0] : undefined;
      if (!target) {
        target = {
          id: uid(),
          name: '',
          open: '',
          holidays: [],
          state: 'Open',
        };
        database.schedGroups.push(target);
      }
      target.name = trimmed;
      target.open = open.trim();
      target.holidays = holidayList(holidays);
    });
    audit((isNew ? 'Create' : 'Edit') + ' schedule group', trimmed);
    onClose();
    toast('Schedule group saved');
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
          <h2>{isNew ? 'New' : 'Edit'} Schedule Group</h2>
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
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Open hours</label>
            <input value={open} onChange={(e) => setOpen(e.target.value)} />
          </div>

          <div className="fld">
            <label>Holidays</label>
            <input value={holidays} onChange={(e) => setHolidays(e.target.value)} />
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

/* --------------------------------------------------------------- the page */

export default function SchedulesPage() {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  /** `null` = drawer closed, `undefined` inside = creating a new group. */
  const [editing, setEditing] = useState(null);
  function togSched(id) {
    const group = db.schedGroups.filter((x) => x.id === id)[0];
    if (!group) return;
    const next = group.state === 'Open' ? 'Closed' : 'Open';
    mutate((database) => {
      const target = database.schedGroups.filter((x) => x.id === id)[0];
      if (target) target.state = next;
    });
    audit('Toggle schedule', group.name + ' → ' + next);
  }
  function delSched(id) {
    const group = db.schedGroups.filter((x) => x.id === id)[0];
    if (!group) return;
    const used = db.flows.filter((f) => f.sched === id);
    if (used.length) {
      toast('Cannot delete — used by flow ' + used[0].name);
      return;
    }
    confirmBox(`Delete schedule group ${group.name}?`, () => {
      mutate((database) => {
        database.schedGroups = database.schedGroups.filter((x) => x.id !== id);
      });
      audit('Delete schedule group', group.name);
      toast('Deleted');
    });
  }
  return (
    <>
      <PageHeader
        breadcrumb="Admin › Contact Center"
        title="Schedules"
        actions={
          <button
            className="btn"
            onClick={() =>
              setEditing({
                group: undefined,
              })
            }
          >
            + Schedule Group
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `Schedule Groups (${db.schedGroups.length})`,
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
          Schedule groups bundle open hours and holidays; flows evaluate them to branch Open/Closed.
          The toggle simulates the current state for flow Test Calls.
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Group</th>
                <th>Open hours</th>
                <th>Holidays</th>
                <th>Current state</th>
                <th>Used by flows</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.schedGroups.map((group) => {
                const flows = db.flows.filter((f) => f.sched === group.id);
                return (
                  <tr key={group.id}>
                    <td>
                      <b
                        className="lnk"
                        onClick={() =>
                          setEditing({
                            group,
                          })
                        }
                      >
                        {group.name}
                      </b>
                    </td>
                    <td>{group.open}</td>
                    <td>{holidayText(group) || '—'}</td>
                    <td>
                      {group.state === 'Open' ? (
                        <span className="st ok">
                          <span className="d" />
                          Open now
                        </span>
                      ) : (
                        <span className="st wn">
                          <span className="d" />
                          Closed now
                        </span>
                      )}{' '}
                      <a
                        className="lnk"
                        style={{
                          fontSize: 11,
                        }}
                        onClick={() => togSched(group.id)}
                      >
                        (toggle)
                      </a>
                    </td>
                    <td>
                      {flows.length
                        ? flows.map((f, i) => (
                            <span key={f.id}>
                              {i ? ' ' : ''}
                              <span className="tag">{f.name}</span>
                            </span>
                          ))
                        : '—'}
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
                        onClick={() => delSched(group.id)}
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

      {editing ? <SchedGroupDrawer group={editing.group} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
