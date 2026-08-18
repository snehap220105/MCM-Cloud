/**
 * The application data store.
 *
 * The legacy prototype kept everything on a mutable `window.DB` global and
 * re-rendered a page by calling its `renderX()` function again. We keep that
 * same mental model — one mutable database — but expose it to React through
 * `useSyncExternalStore`, so components re-render properly when it changes.
 *
 * Read state with `useDb()`. Change state with `mutate()`:
 *
 *   const db = useDb();
 *   mutate(d => { d.queues.push(newQueue); });
 */
import { useSyncExternalStore } from 'react';
import seed from '@/data/seed.json';
function deepClone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
const listeners = new Set();
let version = 0;

/** The single mutable database instance. */
export const db = deepClone(seed);
function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getVersion() {
  return version;
}

/** Notify subscribers that the database changed. */
export function commit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

/** Apply a change to the database and re-render everything that reads it. */
export function mutate(change) {
  change(db);
  commit();
}

/** Restore the original demo data. */
export function resetDb() {
  const fresh = deepClone(seed);
  Object.keys(db).forEach((key) => {
    delete db[key];
  });
  Object.assign(db, fresh);
  commit();
}

/** Replace the whole database, e.g. after importing a configuration file. */
export function replaceDb(next) {
  Object.keys(db).forEach((key) => {
    delete db[key];
  });
  Object.assign(db, deepClone(next));
  commit();
}

/**
 * Subscribe a component to the database.
 *
 * Returns the same mutable object every time; the hook exists to register the
 * component for re-render, not to hand back a new snapshot.
 */
export function useDb() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return db;
}

/* ------------------------------------------------------------- utilities */

/** Matches the id format used throughout the original seed data. */
export function uid(prefix = 'id') {
  return prefix + Math.random().toString(36).slice(2, 10);
}

/** "04 Jan 2026 09:12" — the timestamp format the audit log uses. */
export function stamp(date = new Date()) {
  const day = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${day} ${date.toTimeString().slice(0, 5)}`;
}

/** Record an entry in the audit log. Mirrors the prototype's `audit()`. */
export function audit(act, obj, who = 'Faisal Khan') {
  mutate((d) => {
    if (!Array.isArray(d.audit)) d.audit = [];
    d.audit.unshift({
      t: stamp(),
      who,
      act,
      obj,
    });
  });
}

/* ------------------------------------------------------ lookup helpers */

export function userName(id) {
  return db.users.find((u) => u.id === id)?.name ?? id;
}
export function divisionName(id) {
  return db.divisions.find((d) => d.id === id)?.name ?? id;
}
export function queueName(id) {
  return db.queues.find((q) => q.id === id)?.name ?? id;
}
export function roleName(id) {
  return db.roles.find((r) => r.id === id)?.name ?? id;
}
export function wrapupName(id) {
  return db.wrapup.find((w) => w.id === id)?.name ?? id;
}
