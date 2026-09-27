// Kandidatensuche: Aus dem Zufallsstrom eines Blatts werden viele Parcours
// gezogen, der beste zulässige gewinnt. Die Bausteine entstehen in elemente.js,
// Weg und Maße in geometrie.js.

import { erzeugeElemente } from './elemente.js';
import {
  bahn, vollenden, fuellungObergrenze, fuellungBerechnen, zaehleKreuzungen, kleinsterAbstand, verdeckteBeschriftungen,
  beschriftungFrei, seitenverhaeltnis, seitenverhaeltnisPasst, startOben, LINIENBREITE_ABSTAND,
} from './geometrie.js';

export const KANDIDATEN = 12000;

// Ausweichlösung, solange kein Kandidat zulässig ist: wenigste Kreuzungen, dann
// größter kleinster Abstand, dann wenigste verdeckte Beschriftungen, dann der
// Start oben, dann das Seitenverhältnis am nächsten an 1. Der Abstand zählt nur bis LINIENBREITE_ABSTAND:
// Darüber liegt nichts mehr übereinander, und mehr Abstand hieße nur einen
// weitläufigeren, langgezogenen Weg. "kreuzungen" ist bis zur Zahl des bisherigen
// Ersatzes genau. Liefert die Kennzahlen des neuen Ersatzes oder null.
function besserErsatz(roh, geoHolen, kreuzungen, ersatz) {
  if (ersatz && kreuzungen > ersatz.kreuzungen) return null;
  const gleicheKreuzungen = ersatz !== null && kreuzungen === ersatz.kreuzungen;
  const abstand = Math.min(LINIENBREITE_ABSTAND, kleinsterAbstand(roh.stuecke, gleicheKreuzungen ? ersatz.abstand : 0, roh.flugzeug));
  if (gleicheKreuzungen && abstand < ersatz.abstand) return null;
  const gleicherAbstand = gleicheKreuzungen && abstand === ersatz.abstand;
  const geo = geoHolen();
  const verdeckt = verdeckteBeschriftungen(geo, gleicherAbstand ? ersatz.verdeckt : Infinity);
  if (gleicherAbstand && verdeckt > ersatz.verdeckt) return null;
  const gleichVerdeckt = gleicherAbstand && verdeckt === ersatz.verdeckt;
  const oben = startOben(geo);
  if (gleichVerdeckt && ersatz.oben && !oben) return null;
  const gleichOben = gleichVerdeckt && oben === ersatz.oben;
  const abweichung = Math.abs(seitenverhaeltnis(geo.umriss) - 1);
  if (gleichOben && abweichung >= ersatz.abweichung) return null;
  return { kreuzungen, abstand, verdeckt, oben, abweichung };
}

// Zieht KANDIDATEN Parcours aus dem Zufallsstrom. Norden zeigt immer nach oben,
// wie in der Vorlage; die Geometrie bleibt ungedreht (Drehung 0). Der Start
// liegt trotzdem oben, weil unter den probierten Kandidaten nur die mit dem
// Start im oberen Teil zulässig sind. Zulässig ist ein Kandidat ohne Kreuzung,
// mit Strichen, die sich höchstens berühren und das Flugzeugsymbol frei lassen,
// im Seitenverhältnis, mit dem Start im oberen Teil (siehe START_OBEN) und mit
// freien Beschriftungen. Unter den zulässigen gewinnt die höchste Füllung, bei
// Gleichstand der frühere. Die Prüfungen laufen billig zuerst und nur so weit,
// wie sie das Ergebnis noch ändern können; es ist dasselbe wie bei voller
// Prüfung aller. "einstellungen" und "start" wie bei erzeugeElemente.
export function erzeugeParcours(zufall, einstellungen, start = null) {
  let bester = null;
  let ersatz = null;
  for (let kandidat = 1; kandidat <= KANDIDATEN; kandidat++) {
    const elemente = erzeugeElemente(zufall, einstellungen, start);
    const roh = bahn(elemente, 0);
    if (bester && fuellungObergrenze(roh.stuecke) <= bester.fuellung) continue;
    const kreuzungen = zaehleKreuzungen(roh.stuecke, bester ? 0 : (ersatz ? ersatz.kreuzungen : Infinity));
    let geo = null;
    if (kreuzungen === 0 && kleinsterAbstand(roh.stuecke, LINIENBREITE_ABSTAND, roh.flugzeug) >= LINIENBREITE_ABSTAND) {
      geo = vollenden(roh);
      const fuellung = fuellungBerechnen(geo);
      if (seitenverhaeltnisPasst(geo.umriss) && startOben(geo) && (!bester || fuellung > bester.fuellung) && beschriftungFrei(geo)) {
        bester = { elemente, geometrie: geo, kreuzungen: 0, kandidat, fuellung };
        continue;
      }
    }
    if (bester) continue;
    const neu = besserErsatz(roh, () => geo || (geo = vollenden(roh)), kreuzungen, ersatz);
    if (neu) ersatz = { elemente, geometrie: geo, kandidat, fuellung: fuellungBerechnen(geo), ...neu };
  }
  const sieger = bester || ersatz;
  return {
    elemente: sieger.elemente,
    geometrie: sieger.geometrie,
    kreuzungen: sieger.kreuzungen,
    kandidat: sieger.kandidat,
    fuellung: sieger.fuellung,
    drehung: sieger.geometrie.drehung,
    zulaessig: bester !== null,
  };
}
