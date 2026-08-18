/**
 * Shared constants for the MCM Cloud CX data layer.
 *
 * This module used to carry the TypeScript interfaces describing the state the
 * original prototype built at runtime on `window.DB`. In the JavaScript build
 * only the runtime values remain — the shapes themselves are documented by the
 * seed payload in `src/data/seed.json`, which was captured from a real run of
 * the legacy page.
 */

/** The five ACD media types, in the order the prototype listed them. */
export const MEDIA_TYPES = ['Voice', 'Callback', 'Chat', 'Email', 'Message'];
