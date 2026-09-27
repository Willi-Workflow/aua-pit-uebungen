// Bausteine des Parcours: Segmente, Vollkreise und Gates als Kette, noch ohne
// Geometrie. Ein Parcours ist eine Kette aus Segmenten, Vollkreisen und auf
// manchen Blättern Gates. Zwischen zwei Segmenten liegt eine Ecke: kürzester Weg,
// wenn das nächste Segment einen Kurs trägt, sonst eine relative Kursänderung,
// die an der Ecke beschriftet wird. Ein Gate ersetzt eine Ecke durch einen Kasten
// mit drei bis vier Anweisungen, die aus dem Gedächtnis geflogen und nicht
// gezeichnet werden.

import { normieren, differenz, himmelsrichtungGrad } from './kurs.js';

const PROFILE = ['horizontal', 'steigen', 'sinken'];
// Höhenrahmen wie im Textteil, 8 ft je Sekunde Steig- oder Sinkflug
const HOEHE_MIN = 1000;
const HOEHE_MAX = 3000;
const STEIGRATE = 8;
const KREISHAELFTE = 60;

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

// Profil, das nicht viermal hintereinander gleich ist, mit Ausgleich der Bilanz.
// Mit "hoehe" ({ wert } in ft) bleiben Steig- und Sinkflug über "sekunden" im
// Rahmen 1000 bis 3000 ft, und die Höhe wird fortgeschrieben. Horizontal bleibt
// immer möglich, außer nach drei horizontalen; dann bleibt mindestens eines der
// beiden anderen, weil 60 s höchstens 480 ft ausmachen.
function profilWaehlen(zufall, verlauf, bilanz, hoehe = null, sekunden = 0) {
  const letzte = verlauf.slice(-3);
  const erlaubt = PROFILE.filter((p) => {
    if (letzte.length === 3 && letzte.every((v) => v === p)) return false;
    if (hoehe && p === 'steigen') return hoehe.wert + STEIGRATE * sekunden <= HOEHE_MAX;
    if (hoehe && p === 'sinken') return hoehe.wert - STEIGRATE * sekunden >= HOEHE_MIN;
    return true;
  });
  const profil = zufall.gewichteteAuswahl(erlaubt.map((p) => ({ wert: p, gewicht: Math.max(1, 8 - bilanz[p]) })));
  verlauf.push(profil);
  bilanz[profil] += 1;
  if (hoehe && profil === 'steigen') hoehe.wert += STEIGRATE * sekunden;
  if (hoehe && profil === 'sinken') hoehe.wert -= STEIGRATE * sekunden;
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

// Nimmt Stellen in der gegebenen Reihenfolge, solange sie zu allen gewählten
// mindestens 2 Abstand haben, bis "ziel" erreicht ist
function stellenMitAbstand(reihenfolge, ziel) {
  const stellen = [];
  for (const i of reihenfolge) {
    if (stellen.length === ziel) break;
    if (stellen.every((j) => Math.abs(i - j) >= 2)) stellen.push(i);
  }
  return stellen;
}

// Stellen der Gates: Ecken nach Segment i, nicht nach dem ersten und nicht vor
// dem letzten Segment, nicht am Vollkreis und nicht vor einer relativen Ecke, weil
// die Ecke im Gate verschwindet. Zwischen zwei Gates liegen mindestens zwei
// Segmente. Bei 15 Segmenten bleiben von zwölf Stellen mindestens sechs, und
// sechs Stellen erlauben immer drei Gates. Die zufällige Reihenfolge kann darunter
// bleiben (1, 2, 3, 5, 6, 7 mit 2 und 6 zuerst); dann wird von links gewählt,
// das ergibt die größte Auswahl.
export function gateStellenWaehlen(zufall, anzahl, kreisNach, relativeIndizes) {
  const moeglich = bereich(1, anzahl - 3).filter((i) => !kreisNach.includes(i) && !relativeIndizes.has(i + 1));
  const ziel = zufall.ganzzahl(3, 4);
  const stellen = stellenMitAbstand(zufall.mischen(moeglich), ziel);
  return new Set(stellen.length >= 3 ? stellen : stellenMitAbstand(moeglich, ziel));
}

// Eine Gate-Zeile ab "kursDavor". Relativ: Betrag 20 bis 490, der neue Kurs
// mindestens 20° vom alten. Himmelsrichtung und Gradkurs wie bei Segmenten. Die
// Dauer steht vor dem Profil fest, damit die Höhe mit ihr gerechnet werden kann.
function gateZeileErzeugen(zufall, typ, kursDavor, verlauf, bilanz, hoehe) {
  let kurs;
  let kursDanach;
  if (typ === 'relativ') {
    let wert;
    do {
      wert = zufall.auswahl([1, -1]) * zufall.ganzzahl(20, 490);
    } while (abstand(kursDavor, normieren(kursDavor + wert)) < 20);
    kurs = { typ, wert };
    kursDanach = normieren(kursDavor + wert);
  } else if (typ === 'himmelsrichtung') {
    let index;
    do { index = zufall.ganzzahl(0, 15); } while (!imBereich(abstand(kursDavor, himmelsrichtungGrad(index))));
    kurs = { typ, index };
    kursDanach = himmelsrichtungGrad(index);
  } else {
    let grad;
    do { grad = zufall.ganzzahl(0, 359); } while (!imBereich(abstand(kursDavor, grad)));
    kurs = { typ, grad };
    kursDanach = grad;
  }
  const dauer = zufall.auswahl([10, 15, 20]);
  const profil = profilWaehlen(zufall, verlauf, bilanz, hoehe, dauer);
  return { kurs, kursDanach, profil, dauer };
}

// Gate mit drei bis vier Zeilen, je Zeile etwa zur Hälfte relativ, zu je einem
// Viertel Himmelsrichtung und Gradkurs, mindestens eine Zeile relativ
function gateErzeugen(zufall, kursDavor, verlauf, bilanz, hoehe) {
  const typen = Array.from({ length: zufall.ganzzahl(3, 4) }, () => zufall.gewichteteAuswahl([
    { wert: 'relativ', gewicht: 2 },
    { wert: 'himmelsrichtung', gewicht: 1 },
    { wert: 'grad', gewicht: 1 },
  ]));
  if (!typen.includes('relativ')) typen[zufall.ganzzahl(0, typen.length - 1)] = 'relativ';
  const zeilen = [];
  let kurs = kursDavor;
  for (const typ of typen) {
    const zeile = gateZeileErzeugen(zufall, typ, kurs, verlauf, bilanz, hoehe);
    zeilen.push(zeile);
    kurs = zeile.kursDanach;
  }
  return { art: 'gate', zeilen };
}

// Elemente eines Kandidaten je Stufe. "einstellungen" ist { stufe: 2, mitGates }
// oder { stufe: 3 }. Stufe 2 zieht genau die Zufallszahlen wie bisher, damit ihre
// Blätter gleich bleiben.
// "start" ist der Flugzustand am Anfang des Parcours ({ kurs, hoehe }), in Stufe 2
// das Ende des Textteils.
export function erzeugeElemente(zufall, einstellungen, start = null) {
  if (einstellungen.stufe === 2) return elementeStufe2(zufall, einstellungen.mitGates, start);
  throw new Error(`Stufe ${einstellungen.stufe} ist noch nicht umgesetzt`);
}

// Stufe 2. Blätter mit Gates haben 15 bis 19 statt 18 bis 22 Segmente, wie die
// Handzeichnung mit vier Kästen; sonst würde die Zeichnung so groß, dass die
// Schrift im Druck oft unter 6 pt fiele.
// Mit "start" liegt das erste Segment 20° bis 160° vom Kurs am Ende des
// Textteils, und die Profile halten die Höhe im Rahmen 1000 bis 3000 ft. Ohne
// "start" gilt beides nicht.
function elementeStufe2(zufall, mitGates, start) {
  const anzahl = mitGates ? zufall.ganzzahl(15, 19) : zufall.ganzzahl(18, 22);

  // Vollkreise folgen auf Segment a und b, mit mindestens zwei Segmenten davor,
  // einem dazwischen und einem danach
  const kreisNach = [zufall.ganzzahl(1, anzahl - 4)];
  kreisNach.push(zufall.ganzzahl(kreisNach[0] + 2, anzahl - 2));

  const relativeIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(3, 4), bereich(1, anzahl - 1)));
  const mitKurs = bereich(0, anzahl - 1).filter((i) => !relativeIndizes.has(i));
  const himmelsIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(3, 4), mitKurs));
  // Rechenaufgaben auch an Segmenten ohne Kurs, wie in der Vorlage (/30" mit +115)
  const rechenIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(4, 5), bereich(0, anzahl - 1)));
  const gateNach = mitGates ? gateStellenWaehlen(zufall, anzahl, kreisNach, relativeIndizes) : new Set();

  const verlauf = [];
  const bilanz = { horizontal: 0, steigen: 0, sinken: 0 };
  const hoehe = start ? { wert: start.hoehe } : null;
  const elemente = [];
  let kurs = start ? start.kurs : null;

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
    segment.profil = profilWaehlen(zufall, verlauf, bilanz, hoehe, segment.dauer);
    elemente.push(segment);
    kurs = segment.kurs;

    if (kreisNach.includes(i)) {
      const erste = profilWaehlen(zufall, verlauf, bilanz, hoehe, KREISHAELFTE);
      const zweite = profilWaehlen(zufall, verlauf, bilanz, hoehe, KREISHAELFTE);
      elemente.push({ art: 'vollkreis', richtung: null, profile: [erste, zweite] });
    }

    // Nach dem Gate gilt der Kurs der letzten Zeile; das nächste Segment trägt
    // immer einen Kurs und wird gegen diesen gewählt
    if (gateNach.has(i)) {
      const gate = gateErzeugen(zufall, kurs, verlauf, bilanz, hoehe);
      elemente.push(gate);
      kurs = gate.zeilen[gate.zeilen.length - 1].kursDanach;
    }
  }

  // Drehrichtung der Vollkreise entgegen der folgenden Ecke, damit die Schleife
  // nicht vom nächsten Segment durchschnitten wird. Die vorherige Ecke wird nicht
  // berücksichtigt: Die andere Seite läge immer auf der Seite der folgenden Ecke,
  // und dann gewinnt die folgende Ecke. Engstellen dort fängt der Abstandsfilter.
  for (let i = 0; i < elemente.length; i++) {
    if (elemente[i].art !== 'vollkreis') continue;
    const vorher = elemente[i - 1];
    const nachher = elemente[i + 1];
    const eckeRechts = nachher.relativ !== null ? nachher.relativ > 0 : differenz(vorher.kurs, nachher.kurs) > 0;
    elemente[i].richtung = eckeRechts ? 'links' : 'rechts';
  }

  return elemente;
}
