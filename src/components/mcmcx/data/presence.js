/**
 * Presence vocabulary.
 *
 * These are the eight presence states the prototype offered in the top-bar
 * profile menu, with the swatch colours it used. Directory cards, the profile
 * drawer and the top bar all read from this one list so a presence never
 * renders in two different colours.
 */
export const PRESENCES = [
  { label: 'Available', colour: '#2ecc71' },
  { label: 'Busy', colour: '#d9534f' },
  { label: 'Away', colour: '#e8a33d' },
  { label: 'Meal', colour: '#e8a33d' },
  { label: 'Break', colour: '#e8a33d' },
  { label: 'Meeting', colour: '#2b6cb0' },
  { label: 'Training', colour: '#2b6cb0' },
  { label: 'Offline', colour: '#a9b3c2' },
];

/** The swatch colour for a presence label, falling back to Available green. */
export function presenceColour(label) {
  return PRESENCES.find((p) => p.label === label)?.colour ?? '#2ecc71';
}

/** Initials for an avatar — "Sofia Petrova" becomes "SP". */
export function initialsOf(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * A stable avatar colour for a name.
 *
 * The prototype hand-picked a colour per directory card; deriving it from the
 * name keeps that varied look while working for any user in the database.
 */
const AVATAR_COLOURS = [
  '#FF4F1F',
  '#2b6cb0',
  '#7a4fb5',
  '#0f9d8c',
  '#c1440e',
  '#8a6d3b',
  '#5b6a7d',
  '#a0522d',
  '#4a5a6e',
  '#6b7280',
];
export function avatarColour(key) {
  const text = String(key || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}
