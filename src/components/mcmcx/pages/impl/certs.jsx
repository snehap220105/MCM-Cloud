import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';

const CERTS = [
  { name: 'byoc-sbc-2026.pem', purpose: 'BYOC Cloud trunk', to: 'sbc.mcmgroup.example', issuer: 'DigiCert TLS RSA', from: '14 Feb 2026', expires: '14 Feb 2027', status: 'Valid', cls: 'ok' },
  { name: 'edge-hq-lon-01.pem', purpose: 'Edge SIP TLS', to: 'edge-hq-lon-01.mcm.local', issuer: 'MCM Internal CA', from: '02 Jan 2026', expires: '02 Jan 2027', status: 'Valid', cls: 'ok' },
  { name: 'edge-hq-lon-02.pem', purpose: 'Edge SIP TLS', to: 'edge-hq-lon-02.mcm.local', issuer: 'MCM Internal CA', from: '02 Jan 2026', expires: '02 Jan 2027', status: 'Valid', cls: 'ok' },
  { name: 'entra-signing-2026.cer', purpose: 'SAML signing', to: 'sts.windows.net', issuer: 'Microsoft', from: '14 Feb 2026', expires: '14 Feb 2027', status: 'Valid', cls: 'ok' },
  { name: 'partner-mtls-northstar.pem', purpose: 'Mutual TLS', to: 'api.northstarbpo.example', issuer: 'Sectigo', from: '30 Aug 2025', expires: '30 Aug 2026', status: 'Expires in 21 days', cls: 'wn' },
  { name: 'legacy-pbx-2024.pem', purpose: 'PBX trunk', to: 'pbx.mcm.local', issuer: 'MCM Internal CA', from: '11 Nov 2024', expires: '11 Nov 2025', status: 'Expired', cls: 'er' },
  { name: 'mcm-internal-root.pem', purpose: 'Root CA', to: 'MCM Internal CA', issuer: 'Self-signed', from: '01 Jan 2024', expires: '01 Jan 2034', status: 'Valid', cls: 'ok' },
];

// Trust Store / Expiry Monitor — ported verbatim from the prototype's
// TT.certs registry (MCM_Cloud_CX_v15_2.html).
const TRUST_STORE = [
  { ca: 'DigiCert Global Root G2', purpose: 'Cloud SIP TLS', expires: '2038' },
  { ca: 'MCM Internal CA', purpose: 'Premises edge ↔ phones', expires: '2031' },
];
const EXPIRY_MONITOR = [
  { name: 'sbc1.ukcarrier.net', usedBy: 'BYOC-Carrier-UK trunk', daysLeft: 412, cls: 'ok' },
  { name: 'edge-mum-tls', usedBy: 'MUM edge pair', daysLeft: 86, cls: 'ok' },
  { name: 'sip.mcmgroup.com', usedBy: 'SIP domain', daysLeft: 23, cls: 'wn' },
];

export default function DigitalCertificatesPage({ onNavigate }) {
  const [tab, setTab] = useState('certs');
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = CERTS.filter((c) => !term || (c.name + ' ' + c.purpose + ' ' + c.to + ' ' + c.issuer).toLowerCase().includes(term));

  return (
    <>
      <PageHeader
        breadcrumb={<><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Telephony</>}
        title="Digital Certificates"
        actions={<>
          <button className="btn">+ Upload Certificate</button>
          <button className="btn sec">Export</button>
        </>}
        tabs={[
          { id: 'certs', label: 'Certificates' },
          { id: 'trust', label: 'Trust Store' },
          { id: 'expiry', label: 'Expiry Monitor' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />
      <div className="pbody">
        {tab === 'trust' ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>CA certificate</th><th>Purpose</th><th>Expires</th></tr></thead>
              <tbody>
                {TRUST_STORE.map((r) => (
                  <tr key={r.ca}><td><b>{r.ca}</b></td><td>{r.purpose}</td><td>{r.expires}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'expiry' ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Certificate</th><th>Used by</th><th>Days left</th><th>Status</th></tr></thead>
              <tbody>
                {EXPIRY_MONITOR.map((r) => (
                  <tr key={r.name}>
                    <td><b>{r.name}</b></td>
                    <td>{r.usedBy}</td>
                    <td>{r.daysLeft}</td>
                    <td><span className={'st ' + r.cls}><span className="d" />{r.cls === 'ok' ? 'Healthy' : 'Renew soon'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
        <div className="tbar">
          <input className="s" placeholder="Search digital certificates" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="sp" />
          <div className="chip" onClick={() => setQ('')}>↻ Refresh</div>
        </div>
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Certificate</th><th>Purpose</th><th>Issued to</th><th>Issuer</th><th>Valid from</th><th>Expires</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.name}>
                  <td><b className="lnk">{c.name}</b></td>
                  <td>{c.purpose}</td>
                  <td>{c.to}</td>
                  <td>{c.issuer}</td>
                  <td>{c.from}</td>
                  <td>{c.expires}</td>
                  <td><span className={'st ' + c.cls}><span className="d" />{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pgr">
            <span>Showing <b>{rows.length ? '1–' + rows.length : 0}</b> of <b>{CERTS.length}</b></span>
          </div>
        </div>
          </>
        )}
      </div>
    </>
  );
}
