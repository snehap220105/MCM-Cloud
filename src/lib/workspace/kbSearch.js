// Ported from kbSearch()/kbForText() (lines 9025-9036).
export function kbSearch(kb, q) {
  q = (q || '').toLowerCase();
  if (!q) return [];
  return kb
    .map((a) => {
      let score = 0;
      a.kws.forEach((k) => { if (q.indexOf(k) > -1 || k.indexOf(q) > -1) score += 3; });
      q.split(/\s+/).forEach((w) => {
        if (w.length > 3 && (a.title.toLowerCase().indexOf(w) > -1 || a.body.toLowerCase().indexOf(w) > -1)) score++;
      });
      return { a, s: score };
    })
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .map((x) => x.a);
}

export function kbForText(kb, txt) {
  return kbSearch(kb, txt).slice(0, 2);
}
