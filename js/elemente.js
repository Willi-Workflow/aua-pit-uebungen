// Bausteine des Parcours: Segmente, Vollkreise und Gates als Kette, noch ohne
// Geometrie. Ein Parcours ist eine Kette aus Segmenten, Vollkreisen und auf
// manchen Blättern Gates. Zwischen zwei Segmenten liegt eine Ecke: kürzester Weg,
// wenn das nächste Segment einen Kurs trägt, sonst eine relative Kursänderung,
// die an der Ecke beschriftet wird. Ein Gate ersetzt eine Ecke durch einen Kasten
// mit drei bis vier Anweisungen, die aus dem Gedächtnis geflogen und nicht
// gezeichnet werden.

import { normieren, differenz, himmelsrichtungGrad, naechsteHimmelsrichtung } from './kurs.js';

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

// Relative Gate-Zeile, deren Kurs danach genau der Gegenkurs ist (Betrag mit Rest
// 180 bei 360, in Stufe 2 also -180 oder +180). Nach "gedreht wird auf kürzestem
// Weg" bliebe die Drehrichtung offen. Die Zeile wird nicht neu gezogen, sonst
// verschöbe sich der Zufallsstrom aller folgenden Kandidaten und damit fast jedes
// Blatt mit Gates; die Kandidatensuche verwirft stattdessen den ganzen Kandidaten
// (siehe erzeugeParcours). So ändern sich nur Blätter, deren Sieger eine solche
// Zeile hatte.
export function gegenkursZeile(zeile) {
  return zeile.kurs.typ === 'relativ' && Math.abs(zeile.kurs.wert) % 360 === 180;
}

