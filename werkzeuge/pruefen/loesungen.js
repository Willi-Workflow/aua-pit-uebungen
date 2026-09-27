// Lösungen des Übungsmodus (js/loesungen.js) gegen die Nachrechnung: Was eine
// Pilotin aus dem gedruckten Blatt an Lösungen erwartet, der Reihe nach, und ob
// jede gezeichnete Lösung dicht an ihrer Beschriftung steht, die eigene frei
// lässt und im Zeichenfeld bleibt. Die Lage wird aus dem gezeichneten SVG
// gelesen, die Tinte aus den in Chrome gemessenen Zeichenmaßen berechnet.
// Genutzt von test/blaetter.test.js für alle 200 Blätter.

import { zeichneParcours } from '../../js/zeichnung.js';
import { rechenstellen } from '../../js/loesungen.js';
import { svgLesen } from './svg.js';
import { textteilPruefen } from './textteil.js';
import { parcoursPruefen } from './parcours.js';
import { GLYPHEN, GRUNDLINIE } from './tinte.js';
import { ENGLISCH, norm, anwenden, transformLesen, polygonPolygon } from './grundlagen.js';

// Was eine Pilotin an Lösungen erwartet, aus den nachgerechneten Kursen
// (flugKurse aus parcoursPruefen): je Gate-Zeile den Kurs danach, vor dem
// Segment nach einem Gate der Form A K, dann je Segment den Kurs, wenn er zu
// rechnen ist (ohne Kurs, HR, GK/, Kursangabe als Gegenkurs), und das
// Ergebnis der Rechenaufgabe. Himmelsrichtungen und Gradkurse ohne GK nicht.
export function erwarteteLoesungen(flugKurse) {
  const liste = [];
  for (const f of flugKurse) {
    if (f.art === 'gate') {
      liste.push({ art: 'gate', wert: f.kurs });
      continue;
    }
    if (f.anschluss) liste.push({ art: 'anschluss', wert: f.kurs });
    const l = f.lesung;
    if (l.hr || l.hrGrad !== null) liste.push({ art: 'hr', wert: f.kurs });
    else if (l.gk) liste.push({ art: 'gk', wert: f.kurs });
    else if (l.gkAngabe) liste.push({ art: 'gegenkurs', wert: f.kurs });
    else if (!l.mitKurs) liste.push({ art: 'kurs', wert: f.kurs });
    if (l.rechen !== null) liste.push({ art: 'rechen', wert: norm(f.kurs + l.rechen) });
  }
  return liste;
}

// Schreibweise je Art: "247°", "202,5°", "= 117", "K = 048°", "ESE"
const MUSTER = {
  kurs: /^(\d{3}(?:,5)?)°$/,
  gate: /^(\d{3}(?:,5)?)°$/,
  gegenkurs: /^(\d{3}(?:,5)?)°$/,
  gk: /^(\d{3}(?:,5)?)°$/,
  rechen: /^= (\d{3}(?:,5)?)$/,
  anschluss: /^K = (\d{3}(?:,5)?)°$/,
  hr: /^([NESW]{1,3})$/,
};

// Wert einer Lösung in Grad, null bei falscher Schreibweise
export function loesungWert(art, text) {
  const m = MUSTER[art] && text.match(MUSTER[art]);
  if (!m) return null;
  if (art === 'hr') return ENGLISCH.includes(m[1]) ? ENGLISCH.indexOf(m[1]) * 22.5 : null;
  return Number(m[1].replace(',', '.'));
}

// Die gezeichneten roten Lösungen eines SVG in ihrer Reihenfolge: Text, Anker
// und Lage aus dem transform, dazu die Schriftgröße aus dem Stil
export function loesungenLesen(svgText) {
  const stil = svgText.match(/\.parcours \.loesung \{[^}]*font: 700 ([\d.]+)px/);
  const schrift = stil ? Number(stil[1]) : null;
  const anker = { '': 'start', ' ende': 'end', ' mitte': 'middle' };
  return [...svgText.matchAll(/<text class="loesung( ende| mitte)?" data-schritt="(\d+)" transform="([^"]+)">([^<]+)<\/text>/g)]
    .map((m) => ({ schritt: Number(m[2]), anker: anker[m[1] || ''], t: transformLesen(m[3]), text: m[4], schrift }));
}

