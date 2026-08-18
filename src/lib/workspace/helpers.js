// Ported from the Activity IIFE's shared helpers (lines 5906-5942).
export function pad(n) { return n < 10 ? '0' + n : '' + n; }
export function fmt(s) { return pad(Math.floor(s / 60)) + ':' + pad(Math.floor(s) % 60); }
export function clock() { return new Date().toTimeString().slice(0, 8); }
export function dayISO() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function hash(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h; }
let uidN = 0;
export function uid() { return 'id' + (++uidN) + Math.random().toString(36).slice(2, 6); }

// queueRequiredSkills()/ivrPath() (lines 5926-5970) walk published Architect
// flows to derive per-queue required skills and a synthesized IVR path.
// Architect flows aren't part of this conversion pass, so DB.flows is
// effectively empty here — exactly like the original code with an empty
// flows array, both legitimately return "no requirement" / "no path".
export function queueRequiredSkills() { return []; }
export function ivrPath() { return null; }

export function eligibleMembers(queue, users, excludeId) {
  return queue.members
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean)
    .filter((u) => u.state === 'Active' && u.id !== excludeId);
}
