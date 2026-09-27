// Ein Blatt ist Textteil plus Parcours aus einem Zufallsstrom je Stufe und Nummer,
// in Stufe 3 nur der Parcours. Kein DOM, damit ganze Blätter ohne Browser geprüft
// werden können.

import { Zufall, blattSchluessel } from './zufall.js';
import { erzeugeTextteil } from './textteil.js';
import { erzeugeParcours } from './parcours.js';
import { STUFE3_START } from './elemente.js';

export const BLAETTER_JE_STUFE = 100;
export const STUFEN = [2, 3];

// Gates gibt es in Stufe 2 auf jedem dritten Blatt (3, 6, …, 99), auf den
// übrigen keine; in Stufe 3 auf jedem Blatt
export function hatGates(stufe, nummer) {
  return stufe === 3 || nummer % 3 === 0;
}

export function erzeugeBlatt(stufe, nummer) {
  if (!STUFEN.includes(stufe)) throw new Error(`Stufe ${stufe} gibt es nicht`);
  if (!Number.isInteger(nummer) || nummer < 1 || nummer > BLAETTER_JE_STUFE) {
    throw new Error(`Blatt ${nummer} gibt es nicht`);
  }
  const zufall = new Zufall(blattSchluessel(stufe, nummer));
  // Stufe 3: kein Textteil, Start auf 2000 ft mit dem Kurs des ersten Segments
  if (stufe === 3) return { stufe, nummer, textteil: null, parcours: erzeugeParcours(zufall, { stufe: 3 }, STUFE3_START) };
  const textteil = erzeugeTextteil(zufall);
  // Der Parcours schließt an Kurs und Höhe nach der letzten Zeile an
  const ende = textteil.zeilen[textteil.zeilen.length - 1];
  const parcours = erzeugeParcours(zufall, { stufe: 2, mitGates: hatGates(stufe, nummer) }, { kurs: ende.kursDanach, hoehe: ende.hoeheDanach });
  return { stufe, nummer, textteil, parcours };
}
