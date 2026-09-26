// Parcours der Stufe 2: Bausteine, Geometrie und Kandidatensuche.
// Ein Parcours ist eine Kette aus Segmenten und Vollkreisen. Zwischen zwei
// Segmenten liegt eine Ecke: kürzester Weg, wenn das nächste Segment einen Kurs
// trägt, sonst eine relative Kursänderung, die an der Ecke beschriftet wird.

import { normieren, differenz, drehung, kursText, himmelsrichtungGrad, himmelsrichtungName, SCHREIBWEISE } from './kurs.js';

export const SEKUNDE_LAENGE = 3;
export const ECKENRADIUS = 12;
export const KREISRADIUS = 35;
export const KANDIDATEN = 200;
export const SEITENVERHAELTNIS = { min: 0.6, max: 1.2 };

const BESCHRIFTUNGSABSTAND = 11;
const PROFILE = ['horizontal', 'steigen', 'sinken'];

function abstand(von, nach) {
  return Math.abs(differenz(von, nach));
}

function imBereich(a) {
  return a >= 20 && a <= 160;
}

function bereich(von, bis) {
  return Array.from({ length: bis - von + 1 }, (_, i) => von + i);
}

function verschiedeneIndizes(zufall, anzahl, kandidaten) {
  return zufall.mischen(kandidaten).slice(0, anzahl);
}

// Profil, das nicht viermal hintereinander gleich ist, mit Ausgleich der Bilanz
function profilWaehlen(zufall, verlauf, bilanz) {
  const letzte = verlauf.slice(-3);
  const erlaubt = PROFILE.filter((p) => !(letzte.length === 3 && letzte.every((v) => v === p)));
  const profil = zufall.gewichteteAuswahl(erlaubt.map((p) => ({ wert: p, gewicht: Math.max(1, 8 - bilanz[p]) })));
  verlauf.push(profil);
  bilanz[profil] += 1;
  return profil;
}

function dauerWaehlen(zufall) {
  return zufall.gewichteteAuswahl([
    { wert: 10, gewicht: 3 },
    { wert: 15, gewicht: 3 },
    { wert: 20, gewicht: 3 },
    { wert: 30, gewicht: 1 },
  ]);
}

export function erzeugeElemente(zufall) {
  const anzahl = zufall.ganzzahl(18, 22);

  // Vollkreise folgen auf Segment a und b, mit mindestens zwei Segmenten davor,
  // einem dazwischen und einem danach
  const kreisNach = [zufall.ganzzahl(1, anzahl - 4)];
  kreisNach.push(zufall.ganzzahl(kreisNach[0] + 2, anzahl - 2));

  const relativeIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(3, 4), bereich(1, anzahl - 1)));
  const mitKurs = bereich(0, anzahl - 1).filter((i) => !relativeIndizes.has(i));
  const himmelsIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(3, 4), mitKurs));
  const rechenIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(4, 5), mitKurs));

  const verlauf = [];
  const bilanz = { horizontal: 0, steigen: 0, sinken: 0 };
  const elemente = [];
  let kurs = null;

  for (let i = 0; i < anzahl; i++) {
    const segment = { art: 'segment', kurs: null, anzeige: 'grad', himmelsrichtung: null, relativ: null, rechenaufgabe: null };
    if (relativeIndizes.has(i)) {
      let winkel;
      do { winkel = zufall.ganzzahl(20, 340); } while (winkel === 180);
      segment.anzeige = 'keine';
      segment.relativ = zufall.auswahl([1, -1]) * winkel;
      segment.kurs = normieren(kurs + segment.relativ);
    } else if (himmelsIndizes.has(i)) {
      let index;
      do { index = zufall.ganzzahl(0, 15); } while (kurs !== null && !imBereich(abstand(kurs, himmelsrichtungGrad(index))));
      segment.anzeige = 'himmelsrichtung';
      segment.himmelsrichtung = index;
      segment.kurs = himmelsrichtungGrad(index);
    } else {
      let grad;
      do { grad = zufall.ganzzahl(0, 359); } while (kurs !== null && !imBereich(abstand(kurs, grad)));
      segment.kurs = grad;
    }
    if (rechenIndizes.has(i)) segment.rechenaufgabe = zufall.auswahl([1, -1]) * zufall.ganzzahl(100, 350);
    segment.dauer = dauerWaehlen(zufall);
    segment.profil = profilWaehlen(zufall, verlauf, bilanz);
    elemente.push(segment);
    kurs = segment.kurs;

    if (kreisNach.includes(i)) {
      const erste = profilWaehlen(zufall, verlauf, bilanz);
      const zweite = profilWaehlen(zufall, verlauf, bilanz);
      elemente.push({ art: 'vollkreis', richtung: null, profile: [erste, zweite] });
    }
  }

  // Drehrichtung der Vollkreise entgegen der folgenden Ecke, damit die Schleife
  // nicht vom nächsten Segment durchschnitten wird
  for (let i = 0; i < elemente.length; i++) {
    if (elemente[i].art !== 'vollkreis') continue;
    const vorher = elemente[i - 1];
    const nachher = elemente[i + 1];
    const eckeRechts = nachher.relativ !== null ? nachher.relativ > 0 : differenz(vorher.kurs, nachher.kurs) > 0;
    elemente[i].richtung = eckeRechts ? 'links' : 'rechts';
  }

  return elemente;
}
