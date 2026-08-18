// Validation and scoring for Evaluation Forms. Mirrored by CHECK constraints in schema.sql —
// the DB is the last line of defence, this gives the UI readable field errors.

// Same rule as recording-policy names (server/policy.js) — letters and spaces only, 3-50 chars.
export const NAME_RE = /^[a-zA-Z\s]+$/;
export const NAME_MIN = 3;
export const NAME_MAX = 50;

export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 50;
export const QUESTION_TEXT_MIN = 3;
export const QUESTION_TEXT_MAX = 200;
export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 100;

export const ANSWERS = ['yes', 'no', 'na'];

// Fixed interaction picklist for "Perform Evaluation" — a stand-in for a real interaction/CTI
// feed in this prototype. Index-based so the client can't submit an arbitrary agent/customer pair.
export const INTERACTIONS = [
  { agent: 'Sofia Petrova', customer: 'Oliver Smith', queue: 'Retail_Billing_L1', duration: '04:12' },
  { agent: 'Rajan Patel', customer: 'Amelia Jones', queue: 'Collections_Arrears', duration: '06:48' },
];

const isInt = (v) => Number.isInteger(v) || (typeof v === 'string' && /^\d+$/.test(v.trim()));

// Returns { fields } when invalid, { value } when valid. `forPublish` additionally requires
// at least one question — a form can be saved as an empty draft but not published empty.
export function validateForm(body, forPublish) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    fields.name = `Form name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  } else if (!NAME_RE.test(name)) {
    fields.name = 'Only letters and spaces are allowed — no numbers or symbols.';
  }

  const published = typeof b.published === 'boolean' ? b.published : false;

  const groups = Array.isArray(b.groups) ? b.groups : null;
  if (!groups || !groups.length) {
    fields.groups = 'At least one group is required.';
  } else {
    let questionCount = 0;
    for (const g of groups) {
      const gname = typeof g?.name === 'string' ? g.name.trim() : '';
      if (gname.length < GROUP_NAME_MIN || gname.length > GROUP_NAME_MAX) {
        fields.groups = `Each group name must be ${GROUP_NAME_MIN}-${GROUP_NAME_MAX} characters.`;
        break;
      }
      if (!Array.isArray(g.questions)) { fields.groups = 'Group questions must be a list.'; break; }
      for (const q of g.questions) {
        const text = typeof q?.text === 'string' ? q.text.trim() : '';
        if (text.length < QUESTION_TEXT_MIN || text.length > QUESTION_TEXT_MAX) {
          fields.groups = `Each question must be ${QUESTION_TEXT_MIN}-${QUESTION_TEXT_MAX} characters.`;
          break;
        }
        const weight = isInt(q?.weight) ? Number(q.weight) : NaN;
        if (!(weight >= WEIGHT_MIN && weight <= WEIGHT_MAX)) {
          fields.groups = `Question weight must be a whole number ${WEIGHT_MIN}-${WEIGHT_MAX}.`;
          break;
        }
        questionCount++;
      }
      if (fields.groups) break;
    }
    if (!fields.groups && forPublish && !questionCount) fields.groups = 'Add at least one question before publishing.';
  }

  if (Object.keys(fields).length) return { fields };
  return {
    value: {
      name,
      published,
      groups: groups.map((g) => ({
        name: g.name.trim(),
        questions: g.questions.map((q) => ({ text: q.text.trim(), weight: Number(q.weight), critical: !!q.critical })),
      })),
    },
  };
}

// Returns { fields } when invalid, { value: { interaction, answersByQuestionId } } when valid.
export function validateEvaluationSubmit(body, validQuestionIds) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const formId = Number(b.formId);
  if (!Number.isInteger(formId) || formId < 1) fields.formId = 'A form must be selected.';

  const interactionIndex = Number(b.interactionIndex);
  const interaction = INTERACTIONS[interactionIndex];
  if (!Number.isInteger(interactionIndex) || !interaction) fields.interactionIndex = 'An interaction must be selected.';

  const answersByQuestionId = new Map();
  if (!Array.isArray(b.answers)) {
    fields.answers = 'Answers must be a list.';
  } else {
    for (const a of b.answers) {
      const qid = Number(a?.questionId);
      if (!Number.isInteger(qid) || !validQuestionIds.has(qid)) { fields.answers = 'One or more answers reference a question outside this form.'; break; }
      if (!ANSWERS.includes(a?.answer)) { fields.answers = `Answer must be one of: ${ANSWERS.join(', ')}.`; break; }
      answersByQuestionId.set(qid, a.answer);
    }
  }

  if (Object.keys(fields).length) return { fields };
  return { value: { formId, interaction, answersByQuestionId } };
}

// Scores a form against submitted answers. A question with no submitted answer defaults to
// "yes" — every question renders pre-selected to Yes in the UI, so this only matters if a
// client deliberately omits one. A "no" on a critical question zeroes its whole group and
// flags the evaluation, exactly mirroring the original client-side scoring rule.
export function scoreForm(groups, answersByQuestionId) {
  let earned = 0, possible = 0, criticalFail = false;
  for (const g of groups) {
    let gEarned = 0, gPossible = 0, gCrit = false;
    for (const q of g.questions) {
      const answer = answersByQuestionId.get(q.id) || 'yes';
      if (answer === 'na') continue;
      gPossible += q.weight;
      if (answer === 'yes') gEarned += q.weight;
      else if (q.critical) gCrit = true;
    }
    if (gCrit) { gEarned = 0; criticalFail = true; }
    earned += gEarned;
    possible += gPossible;
  }
  const pct = possible ? Math.round((earned / possible) * 100) : 0;
  return { earned, possible, pct, criticalFail };
}
