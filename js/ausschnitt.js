// Ausschnitte für Blitzrechnen Stufe 2 und 3: eine kleine Situation wie auf dem
// Blatt, ein Startsegment mit Kurs, genau ein Aufgabenelement und ein
// Folgesegment. Die Elemente kommen aus der vorhandenen Erzeugung der Blätter
// (erzeugeElemente, ohne Kandidatensuche): Aus einer ganzen Kette wird ein
// passendes Stück geschnitten. So gelten für Ausschnitte dieselben Regeln wie
// auf dem Blatt, und jede Änderung an der Erzeugung gilt auch hier.
// Gezeichnet mit Norden oben, ohne Nordpfeil. Zulässig ist ein Ausschnitt ohne
// Kreuzung, mit Strichen, die sich höchstens berühren, und freien
// Beschriftungen; sonst wird neu gewürfelt.

import { erzeugeElemente, anschlussDrehung, gegenkursZeile } from './elemente.js';
import { bahn, vollenden, zaehleKreuzungen, kleinsterAbstand, beschriftungFrei, LINIENBREITE_ABSTAND } from './geometrie.js';
import { zeichneParcours } from './zeichnung.js';
import { normieren } from './kurs.js';

// Aufgabenelemente je Stufe. "gate" ist in Stufe 2 ein Gate mit drei Zeilen,
// in Stufe 3 eines der Formen A, B oder C; "anl" ist ein Gate der Form C mit
// einer Zeile "anl. Kurs". "kurve" ist die Gradzahl-Kurve mit dem Segment ohne
// Kurs danach, in beiden Stufen wie auf den Blättern. "gkAngabe" (Stufe 3) ist
// ein Segment, dessen Angabe den Gegenkurs nennt ("GK 247°/15""); gefragt ist
// der tatsächliche Kurs. Solche Segmente können auch als Folgesegment oder mit
// einer Rechenaufgabe vorkommen.
export const AUSSCHNITT_ARTEN = {
  2: ['relativ', 'rechen', 'himmelsrichtung', 'kurve', 'gate'],
  3: ['relativ', 'rechen', 'himmelsrichtung', 'gkAngabe', 'hr', 'hrKurs', 'gk', 'kurve', 'gate', 'anl'],
};

// Ketten, die höchstens gezogen werden, bevor die Erzeugung aufgibt; gebraucht
// werden fast immer eine, für "anl" im Mittel drei
const VERSUCHE = 400;

const istSegment = (e) => Boolean(e) && e.art === 'segment';
const istAnl = (zeile) => zeile.kurs.typ === 'anl' || zeile.kurs.typ === 'anlProdukt';

// Passt das Element an Stelle i als Aufgabe der Art? Dann das Stück der Kette
// als [erster, letzter] Index: ein Segment davor mit ganzzahligem Kurs, das
// Aufgabenelement (bei einer Kurve samt dem Segment ohne Kurs danach) und ein
// Folgesegment mit eigenem Gradkurs, alles direkt hintereinander.
function stueckFuer(elemente, i, art, stufe) {
  const element = elemente[i];
  const davor = elemente[i - 1];
  if (!istSegment(davor) || !Number.isInteger(davor.kurs)) return null;
  let letzter;
  if (art === 'kurve') {
    if (element.art !== 'kurve' || !istSegment(elemente[i + 1])) return null;
    letzter = i + 2;
  } else if (art === 'gate' || art === 'anl') {
    if (element.art !== 'gate') return null;
    if (art === 'anl' && !element.zeilen.some(istAnl)) return null;
    if (stufe === 2 && element.zeilen.length !== 3) return null;
    // Wie auf dem Blatt keine relative Zeile, die genau auf dem Gegenkurs endet
    if (element.zeilen.some(gegenkursZeile)) return null;
    letzter = i + 1;
  } else {
    if (!istSegment(element)) return null;
    if (art === 'relativ' && element.relativ === null) return null;
    if (art === 'rechen' && (element.rechenaufgabe === null || !['grad', 'himmelsrichtung'].includes(element.anzeige))) return null;
    if (['himmelsrichtung', 'hr', 'hrKurs', 'gk'].includes(art) && element.anzeige !== art) return null;
    // Himmelsrichtung in Grad nur ohne Gegenkurs-Angabe, dafür gibt es "gkAngabe"
    if (art === 'himmelsrichtung' && element.alsGegenkurs) return null;
    if (art === 'gkAngabe' && !element.alsGegenkurs) return null;
    letzter = i + 1;
  }
  const folge = elemente[letzter];
  if (!istSegment(folge) || folge.anzeige !== 'grad') return null;
  return [i - 1, letzter];
}

