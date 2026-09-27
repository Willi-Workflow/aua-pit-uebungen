// Antworten im Blitzrechnen lesen, prüfen und als Lösung schreiben. Eine Frage
// ist { antwort, loesung }: "kurs" mit einer Gradzahl als Lösung (halbe Grade
// bei Himmelsrichtungen), "richtung" mit dem Index einer der 16 Himmelsrichtungen,
// "drehsinn" mit "links" oder "rechts". Kopfaufgaben und Fragen zu Ausschnitten
// haben dieselbe Form.

import { normieren, kursText, himmelsrichtungName, himmelsrichtungGrad, SCHREIBWEISE } from './kurs.js';

// Ziffern, wahlweise mit Komma oder Punkt und Nachkommastellen; sonst null
export function eingabeLesen(text) {
  if (text === null || text === undefined) return null;
  const roh = String(text).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(roh)) return null;
  return Number(roh);
}

// Richtig ist der Kurs modulo 360 (000 und 360 sind Norden). Liegt die Lösung
// auf einem halben Grad (Himmelsrichtung wie 202,5), zählen auch die beiden
// ganzen Nachbarn 202 und 203.
export function kursRichtig(eingabe, loesung) {
  const wert = eingabeLesen(eingabe);
  if (wert === null) return false;
  const ist = normieren(wert);
  const soll = normieren(loesung);
  if (ist === soll) return true;
  if (Number.isInteger(soll)) return false;
  return ist === normieren(Math.floor(soll)) || ist === normieren(Math.ceil(soll));
}

// Dreistellig, halbe Grade mit Komma: 067, 202,5
export function kursAnzeige(grad) {
  const g = normieren(grad);
  if (Number.isInteger(g)) return kursText(g);
  return `${String(Math.floor(g)).padStart(3, '0')},${String(g).split('.')[1]}`;
}

export function richtungName(index) {
  return himmelsrichtungName(index, SCHREIBWEISE.zeichnung);
}

export function frageRichtig(frage, eingabe) {
  if (eingabe === null || eingabe === undefined) return false;
  if (frage.antwort === 'kurs') return kursRichtig(eingabe, frage.loesung);
  if (frage.antwort === 'richtung') return Number(eingabe) === frage.loesung;
  return eingabe === frage.loesung;
}

export function loesungText(frage) {
  if (frage.antwort === 'kurs') return kursAnzeige(frage.loesung);
  if (frage.antwort === 'richtung') return `${richtungName(frage.loesung)} (${kursAnzeige(himmelsrichtungGrad(frage.loesung))})`;
  return frage.loesung;
}

// Was eingegeben wurde, zum Vergleich neben der Lösung
export function eingabeText(frage, eingabe) {
  if (eingabe === null || eingabe === undefined || eingabe === '') return 'keine';
  if (frage.antwort === 'richtung') return richtungName(Number(eingabe));
  if (frage.antwort === 'kurs') {
    const wert = eingabeLesen(eingabe);
    return wert === null ? String(eingabe) : String(eingabe).replace('.', ',');
  }
  return String(eingabe);
}
