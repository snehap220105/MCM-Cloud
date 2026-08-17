import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';

const WORKSPACES = [
  { name: 'Contact Centre Playbooks', type: 'Group', members: 48, docs: 126, size: '1.8 GB', owner: 'Sana Patel', modified: 'Today 08:20' },
  { name: 'Billing Procedures', type: 'Group', members: 42, docs: 64, size: '620 MB', owner: "James O'Neill", modified: 'Yesterday' },
  { name: 'Technical Knowledge Base', type: 'Group', members: 28, docs: 311, size: '4.2 GB', owner: 'Daniel Rowe', modified: 'Today 07:44' },
  { name: 'QA Evaluation Guides', type: 'Group', members: 12, docs: 38, size: '210 MB', owner: 'Priya Nair', modified: '05 Aug 2026' },
  { name: 'WFM Templates', type: 'Group', members: 9, docs: 22, size: '88 MB', owner: 'Hannah Wright', modified: '03 Aug 2026' },
  { name: 'Faisal Khan — Personal', type: 'Personal', members: 1, docs: 47, size: '1.1 GB', owner: 'Faisal Khan', modified: 'Today 09:02' },
  { name: 'Onboarding — New Starters', type: 'Group', members: 61, docs: 54, size: '740 MB', owner: 'Sana Patel', modified: '31 Jul 2026' },
  { name: 'Partner — Northstar BPO', type: 'Group', members: 40, docs: 19, size: '160 MB', owner: 'Tunde Okafor', modified: '28 Jul 2026' },
];

// Documents / Tags / Trash — ported verbatim from the prototype's
// TT.docws registry (MCM_Cloud_CX_v15_2.html).
const DOCUMENTS = [
  ['Complaints process.pdf', 'Customer Care', 'v4', '12 Jul 2026'],
  ['Refund matrix.xlsx', 'Customer Care', 'v9', '01 Aug 2026'],
  ['Onboarding deck.pptx', 'Training', 'v2', '15 Jun 2026'],
];
const TAGS = ['process', 'refunds', 'training', 'compliance', 'scripts'];
const TRASH = [{ doc: 'Old price list.xlsx', deleted: '28 Jul 2026', by: 'A. Shaikh' }];

export default function DocumentWorkspacesPage({ onNavigate, toast }) {
  const [tab, setTab] = useState('workspaces');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const term = q.trim().toLowerCase();
  const rows = WORKSPACES.filter((w) => !term || (w.name + ' ' + w.owner).toLowerCase().includes(term));

  function toggleRow(name) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll(checked) {
    setSelected(checked ? new Set(rows.map((w) => w.name)) : new Set());
  }

  return (
    <>
      <PageHeader
        breadcrumb={<><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Directory</>}
        title="Document Workspaces"
        actions={<>
          <button className="btn">+ Create Workspace</button>
          <button className="btn sec">Export</button>
        </>}
        tabs={[
          { id: 'workspaces', label: 'Workspaces' },
          { id: 'documents', label: 'Documents' },
          { id: 'tags', label: 'Tags' },
          { id: 'trash', label: 'Trash' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />
      <div className="pbody">
        {tab === 'documents' ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Document</th><th>Workspace</th><th>Version</th><th>Updated</th></tr></thead>
              <tbody>
                {DOCUMENTS.map((r) => (
                  <tr key={r[0]}>
                    <td><b className="lnk" onClick={() => toast?.('Preview would open')}>{r[0]}</b></td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                    <td>{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'tags' ? (
          <>
            <div style={{ fontSize: 12, color: '#5b6b82', margin: '0 0 10px', lineHeight: 1.6 }}>Tags power search across workspaces.</div>
            <div>{TAGS.map((t) => <span className="kw" key={t} style={{ marginRight: 8 }}>{t}</span>)}</div>
          </>
        ) : tab === 'trash' ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Document</th><th>Deleted</th><th>By</th><th /></tr></thead>
              <tbody>
                {TRASH.map((r) => (
                  <tr key={r.doc}>
                    <td>{r.doc}</td>
                    <td>{r.deleted}</td>
                    <td>{r.by}</td>
                    <td><a className="lnk" style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => toast?.('Restored to Customer Care workspace')}>Restore</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
        <div className="tbar">
          <input className="s" placeholder="Search document workspaces" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="sp" />
          <div className="chip" onClick={() => setQ('')}>↻ Refresh</div>
        </div>
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={(e) => toggleAll(e.target.checked)} />
                </th>
                <th>Workspace</th><th>Type</th><th>Members</th><th>Documents</th><th>Size</th><th>Owner</th><th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.name}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(w.name)} onChange={() => toggleRow(w.name)} />
                  </td>
                  <td><b className="lnk">{w.name}</b></td>
                  <td><span className={'tag' + (w.type === 'Personal' ? ' o' : '')}>{w.type}</span></td>
                  <td>{w.members}</td>
                  <td>{w.docs}</td>
                  <td>{w.size}</td>
                  <td>{w.owner}</td>
                  <td>{w.modified}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pgr">
            <span>Showing <b>{rows.length ? '1–' + rows.length : 0}</b> of <b>{WORKSPACES.length}</b></span>
          </div>
        </div>
          </>
        )}
      </div>
    </>
  );
}
