/**
 * The Performance header filters — Division and Media.
 *
 * The prototype only half-built these. `applyDivFilter()` made the Division chip
 * cycle through divisions on click and then *hid table rows* with inline styles,
 * while the KPI row above kept counting every queue — so filtering to a division
 * with no queues left an empty table under a header still claiming "22 waiting
 * across 4 queues". The Media chip was decorative; it filtered nothing.
 *
 * Here both are real filters held in one place, so the KPIs, the "across N
 * queues" caption and the queue table are always describing the same set.
 */
import { useSyncExternalStore } from 'react';
import { mediaOf } from './_live';

const state = { division: '', media: '' };
const listeners = new Set();
let version = 0;

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getVersion() {
  return version;
}
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe a component to the current filter selection. */
export function useFilters() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return state;
}

/** Set one filter. Pass '' to clear it back to All. */
export function setFilter(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  emit();
}

/** Are any filters narrowing the view? */
export function isFiltered() {
  return Boolean(state.division || state.media);
}

/** Clear both filters. */
export function clearFilters() {
  if (!isFiltered()) return;
  state.division = '';
  state.media = '';
  emit();
}

/** The queues matching the current selection. */
export function filteredQueues(db) {
  return (db.queues ?? []).filter((q) => {
    if (state.division && q.division !== state.division) return false;
    if (state.media && mediaOf(q.name) !== state.media) return false;
    return true;
  });
}

/**
 * The media types actually in use, so the picker only offers what exists.
 *
 * A dataset of voice and messaging queues offers "All / Message / Voice" rather
 * than every media type the platform supports.
 */
export function availableMedia(db) {
  const found = new Set((db.queues ?? []).map((q) => mediaOf(q.name)));
  return [...found].sort();
}