// Tinte einer gezeichneten Lösung (fett) als Polygon in Koordinaten der
// Zeichnung, aus den Zeichenmaßen in Schrift 9 hochgerechnet, ringsum um
// "rand" verkleinert. "=" misst wie "+".
export function loesungTinte(l, rand = 0) {
  const tabelle = GLYPHEN.fett;
  const glyph = (z) => tabelle[z] || (z === '=' ? tabelle['+'] : tabelle.W);
  const zeichen = [...l.text];
  let vorschub = 0; let oben = 0; let unten = 0;
  for (const z of zeichen) {
    const g = glyph(z);
    vorschub += g[0];
    if (z !== ' ') { oben = Math.max(oben, g[1]); unten = Math.max(unten, g[2]); }
  }
  const anfang = l.anker === 'start' ? 0 : l.anker === 'end' ? -vorschub : -vorschub / 2;
  const k = l.schrift / 9;
  const letztes = glyph(zeichen[zeichen.length - 1]);
  const x0 = (anfang - glyph(zeichen[0])[3]) * k + rand;
  const x1 = (anfang + vorschub - (letztes[0] - letztes[4])) * k - rand;
  const y0 = (GRUNDLINIE - oben) * k + rand;
  const y1 = (GRUNDLINIE + unten) * k - rand;
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }].map((p) => anwenden(l.t, p));
}

function imViewBox(vb, poly) {
  const [x, y, b, h] = vb;
  return poly.every((p) => p.x >= x && p.x <= x + b && p.y >= y && p.y <= y + h);
}

