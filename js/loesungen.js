// Übungsmodus der Blattansicht: die Rechenstellen eines Blatts mit Lösung und
// Lage, der Reihe nach entlang des Parcours vom Start bis zum Ende, dazu die
// Logik der Tasten. Kein DOM, damit alles ohne Browser geprüft werden kann;
// gezeichnet werden die Lösungen in zeichnung.js (zeichneParcours mit
// "loesungen"), bedient in uebungsmodus.js.
//
// Rechenstellen, nur im Parcours:
// - Segment ohne Kurs nach einer relativen Ecke (+117°) oder einer
//   Gradzahl-Kurve (139): der Kurs, etwa "247°"
// - Rechenaufgabe unter einem Segment (+230): Kurs plus Zahl, etwa "= 117"
// - jede Zeile eines Gates: der Kurs nach der Zeile
// - Stufe 3: Kursangabe als Gegenkurs (GK 247°/15" ergibt "067°"), HR/ und
//   HR 111°/ (die Himmelsrichtung wie auf dem Blatt, "ESE"), GK/ (der Kurs) und
//   die Anschlusszeile eines Gates der Form A ("K = 048°")
// Himmelsrichtungen und Gradkurse als Angabe ohne GK sind keine Rechenstelle,
// Vollkreise auch nicht. Halbe Grade (nach Himmelsrichtungen) mit Komma, "202,5°".

import { normieren, himmelsrichtungName, SCHREIBWEISE } from './kurs.js';
import { textBreite, ZEILENABSTAND } from './geometrie.js';
import { zeichenfeld, LOESUNG_SCHRIFT } from './zeichnung.js';
import { kursAnzeige } from './antwort.js';

// Luft zwischen Beschriftung (oder Kastenrand) und Lösung
const LUFT = 3;
// Halbe Randbreite eines Gate-Kastens, halbe Strichbreite der Linien
const KASTENRAND = 0.75;
const HALBER_STRICH = 4.5;
// Tinte einer Zeile in Schrift 9 um ihre Mitte, in Chrome gemessen (siehe
// werkzeuge/pruefen/tinte.js): Ziffern reichen 3,8 darüber und 2,9 darunter,
// der Schrägstrich 4,3 darunter. Die Lösung in Schrift 10 fett reicht 4,2
// darüber und 3,2 darunter, mit einem Teil des weißen Umrisses 4,6 und 4,0.
const TINTE_OBEN = 4;
const TINTE_UNTEN = 4.3;
const LOESUNG_OBEN = 4.6;
const LOESUNG_UNTEN = 4;
// Vorschub der Zeichen, die textBreite nicht kennt (dort 6,2), in Schrift 9
const WEITERE_BREITEN = { ',': 2.9, '=': 5.9 };
// Eine Lösung als eigene Zeile außen steht so weit von der Nachbarzeile
const AUSSEN_ABSTAND = ZEILENABSTAND + 1;

function grad(kurs) {
  return `${kursAnzeige(kurs)}°`;
}

// Breite einer Beschriftung in Schrift 9 ohne den Zuschlag von textBreite
function schriftBreite(text) {
  let breite = 0;
  for (const zeichen of text) breite += WEITERE_BREITEN[zeichen] ?? textBreite(zeichen) / 1.08;
  return breite;
}

// Breite einer Lösung: fett rund 8 % breiter, Schrift LOESUNG_SCHRIFT, 2 % Zuschlag
function loesungsBreite(text) {
  return schriftBreite(text) * 1.08 * 1.02 * (LOESUNG_SCHRIFT / 9);
}

// ---------------------------------------------------------------- Flächen
//
// Beschriftungen, Kästen, Lösungen und Linienstücke als konvexe Vierecke in
// Koordinaten der Zeichnung, mit umgebendem Rechteck zur schnellen Vorauswahl

// Rechteck im Koordinatensystem einer Beschriftung (Ursprung "o", Winkel "w"
// in Grad, x in Leserichtung, y nach unten), lokal von x0 bis x1, y0 bis y1
function rechteck(o, w, x0, x1, y0, y1) {
  const r = (w * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const p = (lx, ly) => ({ x: o.x + lx * cos - ly * sin, y: o.y + lx * sin + ly * cos });
  return flaeche([p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)]);
}

