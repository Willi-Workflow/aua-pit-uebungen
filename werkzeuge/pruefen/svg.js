// Liest ein gezeichnetes Blatt: Stücke samt Linienart, Gate-Kästen, Querstriche, Texte, Flugzeugsymbol, Nordpfeil

import { peilung, dist, transformLesen, anwenden } from './grundlagen.js';

export function svgLesen(svg) {
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/).slice(1).map(Number);
  const stil = (svg.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const pfade = [...svg.matchAll(/<path class="([^"]+)"(?: transform="([^"]+)")? d="([^"]+)"\/>/g)].map((m) => ({ klasse: m[1], transform: m[2], d: m[3] }));
  const kaesten = [...svg.matchAll(/<rect class="gate" x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"\/>/g)]
    .map((m) => { const [x, y, w, h] = m.slice(1).map(Number); return { x, y, w, h, poly: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] }; });
  const marken = [...svg.matchAll(/<line class="marke" x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"\/>/g)]
    .map((m) => { const [x1, y1, x2, y2] = m.slice(1).map(Number); return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, m: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } }; });
  const texte = [...svg.matchAll(/<text(?: class="([^"]+)")? transform="([^"]+)">(.*?)<\/text>/g)].map((m) => {
    const inhalt = m[3];
    const spans = [...inhalt.matchAll(/<tspan x="0" dy="([-\d.]+)">(.*?)<\/tspan>/g)].map((s) => ({ dy: Number(s[1]), text: s[2] }));
    return { klasse: m[1] || '', transform: m[2], t: transformLesen(m[2]), zeilen: spans.length ? spans.map((s) => s.text) : [inhalt], dys: spans.map((s) => s.dy) };
  });
  // Stücke: rand + sinken/steigen mit gleichem d ergeben eines
  const stuecke = [];
  let flugzeug = null; let nordpfeil = null;
  for (let i = 0; i < pfade.length; i++) {
    const p = pfade[i];
    if (p.klasse === 'flugzeug') { flugzeug = p; continue; }
    if (p.klasse === 'nordpfeil') { nordpfeil = p; continue; }
    let profil;
    if (p.klasse === 'horizontal') profil = 'horizontal';
    else if (p.klasse === 'rand') {
      const q = pfade[i + 1];
      if (!q || q.d !== p.d || !['sinken', 'steigen'].includes(q.klasse)) { stuecke.push({ fehler: `Randpfad ohne passende Innenlinie: ${p.d}` }); continue; }
      profil = q.klasse; i += 1;
    } else { stuecke.push({ fehler: `unbekannte Pfadklasse ${p.klasse}` }); continue; }
    const l = p.d.match(/^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)$/);
    const a = p.d.match(/^M ([-\d.]+) ([-\d.]+) A ([-\d.]+) ([-\d.]+) 0 ([01]) ([01]) ([-\d.]+) ([-\d.]+)$/);
    if (l) {
      const s = { x: +l[1], y: +l[2] }; const e = { x: +l[3], y: +l[4] };
      const k = peilung(e.x - s.x, e.y - s.y);
      stuecke.push({ art: 'strecke', profil, start: s, ende: e, kurs: k, laenge: dist(s, e), punkte: [s, e], einKurs: k, ausKurs: k });
    } else if (a) {
      const s = { x: +a[1], y: +a[2] }; const e = { x: +a[7], y: +a[8] };
      stuecke.push({ art: 'bogen', profil, start: s, ende: e, r: +a[3], fA: +a[5], fS: +a[6] });
    } else stuecke.push({ fehler: `unbekannte Pfadform ${p.d}` });
  }
  const nord = texte.find((t) => t.klasse === 'nord');
  return { vb, stil, stuecke, kaesten, marken, texte, flugzeug, nordpfeil, nord };
}

// Flugzeugsymbol als Polygon aus den Stützpunkten des Pfads
export function flugzeugPolygon(fz) {
  const t = transformLesen(fz.transform);
  const tok = fz.d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g);
  const pts = []; let cur = { x: 0, y: 0 }; let i = 0; let cmd = null;
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) { cmd = tok[i]; i += 1; if (cmd === 'Z') continue; }
    if (cmd === 'M' || cmd === 'L') { cur = { x: +tok[i], y: +tok[i + 1] }; i += 2; pts.push(cur); }
    else if (cmd === 'V') { cur = { x: cur.x, y: +tok[i] }; i += 1; pts.push(cur); }
    else if (cmd === 'H') { cur = { x: +tok[i], y: cur.y }; i += 1; pts.push(cur); }
    else if (cmd === 'C') { const p1 = { x: +tok[i], y: +tok[i + 1] }; const p2 = { x: +tok[i + 2], y: +tok[i + 3] }; cur = { x: +tok[i + 4], y: +tok[i + 5] }; i += 6; pts.push(p1, p2, cur); }
    else i += 1;
  }
  return { t, poly: pts.map((p) => anwenden(t, p)) };
}
