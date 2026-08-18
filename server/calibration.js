// Validation + derived fields for calibrations. CHECK constraints in schema.sql back this up.
export const FORMS = ['Retail Quality v4', 'Complaints v2', 'Technical v3', 'Digital v2', 'Compliance v1', 'Standard Call QA'];

// Same rule as recording-policy and evaluation-form names — letters and spaces only, 3-50 chars.
export const NAME_RE = /^[a-zA-Z\s]+$/;
export const NAME_MIN = 3;
export const NAME_MAX = 50;

// Who may be assigned as an evaluator (QA analysts, supervisors, senior advisors).
export const ROSTER = [
  'Grace Adeyemi', 'Marco Rossi', 'Faisal Khan', 'Liam Walsh', 'Priya Nair',
  'Aisha Rahman', 'Adnan Shaikh', 'Sofia Petrova', 'James Okafor', 'Carlos Mendez',
];

export const STATUSES = ['Scheduled', 'In progress', 'Review variance', 'Complete'];

// A calibration compares evaluators against each other, so two is the minimum that means anything.
export const MIN_EVALUATORS = 2;
export const MAX_EVALUATORS = 20;

// Half-spread (in points) above which scorers are considered out of alignment.
export const VARIANCE_THRESHOLD = 5;

const INTERACTION_RE = /^CONV-\d{5,10}$/;
const SCORE_RE = /^\d{1,3}(\.\d{1,2})?$/;

// Status and variance are computed from the scores, never stored — a row cannot claim
// "Complete" while evaluators are outstanding.
export function derive({ total, completed, spread }) {
  const finished = total >= MIN_EVALUATORS && completed === total;
  const half = finished && spread != null ? Number(spread) / 2 : null;
  return {
    variance: half == null ? '—' : `± ${half.toFixed(1)}%`,
    variancePct: half,
    status: completed === 0 ? 'Scheduled'
      : completed < total ? 'In progress'
      : half != null && half > VARIANCE_THRESHOLD ? 'Review variance'
      : 'Complete',
  };
}

// Returns { fields } when invalid, { value } when valid.
export function validateCalibration(body) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    fields.name = `Calibration name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  } else if (!NAME_RE.test(name)) {
    fields.name = 'Only letters and spaces are allowed — no numbers or symbols.';
  }

  const interaction = typeof b.interaction === 'string' ? b.interaction.trim().toUpperCase() : '';
  if (!INTERACTION_RE.test(interaction)) fields.interaction = 'Interaction ID must look like CONV-8841204.';

  const form = typeof b.form === 'string' ? b.form.trim() : '';
  if (!FORMS.includes(form)) fields.form = 'Choose an evaluation form from the list.';

  let evaluators = null;
  if (!Array.isArray(b.evaluators)) {
    fields.evaluators = 'Evaluators must be a list.';
  } else if (b.evaluators.length < MIN_EVALUATORS || b.evaluators.length > MAX_EVALUATORS) {
    fields.evaluators = `Select between ${MIN_EVALUATORS} and ${MAX_EVALUATORS} evaluators.`;
  } else {
    evaluators = [];
    for (const raw of b.evaluators) {
      const e = raw && typeof raw === 'object' ? raw : { evaluator: raw };
      if (!ROSTER.includes(e.evaluator)) { fields.evaluators = 'Unknown evaluator selected.'; break; }
      if (evaluators.some((x) => x.evaluator === e.evaluator)) { fields.evaluators = 'The same evaluator is selected twice.'; break; }

      let score = null;
      if (e.score !== null && e.score !== undefined && String(e.score).trim() !== '') {
        const s = String(e.score).trim();
        if (!SCORE_RE.test(s) || Number(s) > 100) { fields.scores = 'Scores must be 0–100 with at most 2 decimals.'; break; }
        score = Number(s);
      }
      evaluators.push({ evaluator: e.evaluator, score });
    }
  }

  if (Object.keys(fields).length) return { fields };
  return { value: { name, interaction, form, evaluators } };
}
