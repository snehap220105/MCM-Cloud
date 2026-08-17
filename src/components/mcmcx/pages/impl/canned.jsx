/**
 * Canned Responses — the reusable snippets agents insert into replies.
 *
 * Ported from the prototype's `renderCannedFx`, `editCannedFx`,
 * `saveCannedFx` and `delCannedFx`.
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
function CannedDrawer({ response, onClose }) {
  const { toast, confirmBox } = useUi();
  const isNew = !response;
  const [name, setName] = useState(response?.name ?? '');
  const [text, setText] = useState(response?.text ?? '');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmedName = name.trim();
    const trimmedText = text.trim();
    const found = [];
    if (trimmedName.length < 2) found.push('Name is required.');
    if (trimmedText.length < 3) found.push('Response text is required.');
    if (found.length) {
      setErrors(found);
      return;
    }
    mutate((database) => {
      let target = response ? database.canned.find((x) => x.id === response.id) : undefined;
      if (!target) {
        target = {
          id: uid(),
          name: '',
          text: '',
        };
        database.canned.push(target);
      }
      target.name = trimmedName;
      target.text = trimmedText;
    });
    audit((isNew ? 'Create' : 'Edit') + ' canned response', trimmedName);
    onClose();
    toast('Saved');
  }
  function remove() {
    if (!response) return;
    onClose();
    confirmBox(`Delete response ${response.name}?`, () => {
      mutate((database) => {
        database.canned = database.canned.filter((x) => x.id !== response.id);
      });
      audit('Delete canned response', response.name);
      toast('Deleted');
    });
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          height: 'auto',
          top: '18%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>{isNew ? 'Add' : 'Edit'} Canned Response</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox errors={errors} />

          <div className="fld">
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Text (supports {'{{Contact.FirstName}}'} style substitutions)</label>
            <textarea
              style={{
                height: 100,
              }}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {isNew ? null : (
            <button className="btn gh" onClick={remove}>
              Delete
            </button>
          )}
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
export default function CannedPage() {
  const db = useDb();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Contact Center
          </>
        }
        title="Canned Responses"
        actions={
          <button className="btn" onClick={() => setEditing('new')}>
            + Add Response
          </button>
        }
        tabs={[
          {
            id: 'library',
            label: `Library (${db.canned.length})`,
          },
        ]}
        activeTab="library"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Response</th>
                <th>Text</th>
                <th
                  style={{
                    width: 40,
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {db.canned.map((response) => (
                <tr key={response.id} onClick={() => setEditing(response)}>
                  <td>
                    <b className="lnk">{response.name}</b>
                  </td>
                  <td
                    style={{
                      maxWidth: 420,
                      fontSize: 12,
                      color: '#5b6b82',
                    }}
                  >
                    {response.text.slice(0, 90)}
                    {response.text.length > 90 ? '…' : ''}
                  </td>
                  <td
                    style={{
                      color: '#a9b3c2',
                    }}
                  >
                    ⋮
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <CannedDrawer
          response={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
