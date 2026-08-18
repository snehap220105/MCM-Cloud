import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';

const CONTACTS = [
  { name: 'Grace Whitfield', initials: 'GW', org: 'Whitfield & Co', phone: '+44 20 7946 1188', email: 'g.whitfield@wf.example', rel: 'Primary billing', interactions: 24, last: 'Today 09:14' },
  { name: 'Ravi Sharma', initials: 'RS', org: 'Sharma Logistics', phone: '+44 161 496 0072', email: 'ravi@sharmalog.example', rel: 'Account owner', interactions: 11, last: 'Yesterday' },
  { name: 'Elena Marchetti', initials: 'EM', org: 'Marchetti Retail Group', phone: '+39 02 8088 4410', email: 'e.marchetti@mrg.example', rel: 'Decision maker', interactions: 37, last: '06 Aug 2026' },
  { name: 'Kwame Asante', initials: 'KA', org: 'Asante Foods Ltd', phone: '+44 121 496 0331', email: 'kwame@asantefoods.example', rel: 'Technical contact', interactions: 8, last: '04 Aug 2026' },
  { name: 'Nina Berg', initials: 'NB', org: 'Bergstrom AB', phone: '+46 8 505 22 11', email: 'nina.berg@bergstrom.example', rel: 'Primary billing', interactions: 19, last: '01 Aug 2026' },
  { name: 'Thomas Clarke', initials: 'TC', org: 'Clarke Motors', phone: '+44 113 496 0918', email: 't.clarke@clarkemotors.example', rel: 'Escalation', interactions: 52, last: '29 Jul 2026' },
  { name: 'Yuki Tanaka', initials: 'YT', org: 'Tanaka Systems', phone: '+81 3 4530 7712', email: 'y.tanaka@tanakasys.example', rel: 'Technical contact', interactions: 6, last: '22 Jul 2026' },
];

// Organizations / Relationships / Import — ported verbatim from the
// prototype's TT.extcontacts registry (MCM_Cloud_CX_v15_2.html).
const ORGANIZATIONS = [
  { org: 'Acme Retail Ltd', contacts: 14, industry: 'Retail' },
  { org: 'Northwind Utilities', contacts: 8, industry: 'Energy' },
];
const RELATIONSHIPS = [
  { contact: 'Oliver Smith', relationship: 'Account holder — Acme Retail', owner: 'Sofia Petrova' },
];

export default function ExternalContactsPage({ onNavigate, toast }) {
  const [tab, setTab] = useState('contacts');
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = CONTACTS.filter((c) => !term || (c.name + ' ' + c.org + ' ' + c.email).toLowerCase().includes(term));

  return (
    <>
      <PageHeader
        breadcrumb={<><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Directory</>}
        title="External Contacts"
        actions={<>
          <button className="btn">+ Add Contact</button>
          <button className="btn sec">Export</button>
        </>}
        tabs={[
          { id: 'contacts', label: 'Contacts' },
          { id: 'orgs', label: 'Organizations' },
          { id: 'relationships', label: 'Relationships' },
          { id: 'import', label: 'Import' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />
      <div className="pbody">
        {tab === 'orgs' ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Organisation</th><th>Contacts</th><th>Industry</th></tr></thead>
              <tbody>
                {ORGANIZATIONS.map((o) => (
                  <tr key={o.org}><td><b>{o.org}</b></td><td>{o.contacts}</td><td>{o.industry}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'relationships' ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Contact</th><th>Relationship</th><th>Owner</th></tr></thead>
              <tbody>
                {RELATIONSHIPS.map((r) => (
                  <tr key={r.contact}><td><b>{r.contact}</b></td><td>{r.relationship}</td><td>{r.owner}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'import' ? (
          <>
            <div style={{ fontSize: 12, color: '#5b6b82', margin: '0 0 10px', lineHeight: 1.6 }}>
              Bulk-import external contacts from CSV; identity resolution links phone/email to interaction history.
            </div>
            <button className="btn" onClick={() => toast?.('Contact import wizard would open — CSV with name, phone, email, organisation')}>Upload CSV</button>
          </>
        ) : (
          <>
            <div className="tbar">
              <input className="s" placeholder="Search external contacts" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="sp" />
              <div className="chip" onClick={() => setQ('')}>↻ Refresh</div>
            </div>
            <div className="tblw">
              <table className="dt">
                <thead>
                  <tr>
                    <th>Contact</th><th>Organization</th><th>Phone</th><th>Email</th><th>Relationship</th><th>Interactions</th><th>Last contact</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.name} onClick={() => toast?.(`Calling ${c.name}`)}>
                      <td><span className="av2">{c.initials}</span> <b className="lnk">{c.name}</b></td>
                      <td>{c.org}</td>
                      <td>{c.phone}</td>
                      <td>{c.email}</td>
                      <td>{c.rel}</td>
                      <td>{c.interactions}</td>
                      <td>{c.last}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pgr">
                <span>Showing <b>{rows.length ? '1–' + rows.length : 0}</b> of <b>{CONTACTS.length}</b></span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