function flaeche(ecken) {
  const xs = ecken.map((p) => p.x);
  const ys = ecken.map((p) => p.y);
  return { ecken, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// Überlappen sich zwei konvexe Vierecke? Getrennt sind sie, wenn eine
// Kantennormale sie trennt (Satz von der trennenden Achse)
function ueberlappen(a, b) {
  if (a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY) return false;
  for (const f of [a, b]) {
    for (let i = 0; i < f.ecken.length; i++) {
      const p = f.ecken[i];
      const q = f.ecken[(i + 1) % f.ecken.length];
      const n = { x: q.y - p.y, y: p.x - q.x };
      let aMin = Infinity; let aMax = -Infinity; let bMin = Infinity; let bMax = -Infinity;
      for (const e of a.ecken) { const d = e.x * n.x + e.y * n.y; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
      for (const e of b.ecken) { const d = e.x * n.x + e.y * n.y; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
      if (aMax <= bMin || bMax <= aMin) return false;
    }
  }
  return true;
}

function imFeld(feld, f) {
  return f.minX >= feld.x && f.maxX <= feld.x + feld.breite && f.minY >= feld.y && f.maxY <= feld.y + feld.hoehe;
}

// Tinte einer Beschriftung zeilenweise; ein Gate-Text belegt seinen ganzen Kasten
function beschriftungsFlaechen(b) {
  if (b.gate) {
    const x = b.halbeBreite + KASTENRAND;
    const y = b.halbeHoehe + KASTENRAND;
    return [rechteck(b, 0, -x, x, -y, y)];
  }
  const faktor = b.fett ? 1.08 : 1;
  return b.zeilen.map((zeile, j) => {
    const halb = (schriftBreite(zeile) * faktor) / 2;
    return rechteck(b, b.winkel, -halb, halb, j * ZEILENABSTAND - TINTE_OBEN, j * ZEILENABSTAND + TINTE_UNTEN);
  });
}

// Linienstücke als Vierecke um jedes gerade Teilstück ihres Polygonzugs, so
// breit wie der Strich
function strichFlaechen(stueck) {
  const flaechen = [];
  const { punkte } = stueck;
  for (let i = 0; i + 1 < punkte.length; i++) {
    const p = punkte[i];
    const q = punkte[i + 1];
    const laenge = Math.hypot(q.x - p.x, q.y - p.y);
    if (laenge === 0) continue;
    const w = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    flaechen.push(rechteck(p, w, -0.5, laenge + 0.5, -HALBER_STRICH, HALBER_STRICH));
  }
  return flaechen;
}

// Alles, was eine Lösung nicht verdecken soll: Beschriftungen und Gate-Kästen
// ("besitzer" ist die Beschriftung), Flugzeugsymbol, Nordpfeil mit "N", und
// getrennt die Linien
function hindernisse(geometrie, feld) {
  const flaechen = [];
  for (const b of geometrie.beschriftungen) for (const f of beschriftungsFlaechen(b)) flaechen.push({ f, besitzer: b });
  const { mitte, radius } = geometrie.flugzeug;
  flaechen.push({ f: rechteck(mitte, 0, -radius, radius, -radius, radius), besitzer: null });
  if (feld.nord) {
    const { ende, kopf, links, rechts, n } = feld.nord;
    flaechen.push({ f: flaeche([ende, kopf, links, rechts].flatMap((p) => [{ x: p.x - 2, y: p.y - 2 }, { x: p.x + 2, y: p.y + 2 }])), besitzer: null });
    flaechen.push({ f: rechteck(n, 0, -6, 6, -6, 6), besitzer: null });
  }
  const striche = geometrie.stuecke.filter((s) => s.art !== 'gate').map((s) => strichFlaechen(s));
  return { flaechen, striche };
}

// ---------------------------------------------------------------- Lage

// Lage einer Lösung im Koordinatensystem einer Beschriftung ("ursprung",
// "winkel", x in Leserichtung, y nach unten): Sie beginnt bei (lx, ly) ('start'),
// endet dort ('end') oder steht mittig dort ('middle'), wie text-anchor
function lage(text, ursprung, winkel, lx, ly, anker) {
  const breite = loesungsBreite(text);
  const x0 = anker === 'start' ? lx : anker === 'end' ? lx - breite : lx - breite / 2;
  const r = (winkel * Math.PI) / 180;
  return {
    x: ursprung.x + lx * Math.cos(r) - ly * Math.sin(r),
    y: ursprung.y + lx * Math.sin(r) + ly * Math.cos(r),
    winkel,
    anker,
    flaeche: rechteck(ursprung, winkel, x0, x0 + breite, ly - LOESUNG_OBEN, ly + LOESUNG_UNTEN),
  };
}

// Kosten einer Lage, der Reihe nach verglichen: verdeckt die eigene
// Beschriftung (darf nicht sein), ragt aus dem Zeichenfeld, verdeckt fremde
// Beschriftungen, Kästen, Symbole oder schon gesetzte Lösungen, liegt auf Linien
function kosten(f, besitzer, feld, welt, gesetzt) {
  let eigen = 0;
  let fremd = 0;
  for (const h of welt.flaechen) {
    if (!ueberlappen(f, h.f)) continue;
    if (h.besitzer === besitzer) eigen += 1;
    else fremd += 1;
  }
  for (const g of gesetzt) if (ueberlappen(f, g)) fremd += 1;
  let linien = 0;
  for (const teile of welt.striche) if (teile.some((t) => ueberlappen(f, t))) linien += 1;
  return [eigen, imFeld(feld, f) ? 0 : 1, fremd, linien];
}

function summe(a, b) {
  return a.map((x, i) => x + b[i]);
}

function kleiner(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

// Mögliche Lagen der Lösungen einer Beschriftung ("eintraege" mit art, text,
// zeile), je Möglichkeit eine Lage je Eintrag, in der Reihenfolge des Vorzugs.
// Gate: alle rechts neben ihren Zeilen außerhalb des Kastens, sonst alle links
// (die Wahl je Zeile trifft setzen).
// Segment: alle rechts neben ihrer Zeile; der Eintrag an der vom Strich
// abgewandten Zeile als eigene Zeile außen über oder unter der Angabe (mittig,
// bündig mit ihrem Anfang oder Ende), die übrigen rechts; alle links; außen und
// die übrigen links.
function moeglichkeiten(b, eintraege) {
  if (b.gate) {
    const oben = -((b.zeilen.length - 1) * ZEILENABSTAND) / 2;
    const abstand = b.halbeBreite + KASTENRAND + LUFT;
    return [
      eintraege.map((e) => lage(e.text, b, 0, abstand, oben + e.zeile * ZEILENABSTAND, 'start')),
      eintraege.map((e) => lage(e.text, b, 0, -abstand, oben + e.zeile * ZEILENABSTAND, 'end')),
    ];
  }
  const neben = (e, seite) => {
    const abstand = textBreite(b.zeilen[e.zeile]) / 2 + LUFT;
    return seite === 'rechts'
      ? lage(e.text, b, b.winkel, abstand, e.zeile * ZEILENABSTAND, 'start')
      : lage(e.text, b, b.winkel, -abstand, e.zeile * ZEILENABSTAND, 'end');
  };
  // Liegt der Strich im Koordinatensystem der Beschriftung unten, ist oben außen
  const r = (b.winkel * Math.PI) / 180;
  const strichUnten = -(b.mitte.x - b.x) * Math.sin(r) + (b.mitte.y - b.y) * Math.cos(r) > 0;
  const aussenZeile = strichUnten ? 0 : b.zeilen.length - 1;
  const aussenY = strichUnten ? -AUSSEN_ABSTAND : (b.zeilen.length - 1) * ZEILENABSTAND + AUSSEN_ABSTAND;
  const aussen = eintraege.find((e) => e.zeile === aussenZeile);
  // Außen mittig, bündig mit dem Anfang oder mit dem Ende der Angabe
  const halb = schriftBreite(b.zeilen[aussenZeile]) / 2;
  const aussenLagen = [[0, 'middle'], [-halb, 'start'], [halb, 'end']];
  const mitAussen = (seite) => aussenLagen.map(([lx, anker]) => eintraege.map((e) => (e === aussen ? lage(e.text, b, b.winkel, lx, aussenY, anker) : neben(e, seite))));
  return [
    eintraege.map((e) => neben(e, 'rechts')),
    ...(aussen ? mitAussen('rechts') : []),
    eintraege.map((e) => neben(e, 'links')),
    ...(aussen && eintraege.length > 1 ? mitAussen('links') : []),
  ];
}

// Setzt die Lösungen einer Beschriftung in die Möglichkeit mit den geringsten
// Kosten (Summe über ihre Einträge), bei Gleichstand die frühere. Bei einem
// Gate zuletzt je Zeile die günstigere Seite, nur wenn das echt besser ist:
// Dann stehen die Lösungen nicht mehr in einer Spalte, aber jede an ihrer Zeile.
function setzen(b, eintraege, feld, welt, gesetzt) {
  const moeglich = moeglichkeiten(b, eintraege);
  const bewertet = moeglich.map((lagen) => lagen.map((l) => kosten(l.flaeche, b, feld, welt, gesetzt)));
  if (b.gate) {
    const [rechts, links] = bewertet;
    const wahl = eintraege.map((_, i) => (kleiner(links[i], rechts[i]) ? 1 : 0));
    moeglich.push(wahl.map((m, i) => moeglich[m][i]));
    bewertet.push(wahl.map((m, i) => bewertet[m][i]));
  }
  let beste = null;
  moeglich.forEach((lagen, m) => {
    const k = bewertet[m].reduce(summe, [0, 0, 0, 0]);
    if (!beste || kleiner(k, beste.k)) beste = { k, lagen };
  });
  return eintraege.map((e, i) => {
    const { flaeche: f, ...l } = beste.lagen[i];
    gesetzt.push(f);
    return { art: e.art, text: e.text, ...l, bezug: b.zeilen[e.zeile], zeile: e.zeile };
  });
}

// Alle Rechenstellen eines Blatts ({ parcours } aus erzeugeBlatt) in der
// Reihenfolge des Parcours. Je Stelle { art, text, x, y, winkel, anker, bezug,
// zeile }: "art" ist 'kurs', 'rechen', 'gate', 'anschluss', 'gegenkurs', 'hr'
// oder 'gk', "text" die Lösung, x, y und winkel ihre Lage in Koordinaten der
// Zeichnung, "anker" 'start', 'end' oder 'middle' wie text-anchor, "bezug" die
// Zeile der Beschriftung, zu der sie gehört, "zeile" deren Nummer ab 0.
// Die Beschriftungen der Geometrie stehen in der Reihenfolge der Elemente,
// "Start" und "Ende" (Stufe 3) vorn; sie werden hier Element für Element
// zugeordnet wie im wegbauer (geometrie.js). Gesetzt werden zuerst die Gates,
// die nur rechts oder links können, dann die Segmente, die ihnen ausweichen;
// sonst stand die Lösung eines Segments vor einem Kasten in dessen Spalte und
// las sich wie eine Gate-Zeile.
export function rechenstellen(blatt) {
  const { elemente, geometrie } = blatt.parcours;
  const texte = geometrie.beschriftungen.filter((b) => !b.fett);
  let naechster = 0;
  const holen = (passt, was) => {
    const b = texte[naechster];
    naechster += 1;
    if (!b || !passt(b)) throw new Error(`Beschriftung ${naechster} passt nicht zu ${was}`);
    return b;
  };
  // Je Beschriftung mit Rechenstellen ihre Einträge, in der Reihenfolge des Parcours
  const gruppen = [];
  // Wie im wegbauer: eine Ecke gibt es vor einem Segment, wenn schon ein Kurs
  // geflogen wird und keine Gradzahl-Kurve davor liegt
  let kursDa = false;
  let ohneEcke = false;
  for (let n = 0; n < elemente.length; n++) {
    const e = elemente[n];
    if (e.art === 'vollkreis') continue;
    if (e.art === 'kurve') {
      holen((b) => !b.gate && b.zeilen[0] === String(e.winkel), `Kurve ${e.winkel}`);
      ohneEcke = true;
      continue;
    }
    if (e.art === 'gate') {
      const b = holen((b2) => b2.gate && b2.zeilen.length === e.zeilen.length + (e.anschluss ? 1 : 0), 'Gate');
      const eintraege = e.zeilen.map((z, j) => ({ art: 'gate', text: grad(z.kursDanach), zeile: j }));
      // K ist der Kurs des nächsten gezeichneten Segments
      if (e.anschluss) eintraege.push({ art: 'anschluss', text: `K = ${grad(elemente[n + 1].kurs)}`, zeile: e.zeilen.length });
      gruppen.push({ b, eintraege });
      kursDa = false;
      continue;
    }
    if (kursDa && !ohneEcke && e.relativ !== null) {
      holen((b) => !b.gate && b.zeilen[0] === `${e.relativ > 0 ? '+' : ''}${e.relativ}°`, `Ecke ${e.relativ}`);
    }
    const b = holen((b2) => !b2.gate && b2.mitte !== null && b2.kurs === e.kurs, `Segment ${e.kurs}`);
    const eintraege = [];
    if (e.anzeige === 'keine') eintraege.push({ art: 'kurs', text: grad(e.kurs), zeile: 0 });
    else if (e.anzeige === 'hr' || e.anzeige === 'hrKurs') eintraege.push({ art: 'hr', text: himmelsrichtungName(e.himmelsrichtung, SCHREIBWEISE.zeichnung), zeile: 0 });
    else if (e.anzeige === 'gk') eintraege.push({ art: 'gk', text: grad(e.kurs), zeile: 0 });
    else if (e.alsGegenkurs) eintraege.push({ art: 'gegenkurs', text: grad(e.kurs), zeile: 0 });
    if (e.rechenaufgabe !== null) eintraege.push({ art: 'rechen', text: `= ${kursAnzeige(normieren(e.kurs + e.rechenaufgabe))}`, zeile: 1 });
    if (eintraege.length) gruppen.push({ b, eintraege });
    kursDa = true;
    ohneEcke = false;
  }
  if (naechster !== texte.length) throw new Error(`${texte.length - naechster} Beschriftungen ohne Element`);

  const feld = zeichenfeld(geometrie);
  const welt = hindernisse(geometrie, feld);
  const gesetzt = [];
  for (const g of gruppen.filter((g2) => g2.b.gate)) g.stellen = setzen(g.b, g.eintraege, feld, welt, gesetzt);
  for (const g of gruppen.filter((g2) => !g2.b.gate)) g.stellen = setzen(g.b, g.eintraege, feld, welt, gesetzt);
  return gruppen.flatMap((g) => g.stellen);
}

// Tasten im Übungsmodus: Leertaste zeigt die nächste Lösung ('weiter', ebenso
// Tippen und Klicken), Rücktaste und Pfeil links blenden die letzte aus
// ('zurueck'), Escape beendet ('ende'). Andere Tasten: null.
export function tasteZuAktion(taste) {
  if (taste === ' ' || taste === 'Spacebar') return 'weiter';
  if (taste === 'Backspace' || taste === 'ArrowLeft') return 'zurueck';
  if (taste === 'Escape' || taste === 'Esc') return 'ende';
  return null;
}

// Zahl der gezeigten Lösungen nach einer Aktion, zwischen 0 und "anzahl";
// "ende" blendet alle aus
export function naechsterStand(stand, anzahl, aktion) {
  if (aktion === 'weiter') return Math.min(stand + 1, anzahl);
  if (aktion === 'zurueck') return Math.max(stand - 1, 0);
  if (aktion === 'ende') return 0;
  return stand;
}

export function zaehlerText(stand, anzahl) {
  return `${stand} / ${anzahl}`;
}