export function hatGegenkursZeile(elemente) {
  return elemente.some((e) => e.art === 'gate' && e.zeilen.some(gegenkursZeile));
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
// oder { stufe: 3 }; "pruefer" nur in Stufe 3, siehe elementeStufe3. Stufe 2 zieht genau die Zufallszahlen wie bisher, damit ihre
// Blätter gleich bleiben.
// "start" ist der Flugzustand am Anfang des Parcours ({ kurs, hoehe }), auf den
// Blättern beider Stufen das Ende des Textteils. Ohne "start" beginnt Stufe 3
// ohne Kurs auf 2000 ft (STUFE3_START).
export function erzeugeElemente(zufall, einstellungen, start = null, pruefer = null) {
  if (einstellungen.stufe === 2) return elementeStufe2(zufall, einstellungen.mitGates, start);
  if (einstellungen.stufe === 3) return elementeStufe3(zufall, start, pruefer);
  throw new Error(`Stufe ${einstellungen.stufe} gibt es nicht`);
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

// ---------------------------------------------------------------- Stufe 3
//
// Stufe 3 nach den drei Vorlagen (PDF, Gegenkursbeispiel, Handzeichnung). Auf
// dem Blatt schließt der Parcours wie in Stufe 2 an den Textteil an; ohne
// "start" (Ausschnitte des Blitzrechnens, Prüfungen) beginnt er auf 2000 ft
// ohne Kurs. Zu den Elementen der Stufe 2 kommen Gradzahl-Kurven, Segmente mit
// HR und GK und Gates in drei Formen. Eigener Zufallsstrom (stufe-3/blatt-n),
// deshalb frei im Aufbau.

// Mengen je Blatt, jeweils von bis
export const STUFE3 = {
  segmente: [18, 24],
  vollkreise: [1, 2],
  kurven: [2, 3],
  gates: [3, 4],
  relative: [2, 3],
  hrgk: [1, 3],
  rechenaufgaben: [3, 5],
  himmelsrichtungen: [3, 5],
};
export const STUFE3_START = { kurs: null, hoehe: 2000 };
// Gradzahl-Kurve: Drehwinkel ganzzahlig im Bereich, nicht 180, Standardrate 3°/s
export const KURVE_WINKEL = { min: 40, max: 340 };
export const KURVENRATE = 3;
export const GATE_FORMEN = ['a', 'b', 'c'];
export const ANSCHLUESSE = ['ueberN', 'ueberS', 'kuerzester'];
// Anteil der Gates in Form C, die eine Zeile mit "anl. Kurs" bekommen, solange
// das Blatt noch keine hat; höchstens eine je Blatt
const ANL_ANTEIL = 0.3;

function dauerStufe3(zufall) {
  return zufall.gewichteteAuswahl([
    { wert: 10, gewicht: 3 },
    { wert: 15, gewicht: 3 },
    { wert: 20, gewicht: 3 },
    { wert: 25, gewicht: 1 },
  ]);
}

// Abstand eines Kurses zur nächsten Himmelsrichtung, 0 bis 11,25
export function hrAbstand(kurs) {
  return abstand(kurs, himmelsrichtungGrad(naechsteHimmelsrichtung(kurs)));
}

// Liegt ein Kurs genau zwischen zwei Himmelsrichtungen, ist HR nicht eindeutig
function hrEindeutig(kurs) {
  return hrAbstand(kurs) !== 11.25;
}

// Anschlusszeile nach einem Gate der Form A, vom letzten Gate-Kurs "von" zum Kurs
// "nach" des nächsten Segments. "über N" legt die Drehrichtung fest, die durch
// 000° führt; das ist eindeutig, solange weder Anfang noch Ziel genau auf 000°
// liegen und die Drehung nicht genau 180° ist. Ebenso "über S" mit 180°.
// "kürz. W." braucht 20° bis 160°. Bei "über N/S" darf die Drehung die lange
// Seite sein; mindestens 20° Kurswechsel, damit K nicht fast der alte Kurs ist.
export function anschlussMoeglich(art, von) {
  if (art === 'ueberN') return normieren(von) !== 0;
  if (art === 'ueberS') return normieren(von) !== 180;
  return true;
}

export function anschlussPasst(art, von, nach) {
  const a = abstand(von, nach);
  if (art === 'kuerzester') return imBereich(a);
  if (a < 20 || a === 180) return false;
  if (art === 'ueberN') return normieren(von) !== 0 && normieren(nach) !== 0;
  return normieren(von) !== 180 && normieren(nach) !== 180;
}

// Drehwinkel mit Vorzeichen (rechts positiv), den eine Anschlusszeile vorgibt
export function anschlussDrehung(art, von, nach) {
  const d = differenz(von, nach);
  if (art === 'kuerzester') return d;
  const rechts = normieren(nach - von);
  const links = normieren(von - nach);
  // Rechts herum führt die Drehung durch 000°, wenn das Ziel "unter" dem Anfang liegt
  const grenze = art === 'ueberN' ? 0 : 180;
  const rechtsDurch = normieren(grenze - von) > 0 && normieren(grenze - von) < rechts;
  return rechtsDurch ? rechts : -links;
}

// Segment mit HR oder GK. HR/: nächste Himmelsrichtung zum aktuellen Kurs, nur
// wenn sie mindestens 5° entfernt liegt (dann eine kleine Ecke, höchstens
// 11,25°). HR mit Kurs: ein Gradkurs, der 1° bis 10° neben einer Himmelsrichtung
// liegt, gerundet auf diese; die Ecke dreht 20° bis 160° auf kürzestem Weg.
// GK/: Gegenkurs des aktuellen Kurses, die 180°-Kehre geht in "gkRichtung".
function hrgkSetzen(zufall, segment, kurs) {
  const arten = ['hrKurs', 'gk'];
  if (hrAbstand(kurs) >= 5 && hrEindeutig(kurs)) arten.push('hr');
  const art = zufall.auswahl(arten);
  segment.anzeige = art;
  if (art === 'hr') {
    segment.himmelsrichtung = naechsteHimmelsrichtung(kurs);
    segment.kurs = himmelsrichtungGrad(segment.himmelsrichtung);
  } else if (art === 'hrKurs') {
    let grad;
    let index;
    do {
      grad = zufall.ganzzahl(0, 359);
      index = naechsteHimmelsrichtung(grad);
    } while (hrAbstand(grad) < 1 || hrAbstand(grad) > 10 || !imBereich(abstand(kurs, himmelsrichtungGrad(index))));
    segment.hrGrad = grad;
    segment.himmelsrichtung = index;
    segment.kurs = himmelsrichtungGrad(index);
  } else {
    segment.gkRichtung = zufall.auswahl(['links', 'rechts']);
    segment.kurs = normieren(kurs + 180);
  }
}

// Gradzahl-Kurve: Drehwinkel 40 bis 340, nicht 180, links oder rechts, eigenes
// Profil über Winkel / 3 s
function kurveErzeugen(zufall, verlauf, bilanz, hoehe) {
  let winkel;
  do { winkel = zufall.ganzzahl(KURVE_WINKEL.min, KURVE_WINKEL.max); } while (winkel === 180);
  const richtung = zufall.auswahl(['links', 'rechts']);
  const profil = profilWaehlen(zufall, verlauf, bilanz, hoehe, winkel / KURVENRATE);
  return { art: 'kurve', winkel, richtung, profil };
}

// Ein Kurs mit Vorzeichen, Betrag im Bereich
function mitVorzeichen(zufall, von, bis) {
  return zufall.auswahl([1, -1]) * zufall.ganzzahl(von, bis);
}

// Eine Gate-Zeile der Stufe 3 ab "kursDavor". Jede Zeile ergibt einen neuen Kurs
// 20° bis 160° vom alten, damit der kürzeste Weg eindeutig ist; nur GK ist eine
// Kehre von 180°, deren Richtung frei ist, und Form A folgt der PDF.
// Form A: relativ mit Gradzeichen, Betrag 20 bis 190 wie in der PDF (+182°); das
//   Vorzeichen nennt die Richtung, der Kurs danach ist nie genau der Gegenkurs.
//   Form B: relativ wie Stufe 2, Betrag 20 bis 490.
// Form C: Himmelsrichtung, Himmelsrichtung ± 10 bis 130, GK, GK ± 10 bis 60,
//   anl. Kurs + n oder + a×b (a von 2 bis 9, b von 2 bis 13 wie "9×13" in der
//   Handzeichnung, Ergebnis 20 bis 160).
function gateZeileStufe3(zufall, form, typ, kursDavor, verlauf, bilanz, hoehe) {
  let kurs;
  let kursDanach;
  if (typ === 'relativ') {
    let wert;
    if (form === 'a') {
      do { wert = mitVorzeichen(zufall, 20, 190); } while (abstand(kursDavor, normieren(kursDavor + wert)) === 180);
    } else {
      do { wert = mitVorzeichen(zufall, 20, 490); } while (!imBereich(abstand(kursDavor, normieren(kursDavor + wert))));
    }
    kurs = { typ, wert };
    kursDanach = normieren(kursDavor + wert);
  } else if (typ === 'himmelsrichtung') {
    let index;
    do { index = zufall.ganzzahl(0, 15); } while (!imBereich(abstand(kursDavor, himmelsrichtungGrad(index))));
    kurs = { typ, index };
    kursDanach = himmelsrichtungGrad(index);
  } else if (typ === 'grad') {
    let grad;
    do { grad = zufall.ganzzahl(0, 359); } while (!imBereich(abstand(kursDavor, grad)));
    kurs = { typ, grad };
    kursDanach = grad;
  } else if (typ === 'hrPlus') {
    let index;
    let wert;
    do {
      index = zufall.ganzzahl(0, 15);
      wert = mitVorzeichen(zufall, 10, 130);
    } while (!imBereich(abstand(kursDavor, normieren(himmelsrichtungGrad(index) + wert))));
    kurs = { typ, index, wert };
    kursDanach = normieren(himmelsrichtungGrad(index) + wert);
  } else if (typ === 'gk') {
    kurs = { typ };
    kursDanach = normieren(kursDavor + 180);
  } else if (typ === 'gkPlus') {
    let wert;
    do { wert = mitVorzeichen(zufall, 10, 60); } while (!imBereich(abstand(kursDavor, normieren(kursDavor + 180 + wert))));
    kurs = { typ, wert };
    kursDanach = normieren(kursDavor + 180 + wert);
  } else {
    // anl. Kurs: der gerade geflogene Kurs plus n oder plus a×b
    if (zufall.wuerfel(0.5)) {
      kurs = { typ: 'anl', wert: zufall.ganzzahl(20, 160) };
    } else {
      let a;
      let b;
      do {
        a = zufall.ganzzahl(2, 9);
        b = zufall.ganzzahl(2, 13);
      } while (a * b < 20 || a * b > 160);
      kurs = { typ: 'anlProdukt', a, b, wert: a * b };
    }
    kursDanach = normieren(kursDavor + kurs.wert);
  }
  const dauer = zufall.auswahl([10, 15, 20, 25]);
  const profil = profilWaehlen(zufall, verlauf, bilanz, hoehe, dauer);
  return { kurs, kursDanach, profil, dauer };
}

// Typen der Zeilen eines Gates. A: drei Zeilen, B: vier Zeilen, beide etwa zur
// Hälfte relativ, zu je einem Viertel Himmelsrichtung und Gradkurs, mindestens
// eine relative Zeile. C: drei bis vier Zeilen aus Himmelsrichtung, Himmels-
// richtung ± n, GK und GK ± n, keine zwei reinen GK hintereinander; selten eine
// Zeile "anl. Kurs", höchstens eine je Blatt ("zustand.anl").
function gateTypen(zufall, form, zustand) {
  if (form === 'c') {
    const typen = Array.from({ length: zufall.ganzzahl(3, 4) }, () => zufall.gewichteteAuswahl([
      { wert: 'himmelsrichtung', gewicht: 1 },
      { wert: 'hrPlus', gewicht: 2 },
      { wert: 'gk', gewicht: 1 },
      { wert: 'gkPlus', gewicht: 1 },
    ]));
    for (let j = 1; j < typen.length; j++) if (typen[j] === 'gk' && typen[j - 1] === 'gk') typen[j] = 'gkPlus';
    if (!zustand.anl && zufall.wuerfel(ANL_ANTEIL)) {
      typen[zufall.ganzzahl(0, typen.length - 1)] = 'anl';
      zustand.anl = true;
    }
    return typen;
  }
  const typen = Array.from({ length: form === 'a' ? 3 : 4 }, () => zufall.gewichteteAuswahl([
    { wert: 'relativ', gewicht: 2 },
    { wert: 'himmelsrichtung', gewicht: 1 },
    { wert: 'grad', gewicht: 1 },
  ]));
  if (!typen.includes('relativ')) typen[zufall.ganzzahl(0, typen.length - 1)] = 'relativ';
  return typen;
}

function gateStufe3(zufall, kursDavor, verlauf, bilanz, hoehe, zustand) {
  const form = zufall.auswahl(GATE_FORMEN);
  const zeilen = [];
  let kurs = kursDavor;
  for (const typ of gateTypen(zufall, form, zustand)) {
    const zeile = gateZeileStufe3(zufall, form, typ, kurs, verlauf, bilanz, hoehe);
    zeilen.push(zeile);
    kurs = zeile.kursDanach;
  }
  // Die Anschlusszeile der Form A setzt das nächste Segment, weil sie von
  // seinem Kurs abhängt
  return { art: 'gate', form, zeilen, anschluss: null };
}

// Kurs eines Segments mit eigener Angabe, als Himmelsrichtung oder Gradkurs, der
// "passt" erfüllt
function eigenerKurs(zufall, segment, himmelsrichtung, passt) {
  if (himmelsrichtung) {
    let index;
    do { index = zufall.ganzzahl(0, 15); } while (!passt(himmelsrichtungGrad(index)));
    segment.anzeige = 'himmelsrichtung';
    segment.himmelsrichtung = index;
    segment.kurs = himmelsrichtungGrad(index);
  } else {
    let grad;
    do { grad = zufall.ganzzahl(0, 359); } while (!passt(grad));
    segment.kurs = grad;
  }
}

// Bauplan eines Kandidaten der Stufe 3. Gates, Vollkreise und Gradzahl-Kurven
// folgen auf Segment i mit i von 1 bis Anzahl minus 3, je Stelle höchstens eines:
// nie am ersten oder letzten Segment, immer mindestens ein Segment dazwischen.
// Nach einer Kurve trägt das Segment keine Kursangabe, nach einem Gate immer
// eine; relative Ecken und HR/GK brauchen eine gezeichnete Ecke davor.
function planStufe3(zufall) {
  const m = STUFE3;
  const anzahl = zufall.ganzzahl(...m.segmente);
  const anzahlKreise = zufall.ganzzahl(...m.vollkreise);
  const anzahlKurven = zufall.ganzzahl(...m.kurven);
  const anzahlGates = zufall.ganzzahl(...m.gates);
  const stellen = zufall.mischen(bereich(1, anzahl - 3));
  const kreisNach = new Set(stellen.slice(0, anzahlKreise));
  const kurveNach = new Set(stellen.slice(anzahlKreise, anzahlKreise + anzahlKurven));
  const gateNach = new Set(stellen.slice(anzahlKreise + anzahlKurven, anzahlKreise + anzahlKurven + anzahlGates));
  const mitEcke = bereich(1, anzahl - 1).filter((i) => !kurveNach.has(i - 1) && !gateNach.has(i - 1));
  const relativeIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(...m.relative), mitEcke));
  const hrgkIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(...m.hrgk), mitEcke.filter((i) => !relativeIndizes.has(i))));
  const mitKurs = bereich(0, anzahl - 1).filter((i) => !kurveNach.has(i - 1) && !relativeIndizes.has(i) && !hrgkIndizes.has(i));
  const himmelsIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(...m.himmelsrichtungen), mitKurs));
  const rechenIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(...m.rechenaufgaben), bereich(0, anzahl - 1)));
  return { anzahl, kreisNach, kurveNach, gateNach, relativeIndizes, hrgkIndizes, himmelsIndizes, rechenIndizes };
}

