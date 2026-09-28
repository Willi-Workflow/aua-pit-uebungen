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

// Zeilen einer Beschriftung. "ersetzt" (Übungsmodus) nennt je Zeile, die eine
// Lösung ersetzt, deren Schritt und ob sie schon verborgen ist
function tspans(zeilen, ersetzt = []) {
  return zeilen
    .map((text, i) => {
      const e = ersetzt[i];
      const zusatz = e ? ` data-ersetzt="${e.schritt}"${e.verborgen ? ' class="ersetzt"' : ''}` : '';
      return `<tspan x="0" dy="${i === 0 ? 0 : ZEILENABSTAND}"${zusatz}>${text}</tspan>`;
    })
    .join('');
}

// Ursprung, Drehung und Anker eines Beschriftungstexts. Gate-Text linksbündig
// 5 Einheiten nach dem linken Kastenrand, der Block senkrecht mittig im Kasten,
// ohne Drehung; jede andere Beschriftung mittig an ihrem Punkt, gedreht. Die
// Lösungen des Übungsmodus stehen mit demselben transform an ihrer Zeile.
export function textLage(b) {
  if (b.gate) {
    const x = b.x - b.halbeBreite + 5;
    const y = b.y - ((b.zeilen.length - 1) * ZEILENABSTAND) / 2;
    return { x, y, winkel: 0, anker: 'start', transform: `translate(${zahl(x)} ${zahl(y)})` };
  }
  return { x: b.x, y: b.y, winkel: b.winkel, anker: 'middle', transform: `translate(${zahl(b.x)} ${zahl(b.y)}) rotate(${zahl(b.winkel)})` };
}

