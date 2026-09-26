// Ein Blatt ist Textteil plus Parcours aus einem Zufallsstrom je Stufe und Nummer.
// Kein DOM, damit ganze Blätter ohne Browser geprüft werden können.

import { Zufall, blattSchluessel } from './zufall.js';
import { erzeugeTextteil } from './textteil.js';
import { erzeugeParcours } from './parcours.js';

export const BLAETTER_JE_STUFE = 100;
export const STUFEN = [2, 3];

// Gates gibt es auf jedem dritten Blatt (3, 6, …, 99), auf den übrigen keine
export function hatGates(stufe, nummer) {
  return nummer % 3 === 0;
}

export function erzeugeBlatt(stufe, nummer) {
  if (stufe !== 2) throw new Error(`Stufe ${stufe} ist noch nicht umgesetzt`);
  if (!Number.isInteger(nummer) || nummer < 1 || nummer > BLAETTER_JE_STUFE) {
    throw new Error(`Blatt ${nummer} gibt es nicht`);
  }
  const zufall = new Zufall(blattSchluessel(stufe, nummer));
  const textteil = erzeugeTextteil(zufall);
  // Der Parcours schließt an Kurs und Höhe nach der letzten Zeile an
  const ende = textteil.zeilen[textteil.zeilen.length - 1];
  const parcours = erzeugeParcours(zufall, hatGates(stufe, nummer), { kurs: ende.kursDanach, hoehe: ende.hoeheDanach });
  return { stufe, nummer, textteil, parcours };
}
