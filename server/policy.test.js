// node policy.test.js
import assert from 'node:assert/strict';
import { validatePolicy } from './policy.js';

const ok = { name: 'Retail sample', media: ['Voice'], queues: ['Retail_Billing_L1'], pct: 50, retention: 90, on: true };

assert.deepEqual(validatePolicy(ok).value, ok);
assert.equal(validatePolicy({ ...ok, name: 'AB' }).fields.name !== undefined, true);           // below 3 chars
assert.equal(validatePolicy({ ...ok, name: 'x'.repeat(51) }).fields.name !== undefined, true);  // above 50 chars
assert.equal(validatePolicy({ ...ok, name: 'x'.repeat(50) }).value !== undefined, true);        // exactly 50 is valid
assert.equal(validatePolicy({ ...ok, name: "O'Brien policy" }).fields.name !== undefined, true); // apostrophe not allowed
assert.equal(validatePolicy({ ...ok, name: 'Retail % + screen' }).fields.name !== undefined, true); // % and + not allowed
assert.equal(validatePolicy({ ...ok, name: 'Digital QA 1' }).fields.name !== undefined, true);  // digit not allowed
assert.equal(validatePolicy({ ...ok, name: 'Digital_QA' }).fields.name !== undefined, true);    // underscore not allowed
assert.equal(validatePolicy({ ...ok, name: 'Digital-QA' }).fields.name !== undefined, true);    // hyphen not allowed
assert.equal(validatePolicy({ ...ok, name: 'Digital QA' }).value !== undefined, true);          // letters + spaces allowed
assert.equal(validatePolicy({ ...ok, media: [] }).fields.media !== undefined, true);
assert.equal(validatePolicy({ ...ok, media: ['Video'] }).fields.media !== undefined, true);
assert.equal(validatePolicy({ ...ok, queues: ['Nope'] }).fields.queues !== undefined, true);
assert.equal(validatePolicy({ ...ok, pct: -1 }).fields.pct !== undefined, true);
assert.equal(validatePolicy({ ...ok, pct: 101 }).fields.pct !== undefined, true);
assert.equal(validatePolicy({ ...ok, pct: 50.5 }).fields.pct !== undefined, true);
assert.equal(validatePolicy({ ...ok, pct: 0 }).value !== undefined, true);                      // 0% is now valid
assert.equal(validatePolicy({ ...ok, retention: 0 }).fields.retention !== undefined, true);
assert.equal(validatePolicy({ ...ok, retention: 4000 }).fields.retention !== undefined, true);
assert.equal(validatePolicy({ ...ok, on: 'yes' }).fields.on !== undefined, true);
assert.equal(validatePolicy(null).fields.name !== undefined, true);

// numeric strings from <input type="number"> are accepted and coerced
assert.equal(validatePolicy({ ...ok, pct: '50', retention: '90' }).value.pct, 50);
// name is trimmed, media/queues deduped, omitted queues default to "all queues"
assert.deepEqual(validatePolicy({ ...ok, name: '  Trim me  ', media: ['Voice', 'Voice'], queues: undefined }).value,
  { name: 'Trim me', media: ['Voice'], queues: [], pct: 50, retention: 90, on: true });

console.log('policy validation: all checks passed');
