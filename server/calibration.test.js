// node calibration.test.js
import assert from 'node:assert/strict';
import { validateCalibration, derive } from './calibration.js';

const ok = {
  name: 'Sep Billing Check',
  interaction: 'CONV-8841204',
  form: 'Retail Quality v4',
  evaluators: [{ evaluator: 'Grace Adeyemi', score: 82 }, { evaluator: 'Marco Rossi', score: null }],
};
const f = (patch) => validateCalibration({ ...ok, ...patch }).fields || {};

assert.deepEqual(validateCalibration(ok).value, ok);
assert.ok(f({ name: 'x' }).name);                            // below 3 chars
assert.ok(f({ name: 'x'.repeat(51) }).name);                 // above 50 chars
assert.ok(f({ name: 'Sep — Billing check' }).name);          // em dash not allowed
assert.ok(f({ name: 'Billing check 2' }).name);               // digit not allowed
assert.ok(f({ interaction: '8841204' }).interaction);       // missing prefix
assert.ok(f({ interaction: 'CONV-88' }).interaction);        // too few digits
assert.ok(f({ form: 'Made up form' }).form);
assert.ok(f({ evaluators: [{ evaluator: 'Grace Adeyemi' }] }).evaluators);           // below minimum of 2
assert.ok(f({ evaluators: [{ evaluator: 'Nobody' }, { evaluator: 'Marco Rossi' }] }).evaluators);
assert.ok(f({ evaluators: [{ evaluator: 'Marco Rossi' }, { evaluator: 'Marco Rossi' }] }).evaluators);
assert.ok(f({ evaluators: [{ evaluator: 'Marco Rossi', score: 101 }, { evaluator: 'Priya Nair' }] }).scores);
assert.ok(f({ evaluators: [{ evaluator: 'Marco Rossi', score: -1 }, { evaluator: 'Priya Nair' }] }).scores);
assert.ok(f({ evaluators: [{ evaluator: 'Marco Rossi', score: 'abc' }, { evaluator: 'Priya Nair' }] }).scores);
assert.ok(validateCalibration(null).fields.name);

// normalisation: interaction upper-cased, name trimmed, blank score -> null
const v = validateCalibration({ ...ok, name: '  Trim me  ', interaction: ' conv-8841204 ',
  evaluators: [{ evaluator: 'Grace Adeyemi', score: '  ' }, { evaluator: 'Marco Rossi', score: '82.50' }] }).value;
assert.equal(v.name, 'Trim me');
assert.equal(v.interaction, 'CONV-8841204');
assert.deepEqual(v.evaluators, [{ evaluator: 'Grace Adeyemi', score: null }, { evaluator: 'Marco Rossi', score: 82.5 }]);

// derived status/variance — matches the six seeded rows
assert.deepEqual(derive({ total: 6, completed: 6, spread: 8.4 }), { variance: '± 4.2%', variancePct: 4.2, status: 'Complete' });
assert.deepEqual(derive({ total: 5, completed: 3, spread: 3.5 }).status, 'In progress');
assert.equal(derive({ total: 5, completed: 3, spread: 3.5 }).variance, '—');  // withheld until all submit
assert.equal(derive({ total: 4, completed: 4, spread: 19.6 }).status, 'Review variance');
assert.equal(derive({ total: 8, completed: 0, spread: null }).status, 'Scheduled');
assert.equal(derive({ total: 2, completed: 2, spread: 10 }).status, 'Complete');       // exactly at threshold
assert.equal(derive({ total: 2, completed: 2, spread: 10.2 }).status, 'Review variance');

console.log('calibration validation: all checks passed');
