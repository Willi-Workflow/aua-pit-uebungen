// Ein Blatt ist Textteil plus Parcours aus einem Zufallsstrom je Stufe und Nummer,
// in beiden Stufen. Kein DOM, damit ganze Blätter ohne Browser geprüft werden
// können.

import { Zufall, blattSchluessel } from './zufall.js';
import { erzeugeTextteil } from './textteil.js';
import { erzeugeParcours } from './parcours.js';

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
  const textteil = erzeugeTextteil(zufall);
  // Der Parcours schließt an Kurs und Höhe nach der letzten Zeile an: erstes
  // Segment 20° bis 160° vom Endkurs, Höhe ab der Endhöhe des Textteils
  const ende = textteil.zeilen[textteil.zeilen.length - 1];
  const start = { kurs: ende.kursDanach, hoehe: ende.hoeheDanach };
  const einstellungen = stufe === 3 ? { stufe: 3 } : { stufe: 2, mitGates: hatGates(stufe, nummer) };
  const parcours = erzeugeParcours(zufall, einstellungen, start);
  return { stufe, nummer, textteil, parcours };
}
