// Validation + schedule generation for Schedules (WFM): Work Plans, Activity Codes, Time Off,
// Shift Trades and the generated Schedule grid itself. CHECK constraints in schema.sql back
// the whitelist checks up.
import { hash, currentWeekLabel } from './forecast.js';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const CATEGORIES = ['On Queue', 'Off Queue', 'Break', 'Meal', 'Meeting', 'Training', 'Time Off'];

// Same rule as every other named entity in this API — letters and spaces only, 3-50 chars.
export const NAME_RE = /^[a-zA-Z\s]+$/;
export const NAME_MIN = 3;
export const NAME_MAX = 50;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isInt = (v) => Number.isInteger(v) || (typeof v === 'string' && /^\d+$/.test(v.trim()));
const isNum = (v) => typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()));

function checkName(name, fields, label = 'Name') {
  if (name.length < NAME_MIN || name.length > NAME_MAX) fields.name = `${label} must be ${NAME_MIN}-${NAME_MAX} characters.`;
  else if (!NAME_RE.test(name)) fields.name = 'Only letters and spaces are allowed — no numbers or symbols.';
}

// Returns { fields } when invalid, { value } when valid. `validAgentIds` is the live set of
// agent ids, fetched by the route handler — an agent may sit on at most one work plan, enforced
// by a UNIQUE constraint on work_plan_agents.agent_id, not trusted from the client.
export function validateWorkPlan(body, validAgentIds) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  checkName(name, fields);

  const days = Array.isArray(b.days) ? [...new Set(b.days)] : null;
  if (!days || !days.length) fields.days = 'Pick at least one working day.';
  else if (days.some((d) => !DAYS.includes(d))) fields.days = 'Unknown day selected.';

  const len = isInt(b.len) ? Number(b.len) : NaN;
  if (!(len >= 2 && len <= 12)) fields.len = 'Shift length must be a whole number 2–12 hours.';

  const flexFrom = typeof b.flexFrom === 'string' ? b.flexFrom.trim() : '';
  if (!TIME_RE.test(flexFrom)) fields.flexFrom = 'Earliest start must look like 08:00.';

  const flexTo = typeof b.flexTo === 'string' ? b.flexTo.trim() : '';
  if (!TIME_RE.test(flexTo)) fields.flexTo = 'Latest start must look like 10:00.';

  const paid = isNum(b.paid) ? Number(b.paid) : NaN;
  if (!(paid >= 1 && paid <= 80)) fields.paid = 'Paid hours/week must be a number 1–80.';

  let agentIds = null;
  if (!Array.isArray(b.agentIds)) {
    fields.agentIds = 'Agents must be a list.';
  } else {
    agentIds = [...new Set(b.agentIds.map(Number))];
    if (agentIds.some((id) => !validAgentIds.has(id))) fields.agentIds = 'One or more selected agents do not exist.';
  }

  if (Object.keys(fields).length) return { fields };
  return { value: { name, days, len, flexFrom, flexTo, paid, agentIds } };
}

export function validateActivityCode(body) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  checkName(name, fields);

  const category = typeof b.category === 'string' ? b.category.trim() : '';
  if (!CATEGORIES.includes(category)) fields.category = `Category must be one of: ${CATEGORIES.join(', ')}.`;

  const paid = typeof b.paid === 'boolean' ? b.paid : null;
  if (paid === null) fields.paid = 'Paid must be true or false.';

  if (Object.keys(fields).length) return { fields };
  return { value: { name, category, paid } };
}

export function validateTimeOffRequest(body, validAgentIds) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const agentId = Number(b.agentId);
  if (!Number.isInteger(agentId) || !validAgentIds.has(agentId)) fields.agentId = 'An agent must be selected.';

  const day = typeof b.day === 'string' ? b.day.trim() : '';
  if (!DAYS.includes(day)) fields.day = 'Unknown day selected.';

  if (Object.keys(fields).length) return { fields };
  return { value: { agentId, day } };
}

export function validateShiftTrade(body, validAgentIds) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const fromAgentId = Number(b.fromAgentId);
  const toAgentId = Number(b.toAgentId);
  if (!Number.isInteger(fromAgentId) || !validAgentIds.has(fromAgentId)) fields.fromAgentId = 'An agent must be selected.';
  if (!Number.isInteger(toAgentId) || !validAgentIds.has(toAgentId)) fields.toAgentId = 'An agent must be selected.';
  if (fromAgentId === toAgentId && !fields.fromAgentId) fields.toAgentId = 'Cannot trade a shift with the same agent.';

  const day = typeof b.day === 'string' ? b.day.trim() : '';
  if (!DAYS.includes(day)) fields.day = 'Unknown day selected.';

  if (Object.keys(fields).length) return { fields };
  return { value: { fromAgentId, toAgentId, day } };
}

export { currentWeekLabel };

// Places each work-planned agent's shift inside their flex window (deterministically, from a
// hash of their name — this prototype has no real ACD adherence feed to derive it from),
// inserts break/lunch markers, and applies any already-approved time off. Mirrors the original
// client-side genSchedule() exactly.
export function generateScheduleEntries(workPlans, allAgentIds, approvedTimeOffByAgentDay) {
  const entries = []; // [{ agentId, day, isOff, start, end, breaksNote }]
  const scheduledAgentIds = new Set();

  for (const wp of workPlans) {
    for (const agentId of wp.agentIds) {
      scheduledAgentIds.add(agentId);
      const span = Math.max(1, parseInt(wp.flexTo, 10) - parseInt(wp.flexFrom, 10) + 1);
      const startH = parseInt(wp.flexFrom, 10) + (hash(String(agentId)) % span);
      for (const day of wp.days) {
        const off = approvedTimeOffByAgentDay.has(`${agentId}_${day}`);
        entries.push(off
          ? { agentId, day, isOff: true, start: null, end: null, breaksNote: null }
          : {
              agentId, day, isOff: false,
              start: `${String(startH).padStart(2, '0')}:00`,
              end: `${String(startH + wp.len).padStart(2, '0')}:00`,
              breaksNote: `Break ${startH + 2}:00 · Lunch ${startH + 4}:00 · Break ${startH + 6}:15`,
            });
      }
    }
  }
  const skippedAgentIds = allAgentIds.filter((id) => !scheduledAgentIds.has(id));
  return { entries, scheduledCount: scheduledAgentIds.size, skippedAgentIds };
}
