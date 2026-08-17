/**
 * Minimal stand-in for the react-router-dom hooks the ported mcmcx pages use
 * (useNavigate, useSearchParams). The app has no real router — navigation is
 * plain React state in App.jsx — so `useNavigate()` calls back into that state
 * via a bridge function registered once at startup, and `useSearchParams()`
 * reads/writes the real URL query string with the History API so query-driven
 * pages (Architect's `?flow=`, Directory's `?tab=`) work without a router.
 */
import { useCallback, useSyncExternalStore } from 'react';

let bridge = null;
export function __setMcmcxNavigateBridge(fn) {
  bridge = fn;
}

export function useNavigate() {
  return useCallback((to) => {
    const [pathname, query] = String(to).split('?');
    const url = window.location.pathname + (query ? '?' + query : '');
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (bridge) bridge(pathname);
  }, []);
}

function subscribe(cb) {
  window.addEventListener('popstate', cb);
  return () => window.removeEventListener('popstate', cb);
}
function getSnapshot() {
  return window.location.search;
}

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, getSnapshot, () => '');
  const params = new URLSearchParams(search);
  const setSearchParams = useCallback((next, opts) => {
    const resolved = typeof next === 'function' ? next(new URLSearchParams(window.location.search)) : next;
    const str = resolved instanceof URLSearchParams ? resolved.toString() : new URLSearchParams(resolved).toString();
    const url = window.location.pathname + (str ? '?' + str : '');
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);
  return [params, setSearchParams];
}
