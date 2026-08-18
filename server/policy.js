// Validation for recording policies. Mirrored by CHECK constraints in schema.sql —
// the DB is the last line of defence, this gives the UI readable field errors.
export const MEDIA = ['Voice', 'Screen'];
export const QUEUES = ['Retail_Billing_L1', 'Retail_Complaints', 'Digital_Messaging', 'Collections_Arrears'];

export const NAME_RE = /^[a-zA-Z\s]+$/; // letters and spaces only — no digits or punctuation
export const NAME_MIN = 3;
export const NAME_MAX = 50;

const isInt = (v) => Number.isInteger(v) || (typeof v === 'string' && /^\d+$/.test(v.trim()));

// Returns { fields } when invalid, { value } when valid.
export function validatePolicy(body) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    fields.name = `Policy name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  } else if (!NAME_RE.test(name)) {
    fields.name = 'Only letters and spaces are allowed — no numbers or symbols.';
  }

  const media = Array.isArray(b.media) ? [...new Set(b.media)] : null;
  if (!media || !media.length) fields.media = 'Select at least one media type.';
  else if (media.some((m) => !MEDIA.includes(m))) fields.media = `Media must be one of: ${MEDIA.join(', ')}.`;

  const queues = Array.isArray(b.queues) ? [...new Set(b.queues)] : b.queues == null ? [] : null;
  if (!queues) fields.queues = 'Queues must be a list.';
  else if (queues.some((q) => !QUEUES.includes(q))) fields.queues = 'Unknown queue selected.';

  const pct = isInt(b.pct) ? Number(b.pct) : NaN;
  if (!(pct >= 0 && pct <= 100)) fields.pct = 'Sample percentage must be a whole number 0–100.';

  const retention = isInt(b.retention) ? Number(b.retention) : NaN;
  if (!(retention >= 1 && retention <= 3650)) fields.retention = 'Retention must be a whole number 1–3650 days.';

  const on = typeof b.on === 'boolean' ? b.on : null;
  if (on === null) fields.on = 'Active state must be true or false.';

  if (Object.keys(fields).length) return { fields };
  return { value: { name, media, queues, pct, retention, on } };
}
