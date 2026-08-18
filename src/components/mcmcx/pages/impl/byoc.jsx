/**
 * Carrier Connections (BYOC) — Bring Your Own Carrier.
 *
 * Tenants route inbound and outbound calls over their own SIP carrier or their
 * own Twilio account, while MCM Cloud CX provides IVR, ACD, agents and
 * analytics. The MCM platform Twilio carrier is a locked, guaranteed fallback.
 *
 * Ported from the prototype's `renderByocFx` engine. The provisioning and SIP
 * OPTIONS calls are simulated here exactly as they were in the original — they
 * mirror the shape of the real `byoc` edge function and `tenant_trunks` table
 * but do not talk to Twilio.
 */
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
const KIND_LABEL = {
  platform: 'Platform (Twilio)',
  sip: 'SIP trunk',
  twilio: 'BYO Twilio',
};

/**
 * Carrier selection, mirroring the `byoc` edge function: active carriers whose
 * direction matches, ordered by priority, with the platform carrier always last
 * so it acts as the guaranteed fallback.
 */
export function byocRoute(direction, trunks) {
  const eligible = trunks
    .filter((t) => t.status === 'Active' && (t.direction === 'both' || t.direction === direction))
    .sort((a, b) => a.priority - b.priority);
  const platform = eligible.filter((t) => t.kind === 'platform');
  const customer = eligible.filter((t) => t.kind !== 'platform');
  return [...customer, ...platform];
}
function StatusBadge({ status }) {
  const colour =
    status === 'Active' ? '#0a7d4f' : status === 'Pending test' ? '#a8700a' : '#b3261e';
  const background =
    status === 'Active' ? '#e3f5ec' : status === 'Pending test' ? '#fdf3df' : '#fdeceb';
  return (
    <span
      style={{
        background,
        color: colour,
        padding: '2px 9px',
        borderRadius: 10,
        fontSize: 11.5,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}
function authLabel(trunk) {
  const auth = trunk.auth ?? {
    type: 'platform',
  };
  if (auth.type === 'acl') return `IP ACL ${auth.acl ?? ''}`;
  if (auth.type === 'cred') return `Credentials (${auth.user ?? ''})`;
  if (auth.type === 'twilio') return 'API key';
  return 'Managed';
}

/* ------------------------------------------------------------ result panel */

function InfoPanel({ tone, children }) {
  if (tone === 'muted')
    return (
      <div
        style={{
          fontSize: 12.5,
          color: '#6b7686',
        }}
      >
        {children}
      </div>
    );
  const style =
    tone === 'ok'
      ? {
          background: '#e3f5ec',
          border: '1px solid #bfe6d2',
          color: '#0a5c3c',
        }
      : {
          background: '#fbfcfe',
          border: '1px solid #e3e8f0',
          color: '#33415c',
        };
  return (
    <div
      style={{
        ...style,
        borderRadius: 8,
        padding: '12px 16px',
        fontSize: 12.5,
      }}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------- add-carrier form */

function AddCarrierDrawer({ onClose }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('sip');
  const [direction, setDirection] = useState('both');
  const [term, setTerm] = useState('');
  const [authType, setAuthType] = useState('acl');
  const [acl, setAcl] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [codecs, setCodecs] = useState({
    PCMU: true,
    PCMA: true,
    OPUS: false,
  });
  const [priority, setPriority] = useState(50);
  const [error, setError] = useState('');
  function create() {
    if (!name.trim()) {
      setError('Carrier name is required.');
      return;
    }
    if (kind === 'sip' && direction !== 'inbound' && !term.trim()) {
      setError('Termination URI is required for outbound SIP.');
      return;
    }
    const auth =
      kind === 'twilio'
        ? {
            type: 'twilio',
          }
        : authType === 'cred'
          ? {
              type: 'cred',
              user,
            }
          : {
              type: 'acl',
              acl: acl || '0.0.0.0/0',
            };
    const selectedCodecs =
      kind === 'sip' ? Object.keys(codecs).filter((c) => codecs[c]) : ['PCMU', 'PCMA', 'OPUS'];
    mutate((db) => {
      db.byocTrunks.push({
        id: uid('tk'),
        name: name.trim(),
        kind,
        direction,
        term: term.trim(),
        auth,
        codecs: selectedCodecs,
        priority: Math.max(1, Math.min(99, priority || 50)),
        status: 'Pending test',
        byocSid: '',
        policySid: '',
        locked: false,
        note:
          kind === 'twilio'
            ? "Customer's own Twilio account (tenants.twilio)."
            : 'Customer SIP carrier.',
      });
    });
    audit('Create', `BYOC carrier ${name} (${kind}, ${direction})`);
    onClose();
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 430,
        }}
      >
        <div className="dh">
          <h2>Add carrier</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div
            style={{
              fontSize: 12,
              color: '#6b7686',
              marginBottom: 16,
            }}
          >
            Connect your own carrier for inbound and outbound.
          </div>

          <div className="fld">
            <label>Carrier name</label>
            <input
              value={name}
              placeholder="e.g. AcePeak Wholesale"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="fld">
            <label>Kind</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="sip">SIP trunk (my carrier)</option>
              <option value="twilio">BYO Twilio account</option>
            </select>
          </div>

          <div className="fld">
            <label>Direction</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="both">Inbound + Outbound</option>
              <option value="inbound">Inbound only</option>
              <option value="outbound">Outbound only</option>
            </select>
          </div>

          {kind === 'sip' ? (
            <>
              <div className="fld">
                <label>Termination URI (outbound)</label>
                <input
                  value={term}
                  placeholder="sip.carrier.example.com or 203.0.113.10:5060"
                  onChange={(e) => setTerm(e.target.value)}
                />
              </div>

              <div className="fld">
                <label>Authentication</label>
                <select value={authType} onChange={(e) => setAuthType(e.target.value)}>
                  <option value="acl">IP ACL</option>
                  <option value="cred">Credentials</option>
                </select>
              </div>

              {authType === 'acl' ? (
                <div className="fld">
                  <label>Allowed IP range</label>
                  <input
                    value={acl}
                    placeholder="203.0.113.0/28"
                    onChange={(e) => setAcl(e.target.value)}
                  />
                </div>
              ) : (
                <div className="fld">
                  <label>Username</label>
                  <input
                    value={user}
                    placeholder="trunk user"
                    onChange={(e) => setUser(e.target.value)}
                  />
                  <label
                    style={{
                      marginTop: 8,
                    }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    placeholder="••••••"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}

              <div className="fld">
                <label>Codecs</label>
                <div
                  style={{
                    fontSize: 12.5,
                  }}
                >
                  {Object.keys(codecs).map((codec) => (
                    <label
                      key={codec}
                      style={{
                        marginRight: 12,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={codecs[codec]}
                        onChange={(e) =>
                          setCodecs((current) => ({
                            ...current,
                            [codec]: e.target.checked,
                          }))
                        }
                      />{' '}
                      {codec}
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div className="fld">
            <label>Outbound priority (lower = preferred; platform fallback is 100)</label>
            <input
              type="number"
              min={1}
              max={99}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>

          {error ? (
            <div
              style={{
                color: '#b3261e',
                fontSize: 12,
                marginTop: 10,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={create}>
            Add carrier
          </button>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- route trace */

function RouteTrace() {
  const db = useDb();
  const [direction, setDirection] = useState('outbound');
  const [number, setNumber] = useState('+1 415 555 0100');

  // Computed inline, not memoised: the store returns the same mutable array on
  // every render, so a memo keyed on it would never invalidate.
  const chain = byocRoute(direction, db.byocTrunks);
  const selected = chain[0];
  return (
    <div
      style={{
        background: '#fbfcfe',
        border: '1px solid #e3e8f0',
        borderRadius: 8,
        padding: '14px 16px',
      }}
    >
      <b
        style={{
          fontSize: 13,
        }}
      >
        Route trace
      </b>
      <div
        style={{
          display: 'flex',
          gap: 10,
          margin: '10px 0',
          alignItems: 'center',
          fontSize: 12.5,
        }}
      >
        Direction
        <select value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
        Number
        <input
          value={number}
          style={{
            width: 150,
          }}
          onChange={(e) => setNumber(e.target.value)}
        />
      </div>

      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.9,
        }}
      >
        {selected ? (
          <div
            style={{
              background: '#e3f5ec',
              borderRadius: 6,
              padding: '8px 12px',
              marginBottom: 8,
            }}
          >
            <b>Selected:</b> {selected.name} ({KIND_LABEL[selected.kind]}, priority{' '}
            {selected.priority}) —{' '}
            {direction === 'outbound' ? (
              selected.kind === 'platform' ? (
                'dials via the MCM Twilio carrier'
              ) : (
                <>
                  dials via <code>&lt;Number byoc=&quot;{selected.byocSid || 'BY…'}&quot;&gt;</code>
                </>
              )
            ) : (
              <>
                origination lands on{' '}
                {selected.kind === 'platform' ? 'MCM-provisioned DIDs' : 'your carrier trunk'} →
                voice engine → tenant IVR
              </>
            )}
          </div>
        ) : (
          <div
            style={{
              color: '#b3261e',
            }}
          >
            No active carrier matches this direction.
          </div>
        )}

        <b>Fallback chain for {number}:</b>
        <br />
        {chain.map((trunk, index) => (
          <div key={trunk.id}>
            {index + 1}. {trunk.name} — {KIND_LABEL[trunk.kind]}, priority {trunk.priority}
            {trunk.kind === 'platform' ? (
              <span
                style={{
                  color: '#6b7686',
                }}
              >
                {' '}
                (guaranteed fallback)
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- the page */

/**
 * What the result panel under the table is currently showing.
 *
 * Held as plain data rather than as a stored JSX node: a node placed in state is
 * captured at the moment it is created, so it would not reflect later changes to
 * the trunk it describes.
 */

/** Inbound origination instructions, which differ by carrier kind. */
function InboundSetup({ trunk }) {
  let body;
  if (trunk.kind === 'platform') {
    body = (
      <>
        Inbound DIDs are provisioned by MCM on Twilio and mapped to your tenant in{' '}
        <code>phone_numbers</code>. Nothing to configure.
      </>
    );
  } else if (trunk.kind === 'sip') {
    body = (
      <>
        1. Ask your carrier to send origination for your DIDs to your Twilio SIP entry point (the
        BYOC trunk{' '}
        {trunk.byocSid ? <code>{trunk.byocSid.slice(0, 14)}…</code> : '— provision it first'}).
        <br />
        2. Whitelist Twilio&rsquo;s media IPs; keep codecs {(trunk.codecs ?? []).join('/')}.
        <br />
        3. Calls arrive at the MCM voice engine and are routed to your IVR flow by{' '}
        <code>phone_numbers → tenant</code>.
        <br />
        4. Outbound: the dialer selects this carrier by priority and dials via{' '}
        <code>&lt;Number byoc=&quot;{trunk.byocSid || 'BY…'}&quot;&gt;</code>.
      </>
    );
  } else {
    body = (
      <>
        Store the tenant&rsquo;s own Twilio Account SID + API key in the tenant record (
        <code>tenants.twilio</code>). Numbers, minutes and messaging then bill directly to the
        customer&rsquo;s Twilio account while MCM provides the platform.
      </>
    );
  }
  return (
    <InfoPanel tone="plain">
      <b>{trunk.name} — inbound origination setup</b>
      <div
        style={{
          marginTop: 6,
          lineHeight: 1.7,
        }}
      >
        {body}
      </div>
    </InfoPanel>
  );
}
export default function ByocPage() {
  const db = useDb();
  const { toast } = useUi();
  const [showAdd, setShowAdd] = useState(false);
  const [panel, setPanel] = useState(null);
  const trunks = [...db.byocTrunks].sort((a, b) => a.priority - b.priority);
  const activeCount = trunks.filter((t) => t.status === 'Active').length;
  function changePriority(id, delta) {
    mutate((database) => {
      const trunk = database.byocTrunks.find((t) => t.id === id);
      if (!trunk || trunk.locked) return;
      trunk.priority = Math.max(1, Math.min(99, trunk.priority + delta));
      audit('Edit', `BYOC priority ${trunk.name} → ${trunk.priority}`);
    });
  }
  function remove(id) {
    const trunk = db.byocTrunks.find((t) => t.id === id);
    if (!trunk || trunk.locked) return;
    mutate((database) => {
      database.byocTrunks = database.byocTrunks.filter((t) => t.id !== id);
    });
    audit('Delete', `BYOC carrier ${trunk.name}`);
    toast(`Removed ${trunk.name}`);
  }
  function ping(id) {
    const trunk = db.byocTrunks.find((t) => t.id === id);
    if (!trunk) return;
    setPanel({
      kind: 'pinging',
      trunkId: id,
    });
    window.setTimeout(() => {
      const ms = 18 + Math.floor(Math.random() * 40);
      setPanel({
        kind: 'pingResult',
        trunkId: id,
        ms,
      });
      audit('Edit', `BYOC ping ${trunk.name} (${ms} ms)`);
    }, 700);
  }
  function provision(id) {
    const trunk = db.byocTrunks.find((t) => t.id === id);
    if (!trunk || trunk.kind !== 'sip') return;
    setPanel({
      kind: 'provisioning',
      trunkId: id,
    });
    window.setTimeout(() => {
      const policySid = 'NY' + Math.random().toString(16).slice(2, 34);
      const byocSid = 'BY' + Math.random().toString(16).slice(2, 34);
      mutate((database) => {
        const target = database.byocTrunks.find((t) => t.id === id);
        if (!target) return;
        target.policySid = policySid;
        target.byocSid = byocSid;
        target.status = 'Active';
      });
      audit('Create', `BYOC provisioned ${trunk.name} → ${byocSid.slice(0, 12)}…`);
      setPanel({
        kind: 'provisioned',
        trunkId: id,
        byocSid,
        policySid,
      });
    }, 900);
  }

  /** Renders the result panel from the current `panel` state, reading live trunk data. */
  function renderPanel() {
    if (!panel) return null;
    if (panel.kind === 'trace') return <RouteTrace />;
    const trunk = db.byocTrunks.find((t) => t.id === panel.trunkId);
    if (!trunk) return null;
    switch (panel.kind) {
      case 'pinging':
        return <InfoPanel tone="muted">Sending SIP OPTIONS to {trunk.term}…</InfoPanel>;
      case 'pingResult':
        return (
          <InfoPanel tone="ok">
            <b>OPTIONS 200 OK</b> from {trunk.term} — round-trip {panel.ms} ms · codecs{' '}
            {(trunk.codecs ?? []).join('/')}
          </InfoPanel>
        );
      case 'provisioning':
        return (
          <InfoPanel tone="muted">
            Provisioning Twilio BYOC trunk (ConnectionPolicy → Target → ByocTrunk)…
          </InfoPanel>
        );
      case 'provisioned':
        return (
          <InfoPanel tone="ok">
            <b>Provisioned.</b> ByocTrunk <code>{panel.byocSid.slice(0, 14)}…</code> ·
            ConnectionPolicy <code>{panel.policySid.slice(0, 14)}…</code> — inbound points at the
            voice engine; outbound dials with <code>&lt;Number byoc&gt;</code>.
          </InfoPanel>
        );
      case 'inbound':
        return <InboundSetup trunk={trunk} />;
    }
  }
  return (
    <>
      <PageHeader
        breadcrumb="Admin › Telephony"
        title="Carrier Connections (BYOC)"
        actions={
          <>
            <button
              className="btn sec"
              onClick={() =>
                setPanel({
                  kind: 'trace',
                })
              }
            >
              Route trace
            </button>
            <button className="btn" onClick={() => setShowAdd(true)}>
              + Add carrier
            </button>
          </>
        }
        tabs={[
          {
            id: 'all',
            label: `${trunks.length} carriers · ${activeCount} active`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div
          style={{
            background: '#eef4fd',
            border: '1px solid #cfdff7',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 14,
            fontSize: 12.5,
            color: '#25436e',
          }}
        >
          <b>Bring Your Own Carrier</b> — route inbound and outbound calls over your own SIP carrier
          or your own Twilio account while MCM Cloud CX provides IVR, ACD, agents and analytics.
          Outbound legs pick the lowest-priority active carrier matching the direction; the MCM
          platform carrier is a locked, guaranteed fallback. Backed by the live{' '}
          <code>tenant_trunks</code> table and Twilio BYOC Trunks.
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Carrier</th>
                <th>Kind</th>
                <th>Direction</th>
                <th>Termination URI</th>
                <th>Auth</th>
                <th>Codecs</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trunks.map((trunk) => (
                <tr key={trunk.id}>
                  <td>
                    <b>{trunk.name}</b>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#6b7686',
                      }}
                    >
                      {trunk.note}
                    </div>
                  </td>
                  <td>{KIND_LABEL[trunk.kind]}</td>
                  <td
                    style={{
                      textTransform: 'capitalize',
                    }}
                  >
                    {trunk.direction}
                  </td>
                  <td>
                    {trunk.term ? (
                      <code
                        style={{
                          fontSize: 11.5,
                        }}
                      >
                        {trunk.term}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td
                    style={{
                      fontSize: 12,
                    }}
                  >
                    {authLabel(trunk)}
                  </td>
                  <td
                    style={{
                      fontSize: 12,
                    }}
                  >
                    {(trunk.codecs ?? []).join(', ')}
                  </td>
                  <td>
                    <b>{trunk.priority}</b>{' '}
                    {trunk.locked ? null : (
                      <>
                        <a
                          style={{
                            cursor: 'pointer',
                          }}
                          onClick={() => changePriority(trunk.id, -10)}
                        >
                          ▲
                        </a>
                        <a
                          style={{
                            cursor: 'pointer',
                          }}
                          onClick={() => changePriority(trunk.id, 10)}
                        >
                          ▼
                        </a>
                      </>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={trunk.status} />
                    {trunk.byocSid ? (
                      <div
                        style={{
                          fontSize: 10.5,
                          color: '#6b7686',
                        }}
                      >
                        {trunk.byocSid.slice(0, 10)}…
                      </div>
                    ) : null}
                  </td>
                  <td
                    style={{
                      whiteSpace: 'nowrap',
                      fontSize: 12,
                    }}
                  >
                    {trunk.kind === 'sip' ? (
                      <>
                        <a
                          style={{
                            cursor: 'pointer',
                            color: '#1466d8',
                          }}
                          onClick={() => ping(trunk.id)}
                        >
                          Ping
                        </a>
                        {' · '}
                      </>
                    ) : null}
                    {trunk.kind === 'sip' && !trunk.byocSid ? (
                      <>
                        <a
                          style={{
                            cursor: 'pointer',
                            color: '#1466d8',
                          }}
                          onClick={() => provision(trunk.id)}
                        >
                          Provision
                        </a>
                        {' · '}
                      </>
                    ) : null}
                    <a
                      style={{
                        cursor: 'pointer',
                        color: '#1466d8',
                      }}
                      onClick={() =>
                        setPanel({
                          kind: 'inbound',
                          trunkId: trunk.id,
                        })
                      }
                    >
                      Inbound setup
                    </a>
                    {trunk.locked ? (
                      <>
                        {' '}
                        ·{' '}
                        <span
                          style={{
                            color: '#9aa4b2',
                          }}
                        >
                          Locked
                        </span>
                      </>
                    ) : (
                      <>
                        {' · '}
                        <a
                          style={{
                            cursor: 'pointer',
                            color: '#b3261e',
                          }}
                          onClick={() => remove(trunk.id)}
                        >
                          Delete
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 16,
          }}
        >
          {renderPanel()}
        </div>
      </div>

      {showAdd ? <AddCarrierDrawer onClose={() => setShowAdd(false)} /> : null}
    </>
  );
}
