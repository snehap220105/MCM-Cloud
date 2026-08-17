/**
 * Email Settings — inbound domains and the addresses routed off them.
 *
 * Ported from the prototype's `renderEmailFx` plus `addDom` / `saveDom` /
 * `verifyDom` / `delDom` / `addAddr` / `saveAddr` / `delAddr`. A domain must
 * pass DNS verification before an address can be created on it, and a domain
 * with addresses still cannot be deleted.
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
function AddDomainDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const [domain, setDomain] = useState('');
  const [errors, setErrors] = useState([]);
  function save() {
    const value = domain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) {
      setErrors(['Enter a valid domain.']);
      return;
    }
    if (db.emailDomains.some((x) => x.domain === value)) {
      setErrors(['Domain already added.']);
      return;
    }
    mutate((database) => {
      database.emailDomains.push({
        id: uid(),
        domain: value,
        verified: false,
      });
    });
    audit('Add email domain', value);
    onClose();
    toast('Domain added — verify DNS to activate');
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
          <h2>Add Email Domain</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox errors={errors} />
          <div className="fld">
            <label>Domain *</label>
            <input
              value={domain}
              placeholder="mail.yourcompany.com"
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
              lineHeight: 1.6,
            }}
          >
            You must add the MX and SPF records shown after saving, then click Verify.
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Add
          </button>
        </div>
      </div>
    </>
  );
}
function AddAddressDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const verifiedDomains = db.emailDomains.filter((d) => d.verified);
  const emailFlows = (db.flows || []).filter((f) => f.type === 'Inbound Email');
  const [local, setLocal] = useState('');
  const [domain, setDomain] = useState(verifiedDomains[0]?.domain ?? '');
  const [route, setRoute] = useState('Queue');
  const [queue, setQueue] = useState((db.queues || [])[0]?.id ?? '');
  const [flow, setFlow] = useState(emailFlows[0]?.id ?? '');
  const [errors, setErrors] = useState([]);
  function save() {
    const value = local.trim().toLowerCase();
    if (!/^[a-z0-9._-]{1,40}$/.test(value)) {
      setErrors(['Enter a valid local part (before the @).']);
      return;
    }
    const addr = `${value}@${domain}`;
    if (db.emailAddrs.some((x) => x.addr === addr)) {
      setErrors(['Address already exists.']);
      return;
    }
    const target = route === 'Queue' ? queue : flow;
    if (!target) {
      setErrors(['Pick a routing target.']);
      return;
    }
    mutate((database) => {
      database.emailAddrs.push({
        id: uid(),
        addr,
        route,
        target,
      });
    });
    audit('Add email address', addr);
    onClose();
    toast(`${addr} now routes inbound email`);
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
          <h2>Add Email Address</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox errors={errors} />

          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <div
              className="fld"
              style={{
                flex: 1,
              }}
            >
              <label>Local part *</label>
              <input
                value={local}
                placeholder="support"
                onChange={(e) => setLocal(e.target.value)}
              />
            </div>
            <div
              style={{
                paddingBottom: 22,
              }}
            >
              @
            </div>
            <div
              className="fld"
              style={{
                flex: 1.4,
              }}
            >
              <label>Domain</label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)}>
                {verifiedDomains.map((d) => (
                  <option key={d.id}>{d.domain}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="fld">
            <label>Route to</label>
            <select value={route} onChange={(e) => setRoute(e.target.value)}>
              <option>Queue</option>
              <option>Flow</option>
            </select>
          </div>

          <div
            className="fld"
            style={{
              display: route === 'Queue' ? undefined : 'none',
            }}
          >
            <label>Queue</label>
            <select value={queue} onChange={(e) => setQueue(e.target.value)}>
              {(db.queues || []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>

          <div
            className="fld"
            style={{
              display: route === 'Flow' ? undefined : 'none',
            }}
          >
            <label>Inbound email flow</label>
            <select value={flow} onChange={(e) => setFlow(e.target.value)}>
              {emailFlows.length ? (
                emailFlows.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))
              ) : (
                <option value="">No inbound email flows built yet</option>
              )}
            </select>
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Add
          </button>
        </div>
      </div>
    </>
  );
}
export default function EmailSettingsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const [drawer, setDrawer] = useState(null);

  /** Human name of whatever an address routes to. */
  function targetName(address) {
    if (address.route === 'Queue') {
      return (db.queues || []).find((x) => x.id === address.target)?.name ?? '—';
    }
    return (db.flows || []).find((x) => x.id === address.target)?.name ?? '—';
  }
  function verifyDomain(id) {
    const domain = db.emailDomains.find((x) => x.id === id);
    if (!domain) return;
    mutate((database) => {
      const target = database.emailDomains.find((x) => x.id === id);
      if (target) target.verified = true;
    });
    audit('Verify email domain', domain.domain);
    toast(`${domain.domain} verified`);
  }
  function deleteDomain(id) {
    const domain = db.emailDomains.find((x) => x.id === id);
    if (!domain) return;
    if (db.emailAddrs.some((a) => a.addr.indexOf('@' + domain.domain) > -1)) {
      toast('Cannot delete — addresses exist on this domain');
      return;
    }
    confirmBox(`Delete domain ${domain.domain}?`, () => {
      mutate((database) => {
        database.emailDomains = database.emailDomains.filter((x) => x.id !== id);
      });
      audit('Delete email domain', domain.domain);
      toast('Deleted');
    });
  }
  function deleteAddress(id) {
    const address = db.emailAddrs.find((x) => x.id === id);
    if (!address) return;
    confirmBox(`Delete ${address.addr}? Inbound mail to it will bounce.`, () => {
      mutate((database) => {
        database.emailAddrs = database.emailAddrs.filter((x) => x.id !== id);
      });
      audit('Delete email address', address.addr);
      toast('Deleted');
    });
  }
  function openAddressDrawer() {
    if (!db.emailDomains.some((d) => d.verified)) {
      toast('Verify a domain first');
      return;
    }
    setDrawer('address');
  }
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Contact Center
          </>
        }
        title="Email Settings"
        actions={
          <>
            <button className="btn" onClick={() => setDrawer('domain')}>
              + Add Domain
            </button>
            <button className="btn sec" onClick={openAddressDrawer}>
              + Add Address
            </button>
          </>
        }
        tabs={[
          {
            id: 'domains',
            label: `Domains (${db.emailDomains.length})`,
          },
        ]}
        activeTab="domains"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Email domain</th>
                <th>DNS status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.emailDomains.map((domain) => (
                <tr key={domain.id}>
                  <td>
                    <b>{domain.domain}</b>
                  </td>
                  <td>
                    {domain.verified ? (
                      <span className="st ok">
                        <span className="d" />
                        Verified (MX/SPF)
                      </span>
                    ) : (
                      <span className="st wn">
                        <span className="d" />
                        Pending DNS
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      width: 130,
                    }}
                  >
                    {domain.verified ? null : (
                      <>
                        <a
                          className="lnk"
                          style={{
                            fontSize: 12,
                          }}
                          onClick={() => verifyDomain(domain.id)}
                        >
                          Verify now
                        </a>{' '}
                      </>
                    )}
                    <a
                      className="lnk"
                      style={{
                        fontSize: 12,
                      }}
                      onClick={() => deleteDomain(domain.id)}
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
            fontSize: 15,
            margin: '16px 0 6px',
          }}
        >
          Addresses ({db.emailAddrs.length})
        </h1>
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Address</th>
                <th>Routes to</th>
                <th>Target</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.emailAddrs.length ? (
                db.emailAddrs.map((address) => (
                  <tr key={address.id}>
                    <td>
                      <b>{address.addr}</b>
                    </td>
                    <td>
                      <span className={'tag' + (address.route === 'Flow' ? ' o' : '')}>
                        {address.route}
                      </span>
                    </td>
                    <td>{targetName(address)}</td>
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
                        onClick={() => deleteAddress(address.id)}
                      >
                        Delete
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
                      padding: 18,
                    }}
                  >
                    No addresses
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drawer === 'domain' ? <AddDomainDrawer onClose={() => setDrawer(null)} /> : null}
      {drawer === 'address' ? <AddAddressDrawer onClose={() => setDrawer(null)} /> : null}
    </>
  );
}
