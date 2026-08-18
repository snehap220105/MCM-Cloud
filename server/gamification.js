// Validation for Gamification metric profiles. CHECK constraints in schema.sql back this up.

// Same rule as every other named entity in this API — letters and spaces only, 3-50 chars.
export const NAME_RE = /^[a-zA-Z\s]+$/;
export const NAME_MIN = 3;
export const NAME_MAX = 50;

export const LEADERBOARD_STATES = ['Enabled', 'Hidden'];
export const STATUSES = ['Active', 'Pilot'];

const APPLIES_MIN = 2, APPLIES_MAX = 200;
const TARGET_MAX = 200;
const METRICS_MIN = 1, METRICS_MAX = 20;
const POINTS_MIN = 0, POINTS_MAX = 100000;

const isInt = (v) => Number.isInteger(v) || (typeof v === 'string' && /^\d+$/.test(v.trim()));

// Returns { fields } when invalid, { value } when valid.
export function validateMetricProfile(body) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    fields.name = `Profile name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  } else if (!NAME_RE.test(name)) {
    fields.name = 'Only letters and spaces are allowed — no numbers or symbols.';
  }

  const applies = typeof b.applies === 'string' ? b.applies.trim() : '';
  if (applies.length < APPLIES_MIN || applies.length > APPLIES_MAX) fields.applies = `"Applies to" must be ${APPLIES_MIN}-${APPLIES_MAX} characters.`;

  const target = typeof b.target === 'string' ? b.target.trim() : '';
  if (target.length > TARGET_MAX) fields.target = `Target must be at most ${TARGET_MAX} characters.`;

  const metrics = isInt(b.metrics) ? Number(b.metrics) : NaN;
  if (!(metrics >= METRICS_MIN && metrics <= METRICS_MAX)) fields.metrics = `Metrics count must be a whole number ${METRICS_MIN}-${METRICS_MAX}.`;

  const points = isInt(b.points) ? Number(b.points) : NaN;
  if (!(points >= POINTS_MIN && points <= POINTS_MAX)) fields.points = `Points must be a whole number ${POINTS_MIN}-${POINTS_MAX}.`;

  const leaderboard = typeof b.leaderboard === 'string' ? b.leaderboard.trim() : '';
  if (!LEADERBOARD_STATES.includes(leaderboard)) fields.leaderboard = `Leaderboard must be one of: ${LEADERBOARD_STATES.join(', ')}.`;

  const status = typeof b.status === 'string' ? b.status.trim() : '';
  if (!STATUSES.includes(status)) fields.status = `Status must be one of: ${STATUSES.join(', ')}.`;

  if (Object.keys(fields).length) return { fields };
  return { value: { name, applies, target: target || '—', metrics, points, leaderboard, status } };
}
