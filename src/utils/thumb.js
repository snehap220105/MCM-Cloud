// Ported 1:1 from window.thumb() in MCM_Cloud_CX_v15_2.html (lines 366-410).
// Builds the exact same wireframe SVG markup string; only the PAGES lookup
// is passed in as a parameter instead of read off `window`.
export function buildThumbSvg(id, pages) {
  const p = pages[id];
  const W = 268, H = 150;
  let g = '<svg class="thumb" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="150" xmlns="http://www.w3.org/2000/svg">';
  g += '<rect width="' + W + '" height="' + H + '" fill="#f5f7fa"/>';
  g += '<rect x="0" y="0" width="' + W + '" height="13" fill="#152550"/>';
  g += '<circle cx="8" cy="6.5" r="3.4" fill="#FF4F1F"/><rect x="15" y="4.5" width="26" height="4" rx="2" fill="#ffffff" opacity=".85"/>';
  ['Dir', 'Act', 'Perf', 'Adm', 'App'].forEach(function (t, i) {
    g += '<rect x="' + (58 + i * 17) + '" y="4.5" width="13" height="4" rx="2" fill="#ffffff" opacity="' + (i === 3 ? '1' : '.45') + '"/>';
  });
  g += '<rect x="196" y="3.5" width="44" height="6" rx="3" fill="#ffffff" opacity=".25"/><circle cx="252" cy="6.5" r="4" fill="#FF4F1F"/>';

  if (id === 'architect' || id === 'scripteditor') {
    g += '<rect x="0" y="13" width="' + W + '" height="10" fill="#1c3163"/><rect x="5" y="16" width="34" height="4" rx="2" fill="#fff" opacity=".9"/>';
    g += '<rect x="214" y="15.5" width="22" height="5" rx="2" fill="#FF4F1F"/><rect x="240" y="15.5" width="22" height="5" rx="2" fill="#ffffff" opacity=".3"/>';
    g += '<rect x="0" y="23" width="46" height="' + (H - 30) + '" fill="#ffffff" stroke="#dde3ec"/>';
    for (let i = 0; i < 10; i++) {
      g += '<rect x="6" y="' + (30 + i * 11) + '" width="6" height="6" rx="1.5" fill="' + ['#FF4F1F', '#2f6fd0', '#1f9d63', '#8b5cf6', '#e0a200'][i % 5] + '"/><rect x="15" y="' + (31.5 + i * 11) + '" width="' + (18 + (i * 7) % 14) + '" height="3.5" rx="1.7" fill="#c9d2df"/>';
    }
    g += '<rect x="' + (W - 58) + '" y="23" width="58" height="' + (H - 30) + '" fill="#ffffff" stroke="#dde3ec"/>';
    for (let i = 0; i < 8; i++) {
      g += '<rect x="' + (W - 52) + '" y="' + (30 + i * 13) + '" width="20" height="3" rx="1.5" fill="#9fb0c8"/><rect x="' + (W - 52) + '" y="' + (35 + i * 13) + '" width="46" height="6" rx="2" fill="#f0f3f8" stroke="#dde3ec" stroke-width=".6"/>';
    }
    if (id === 'architect') {
      const nd = [[60, 32], [60, 60], [60, 88], [122, 60], [122, 100], [178, 46], [178, 88]];
      nd.forEach(function (n, i) {
        g += '<rect x="' + n[0] + '" y="' + n[1] + '" width="40" height="20" rx="3" fill="#fff" stroke="' + (i === 3 ? '#FF4F1F' : '#cfd7e3') + '" stroke-width="' + (i === 3 ? 1.4 : 0.8) + '"/><circle cx="' + (n[0] + 6) + '" cy="' + (n[1] + 6) + '" r="2.4" fill="' + ['#1f9d63', '#2f6fd0', '#e0a200', '#FF4F1F', '#8b5cf6', '#FF4F1F', '#d0342c'][i] + '"/><rect x="' + (n[0] + 11) + '" y="' + (n[1] + 4) + '" width="22" height="3" rx="1.5" fill="#8794a8"/><rect x="' + (n[0] + 5) + '" y="' + (n[1] + 12) + '" width="28" height="2.5" rx="1.2" fill="#d5dce7"/>';
      });
      [[80, 52, 80, 60], [80, 80, 80, 88], [100, 70, 122, 70], [100, 70, 122, 105], [162, 70, 178, 56], [162, 105, 178, 98]].forEach(function (l) {
        g += '<path d="M' + l[0] + ' ' + l[1] + ' L' + l[2] + ' ' + l[3] + '" stroke="#9fb0c8" stroke-width="1" fill="none"/>';
      });
    } else {
      g += '<rect x="66" y="30" width="' + (W - 132) + '" height="' + (H - 40) + '" fill="#fff" stroke="#cfd7e3"/>';
      g += '<rect x="66" y="30" width="' + (W - 132) + '" height="11" fill="#152550"/><rect x="71" y="33.5" width="52" height="4" rx="2" fill="#fff" opacity=".85"/>';
      for (let i = 0; i < 5; i++) {
        g += '<rect x="73" y="' + (48 + i * 17) + '" width="26" height="3" rx="1.5" fill="#a9b4c4"/><rect x="73" y="' + (54 + i * 17) + '" width="' + (W - 152) + '" height="8" rx="2" fill="#fbfcfe" stroke="#dde3ec" stroke-width=".6"/>';
      }
      g += '<rect x="73" y="133" width="26" height="9" rx="2" fill="#FF4F1F"/><rect x="103" y="133" width="26" height="9" rx="2" fill="#fff" stroke="#cfd7e3" stroke-width=".7"/>';
    }
  } else if (p) {
    g += '<rect x="0" y="13" width="62" height="' + (H - 13) + '" fill="#ffffff" stroke="#dde3ec" stroke-width=".8"/>';
    g += '<rect x="5" y="18" width="52" height="7" rx="3" fill="#f0f3f8" stroke="#dde3ec" stroke-width=".6"/>';
    for (let i = 0; i < 11; i++) {
      const act = (i === 4);
      g += '<rect x="5" y="' + (30 + i * 10) + '" width="' + (24 + (i * 11) % 26) + '" height="3.4" rx="1.7" fill="' + (act ? '#FF4F1F' : '#c9d2df') + '"/>';
    }
    g += '<rect x="68" y="19" width="' + (30 + p.title.length * 2.2) + '" height="6" rx="3" fill="#22304a"/>';
    g += '<rect x="' + (W - 52) + '" y="18" width="30" height="8" rx="3" fill="#FF4F1F"/><rect x="' + (W - 19) + '" y="18" width="16" height="8" rx="3" fill="#fff" stroke="#cfd7e3" stroke-width=".7"/>';
    let tx = 68;
    (p.tabs || ['Configuration']).slice(0, 5).forEach(function (t, i) {
      const w = t.length * 2.1 + 6;
      g += '<rect x="' + tx + '" y="32" width="' + w + '" height="3.4" rx="1.7" fill="' + (i === 0 ? '#FF4F1F' : '#a9b4c4') + '"/>';
      tx += w + 7;
    });
    g += '<line x1="68" y1="39" x2="' + (W - 4) + '" y2="39" stroke="#dde3ec" stroke-width=".8"/>';
    g += '<rect x="68" y="44" width="46" height="8" rx="2" fill="#fff" stroke="#dde3ec" stroke-width=".7"/><rect x="118" y="44" width="30" height="8" rx="2" fill="#fff" stroke="#dde3ec" stroke-width=".7"/>';
    const nc = Math.min((p.cols || []).length, 7), cw = (W - 76) / Math.max(nc, 1);
    g += '<rect x="68" y="57" width="' + (W - 74) + '" height="9" fill="#f5f7fa" stroke="#dde3ec" stroke-width=".6"/>';
    for (let c = 0; c < nc; c++) {
      g += '<rect x="' + (71 + c * cw) + '" y="60" width="' + Math.max(cw * 0.55, 8) + '" height="3" rx="1.5" fill="#8794a8"/>';
    }
    const nr = Math.min((p.rows || []).length, 7);
    for (let r = 0; r < nr; r++) {
      g += '<rect x="68" y="' + (66 + r * 10) + '" width="' + (W - 74) + '" height="10" fill="' + (r % 2 ? '#fbfcfe' : '#ffffff') + '" stroke="#eef1f6" stroke-width=".5"/>';
      for (let c = 0; c < nc; c++) {
        const isFirst = c === 0;
        const wid = Math.max(cw * (isFirst ? 0.72 : 0.5), 7);
        g += '<rect x="' + (71 + c * cw) + '" y="' + (69.5 + r * 10) + '" width="' + wid + '" height="3" rx="1.5" fill="' + (isFirst ? '#FF4F1F' : '#c9d2df') + '" opacity="' + (isFirst ? '.85' : '1') + '"/>';
      }
    }
  }
  g += '</svg>';
  return g;
}