// Kopie des Stücks. Das Startsegment zeigt seinen Kurs als Gradzahl, eine
// Rechenaufgabe bleibt nur am Aufgabenelement, damit es genau eine Aufgabe gibt.
function ketteBauen(elemente, [erster, letzter], art) {
  const kette = elemente.slice(erster, letzter + 1).map((e) => (e.art === 'segment' ? { ...e } : e));
  Object.assign(kette[0], { anzeige: 'grad', himmelsrichtung: null, relativ: null, rechenaufgabe: null, hrGrad: null, gkRichtung: null });
  // Das Startsegment nennt seinen Kurs wie die Ankunft, nie als Gegenkurs
  if ('alsGegenkurs' in kette[0]) kette[0].alsGegenkurs = false;
  kette.forEach((e, j) => {
    if (j > 0 && e.art === 'segment' && !(art === 'rechen' && j === 1)) e.rechenaufgabe = null;
  });
  return kette;
}

function geometriePruefen(kette) {
  const roh = bahn(kette, 0, false);
  if (zaehleKreuzungen(roh.stuecke, 0) > 0) return null;
  if (kleinsterAbstand(roh.stuecke, LINIENBREITE_ABSTAND, roh.flugzeug) < LINIENBREITE_ABSTAND) return null;
  const geo = vollenden(roh);
  return beschriftungFrei(geo) ? geo : null;
}

// Fragen in der Reihenfolge, in der sie beantwortet werden. Ein Gate fragt je
// Zeile den Kurs danach, bei Form A zuletzt den Drehsinn der Anschlusszeile.
function fragenFuer(kette, art) {
  if (art === 'gate' || art === 'anl') {
    const [, gate, folge] = kette;
    const fragen = gate.zeilen.map((z, j) => ({ text: `Gate, Zeile ${j + 1}: Kurs danach`, antwort: 'kurs', loesung: z.kursDanach }));
    if (gate.anschluss) {
      const letzter = gate.zeilen[gate.zeilen.length - 1].kursDanach;
      const drehung = anschlussDrehung(gate.anschluss, letzter, folge.kurs);
      fragen.push({ text: 'Drehsinn zum nächsten Kurs?', antwort: 'drehsinn', loesung: drehung > 0 ? 'rechts' : 'links' });
    }
    return fragen;
  }
  const segment = art === 'kurve' ? kette[2] : kette[1];
  if (art === 'relativ') return [{ text: 'Kurs nach der Ecke', antwort: 'kurs', loesung: segment.kurs }];
  if (art === 'rechen') return [{ text: 'Ergebnis der Rechenaufgabe', antwort: 'kurs', loesung: normieren(segment.kurs + segment.rechenaufgabe) }];
  if (art === 'himmelsrichtung') return [{ text: 'Himmelsrichtung in Grad', antwort: 'kurs', loesung: segment.kurs }];
  if (art === 'gkAngabe') return [{ text: 'Kurs nach der GK-Angabe', antwort: 'kurs', loesung: segment.kurs }];
  if (art === 'hr' || art === 'hrKurs') return [{ text: 'HR: welche Himmelsrichtung?', antwort: 'richtung', loesung: segment.himmelsrichtung }];
  if (art === 'gk') return [{ text: 'Kurs nach GK', antwort: 'kurs', loesung: segment.kurs }];
  return [{ text: 'Kurs nach der Kurve', antwort: 'kurs', loesung: segment.kurs }];
}

// Ein Ausschnitt der Stufe 2 oder 3, ohne "art" eine gleichverteilt gewählte
// Aufgabenart. Liefert { stufe, art, ankunft, elemente, geometrie, fragen }.
export function erzeugeAusschnitt(zufall, stufe, art = null) {
  const arten = AUSSCHNITT_ARTEN[stufe];
  if (!arten) throw new Error(`Stufe ${stufe} gibt es nicht`);
  const gewaehlt = art || zufall.auswahl(arten);
  if (!arten.includes(gewaehlt)) throw new Error(`Aufgabenart ${gewaehlt} gibt es in Stufe ${stufe} nicht`);
  const einstellungen = stufe === 2 ? { stufe: 2, mitGates: gewaehlt === 'gate' } : { stufe: 3 };
  for (let versuch = 0; versuch < VERSUCHE; versuch++) {
    const elemente = erzeugeElemente(zufall, einstellungen);
    const stellen = zufall.mischen(elemente.map((_, i) => i).slice(1));
    for (const i of stellen) {
      const stueck = stueckFuer(elemente, i, gewaehlt, stufe);
      if (!stueck) continue;
      const kette = ketteBauen(elemente, stueck, gewaehlt);
      const geometrie = geometriePruefen(kette);
      if (!geometrie) continue;
      return { stufe, art: gewaehlt, ankunft: kette[0].kurs, elemente: kette, geometrie, fragen: fragenFuer(kette, gewaehlt) };
    }
  }
  throw new Error(`Kein Ausschnitt der Art ${gewaehlt} gefunden`);
}

export function zeichneAusschnitt(ausschnitt) {
  return zeichneParcours({ geometrie: ausschnitt.geometrie }, { nordpfeil: false });
}
