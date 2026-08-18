import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';

const FIELDS = [
  { section: 'Contact Information', field: 'Work mobile', type: 'Phone', visibility: 'Everyone', editable: 'User, Admin', searchable: true, order: 1 },
  { section: 'Contact Information', field: 'Desk location', type: 'Text', visibility: 'Everyone', editable: 'Admin', searchable: true, order: 2 },
  { section: 'Employment', field: 'Employee number', type: 'Text', visibility: 'Admin only', editable: 'Admin', searchable: false, order: 3 },
  { section: 'Employment', field: 'Start date', type: 'Date', visibility: 'Managers', editable: 'Admin', searchable: false, order: 4 },
  { section: 'Employment', field: 'Contract type', type: 'Single select', visibility: 'Managers', editable: 'Admin', searchable: false, order: 5 },
  { section: 'Skills & Certification', field: 'Certifications', type: 'Multi select', visibility: 'Everyone', editable: 'User, Admin', searchable: true, order: 6 },
  { section: 'Skills & Certification', field: 'Second language', type: 'Single select', visibility: 'Everyone', editable: 'User, Admin', searchable: true, order: 7 },
  { section: 'Personal', field: 'Pronouns', type: 'Text', visibility: 'Everyone', editable: 'User', searchable: false, order: 8 },
  { section: 'Personal', field: 'LinkedIn', type: 'URL', visibility: 'Everyone', editable: 'User', searchable: false, order: 9 },
  { section: 'Operations', field: 'Cost centre', type: 'Text', visibility: 'Admin only', editable: 'Admin', searchable: true, order: 10 },
];

export default function ProfileFieldsPage({ onNavigate }) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const term = q.trim().toLowerCase();
  const rows = FIELDS.filter((f) => !term || (f.section + ' ' + f.field + ' ' + f.type).toLowerCase().includes(term));

  function toggleRow(field) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function toggleAll(checked) {
    setSelected(checked ? new Set(rows.map((f) => f.field)) : new Set());
  }

  return (
    <>
      <PageHeader
        breadcrumb={<><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Directory</>}
        title="Profile Fields"
        actions={<>
          <button className="btn">+ Add Field</button>
          <button className="btn sec">Export</button>
        </>}
        tabs={[
          { id: 'fields', label: 'Fields' },
          { id: 'sections', label: 'Sections' },
          { id: 'preview', label: 'Preview' },
        ]}
        activeTab="fields"
      />
      <div className="pbody">
        <div className="tbar">
          <input className="s" placeholder="Search profile fields" value={q} onChange={(e) => setQ(e.target.value)} />
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
                <th>Section</th><th>Field</th><th>Type</th><th>Visibility</th><th>Editable by</th><th>Searchable</th><th>Order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.field}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(f.field)} onChange={() => toggleRow(f.field)} />
                  </td>
                  <td>{f.section}</td>
                  <td><b className="lnk">{f.field}</b></td>
                  <td>{f.type}</td>
                  <td>{f.visibility}</td>
                  <td>{f.editable}</td>
                  <td><span className={'st ' + (f.searchable ? 'ok' : 'of')}><span className="d" />{f.searchable ? 'Yes' : 'No'}</span></td>
                  <td>{f.order}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pgr">
            <span>Showing <b>{rows.length ? '1–' + rows.length : 0}</b> of <b>{FIELDS.length}</b></span>
          </div>
        </div>
      </div>
    </>
  );
}
