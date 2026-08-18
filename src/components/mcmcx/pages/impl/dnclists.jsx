/**
 * Outbound DNC (Do Not Call) Lists.
 *
 * A DNC list is a flat set of E.164 numbers a campaign must never dial. The
 * dialer checks the campaign's assigned list before every attempt and logs a
 * "DNC skip" instead of placing the call.
 *
 * Ported from the prototype's `renderDnc` / `dncView` pair, including the bulk
 * number import, the campaign-in-use guard on delete and the number lookup tool.
 */
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
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

/* -------------------------------------------------------- create DNC drawer */

function NewDncDrawer({ onClose, onCreated }) {
  const db = useDb();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [errors, setErrors] = useState([]);
  function create() {
    const trimmed = name.trim();
    if (
      trimmed.length < 2 ||
      db.dncLists.some((x) => x.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setErrors(['A unique name is required.']);
      return;
    }
    const id = uid();
    mutate((database) => {
      database.dncLists.push({
        id,
        name: trimmed,
        numbers: [],
      });
    });
    audit('Create DNC list', trimmed);
    onClose();
    toast('DNC list created');
    onCreated(id);
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
          <h2>Create DNC List</h2>
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

/* --------------------------------------------------------- add numbers drawer */

function AddNumbersDrawer({ list, onClose }) {
  const { toast } = useUi();
  const [raw, setRaw] = useState('');
  const [errors, setErrors] = useState([]);
  function save() {
    const entries = raw.split(/[\s,;]+/).filter(Boolean);
    let ok = 0;
    let bad = 0;
    const accepted = [];
    entries.forEach((n) => {
      if (E164.test(n)) {
        if (list.numbers.indexOf(n) < 0 && accepted.indexOf(n) < 0) {
          accepted.push(n);
          ok++;
        }
      } else bad++;
    });
    if (bad && !ok) {
      setErrors([bad + ' invalid number(s) — use E.164 like +447700900123.']);
      return;
    }
    mutate((database) => {
      const target = database.dncLists.find((d) => d.id === list.id);
      if (!target) return;
      accepted.forEach((n) => target.numbers.push(n));
    });
    audit('Add DNC numbers', list.name + ': ' + ok + ' added');
    onClose();
    toast(ok + ' number(s) added to ' + list.name + (bad ? ' — ' + bad + ' invalid skipped' : ''));
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
          <h2>Add Numbers</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>
        <div className="db">
          <ErrorBox messages={errors} />
          <div className="fld">
            <label>E.164 numbers (one per line or comma separated)</label>
            <textarea
              style={{
                height: 110,
              }}
              placeholder="+447700900123"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
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

/* --------------------------------------------------------------- lookup tool */

function LookupDrawer({ onClose }) {
  const db = useDb();
  const [number, setNumber] = useState('');
  const [checked, setChecked] = useState(null);
  const hits = checked ? db.dncLists.filter((d) => d.numbers.indexOf(checked) > -1) : [];
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
          <h2>DNC Number Lookup</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>
        <div className="db">
          <div className="fld">
            <label>Number</label>
            <input
              placeholder="+447700900104"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div className="fld">
            <label>&nbsp;</label>
            <button className="btn" onClick={() => setChecked(number.trim())}>
              Check
            </button>
          </div>
          <div
            style={{
              fontSize: 12.5,
            }}
          >
            {checked === null ? null : hits.length ? (
              <div
                style={{
                  background: '#fff8e6',
                  border: '1px solid #f2dfa7',
                  borderRadius: 6,
                  padding: '9px 12px',
                }}
              >
                ⚠ <b>{checked}</b> is suppressed by:{' '}
                {hits.map((d) => (
                  <span className="tag o" key={d.id}>
                    {d.name}
                  </span>
                ))}
              </div>
            ) : (
              <div
                style={{
                  background: '#e8f7ef',
                  border: '1px solid #bfe6cf',
                  borderRadius: 6,
                  padding: '9px 12px',
                }}
              >
                ✓ <b>{checked}</b> is not on any DNC list — dialable.
              </div>
            )}
          </div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- page */

export default function DncListsPage() {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  const [selected, setSelected] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const list = selected ? db.dncLists.find((d) => d.id === selected) : undefined;
  function removeNumber(id, num) {
    mutate((database) => {
      const target = database.dncLists.find((d) => d.id === id);
      if (!target) return;
      target.numbers = target.numbers.filter((x) => x !== num);
    });
    audit('Remove DNC number', num);
    toast('Removed');
  }
  function deleteList(target) {
    const used = db.campaigns.filter((c) => c.dnc === target.id);
    if (used.length) {
      toast('Cannot delete — assigned to campaign ' + used[0].name);
      return;
    }
    confirmBox(`Delete DNC list ${target.name}?`, () => {
      mutate((database) => {
        database.dncLists = database.dncLists.filter((x) => x.id !== target.id);
      });
      audit('Delete DNC list', target.name);
      toast('Deleted');
      setSelected(null);
    });
  }

  /* ------------------------------------------------------------ detail view */

  if (list) {
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
                Outbound › DNC Lists
              </a>
            </>
          }
          title={list.name}
          actions={
            <button className="btn" onClick={() => setDrawer('add')}>
              + Add Numbers
            </button>
          }
          tabs={[
            {
              id: 'numbers',
              label: `${list.numbers.length} suppressed numbers`,
            },
          ]}
          activeTab="numbers"
        />

        <div className="pbody">
          <div
            className="tblw"
            style={{
              maxWidth: 480,
            }}
          >
            <table className="dt">
              <thead>
                <tr>
                  <th>Number</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.numbers.length ? (
                  list.numbers.map((n) => (
                    <tr key={n}>
                      <td>
                        <b>{n}</b>
                      </td>
                      <td
                        style={{
                          width: 80,
                        }}
                      >
                        <a
                          className="lnk"
                          style={{
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                          onClick={() => removeNumber(list.id, n)}
                        >
                          Remove
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        textAlign: 'center',
                        color: '#8794a8',
                        padding: 20,
                      }}
                    >
                      Empty
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {drawer === 'add' ? <AddNumbersDrawer list={list} onClose={() => setDrawer(null)} /> : null}
      </>
    );
  }

  /* -------------------------------------------------------------- list view */

  return (
    <>
      <PageHeader
        breadcrumb="Admin › Outbound"
        title="DNC Lists"
        actions={
          <>
            <button className="btn" onClick={() => setDrawer('new')}>
              + Create DNC List
            </button>
            <button className="btn sec" onClick={() => setDrawer('lookup')}>
              Number Lookup
            </button>
          </>
        }
        tabs={[
          {
            id: 'all',
            label: `All Lists (${db.dncLists.length})`,
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
                <th>Numbers</th>
                <th>Used by campaigns</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {db.dncLists.map((d) => {
                const used = db.campaigns.filter((c) => c.dnc === d.id).map((c) => c.name);
                return (
                  <tr key={d.id}>
                    <td>
                      <b
                        className="lnk"
                        style={{
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelected(d.id)}
                      >
                        {d.name}
                      </b>
                    </td>
                    <td>{d.numbers.length}</td>
                    <td>
                      {used.length
                        ? used.map((n) => (
                            <span className="tag" key={n}>
                              {n}
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td
                      style={{
                        width: 70,
                      }}
                    >
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        onClick={() => deleteList(d)}
                      >
                        Delete
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drawer === 'new' ? (
        <NewDncDrawer onClose={() => setDrawer(null)} onCreated={(id) => setSelected(id)} />
      ) : null}
      {drawer === 'lookup' ? <LookupDrawer onClose={() => setDrawer(null)} /> : null}
    </>
  );
}
