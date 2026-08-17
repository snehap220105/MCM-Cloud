import { useState } from 'react';

const INTERACTIONS = [
  { agent: 'Sofia Petrova', name: 'Oliver Smith', queue: 'Retail_Billing_L1', dur: '04:12' },
  { agent: 'Rajan Patel', name: 'Amelia Jones', queue: 'Collections_Arrears', dur: '06:48' },
];

let uidSeq = 100;
const uid = () => 'x' + uidSeq++;

const INITIAL_FORMS = [
  {
    id: 'f1',
    name: 'Standard Call QA v2',
    published: true,
    groups: [
      { name: 'Greeting & Compliance', questions: [
        { id: uid(), text: 'Used approved greeting and identified themselves', weight: 10, critical: false },
        { id: uid(), text: 'Completed DPA/identity verification before account discussion', weight: 20, critical: true },
      ] },
      { name: 'Handling', questions: [
        { id: uid(), text: 'Actively listened and acknowledged the issue', weight: 15, critical: false },
        { id: uid(), text: 'Provided a correct and complete resolution', weight: 25, critical: false },
        { id: uid(), text: 'Offered additional help before closing', weight: 10, critical: false },
      ] },
      { name: 'Wrap-up', questions: [
        { id: uid(), text: 'Selected the correct wrap-up code', weight: 10, critical: false },
        { id: uid(), text: 'Notes are clear and complete', weight: 10, critical: false },
      ] },
    ],
  },
];

const formMax = (f) => f.groups.reduce((s, g) => s + g.questions.reduce((s2, q) => s2 + q.weight, 0), 0);
const formQCount = (f) => f.groups.reduce((s, g) => s + g.questions.length, 0);

