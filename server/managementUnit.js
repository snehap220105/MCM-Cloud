// Validation for management units. Mirrored by CHECK/UNIQUE constraints in schema.sql —
// the DB is the last line of defence, this gives the UI readable field errors.
export const NAME_RE = /^[a-zA-Z\s'-]+$/;
export const NAME_MIN = 2;
export const NAME_MAX = 50;

// Returns { fields } when invalid, { value } when valid.
// `agentIds` is checked for shape only here — existence against the DB happens in the
// route handler, since that requires a query.
export function validateManagementUnit(body) {
  const fields = {};
  const b = body && typeof body === 'object' ? body : {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    fields.name = `Name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  } else if (!NAME_RE.test(name)) {
    fields.name = 'Name may only contain letters, spaces, apostrophes and hyphens.';
  }

  let agentIds = null;
  if (b.agentIds === undefined || b.agentIds === null) {
    agentIds = [];
  } else if (!Array.isArray(b.agentIds)) {
    fields.agentIds = 'Selected agents must be a list.';
  } else {
    agentIds = [...new Set(b.agentIds.map(Number))];
    if (agentIds.some((id) => !Number.isInteger(id) || id < 1)) fields.agentIds = 'Selected agents contain an invalid id.';
  }

  if (Object.keys(fields).length) return { fields };
  return { value: { name, agentIds } };
}
