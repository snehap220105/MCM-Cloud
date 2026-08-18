// node schedule.test.js
import assert from 'node:assert/strict';
import { validateWorkPlan, validateActivityCode, validateTimeOffRequest, validateShiftTrade, generateScheduleEntries, DAYS } from './schedule.js';

const agentIds = new Set([1, 2, 3]);
const okWp = { name: 'UK Full Time', days: ['Mon', 'Tue'], len: 8, flexFrom: '08:00', flexTo: '10:00', paid: 37.5, agentIds: [1, 2] };

assert.deepEqual(validateWorkPlan(okWp, agentIds).value, okWp);
assert.ok(validateWorkPlan({ ...okWp, name: 'UK Full Time 2' }, agentIds).fields.name);   // digit not allowed
assert.ok(validateWorkPlan({ ...okWp, days: [] }, agentIds).fields.days);                  // at least one day
assert.ok(validateWorkPlan({ ...okWp, days: ['Someday'] }, agentIds).fields.days);
assert.ok(validateWorkPlan({ ...okWp, len: 1 }, agentIds).fields.len);                     // below 2h
assert.ok(validateWorkPlan({ ...okWp, len: 13 }, agentIds).fields.len);                    // above 12h
assert.ok(validateWorkPlan({ ...okWp, flexFrom: '8am' }, agentIds).fields.flexFrom);
assert.ok(validateWorkPlan({ ...okWp, flexTo: '25:00' }, agentIds).fields.flexTo);
assert.ok(validateWorkPlan({ ...okWp, paid: 0 }, agentIds).fields.paid);
assert.ok(validateWorkPlan({ ...okWp, paid: 81 }, agentIds).fields.paid);
assert.ok(validateWorkPlan({ ...okWp, agentIds: [999] }, agentIds).fields.agentIds);        // unknown agent

const okAc = { name: 'Team Huddle', category: 'Meeting', paid: true };
assert.deepEqual(validateActivityCode(okAc).value, okAc);
assert.ok(validateActivityCode({ ...okAc, name: 'Team Huddle 2' }).fields.name);
assert.ok(validateActivityCode({ ...okAc, category: 'Nope' }).fields.category);
assert.ok(validateActivityCode({ ...okAc, paid: 'yes' }).fields.paid);

assert.deepEqual(validateTimeOffRequest({ agentId: 1, day: 'Wed' }, agentIds).value, { agentId: 1, day: 'Wed' });
assert.ok(validateTimeOffRequest({ agentId: 999, day: 'Wed' }, agentIds).fields.agentId);
assert.ok(validateTimeOffRequest({ agentId: 1, day: 'Someday' }, agentIds).fields.day);

assert.deepEqual(validateShiftTrade({ fromAgentId: 1, toAgentId: 2, day: 'Fri' }, agentIds).value, { fromAgentId: 1, toAgentId: 2, day: 'Fri' });
assert.ok(validateShiftTrade({ fromAgentId: 1, toAgentId: 1, day: 'Fri' }, agentIds).fields.toAgentId); // can't trade with self
assert.ok(validateShiftTrade({ fromAgentId: 999, toAgentId: 2, day: 'Fri' }, agentIds).fields.fromAgentId);

// schedule generation: skipped agents, deterministic offsets, approved time off applied
const wps = [{ agentIds: [1, 2], days: ['Mon', 'Tue'], flexFrom: '08:00', flexTo: '08:00', len: 8 }];
const { entries, scheduledCount, skippedAgentIds } = generateScheduleEntries(wps, [1, 2, 3], new Set());
assert.equal(scheduledCount, 2);
assert.deepEqual(skippedAgentIds, [3]);
assert.equal(entries.length, 4); // 2 agents x 2 days
assert.ok(entries.every((e) => e.start === '08:00' && e.end === '16:00')); // flexFrom===flexTo -> no jitter

const withTimeOff = generateScheduleEntries(wps, [1, 2], new Set(['1_Mon']));
const offEntry = withTimeOff.entries.find((e) => e.agentId === 1 && e.day === 'Mon');
assert.deepEqual(offEntry, { agentId: 1, day: 'Mon', isOff: true, start: null, end: null, breaksNote: null });

assert.equal(DAYS.length, 7);

console.log('schedule validation + generation: all checks passed');
