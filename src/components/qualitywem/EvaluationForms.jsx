import { useCallback, useEffect, useState } from 'react';

// Kept in sync with server/evaluationForm.js NAME_RE/NAME_MIN/NAME_MAX — the inline error the
// user sees while typing should always match whatever the API would reject with.
const NAME_RE = /^[a-zA-Z\s]+$/;
const NAME_MIN = 3;
const NAME_MAX = 50;

function nameError(name) {
  if (!name) return null;
  if (name.trim().length < NAME_MIN || name.length > NAME_MAX) return `Form name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  if (!NAME_RE.test(name)) return 'Only letters and spaces are allowed — no numbers or symbols.';
  return null;
}

async function api(path, options) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw Object.assign(new Error(body.error || 'Request failed'), { fields: body.fields });
  return body;
}

const formMax = (f) => f.groups.reduce((s, g) => s + g.questions.reduce((s2, q) => s2 + q.weight, 0), 0);
const formQCount = (f) => f.groups.reduce((s, g) => s + g.questions.length, 0);

// Local id for a group/question that only exists client-side (not yet saved) — negative so
// it can never collide with a real BIGSERIAL id from the backend.
let localSeq = -1;
const localId = () => localSeq--;

export default function EvaluationForms({ toast, askConfirm, onNavigate }) {
  const [forms, setForms] = useState([]);
  const [evals, setEvals] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [builderForm, setBuilderForm] = useState(null); // local editable copy, or null
  const [performOpen, setPerformOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  const reload = useCallback(() => {
    return Promise.all([api('/api/evaluation-forms'), api('/api/evaluations?limit=10')])
      .then(([f, e]) => { setForms(f.data); setEvals(e.data); });
  }, []);

  useEffect(() => {
    Promise.all([reload(), api('/api/evaluation-forms/options').then((r) => setInteractions(r.interactions))])
      .catch(() => toast('Could not load evaluation forms from backend'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createForm() {
    setBuilderForm({ id: null, name: '', published: false, isNew: true, groups: [{ id: localId(), name: 'Group 1', questions: [] }] });
  }

  // Unsaved new forms never touched the backend, so closing one is purely local.
  function closeBuilder() {
    setBuilderForm(null);
  }

  async function saveCloseForm(form) {
    const { data } = form.id
      ? await api(`/api/evaluation-forms/${form.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await api('/api/evaluation-forms', { method: 'POST', body: JSON.stringify(form) });
    await reload();
    setBuilderForm(null);
    toast('Form saved');
    return data;
  }

  async function publishForm(form) {
    const payload = { ...form, published: true };
    const { data } = form.id
      ? await api(`/api/evaluation-forms/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await api('/api/evaluation-forms', { method: 'POST', body: JSON.stringify(payload) });
    await reload();
    toast(`<b>${data.name}</b> published`);
    return data;
  }

  function deleteForm(id, name) {
    setMenuFor(null);
    askConfirm(`Delete form <b>${name || 'Untitled'}</b>? Existing evaluations keep their scores.`, async () => {
      try {
        if (id) await api(`/api/evaluation-forms/${id}`, { method: 'DELETE' });
        setBuilderForm(null);
        await reload();
        toast('Form deleted');
      } catch (e) {
        toast(e.message);
      }
    });
  }

  const publishedForms = forms.filter((f) => f.published);

  return (
    <>
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Quality</div>
        <div className="tt">
          <h1>Evaluation Forms</h1>
          <div className="rt">
            <button className="btn" onClick={createForm}>+ Create Form</button>
            <button
              className="btn sec"
              onClick={() => {
                if (!publishedForms.length) { toast('Publish an evaluation form first'); return; }
                setPerformOpen(true);
              }}
            >
              Perform Evaluation
            </button>
          </div>
        </div>
        <div className="tabs"><div className="tb on">Forms ({forms.length})</div></div>
      </div>

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead><tr><th>Form</th><th>Groups</th><th>Questions</th><th>Max score</th><th>Status</th><th>Evaluations</th><th style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>Loading…</td></tr>}
              {!loading && forms.map((f) => (
                <tr key={f.id} onClick={() => setBuilderForm({ ...f, isNew: false })}>
                  <td><b className="lnk">{f.name || 'Untitled'}</b></td>
                  <td>{f.groups.length}</td>
                  <td>{formQCount(f)}</td>
                  <td>{formMax(f)} pts</td>
                  <td>{f.published ? <span className="st ok"><span className="d" />Published</span> : <span className="st wn"><span className="d" />Draft</span>}</td>
                  <td>{f.evaluationCount}</td>
                  <td style={{ color: '#a9b3c2', position: 'relative' }} onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === f.id ? null : f.id); }}>
                    ⋮
                    {menuFor === f.id && (
                      <div style={{ position: 'absolute', right: 0, top: 24, background: '#fff', border: '1px solid #dde3ec', borderRadius: 6, boxShadow: '0 10px 24px rgba(16,30,60,.18)', zIndex: 5, minWidth: 120 }}>
                        <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#3c4a5c', cursor: 'pointer' }} onClick={() => { setMenuFor(null); setBuilderForm({ ...f, isNew: false }); }}>Edit</div>
                        <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#b3261e', cursor: 'pointer' }} onClick={() => deleteForm(f.id, f.name)}>Delete</div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h1 style={{ fontSize: 15, margin: '18px 0 6px' }}>Recent evaluations ({evals.length})</h1>
        <div className="tblw">
          <table className="dt">
            <thead><tr><th>Agent</th><th>Interaction</th><th>Form</th><th>Score</th><th>When</th></tr></thead>
            <tbody>
              {evals.length ? evals.map((e) => {
                const col = e.pct >= 85 ? '#1f9d63' : e.pct >= 60 ? '#e0a200' : '#b3261e';
                return (
                  <tr key={e.id}>
                    <td><b>{e.agent}</b></td>
                    <td>{e.interaction}</td>
                    <td>{e.formName}</td>
                    <td><b style={{ color: col }}>{e.pct}%</b>{e.criticalFail && <span className="tag o" style={{ marginLeft: 6 }}>critical fail</span>}</td>
                    <td>{new Date(e.t).toLocaleTimeString()}</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8794a8', padding: 18 }}>No evaluations yet — click Perform Evaluation</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {builderForm && (
        <FormBuilder
          form={builderForm}
          onPatch={(fn) => setBuilderForm(fn)}
          onClose={closeBuilder}
          onSaveClose={saveCloseForm}
          onPublish={publishForm}
          onDelete={() => deleteForm(builderForm.id, builderForm.name)}
          toast={toast}
        />
      )}

      {performOpen && (
        <PerformEvalDrawer
          forms={publishedForms}
          interactions={interactions}
          onClose={() => setPerformOpen(false)}
          onScored={() => reload()}
          toast={toast}
        />
      )}
    </>
  );
}

function FormBuilder({ form, onPatch, onClose, onSaveClose, onPublish, onDelete, toast }) {
  const [qText, setQText] = useState({});
  const [qWeight, setQWeight] = useState({});
  const [qCrit, setQCrit] = useState({});
  const [groupName, setGroupName] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const liveNameError = touched ? nameError(form.name) : null;

  function addQuestion(gi) {
    const text = (qText[gi] || '').trim();
    if (text.length < 3) { toast('Question text is required'); return; }
    const weight = Math.max(1, Math.min(100, parseInt(qWeight[gi], 10) || 10));
    const critical = !!qCrit[gi];
    onPatch((f) => {
      const groups = f.groups.map((g, i) => (i === gi ? { ...g, questions: [...g.questions, { id: localId(), text, weight, critical }] } : g));
      return { ...f, groups };
    });
    setQText((s) => ({ ...s, [gi]: '' }));
    setQWeight((s) => ({ ...s, [gi]: '' }));
    setQCrit((s) => ({ ...s, [gi]: false }));
  }

  function removeQuestion(gi, qi) {
    onPatch((f) => {
      const groups = f.groups.map((g, i) => (i === gi ? { ...g, questions: g.questions.filter((_, j) => j !== qi) } : g));
      return { ...f, groups };
    });
  }

  function addGroup() {
    const n = groupName.trim();
    if (n.length < 2) { toast('Group name is required'); return; }
    onPatch((f) => ({ ...f, groups: [...f.groups, { id: localId(), name: n, questions: [] }] }));
    setGroupName('');
  }

  function removeGroup(gi) {
    onPatch((f) => {
      let groups = f.groups.filter((_, i) => i !== gi);
      if (!groups.length) groups = [{ id: localId(), name: 'Group 1', questions: [] }];
      return { ...f, groups };
    });
  }

  async function handleSaveClose() {
    setTouched(true);
    if (nameError(form.name)) return;
    setSaving(true);
    setServerError('');
    setFieldErrors({});
    try {
      await onSaveClose(form);
    } catch (e) {
      if (e.fields) setFieldErrors(e.fields);
      else setServerError(e.message);
      setSaving(false);
    }
  }

  async function handlePublish() {
    setTouched(true);
    if (nameError(form.name)) return;
    setSaving(true);
    setServerError('');
    setFieldErrors({});
    try {
      // Publish keeps the drawer open (unlike Save & close), so the local copy must pick up
      // the id the backend just assigned — otherwise a second click would POST a duplicate
      // instead of PUT-ing the now-persisted form.
      const saved = await onPublish(form);
      onPatch(() => ({ ...saved, isNew: false }));
    } catch (e) {
      if (e.fields) setFieldErrors(e.fields);
      else setServerError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="scrim" onClick={onClose}>
      <div id="drw" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="dh">
          <h2>{form.name || 'New Evaluation Form'} <span className={'tag' + (form.published ? '' : ' o')} style={{ marginLeft: 6 }}>{form.published ? 'Published' : 'Draft'}</span></h2>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="db">
          {serverError && <div className="errbox">{serverError}</div>}
          <div className="fld">
            <label>Form name *</label>
            <input
              value={form.name}
              maxLength={NAME_MAX}
              onChange={(e) => { onPatch((f) => ({ ...f, name: e.target.value })); setTouched(true); }}
              onBlur={() => setTouched(true)}
              style={(liveNameError || fieldErrors.name) ? { borderColor: '#b3261e', boxShadow: '0 0 0 3px rgba(179,38,30,.1)' } : undefined}
            />
            {(liveNameError || fieldErrors.name) && <div style={{ color: '#b3261e', fontSize: 11.5, marginTop: 3 }}>{liveNameError || fieldErrors.name}</div>}
          </div>
          {fieldErrors.groups && <div style={{ color: '#b3261e', fontSize: 11.5, marginBottom: 10 }}>{fieldErrors.groups}</div>}

          {form.groups.map((g, gi) => (
            <div key={g.id}>
              <div className="sect" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {g.name}
                <a className="lnk" style={{ fontSize: 11, textTransform: 'none', letterSpacing: 0 }} onClick={() => removeGroup(gi)}>delete group</a>
              </div>
              {g.questions.length ? g.questions.map((q, qi) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f2f5f9', fontSize: '12.5px' }}>
                  <span style={{ flex: 1 }}>{q.text}{q.critical && <span className="tag o" style={{ marginLeft: 6 }}>critical</span>}</span>
                  <span className="tag">{q.weight} pts</span>
                  <a className="lnk" style={{ fontSize: 11 }} onClick={() => removeQuestion(gi, qi)}>remove</a>
                </div>
              )) : <div style={{ color: '#8794a8', fontSize: 12, padding: '4px 0' }}>No questions</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <input placeholder="New question text" style={{ flex: 1, height: 30, border: '1px solid #ccd4e0', borderRadius: 4, padding: '0 8px', fontSize: 12 }}
                  value={qText[gi] || ''} onChange={(e) => setQText((s) => ({ ...s, [gi]: e.target.value }))} />
                <input type="number" min="1" max="100" placeholder="10" title="weight" style={{ width: 56, height: 30, border: '1px solid #ccd4e0', borderRadius: 4, padding: '0 6px', fontSize: 12 }}
                  value={qWeight[gi] ?? ''} onChange={(e) => setQWeight((s) => ({ ...s, [gi]: e.target.value }))} />
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={!!qCrit[gi]} onChange={(e) => setQCrit((s) => ({ ...s, [gi]: e.target.checked }))} />crit
                </label>
                <button className="btn sec" style={{ height: 30 }} onClick={() => addQuestion(gi)}>+ Add</button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <input placeholder="New group name" style={{ flex: 1, height: 30, border: '1px solid #ccd4e0', borderRadius: 4, padding: '0 8px', fontSize: 12 }}
              value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <button className="btn sec" style={{ height: 30 }} onClick={addGroup}>+ Add group</button>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: '#5b6b82' }}>
            Max score: <b>{formMax(form)} pts</b> — a failed <b>critical</b> question caps the evaluation at 0 for its group and flags the evaluation.
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            {!form.published && <button className="btn" onClick={handlePublish} disabled={saving}>{saving ? 'Publishing…' : 'Publish form'}</button>}
            {!form.isNew && <button className="btn gh" onClick={onDelete} disabled={saving}>Delete form</button>}
          </div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose} disabled={saving}>Close</button>
          <button className="btn" onClick={handleSaveClose} disabled={saving}>{saving ? 'Saving…' : 'Save & close'}</button>
        </div>
      </div>
    </div>
  );
}

function PerformEvalDrawer({ forms, interactions, onClose, onScored, toast }) {
  const [interactionIdx, setInteractionIdx] = useState(0);
  const [formId, setFormId] = useState(forms[0]?.id);
  const [answers, setAnswers] = useState({}); // questionId -> 'yes'|'no'|'na'
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const form = forms.find((f) => f.id === formId);

  function setAnswer(qid, v) {
    setAnswers((a) => ({ ...a, [qid]: v }));
  }

  // Live client-side preview only — the persisted score always comes back from the server,
  // which recomputes it from the form's live question set rather than trusting this value.
  function previewScore() {
    let earned = 0, possible = 0, criticalFail = false;
    form.groups.forEach((g) => {
      let gEarned = 0, gPossible = 0, gCrit = false;
      g.questions.forEach((q) => {
        const v = answers[q.id] || 'yes';
        if (v === 'na') return;
        gPossible += q.weight;
        if (v === 'yes') gEarned += q.weight;
        else if (q.critical) gCrit = true;
      });
      if (gCrit) { gEarned = 0; criticalFail = true; }
      earned += gEarned; possible += gPossible;
    });
    return { pct: possible ? Math.round((earned / possible) * 100) : 0, earned, possible, criticalFail };
  }

  async function submit() {
    setSubmitting(true);
    try {
      const { data } = await api('/api/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          formId,
          interactionIndex: interactionIdx,
          answers: form.groups.flatMap((g) => g.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] || 'yes' }))),
        }),
      });
      setResult(data);
      onScored();
      toast(`Evaluation saved — ${data.agent} scored <b>${data.pct}%</b>`);
    } catch (e) {
      toast(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const preview = form ? previewScore() : null;
  const shown = result || preview;
  const col = shown ? (shown.pct >= 85 ? '#1f9d63' : shown.pct >= 60 ? '#e0a200' : '#b3261e') : '';

  return (
    <div id="scrim" onClick={onClose}>
      <div id="drw" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>Perform Evaluation</h2><button className="x" onClick={onClose}>×</button></div>
        <div className="db">
          <div className="fld">
            <label>Interaction</label>
            <select value={interactionIdx} onChange={(e) => { setInteractionIdx(Number(e.target.value)); setResult(null); }}>
              {interactions.map((i) => <option key={i.index} value={i.index}>{i.agent} — {i.customer} ({i.queue}, {i.duration})</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Form</label>
            <select value={formId} onChange={(e) => { setFormId(Number(e.target.value)); setAnswers({}); setResult(null); }}>
              {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          {form && form.groups.map((g) => (
            <div key={g.id}>
              <div className="sect">{g.name}</div>
              {g.questions.map((q) => {
                const val = answers[q.id] || 'yes';
                return (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f2f5f9', fontSize: '12.5px' }}>
                    <span style={{ flex: 1 }}>{q.text}{q.critical && <span className="tag o" style={{ marginLeft: 6 }}>critical</span>} <span style={{ color: '#8794a8' }}>({q.weight} pts)</span></span>
                    {['yes', 'no', 'na'].map((opt) => (
                      <label key={opt} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <input type="radio" name={`evq_${q.id}`} checked={val === opt} onChange={() => { setAnswer(q.id, opt); setResult(null); }} style={{ width: 'auto' }} />
                        {opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : 'N/A'}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
          {shown && (
            <div style={{ fontSize: 13, marginTop: 8 }}>
              <div style={{ background: '#f5f7fa', borderRadius: 6, padding: '12px 14px' }}>
                Score: <b style={{ fontSize: 20, color: col }}>{shown.pct}%</b> ({shown.earned}/{shown.possible} pts)
                {shown.criticalFail && <> — <b style={{ color: '#b3261e' }}>critical question failed: group zeroed</b></>}
              </div>
            </div>
          )}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn" onClick={submit} disabled={submitting || !form}>{submitting ? 'Saving…' : 'Score & save'}</button>
        </div>
      </div>
    </div>
  );
}
