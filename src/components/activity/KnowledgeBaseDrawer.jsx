import { useState } from 'react';
import Drawer from '../Drawer';

const CATS = ['Billing', 'Retention', 'Technical', 'Field', 'Payments'];

// Ported from kbManage()/kbOpen()/kbSave() (lines 9153-9193). kbEdit()'s exact
// markup wasn't recovered from the source, but kbSave()'s field reads
// (#kb_t/#kb_k/#kb_c/#kb_b) pin down the form shape exactly, so the edit
// form here is reconstructed from that rather than guessed from nothing.
export default function KnowledgeBaseDrawer({ kb, actions, initialArticleId, onClose }) {
  const [mode, setMode] = useState(initialArticleId ? 'view' : 'list');
  const [articleId, setArticleId] = useState(initialArticleId || null);
  const [form, setForm] = useState(null);

  const article = kb.find((a) => a.id === articleId);

  function openEdit(a) {
    setForm(a ? { id: a.id, title: a.title, cat: a.cat, kws: a.kws.join(', '), body: a.body } : { id: null, title: '', cat: CATS[0], kws: '', body: '' });
    setMode('edit');
  }

  function save() {
    const title = form.title.trim();
    const kws = form.kws.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const body = form.body.trim();
    if (title.length < 3 || !kws.length || body.length < 10) return;
    actions.kbSave({ id: form.id, title, cat: form.cat, kws, body });
    setMode('list');
  }

  if (mode === 'edit') {
    return (
      <Drawer title={form.id ? 'Edit article' : 'New article'} onClose={onClose} panelStyle={{ width: 560 }} footer={<>
        <button className="btn sec" onClick={() => setMode('list')}>Cancel</button>
        <button className="btn" onClick={save}>Save</button>
      </>}>
        <div className="fld"><label>Title</label><input id="kb_t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="fld">
          <label>Category</label>
          <select id="kb_c" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="fld"><label>Keywords (comma separated)</label><input id="kb_k" value={form.kws} onChange={(e) => setForm({ ...form, kws: e.target.value })} /></div>
        <div className="fld"><label>Body</label><textarea id="kb_b" style={{ height: 140 }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
      </Drawer>
    );
  }

  if (mode === 'view' && article) {
    return (
      <Drawer title={<>📖 {article.title}</>} onClose={onClose} panelStyle={{ width: 480 }} footer={<>
        <button className="btn sec" onClick={onClose}>Close</button>
        <button className="btn" onClick={() => openEdit(article)}>Edit article</button>
      </>}>
        <span className="tag o">{article.cat}</span>
        <div style={{ background: '#f8f9fc', border: '1px solid #e7ebf2', borderRadius: 8, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.75, whiteSpace: 'pre-line', marginTop: 8 }}>
          {article.body}
        </div>
        <div style={{ fontSize: 11, color: '#8794a8', marginTop: 8 }}>Spotted on: {article.kws.join(' · ')}</div>
      </Drawer>
    );
  }

  return (
    <Drawer title={'Knowledge base (' + kb.length + ')'} onClose={onClose} panelStyle={{ width: 560 }} footer={<>
      <button className="btn sec" onClick={onClose}>Close</button>
      <button className="btn" onClick={() => openEdit(null)}>＋ New article</button>
    </>}>
      <div className="tblw">
        <table className="dt">
          <thead><tr><th>Article</th><th>Category</th><th>Keywords</th></tr></thead>
          <tbody>
            {kb.map((a) => (
              <tr key={a.id} onClick={() => { setArticleId(a.id); setMode('view'); }}>
                <td><b className="lnk">{a.title}</b></td>
                <td>{a.cat}</td>
                <td style={{ fontSize: 11, color: '#8794a8' }}>{a.kws.slice(0, 3).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Drawer>
  );
}
