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

export function zeichneParcours(parcours) {
  const { stuecke, marken, beschriftungen, umriss } = parcours.geometrie;
  const x = umriss.minX - RAND;
  const y = umriss.minY - RAND;
  const breite = umriss.maxX - umriss.minX + 2 * RAND;
  const hoehe = umriss.maxY - umriss.minY + 2 * RAND;
  const teile = [
    ...stuecke.filter((s) => s.art !== 'gate').map(stueck),
    ...stuecke.filter((s) => s.art === 'gate').map(gateKasten),
    ...marken.map(marke),
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
.parcours text.gate { text-anchor: start; }
</style>
${teile.join('\n')}
</svg>`;
}