// "Start" und "Ende" (Stufe 3) fett, Gates mit eigener Klasse, sonst wie jede Beschriftung
function beschriftung(b, ersetzt) {
  const klasse = b.gate ? ' class="gate"' : b.fett ? ' class="fett"' : '';
  return `<text${klasse} transform="${textLage(b).transform}">${tspans(b.zeilen, ersetzt)}</text>`;
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

// Zeichenfeld eines Parcours: Umriss samt Flugzeugsymbol und, außer bei
// "optionen.nordpfeil" false, Nordpfeil mit "N", ringsum RAND. Liefert die
// viewBox (x, y, breite, hoehe) und die Lage des Nordpfeils ("nord" oder null).
export function zeichenfeld(geometrie, optionen = {}) {
  const { umriss, drehung } = geometrie;
  const { mitte } = geometrie.flugzeug;
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
  return { x: minX - RAND, y: minY - RAND, breite: maxX - minX + 2 * RAND, hoehe: maxY - minY + 2 * RAND, nord };
}

// Druck auf A4 (style.css, @media print): Die Zeichnung bekommt die volle
// Breite und die Höhe, die Titel, Textteil und Legende übrig lassen, in Chrome
// gemessen in CSS-Pixeln: 703 breit, 688 hoch, auf Gate-Blättern der Stufe 2
// mit dem zweizeiligen Gate-Hinweis 652. Die Beschriftung (Schrift 9 in
// Einheiten der Zeichnung) erscheint damit in dieser Größe in Punkt.
export const DRUCKFLAECHE = { breite: 703, hoehe: 688, hoeheMitGateHinweis: 652 };

export function druckschrift(geometrie, hoehe = DRUCKFLAECHE.hoehe) {
  const feld = zeichenfeld(geometrie);
  return 9 * 0.75 * Math.min(DRUCKFLAECHE.breite / feld.breite, hoehe / feld.hoehe);
}

// Übungsmodus der Blattansicht (loesungen.js): Jede Lösung ersetzt eine Zeile
// einer Beschriftung. Sie steht dort mit demselben transform, derselben Zeilenhöhe,
// demselben Anker und in derselben Schriftgröße, nur fett und rot, und ist
// verborgen, bis die Klasse "gezeigt" sie einblendet; die Klasse "ersetzt"
// verbirgt dann die schwarze Zeile (visibility, damit die übrigen Zeilen stehen
// bleiben, wo sie sind). Eine Lösung ist meist breiter als ihre Zeile ("247°/15""
// statt "/15""); wo sie dabei über einen Strich reicht, hält ein weißer Umriss
// sie lesbar. Die Umrisse liegen als eigene Lage unter allen roten Texten, damit
// der Umriss einer Zeile nie die Lösung der Zeile darüber anschneidet.
export const LOESUNG_SCHRIFT = 9;
export const LOESUNG_FARBE = '#c0262d';
const LOESUNG_UMRISS = 2.5;

// Eine Gate-Zeile als Lösung ist oft breiter als die breiteste Zeile, nach der
// der Kasten bemessen ist ("über N auf 048°" statt "über N auf K"). Reicht sie
// näher als KASTEN_LUFT an den inneren Rand des Kastens, wird sie auf die Länge
// bis dahin gestaucht (textLength), statt über den Kasten hinauszuragen.
// Gemessen wird mit dem Vorschub der Zeichen in Schrift 9 fett, in Chrome
// gemessen (system-ui auf macOS, wie in werkzeuge/pruefen/tinte.js); ein
// großzügigerer Schätzwert würde Zeilen, die passen, auf die Länge strecken.
// Unbekannte Zeichen zählen wie das breiteste, das W.
const KASTEN_LUFT = 1;
const FETT_VORSCHUB = {
  0: 6.33, 1: 4.77, 2: 5.96, 3: 6.19, 4: 6.35, 5: 6.14, 6: 6.32, 7: 5.61, 8: 6.41, 9: 6.32,
  '°': 4.53, '"': 5.29, ',': 3.3, '.': 3.3, ' ': 2.49, '→': 8.66, '↗': 7.35, '↘': 7.35,
  N: 7.08, S: 6.25, W: 9.25, a: 5.48, b: 6.03, e: 5.58, f: 3.84, k: 5.58, r: 4.08, u: 5.81, z: 5.26, ü: 5.81,
};

function fettBreite(text) {
  let summe = 0;
  for (const zeichen of text) summe += FETT_VORSCHUB[zeichen] ?? FETT_VORSCHUB.W;
  return summe;
}

function gateLoesungLaenge(b, text) {
  const frei = 2 * b.halbeBreite - 5 - 0.75 - KASTEN_LUFT;
  return fettBreite(text) > frei ? frei : null;
}

function loesung(s, i, sichtbar, b, umriss) {
  const { transform, anker } = textLage(b);
  const klasse = `loesung${umriss ? ' umriss' : ''}${anker === 'start' ? ' start' : ''}${i < sichtbar ? ' gezeigt' : ''}`;
  const laenge = b.gate ? gateLoesungLaenge(b, s.text) : null;
  const stauchen = laenge ? ` textLength="${zahl(laenge)}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text class="${klasse}" data-schritt="${i + 1}" transform="${transform}" y="${zahl(s.zeile * ZEILENABSTAND)}"${stauchen}>${s.text}</text>`;
}

// "optionen.nordpfeil" false zeichnet ohne Nordpfeil (Ausschnitte im
// Blitzrechnen, Norden ist dort immer oben); die Blätter zeichnen ihn immer.
// "optionen.loesungen" (Liste aus rechenstellen in loesungen.js) zeichnet die
// Lösungen des Übungsmodus als verborgene Gruppe obenauf, einzeln über
// "data-schritt" einzublenden, und markiert die Zeilen, die sie ersetzen, mit
// "data-ersetzt"; die ersten "optionen.loesungenSichtbar" stehen schon da, ihre
// Zeilen sind verborgen (Prüfmodus). Ohne "loesungen" bleibt das SVG Zeichen
// für Zeichen, wie es war.
export function zeichneParcours(parcours, optionen = {}) {
  const { stuecke, marken, beschriftungen } = parcours.geometrie;
  const start = marken[0];
  const { mitte } = parcours.geometrie.flugzeug;
  const { x, y, breite, hoehe, nord } = zeichenfeld(parcours.geometrie, optionen);
  // Die Regel für fette Beschriftungen nur, wo es sie gibt, damit die Blätter
  // der Stufe 2 Zeichen für Zeichen bleiben, wie sie waren
  const fett = beschriftungen.some((b) => b.fett) ? '\n.parcours text.fett { font-weight: 700; }' : '';
  const loesungen = optionen.loesungen || null;
  const uebung = loesungen
    ? `\n.parcours .loesung { display: none; font: 700 ${LOESUNG_SCHRIFT}px system-ui, -apple-system, sans-serif; fill: ${LOESUNG_FARBE}; }`
      + `\n.parcours .loesung.umriss { fill: #fff; stroke: #fff; stroke-width: ${LOESUNG_UMRISS}px; stroke-linejoin: round; }`
      + '\n.parcours .loesung.start { text-anchor: start; }'
      + '\n.parcours .loesung.gezeigt { display: inline; }'
      + '\n.parcours .ersetzt { visibility: hidden; }'
    : '';
  const sichtbar = optionen.loesungenSichtbar || 0;
  // Je Beschriftung die Zeilen, die eine Lösung ersetzt
  const ersetzt = beschriftungen.map(() => []);
  (loesungen || []).forEach((s, i) => {
    ersetzt[s.beschriftung][s.zeile] = { schritt: i + 1, verborgen: i < sichtbar };
  });
  const teile = [
    ...stuecke.filter((s) => s.art !== 'gate').map(stueck),
    ...stuecke.filter((s) => s.art === 'gate').map(gateKasten),
    ...marken.map(marke),
    flugzeug(mitte, start),
    ...beschriftungen.map((b, i) => beschriftung(b, ersetzt[i])),
    ...(nord ? [
      `<path class="nordpfeil" d="${nord.pfad(zahl)}"/>`,
      `<text class="nord" transform="translate(${zahl(nord.n.x)} ${zahl(nord.n.y)})">N</text>`,
    ] : []),
    ...(loesungen ? [
      '<g class="loesungen">',
      ...loesungen.map((s, i) => loesung(s, i, sichtbar, beschriftungen[s.beschriftung], true)),
      ...loesungen.map((s, i) => loesung(s, i, sichtbar, beschriftungen[s.beschriftung], false)),
      '</g>',
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
.parcours text.nord { font-weight: 700; }${fett}${uebung}
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
