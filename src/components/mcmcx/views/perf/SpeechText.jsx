/**
 * Performance › Speech & Text.
 *
 * Ported from the prototype's "Engine v12.6 (Speech & Text Analytics +
 * Surveys)" patch. Every handled voice/chat interaction is scored for
 * sentiment and spotted for topics; the tab shows the sentiment KPIs, topic
 * frequency, the agent sentiment ranking, the CSAT survey stream and the topic
 * phrase management drawer.
 *
 * The transcript helpers `staOf` / `staTranscript` (the prototype's
 * `window.__staOf` and `window.__staTranscript`) live here and are exported so
 * the interaction detail drawer can reuse them, exactly as the legacy scripts
 * reached for the globals.
 */
import { useEffect, useState } from 'react';
import { audit, db as store, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
/* --------------------------------------------------------------- helpers */

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
function dayISO(off = 0) {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The prototype's stable 16-bit string hash — keeps the demo deterministic. */
function hash(value) {
  const s = String(value);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

/* ---------------------------------------------------------------- topics */

/** The shape the prototype actually stored in `DB.staTopics`. */

/** Names of the topics the engine seeds; custom topics are spotted differently. */
const BUILT_IN = [
  'Billing dispute',
  'Payment arrangement',
  'Cancellation risk',
  'Technical issue',
  'Escalation',
  'Positive feedback',
];
function isTopic(t) {
  return typeof t.name === 'string' && typeof t.base === 'number' && Array.isArray(t.phrases);
}

/**
 * The prototype's `ensureSTA()`. The seed payload ships without `staTopics`, so
 * the topic set is created on first read. This writes without a commit — the
 * caller is already rendering and will see the value; the tab also seeds from
 * an effect so other subscribers get their re-render.
 */
function ensureSta(database = store) {
  if (database.staTopics) return;
  database.staTopics = [
    {
      id: uid(),
      name: 'Billing dispute',
      base: -25,
      phrases: ['charged twice', 'higher than usual', 'overcharged', 'bill is wrong'],
    },
    {
      id: uid(),
      name: 'Payment arrangement',
      base: -5,
      phrases: ['payment plan', 'pay in instalments', 'more time to pay', 'direct debit'],
    },
    {
      id: uid(),
      name: 'Cancellation risk',
      base: -35,
      phrases: [
        'cancel my account',
        'switch provider',
        'thinking of leaving',
        'better deal elsewhere',
      ],
    },
    {
      id: uid(),
      name: 'Technical issue',
      base: -15,
      phrases: ['not working', 'keeps dropping', 'error message', 'no service'],
    },
    {
      id: uid(),
      name: 'Escalation',
      base: -45,
      phrases: [
        'speak to a manager',
        'make a complaint',
        'this is unacceptable',
        'third time calling',
      ],
    },
    {
      id: uid(),
      name: 'Positive feedback',
      base: 50,
      phrases: ['really helpful', 'great service', 'thank you so much', 'sorted it quickly'],
    },
  ];
  if (!database.surveys) database.surveys = [];
}
export function staTopics(database = store) {
  ensureSta(database);
  return (database.staTopics ?? []).filter(isTopic);
}
function topicByName(name) {
  return staTopics().find((t) => t.name === name);
}

/* --------------------------------------------------- sentiment and topics */

/**
 * Analysis is cached per interaction, as the prototype cached it on `x.__sta`.
 * Editing or deleting a topic bumps the generation, which re-spots everything —
 * the legacy code deleted `__sta` from every interaction for the same reason.
 */
const staCache = new WeakMap();
let staGeneration = 0;

/** Invalidate every cached analysis — the topic definitions changed. */
function respotAll() {
  staGeneration += 1;
}
function topicsFor(x) {
  const h = hash(x.id || x.name + x.t);
  const out = [];
  const q = (x.queue || '').toLowerCase();
  if (/bill/.test(q)) out.push(h % 3 === 0 ? 'Payment arrangement' : 'Billing dispute');
  else if (/complaint/.test(q)) out.push(h % 2 === 0 ? 'Escalation' : 'Cancellation risk');
  else if (/collect|arrear/.test(q)) out.push('Payment arrangement');
  else if (/tech|digital|messag/.test(q)) out.push('Technical issue');
  else out.push(['Billing dispute', 'Technical issue', 'Payment arrangement'][h % 3]);
  if (x.wrap === 'Escalated' && out.indexOf('Escalation') < 0) out.push('Escalation');
  if (x.result !== 'Abandoned' && /resolv/i.test(x.wrap || '') && h % 3 === 0)
    out.push('Positive feedback');
  /* custom topics get spotted occasionally */
  staTopics().forEach((t) => {
    if (BUILT_IN.indexOf(t.name) > -1) return;
    if (hash(String(x.id) + t.name) % 6 === 0) out.push(t.name);
  });
  return out;
}

/** The prototype's `window.__staOf` — topics + overall sentiment for one interaction. */
export function staOf(x) {
  const cached = staCache.get(x);
  if (cached && cached.gen === staGeneration) return cached.result;
  ensureSta();
  const h = hash(x.id || x.name + x.t);
  const tps = topicsFor(x);
  let s = 0;
  tps.forEach((n) => {
    const t = topicByName(n);
    if (t) s += t.base;
  });
  s = Math.round(s / Math.max(1, tps.length));
  if (x.result === 'Abandoned') s -= 30;
  else if (/resolv|payment taken|upgraded/i.test(x.wrap || '')) s += 32;
  s += (h % 31) - 15;
  s = Math.max(-100, Math.min(100, s));
  const result = {
    topics: tps,
    sent: s,
  };
  staCache.set(x, {
    gen: staGeneration,
    result,
  });
  return result;
}
export function sentLbl(s) {
  const colour = s > 15 ? '#1f9d63' : s < -15 ? '#d0342c' : '#e0a200';
  const label = s > 15 ? 'Positive' : s < -15 ? 'Negative' : 'Neutral';
  return (
    <span
      style={{
        color: colour,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

/* -------------------------------------------------- transcript generation */

function phraseOf(topic, h) {
  const t = topicByName(topic);
  return t ? t.phrases[h % t.phrases.length] : '';
}

/** The prototype's `mark()` — highlights the spotted phrase inside a turn. */
export function markPhrase(text, phrase) {
  if (!phrase) return text;
  const i = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span
        style={{
          background: '#fff0b3',
          borderRadius: 3,
          padding: '0 3px',
        }}
      >
        {text.slice(i, i + phrase.length)}
      </span>
      {text.slice(i + phrase.length)}
    </>
  );
}

/** The prototype's `window.__staTranscript` — the simulated speech-to-text turns. */
export function staTranscript(x) {
  const h = hash(x.id || x.name + x.t);
  const st = staOf(x);
  const first = x.name.split(' ')[0];
  const mainTopic = st.topics[0] || 'Billing dispute';
  const ph = phraseOf(mainTopic, h);
  const resolved = /resolv|payment taken|upgraded/i.test(x.wrap || '');
  return [
    {
      who: 'agent',
      s: 10,
      t:
        "Thank you for calling, you're through to " +
        (x.agent || 'the team') +
        ' on ' +
        (x.queue || 'support') +
        '. How can I help today?',
    },
    {
      who: 'cust',
      s: st.sent < 0 ? -30 : 0,
      t:
        "Hi, it's " +
        x.name +
        ". I'm calling because my " +
        (ph || 'account issue') +
        ' — this really needs sorting.',
      ph,
    },
    {
      who: 'agent',
      s: 5,
      t:
        "I'm sorry to hear that, " +
        first +
        '. Let me pull up the account and take a look right now.',
    },
    {
      who: 'cust',
      s: st.sent < -20 ? -40 : -10,
      t:
        mainTopic === 'Escalation'
          ? "Honestly, I've been passed around before — if this isn't fixed I want to speak to a manager."
          : 'Okay. It started around the ' + ((h % 27) + 1) + 'th of last month.',
      ph: mainTopic === 'Escalation' ? phraseOf('Escalation', h + 1) : '',
    },
    {
      who: 'agent',
      s: 15,
      t: resolved
        ? "Found it — I can see exactly what happened. I'm correcting it now and you'll see the adjustment within 24 hours."
        : "I can see the problem. I'll need to open a case for our specialist team and they'll come back to you.",
    },
    {
      who: 'cust',
      s: resolved ? 35 : -15,
      t: resolved
        ? "Oh that's brilliant — really helpful, thank you so much."
        : 'Alright, but please make sure someone actually calls me back this time.',
      ph: resolved ? phraseOf('Positive feedback', h) : '',
    },
    {
      who: 'agent',
      s: 20,
      t: 'Is there anything else I can help you with today, ' + first + '?',
    },
    {
      who: 'cust',
      s: resolved ? 30 : 0,
      t: resolved
        ? "No, that's everything. Thanks again for sorting it so quickly."
        : "No, that's all for now. Thanks.",
    },
  ];
}

/* Aliases under the prototype's global names, for callers that were written
   against `window.__staOf` / `window.__staTranscript`. */
export { staOf as __staOf, staTranscript as __staTranscript };

/* --------------------------------------------------------------- surveys */

function isSurvey(value) {
  if (!value || typeof value !== 'object') return false;
  const s = value;
  return typeof s.id === 'string' && typeof s.score === 'number' && typeof s.nps === 'number';
}

/** Post-interaction surveys, narrowed out of the loosely-typed `DB.surveys`. */
export function readSurveys(database = store) {
  return (database.surveys ?? []).filter(isSurvey);
}
const COMMENTS_LOW = [
  'Waited far too long and the issue is still not fixed.',
  'Agent was polite but nothing was resolved.',
  'Third time I have had to call about the same thing.',
];
const COMMENTS_HIGH = [
  'Sorted in one call — brilliant service.',
  'Really friendly and fixed it fast.',
  'Best support experience I have had in ages.',
];

/** The prototype's `seedSurveys()` — roughly a 30% response rate on history. */
function seedSurveys() {
  if (store.__svSeed) return;
  mutate((d) => {
    ensureSta(d);
    const surveys = readSurveys(d);
    (d.interactions || []).forEach((x) => {
      if (x.result === 'Abandoned') return;
      const h = hash(x.id);
      if (h % 10 >= 3) return; /* ~30% response rate */
      const st = staOf(x);
      let score = st.sent > 10 ? 4 + (h % 2) : st.sent < -20 ? 1 + (h % 2) : 3 + (h % 3);
      score = Math.max(1, Math.min(5, score));
      const nps = Math.max(0, Math.min(10, score * 2 + (h % 3) - 1));
      surveys.push({
        id: uid(),
        ixId: x.id,
        customer: x.name,
        agent: x.agent,
        queue: x.queue,
        d: x.d || dayISO(0),
        t: x.t,
        score,
        nps,
        comment:
          score <= 2
            ? COMMENTS_LOW[h % COMMENTS_LOW.length]
            : score === 5
              ? COMMENTS_HIGH[h % COMMENTS_HIGH.length]
              : '',
      });
    });
    d.surveys = surveys;
    d.__svSeed = true;
  });
}

/* ------------------------------------------------------------ topic drawer */

const WEIGHTS = [
  ['+50', 'Very positive'],
  ['+20', 'Positive'],
  ['-5', 'Slightly negative'],
  ['-20', 'Negative'],
  ['-45', 'Very negative'],
];
function TopicDrawer({ topic, onClose }) {
  const { toast } = useUi();
  const isNew = !topic;
  const [name, setName] = useState(topic ? topic.name : '');
  const [phrases, setPhrases] = useState(topic ? topic.phrases.join(', ') : '');
  const [base, setBase] = useState(topic ? topic.base : -10);
  function save() {
    const n = name.trim();
    const ph = phrases
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (n.length < 2 || !ph.length) {
      toast('Enter a topic name and at least one phrase');
      return;
    }
    mutate((d) => {
      ensureSta(d);
      const list = d.staTopics ?? [];
      const existing = topic ? list.find((t) => t.id === topic.id) : undefined;
      if (existing) {
        existing.name = n;
        existing.phrases = ph;
        existing.base = base;
      } else {
        list.push({
          id: uid(),
          name: n,
          base,
          phrases: ph,
        });
      }
      d.staTopics = list;
    });
    respotAll(); /* re-spot with the new definitions */
    audit((topic ? 'Edit' : 'Create') + ' STA topic', n);
    onClose();
    toast('Topic saved — interactions re-analysed');
  }
  function remove() {
    if (!topic) return;
    mutate((d) => {
      d.staTopics = (d.staTopics ?? []).filter((t) => t.id !== topic.id);
    });
    respotAll();
    onClose();
    toast('Topic deleted');
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 420,
          height: 'auto',
          top: '16%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>{isNew ? 'Add topic' : 'Edit — ' + topic.name}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div className="fld">
            <label>Topic name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld">
            <label>Phrases to spot (comma-separated) *</label>
            <input
              value={phrases}
              placeholder="e.g. cancel my account, switch provider"
              onChange={(e) => setPhrases(e.target.value)}
            />
          </div>
          <div className="fld">
            <label>Sentiment weight</label>
            <select value={String(base)} onChange={(e) => setBase(parseInt(e.target.value, 10))}>
              {WEIGHTS.map(([v, label]) => (
                <option key={v} value={parseInt(v, 10)}>
                  {label} ({v})
                </option>
              ))}
            </select>
          </div>
          {isNew ? null : (
            <button
              className="btn gh"
              style={{
                color: '#c9401a',
                fontSize: 12,
              }}
              onClick={remove}
            >
              Delete topic
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

/* ------------------------------------------------------------------- tab */

export default function SpeechTextTab() {
  const db = useDb();
  const [editing, setEditing] = useState(null);

  /* Seed the topic set and back-fill the survey stream once. */
  useEffect(() => {
    if (!store.staTopics) mutate((d) => ensureSta(d));
    seedSurveys();
  }, []);
  const topics = staTopics(db);
  const rs = (db.interactions || [])
    .filter((x) => x.result !== 'Abandoned' && (x.media || 'Voice') !== 'Email')
    .slice(0, 400);
  const sents = rs.map((x) => staOf(x).sent);
  const avgS = sents.length ? Math.round(sents.reduce((a, b) => a + b, 0) / sents.length) : 0;
  const negPct = sents.length
    ? Math.round((100 * sents.filter((s) => s < -15).length) / sents.length)
    : 0;
  const by = {};
  rs.forEach((x) => {
    staOf(x).topics.forEach((t) => {
      (by[t] = by[t] || []).push(x);
    });
  });
  const ranked = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
  const topTopic = ranked[0] || '—';
  const svs = readSurveys(db);
  const csat = svs.length
    ? Math.round((svs.reduce((a, s) => a + s.score, 0) / svs.length) * 10) / 10
    : null;
  const pro = svs.filter((s) => s.nps >= 9).length;
  const det = svs.filter((s) => s.nps <= 6).length;
  const nps = svs.length ? Math.round((100 * (pro - det)) / svs.length) : null;

  /* agent sentiment ranking */
  const byAgent = {};
  rs.forEach((x) => {
    if (x.agent && x.agent !== '—') (byAgent[x.agent] = byAgent[x.agent] || []).push(x);
  });
  const agRows = Object.keys(byAgent)
    .map((a) => {
      const arr = byAgent[a];
      const s = Math.round(arr.reduce((v, x) => v + staOf(x).sent, 0) / arr.length);
      const neg = Math.round((100 * arr.filter((x) => staOf(x).sent < -15).length) / arr.length);
      const mySv = svs.filter((v) => v.agent === a);
      const mycsat = mySv.length
        ? Math.round((mySv.reduce((v, x) => v + x.score, 0) / mySv.length) * 10) / 10
        : null;
      return {
        a,
        n: arr.length,
        s,
        neg,
        csat: mycsat,
      };
    })
    .sort((x, y) => y.s - x.s);
  const svRows = svs.slice(-8).reverse();
  return (
    <div className="pbody">
      <div
        className="kpis"
        style={{
          gridTemplateColumns: 'repeat(5,1fr)',
        }}
      >
        <div className="kpi">
          <span>Avg sentiment</span>
          <b>
            {avgS > 0 ? '+' : ''}
            {avgS}
          </b>
          <i>{avgS > 15 ? 'positive floor' : avgS < -15 ? 'negative floor' : 'neutral floor'}</i>
        </div>
        <div className="kpi">
          <span>Negative interactions</span>
          <b>{negPct}%</b>
          <i>sentiment below −15</i>
        </div>
        <div className="kpi">
          <span>Top topic</span>
          <b
            style={{
              fontSize: 15,
            }}
          >
            {topTopic}
          </b>
          <i>{by[topTopic] ? by[topTopic].length + ' interactions' : ''}</i>
        </div>
        <div className="kpi">
          <span>CSAT</span>
          <b>{csat != null ? csat + ' / 5' : '—'}</b>
          <i>{svs.length} surveys</i>
        </div>
        <div className="kpi">
          <span>NPS</span>
          <b>{nps != null ? (nps > 0 ? '+' : '') + nps : '—'}</b>
          <i>promoters − detractors</i>
        </div>
      </div>

      <div className="panel">
        <h3>
          Topics <span className="sp" />
          <button
            className="btn sec"
            style={{
              fontSize: 12,
            }}
            onClick={() =>
              setEditing({
                topic: null,
              })
            }
          >
            ＋ Add topic
          </button>
        </h3>
        <table className="dt">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Volume</th>
              <th>Interactions</th>
              <th>Share</th>
              <th>Avg sentiment</th>
              <th>Spotted phrases</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ranked.map((t) => {
              const arr = by[t];
              const s = Math.round(arr.reduce((a, x) => a + staOf(x).sent, 0) / arr.length);
              const tp = topics.find((x) => x.name === t);
              const w = Math.round((100 * arr.length) / rs.length);
              return (
                <tr key={t}>
                  <td>
                    <b>{t}</b>
                  </td>
                  <td
                    style={{
                      width: 220,
                    }}
                  >
                    <div
                      style={{
                        background: '#eef2f7',
                        borderRadius: 4,
                        height: 10,
                      }}
                    >
                      <div
                        style={{
                          width: w + '%',
                          height: '100%',
                          borderRadius: 4,
                          background: s < -15 ? '#d0342c' : s > 15 ? '#1f9d63' : '#e0a200',
                        }}
                      />
                    </div>
                  </td>
                  <td>{arr.length}</td>
                  <td>{w}%</td>
                  <td>
                    {sentLbl(s)} ({s > 0 ? '+' : ''}
                    {s})
                  </td>
                  <td
                    style={{
                      fontSize: 11,
                      color: '#8794a8',
                    }}
                  >
                    {tp ? tp.phrases.slice(0, 3).join(' · ') : ''}
                  </td>
                  <td>
                    {tp ? (
                      <a
                        className="lnk"
                        style={{
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        onClick={() =>
                          setEditing({
                            topic: tp,
                          })
                        }
                      >
                        Edit
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* wide-right: the surveys table on the right needs more room than the
          sentiment ranking on the left, so it gets the larger track */}
      <div className="two wide-right">
        <div className="panel">
          <h3>Agent sentiment ranking</h3>
          <div className="tscroll">
            <table className="dt">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Interactions</th>
                <th>Avg sentiment</th>
                <th>% negative</th>
                <th>CSAT</th>
              </tr>
            </thead>
            <tbody>
              {agRows.map((r) => (
                <tr key={r.a}>
                  <td>
                    <b>{r.a}</b>
                  </td>
                  <td>{r.n}</td>
                  <td>
                    {sentLbl(r.s)} ({r.s > 0 ? '+' : ''}
                    {r.s})
                  </td>
                  <td>{r.neg}%</td>
                  <td>{r.csat != null ? r.csat + ' / 5' : '—'}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h3>
            Latest surveys <span className="sp" />
            <small>arrive ~4s after you wrap an interaction</small>
          </h3>
          <div className="tscroll">
            <table className="dt">
            <thead>
              <tr>
                <th>When</th>
                <th>Customer</th>
                <th>Agent</th>
                <th>Queue</th>
                <th>CSAT</th>
                <th>NPS</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {svRows.length ? (
                svRows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.d} {(s.t || '').slice(0, 5)}
                    </td>
                    <td>
                      <b>{s.customer}</b>
                    </td>
                    <td>{s.agent}</td>
                    <td>{s.queue}</td>
                    <td>
                      {'★'.repeat(s.score)}
                      <span
                        style={{
                          color: '#d5dae2',
                        }}
                      >
                        {'★'.repeat(5 - s.score)}
                      </span>
                    </td>
                    <td>{s.nps}/10</td>
                    <td
                      style={{
                        fontSize: 11.5,
                        color: '#5a6b85',
                        fontStyle: 'italic',
                      }}
                    >
                      {s.comment || ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: 'center',
                      color: '#8794a8',
                      padding: 14,
                    }}
                  >
                    No surveys yet
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing ? <TopicDrawer topic={editing.topic} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
