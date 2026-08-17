/**
 * Outbound Contact Lists.
 *
 * A contact list is a column schema (`cols`) plus the contact rows the dialer
 * walks. Each row carries its own dialing state — status, attempt count and the
 * last result — which the campaign monitor writes back as it dials.
 *
 * Ported from the prototype's `renderContactLists` / `clView` pair, including
 * the CSV import and export, the per-contact "Mark DNC" action and the
 * campaign-in-use guard on delete.
 */
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { audit, divisionName, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';

/**
 * A contact row as the dialer actually stores it. The shared `ContactList`
 * type models rows as a flat `Record<string, string>`; the seed data (and the
 * legacy engine) use the richer record below, so we narrow once here instead of
 * sprinkling casts through the page.
 */

function contactsOf(list) {
  return list.contacts;
}
const E164 = /^\+\d{7,15}$/;
function ErrorBox({ messages }) {
  if (!messages.length) return null;
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
      {messages.map((m, i) => (
        <div key={i}>{m}</div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- create list drawer */

function NewListDrawer({ onClose, onCreated }) {
  const db = useDb();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [division, setDivision] = useState(db.divisions[0]?.id ?? '');
  const [cols, setCols] = useState('FirstName,LastName,Phone');
  const [errors, setErrors] = useState([]);
  function create() {
    const trimmed = name.trim();
    const columns = cols
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const errs = [];
    if (trimmed.length < 2) errs.push('List name is required.');
    if (db.contactLists.some((x) => x.name.toLowerCase() === trimmed.toLowerCase()))
      errs.push('A list with this name already exists.');
    if (columns.indexOf('Phone') < 0) errs.push('Columns must include "Phone".');
    if (errs.length) {
      setErrors(errs);
      return;
    }
    const id = uid();
    mutate((database) => {
      database.contactLists.push({
        id,
        name: trimmed,
        division,
        cols: columns,
        contacts: [],
      });
    });
    audit('Create contact list', trimmed);
    onClose();
    toast('Contact list created — now import contacts');
    onCreated(id);
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
          <h2>Create Contact List</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>
        <div className="db">
          <ErrorBox messages={errors} />
          <div className="fld">
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld">
            <label>Division</label>
            <select value={division} onChange={(e) => setDivision(e.target.value)}>
              {db.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Columns (comma separated — must include Phone)</label>
            <input value={cols} onChange={(e) => setCols(e.target.value)} />
          </div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={create}>
            Create
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------- add contact drawer */

function AddContactDrawer({ list, onClose }) {
  const { toast } = useUi();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState([]);
  function save() {
    const data = {};
    list.cols.forEach((c) => {
      data[c] = (values[c] ?? '').trim();
    });
    const errs = [];
    if (!E164.test(data.Phone || '')) errs.push('Phone must be E.164 (e.g. +447700900123).');
    if (contactsOf(list).some((c) => c.data.Phone === data.Phone))
      errs.push('This phone number is already in the list.');
    if (errs.length) {
      setErrors(errs);
      return;
    }
    mutate((database) => {
      const target = database.contactLists.find((l) => l.id === list.id);
      if (!target) return;
      contactsOf(target).push({
        id: uid(),
        data,
        status: 'Not attempted',
        attempts: 0,
        lastResult: '',
      });
    });
    audit('Add contact', list.name + ' › ' + data.Phone);
    onClose();
    toast('Contact added');
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          height: 'auto',
          top: '16%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>Add Contact</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>
        <div className="db">
          <ErrorBox messages={errors} />
          {list.cols.map((c) => (
            <div className="fld" key={c}>
              <label>
                {c}
                {c === 'Phone' ? ' * (E.164)' : ''}
              </label>
              <input
                value={values[c] ?? ''}
                onChange={(e) =>
                  setValues((current) => ({
                    ...current,
                    [c]: e.target.value,
                  }))
                }
              />
            </div>
          ))}
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

/* ------------------------------------------------------------ import drawer */

function ImportDrawer({ list, onClose }) {
  const { toast } = useUi();
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState(null);
  const closeTimer = useRef(null);

  /* The success auto-close must not fire after the drawer has gone. */
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    []
  );
  function run() {
    const text = csv.trim();
    if (!text) {
      toast('Paste CSV rows first');
      return;
    }
    const lines = text.split(/\r?\n/).filter((x) => x.trim());
    if (lines.length && lines[0].toLowerCase().indexOf(list.cols[0].toLowerCase()) === 0)
      lines.shift();
    let ok = 0;
    const fail = [];
    const phoneIndex = list.cols.indexOf('Phone');
    mutate((database) => {
      const target = database.contactLists.find((l) => l.id === list.id);
      if (!target) return;
      const contacts = contactsOf(target);
      lines.forEach((line, i) => {
        const cells = line.split(',').map((x) => x.trim());
        const phone = cells[phoneIndex] || '';
        if (!E164.test(phone)) {
          fail.push('Row ' + (i + 1) + ': invalid phone');
          return;
        }
        if (contacts.some((x) => x.data.Phone === phone)) {
          fail.push('Row ' + (i + 1) + ': duplicate ' + phone);
          return;
        }
        const data = {};
        target.cols.forEach((col, j) => {
          data[col] = cells[j] || '';
        });
        contacts.push({
          id: uid(),
          data,
          status: 'Not attempted',
          attempts: 0,
          lastResult: '',
        });
        ok++;
      });
    });
    audit('Import contacts', list.name + ': ' + ok + ' added, ' + fail.length + ' rejected');
    setResult({
      ok,
      fail,
    });
    if (ok) {
      toast(ok + ' contacts imported');
      if (!fail.length) closeTimer.current = window.setTimeout(onClose, 800);
    }
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>Import CSV — {list.name}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>
        <div className="db">
          <div
            style={{
              fontSize: 12,
              color: '#5b6b82',
              marginBottom: 8,
              lineHeight: 1.6,
            }}
          >
            Columns: <code>{list.cols.join(',')}</code> — header row optional. Phone must be E.164;
            duplicates and invalid rows are rejected.
          </div>
          <div className="fld">
            <textarea
              style={{
                height: 160,
                fontFamily: 'monospace',
                fontSize: 12,
              }}
              placeholder={list.cols.join(',') + '\n...'}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: '#33425c',
            }}
          >
            {result ? (
              <>
                <b
                  style={{
                    color: '#1f9d63',
                  }}
                >
                  {result.ok} imported.
                </b>{' '}
                {result.fail.length ? (
                  <>
                    <b
                      style={{
                        color: '#b3261e',
                      }}
                    >
                      {result.fail.length} rejected:
                    </b>
                    <br />
                    {result.fail.map((f, i) => (
                      <div key={i}>{f}</div>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={run}>
            Import
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- page */

export default function ContactListsPage() {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  const [selected, setSelected] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const list = selected ? db.contactLists.find((l) => l.id === selected) : undefined;

  /** Export the list with its dialing results, as the legacy `clExport` did. */
  function exportCsv(target) {
    const header = target.cols.join(',') + ',Status,Attempts,LastResult';
    const lines = contactsOf(target).map(
      (ct) =>
        target.cols.map((c) => '"' + String(ct.data[c] || '').replace(/"/g, '""') + '"').join(',') +
        ',"' +
        ct.status +
        '",' +
        ct.attempts +
        ',"' +
        (ct.lastResult || '') +
        '"'
    );
    const blob = new Blob([header + '\n' + lines.join('\n')], {
      type: 'text/csv',
    });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = target.name + '.csv';
    anchor.click();
    toast('List exported with dialing results');
  }
  function markDnc(listId, contactId) {
    const target = db.contactLists.find((l) => l.id === listId);
    const contact = target ? contactsOf(target).find((x) => x.id === contactId) : undefined;
    if (!contact) return;
    const phone = contact.data.Phone;
    const dncList = db.dncLists[0];
    mutate((database) => {
      const owner = database.contactLists.find((l) => l.id === listId);
      const ct = owner ? contactsOf(owner).find((x) => x.id === contactId) : undefined;
      if (!ct) return;
      ct.status = 'DNC';
      ct.lastResult = 'Marked DNC by admin';
      const dnc = database.dncLists[0];
      if (dnc && dnc.numbers.indexOf(ct.data.Phone) < 0) dnc.numbers.push(ct.data.Phone);
    });
    audit('Mark DNC', phone);
    toast(dncList ? `${phone} marked DNC and added to ${dncList.name}` : `${phone} marked DNC`);
  }
  function deleteContact(listId, contactId) {
    mutate((database) => {
      const owner = database.contactLists.find((l) => l.id === listId);
      if (!owner) return;
      const contacts = contactsOf(owner);
      const index = contacts.findIndex((x) => x.id === contactId);
      if (index > -1) contacts.splice(index, 1);
    });
    toast('Contact removed');
  }
  function deleteList(target) {
    const used = db.campaigns.filter((c) => c.list === target.id);
    if (used.length) {
      toast('Cannot delete — used by campaign ' + used[0].name);
      return;
    }
    confirmBox(
      `Delete contact list ${target.name} and its ${target.contacts.length} contacts?`,
      () => {
        mutate((database) => {
          database.contactLists = database.contactLists.filter((x) => x.id !== target.id);
        });
        audit('Delete contact list', target.name);
        toast('List deleted');
        setSelected(null);
      }
    );
  }

  /* ------------------------------------------------------------ detail view */

  if (list) {
    const contacts = contactsOf(list);
    return (
      <>
        <PageHeader
          breadcrumb={
            <>
              Admin ›{' '}
              <a
                style={{
                  cursor: 'pointer',
                }}
                onClick={() => setSelected(null)}
              >
                Outbound › Contact Lists
              </a>
            </>
          }
          title={list.name}
          actions={
            <>
              <button className="btn" onClick={() => setDrawer('add')}>
                + Add Contact
              </button>
              <button className="btn sec" onClick={() => setDrawer('import')}>
                Import CSV
              </button>
              <button className="btn sec" onClick={() => exportCsv(list)}>
                Export CSV
              </button>
              <button className="btn gh" onClick={() => deleteList(list)}>
                Delete list
              </button>
            </>
          }
          tabs={[
            {
              id: 'contacts',
              label: `${contacts.length} contacts`,
            },
          ]}
          activeTab="contacts"
        />

        <div className="pbody">
          <div className="tblw">
            <table className="dt">
              <thead>
                <tr>
                  {list.cols.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                  <th>Status</th>
                  <th>Attempts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.length ? (
                  contacts.map((ct) => {
                    const colour =
                      ct.status === 'DNC'
                        ? '#e0a200'
                        : ct.status === 'Contacted'
                          ? '#1f9d63'
                          : ct.status === 'Complete'
                            ? '#8794a8'
                            : '#33425c';
                    return (
                      <tr key={ct.id}>
                        {list.cols.map((c) => (
                          <td key={c}>{ct.data[c] || ''}</td>
                        ))}
                        <td>
                          <span
                            style={{
                              color: colour,
                              fontWeight: 600,
                            }}
                          >
                            {ct.status}
                          </span>
                          <br />
                          <span
                            style={{
                              color: '#8794a8',
                              fontSize: 11,
                            }}
                          >
                            {ct.lastResult || ''}
                          </span>
                        </td>
                        <td>{ct.attempts}</td>
                        <td
                          style={{
                            width: 80,
                          }}
                        >
                          {ct.status !== 'DNC' ? (
                            <a
                              className="lnk"
                              style={{
                                fontSize: 11.5,
                                cursor: 'pointer',
                              }}
                              onClick={() => markDnc(list.id, ct.id)}
                            >
                              Mark DNC
                            </a>
                          ) : null}{' '}
                          <a
                            className="lnk"
                            style={{
                              fontSize: 11.5,
                              cursor: 'pointer',
                            }}
                            onClick={() => deleteContact(list.id, ct.id)}
                          >
                            Delete
                          </a>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={list.cols.length + 3}
                      style={{
                        textAlign: 'center',
                        color: '#8794a8',
                        padding: 24,
                      }}
                    >
                      No contacts — add or import
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {drawer === 'add' ? <AddContactDrawer list={list} onClose={() => setDrawer(null)} /> : null}
        {drawer === 'import' ? <ImportDrawer list={list} onClose={() => setDrawer(null)} /> : null}
      </>
    );
  }

  /* -------------------------------------------------------------- list view */

  return (
    <>
      <PageHeader
        breadcrumb="Admin › Outbound"
        title="Contact Lists"
        actions={
          <button className="btn" onClick={() => setDrawer('new')}>
            + Create Contact List
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `All Lists (${db.contactLists.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>List</th>
                <th>Division</th>
                <th>Contacts</th>
                <th>Columns</th>
                <th>Status summary</th>
                <th
                  style={{
                    width: 40,
                  }}
                ></th>
              </tr>
            </thead>
            <tbody>
              {db.contactLists.map((l) => {
                const counts = {};
                contactsOf(l).forEach((c) => {
                  counts[c.status] = (counts[c.status] || 0) + 1;
                });
                const summary = Object.keys(counts)
                  .map((k) => k + ': ' + counts[k])
                  .join(' · ');
                return (
                  <tr key={l.id} onClick={() => setSelected(l.id)}>
                    <td>
                      <b className="lnk">{l.name}</b>
                    </td>
                    <td>{divisionName(l.division)}</td>
                    <td>{l.contacts.length}</td>
                    <td>{l.cols.join(', ')}</td>
                    <td
                      style={{
                        fontSize: 11.5,
                        color: '#5b6b82',
                      }}
                    >
                      {summary || '—'}
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

      {drawer === 'new' ? (
        <NewListDrawer onClose={() => setDrawer(null)} onCreated={(id) => setSelected(id)} />
      ) : null}
    </>
  );
}