// Ein Blatt (aus erzeugeBlatt): Nachrechnung aus Sätzen und SVG,
// Rechenstellen, gezeichnete Lösungen. "fehler" sammelt jede Abweichung.
// Gezählt werden Lösungen links ('end') und als eigene Zeile außen ('middle')
// und Lösungen, deren Tinte mehr als 0,3 in fremde Tinte, einen fremden Kasten
// oder eine andere Lösung reicht (übereinander stehende Lösungen berühren sich
// mit dem Komma um 0,1).
export function blattAbgleichen(blatt) {
  const { stufe, nummer } = blatt;
  const svg = svgLesen(zeichneParcours(blatt.parcours));
  const text = textteilPruefen(blatt.textteil.zeilen.map((z) => z.satz));
  const erg = parcoursPruefen(blatt, svg, { kurs: text.kurs, hoehe: text.hoehe }, stufe);
  const stellen = rechenstellen(blatt);
  const soll = erwarteteLoesungen(erg.flugKurse);
  const ergebnis = { stellen: stellen.length, fehler: [], fremd: 0, links: 0, aussen: 0 };
  const fehler = (meldung) => ergebnis.fehler.push(`Stufe ${stufe}, Blatt ${nummer}: ${meldung}`);

  // Anzahl, Art, Wert und Reihenfolge wie die Nachrechnung
  if (stellen.length !== soll.length) fehler(`${stellen.length} Rechenstellen, nachgerechnet ${soll.length}`);
  stellen.forEach((s, i) => {
    if (!soll[i]) return;
    if (s.art !== soll[i].art) fehler(`Stelle ${i + 1}: Art ${s.art}, nachgerechnet ${soll[i].art}`);
    const wert = loesungWert(s.art, s.text);
    if (wert === null) fehler(`Stelle ${i + 1}: Schreibweise ${s.text}`);
    else if (Math.abs(norm(wert - soll[i].wert + 180) - 180) >= 0.01) fehler(`Stelle ${i + 1} (${s.art} an ${s.bezug}): ${s.text}, nachgerechnet ${soll[i].wert}`);
  });

  // Lage: jede Lösung an ihrer Beschriftung; deren Reihenfolge in der
  // Zeichnung ist die entlang des Parcours. Gate-Lösungen außerhalb des
  // Kastens auf der Höhe ihrer Zeile, die übrigen neben ihrer Zeile oder als
  // eigene Zeile außen, ohne die eigene Beschriftung zu berühren
  const texte = svg.texte.filter((t) => t.klasse !== 'nord');
  const gezeichnet = loesungenLesen(zeichneParcours(blatt.parcours, { loesungen: stellen }));
  if (gezeichnet.map((l) => l.text).join('|') !== stellen.map((s) => s.text).join('|')) fehler('gezeichnete Lösungen weichen ab');
  if (gezeichnet.some((l, i) => l.schritt !== i + 1)) fehler('Schritte nicht 1, 2, 3, …');
  const tinten = gezeichnet.map((l) => loesungTinte(l));
  let vorheriger = -1;
  stellen.forEach((s, i) => {
    if (!gezeichnet[i]) return;
    const stelle = `Stelle ${i + 1} (${s.text} an ${s.bezug})`;
    const gate = s.art === 'gate' || s.art === 'anschluss';
    const passend = texte
      .map((t, j) => ({ t, j }))
      .filter(({ t }) => (t.klasse === 'gate') === gate && t.zeilen[s.zeile] === s.bezug)
      .map((x) => ({ ...x, abstand: polygonPolygon(tinten[i], gate ? x.t.kasten.poly : x.t.tinte[s.zeile]) }))
      .sort((a, b) => a.abstand - b.abstand);
    if (!passend.length) {
      fehler(`${stelle}: keine Beschriftung mit dieser Zeile`);
      return;
    }
    const { t, j, abstand } = passend[0];
    if (j < vorheriger) fehler(`${stelle}: steht vor der Beschriftung der vorigen Stelle`);
    vorheriger = j;
    const l = gezeichnet[i];
    if (gate) {
      if (!(abstand > 0 && abstand < 6)) fehler(`${stelle}: Abstand zum Kasten ${abstand.toFixed(2)}`);
      const zeileY = t.t.y + t.dys.slice(0, s.zeile + 1).reduce((a, b) => a + b, 0);
      if (Math.abs(l.t.y - zeileY) >= 0.02) fehler(`${stelle}: Höhe ${l.t.y} statt ${zeileY}`);
    } else {
      if (!(abstand > 0 && abstand < 8)) fehler(`${stelle}: Abstand zur eigenen Zeile ${abstand.toFixed(2)}`);
      t.tinte.forEach((poly, k) => {
        if (polygonPolygon(tinten[i], poly) === 0) fehler(`${stelle}: verdeckt die eigene Zeile ${t.zeilen[k]}`);
      });
      if (Math.abs(l.t.w - t.t.w) >= 0.01) fehler(`${stelle}: Winkel ${l.t.w} statt ${t.t.w}`);
    }
    if (!imViewBox(svg.vb, tinten[i])) fehler(`${stelle}: ragt aus dem Zeichenfeld`);
    const innen = loesungTinte(l, 0.3);
    const fremd = texte.some((u) => u !== t && (u.klasse === 'gate' ? polygonPolygon(innen, u.kasten.poly) === 0 : u.tinte.some((p) => polygonPolygon(innen, p) === 0)))
      || tinten.some((p, k) => k !== i && polygonPolygon(innen, p) === 0);
    if (fremd) ergebnis.fremd += 1;
    if (l.anker === 'end') ergebnis.links += 1;
    if (l.anker === 'middle') ergebnis.aussen += 1;
  });
  return ergebnis;
}

// Mehrere Blätter, zusammengezählt
export function blaetterAbgleichen(blaetter) {
  const summe = { stellen: 0, fehler: [], fremd: 0, blaetterFremd: 0, links: 0, aussen: 0 };
  for (const blatt of blaetter) {
    const e = blattAbgleichen(blatt);
    summe.stellen += e.stellen;
    summe.fehler.push(...e.fehler);
    summe.fremd += e.fremd;
    if (e.fremd) summe.blaetterFremd += 1;
    summe.links += e.links;
    summe.aussen += e.aussen;
  }
  return summe;
}
