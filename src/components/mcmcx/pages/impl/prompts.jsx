/**
 * User Prompts — the audio (and TTS fallback) Architect flows play.
 *
 * Ported from the prototype's `renderPromptsFx`, `editPromptFx`,
 * `savePromptFx` and `delPromptFx`. "Used by flows" is still derived by
 * looking for the prompt name inside a flow node's body text.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
const LANGUAGES = ['en-GB', 'en-US', 'hi-IN', 'es-ES', 'fr-FR'];

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
function PromptDrawer({ prompt, onClose }) {
  const db = useDb();
  const { toast, confirmBox } = useUi();
  const isNew = !prompt;
  const [name, setName] = useState(prompt?.name ?? '');
  const [desc, setDesc] = useState(prompt?.desc ?? '');
  const [tts, setTts] = useState(prompt?.tts ?? '');
  const [lang, setLang] = useState(prompt?.lang ?? 'en-GB');
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    const found = [];
    if (!/^[A-Za-z0-9_]{2,40}$/.test(trimmed))
      found.push('Name: 2–40 letters, numbers or underscores (no spaces).');
    if (db.prompts.some((x) => x.name === trimmed && x.id !== prompt?.id))
      found.push('Prompt name already exists.');
    if (found.length) {
      setErrors(found);
      return;
    }
    mutate((database) => {
      let target = prompt ? database.prompts.find((x) => x.id === prompt.id) : undefined;
      if (!target) {
        target = {
          id: uid(),
          name: '',
          desc: '',
          tts: '',
          lang: 'en-GB',
        };
        database.prompts.push(target);
      }
      target.name = trimmed;
      target.desc = desc.trim();
      target.tts = tts.trim();
      target.lang = lang;
    });
    audit((isNew ? 'Create' : 'Edit') + ' prompt', trimmed);
    onClose();
    toast('Prompt saved');
  }
  function remove() {
    if (!prompt) return;
    onClose();
    confirmBox(`Delete prompt ${prompt.name}? Flows referencing it fall back to TTS.`, () => {
      mutate((database) => {
        database.prompts = database.prompts.filter((x) => x.id !== prompt.id);
      });
      audit('Delete prompt', prompt.name);
      toast('Prompt deleted');
    });
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? 'Add Prompt' : `Edit — ${prompt.name}`}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox errors={errors} />

          <div className="fld">
            <label>Prompt name * (letters, numbers, underscores)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>

          <div className="fld">
            <label>TTS text (fallback when no recording uploaded)</label>
            <textarea
              style={{
                height: 80,
              }}
              value={tts}
              onChange={(e) => setTts(e.target.value)}
            />
          </div>

          <div className="fld">
            <label>Language</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGUAGES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            <button
              className="btn sec"
              onClick={() => toast('Recording studio would open — upload WAV or record via phone')}
            >
              Upload / record audio
            </button>
            {isNew ? null : (
              <button className="btn gh" onClick={remove}>
                Delete
              </button>
            )}
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
export default function PromptsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);

  /** Flows whose node bodies mention this prompt by name. */
  function usedIn(name) {
    return (db.flows || [])
      .filter((flow) => flow.nodes.some((node) => (node.b || '').indexOf(name) > -1))
      .map((flow) => flow.name);
  }
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Routing
          </>
        }
        title="Prompts"
        actions={
          <button className="btn" onClick={() => setEditing('new')}>
            + Add Prompt
          </button>
        }
        tabs={[
          {
            id: 'user',
            label: `User Prompts (${db.prompts.length})`,
          },
        ]}
        activeTab="user"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Prompt</th>
                <th>Description</th>
                <th>TTS fallback</th>
                <th>Language</th>
                <th>Used by flows</th>
                <th
                  style={{
                    width: 40,
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {db.prompts.map((prompt) => {
                const used = usedIn(prompt.name);
                return (
                  <tr key={prompt.id} onClick={() => setEditing(prompt)}>
                    <td>
                      <b className="lnk">{prompt.name}</b>
                    </td>
                    <td>{prompt.desc}</td>
                    <td
                      style={{
                        maxWidth: 280,
                        fontSize: 12,
                        color: '#5b6b82',
                      }}
                    >
                      “{prompt.tts.slice(0, 70)}
                      {prompt.tts.length > 70 ? '…' : ''}”
                    </td>
                    <td>{prompt.lang}</td>
                    <td>
                      {used.length
                        ? used.map((flowName) => (
                            <span className="tag" key={flowName}>
                              {flowName}
                            </span>
                          ))
                        : '—'}
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

      {editing ? (
        <PromptDrawer
          prompt={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
