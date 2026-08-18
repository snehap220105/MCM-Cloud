// Ported from ensureTel()'s DB.trunks/DB.sites seed (lines 1500-1534).
export const TRUNKS = [
  { id: 't_carrier', name: 'BYOC-Carrier-UK', state: 'In-Service' },
  { id: 't_prem', name: 'MUM-PSTN-Airtel', state: 'In-Service' },
  { id: 't_phone', name: 'MUM-Phone-Trunk', state: 'In-Service' },
  { id: 't_web', name: 'WebRTC-Trunk', state: 'In-Service' },
];

const ukPlans = [
  { name: 'Emergency', match: 'Number List', spec: { list: '999,112' }, cls: 'Emergency', norm: '' },
  { name: 'Extension', match: 'Digit Length', spec: { min: 4, max: 4 }, cls: 'Extension', norm: '' },
  { name: 'Premium Blocked', match: 'Regex', spec: { pattern: '^(09\\d{8,9}|118\\d{3})$' }, cls: 'Premium', norm: '' },
  { name: 'National', match: 'Regex', spec: { pattern: '^0(\\d{9,10})$' }, cls: 'National', norm: '+44$1' },
  { name: 'International 00', match: 'Regex', spec: { pattern: '^00(\\d{8,14})$' }, cls: 'International', norm: '+$1' },
  { name: 'E.164 Passthrough', match: 'Regex', spec: { pattern: '^\\+(\\d{8,14})$' }, cls: 'International', norm: '+$1' },
];

const mumPlans = [
  { name: 'Emergency', match: 'Number List', spec: { list: '112,100,101,108' }, cls: 'Emergency', norm: '' },
  { name: 'Extension', match: 'Digit Length', spec: { min: 4, max: 4 }, cls: 'Extension', norm: '' },
  { name: 'National', match: 'Regex', spec: { pattern: '^0(\\d{10})$' }, cls: 'National', norm: '+91$1' },
  { name: 'International 00', match: 'Regex', spec: { pattern: '^00(\\d{8,14})$' }, cls: 'International', norm: '+$1' },
  { name: 'E.164 Passthrough', match: 'Regex', spec: { pattern: '^\\+(\\d{8,14})$' }, cls: 'International', norm: '+$1' },
];

export const SITES = [
  {
    id: 'site_london', name: 'London-Cloud', plans: ukPlans,
    routes: [{ name: 'Default Route', cls: ['Emergency', 'National', 'International'], trunks: ['t_carrier'], dist: 'Sequential', on: true }],
  },
  {
    id: 'site_mumbai', name: 'Mumbai-Premises', plans: mumPlans,
    routes: [
      { name: 'Default Route', cls: ['National', 'International'], trunks: ['t_prem'], dist: 'Sequential', on: true },
      { name: 'Emergency-Local', cls: ['Emergency'], trunks: ['t_prem'], dist: 'Sequential', on: true },
    ],
  },
];

// Ported from window.classifyCall (lines 1560-1601).
export function classifyCall(siteId, dialed) {
  const site = SITES.find((s) => s.id === siteId);
  if (!site) return null;
  const digits = String(dialed || '').replace(/[\s\-().]/g, '');
  const log = [];
  for (let i = 0; i < site.plans.length; i++) {
    const p = site.plans[i];
    let m = null, norm = digits;
    if (p.match === 'Number List') {
      const list = (p.spec.list || '').split(',').map((x) => x.trim());
      if (list.indexOf(digits) > -1) m = digits;
      log.push('Plan ' + (i + 1) + ' "' + p.name + '" (list): ' + (m ? 'MATCH' : 'no match'));
    } else if (p.match === 'Digit Length') {
      const ln = digits.replace(/^\+/, '').length;
      if (/^\d+$/.test(digits) && ln >= p.spec.min && ln <= p.spec.max) m = digits;
      log.push('Plan ' + (i + 1) + ' "' + p.name + '" (length ' + p.spec.min + '-' + p.spec.max + '): ' + (m ? 'MATCH' : 'no match'));
    } else if (p.match === 'Regex') {
      try {
        const re = new RegExp(p.spec.pattern);
        const mm = digits.match(re);
        if (mm) { m = digits; if (p.norm) norm = p.norm.replace(/\$(\d)/g, (_, g) => mm[+g] || ''); }
        log.push('Plan ' + (i + 1) + ' "' + p.name + '" (regex): ' + (m ? 'MATCH' : 'no match'));
      } catch (e) {
        log.push('Plan ' + (i + 1) + ' "' + p.name + '": invalid regex — skipped');
      }
    }
    if (m) {
      let route = null, trunk = null, reason = '';
      for (let r = 0; r < site.routes.length; r++) {
        const rt = site.routes[r];
        if (rt.on && rt.cls.indexOf(p.cls) > -1) { route = rt; break; }
      }
      if (p.cls === 'Extension') {
        reason = 'Internal — routed on-net to the extension owner; no trunk used.';
      } else if (!route) {
        reason = 'No enabled outbound route serves classification "' + p.cls + '" — the call CANNOT complete (blocked).';
      } else {
        const cands = route.trunks.map((id) => TRUNKS.find((t) => t.id === id)).filter(Boolean).filter((t) => t.state === 'In-Service');
        trunk = route.dist === 'Sequential' ? cands[0] || null : (cands.length ? cands[Math.floor(cands.length / 2)] : null);
        if (!trunk) reason = 'Route "' + route.name + '" has no in-service trunks — call fails.';
      }
      return { digits, normalized: norm, plan: p, cls: p.cls, route, trunk, reason, log };
    }
  }
  return { digits, normalized: digits, plan: null, cls: null, route: null, trunk: null, reason: 'No number plan matched — reorder tone.', log };
}
