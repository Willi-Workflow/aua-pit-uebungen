// Zeichnet einen Parcours als SVG-Zeichenkette. Stile liegen im SVG selbst,
// damit das Bild auch außerhalb der App (Druck, Bildschirmfoto) gleich aussieht.
//
// Linienarten: horizontal = dicke schwarze Linie; sinken = schwarzer Rand mit
// weißer Linie darüber; steigen = dasselbe, die weiße Linie gestrichelt, so dass
// die Lücken als Sprossen erscheinen. Gradzahl-Kurven der Stufe 3 sind Bögen in
// derselben Linienart, Sprossen also auch auf dem Bogen. Gates sind weiße Kästen
// mit dünnem Rand, gezeichnet über den Linien, damit sie die ankommende Linie
// sauber abschneiden.
//
// Das Blatt ist so gedreht, dass der Start oben liegt; jede Richtung ist in der
// Geometrie schon als Kurs minus Drehung gezeichnet. Ein Nordpfeil oben rechts
// zeigt, wo Norden liegt, wie in der Handzeichnung.

import { ZEILENABSTAND, MARKENLAENGE, FLUGZEUG_RADIUS, vektor } from './geometrie.js';

// Rand um den Umriss: Querstriche ragen höchstens 9,6 Einheiten über die Mittellinie
export const RAND = 15;

const LINIENBREITE = 9;
const WEISSBREITE = 6;

function zahl(wert) {
  return Number(wert.toFixed(2)).toString();
}

function stueck(s) {
  if (s.profil === 'horizontal') return `<path class="horizontal" d="${s.pfad}"/>`;
  return `<path class="rand" d="${s.pfad}"/><path class="${s.profil}" d="${s.pfad}"/>`;
}

// Kurzer Strich quer zur gezeichneten Richtung am Übergang zwischen zwei Elementen
function marke(m) {
  const r = (m.gezeichnet * Math.PI) / 180;
  const nx = Math.cos(r) * MARKENLAENGE;
  const ny = Math.sin(r) * MARKENLAENGE;
  return `<line class="marke" x1="${zahl(m.punkt.x - nx)}" y1="${zahl(m.punkt.y - ny)}" x2="${zahl(m.punkt.x + nx)}" y2="${zahl(m.punkt.y + ny)}"/>`;
}

