// Validation + synthetic forecast generation for Forecasts / Planning Groups / Service Goals.
// CHECK constraints in schema.sql back the whitelist checks up.
export const QUEUES = ['Retail_Billing_L1', 'Retail_Complaints', 'Digital_Messaging', 'Collections_Arrears'];
export const SKILLS = ['Billing', 'Retention', 'Collections', 'Technical', 'Sales'];
export const LANGS = ['English', 'Hindi'];

// Same rule as every other named entity in this API — letters and spaces only, 3-50 chars.
export const NAME_RE = /^[a-zA-Z\s]+$/;
export const NAME_MIN = 3;
export const NAME_MAX = 50;

const isInt = (v) => Number.isInteger(v) || (typeof v === 'string' && /^\d+$/.test(v.trim()));

function checkName(name, fields) {
  if (name.length < NAME_MIN || name.length > NAME_MAX) fields.name = `Name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  else if (!NAME_RE.test(name)) fields.name = 'Only letters and spaces are allowed — no numbers or symbols.';
}

// Returns { fields } when invalid, { value } when valid.
export function validatePlanningGroup(body) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  checkName(name, fields);

  const queues = Array.isArray(b.queues) ? [...new Set(b.queues)] : null;
  if (!queues || !queues.length) fields.queues = 'Pick at least one queue — a planning group must cover route paths.';
  else if (queues.some((q) => !QUEUES.includes(q))) fields.queues = 'Unknown queue selected.';

  const skills = Array.isArray(b.skills) ? [...new Set(b.skills)] : b.skills == null ? [] : null;
  if (!skills) fields.skills = 'Skills must be a list.';
  else if (skills.some((s) => !SKILLS.includes(s))) fields.skills = 'Unknown ACD skill selected.';

  const langs = Array.isArray(b.langs) ? [...new Set(b.langs)] : b.langs == null ? [] : null;
  if (!langs) fields.langs = 'Languages must be a list.';
  else if (langs.some((l) => !LANGS.includes(l))) fields.langs = 'Unknown language selected.';

  if (Object.keys(fields).length) return { fields };
  return { value: { name, queues, skills, langs } };
}

// Returns { fields } when invalid, { value } when valid. `validPgIds` is the live set of
// planning-group ids, fetched by the route handler — never trust the client's own list.
export function validateServiceGoal(body, validPgIds) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  checkName(name, fields);

  const sl = isInt(b.sl) ? Number(b.sl) : NaN;
  if (!(sl >= 1 && sl <= 100)) fields.sl = 'Service level must be a whole number 1–100.';

  const sls = isInt(b.sls) ? Number(b.sls) : NaN;
  if (!(sls >= 1 && sls <= 3600)) fields.sls = 'Within-seconds target must be a whole number 1–3600.';

  const asa = isInt(b.asa) ? Number(b.asa) : NaN;
  if (!(asa >= 1 && asa <= 3600)) fields.asa = 'ASA target must be a whole number 1–3600 seconds.';

  const abn = b.abn === undefined || b.abn === null || b.abn === '' ? 0 : (isInt(b.abn) ? Number(b.abn) : NaN);
  if (!(abn >= 0 && abn <= 100)) fields.abn = 'Max abandon must be a whole number 0–100.';

  let pgIds = null;
  if (!Array.isArray(b.pgs)) {
    fields.pgs = 'Planning groups must be a list.';
  } else {
    pgIds = [...new Set(b.pgs.map(Number))];
    if (pgIds.some((id) => !validPgIds.has(id))) fields.pgs = 'One or more selected planning groups do not exist.';
  }

  if (Object.keys(fields).length) return { fields };
  return { value: { name, sl, sls, asa, abn, pgIds } };
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_WEIGHT = { Mon: 1.15, Tue: 1.05, Wed: 1.0, Thu: 1.0, Fri: 0.95, Sat: 0.55, Sun: 0.3 };

// Exported so server/schedule.js can derive deterministic shift-start offsets with the same
// algorithm, instead of a second copy drifting out of sync.
export function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// This prototype has no real interaction-volume feed, so forecast numbers are deterministically
// derived from the planning group's name (same input always produces the same output — a stand-in
// for "automatic best method" until a real historical-volume source is wired in).
export function synthesizeForecastEntry(planningGroupName) {
  const vol = 120 + (hash(planningGroupName) % 160);
  const aht = 180 + (hash(planningGroupName) % 140);
  const days = {};
  DAYS.forEach((d) => { days[d] = Math.round((vol * DAY_WEIGHT[d]) / 5); });
  return { vol, aht, days };
}

// Monday of *next* week (workforce forecasts are generated ahead of the week they cover),
// from the server clock — never trust a client-supplied date, or two users in different time
// zones could each create a "this week" forecast that collides or diverges.
export function currentWeekLabel(now = new Date()) {
  const day = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + 7);
  const dd = String(mon.getDate()).padStart(2, '0');
  const mmm = mon.toLocaleDateString('en-GB', { month: 'short' });
  return `w/c Mon ${dd} ${mmm} ${mon.getFullYear()}`;
}
