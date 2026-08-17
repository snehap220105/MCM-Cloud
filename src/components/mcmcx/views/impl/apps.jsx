import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';

const APPS = [
  { icon: '☁', name: 'Salesforce CX Cloud', desc: 'Embedded CTI and screen pop' },
  { icon: '⚙', name: 'ServiceNow Unified', desc: 'Front and back office' },
  { icon: '📊', name: 'Customised Analytics', desc: 'Prebuilt and custom dashboards' },
  { icon: '🤖', name: 'Bot Manager', desc: 'Native and third-party bots' },
  { icon: '📱', name: 'Workforce Mobile', desc: 'Schedules and time-off' },
  { icon: '🔒', name: 'Secure Payments', desc: 'PCI card capture' },
  { icon: '👤', name: 'Agent Copilot', desc: 'Real-time assistance' },
  { icon: '📚', name: 'Knowledge Workbench', desc: 'Article authoring' },
];

// The "Available" tab reuses the prototype's TT.integ['Catalogue'] data —
// same integration catalogue offered from both Apps and Admin > Integrations.
const CATALOGUE = [
  { integration: 'Salesforce CTI', category: 'CRM' },
  { integration: 'Microsoft Teams', category: 'UC' },
  { integration: 'Zendesk', category: 'Ticketing' },
  { integration: 'Power BI Export', category: 'Analytics' },
];

export default function AppsView({ toast }) {
  const [tab, setTab] = useState('installed');
  return (
    <>
      <PageHeader
        breadcrumb="Apps"
        title="Apps"
        actions={<button className="btn sec">AppFoundry Marketplace</button>}
        tabs={[
          { id: 'installed', label: 'Installed' },
          { id: 'available', label: 'Available' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />
      <div className="pbody">
        {tab === 'installed' ? (
          <div className="apgrid">
            {APPS.map((app) => (
              <div className="appc" key={app.name}>
                <div className="ic2">{app.icon}</div>
                <b>{app.name}</b>
                <span>{app.desc}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Integration</th><th>Category</th><th /></tr></thead>
              <tbody>
                {CATALOGUE.map((c) => (
                  <tr key={c.integration}>
                    <td><b>{c.integration}</b></td>
                    <td>{c.category}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn sec" style={{ height: 26 }} onClick={() => toast?.(`${c.integration} install wizard would start`)}>Install</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