export default function EvaluationForms({ toast, askConfirm, onNavigate }) {
  const [forms, setForms] = useState(INITIAL_FORMS);
  const [evals, setEvals] = useState([]);
  const [builderId, setBuilderId] = useState(null);
  const [performOpen, setPerformOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  function patchForm(id, fn) {
    setForms((list) => list.map((f) => (f.id === id ? fn(f) : f)));
  }

  function createForm() {
    const f = { id: uid(), name: '', published: false, isNew: true, groups: [{ name: 'Group 1', questions: [] }] };
    setForms((list) => [...list, f]);
    setBuilderId(f.id);
  }

  function closeBuilder(discardIfEmpty) {
    if (discardIfEmpty) {
      setForms((list) => {
        const f = list.find((x) => x.id === builderId);
        if (f && f.isNew && (!f.name || !f.groups.some((g) => g.questions.length))) {
          return list.filter((x) => x.id !== builderId);
        }
        return list;
      });
    }
    setBuilderId(null);
  }

  function saveCloseForm() {
    const f = forms.find((x) => x.id === builderId);
    if (!f.name || f.name.trim().length < 2) { toast('Form name is required.'); return; }
    patchForm(builderId, (x) => ({ ...x, isNew: false }));
    toast('Form saved');
    setBuilderId(null);
  }

  function publishForm() {
    const f = forms.find((x) => x.id === builderId);
    if (!f.name || f.name.trim().length < 2) { toast('Give the form a name before publishing.'); return; }
    if (!formQCount(f)) { toast('Add at least one question before publishing.'); return; }
    patchForm(builderId, (x) => ({ ...x, published: true, isNew: false }));
    toast(`<b>${f.name}</b> published`);
  }

  function deleteForm(id, name) {
    setMenuFor(null);
    askConfirm(`Delete form <b>${name || 'Untitled'}</b>? Existing evaluations keep their scores.`, () => {
      setForms((list) => list.filter((f) => f.id !== id));
      setBuilderId(null);
      toast('Form deleted');
    });
  }

  const builderForm = forms.find((f) => f.id === builderId);
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
              {forms.map((f) => (
                <tr key={f.id} onClick={() => setBuilderId(f.id)}>
                  <td><b className="lnk">{f.name || 'Untitled'}</b></td>
                  <td>{f.groups.length}</td>
                  <td>{formQCount(f)}</td>
                  <td>{formMax(f)} pts</td>
                  <td>{f.published ? <span className="st ok"><span className="d" />Published</span> : <span className="st wn"><span className="d" />Draft</span>}</td>
                  <td>{evals.filter((e) => e.form === f.id).length}</td>
                  <td style={{ color: '#a9b3c2', position: 'relative' }} onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === f.id ? null : f.id); }}>
                    ⋮
                    {menuFor === f.id && (
                      <div style={{ position: 'absolute', right: 0, top: 24, background: '#fff', border: '1px solid #dde3ec', borderRadius: 6, boxShadow: '0 10px 24px rgba(16,30,60,.18)', zIndex: 5, minWidth: 120 }}>
                        <div style={{ padding: '8px 14px', fontSize: 12.5, color: '#3c4a5c', cursor: 'pointer' }} onClick={() => { setMenuFor(null); setBuilderId(f.id); }}>Edit</div>
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
              {evals.length ? evals.slice(0, 10).map((e) => {
                const f = forms.find((x) => x.id === e.form);
                const col = e.pct >= 85 ? '#1f9d63' : e.pct >= 60 ? '#e0a200' : '#b3261e';
                return (
                  <tr key={e.id}>
                    <td><b>{e.agent}</b></td>
                    <td>{e.interaction}</td>
                    <td>{f ? f.name : '—'}</td>
                    <td><b style={{ color: col }}>{e.pct}%</b>{e.criticalFail && <span className="tag o" style={{ marginLeft: 6 }}>critical fail</span>}</td>
                    <td>{e.t}</td>
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
          onPatch={(fn) => patchForm(builderForm.id, fn)}
          onClose={() => closeBuilder(true)}
          onSaveClose={saveCloseForm}
          onPublish={publishForm}
          onDelete={() => deleteForm(builderForm.id, builderForm.name)}
          toast={toast}
        />
      )}

      {performOpen && (
        <PerformEvalDrawer
          forms={publishedForms}
          onClose={() => setPerformOpen(false)}
          onScored={(rec) => setEvals((list) => [rec, ...list])}
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

  function addQuestion(gi) {
    const text = (qText[gi] || '').trim();
    if (text.length < 3) { toast('Question text is required'); return; }
    const weight = Math.max(1, parseInt(qWeight[gi], 10) || 10);
    const critical = !!qCrit[gi];
    onPatch((f) => {
      const groups = f.groups.map((g, i) => (i === gi ? { ...g, questions: [...g.questions, { id: Math.random(), text, weight, critical }] } : g));
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
    onPatch((f) => ({ ...f, groups: [...f.groups, { name: n, questions: [] }] }));
    setGroupName('');
  }

  function removeGroup(gi) {
    onPatch((f) => {
      let groups = f.groups.filter((_, i) => i !== gi);
      if (!groups.length) groups = [{ name: 'Group 1', questions: [] }];
      return { ...f, groups };
    });
  }

  return (
    <div id="scrim" onClick={onClose}>
      <div id="drw" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="dh">
          <h2>{form.name || 'New Evaluation Form'} <span className={'tag' + (form.published ? '' : ' o')} style={{ marginLeft: 6 }}>{form.published ? 'Published' : 'Draft'}</span></h2>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="db">
          <div className="fld"><label>Form name *</label><input value={form.name} onChange={(e) => onPatch((f) => ({ ...f, name: e.target.value }))} /></div>

          {form.groups.map((g, gi) => (
            <div key={gi}>
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
                <input type="number" placeholder="10" title="weight" style={{ width: 56, height: 30, border: '1px solid #ccd4e0', borderRadius: 4, padding: '0 6px', fontSize: 12 }}
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
            {!form.published && <button className="btn" onClick={onPublish}>Publish form</button>}
            <button className="btn gh" onClick={onDelete}>Delete form</button>
          </div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Close</button>
          <button className="btn" onClick={onSaveClose}>Save &amp; close</button>
        </div>
      </div>
    </div>
  );
}

function PerformEvalDrawer({ forms, onClose, onScored, toast }) {
  const [interactionIdx, setInteractionIdx] = useState(0);
  const [formId, setFormId] = useState(forms[0]?.id);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const form = forms.find((f) => f.id === formId);

  function setAnswer(gi, qi, v) {
    setAnswers((a) => ({ ...a, [`${gi}_${qi}`]: v }));
  }

  function score() {
    const i = INTERACTIONS[interactionIdx];
    let earned = 0, possible = 0, criticalFail = false;
    form.groups.forEach((g, gi) => {
      let gEarned = 0, gPossible = 0, gCrit = false;
      g.questions.forEach((q, qi) => {
        const v = answers[`${gi}_${qi}`] || 'yes';
        if (v === 'na') return;
        gPossible += q.weight;
        if (v === 'yes') gEarned += q.weight;
        else if (q.critical) gCrit = true;
      });
      if (gCrit) { gEarned = 0; criticalFail = true; }
      earned += gEarned; possible += gPossible;
    });
    const pct = possible ? Math.round((earned / possible) * 100) : 0;
    setResult({ pct, earned, possible, criticalFail });
    onScored({ id: Math.random(), form: form.id, agent: i.agent, interaction: `${i.name} · ${i.queue}`, pct, criticalFail, t: new Date().toLocaleTimeString() });
    toast(`Evaluation saved — ${i.agent} scored <b>${pct}%</b>`);
  }

  const col = result ? (result.pct >= 85 ? '#1f9d63' : result.pct >= 60 ? '#e0a200' : '#b3261e') : '';

  return (
    <div id="scrim" onClick={onClose}>
      <div id="drw" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="dh"><h2>Perform Evaluation</h2><button className="x" onClick={onClose}>×</button></div>
        <div className="db">
          <div className="fld">
            <label>Interaction</label>
            <select value={interactionIdx} onChange={(e) => setInteractionIdx(Number(e.target.value))}>
              {INTERACTIONS.map((i, idx) => <option key={idx} value={idx}>{i.agent} — {i.name} ({i.queue}, {i.dur})</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Form</label>
            <select value={formId} onChange={(e) => { setFormId(e.target.value); setAnswers({}); setResult(null); }}>
              {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          {form && form.groups.map((g, gi) => (
            <div key={gi}>
              <div className="sect">{g.name}</div>
              {g.questions.map((q, qi) => {
                const key = `${gi}_${qi}`;
                const val = answers[key] || 'yes';
                return (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f2f5f9', fontSize: '12.5px' }}>
                    <span style={{ flex: 1 }}>{q.text}{q.critical && <span className="tag o" style={{ marginLeft: 6 }}>critical</span>} <span style={{ color: '#8794a8' }}>({q.weight} pts)</span></span>
                    {['yes', 'no', 'na'].map((opt) => (
                      <label key={opt} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <input type="radio" name={`evq_${gi}_${qi}`} checked={val === opt} onChange={() => setAnswer(gi, qi, opt)} style={{ width: 'auto' }} />
                        {opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : 'N/A'}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
          {result && (
            <div style={{ fontSize: 13, marginTop: 8 }}>
              <div style={{ background: '#f5f7fa', borderRadius: 6, padding: '12px 14px' }}>
                Score: <b style={{ fontSize: 20, color: col }}>{result.pct}%</b> ({result.earned}/{result.possible} pts)
                {result.criticalFail && <> — <b style={{ color: '#b3261e' }}>critical question failed: group zeroed</b></>}
              </div>
            </div>
          )}
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={score}>Score &amp; save</button>
        </div>
      </div>
    </div>
  );
}