// Drehrichtung eines Vollkreises entgegen der folgenden Ecke, wie in Stufe 2,
// damit die Schleife nicht vom nächsten Segment durchschnitten wird
function kreisRichtung(vorher, nachher) {
  let eckeRechts;
  if (nachher.relativ !== null) eckeRechts = nachher.relativ > 0;
  else if (nachher.anzeige === 'gk') eckeRechts = nachher.gkRichtung === 'rechts';
  else eckeRechts = differenz(vorher.kurs, nachher.kurs) > 0;
  return eckeRechts ? 'links' : 'rechts';
}

// Schritt i: Segment i und was ihm folgt. Ein Vollkreis bekommt seine Richtung
// und ein Gate der Form A seine Anschlusszeile erst mit dem nächsten Segment.
function schrittStufe3(zufall, plan, z, i) {
  const segment = {
    art: 'segment', kurs: null, anzeige: 'grad', himmelsrichtung: null, relativ: null, rechenaufgabe: null, hrGrad: null, gkRichtung: null,
  };
  const { kurs } = z;
  if (plan.kurveNach.has(i - 1)) {
    // Der Kurs ergibt sich aus der Kurve davor
    segment.anzeige = 'keine';
    segment.kurs = kurs;
  } else if (plan.relativeIndizes.has(i)) {
    let winkel;
    do { winkel = zufall.ganzzahl(20, 340); } while (winkel === 180);
    segment.anzeige = 'keine';
    segment.relativ = zufall.auswahl([1, -1]) * winkel;
    segment.kurs = normieren(kurs + segment.relativ);
  } else if (plan.hrgkIndizes.has(i)) {
    hrgkSetzen(zufall, segment, kurs);
  } else {
    let passt = (k) => kurs === null || imBereich(abstand(kurs, k));
    if (plan.gateNach.has(i - 1) && z.gate.form === 'a') {
      const art = zufall.auswahl(ANSCHLUESSE.filter((a) => anschlussMoeglich(a, kurs)));
      z.gate.anschluss = art;
      passt = (k) => anschlussPasst(art, kurs, k);
    }
    eigenerKurs(zufall, segment, plan.himmelsIndizes.has(i), passt);
  }
  if (plan.rechenIndizes.has(i)) segment.rechenaufgabe = mitVorzeichen(zufall, 100, 350);
  segment.dauer = dauerStufe3(zufall);
  segment.profil = profilWaehlen(zufall, z.verlauf, z.bilanz, z.hoehe, segment.dauer);
  const letztes = z.elemente[z.elemente.length - 1];
  if (letztes && letztes.art === 'vollkreis') letztes.richtung = kreisRichtung(z.elemente[z.elemente.length - 2], segment);
  z.elemente.push(segment);
  z.kurs = segment.kurs;

  if (plan.kreisNach.has(i)) {
    const erste = profilWaehlen(zufall, z.verlauf, z.bilanz, z.hoehe, KREISHAELFTE);
    const zweite = profilWaehlen(zufall, z.verlauf, z.bilanz, z.hoehe, KREISHAELFTE);
    z.elemente.push({ art: 'vollkreis', richtung: null, profile: [erste, zweite] });
  }
  if (plan.kurveNach.has(i)) {
    const kurve = kurveErzeugen(zufall, z.verlauf, z.bilanz, z.hoehe);
    z.elemente.push(kurve);
    z.kurs = normieren(z.kurs + (kurve.richtung === 'rechts' ? kurve.winkel : -kurve.winkel));
  }
  if (plan.gateNach.has(i)) {
    z.gate = gateStufe3(zufall, z.kurs, z.verlauf, z.bilanz, z.hoehe, z);
    z.elemente.push(z.gate);
    z.kurs = z.gate.zeilen[z.gate.zeilen.length - 1].kursDanach;
  }
}

