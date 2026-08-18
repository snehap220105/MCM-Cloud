/**
 * Locations — postal addresses used for E911 / emergency routing.
 *
 * Ported from the prototype's `renderLocationsFx`, `editLocFx`, `saveLocFx`,
 * `verifyLoc` and `delLocFx`. Changing the emergency number invalidates the
 * address verification exactly as it did in the original.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
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
function LocationDrawer({ location, onClose }) {
  const { toast, confirmBox } = useUi();
  const isNew = !location;
  const [name, setName] = useState(location?.name ?? '');
  const [addr, setAddr] = useState(location?.addr ?? '');
  const [emerg, setEmerg] = useState(location?.emerg ?? '');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmedName = name.trim();
    const trimmedAddr = addr.trim();
    const em = emerg.trim();
    const found = [];
    if (trimmedName.length < 2) found.push('Name is required.');
    if (trimmedAddr.length < 5) found.push('Street address is required.');
    if (em && !/^\+\d{7,15}$/.test(em)) found.push('Emergency number must be E.164.');
    if (found.length) {
      setErrors(found);
      return;
    }

    // A brand-new record has no stored number yet, so any entered number counts
    // as a change — matching the original's undefined comparison.
    const emChanged = (location ? location.emerg : undefined) !== em;
    mutate((database) => {
      let target = location ? database.locationsList.find((x) => x.id === location.id) : undefined;
      if (!target) {
        target = {
          id: uid(),
          name: '',
          addr: '',
          emerg: '',
          verified: false,
        };
        database.locationsList.push(target);
      }
      target.name = trimmedName;
      target.addr = trimmedAddr;
      target.emerg = em;
      if (emChanged && em) target.verified = false;
    });
    audit((isNew ? 'Create' : 'Edit') + ' location', trimmedName);
    onClose();
    toast('Location saved' + (emChanged && em ? ' — address needs re-verification' : ''));
  }
  function verify() {
    if (!location) return;
    mutate((database) => {
      const target = database.locationsList.find((x) => x.id === location.id);
      if (target) target.verified = true;
    });
    audit('Verify location address', location.name);
    onClose();
    toast(`${location.name} passed postal + emergency verification`);
  }
  function remove() {
    if (!location) return;
    onClose();
    confirmBox(
      `Delete location ${location.name}? Sites referencing it keep working in this demo.`,
      () => {
        mutate((database) => {
          database.locationsList = database.locationsList.filter((x) => x.id !== location.id);
        });
        audit('Delete location', location.name);
        toast('Location deleted');
      }
    );
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? 'Add Location' : `Edit — ${location.name}`}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox errors={errors} />

          <div className="fld">
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Street address *</label>
            <input value={addr} onChange={(e) => setAddr(e.target.value)} />
          </div>

          <div className="sect">Emergency services (E911)</div>

          <div className="fld">
            <label>Emergency callback number (E.164, optional)</label>
            <input value={emerg} onChange={(e) => setEmerg(e.target.value)} />
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
              lineHeight: 1.6,
            }}
          >
            Sites using this location for emergency calls need the address <b>verified</b>. Adding
            an emergency number re-triggers verification.
          </div>

          {isNew ? null : (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 8,
              }}
            >
              <button className="btn sec" onClick={verify}>
                Run address verification
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
export default function LocationsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Directory
          </>
        }
        title="Locations"
        actions={
          <button className="btn" onClick={() => setEditing('new')}>
            + Add Location
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `All Locations (${db.locationsList.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Location</th>
                <th>Address</th>
                <th>Emergency number</th>
                <th>Address status</th>
                <th
                  style={{
                    width: 40,
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {db.locationsList.map((location) => (
                <tr key={location.id} onClick={() => setEditing(location)}>
                  <td>
                    <b className="lnk">{location.name}</b>
                  </td>
                  <td>{location.addr}</td>
                  <td>{location.emerg || '—'}</td>
                  <td>
                    {location.verified ? (
                      <span className="st ok">
                        <span className="d" />
                        Verified
                      </span>
                    ) : (
                      <span className="st wn">
                        <span className="d" />
                        Not verified
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
        <LocationDrawer
          location={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
