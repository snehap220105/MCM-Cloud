/**
 * Shared telephony helpers.
 *
 * The legacy "Functional Engine v4 (Telephony)" kept number plans and outbound
 * routes nested inside each site, and hung the currently-selected site on
 * `window.TELSITE` so that Sites, Number Plans and Outbound Routes all agreed on
 * which site they were editing. That selection is reproduced here as a tiny
 * external store so the pages stay in sync across navigation.
 *
 * `Site.plans` and `Site.routes` are `unknown[]` in the shared data model — the
 * accessors below narrow them to the shapes the seed actually carries. They
 * return the live arrays, so mutating them inside `mutate()` works as expected.
 *
 * This file deliberately has no default export: `src/pages/index.js` only
 * registers modules that have one, so it is never mistaken for a page.
 */
import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------ site sub-models */

/** Match specification — only the keys for the plan's `match` type are used. */

/** A number plan: how dialed digits are matched, classified and normalised. */

/** An outbound route: which classifications go out over which trunks. */

/** The site's number plans, evaluated top-down (first match wins). */
export function plansOf(site) {
  return site.plans;
}

/** The site's outbound routes. */
export function routesOf(site) {
  return site.routes;
}

/* ------------------------------------------------------------------ lookups */

export function siteById(db, id) {
  return db.sites.find((s) => s.id === id);
}
export function trunkById(db, id) {
  return db.trunks.find((t) => t.id === id);
}
export function edgeGroupById(db, id) {
  return db.edgeGroups.find((g) => g.id === id);
}

/** Edge group name, or an em dash when the group has gone away. */
export function groupName(db, id) {
  return edgeGroupById(db, id)?.name ?? '—';
}

/* ---------------------------------------------------- selected site (TELSITE) */

let telSite = '';
const telSiteListeners = new Set();
function subscribeTelSite(listener) {
  telSiteListeners.add(listener);
  return () => {
    telSiteListeners.delete(listener);
  };
}
function readTelSite() {
  return telSite;
}

/** Set the site that Number Plans / Outbound Routes are scoped to. */
export function setTelSite(id) {
  if (telSite === id) return;
  telSite = id;
  telSiteListeners.forEach((listener) => listener());
}

/** The raw selection — may be stale if the site was deleted. */
export function getTelSite() {
  return telSite;
}

/**
 * The site the telephony pages are currently working on, falling back to the
 * first site. Mirrors the legacy `siteById(TELSITE)||DB.sites[0]` guard.
 */
export function currentTelSite(db) {
  const site = siteById(db, telSite) ?? db.sites[0];
  if (site) telSite = site.id;
  return site;
}

/** Subscribes a component to the selected-site store. */
export function useTelSite() {
  return useSyncExternalStore(subscribeTelSite, readTelSite, readTelSite);
}

/* ---------------------------------------------------- simulate call / classify */

/**
 * The Simulate Call core logic, ported verbatim from `window.classifyCall`.
 *
 * Number plans are walked top-down; the first one that matches decides the
 * classification, which is then resolved to an enabled outbound route and a
 * trunk. No call is placed — this is a configuration validator.
 */
export function classifyCall(db, siteId, dialed) {
  const site = siteById(db, siteId);
  if (!site) return null;
  const digits = String(dialed ?? '').replace(/[\s\-().]/g, '');
  const plans = plansOf(site);
  const routes = routesOf(site);
  const log = [];
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    let matched = null;
    let norm = digits;
    if (p.match === 'Number List') {
      const list = (p.spec.list ?? '').split(',').map((x) => x.trim());
      if (list.indexOf(digits) > -1) matched = digits;
      log.push(`Plan ${i + 1} "${p.name}" (list): ` + (matched ? 'MATCH' : 'no match'));
    } else if (p.match === 'Digit Length') {
      const min = p.spec.min ?? 0;
      const max = p.spec.max ?? 0;
      const ln = digits.replace(/^\+/, '').length;
      if (/^\d+$/.test(digits) && ln >= min && ln <= max) matched = digits;
      log.push(
        `Plan ${i + 1} "${p.name}" (length ${min}-${max}): ` + (matched ? 'MATCH' : 'no match')
      );
    } else if (p.match === 'Regex') {
      try {
        const re = new RegExp(p.spec.pattern ?? '');
        const mm = digits.match(re);
        if (mm) {
          matched = digits;
          if (p.norm) {
            norm = p.norm.replace(/\$(\d)/g, (_, g) => mm[Number(g)] ?? '');
          }
        }
        log.push(`Plan ${i + 1} "${p.name}" (regex): ` + (matched ? 'MATCH' : 'no match'));
      } catch {
        log.push(`Plan ${i + 1} "${p.name}": invalid regex — skipped`);
      }
    }
    if (matched) {
      /* find route */
      let route = null;
      let trunk = null;
      let reason = '';
      for (const rt of routes) {
        if (rt.on && rt.cls.indexOf(p.cls) > -1) {
          route = rt;
          break;
        }
      }
      if (p.cls === 'Extension') {
        reason = 'Internal — routed on-net to the extension owner; no trunk used.';
      } else if (!route) {
        reason = `No enabled outbound route serves classification "${p.cls}" — the call CANNOT complete (blocked).`;
      } else {
        const candidates = route.trunks
          .map((id) => trunkById(db, id))
          .filter((t) => Boolean(t))
          .filter((t) => t.state === 'In-Service');
        if (route.dist === 'Sequential') trunk = candidates[0] ?? null;
        else
          trunk = candidates.length
            ? (candidates[Math.floor(candidates.length / 2)] ?? null)
            : null;
        if (!trunk) reason = `Route "${route.name}" has no in-service trunks — call fails.`;
      }
      return {
        digits,
        normalized: norm,
        plan: p,
        cls: p.cls,
        route,
        trunk,
        reason,
        log,
      };
    }
  }
  return {
    digits,
    normalized: digits,
    plan: null,
    cls: null,
    route: null,
    trunk: null,
    reason: 'No number plan matched — reorder tone.',
    log,
  };
}
