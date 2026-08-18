// node forecast.test.js
import assert from 'node:assert/strict';
import { validatePlanningGroup, validateServiceGoal, synthesizeForecastEntry, currentWeekLabel, DAYS } from './forecast.js';

const okPg = { name: 'Retail Voice', queues: ['Retail_Billing_L1', 'Retail_Complaints'], skills: ['Billing'], langs: ['English'] };
assert.deepEqual(validatePlanningGroup(okPg).value, okPg);
assert.ok(validatePlanningGroup({ ...okPg, name: 'ab' }).fields.name);              // below 3 chars
assert.ok(validatePlanningGroup({ ...okPg, name: 'Retail Voice 2' }).fields.name);  // digit not allowed
assert.ok(validatePlanningGroup({ ...okPg, name: 'Retail-Voice' }).fields.name);    // hyphen not allowed
assert.ok(validatePlanningGroup({ ...okPg, queues: [] }).fields.queues);            // at least one queue required
assert.ok(validatePlanningGroup({ ...okPg, queues: ['Nope'] }).fields.queues);      // unknown queue
assert.ok(validatePlanningGroup({ ...okPg, skills: ['Nope'] }).fields.skills);      // unknown skill
assert.ok(validatePlanningGroup({ ...okPg, langs: ['French'] }).fields.langs);      // unknown language
assert.deepEqual(validatePlanningGroup({ ...okPg, skills: undefined, langs: undefined }).value.skills, []); // optional lists default empty
assert.ok(validatePlanningGroup(null).fields.name);

const ids = new Set([1, 2]);
const okSg = { name: 'Voice Standard', sl: 80, sls: 20, asa: 30, abn: 5, pgs: [1, 2] };
assert.deepEqual(validateServiceGoal(okSg, ids).value, { name: 'Voice Standard', sl: 80, sls: 20, asa: 30, abn: 5, pgIds: [1, 2] });
assert.ok(validateServiceGoal({ ...okSg, sl: 0 }, ids).fields.sl);
assert.ok(validateServiceGoal({ ...okSg, sl: 101 }, ids).fields.sl);
assert.ok(validateServiceGoal({ ...okSg, sls: 0 }, ids).fields.sls);
assert.ok(validateServiceGoal({ ...okSg, asa: 0 }, ids).fields.asa);
assert.ok(validateServiceGoal({ ...okSg, abn: -1 }, ids).fields.abn);
assert.ok(validateServiceGoal({ ...okSg, abn: 101 }, ids).fields.abn);
assert.equal(validateServiceGoal({ ...okSg, abn: undefined }, ids).value.abn, 0);   // abandon defaults to 0
assert.ok(validateServiceGoal({ ...okSg, pgs: [999] }, ids).fields.pgs);            // planning group must exist
assert.ok(validateServiceGoal({ ...okSg, pgs: 'nope' }, ids).fields.pgs);

// synthetic forecast generation is deterministic (same name -> same numbers every time)
const a = synthesizeForecastEntry('Retail Voice');
const b = synthesizeForecastEntry('Retail Voice');
assert.deepEqual(a, b);
assert.ok(a.vol >= 120 && a.vol < 280);
assert.ok(a.aht >= 180 && a.aht < 320);
assert.deepEqual(Object.keys(a.days), DAYS);
assert.notDeepEqual(a, synthesizeForecastEntry('Collections'));

// week label always lands on a Monday, one week ahead
const label = currentWeekLabel(new Date('2026-08-18T12:00:00Z')); // a Tuesday
assert.equal(label, 'w/c Mon 24 Aug 2026');

console.log('forecast validation + synthesis: all checks passed');
