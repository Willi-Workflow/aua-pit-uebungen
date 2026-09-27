// Grundlagen der Logikprüfung: Maße, Gradrechnung, ebene Geometrie, SVG-Transformationen und Kreisbögen

export const DEUTSCH = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const ENGLISCH = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const RATE = 8; // ft je s
export const HMIN = 1000;
export const HMAX = 3000;
export const SEK_LAENGE = 5;
export const HALB = 4.5; // halbe Strichbreite
export const KURVENRATE = 3; // Grad je Sekunde bei Gradzahl-Kurven

// Mengen und Zeiten je Stufe, wie im Entwurf
export const MENGEN = {
  2: {
    dauern: [10, 15, 20, 30],
    gateDauern: [10, 15, 20],
    segmente: [18, 22],
    segmenteMitGates: [15, 19],
    kurven: [5, 7],
    kurvenMitGates: [4, 6],
    relativ: [3, 4],
    kursberechnungen: [8, 11],
    rechen: [5, 7],
    richtung: [3, 4],
    rechenBetrag: [100, 490],
    kurveWinkel: [30, 350],
  },
  3: {
    rechenBetrag: [100, 350],
    kurveWinkel: [40, 340],
    dauern: [10, 15, 20, 25],
    gateDauern: [10, 15, 20, 25],
    segmente: [18, 21],
    gkAngabeAnteil: 0.5,
    vollkreise: [1, 2],
    kurven: [2, 3],
    gates: [3, 4],
    relativ: [2, 3],
    hr: [1, 2],
    gkSegmente: [1, 2],
    gkZeilen: [2, 3],
    gkGesamt: [3, 5],
    rechen: [3, 5],
    richtung: [3, 5],
  },
};

export const norm = (g) => ((g % 360) + 360) % 360;
export const diff = (von, nach) => { const d = norm(nach - von); return d > 180 ? d - 360 : d; };
export const abst = (a, b) => Math.abs(diff(a, b));
export const inDir = (von, nach, richtung) => (richtung === 'rechts' ? norm(nach - von) : norm(von - nach));
export const peilung = (dx, dy) => norm((Math.atan2(dx, -dy) * 180) / Math.PI);
export const vek = (k) => ({ x: Math.sin((k * Math.PI) / 180), y: -Math.cos((k * Math.PI) / 180) });
export const d3 = (g) => String(Math.round(norm(g) * 10) / 10).replace(/^(\d)(\.|$)/, '00$1$2').replace(/^(\d\d)(\.|$)/, '0$1$2');
export const kursName = (g) => d3(g);
// Nächste Himmelsrichtung eines Kurses und ihr Abstand, genau in der Mitte 11,25
export const hrIndex = (g) => Math.round(norm(g) / 22.5) % 16;
export const hrAbstand = (g) => abst(g, hrIndex(g) * 22.5);

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const len = (v) => Math.hypot(v.x, v.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const kreuz = (a, b) => a.x * b.y - a.y * b.x;

export function punktStrecke(p, a, b) {
  const v = sub(b, a);
  const l2 = v.x * v.x + v.y * v.y;
  let t = l2 === 0 ? 0 : ((p.x - a.x) * v.x + (p.y - a.y) * v.y) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * v.x), p.y - (a.y + t * v.y));
}
export function schneiden(a1, a2, b1, b2) {
  const d1 = kreuz(sub(b2, b1), sub(a1, b1));
  const d2 = kreuz(sub(b2, b1), sub(a2, b1));
  const d3_ = kreuz(sub(a2, a1), sub(b1, a1));
  const d4 = kreuz(sub(a2, a1), sub(b2, a1));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3_ > 0 && d4 < 0) || (d3_ < 0 && d4 > 0));
}
export function streckeStrecke(a1, a2, b1, b2) {
  if (schneiden(a1, a2, b1, b2)) return 0;
  return Math.min(punktStrecke(a1, b1, b2), punktStrecke(a2, b1, b2), punktStrecke(b1, a1, a2), punktStrecke(b2, a1, a2));
}
export function imPolygon(p, poly) {
  let innen = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]; const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) innen = !innen;
  }
  return innen;
}
// Abstand Polygonzug zu geschlossenem Polygon, 0 bei Berührung oder Inhalt
export function zugPolygon(zug, poly) {
  for (const p of zug) if (imPolygon(p, poly)) return 0;
  if (zug.length === 1) {
    let m = Infinity;
    for (let i = 0; i < poly.length; i++) m = Math.min(m, punktStrecke(zug[0], poly[i], poly[(i + 1) % poly.length]));
    return m;
  }
  let m = Infinity;
  for (let i = 0; i + 1 < zug.length; i++) {
    for (let j = 0; j < poly.length; j++) {
      m = Math.min(m, streckeStrecke(zug[i], zug[i + 1], poly[j], poly[(j + 1) % poly.length]));
      if (m === 0) return 0;
    }
  }
  return m;
}
export function polygonPolygon(a, b) {
  for (const p of a) if (imPolygon(p, b)) return 0;
  for (const p of b) if (imPolygon(p, a)) return 0;
  let m = Infinity;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    m = Math.min(m, streckeStrecke(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length]));
  }
  return m;
}
export function zugZug(a, b) {
  let m = Infinity;
  for (let i = 0; i + 1 < a.length; i++) for (let j = 0; j + 1 < b.length; j++) {
    m = Math.min(m, streckeStrecke(a[i], a[i + 1], b[j], b[j + 1]));
  }
  return m;
}

