import { useState } from 'react';
import help from '../../data/help.json';

// Renders the "Help & Resources" block from src/data/help.json — same content source the
// Screen Gallery cards use, keyed by the same page id, so this panel and the gallery's
// keyword/topic chips can never drift apart.
export default function HelpResourcesPanel({ pageKey, toast }) {
  const [open, setOpen] = useState(true);
  const h = help[pageKey];
  if (!h) return null;

  const notAvailable = () => toast('Not available in this prototype.');

  return (
    <div className="hrp">
      <div className="hrp-head">
        <span className="hrp-i">ⓘ</span>
        <b>Help &amp; Resources — {h.t}</b>
        <div style={{ flex: 1 }} />
        <a className="lnk" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'}</a>
      </div>
      {open && (
        <div className="hrp-body">
          <div className="hrp-col">
            <div className="hrp-h">What you can do here</div>
            <ul className="hrp-topics">
              {h.topics.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <div className="hrp-h" style={{ marginTop: 16 }}>Keywords</div>
            <div>
              {h.kws.map((k) => <span className="tag" key={k}>{k}</span>)}
            </div>
          </div>
          <div className="hrp-col">
            <div className="hrp-h">Training videos</div>
            {h.vids.map(([title, sub, dur]) => (
              <div className="hrp-vid" key={title} onClick={notAvailable}>
                <span className="hrp-play">▶</span>
                <div className="hrp-vid-info"><b>{title}</b><div className="hrp-sub">{sub}</div></div>
                <span className="hrp-dur">{dur}</span>
              </div>
            ))}
            <div className="hrp-h" style={{ marginTop: 16 }}>Reference documentation</div>
            <div>
              <a className="lnk" onClick={notAvailable}>Help Centre › {h.t}</a>
              <span style={{ margin: '0 8px', color: '#c9d2df' }}>|</span>
              <a className="lnk" onClick={notAvailable}>Search docs for &ldquo;{h.t}&rdquo;</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