// Zustand vor einem Schritt, damit er wiederholt werden kann
function sichern(z) {
  const letztes = z.elemente[z.elemente.length - 1];
  return {
    elemente: z.elemente.length,
    verlauf: z.verlauf.length,
    bilanz: { ...z.bilanz },
    hoehe: z.hoehe.wert,
    anl: z.anl,
    kurs: z.kurs,
    gate: z.gate,
    anschluss: z.gate ? z.gate.anschluss : null,
    offenerKreis: letztes && letztes.art === 'vollkreis' ? letztes : null,
    kreisRichtung: letztes && letztes.art === 'vollkreis' ? letztes.richtung : null,
  };
}

function zuruecksetzen(z, s) {
  z.elemente.length = s.elemente;
  z.verlauf.length = s.verlauf;
  Object.assign(z.bilanz, s.bilanz);
  z.hoehe.wert = s.hoehe;
  z.anl = s.anl;
  z.kurs = s.kurs;
  z.gate = s.gate;
  if (s.gate) s.gate.anschluss = s.anschluss;
  if (s.offenerKreis) s.offenerKreis.richtung = s.kreisRichtung;
}

// Wie viele Elemente sich schon zeichnen lassen: Ein Vollkreis ohne Richtung
// und ein Gate am Ende warten auf das nächste Segment
function zeichenbar(elemente) {
  const letztes = elemente[elemente.length - 1];
  return letztes.art === 'vollkreis' || letztes.art === 'gate' ? elemente.length - 1 : elemente.length;
}

