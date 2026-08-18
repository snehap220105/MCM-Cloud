// node evaluationForm.test.js
import assert from 'node:assert/strict';
import { validateForm, validateEvaluationSubmit, scoreForm, INTERACTIONS } from './evaluationForm.js';

const okGroups = [{ name: 'Greeting', questions: [{ text: 'Used approved greeting', weight: 10, critical: false }] }];
const ok = { name: 'Standard Call QA', published: false, groups: okGroups };

assert.deepEqual(validateForm(ok, false).value, ok);
assert.ok(validateForm({ ...ok, name: 'ab' }, false).fields.name);                 // below 3 chars
assert.ok(validateForm({ ...ok, name: 'x'.repeat(51) }, false).fields.name);       // above 50 chars
assert.ok(validateForm({ ...ok, name: 'Standard Call QA v2' }, false).fields.name); // digit not allowed
assert.ok(validateForm({ ...ok, name: 'QA-Form' }, false).fields.name);            // hyphen not allowed
assert.ok(validateForm(null, false).fields.name);

assert.ok(validateForm({ ...ok, groups: [] }, false).fields.groups);                                     // no groups
assert.ok(validateForm({ ...ok, groups: [{ name: 'X', questions: [] }] }, false).fields.groups);          // group name too short
assert.ok(validateForm({ ...ok, groups: [{ name: 'Greeting', questions: [{ text: 'ab', weight: 10 }] }] }, false).fields.groups); // question too short
assert.ok(validateForm({ ...ok, groups: [{ name: 'Greeting', questions: [{ text: 'Valid question text', weight: 0 }] }] }, false).fields.groups); // weight out of range
assert.ok(validateForm({ ...ok, groups: [{ name: 'Greeting', questions: [] }] }, true).fields.groups);    // publish needs >=1 question
assert.ok(validateForm({ ...ok, groups: [{ name: 'Greeting', questions: [] }] }, false).value);            // draft may have zero questions

// group names with punctuation (real seed data) are fine — only the top-level form name is letters-only
assert.ok(validateForm({ ...ok, groups: [{ name: 'Greeting & Compliance', questions: okGroups[0].questions }] }, false).value);
assert.ok(validateForm({ ...ok, groups: [{ name: 'Wrap-up', questions: okGroups[0].questions }] }, false).value);

// evaluation submission validation
const qids = new Set([1, 2]);
assert.ok(validateEvaluationSubmit({ formId: 1, interactionIndex: 0, answers: [{ questionId: 1, answer: 'yes' }] }, qids).value);
assert.ok(validateEvaluationSubmit({ formId: 0, interactionIndex: 0, answers: [] }, qids).fields.formId);
assert.ok(validateEvaluationSubmit({ formId: 1, interactionIndex: 99, answers: [] }, qids).fields.interactionIndex);
assert.ok(validateEvaluationSubmit({ formId: 1, interactionIndex: 0, answers: [{ questionId: 999, answer: 'yes' }] }, qids).fields.answers); // question not in form
assert.ok(validateEvaluationSubmit({ formId: 1, interactionIndex: 0, answers: [{ questionId: 1, answer: 'maybe' }] }, qids).fields.answers); // bad answer value
assert.equal(INTERACTIONS.length > 0, true);

// scoring — mirrors the original client-side score() function
const groups = [
  { questions: [{ id: 1, weight: 10, critical: false }, { id: 2, weight: 20, critical: true }] },
  { questions: [{ id: 3, weight: 15, critical: false }] },
];
assert.deepEqual(scoreForm(groups, new Map([[1, 'yes'], [2, 'yes'], [3, 'yes']])), { earned: 45, possible: 45, pct: 100, criticalFail: false });
// a "no" on the critical question zeroes its whole group
assert.deepEqual(scoreForm(groups, new Map([[1, 'yes'], [2, 'no'], [3, 'yes']])), { earned: 15, possible: 45, pct: 33, criticalFail: true });
// "na" removes the question from both earned and possible
assert.deepEqual(scoreForm(groups, new Map([[1, 'na'], [2, 'yes'], [3, 'yes']])), { earned: 35, possible: 35, pct: 100, criticalFail: false });
// missing answers default to "yes"
assert.deepEqual(scoreForm(groups, new Map()), { earned: 45, possible: 45, pct: 100, criticalFail: false });
// zero possible points -> 0%, not NaN/Infinity
assert.deepEqual(scoreForm([{ questions: [] }], new Map()), { earned: 0, possible: 0, pct: 0, criticalFail: false });

console.log('evaluation form validation + scoring: all checks passed');
