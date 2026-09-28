// Lösungen des Übungsmodus (js/loesungen.js) gegen die Nachrechnung: Was eine
// Pilotin aus dem gedruckten Blatt an Lösungen erwartet, der Reihe nach, und ob
// jede gezeichnete Lösung genau eine schwarze Zeile ersetzt und genau an deren
// Stelle steht (gleicher transform, gleiche Zeilenhöhe, gleicher Anker, gleiche
// Schriftgröße). Gelesen wird aus dem gezeichneten SVG, die Tinte aus den in
// Chrome gemessenen Zeichenmaßen berechnet. Genutzt von test/blaetter.test.js
// für alle 200 Blätter.

import { zeichneParcours } from '../../js/zeichnung.js';
import { rechenstellen } from '../../js/loesungen.js';
import { svgLesen } from './svg.js';
import { textteilPruefen } from './textteil.js';
import { parcoursPruefen } from './parcours.js';
import { GLYPHEN, zeileTinte, tintenPolygon } from './tinte.js';
import { ENGLISCH, norm, transformLesen, polygonPolygon } from './grundlagen.js';

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

// Schreibweise je Art, als Paar aus Muster der Lösung und Muster der Zeile, die
// sie ersetzt. Die erste Gruppe der Lösung ist der Wert, die übrigen müssen den
// Gruppen der Zeile gleichen: Dauer, Pfeil, Anfang der Anschlusszeile.
// "247°/15"" für "/15"", "GK 247°/15"", "GK/15"", "ESE/15"" für "HR/15"" und
// "HR 111°/15"", "117" für "+230", "162° → 10"" für "+72 → 10"", "↗ 124,5° 15""
// für "↗ NNE +102° 15"", "über N auf 048°" für "über N auf K"
const G = '(\\d{3}(?:,5)?)';
const P = '([→↗↘])';
const SCHREIBWEISEN = {
  kurs: [new RegExp(`^${G}°(/\\d+")$`), /^(\/\d+")$/],
  gegenkurs: [new RegExp(`^${G}°(/\\d+")$`), /^GK [^/]+(\/\d+")$/],
  gk: [new RegExp(`^${G}°(/\\d+")$`), /^GK(\/\d+")$/],
  hr: [/^([NESW]{1,3})(\/\d+")$/, /^HR(?: \d{3}°)?(\/\d+")$/],
  rechen: [new RegExp(`^${G}$`), /^[+-]\d+$/],
  gate: [new RegExp(`^${G}° ${P} (\\d+")$`), new RegExp(`^.+ ${P} (\\d+")$`)],
  gateC: [new RegExp(`^${P} ${G}° (\\d+")$`), new RegExp(`^${P} .+ (\\d+")$`)],
  anschluss: [/^(über N|über S|kürz\. W\.) auf (\d{3}(?:,5)?)°$/, /^(über N|über S|kürz\. W\.) auf K$/],
};

// Wert einer Lösung in Grad, null bei falscher Schreibweise oder wenn sie nicht
// zur ersetzten Zeile "bezug" passt. Gate-Zeilen der Form C beginnen mit dem Pfeil.
export function loesungWert(art, text, bezug) {
  const schluessel = art === 'gate' && /^[→↗↘]/.test(bezug) ? 'gateC' : art;
  const [muster, bezugMuster] = SCHREIBWEISEN[schluessel] || [];
  const m = muster && text.match(muster);
  const b = bezugMuster && bezug.match(bezugMuster);
  if (!m || !b) return null;
  // Wert und übrige Gruppen trennen: bei Form C und der Anschlusszeile steht der Wert an zweiter Stelle
  const wertIndex = schluessel === 'gateC' || schluessel === 'anschluss' ? 2 : 1;
  const rest = m.slice(1).filter((_, i) => i + 1 !== wertIndex);
  if (rest.join('|') !== b.slice(1).join('|')) return null;
  const wert = m[wertIndex];
  if (art === 'hr') return ENGLISCH.includes(wert) ? ENGLISCH.indexOf(wert) * 22.5 : null;
  return Number(wert.replace(',', '.'));
}

// Die roten Lösungen eines SVG mit Option "loesungen" in ihrer Reihenfolge:
// Schritt, Text, Anker, transform, Zeilenhöhe "dy", gestauchte Länge oder null,
// gezeigt oder nicht, dazu die Schriftgröße aus dem Stil. Mit "umriss" die
// weißen Umrisse darunter.
export function loesungenLesen(svgText, umriss = false) {
  const stil = svgText.match(/\.parcours \.loesung \{[^}]*font: 700 ([\d.]+)px/);
  const schrift = stil ? Number(stil[1]) : null;
  // Rot ist der Text selbst, Dauer, Pfeil und "über N auf" stehen schwarz in
  // tspans mit der Klasse "schwarz"; gelesen wird der ganze Text
  const muster = new RegExp(`<text class="loesung${umriss ? ' umriss' : ''}( start)?( gezeigt)?" data-schritt="(\\d+)" transform="([^"]+)" y="([-\\d.]+)"(?: textLength="([\\d.]+)" lengthAdjust="spacingAndGlyphs")?>((?:[^<]|<tspan class="schwarz">[^<]*</tspan>)+)</text>`, 'g');
  return [...svgText.matchAll(muster)].map((m) => ({
    schritt: Number(m[3]), anker: m[1] ? 'start' : 'mitte', gezeigt: Boolean(m[2]), transform: m[4], t: transformLesen(m[4]),
    dy: Number(m[5]), laenge: m[6] === undefined ? null : Number(m[6]), text: m[7].replace(/<\/?tspan[^>]*>/g, ''), schrift,
  }));
}

// Vorschub einer Lösung in Schrift 9 fett
function fettVorschub(text) {
  return [...text].reduce((summe, zeichen) => summe + (GLYPHEN.fett[zeichen] || GLYPHEN.fett.W)[0], 0);
}

// Tinte einer roten Lösung (fett) im Koordinatensystem ihres Textelements; mit
// textLength gestaucht (bei Anker 'start' zum Anfang hin)
function loesungZeile(l) {
  const z = zeileTinte(l.text, true, l.anker, l.dy);
  if (l.laenge === null) return z;
  const k = l.laenge / fettVorschub(l.text);
  return { ...z, x0: z.x0 * k, x1: z.x1 * k };
}

// Die schwarzen Zeilen mit "data-ersetzt": Schritt, Text, Zeilenhöhe im
// Textelement, verborgen oder nicht, dazu Nummer, Klasse und transform des
// Textelements. Die Nummer zählt die Textelemente wie svgLesen.
export function ersetzteLesen(svgText) {
  const liste = [];
  let nummer = 0;
  for (const m of svgText.matchAll(/<text(?: class="([^"]+)")? transform="([^"]+)">(.*?)<\/text>/g)) {
    let dy = 0;
    for (const z of m[3].matchAll(/<tspan x="0" dy="([-\d.]+)"((?: data-ersetzt="\d+")?(?: class="ersetzt")?)>(.*?)<\/tspan>/g)) {
      dy += Number(z[1]);
      const e = z[2].match(/data-ersetzt="(\d+)"/);
      if (e) liste.push({ schritt: Number(e[1]), text: z[3], dy, verborgen: z[2].includes('class="ersetzt"'), nummer, klasse: m[1] || '', transform: m[2] });
    }
    nummer += 1;
  }
  return liste;
}

// Das SVG mit Lösungen ohne Gruppe, Stilzeilen und Markierungen der Lösungen
export function ohneLoesungen(svgText) {
  return svgText
    .replace(/\n<g class="loesungen">[\s\S]*?<\/g>/, '')
    .replace(/\n\.parcours \.(loesung|ersetzt)[^\n]*/g, '')
    .replace(/ data-ersetzt="\d+"( class="ersetzt")?/g, '');
}

function imViewBox(vb, poly) {
  const [x, y, b, h] = vb;
  return poly.every((p) => p.x >= x && p.x <= x + b && p.y >= y && p.y <= y + h);
}

// Tinte einer Zeile als Polygon, ringsum um "rand" verkleinert
function tinte(t, z, rand = 0) {
  return tintenPolygon(t, { x0: z.x0 + rand, x1: z.x1 - rand, y0: z.y0 + rand, y1: z.y1 - rand });
}

// Ein Blatt (aus erzeugeBlatt): Nachrechnung aus Sätzen und SVG,
// Rechenstellen, gezeichnete Lösungen. "fehler" sammelt jede Abweichung.
// Gezählt werden Lösungen, die breiter sind als ihre Zeile, gestauchte
// Gate-Lösungen, Gate-Lösungen, deren Tinte an oder über den Kastenrand reicht, Lösungen, deren Tinte mehr als 0,3
// in fremde Tinte, einen fremden Kasten oder eine andere Lösung reicht, und
// Lösungen, die tiefer als ihre Zeile in einen Strich, Querstrich oder den
// Nordpfeil reichen.
export function blattAbgleichen(blatt) {
  const { stufe, nummer } = blatt;
  const ohne = zeichneParcours(blatt.parcours);
  const svg = svgLesen(ohne);
  const text = textteilPruefen(blatt.textteil.zeilen.map((z) => z.satz));
  const erg = parcoursPruefen(blatt, svg, { kurs: text.kurs, hoehe: text.hoehe }, stufe);
  const stellen = rechenstellen(blatt);
  const soll = erwarteteLoesungen(erg.flugKurse);
  const ergebnis = { stellen: stellen.length, fehler: [], breiter: 0, gestaucht: 0, kasten: 0, fremd: 0, striche: 0, beispiele: [] };
  const fehler = (meldung) => ergebnis.fehler.push(`Stufe ${stufe}, Blatt ${nummer}: ${meldung}`);

  // Anzahl, Art, Wert und Reihenfolge wie die Nachrechnung
  if (stellen.length !== soll.length) fehler(`${stellen.length} Rechenstellen, nachgerechnet ${soll.length}`);
  stellen.forEach((s, i) => {
    if (!soll[i]) return;
    if (s.art !== soll[i].art) fehler(`Stelle ${i + 1}: Art ${s.art}, nachgerechnet ${soll[i].art}`);
    const wert = loesungWert(s.art, s.text, s.bezug);
    if (wert === null) fehler(`Stelle ${i + 1}: Schreibweise ${s.text} für ${s.bezug}`);
    else if (Math.abs(norm(wert - soll[i].wert + 180) - 180) >= 0.01) fehler(`Stelle ${i + 1} (${s.art} an ${s.bezug}): ${s.text}, nachgerechnet ${soll[i].wert}`);
  });

  // Gegenpart: jede Lösung ersetzt genau eine schwarze Zeile, und jede
  // markierte Zeile gehört zu genau einer Lösung
  const mit = zeichneParcours(blatt.parcours, { loesungen: stellen });
  if (ohneLoesungen(mit) !== ohne) fehler('das SVG mit Lösungen weicht außerhalb der Lösungen vom Blatt ab');
  const rote = loesungenLesen(mit);
  const schwarze = ersetzteLesen(mit);
  if (rote.map((l) => l.text).join('|') !== stellen.map((s) => s.text).join('|')) fehler('gezeichnete Lösungen weichen ab');
  const umrisse = loesungenLesen(mit, true);
  if (JSON.stringify(umrisse) !== JSON.stringify(rote)) fehler('weiße Umrisse stehen nicht genau unter den Lösungen');
  if (rote.some((l, i) => l.schritt !== i + 1)) fehler('Schritte nicht 1, 2, 3, …');
  if (schwarze.length !== rote.length) fehler(`${schwarze.length} markierte Zeilen für ${rote.length} Lösungen`);
  const schrift = (ohne.match(/\.parcours text \{ font: ([\d.]+)px/) || [])[1];
  if (rote.length && String(rote[0].schrift) !== schrift) fehler(`Schrift der Lösungen ${rote[0].schrift}, der Beschriftungen ${schrift}`);

  const texte = svg.texte;
  const rotTinte = rote.map((l) => tinte(l.t, loesungZeile(l)));
  let vorherige = -1;
  rote.forEach((l, i) => {
    const s = stellen[i];
    if (!s) return;
    const stelle = `Stelle ${i + 1} (${s.text} für ${s.bezug})`;
    const gegen = schwarze.filter((z) => z.schritt === l.schritt);
    if (gegen.length !== 1) {
      fehler(`${stelle}: ${gegen.length} schwarze Zeilen dazu`);
      return;
    }
    const [z] = gegen;
    if (z.text !== s.bezug) fehler(`${stelle}: ersetzt ${z.text}`);
    if (z.transform !== l.transform) fehler(`${stelle}: transform ${l.transform} statt ${z.transform}`);
    if (Math.abs(z.dy - l.dy) >= 1e-9) fehler(`${stelle}: Zeilenhöhe ${l.dy} statt ${z.dy}`);
    if ((z.klasse === 'gate') !== (l.anker === 'start')) fehler(`${stelle}: Anker ${l.anker} an ${z.klasse || 'Segment'}`);
    // Gestaucht werden nur Gate-Lösungen, und nie gestreckt
    if (l.laenge !== null && (z.klasse !== 'gate' || l.laenge >= fettVorschub(l.text))) fehler(`${stelle}: textLength ${l.laenge} bei Vorschub ${fettVorschub(l.text).toFixed(2)}`);
    if (z.verborgen || l.gezeigt) fehler(`${stelle}: ohne Übungsstand schon ersetzt`);
    if (z.nummer < vorherige) fehler(`${stelle}: steht vor der Beschriftung der vorigen Stelle`);
    vorherige = z.nummer;

    // Tinte der Lösung gegen ihre Zeile, den eigenen Kasten und alles Fremde
    const t = texte[z.nummer];
    const zeile = t.zeilen.indexOf(z.text);
    const rot = loesungZeile(l);
    const schwarz = t.tinteLokal[zeile];
    if (!imViewBox(svg.vb, rotTinte[i])) fehler(`${stelle}: ragt aus dem Zeichenfeld`);
    const beispiel = (art) => ergebnis.beispiele.push(`Blatt ${nummer}, ${stelle}: ${art}`);
    if (rot.x1 - rot.x0 > schwarz.x1 - schwarz.x0 + 0.01) ergebnis.breiter += 1;
    if (l.laenge !== null) ergebnis.gestaucht += 1;
    if (t.klasse === 'gate') {
      const k = t.kasten;
      const innen = rotTinte[i].every((p) => p.x > k.x + 0.75 && p.x < k.x + k.w - 0.75 && p.y > k.y + 0.75 && p.y < k.y + k.h - 0.75);
      if (!innen) { ergebnis.kasten += 1; beispiel('reicht an den Kastenrand'); }
    }
    const innen = tinte(l.t, rot, 0.3);
    const fremd = texte.some((u) => {
      if (u.klasse === 'gate' && u !== t && polygonPolygon(innen, u.kasten.poly) === 0) return true;
      return u.tinte.some((p, k) => (u !== t || k !== zeile) && polygonPolygon(innen, p) === 0);
    }) || rotTinte.some((p, k) => k !== i && polygonPolygon(innen, p) === 0);
    if (fremd) { ergebnis.fremd += 1; beispiel('berührt Fremdes'); }
    // Striche, Querstriche, Nordpfeil: nur was tiefer reicht als die schwarze Zeile
    const tiefe = (polys, klasse, zeilen) => {
      const je = new Map();
      for (const x of erg.lesbar({ klasse, zeilen }, polys)) if (!x.mit.startsWith('Gate-Kasten')) je.set(x.mit, Math.max(je.get(x.mit) || 0, x.tief));
      return je;
    };
    const vorher = tiefe([t.tinte[zeile]], t.klasse, [z.text]);
    const nachher = tiefe([rotTinte[i]], t.klasse, [l.text]);
    if ([...nachher].some(([mit, d]) => d >= 0.8 && d > (vorher.get(mit) || 0) + 0.3)) { ergebnis.striche += 1; beispiel(`reicht in ${[...nachher].map(([m, d]) => `${m} ${d.toFixed(1)}`).join(', ')}`); }
  });
  return ergebnis;
}

// Mehrere Blätter, zusammengezählt
export function blaetterAbgleichen(blaetter) {
  const summe = { stellen: 0, fehler: [], breiter: 0, gestaucht: 0, kasten: 0, fremd: 0, striche: 0, beispiele: [] };
  for (const blatt of blaetter) {
    const e = blattAbgleichen(blatt);
    for (const feld of ['stellen', 'breiter', 'gestaucht', 'kasten', 'fremd', 'striche']) summe[feld] += e[feld];
    summe.fehler.push(...e.fehler);
    summe.beispiele.push(...e.beispiele);
  }
  return summe;
}
