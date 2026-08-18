// node gamification.test.js
import assert from 'node:assert/strict';
import { validateMetricProfile } from './gamification.js';

const ok = { name: 'Retail Agent Standard', applies: 'Retail Billing, Retail Technical', target: 'SL 85%, QA 90%', metrics: 5, points: 1000, leaderboard: 'Enabled', status: 'Active' };
assert.deepEqual(validateMetricProfile(ok).value, ok);

assert.ok(validateMetricProfile({ ...ok, name: 'ab' }).fields.name);                 // below 3 chars
assert.ok(validateMetricProfile({ ...ok, name: 'Retail Agent 1' }).fields.name);     // digit not allowed
assert.ok(validateMetricProfile({ ...ok, name: 'Retail-Agent' }).fields.name);       // hyphen not allowed
assert.ok(validateMetricProfile({ ...ok, applies: 'A' }).fields.applies);            // too short
assert.ok(validateMetricProfile({ ...ok, metrics: 0 }).fields.metrics);
assert.ok(validateMetricProfile({ ...ok, metrics: 21 }).fields.metrics);
assert.ok(validateMetricProfile({ ...ok, points: -1 }).fields.points);
assert.ok(validateMetricProfile({ ...ok, leaderboard: 'Nope' }).fields.leaderboard);
assert.ok(validateMetricProfile({ ...ok, status: 'Nope' }).fields.status);
assert.ok(validateMetricProfile(null).fields.name);

// target is optional — blanks default to an em dash, matching the table's empty-state display
assert.equal(validateMetricProfile({ ...ok, target: '' }).value.target, '—');
assert.equal(validateMetricProfile({ ...ok, target: undefined }).value.target, '—');

console.log('gamification validation: all checks passed');
