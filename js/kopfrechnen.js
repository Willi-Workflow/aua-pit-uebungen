// Kopfrechnen mit Kursen: Aufgabenarten, gemischt nach Schwierigkeit, jede mit
// Text, Lösung und Tonfolge. Die Tonfolge nennt Schnipsel unter klaenge/ ohne
// Endung; Kurse werden ziffernweise gesprochen, die Zahl einer Rechenaufgabe als
// ganze Zahl. Kein DOM, damit die Aufgaben ohne Browser geprüft werden können.
//
// Gefragt ist fast immer der neue Kurs aus einem Kurs und einer Gradzahl, wie im
// Kurs: "247 + 230", "GK −19° ab 247", "NNE +102°"; bei schwer auch zweistufig
// "GK von SSW −37°" und "anl. Kurs 247 +9×13". Die Wertebereiche stehen in
// schwierigkeit.js.

import { normieren, kursText, himmelsrichtungGrad, naechsteHimmelsrichtung } from './kurs.js';
import { richtungName } from './antwort.js';
import {
  VORGABE_SCHWIERIGKEIT, gueltigeSchwierigkeit, zahlWaehlen, kursWaehlen, ungeraderKurs, rechenRichtungen, richtungPlusWaehlen, anlWaehlen,
} from './schwierigkeit.js';

export const KOPF_ARTEN = ['kursPlusZahl', 'gegenkurs', 'richtungInGrad', 'naechsteRichtung', 'gkPlus', 'richtungPlus', 'gkRichtung', 'anlKurs'];

// Gewicht jeder Art beim Mischen, je Schwierigkeit; fehlt eine Art, kommt sie
// nicht vor. Die Arten ohne Rechnung (Gegenkurs, Himmelsrichtung in Grad,
// nächste Himmelsrichtung) sind bei leicht seltener; die zweistufigen gibt es
// nur bei schwer.
export const ARTEN_GEWICHTE = {
  leicht: { kursPlusZahl: 4, gkPlus: 2, richtungPlus: 2, gegenkurs: 1, richtungInGrad: 1, naechsteRichtung: 1 },
  normal: { kursPlusZahl: 1, gegenkurs: 1, richtungInGrad: 1, naechsteRichtung: 1, gkPlus: 1, richtungPlus: 1 },
  schwer: { kursPlusZahl: 2, gegenkurs: 1, richtungInGrad: 1, naechsteRichtung: 1, gkPlus: 1, richtungPlus: 1, gkRichtung: 1, anlKurs: 1 },
};

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
// gkPlus { kurs, wert } mit Vorzeichen am Wert, richtungPlus { index, wert },
// gkRichtung { index, wert }, anlKurs { kurs, wert } für plus n oder
// { kurs, a, b } für plus a×b
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
  if (art === 'richtungPlus') {
    // Wie die Gate-Zeile "NNE +102°" der Handzeichnung
    const { index, wert } = werte;
    const name = richtungName(index);
    const z = rechenzeichen(wert);
    return {
      art,
      text: `${name} ${z.text}${Math.abs(wert)}°`,
      antwort: 'kurs',
      loesung: normieren(himmelsrichtungGrad(index) + wert),
      tonfolge: ['himmelsrichtung', `hr_${name}`, z.klang, `n${Math.abs(wert)}`],
    };
  }
  if (art === 'gkRichtung') {
    // Zweistufig: erst der Gegenkurs der Himmelsrichtung, dann plus oder minus
    const { index, wert } = werte;
    const name = richtungName(index);
    const z = rechenzeichen(wert);
    return {
      art,
      text: `GK von ${name} ${z.text}${Math.abs(wert)}°`,
      antwort: 'kurs',
      loesung: normieren(himmelsrichtungGrad(index) + 180 + wert),
      tonfolge: ['gegenkurs_von', `hr_${name}`, z.klang, `n${Math.abs(wert)}`],
    };
  }
  if (art === 'anlKurs') {
    // Anliegender, also gerade geflogener Kurs plus n oder plus a×b
    const { kurs } = werte;
    const produkt = werte.a !== undefined;
    const wert = produkt ? werte.a * werte.b : werte.wert;
    return {
      art,
      text: produkt ? `anl. Kurs ${kursText(kurs)} +${werte.a}×${werte.b}` : `anl. Kurs ${kursText(kurs)} +${wert}°`,
      antwort: 'kurs',
      loesung: normieren(kurs + wert),
      tonfolge: ['anliegender_kurs', ...ziffernFolge(kurs), 'op_plus', ...(produkt ? [`n${werte.a}`, 'op_mal', `n${werte.b}`] : [`n${wert}`])],
    };
  }
  throw new Error(`Aufgabenart ${art} gibt es nicht`);
}

// Eine Aufgabe der Art "art" in der Schwierigkeit "schwierigkeit", ohne Art eine
// nach ARTEN_GEWICHTE gemischte. Gerechnet wird ab einem beliebigen Kurs;
// die Zahl kommt aus schwierigkeit.js und trifft dort den
// Anteil mit Überlauf. Bei schwer sind die Kurse bei Gegenkurs und nächster
// Himmelsrichtung ungerade und die Himmelsrichtungen solche mit halbem Grad. Bei
// der nächsten Himmelsrichtung liegt ein ganzzahliger Kurs nie genau zwischen
// zwei Richtungen.
export function erzeugeKopfaufgabe(zufall, art = null, schwierigkeit = VORGABE_SCHWIERIGKEIT) {
  const s = gueltigeSchwierigkeit(schwierigkeit);
  const gewaehlt = art || zufall.gewichteteAuswahl(Object.entries(ARTEN_GEWICHTE[s]).map(([wert, gewicht]) => ({ wert, gewicht })));
  if (gewaehlt === 'kursPlusZahl') {
    const kurs = kursWaehlen(zufall, s);
    return baueKopfaufgabe(gewaehlt, { kurs, zahl: zahlWaehlen(zufall, s, 'zahl', kurs) });
  }
  if (gewaehlt === 'gegenkurs' || gewaehlt === 'naechsteRichtung') {
    return baueKopfaufgabe(gewaehlt, { kurs: s === 'schwer' ? ungeraderKurs(zufall) : zufall.ganzzahl(0, 359) });
  }
  if (gewaehlt === 'richtungInGrad') {
    return baueKopfaufgabe(gewaehlt, { index: s === 'schwer' ? zufall.auswahl(rechenRichtungen(s)) : zufall.ganzzahl(0, 15) });
  }
  if (gewaehlt === 'gkPlus') {
    const kurs = kursWaehlen(zufall, s);
    return baueKopfaufgabe(gewaehlt, { kurs, wert: zahlWaehlen(zufall, s, 'gk', normieren(kurs + 180)) });
  }
  if (gewaehlt === 'richtungPlus') return baueKopfaufgabe(gewaehlt, richtungPlusWaehlen(zufall, s, 'hr'));
  if (gewaehlt === 'gkRichtung') return baueKopfaufgabe(gewaehlt, richtungPlusWaehlen(zufall, s, 'gk', () => true, true));
  if (gewaehlt === 'anlKurs') {
    const kurs = kursWaehlen(zufall, s);
    const anl = anlWaehlen(zufall, s, kurs);
    return baueKopfaufgabe(gewaehlt, anl.typ === 'anlProdukt' ? { kurs, a: anl.a, b: anl.b } : { kurs, wert: anl.wert });
  }
  throw new Error(`Aufgabenart ${gewaehlt} gibt es nicht`);
}
