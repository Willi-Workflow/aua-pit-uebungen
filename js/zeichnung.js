// Zeichnet einen Parcours als SVG-Zeichenkette. Stile liegen im SVG selbst,
// damit das Bild auch außerhalb der App (Druck, Bildschirmfoto) gleich aussieht.
//
// Linienarten: horizontal = dicke schwarze Linie; sinken = schwarzer Rand mit
// weißer Linie darüber; steigen = dasselbe, die weiße Linie gestrichelt, so dass
// die Lücken als Sprossen erscheinen. Gates sind weiße Kästen mit dünnem Rand,
// gezeichnet über den Linien, damit sie die ankommende Linie sauber abschneiden.

import { ZEILENABSTAND, MARKENLAENGE } from './parcours.js';

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

// Kurzer Strich quer zum Kurs am Übergang zwischen zwei Elementen
function marke(m) {
  const r = (m.kurs * Math.PI) / 180;
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

function beschriftung(b) {
  if (b.gate) return gateText(b);
  return `<text transform="translate(${zahl(b.x)} ${zahl(b.y)}) rotate(${zahl(b.winkel)})">${tspans(b.zeilen)}</text>`;
}

// Flugzeugsymbol am Anfang des Parcours, Nase in Richtung des ersten Segments.
// Es sitzt kurz vor dem Startpunkt, damit es die Linie und den Querstrich nicht
// überdeckt. Reine Zeichnung, ohne Einfluss auf Umriss und Kandidatenwahl.
const FLUGZEUG_PFAD = 'M 0 -25 C 2 -25 3 -22 3 -18 V -8 L 27 -4 V 0 L 3 -1 V 12 L 10 15 V 18 H -10 V 15 L -3 12 V -1 L -27 0 V -4 L -3 -8 V -18 C -3 -22 -2 -25 0 -25 Z';
const FLUGZEUG_MASSSTAB = 0.5;
const FLUGZEUG_ABSTAND = 19;
export const FLUGZEUG_RADIUS = 14;

function flugzeugMitte(start) {
  const r = (start.kurs * Math.PI) / 180;
  return { x: start.punkt.x - Math.sin(r) * FLUGZEUG_ABSTAND, y: start.punkt.y + Math.cos(r) * FLUGZEUG_ABSTAND };
}

function flugzeug(start) {
  const mitte = flugzeugMitte(start);
  return `<path class="flugzeug" transform="translate(${zahl(mitte.x)} ${zahl(mitte.y)}) rotate(${zahl(start.kurs)}) scale(${FLUGZEUG_MASSSTAB})" d="${FLUGZEUG_PFAD}"/>`;
}

export function zeichneParcours(parcours) {
  const { stuecke, marken, beschriftungen, umriss } = parcours.geometrie;
  const start = marken[0];
  const mitte = flugzeugMitte(start);
  const minX = Math.min(umriss.minX, mitte.x - FLUGZEUG_RADIUS);
  const minY = Math.min(umriss.minY, mitte.y - FLUGZEUG_RADIUS);
  const maxX = Math.max(umriss.maxX, mitte.x + FLUGZEUG_RADIUS);
  const maxY = Math.max(umriss.maxY, mitte.y + FLUGZEUG_RADIUS);
  const x = minX - RAND;
  const y = minY - RAND;
  const breite = maxX - minX + 2 * RAND;
  const hoehe = maxY - minY + 2 * RAND;
  const teile = [
    ...stuecke.filter((s) => s.art !== 'gate').map(stueck),
    ...stuecke.filter((s) => s.art === 'gate').map(gateKasten),
    ...marken.map(marke),
    flugzeug(start),
    ...beschriftungen.map(beschriftung),
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
</style>
${teile.join('\n')}
</svg>`;
}

// Vorschau für die Blattliste: nur der Weg, ohne Profile, Marken und
// Beschriftungen. Stile stehen als Attribute im Bild, damit die Datei allein in
// <img> taugt. Eine Nachkommastelle reicht bei Vorschaugröße und hält die
// Dateien klein.
const VORSCHAU_RAND = 20;

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
  const { stuecke, umriss } = parcours.geometrie;
  const x = umriss.minX - VORSCHAU_RAND;
  const y = umriss.minY - VORSCHAU_RAND;
  const breite = umriss.maxX - umriss.minX + 2 * VORSCHAU_RAND;
  const hoehe = umriss.maxY - umriss.minY + 2 * VORSCHAU_RAND;
  const linien = stuecke.filter((s) => s.art !== 'gate').map((s) => `<path d="${pfadKurz(s.pfad)}"/>`);
  const kaesten = stuecke.filter((s) => s.art === 'gate').map(vorschauKasten);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${zahlKurz(x)} ${zahlKurz(y)} ${zahlKurz(breite)} ${zahlKurz(hoehe)}" preserveAspectRatio="xMidYMid meet">`,
    '<g fill="none" stroke="#000" stroke-width="11" stroke-linecap="round">',
    ...linien,
    '</g>',
    ...kaesten,
    '</svg>',
    '',
  ].join('\n');
}
