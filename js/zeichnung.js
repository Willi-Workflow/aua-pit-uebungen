// Zeichnet einen Parcours als SVG-Zeichenkette. Stile liegen im SVG selbst,
// damit das Bild auch außerhalb der App (Druck, Bildschirmfoto) gleich aussieht.
//
// Linienarten: horizontal = dicke schwarze Linie; sinken = schwarzer Rand mit
// weißer Linie darüber; steigen = dasselbe, die weiße Linie gestrichelt, so dass
// die Lücken als Sprossen erscheinen.

export const RAND = 30;

const LINIENBREITE = 9;
const WEISSBREITE = 6;
const MARKENLAENGE = 9;
const ZEILENABSTAND = 9;

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

function beschriftung(b) {
  const zeilen = b.zeilen
    .map((text, i) => `<tspan x="0" dy="${i === 0 ? 0 : ZEILENABSTAND}">${text}</tspan>`)
    .join('');
  return `<text transform="translate(${zahl(b.x)} ${zahl(b.y)}) rotate(${zahl(b.winkel)})">${zeilen}</text>`;
}

export function zeichneParcours(parcours) {
  const { stuecke, marken, beschriftungen, umriss } = parcours.geometrie;
  const x = umriss.minX - RAND;
  const y = umriss.minY - RAND;
  const breite = umriss.maxX - umriss.minX + 2 * RAND;
  const hoehe = umriss.maxY - umriss.minY + 2 * RAND;
  const teile = [
    ...stuecke.map(stueck),
    ...marken.map(marke),
    ...beschriftungen.map(beschriftung),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" class="parcours" viewBox="${zahl(x)} ${zahl(y)} ${zahl(breite)} ${zahl(hoehe)}" role="img" aria-label="Parcours">
<style>
.horizontal, .rand { fill: none; stroke: #000; stroke-width: ${LINIENBREITE}; }
.sinken, .steigen { fill: none; stroke: #fff; stroke-width: ${WEISSBREITE}; }
.steigen { stroke-dasharray: 5 2.5; }
.marke { stroke: #000; stroke-width: 1.2; }
text { font: 8px system-ui, -apple-system, sans-serif; text-anchor: middle; dominant-baseline: middle; }
</style>
${teile.join('\n')}
</svg>`;
}