// Kasten eines Gates an seinen Ecken
function gateKasten(s) {
  const xs = s.punkte.map((q) => q.x);
  const ys = s.punkte.map((q) => q.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return `<rect class="gate" x="${zahl(x)}" y="${zahl(y)}" width="${zahl(Math.max(...xs) - x)}" height="${zahl(Math.max(...ys) - y)}"/>`;
}

function tspans(zeilen) {
  return zeilen
    .map((text, i) => `<tspan x="0" dy="${i === 0 ? 0 : ZEILENABSTAND}">${text}</tspan>`)
    .join('');
}

// Gate-Text linksbündig 5 Einheiten nach dem linken Kastenrand, der Block
// senkrecht mittig im Kasten
function gateText(b) {
  const x = b.x - b.halbeBreite + 5;
  const y = b.y - ((b.zeilen.length - 1) * ZEILENABSTAND) / 2;
  return `<text class="gate" transform="translate(${zahl(x)} ${zahl(y)})">${tspans(b.zeilen)}</text>`;
}

// "Start" und "Ende" (Stufe 3) fett, sonst wie jede Beschriftung
function beschriftung(b) {
  if (b.gate) return gateText(b);
  const klasse = b.fett ? ' class="fett"' : '';
  return `<text${klasse} transform="translate(${zahl(b.x)} ${zahl(b.y)}) rotate(${zahl(b.winkel)})">${tspans(b.zeilen)}</text>`;
}

// Flugzeugsymbol am Anfang des Parcours, Nase in gezeichneter Richtung des ersten Segments.
// Es sitzt kurz vor dem Startpunkt, damit es die Linie und den Querstrich nicht
// überdeckt. Die Lage kommt aus der Geometrie, dort hält die Kandidatensuche
// Linien und Beschriftungen vom Symbol fern; zum Umriss zählt es nicht.
const FLUGZEUG_PFAD = 'M 0 -25 C 2 -25 3 -22 3 -18 V -8 L 27 -4 V 0 L 3 -1 V 12 L 10 15 V 18 H -10 V 15 L -3 12 V -1 L -27 0 V -4 L -3 -8 V -18 C -3 -22 -2 -25 0 -25 Z';
const FLUGZEUG_MASSSTAB = 0.5;

function flugzeug(mitte, start) {
  return `<path class="flugzeug" transform="translate(${zahl(mitte.x)} ${zahl(mitte.y)}) rotate(${zahl(start.gezeichnet)}) scale(${FLUGZEUG_MASSSTAB})" d="${FLUGZEUG_PFAD}"/>`;
}

// Pfeil der Länge "laenge" mit Mitte "mitte" nach Norden der Zeichnung, also in
// Richtung minus Drehung: Schaft vom Ende bis zur Basis der Spitze, Spitze als
// Dreieck mit halber Breite "breite". "pfad(zahl)" schreibt ihn als einen Pfad.
function pfeil(mitte, drehung, laenge, spitze, breite) {
  const v = vektor(-drehung);
  const quer = { x: -v.y, y: v.x };
  const punkt = (laengs, seitlich = 0) => ({ x: mitte.x + v.x * laengs + quer.x * seitlich, y: mitte.y + v.y * laengs + quer.y * seitlich });
  const ende = punkt(-laenge / 2);
  const kopf = punkt(laenge / 2);
  const basis = punkt(laenge / 2 - spitze);
  const links = punkt(laenge / 2 - spitze, breite);
  const rechts = punkt(laenge / 2 - spitze, -breite);
  const pfad = (z) => `M ${z(ende.x)} ${z(ende.y)} L ${z(basis.x)} ${z(basis.y)} M ${z(kopf.x)} ${z(kopf.y)} L ${z(links.x)} ${z(links.y)} L ${z(rechts.x)} ${z(rechts.y)} Z`;
  return { v, ende, kopf, links, rechts, pfad };
}

// Nordpfeil: Mitte 30 Einheiten rechts und unterhalb der oberen rechten Ecke
// des Umrisses samt Flugzeugsymbol, Länge 44, davor ein fettes "N" 8 Einheiten
// hinter der Spitze. Zeigt Norden nach links, reichte das "N" dort bis an den
// Umriss (Blatt 50 mit Drehung 90: "N" auf dem Vollkreis); dann rückt der Pfeil
// nach rechts, bis Pfeil und "N" wie ein nach rechts zeigender Pfeil 8 Einheiten
// Luft haben. Reine Zeichnung, ohne Einfluss auf die Auswahl.
const NORDPFEIL_VERSATZ = 30;
const NORDPFEIL_LUFT = 8;
const NORDPFEIL_LAENGE = 44;
const NORDPFEIL_SPITZE = 10;
const NORDPFEIL_BREITE = 4.5;
const NORD_ABSTAND = 8;
// Platz, den das "N" um seinen Mittelpunkt braucht (Schrift 9, fett)
const NORD_RADIUS = 6;

// "optionen.nordpfeil" false zeichnet ohne Nordpfeil (Ausschnitte im
// Blitzrechnen, Norden ist dort immer oben); die Blätter zeichnen ihn immer.
export function zeichneParcours(parcours, optionen = {}) {
  const { stuecke, marken, beschriftungen, umriss, drehung } = parcours.geometrie;
  const start = marken[0];
  const { mitte } = parcours.geometrie.flugzeug;
  let minX = Math.min(umriss.minX, mitte.x - FLUGZEUG_RADIUS);
  let minY = Math.min(umriss.minY, mitte.y - FLUGZEUG_RADIUS);
  let maxX = Math.max(umriss.maxX, mitte.x + FLUGZEUG_RADIUS);
  let maxY = Math.max(umriss.maxY, mitte.y + FLUGZEUG_RADIUS);
  const nordpfeil = (mitte) => {
    const p = pfeil(mitte, drehung, NORDPFEIL_LAENGE, NORDPFEIL_SPITZE, NORDPFEIL_BREITE);
    return { ...p, n: { x: p.kopf.x + p.v.x * NORD_ABSTAND, y: p.kopf.y + p.v.y * NORD_ABSTAND } };
  };
  let nord = null;
  if (optionen.nordpfeil !== false) {
    // Wie weit Pfeil und "N" links von ihrer Mitte reichen
    const probe = nordpfeil({ x: 0, y: 0 });
    const links = Math.min(probe.ende.x, probe.kopf.x, probe.links.x, probe.rechts.x, probe.n.x - NORD_RADIUS);
    nord = nordpfeil({ x: maxX + Math.max(NORDPFEIL_VERSATZ, NORDPFEIL_LUFT - links), y: minY + NORDPFEIL_VERSATZ });
    const { n } = nord;
    // Die viewBox wächst um Pfeil und "N", wie um das Flugzeugsymbol
    for (const p of [nord.ende, nord.kopf, nord.links, nord.rechts]) {
      minX = Math.min(minX, p.x - 1);
      minY = Math.min(minY, p.y - 1);
      maxX = Math.max(maxX, p.x + 1);
      maxY = Math.max(maxY, p.y + 1);
    }
    minX = Math.min(minX, n.x - NORD_RADIUS);
    minY = Math.min(minY, n.y - NORD_RADIUS);
    maxX = Math.max(maxX, n.x + NORD_RADIUS);
    maxY = Math.max(maxY, n.y + NORD_RADIUS);
  }
  const x = minX - RAND;
  const y = minY - RAND;
  const breite = maxX - minX + 2 * RAND;
  const hoehe = maxY - minY + 2 * RAND;
  // Die Regel für fette Beschriftungen nur, wo es sie gibt, damit die Blätter
  // der Stufe 2 Zeichen für Zeichen bleiben, wie sie waren
  const fett = beschriftungen.some((b) => b.fett) ? '\n.parcours text.fett { font-weight: 700; }' : '';
  const teile = [
    ...stuecke.filter((s) => s.art !== 'gate').map(stueck),
    ...stuecke.filter((s) => s.art === 'gate').map(gateKasten),
    ...marken.map(marke),
    flugzeug(mitte, start),
    ...beschriftungen.map(beschriftung),
    ...(nord ? [
      `<path class="nordpfeil" d="${nord.pfad(zahl)}"/>`,
      `<text class="nord" transform="translate(${zahl(nord.n.x)} ${zahl(nord.n.y)})">N</text>`,
    ] : []),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" class="parcours" viewBox="${zahl(x)} ${zahl(y)} ${zahl(breite)} ${zahl(hoehe)}" role="img" aria-label="Parcours">
<style>
.parcours .horizontal, .parcours .rand { fill: none; stroke: #000; stroke-width: ${LINIENBREITE}; }
.parcours .sinken, .parcours .steigen { fill: none; stroke: #fff; stroke-width: ${WEISSBREITE}; }
.parcours .steigen { stroke-dasharray: 5 2.5; }
.parcours .marke { stroke: #000; stroke-width: 1.2; }
.parcours text { font: 9px system-ui, -apple-system, sans-serif; text-anchor: middle; dominant-baseline: middle; }
.parcours rect.gate { fill: #fff; stroke: #000; stroke-width: 1.5; }
.parcours .flugzeug { fill: #000; stroke: none; }
.parcours text.gate { text-anchor: start; }
.parcours .nordpfeil { fill: #000; stroke: #000; stroke-width: 1.5; stroke-linejoin: round; }
.parcours text.nord { font-weight: 700; }${fett}
</style>
${teile.join('\n')}
</svg>`;
}

// Vorschau für die Blattliste: nur der Weg, ohne Profile, Marken und
// Beschriftungen, dazu ein kleiner Nordpfeil ohne Buchstaben. Stile stehen als
// Attribute im Bild, damit die Datei allein in <img> taugt. Eine Nachkommastelle
// reicht bei Vorschaugröße und hält die Dateien klein.
const VORSCHAU_RAND = 20;
// Nordpfeil der Vorschau, Länge 16, Strich 3: Mitte 10 Einheiten außerhalb der
// oberen rechten Ecke des Umrisses, so dass er ganz im Rand liegt
const VORSCHAU_PFEIL_LAENGE = 16;
const VORSCHAU_PFEIL_SPITZE = 6;
const VORSCHAU_PFEIL_BREITE = 3.5;

function zahlKurz(wert) {
  return Number(wert.toFixed(1)).toString();
}

function pfadKurz(pfad) {
  return pfad.replace(/-?\d+(?:\.\d+)?/g, (z) => zahlKurz(Number(z)));
}

// Gate-Kasten achsenparallel aus seinen Ecken, weiß mit schwarzem Rand
function vorschauKasten(s) {
  const xs = s.punkte.map((p) => p.x);
  const ys = s.punkte.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return `<rect x="${zahlKurz(x)}" y="${zahlKurz(y)}" width="${zahlKurz(Math.max(...xs) - x)}" height="${zahlKurz(Math.max(...ys) - y)}" fill="#fff" stroke="#000" stroke-width="4"/>`;
}

export function zeichneVorschau(parcours) {
  const { stuecke, umriss, drehung } = parcours.geometrie;
  const x = umriss.minX - VORSCHAU_RAND;
  const y = umriss.minY - VORSCHAU_RAND;
  const breite = umriss.maxX - umriss.minX + 2 * VORSCHAU_RAND;
  const hoehe = umriss.maxY - umriss.minY + 2 * VORSCHAU_RAND;
  const linien = stuecke.filter((s) => s.art !== 'gate').map((s) => `<path d="${pfadKurz(s.pfad)}"/>`);
  const kaesten = stuecke.filter((s) => s.art === 'gate').map(vorschauKasten);
  const nord = pfeil({ x: umriss.maxX + VORSCHAU_RAND / 2, y: umriss.minY + VORSCHAU_RAND / 2 }, drehung, VORSCHAU_PFEIL_LAENGE, VORSCHAU_PFEIL_SPITZE, VORSCHAU_PFEIL_BREITE);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${zahlKurz(x)} ${zahlKurz(y)} ${zahlKurz(breite)} ${zahlKurz(hoehe)}" preserveAspectRatio="xMidYMid meet">`,
    '<g fill="none" stroke="#000" stroke-width="11" stroke-linecap="round">',
    ...linien,
    '</g>',
    ...kaesten,
    `<path class="nordpfeil" d="${nord.pfad(zahlKurz)}" fill="#000" stroke="#000" stroke-width="3" stroke-linejoin="round"/>`,
    '</svg>',
    '',
  ].join('\n');
}
