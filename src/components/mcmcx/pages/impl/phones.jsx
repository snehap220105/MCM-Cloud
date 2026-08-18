/**
 * Phone Management — WebRTC and hardware stations.
 *
 * Ported from the prototype's `renderPhonesFx`, `editPhoneFx`, `savePhoneFx`,
 * `provPhone` and `delPhoneFx`. Provisioning is the same one-click simulation:
 * the phone "pulls its configuration" and moves to In service.
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
function PhoneDrawer({ phone, onClose }) {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  const isNew = !phone;
  const [name, setName] = useState(phone?.name ?? '');
  const [base, setBase] = useState(phone?.base ?? db.baseSettings[0]?.id ?? '');
  const [site, setSite] = useState(phone?.site ?? db.sites[0]?.id ?? '');
  const [user, setUser] = useState(phone?.user ?? '');
  const [mac, setMac] = useState(phone?.mac ?? '');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    const cleanMac = mac.trim().replace(/[:-]/g, '');
    const found = [];
    if (trimmed.length < 2) found.push('Phone name is required.');
    if (db.phones.some((x) => x.name.toLowerCase() === trimmed.toLowerCase() && x.id !== phone?.id))
      found.push('Phone name already exists.');
    if (cleanMac && !/^[0-9a-fA-F]{12}$/.test(cleanMac))
      found.push('MAC must be 12 hex characters (no colons).');
    if (found.length) {
      setErrors(found);
      return;
    }
    mutate((database) => {
      let target = phone ? database.phones.find((x) => x.id === phone.id) : undefined;
      if (!target) {
        target = {
          id: uid(),
          name: '',
          base: '',
          site: '',
          user: '',
          mac: '',
          status: 'Not registered',
        };
        database.phones.push(target);
      }
      target.name = trimmed;
      target.base = base;
      target.site = site;
      target.user = user;
      target.mac = cleanMac;
    });
    audit((isNew ? 'Create' : 'Edit') + ' phone', trimmed);
    onClose();
    toast('Phone saved' + (isNew ? ' — provision it to bring it in service' : ''));
  }
  function provision() {
    if (!phone) return;
    mutate((database) => {
      const target = database.phones.find((x) => x.id === phone.id);
      if (target) target.status = 'In service';
    });
    audit('Provision phone', phone.name);
    onClose();
    toast(`${phone.name} pulled its configuration and registered — In service`);
  }
  function remove() {
    if (!phone) return;
    onClose();
    confirmBox(`Delete phone ${phone.name}?`, () => {
      mutate((database) => {
        database.phones = database.phones.filter((x) => x.id !== phone.id);
      });
      audit('Delete phone', phone.name);
      toast('Phone deleted');
    });
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? 'Add Phone' : `Edit — ${phone.name}`}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox errors={errors} />

          <div className="fld">
            <label>Phone name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Base settings</label>
            <select value={base} onChange={(e) => setBase(e.target.value)}>
              {db.baseSettings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Site</label>
            <select value={site} onChange={(e) => setSite(e.target.value)}>
              {db.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Assign to person</label>
            <select value={user} onChange={(e) => setUser(e.target.value)}>
              <option value="">Unassigned</option>
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Hardware ID / MAC (blank for WebRTC)</label>
            <input
              value={mac}
              placeholder="0004f2aabbcc"
              onChange={(e) => setMac(e.target.value)}
            />
          </div>

          {isNew ? null : (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 8,
              }}
            >
              <button className="btn sec" onClick={provision}>
                {phone.status === 'In service' ? 'Reboot / reprovision' : 'Provision now'}
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
export default function PhonesPage() {
  const db = useDb();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Telephony
          </>
        }
        title="Phone Management"
        actions={
          <>
            <button className="btn" onClick={() => setEditing('new')}>
              + Add Phone
            </button>
            <button className="btn sec" onClick={() => navigate('/admin/basesets')}>
              Base Settings
            </button>
          </>
        }
        tabs={[
          {
            id: 'phones',
            label: `Phones (${db.phones.length})`,
          },
        ]}
        activeTab="phones"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Model</th>
                <th>Site</th>
                <th>Assigned to</th>
                <th>MAC</th>
                <th>Status</th>
                <th
                  style={{
                    width: 40,
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {db.phones.map((phone) => {
                const base = db.baseSettings.find((x) => x.id === phone.base);
                const site = db.sites.find((x) => x.id === phone.site);
                const user = db.users.find((x) => x.id === phone.user);
                return (
                  <tr key={phone.id} onClick={() => setEditing(phone)}>
                    <td>
                      <b className="lnk">{phone.name}</b>
                    </td>
                    <td>{base ? base.model : '—'}</td>
                    <td>{site ? site.name : '—'}</td>
                    <td>{user ? user.name : '—'}</td>
                    <td>{phone.mac || '—'}</td>
                    <td>
                      {phone.status === 'In service' ? (
                        <span className="st ok">
                          <span className="d" />
                          In service
                        </span>
                      ) : (
                        <span className="st wn">
                          <span className="d" />
                          {phone.status}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <PhoneDrawer phone={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
