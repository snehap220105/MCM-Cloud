/**
 * Scripts — the agent screen-pop scripts queues can default to.
 *
 * Ported from the prototype's `renderScriptsFx`, `addScriptFx`,
 * `saveScriptFx`, `togScript` and `delScriptFx`. Deleting a script still
 * clears it from any queue that used it as the default.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
const TYPES = ['Inbound', 'Outbound', 'Inbound + Outbound', 'Chat/Message'];

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
function CreateScriptDrawer({ onClose }) {
  const db = useDb();
  const navigate = useNavigate();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    if (
      trimmed.length < 2 ||
      db.scriptsList.some((x) => x.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setErrors(['A unique script name is required.']);
      return;
    }
    mutate((database) => {
      database.scriptsList.push({
        id: uid(),
        name: trimmed,
        type,
        published: false,
      });
    });
    audit('Create script', trimmed);
    onClose();
    toast('Script created — opening the editor');
    navigate('/admin/scripteditor');
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
          <h2>Create Script</h2>
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
            <label>Features</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Create &amp; open editor
          </button>
        </div>
      </div>
    </>
  );
}
export default function ScriptsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const [creating, setCreating] = useState(false);
  function togglePublished(id) {
    const script = db.scriptsList.find((x) => x.id === id);
    if (!script) return;
    const nextPublished = !script.published;
    mutate((database) => {
      const target = database.scriptsList.find((x) => x.id === id);
      if (target) target.published = nextPublished;
    });
    audit((nextPublished ? 'Publish' : 'Unpublish') + ' script', script.name);
  }
  function remove(id) {
    const script = db.scriptsList.find((x) => x.id === id);
    if (!script) return;
    const used = (db.queues || []).filter((q) => q.script === id);
    confirmBox(
      `Delete script ${script.name}?` +
        (used.length ? ` It is the default on ${used.length} queue(s); they revert to none.` : ''),
      () => {
        mutate((database) => {
          database.scriptsList = database.scriptsList.filter((x) => x.id !== id);
          (database.queues || []).forEach((q) => {
            if (q.script === id) q.script = '';
          });
        });
        audit('Delete script', script.name);
        toast('Script deleted');
      }
    );
  }
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Contact Center
          </>
        }
        title="Scripts"
        actions={
          <button className="btn" onClick={() => setCreating(true)}>
            + Create Script
          </button>
        }
        tabs={[
          {
            id: 'all',
            label: `All Scripts (${db.scriptsList.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Script</th>
                <th>Type</th>
                <th>Status</th>
                <th>Default on queues</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.scriptsList.map((script) => {
                const used = (db.queues || [])
                  .filter((q) => q.script === script.id)
                  .map((q) => q.name);
                return (
                  <tr key={script.id}>
                    <td>
                      <b className="lnk" onClick={() => navigate('/admin/scripteditor')}>
                        {script.name}
                      </b>
                    </td>
                    <td>{script.type}</td>
                    <td>
                      {script.published ? (
                        <span className="st ok">
                          <span className="d" />
                          Published
                        </span>
                      ) : (
                        <span className="st wn">
                          <span className="d" />
                          Draft
                        </span>
                      )}
                    </td>
                    <td>
                      {used.length
                        ? used.map((queueName) => (
                            <span className="tag" key={queueName}>
                              {queueName}
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td
                      style={{
                        width: 160,
                      }}
                    >
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                        }}
                        onClick={() => navigate('/admin/scripteditor')}
                      >
                        Open editor
                      </a>
                      {' · '}
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                        }}
                        onClick={() => togglePublished(script.id)}
                      >
                        {script.published ? 'Unpublish' : 'Publish'}
                      </a>
                      {' · '}
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                        }}
                        onClick={() => remove(script.id)}
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

      {creating ? <CreateScriptDrawer onClose={() => setCreating(false)} /> : null}
    </>
  );
}
