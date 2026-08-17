/**
 * Phone Base Settings — the per-model templates phones inherit from.
 *
 * Ported from the prototype's `renderBasesetsFx`, `addBaseFx`, `saveBaseFx`
 * and `delBaseFx`. A template in use by a phone still cannot be deleted.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
const MODELS = [
  'MCM WebRTC Phone',
  'Polycom VVX 450',
  'Poly Edge E350',
  'AudioCodes 405HD',
  'Generic SIP Phone',
  'Remote',
];

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
function AddBaseDrawer({ onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [codec, setCodec] = useState('Opus, PCMU');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    if (
      trimmed.length < 2 ||
      db.baseSettings.some((x) => x.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setErrors(['A unique name is required.']);
      return;
    }
    mutate((database) => {
      database.baseSettings.push({
        id: uid(),
        name: trimmed,
        model,
        codec: codec.trim(),
        port: 16384,
      });
    });
    audit('Create base settings', trimmed);
    onClose();
    toast('Base settings added');
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
          <h2>Add Base Settings</h2>
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
            <label>Phone make &amp; model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Codec order</label>
            <input value={codec} onChange={(e) => setCodec(e.target.value)} />
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
export default function BasesetsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const [adding, setAdding] = useState(false);
  function remove(id) {
    const base = db.baseSettings.find((x) => x.id === id);
    if (!base) return;
    if (db.phones.some((p) => p.base === id)) {
      toast('Cannot delete — phones use this template');
      return;
    }
    confirmBox(`Delete base settings ${base.name}?`, () => {
      mutate((database) => {
        database.baseSettings = database.baseSettings.filter((x) => x.id !== id);
      });
      audit('Delete base settings', base.name);
      toast('Deleted');
    });
  }
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Telephony
          </>
        }
        title="Phone Base Settings"
        actions={
          <button className="btn" onClick={() => setAdding(true)}>
            + Add Base Settings
          </button>
        }
        tabs={[
          {
            id: 'templates',
            label: `Templates (${db.baseSettings.length})`,
          },
        ]}
        activeTab="templates"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Base settings</th>
                <th>Phone make &amp; model</th>
                <th>Codecs</th>
                <th>RTP start</th>
                <th>Used by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.baseSettings.map((base) => {
                const used = db.phones.filter((p) => p.base === base.id).length;
                return (
                  <tr key={base.id}>
                    <td>
                      <b>{base.name}</b>
                    </td>
                    <td>{base.model}</td>
                    <td>{base.codec}</td>
                    <td>{base.port}</td>
                    <td>{used} phones</td>
                    <td
                      style={{
                        width: 70,
                      }}
                    >
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                        }}
                        onClick={() => remove(base.id)}
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

      {adding ? <AddBaseDrawer onClose={() => setAdding(false)} /> : null}
    </>
  );
}
