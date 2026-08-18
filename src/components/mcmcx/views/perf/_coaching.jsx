/**
 * Coaching sessions a supervisor assigns from the live board.
 *
 * Ported from the prototype's `ensureCoach()` / `coachNew()` / `coachSave()` /
 * `coachDone()`. In the prototype the agent read these back on their own
 * "My Performance" screen, which was an alternate view for `role === 'agent'`
 * rather than a supervisor tab; only the supervisor half is modelled here, so
 * this module holds the assign drawer and the completion helper.
 */
import { useEffect, useState } from 'react';
import { audit, db as store, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
function dayISO(off = 0) {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function coachingOf(database) {
  return database.coaching ?? [];
}

/** The prototype's `ensureCoach()` — one seeded session for Sofia Petrova. */
function ensureCoaching() {
  if (store.coaching) return;
  mutate((d) => {
    d.coaching = [];
    const sofia = d.users.find((u) => u.name === 'Sofia Petrova');
    if (sofia)
      d.coaching.push({
        id: uid(),
        agent: sofia.name,
        coach: 'Faisal Khan',
        topic: 'Handling billing disputes',
        notes:
          'Review the de-escalation openers we discussed — listen to one of your calls with a negative sentiment score first.',
        due: dayISO(-2),
        state: 'Scheduled',
        created: dayISO(1),
      });
  });
}

/** The prototype's `coachDone()`. */
export function coachDone(id, toast) {
  const session = coachingOf(store).find((c) => c.id === id);
  if (!session) return;
  mutate((d) => {
    const target = coachingOf(d).find((c) => c.id === id);
    if (!target) return;
    target.state = 'Completed';
    target.doneAt = dayISO(0);
  });
  audit('Coaching completed', session.agent + ' — ' + session.topic);
  toast('Nice work — coaching session marked completed');
}

/** Topics offered when assigning a session; negative STA topics are added too. */
function coachingTopics(database) {
  const topics = [
    'Handling billing disputes',
    'De-escalation techniques',
    'Reducing hold time',
    'Wrap-up code accuracy',
    'Upsell conversations',
    'Chat multitasking',
  ];
  (database.staTopics ?? []).forEach((t) => {
    const base = typeof t.base === 'number' ? t.base : 0;
    const name = typeof t.name === 'string' ? t.name : '';
    const label = 'Reducing "' + name + '" friction';
    if (base < -20 && topics.indexOf(label) < 0) topics.push(label);
  });
  return topics;
}
const DUE_OPTIONS = [
  ['0', 'Today'],
  ['-1', 'Tomorrow'],
  ['-3', 'In 3 days'],
  ['-7', 'Next week'],
];

/** The prototype's `coachNew()` / `coachSave()` drawer. */
export function AssignCoachingDrawer({ agentId, onClose }) {
  const db = useDb();
  const { toast, user } = useUi();
  const agent = db.users.find((u) => u.id === agentId);
  const topics = coachingTopics(db);
  const [topic, setTopic] = useState(topics[0] ?? '');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState('-3');
  useEffect(() => {
    ensureCoaching();
  }, []);
  if (!agent) return null;
  function save() {
    ensureCoaching();
    mutate((d) => {
      d.coaching.push({
        id: uid(),
        agent: agent.name,
        coach: user.name || 'Supervisor',
        topic,
        notes: notes.trim(),
        due: dayISO(parseInt(due, 10)),
        state: 'Scheduled',
        created: dayISO(0),
      });
    });
    audit('Coaching assigned', agent.name + ' — ' + topic);
    onClose();
    toast(`Coaching assigned to ${agent.name} — they'll see it in their workspace`);
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 430,
          height: 'auto',
          top: '14%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>Assign coaching — {agent.name}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div className="fld">
            <label>Topic *</label>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              {topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Note to the agent</label>
            <textarea
              rows={3}
              value={notes}
              placeholder="What should they focus on?"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="fld">
            <label>Due</label>
            <select value={due} onChange={(e) => setDue(e.target.value)}>
              {DUE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
            }}
          >
            The agent sees this immediately in their workspace.
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Assign session
          </button>
        </div>
      </div>
    </>
  );
}
