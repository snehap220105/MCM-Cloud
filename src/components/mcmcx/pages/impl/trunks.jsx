/**
 * Telephony › Trunks.
 *
 * SIP trunk configuration: type, transport, proxy list, negotiated codecs,
 * calling party number and the edge group the trunk is homed on. A trunk that
 * is not In-Service is skipped by outbound route selection.
 *
 * Ported from the prototype's `renderTrunks` / `editTrunk` / `saveTrunk` /
 * `delTrunk`.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { groupName, routesOf, trunkById } from './_telephony';
import { ErrorBox, StatusPill } from './_telephonyUi';
const TRUNK_TYPES = [
  'BYOC Carrier',
  'BYOC PBX',
  'Premises External SIP',
  'Phone Trunk',
  'WebRTC Trunk',
];
const TRANSPORTS = ['UDP', 'TCP', 'TLS', 'DTLS-SRTP'];
const CODECS = ['Opus', 'PCMU', 'PCMA', 'G722', 'G729'];

/* ------------------------------------------------------------- trunk drawer */

function TrunkDrawer({ trunkId, onClose }) {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  const existing = trunkId ? trunkById(db, trunkId) : undefined;
  const isNew = !existing;
  const base = existing ?? {
    id: '',
    name: '',
    type: 'BYOC Carrier',
    transport: 'TLS',
    servers: '',
    codecs: ['Opus', 'PCMU'],
    callerId: '',
    group: db.edgeGroups[0]?.id ?? '',
    state: 'In-Service',
    status: 'up',
  };
  const [name, setName] = useState(base.name);
  const [type, setType] = useState(base.type);
  const [transport, setTransport] = useState(base.transport);
  const [servers, setServers] = useState(base.servers);
  const [codecs, setCodecs] = useState([...base.codecs]);
  const [callerId, setCallerId] = useState(base.callerId);
  const [group, setGroup] = useState(base.group);
  const [inService, setInService] = useState(base.state === 'In-Service');
  const [errors, setErrors] = useState([]);
  function toggleCodec(codec, on) {
    /* Kept in the canonical preference order, matching the checkbox order. */
    setCodecs((current) =>
      on
        ? CODECS.filter((c) => c === codec || current.indexOf(c) > -1)
        : current.filter((c) => c !== codec)
    );
  }
  function save() {
    const trimmed = name.trim();
    const cid = callerId.trim();
    const errs = [];
    if (trimmed.length < 2) errs.push('Trunk name is required.');
    if (db.trunks.some((x) => x.name.toLowerCase() === trimmed.toLowerCase() && x.id !== trunkId))
      errs.push('A trunk with this name already exists.');
    if (!codecs.length) errs.push('Select at least one codec.');
    if (cid && !/^\+\d{7,15}$/.test(cid))
      errs.push('Caller ID must be E.164 (e.g. +442071234100).');
    if (errs.length) {
      setErrors(errs);
      return;
    }
    mutate((database) => {
      let trunk = trunkId ? database.trunks.find((x) => x.id === trunkId) : undefined;
      if (!trunk) {
        trunk = {
          id: uid(),
          name: '',
          type: '',
          transport: '',
          servers: '',
          codecs: [],
          callerId: '',
          group: '',
          state: 'In-Service',
          status: 'up',
        };
        database.trunks.push(trunk);
      }
      trunk.name = trimmed;
      trunk.type = type;
      trunk.transport = transport;
      trunk.servers = servers.trim() || '—';
      trunk.codecs = codecs;
      trunk.callerId = cid;
      trunk.group = group;
      trunk.state = inService ? 'In-Service' : 'Disabled';
    });
    audit(isNew ? 'Create trunk' : 'Edit trunk', `${trimmed} (${type})`);
    onClose();
    toast((isNew ? 'Trunk created — ' : 'Trunk saved — ') + trimmed);
  }
  function remove() {
    if (!existing) return;
    const used = [];
    db.sites.forEach((site) => {
      routesOf(site).forEach((route) => {
        if (route.trunks.indexOf(existing.id) > -1) used.push(`${site.name} › ${route.name}`);
      });
    });
    confirmBox(
      `Delete trunk ${existing.name}?` +
        (used.length
          ? ` It is used by: ${used.join(', ')} — it will be removed from those routes.`
          : ''),
      () => {
        mutate((database) => {
          database.trunks = database.trunks.filter((x) => x.id !== existing.id);
          database.sites.forEach((site) => {
            routesOf(site).forEach((route) => {
              route.trunks = route.trunks.filter((x) => x !== existing.id);
            });
          });
        });
        audit('Delete trunk', existing.name);
        toast('Trunk deleted');
      }
    );
    onClose();
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? 'Create Trunk' : `Edit — ${base.name}`}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="sect">Trunk</div>

          <div className="fld">
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TRUNK_TYPES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Transport</label>
            <select value={transport} onChange={(e) => setTransport(e.target.value)}>
              {TRANSPORTS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>SIP servers / proxies (comma separated, priority order)</label>
            <input value={servers} onChange={(e) => setServers(e.target.value)} />
          </div>

          <div className="sect">Media &amp; identity</div>

          <div className="fld">
            <label>Codecs (preference order as listed)</label>
            <div>
              {CODECS.map((codec) => (
                <label
                  key={codec}
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
                    checked={codecs.indexOf(codec) > -1}
                    onChange={(e) => toggleCodec(codec, e.target.checked)}
                    style={{
                      width: 'auto',
                    }}
                  />
                  {codec}
                </label>
              ))}
            </div>
          </div>

          <div className="fld">
            <label>Calling party number (caller ID)</label>
            <input
              value={callerId}
              placeholder="+44..."
              onChange={(e) => setCallerId(e.target.value)}
            />
          </div>

          <div className="fld">
            <label>Edge group</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {db.edgeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sect">State</div>

          <div className="tgl">
            <input
              type="checkbox"
              checked={inService}
              onChange={(e) => setInService(e.target.checked)}
              style={{
                width: 'auto',
                marginRight: 4,
              }}
            />
            In-Service (uncheck to disable the trunk)
          </div>

          {isNew ? null : (
            <div
              style={{
                marginTop: 10,
              }}
            >
              <button className="btn gh" onClick={remove}>
                Delete trunk
              </button>
            </div>
          )}
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            {isNew ? 'Create trunk' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- the page */

export default function TrunksPage() {
  const db = useDb();
  const navigate = useNavigate();
  /** `null` = closed, `''` = create, otherwise the trunk id being edited. */
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Telephony
          </>
        }
        title="Trunks"
        actions={
          <button className="btn" onClick={() => setEditing('')}>
            + Create Trunk
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `All Trunks (${db.trunks.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Trunk</th>
                <th>Type</th>
                <th>Transport</th>
                <th>SIP servers</th>
                <th>Codecs</th>
                <th>Edge group</th>
                <th>Status</th>
                <th
                  style={{
                    width: 40,
                  }}
                ></th>
              </tr>
            </thead>
            <tbody>
              {db.trunks.map((trunk) => (
                <tr key={trunk.id} onClick={() => setEditing(trunk.id)}>
                  <td>
                    <b className="lnk">{trunk.name}</b>
                  </td>
                  <td>{trunk.type}</td>
                  <td>{trunk.transport}</td>
                  <td
                    style={{
                      maxWidth: 190,
                    }}
                  >
                    {trunk.servers}
                  </td>
                  <td>{trunk.codecs.join(', ')}</td>
                  <td>{groupName(db, trunk.group)}</td>
                  <td>
                    {trunk.state === 'In-Service' ? (
                      <StatusPill status={trunk.status} />
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

      {editing !== null ? (
        <TrunkDrawer trunkId={editing || null} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