export function transformLesen(t) {
  const tr = t.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
  const ro = t.match(/rotate\(([-\d.]+)\)/);
  const sc = t.match(/scale\(([-\d.]+)\)/);
  return { x: Number(tr[1]), y: Number(tr[2]), w: ro ? Number(ro[1]) : 0, s: sc ? Number(sc[1]) : 1 };
}
export function anwenden(t, p) {
  const r = (t.w * Math.PI) / 180;
  const x = p.x * t.s; const y = p.y * t.s;
  return { x: t.x + x * Math.cos(r) - y * Math.sin(r), y: t.y + x * Math.sin(r) + y * Math.cos(r) };
}

export function bogenGeometrie(p1, p2, r, fA, fS) {
  const hx = (p1.x - p2.x) / 2; const hy = (p1.y - p2.y) / 2;
  const halbeSehne = Math.hypot(hx, hy);
  let c;
  if (Math.abs(halbeSehne - r) < 0.05) {
    c = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  } else {
    let rr = r;
    const lam = (hx * hx + hy * hy) / (r * r);
    if (lam > 1) rr = r * Math.sqrt(lam);
    const num = rr ** 4 - rr * rr * hy * hy - rr * rr * hx * hx;
    const den = rr * rr * hy * hy + rr * rr * hx * hx;
    let coef = Math.sqrt(Math.max(0, num / den));
    if (fA === fS) coef = -coef;
    c = { x: coef * hy + (p1.x + p2.x) / 2, y: -coef * hx + (p1.y + p2.y) / 2 };
  }
  const th1 = Math.atan2(p1.y - c.y, p1.x - c.x);
  const th2 = Math.atan2(p2.y - c.y, p2.x - c.x);
  let dth = ((th2 - th1) * 180) / Math.PI;
  if (fS === 0 && dth > 0) dth -= 360;
  if (fS === 1 && dth < 0) dth += 360;
  if (Math.abs(Math.abs(dth) - 360) < 1e-6) dth = fS ? 360 : -360;
  if (fA === 1 && Math.abs(dth) < 180) dth = fS ? 360 - Math.abs(dth) : -(360 - Math.abs(dth));
  if (fA === 0 && Math.abs(dth) > 180.5) dth = fS ? 360 - Math.abs(dth) : -(360 - Math.abs(dth));
  const rechts = dth > 0;
  const tangente = (th) => (rechts ? peilung(-Math.sin(th), Math.cos(th)) : peilung(Math.sin(th), -Math.cos(th)));
  const radius = dist(p1, c);
  const schritte = Math.max(2, Math.ceil(Math.abs(dth) / 2));
  const punkte = [];
  for (let i = 0; i <= schritte; i++) {
    const th = th1 + ((dth * Math.PI) / 180) * (i / schritte);
    punkte.push({ x: c.x + radius * Math.cos(th), y: c.y + radius * Math.sin(th) });
  }
  punkte[0] = p1; punkte[punkte.length - 1] = p2;
  return { mitte: c, radius, dreh: dth, einKurs: tangente(th1), ausKurs: tangente(th2), punkte };
}

// Bogen aus Anfangspunkt, Eingangskurs (Tangente), Radius und Flags: Mittelpunkt
// liegt r quer zur Eingangsrichtung auf der Seite des Sweeps; geprüft wird, ob der
// Endpunkt auf diesem Kreis liegt (dann ist der Bogen tangential angesetzt).
export function bogenAusTangente(b, einKurs) {
  const rechts = b.fS === 1;
  const n = vek(einKurs + (rechts ? 90 : -90));
  const c = { x: b.start.x + b.r * n.x, y: b.start.y + b.r * n.y };
  const fehlerRadius = Math.abs(dist(b.ende, c) - b.r);
  const th1 = Math.atan2(b.start.y - c.y, b.start.x - c.x);
  const th2 = Math.atan2(b.ende.y - c.y, b.ende.x - c.x);
  let w = ((th2 - th1) * 180) / Math.PI;
  w = rechts ? norm(w) : norm(-w);
  if (w < 0.01 && b.fA === 1) w = 360;
  const passtFlag = (w > 180) === (b.fA === 1) || Math.abs(w - 180) < 0.5;
  const dreh = rechts ? w : -w;
  const tangente = (th) => (rechts ? peilung(-Math.sin(th), Math.cos(th)) : peilung(Math.sin(th), -Math.cos(th)));
  const schritte = Math.max(2, Math.ceil(w / 2));
  const punkte = [];
  for (let i = 0; i <= schritte; i++) {
    const th = th1 + (rechts ? 1 : -1) * ((w * Math.PI) / 180) * (i / schritte);
    punkte.push({ x: c.x + b.r * Math.cos(th), y: c.y + b.r * Math.sin(th) });
  }
  punkte[0] = b.start; punkte[punkte.length - 1] = b.ende;
  return { mitte: c, radius: b.r, dreh, einKurs, ausKurs: tangente(th2), punkte, fehlerRadius, passtFlag };
}

