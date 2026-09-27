// Kopfrechnen mit Kursen: fünf Aufgabenarten, gemischt, jede mit Text, Lösung
// und Tonfolge. Die Tonfolge nennt Schnipsel unter klaenge/ ohne Endung; Kurse
// werden ziffernweise gesprochen, die Zahl einer Rechenaufgabe als ganze Zahl.
// Kein DOM, damit die Aufgaben ohne Browser geprüft werden können.

import { normieren, kursText, himmelsrichtungGrad, naechsteHimmelsrichtung } from './kurs.js';
import { richtungName } from './antwort.js';

export const KOPF_ARTEN = ['kursPlusZahl', 'gegenkurs', 'richtungInGrad', 'naechsteRichtung', 'gkPlus'];

// Zahlen der Rechenaufgaben wie in den Gates der Stufe 2, GK plus oder minus wie in Stufe 3
export const ZAHL = { min: 20, max: 490 };
export const GK_WERT = { min: 10, max: 60 };

// Minuszeichen der Schrift, nicht der Bindestrich
const MINUS = '−';

export function klangPfad(name) {
  return `klaenge/${name}.mp3`;
}

export function ziffernFolge(kurs) {
  return [...kursText(kurs)].map((ziffer) => `n${ziffer}`);
}

function rechenzeichen(wert) {
  return wert < 0 ? { text: MINUS, klang: 'op_minus' } : { text: '+', klang: 'op_plus' };
}

// Aufgabe aus festen Werten: kursPlusZahl { kurs, zahl } mit Vorzeichen an der
// Zahl, gegenkurs { kurs }, richtungInGrad { index }, naechsteRichtung { kurs },
// gkPlus { kurs, wert } mit Vorzeichen am Wert
export function baueKopfaufgabe(art, werte) {
  if (art === 'kursPlusZahl') {
    const { kurs, zahl } = werte;
    const z = rechenzeichen(zahl);
    return {
      art,
      text: `${kursText(kurs)} ${z.text} ${Math.abs(zahl)}`,
      antwort: 'kurs',
      loesung: normieren(kurs + zahl),
      tonfolge: ['name_kurs', ...ziffernFolge(kurs), z.klang, `n${Math.abs(zahl)}`],
    };
  }
  if (art === 'gegenkurs') {
    const { kurs } = werte;
    return { art, text: `Gegenkurs von ${kursText(kurs)}`, antwort: 'kurs', loesung: normieren(kurs + 180), tonfolge: ['gegenkurs_von', ...ziffernFolge(kurs)] };
  }
  if (art === 'richtungInGrad') {
    const { index } = werte;
    const name = richtungName(index);
    return { art, text: `${name} in Grad`, antwort: 'kurs', loesung: himmelsrichtungGrad(index), tonfolge: ['himmelsrichtung', `hr_${name}`, 'grad'] };
  }
  if (art === 'naechsteRichtung') {
    const { kurs } = werte;
    return {
      art,
      text: `Nächste Himmelsrichtung zu ${kursText(kurs)}`,
      antwort: 'richtung',
      loesung: naechsteHimmelsrichtung(kurs),
      tonfolge: ['naechste_himmelsrichtung_zu', ...ziffernFolge(kurs)],
    };
  }
  if (art === 'gkPlus') {
    const { kurs, wert } = werte;
    const z = rechenzeichen(wert);
    return {
      art,
      text: `GK ${z.text}${Math.abs(wert)}° ab ${kursText(kurs)}`,
      antwort: 'kurs',
      loesung: normieren(kurs + 180 + wert),
      tonfolge: ['gegenkurs_von', ...ziffernFolge(kurs), z.klang, `n${Math.abs(wert)}`],
    };
  }
  throw new Error(`Aufgabenart ${art} gibt es nicht`);
}

function mitVorzeichen(zufall, { min, max }) {
  return zufall.auswahl([1, -1]) * zufall.ganzzahl(min, max);
}

// Eine Aufgabe der Art "art", ohne Art eine gleichverteilt gewählte. Ein Kurs
// ist ganzzahlig von 000 bis 359; bei der nächsten Himmelsrichtung ist er nie
// genau zwischen zwei Richtungen, weil das bei ganzen Graden nicht vorkommt.
export function erzeugeKopfaufgabe(zufall, art = null) {
  const gewaehlt = art || zufall.auswahl(KOPF_ARTEN);
  const kurs = zufall.ganzzahl(0, 359);
  if (gewaehlt === 'kursPlusZahl') return baueKopfaufgabe(gewaehlt, { kurs, zahl: mitVorzeichen(zufall, ZAHL) });
  if (gewaehlt === 'gegenkurs') return baueKopfaufgabe(gewaehlt, { kurs });
  if (gewaehlt === 'richtungInGrad') return baueKopfaufgabe(gewaehlt, { index: zufall.ganzzahl(0, 15) });
  if (gewaehlt === 'naechsteRichtung') return baueKopfaufgabe(gewaehlt, { kurs });
  return baueKopfaufgabe(gewaehlt, { kurs, wert: mitVorzeichen(zufall, GK_WERT) });
}