// Versuche je Schritt, bevor der Schritt davor wiederholt wird, und Versuche je
// Kandidat insgesamt, bevor er aufgegeben wird
export const SCHRITT_VERSUCHE = 4;
export const KANDIDAT_VERSUCHE = 60;

// Stufe 3, Schritt für Schritt. Mit "pruefer" (schrittpruefer aus geometrie.js)
// wird jeder Schritt sofort gezeichnet und wiederholt, solange er einen früheren
// Teil des Wegs kreuzt oder ihm zu nahe kommt. Scheitert ein Schritt
// SCHRITT_VERSUCHE Mal, wird der Schritt davor wiederholt; nach
// KANDIDAT_VERSUCHE Schritten insgesamt ist das Ergebnis null. Ohne "pruefer"
// entsteht die Kette wie in Stufe 2 ohne Blick auf den Weg.
function elementeStufe3(zufall, start, pruefer) {
  const plan = planStufe3(zufall);
  const z = {
    elemente: [],
    verlauf: [],
    bilanz: { horizontal: 0, steigen: 0, sinken: 0 },
    hoehe: { wert: (start || STUFE3_START).hoehe },
    anl: false,
    kurs: start ? start.kurs : null,
    gate: null,
  };
  const sicherungen = [];
  const versuche = new Array(plan.anzahl).fill(0);
  let rest = KANDIDAT_VERSUCHE;
  let i = 0;
  while (i < plan.anzahl) {
    if (sicherungen[i]) {
      zuruecksetzen(z, sicherungen[i].z);
      pruefer.zurueck(sicherungen[i].weg);
    } else {
      sicherungen[i] = { z: sichern(z), weg: pruefer ? pruefer.stand() : null };
    }
    schrittStufe3(zufall, plan, z, i);
    if (!pruefer || pruefer.pruefen(z.elemente, zeichenbar(z.elemente))) {
      i += 1;
      continue;
    }
    rest -= 1;
    versuche[i] += 1;
    if (rest <= 0) return null;
    if (versuche[i] >= SCHRITT_VERSUCHE && i > 0) {
      versuche[i] = 0;
      sicherungen.length = i;
      i -= 1;
    }
  }
  return z.elemente;
}
