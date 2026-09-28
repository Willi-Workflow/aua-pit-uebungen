// Übungsmodus der Blattansicht: die Rechenstellen eines Blatts mit Lösung, der
// Reihe nach entlang des Parcours vom Start bis zum Ende, dazu die Logik der
// Tasten. Kein DOM, damit alles ohne Browser geprüft werden kann; gezeichnet
// werden die Lösungen in zeichnung.js (zeichneParcours mit "loesungen"),
// bedient in uebungsmodus.js.
//
// Jede Lösung ersetzt genau eine Zeile einer Beschriftung und steht an deren
// Stelle (gleicher Ursprung, gleiche Drehung, gleicher Anker, gleiche
// Schriftgröße), nur rot und fett. Rechenstellen, nur im Parcours:
// - Segment ohne Kurs nach einer relativen Ecke (+117°) oder einer
//   Gradzahl-Kurve (139): "/15"" wird "247°/15""; die Ecke oder Kurve bleibt
// - Rechenaufgabe unter einem Segment: "+230" wird "117", die Zeile darüber bleibt
// - jede Zeile eines Gates: der Wert wird der Kurs nach der Zeile, Pfeil und
//   Dauer bleiben: "+72 → 10"" wird "162° → 10"", "↗ NNE +102° 15"" wird
//   "↗ 124,5° 15""
// - Stufe 3: Kursangabe als Gegenkurs ("GK 247°/15"" wird "067°/15""), HR/ und
//   HR 111°/ (die Himmelsrichtung wie auf dem Blatt, "ESE/15""), GK/ (der Kurs,
//   "067°/15"") und die Anschlusszeile eines Gates der Form A ("über N auf K"
//   wird "über N auf 048°")
// Himmelsrichtungen und Gradkurse als Angabe ohne GK sind keine Rechenstelle,
// Vollkreise auch nicht. Halbe Grade (nach Himmelsrichtungen) mit Komma, "202,5°".

import { normieren, himmelsrichtungName, SCHREIBWEISE } from './kurs.js';
import { ZEILENABSTAND, gateZeileMitWert } from './geometrie.js';
import { textLage } from './zeichnung.js';
import { kursAnzeige } from './antwort.js';

function grad(kurs) {
  return `${kursAnzeige(kurs)}°`;
}

// Alle Rechenstellen eines Blatts ({ parcours } aus erzeugeBlatt) in der
// Reihenfolge des Parcours. Je Stelle { art, text, bezug, beschriftung, zeile,
// x, y, winkel, anker }: "art" ist 'kurs', 'rechen', 'gate', 'anschluss',
// 'gegenkurs', 'hr' oder 'gk', "text" die Lösung, "bezug" die Zeile, die sie
// ersetzt, "beschriftung" deren Beschriftung als Nummer in
// geometrie.beschriftungen und "zeile" die Nummer der Zeile ab 0. x, y, winkel
// und anker ('middle' oder bei Gates 'start', wie text-anchor) sind der
// Ankerpunkt dieser Zeile in Koordinaten der Zeichnung.
// Die Beschriftungen der Geometrie stehen in der Reihenfolge der Elemente,
// "Start" und "Ende" (Stufe 3) vorn; sie werden hier Element für Element
// zugeordnet wie im wegbauer (geometrie.js).
export function rechenstellen(blatt) {
  const { elemente, geometrie } = blatt.parcours;
  const alle = geometrie.beschriftungen;
  const texte = alle.filter((b) => !b.fett);
  let naechster = 0;
  const holen = (passt, was) => {
    const b = texte[naechster];
    naechster += 1;
    if (!b || !passt(b)) throw new Error(`Beschriftung ${naechster} passt nicht zu ${was}`);
    return b;
  };
  const stellen = [];
  const stelle = (b, zeile, art, text) => {
    const lage = textLage(b);
    const r = (lage.winkel * Math.PI) / 180;
    const dy = zeile * ZEILENABSTAND;
    stellen.push({
      art,
      text,
      bezug: b.zeilen[zeile],
      beschriftung: alle.indexOf(b),
      zeile,
      x: lage.x - dy * Math.sin(r),
      y: lage.y + dy * Math.cos(r),
      winkel: lage.winkel,
      anker: lage.anker,
    });
  };
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
      e.zeilen.forEach((z, j) => stelle(b, j, 'gate', gateZeileMitWert(z, e.form, grad(z.kursDanach))));
      // K ist der Kurs des nächsten gezeichneten Segments
      if (e.anschluss) stelle(b, e.zeilen.length, 'anschluss', b.zeilen[e.zeilen.length].replace(/K$/, grad(elemente[n + 1].kurs)));
      kursDa = false;
      continue;
    }
    if (kursDa && !ohneEcke && e.relativ !== null) {
      holen((b) => !b.gate && b.zeilen[0] === `${e.relativ > 0 ? '+' : ''}${e.relativ}°`, `Ecke ${e.relativ}`);
    }
    const b = holen((b2) => !b2.gate && b2.mitte !== null && b2.kurs === e.kurs, `Segment ${e.kurs}`);
    const dauer = `/${e.dauer}"`;
    if (e.anzeige === 'keine') stelle(b, 0, 'kurs', `${grad(e.kurs)}${dauer}`);
    else if (e.anzeige === 'hr' || e.anzeige === 'hrKurs') stelle(b, 0, 'hr', `${himmelsrichtungName(e.himmelsrichtung, SCHREIBWEISE.zeichnung)}${dauer}`);
    else if (e.anzeige === 'gk') stelle(b, 0, 'gk', `${grad(e.kurs)}${dauer}`);
    else if (e.alsGegenkurs) stelle(b, 0, 'gegenkurs', `${grad(e.kurs)}${dauer}`);
    if (e.rechenaufgabe !== null) stelle(b, 1, 'rechen', kursAnzeige(normieren(e.kurs + e.rechenaufgabe)));
    kursDa = true;
    ohneEcke = false;
  }
  if (naechster !== texte.length) throw new Error(`${texte.length - naechster} Beschriftungen ohne Element`);
  return stellen;
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
