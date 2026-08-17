/**
 * Contact Center › Wrap-up Codes.
 *
 * Outcome labels agents pick during after-call work. Codes are attached to
 * queues (Queue editor › Wrap-up Codes), so the list shows where each one is in
 * use and deleting a code detaches it from every queue that references it.
 *
 * Ported from the prototype's `renderWrapup` / `editWrap` / `saveWrap` /
 * `delWrap` engine.
 */
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
/* ------------------------------------------------------------ code editor */

function WrapupDrawer({ code, onClose }) {
  const db = useDb();
  const isNew = !code;
  const [name, setName] = useState(code?.name ?? '');
  const [desc, setDesc] = useState(code?.desc ?? '');
  const [error, setError] = useState('');
  const { toast } = useUi();
  function save() {
    const trimmed = name.trim();
    const clash = db.wrapup.some(
      (w) => w.name.toLowerCase() === trimmed.toLowerCase() && w.id !== (code?.id ?? '')
    );
    if (trimmed.length < 2 || clash) {
      setError('A unique code name of at least 2 characters is required.');
      return;
    }
    mutate((database) => {
      const existing = code ? database.wrapup.find((w) => w.id === code.id) : null;
      if (existing) {
        existing.name = trimmed;
        existing.desc = desc.trim();
      } else {
        database.wrapup.push({
          id: uid(),
          name: trimmed,
          desc: desc.trim(),
        });
      }
    });
    audit((isNew ? 'Create' : 'Edit') + ' wrap-up code', trimmed);
    onClose();
    toast(`Saved — ${trimmed}`);
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
          <h2>{isNew ? 'Add' : 'Edit'} Wrap-up Code</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          {error ? (
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
              {error}
            </div>
          ) : null}

          <div className="fld">
            <label>Code name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld">
            <label>Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- the page */

export default function WrapupPage() {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  /** `null` = drawer closed; `{ code: null }` = the "add" drawer. */
  const [editing, setEditing] = useState(null);
  function remove(id) {
    const code = db.wrapup.find((w) => w.id === id);
    if (!code) return;
    const used = db.queues.filter((q) => q.wrapup.indexOf(id) > -1).length;
    confirmBox(
      `Delete wrap-up code ${code.name}?` +
        (used ? ` It is attached to ${used} queue(s); it will be removed from them.` : ''),
      () => {
        mutate((database) => {
          database.wrapup = database.wrapup.filter((w) => w.id !== id);
          database.queues.forEach((q) => {
            q.wrapup = q.wrapup.filter((x) => x !== id);
          });
        });
        audit('Delete wrap-up code', code.name);
        toast('Deleted');
      }
    );
  }
  return (
    <>
      <PageHeader
        breadcrumb="Admin › Contact Center"
        title="Wrap-up Codes"
        actions={
          <button
            className="btn"
            onClick={() =>
              setEditing({
                code: null,
              })
            }
          >
            + Add Code
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `All Codes (${db.wrapup.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Used by queues</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {db.wrapup.map((code) => {
                const used = db.queues.filter((q) => q.wrapup.indexOf(code.id) > -1);
                return (
                  <tr key={code.id}>
                    <td>
                      <b
                        className="lnk"
                        style={{
                          cursor: 'pointer',
                        }}
                        onClick={() =>
                          setEditing({
                            code,
                          })
                        }
                      >
                        {code.name}
                      </b>
                    </td>
                    <td>{code.desc || ''}</td>
                    <td>
                      {used.length
                        ? used.map((q) => (
                            <span className="tag" key={q.id}>
                              {q.name}
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
                        onClick={() => remove(code.id)}
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

      {editing ? <WrapupDrawer code={editing.code} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
