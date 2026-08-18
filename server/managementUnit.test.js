// node managementUnit.test.js
import assert from 'node:assert/strict';
import { validateManagementUnit } from './managementUnit.js';

assert.deepEqual(validateManagementUnit({ name: "UK Retail MU", agentIds: [1, 2, 2] }).value, { name: 'UK Retail MU', agentIds: [1, 2] });
assert.deepEqual(validateManagementUnit({ name: '  Trim me  ' }).value, { name: 'Trim me', agentIds: [] });

assert.ok(validateManagementUnit({ name: 'A' }).fields.name);                 // too short
assert.ok(validateManagementUnit({ name: 'x'.repeat(51) }).fields.name);      // too long
assert.ok(validateManagementUnit({ name: 'Retail_MU' }).fields.name);         // underscore not allowed
assert.ok(validateManagementUnit({ name: 'Team 1' }).fields.name);            // digit not allowed
assert.ok(validateManagementUnit({ name: "O'Brien Collections" }).value);     // apostrophe allowed
assert.ok(validateManagementUnit({ name: 'Digital-Retail MU' }).value);       // hyphen allowed
assert.ok(validateManagementUnit(null).fields.name);

assert.ok(validateManagementUnit({ name: 'UK Retail MU', agentIds: 'not-a-list' }).fields.agentIds);
assert.ok(validateManagementUnit({ name: 'UK Retail MU', agentIds: [1, 'x'] }).fields.agentIds);
assert.ok(validateManagementUnit({ name: 'UK Retail MU', agentIds: [0] }).fields.agentIds);
assert.ok(validateManagementUnit({ name: 'UK Retail MU', agentIds: [-1] }).fields.agentIds);

console.log('management unit validation: all checks passed');
