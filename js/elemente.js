// Bausteine des Parcours: Segmente, Vollkreise, Gradzahl-Kurven und Gates als
// Kette, noch ohne Geometrie. Zwischen zwei Segmenten liegt eine Ecke: kürzester
// Weg, wenn das nächste Segment einen Kurs trägt, sonst eine relative
// Kursänderung, die an der Ecke beschriftet wird. Eine Gradzahl-Kurve dreht um
// ihren nackten Winkel in gezeichneter Richtung. Ein Gate ersetzt eine Ecke durch
// einen Kasten mit drei bis vier Anweisungen, die aus dem Gedächtnis geflogen und
// nicht gezeichnet werden.

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
// oder { stufe: 3 }. Beide Stufen entstehen Schritt für Schritt nach einem
// Bauplan (siehe elementeSchrittweise), "pruefer" prüft jeden Schritt am Weg.
// "start" ist der Flugzustand am Anfang des Parcours ({ kurs, hoehe }), auf den
// Blättern beider Stufen das Ende des Textteils. Ohne "start" beginnt der
// Parcours ohne Kurs auf 2000 ft (STUFE3_START).
export function erzeugeElemente(zufall, einstellungen, start = null, pruefer = null) {
  if (einstellungen.stufe === 2) return elementeSchrittweise(zufall, planStufe2(zufall, einstellungen.mitGates), start, pruefer);
  if (einstellungen.stufe === 3) return elementeSchrittweise(zufall, planStufe3(zufall), start, pruefer);
  throw new Error(`Stufe ${einstellungen.stufe} gibt es nicht`);
}

// ---------------------------------------------------------------- Stufe 2
//
// Stufe 2 nach der PDF und den beiden Handzeichnungen: Dort ist fast jeder
// Kurs auszurechnen, an den Bögen stehen nackte Drehwinkel (90, 120, 273, 305),
// die Segmente danach tragen nur die Zeit. Je Blatt 8 bis 11 Kursberechnungen,
// 3 bis 4 relative Ecken wie "+117°" und 5 bis 7 Gradzahl-Kurven, etwa ein
// Drittel davon Schleifen über 180°, dazu 5 bis 7 Rechenaufgaben bis ±490.
// Blätter mit Gates haben weniger Segmente und Kurven, sonst würde die
// Zeichnung so groß, dass die Schrift im Druck zu klein würde.

// Mengen je Blatt, jeweils von bis
export const STUFE2 = {
  segmente: [18, 22],
  segmenteMitGates: [15, 19],
  vollkreise: [2, 2],
  kurven: [5, 7],
  kurvenMitGates: [4, 6],
  gates: [3, 4],
  relative: [3, 4],
  rechenaufgaben: [5, 7],
  himmelsrichtungen: [3, 4],
};
// Relative Ecken und Kurven zusammen mindestens so viele
export const KURSBERECHNUNGEN_MIN = 8;
// Gradzahl-Kurve der Stufe 2: Drehwinkel 30 bis 350, nie 180; mit diesem Anteil
// eine Schleife über 180°. Schleifen scheitern öfter am Weg, auf den fertigen
// Blättern bleibt so rund ein Drittel (181 von 556).
export const KURVE_WINKEL_STUFE_2 = { min: 30, max: 350 };
const SCHLEIFEN_ANTEIL_STUFE_2 = 0.37;
// Betrag der Rechenaufgaben, Stufe 2 bis 490 wie die Gates der Handzeichnung (+410)
export const RECHEN_BIS = { 2: 490, 3: 350 };

function kurvenWinkelStufe2(zufall) {
  return zufall.wuerfel(SCHLEIFEN_ANTEIL_STUFE_2) ? zufall.ganzzahl(181, KURVE_WINKEL_STUFE_2.max) : zufall.ganzzahl(KURVE_WINKEL_STUFE_2.min, 179);
}

// Bauplan eines Kandidaten der Stufe 2. Gates, Vollkreise und Kurven folgen auf
// Segment i mit i von 1 bis Anzahl minus 3, je Stelle höchstens eines. Zwischen
// zwei Gates liegen mindestens zwei Segmente (bei 15 Segmenten erlauben die zwölf
// Stellen immer drei; geht die zufällige Reihenfolge nicht auf, wird von links
// gewählt). Nach einer Kurve trägt das Segment nur die Zeit, nach einem Gate
// einen Kurs; relative Ecken brauchen eine gezeichnete Ecke davor.
function planStufe2(zufall, mitGates) {
  const m = STUFE2;
  const anzahl = zufall.ganzzahl(...(mitGates ? m.segmenteMitGates : m.segmente));
  const anzahlKurven = zufall.ganzzahl(...(mitGates ? m.kurvenMitGates : m.kurven));
  const stellen = zufall.mischen(bereich(1, anzahl - 3));
  let gateNach = new Set();
  if (mitGates) {
    const ziel = zufall.ganzzahl(...m.gates);
    const gewaehlt = stellenMitAbstand(stellen, ziel);
    gateNach = new Set(gewaehlt.length >= m.gates[0] ? gewaehlt : stellenMitAbstand(bereich(1, anzahl - 3), ziel));
  }
  const frei = stellen.filter((i) => !gateNach.has(i));
  const kreisNach = new Set(frei.slice(0, m.vollkreise[0]));
  const kurveNach = new Set(frei.slice(m.vollkreise[0], m.vollkreise[0] + anzahlKurven));
  const mitEcke = bereich(1, anzahl - 1).filter((i) => !kurveNach.has(i - 1) && !gateNach.has(i - 1));
  // Mindestens 8 Kursberechnungen: Mit nur 4 Kurven (Blätter mit Gates) gibt es
  // 4 relative Ecken. "mitEcke" hat immer mindestens 4 Stellen: nach Segment 0,
  // nach den beiden Vollkreisen und vor dem letzten Segment.
  const anzahlRelative = Math.max(zufall.ganzzahl(...m.relative), KURSBERECHNUNGEN_MIN - anzahlKurven);
  const relativeIndizes = new Set(verschiedeneIndizes(zufall, anzahlRelative, mitEcke));
  const mitKurs = bereich(0, anzahl - 1).filter((i) => !kurveNach.has(i - 1) && !relativeIndizes.has(i));
  const himmelsIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(...m.himmelsrichtungen), mitKurs));
  const rechenIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(...m.rechenaufgaben), bereich(0, anzahl - 1)));
  return {
    stufe: 2, anzahl, kreisNach, kurveNach, gateNach, gates: null, relativeIndizes, hrIndizes: new Set(), gkIndizes: new Set(), himmelsIndizes, rechenIndizes,
  };
}

// ---------------------------------------------------------------- Stufe 3
//
// Stufe 3 nach den drei Vorlagen (PDF, Gegenkursbeispiel, Handzeichnung). Auf
// dem Blatt schließt der Parcours wie in Stufe 2 an den Textteil an; ohne
// "start" (Ausschnitte des Blitzrechnens, Prüfungen) beginnt er auf 2000 ft
// ohne Kurs. Zu den Elementen der Stufe 2 kommen Gradzahl-Kurven, Segmente mit
// HR und GK und Gates in drei Formen. Eigener Zufallsstrom (stufe-3/blatt-n),
// deshalb frei im Aufbau.

// Mengen je Blatt, jeweils von bis. Gegenkurs kommt je Blatt drei- bis fünfmal
// vor wie in der Handzeichnung: als Segment "GK/…" (gkSegmente) und als
// Gate-Zeile "GK" oder "GK ± n" (gkZeilen). Segmente mit HR zählen getrennt.
export const STUFE3 = {
  segmente: [18, 24],
  vollkreise: [1, 2],
  kurven: [2, 3],
  gates: [3, 4],
  relative: [2, 3],
  hr: [1, 2],
  gkSegmente: [1, 2],
  gkZeilen: [2, 3],
  rechenaufgaben: [3, 5],
  himmelsrichtungen: [3, 5],
};
export const STUFE3_START = { kurs: null, hoehe: 2000 };
// Gradzahl-Kurve: Drehwinkel ganzzahlig im Bereich, nicht 180, Standardrate 3°/s
export const KURVE_WINKEL = { min: 40, max: 340 };
export const KURVENRATE = 3;
export const GATE_FORMEN = ['a', 'b', 'c'];
// Gewichte der Formen beim Ziehen. Form B trägt nie eine GK-Zeile, Form A
// höchstens eine; Formen ohne Platz für die GK-Zeilen des Blatts werden
// verworfen (siehe gatesPlanen). Das träfe B am häufigsten und C nie, mit
// diesen Gewichten kommt trotzdem jede Form auf rund ein Drittel.
const FORM_GEWICHTE = { a: 10, b: 16, c: 9 };
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

// Segment mit HR. HR/: nächste Himmelsrichtung zum aktuellen Kurs, nur wenn sie
// mindestens 5° entfernt liegt (dann eine kleine Ecke, höchstens 11,25°). HR mit
// Kurs: ein Gradkurs, der 1° bis 10° neben einer Himmelsrichtung liegt,
// gerundet auf diese; die Ecke dreht 20° bis 160° auf kürzestem Weg.
function hrSetzen(zufall, segment, kurs) {
  const arten = ['hrKurs'];
  if (hrAbstand(kurs) >= 5 && hrEindeutig(kurs)) arten.push('hr');
  const art = zufall.auswahl(arten);
  segment.anzeige = art;
  if (art === 'hr') {
    segment.himmelsrichtung = naechsteHimmelsrichtung(kurs);
    segment.kurs = himmelsrichtungGrad(segment.himmelsrichtung);
  } else {
    let grad;
    let index;
    do {
      grad = zufall.ganzzahl(0, 359);
      index = naechsteHimmelsrichtung(grad);
    } while (hrAbstand(grad) < 1 || hrAbstand(grad) > 10 || !imBereich(abstand(kurs, himmelsrichtungGrad(index))));
    segment.hrGrad = grad;
    segment.himmelsrichtung = index;
    segment.kurs = himmelsrichtungGrad(index);
  }
}

// Segment mit GK/: Gegenkurs des aktuellen Kurses, die 180°-Kehre geht in "gkRichtung"
function gkSetzen(zufall, segment, kurs) {
  segment.anzeige = 'gk';
  segment.gkRichtung = zufall.auswahl(['links', 'rechts']);
  segment.kurs = normieren(kurs + 180);
}

// Gradzahl-Kurve: Drehwinkel in Stufe 3 40 bis 340, in Stufe 2 30 bis 350 mit
// einem Drittel Schleifen, nie 180, links oder rechts, eigenes Profil über
// Winkel / 3 s
function kurveErzeugen(zufall, stufe, verlauf, bilanz, hoehe) {
  let winkel;
  if (stufe === 2) winkel = kurvenWinkelStufe2(zufall);
  else do { winkel = zufall.ganzzahl(KURVE_WINKEL.min, KURVE_WINKEL.max); } while (winkel === 180);
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
//   Dazu höchstens eine Zeile GK oder GK ± 10 bis 60.
// Form B: relativ wie Stufe 2, Betrag 20 bis 490.
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

// Typen der Zeilen eines Gates mit "gk" Zeilen GK oder GK ± n (je zur Hälfte).
// A: drei Zeilen, B: vier Zeilen, die übrigen etwa zur Hälfte relativ, zu je
// einem Viertel Himmelsrichtung und Gradkurs, mindestens eine relative Zeile;
// B hat nie GK, A höchstens eine. C: drei bis vier Zeilen, außer GK und GK ± n
// Himmelsrichtung und Himmelsrichtung ± n, keine zwei reinen GK hintereinander;
// selten eine Zeile "anl. Kurs" statt einer der übrigen, höchstens eine je Blatt
// ("zustand.anl").
function gateTypen(zufall, form, gk, zustand) {
  const anzahl = form === 'a' ? 3 : form === 'b' ? 4 : zufall.ganzzahl(3, 4);
  const gkStellen = new Set(verschiedeneIndizes(zufall, gk, bereich(0, anzahl - 1)));
  const uebrige = bereich(0, anzahl - 1).filter((j) => !gkStellen.has(j));
  const typen = new Array(anzahl);
  for (const j of gkStellen) typen[j] = zufall.auswahl(['gk', 'gkPlus']);
  if (form === 'c') {
    for (const j of uebrige) {
      typen[j] = zufall.gewichteteAuswahl([
        { wert: 'himmelsrichtung', gewicht: 1 },
        { wert: 'hrPlus', gewicht: 2 },
      ]);
    }
    for (let j = 1; j < anzahl; j++) if (typen[j] === 'gk' && typen[j - 1] === 'gk') typen[j] = 'gkPlus';
    if (!zustand.anl && zufall.wuerfel(ANL_ANTEIL)) {
      typen[zufall.auswahl(uebrige)] = 'anl';
      zustand.anl = true;
    }
    return typen;
  }
  for (const j of uebrige) {
    typen[j] = zufall.gewichteteAuswahl([
      { wert: 'relativ', gewicht: 2 },
      { wert: 'himmelsrichtung', gewicht: 1 },
      { wert: 'grad', gewicht: 1 },
    ]);
  }
  if (!typen.includes('relativ')) typen[zufall.auswahl(uebrige)] = 'relativ';
  return typen;
}

// Gate nach dem Bauplan "geplant" ({ form, gk })
function gateStufe3(zufall, geplant, kursDavor, verlauf, bilanz, hoehe, zustand) {
  const { form, gk } = geplant;
  const zeilen = [];
  let kurs = kursDavor;
  for (const typ of gateTypen(zufall, form, gk, zustand)) {
    const zeile = gateZeileStufe3(zufall, form, typ, kurs, verlauf, bilanz, hoehe);
    zeilen.push(zeile);
    kurs = zeile.kursDanach;
  }
  // Die Anschlusszeile der Form A setzt das nächste Segment, weil sie von
  // seinem Kurs abhängt
  return { art: 'gate', form, zeilen, anschluss: null };
}

// Formen und GK-Zeilen der Gates an den Stellen "stellen": zusammen
// STUFE3.gkZeilen Zeilen GK oder GK ± n, jedes Gate der Form C mit einer oder
// zwei, der Form A mit keiner oder einer, der Form B mit keiner (wie im
// Gegenkursbeispiel). Formen, auf die die Zeilen so nicht passen, werden neu
// gezogen. Liefert je Stelle { form, gk }.
function gatesPlanen(zufall, stellen) {
  const gkZeilen = zufall.ganzzahl(...STUFE3.gkZeilen);
  const gewichte = GATE_FORMEN.map((f) => ({ wert: f, gewicht: FORM_GEWICHTE[f] }));
  for (;;) {
    const formen = stellen.map(() => zufall.gewichteteAuswahl(gewichte));
    const c = formen.filter((f) => f === 'c').length;
    const a = formen.filter((f) => f === 'a').length;
    if (c > gkZeilen || a + 2 * c < gkZeilen) continue;
    // Jedes Gate der Form C hat eine, die übrigen gehen je höchstens eine an ein
    // Gate der Form A oder als zweite an eines der Form C
    const gk = formen.map((f) => (f === 'c' ? 1 : 0));
    const plaetze = formen.map((f, j) => (f === 'b' ? -1 : j)).filter((j) => j >= 0);
    for (const j of verschiedeneIndizes(zufall, gkZeilen - c, plaetze)) gk[j] += 1;
    return new Map(stellen.map((stelle, j) => [stelle, { form: formen[j], gk: gk[j] }]));
  }
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
// eine; relative Ecken, HR und GK brauchen eine gezeichnete Ecke davor. Zwei
// Segmente mit GK folgen nie direkt aufeinander. Form und GK-Zeilen jedes Gates
// stehen im Bauplan fest ("gates"), damit ein wiederholter Schritt sie behält.
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
  const hrIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(...m.hr), mitEcke.filter((i) => !relativeIndizes.has(i))));
  // Mindestens fünf Stellen bleiben frei (Ecken bei höchstens 7 Kurven und
  // Gates, 3 relativen und 2 HR); die erste gewählte sperrt höchstens zwei
  // Nachbarn, die zweite findet also immer Platz
  const gkAnzahl = zufall.ganzzahl(...m.gkSegmente);
  const gkIndizes = new Set();
  for (const i of zufall.mischen(mitEcke.filter((j) => !relativeIndizes.has(j) && !hrIndizes.has(j)))) {
    if (gkIndizes.size === gkAnzahl) break;
    if (!gkIndizes.has(i - 1) && !gkIndizes.has(i + 1)) gkIndizes.add(i);
  }
  const mitKurs = bereich(0, anzahl - 1).filter((i) => !kurveNach.has(i - 1) && !relativeIndizes.has(i) && !hrIndizes.has(i) && !gkIndizes.has(i));
  const himmelsIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(...m.himmelsrichtungen), mitKurs));
  const rechenIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(...m.rechenaufgaben), bereich(0, anzahl - 1)));
  const gates = gatesPlanen(zufall, [...gateNach].sort((x, y) => x - y));
  return { stufe: 3, anzahl, kreisNach, kurveNach, gateNach, gates, relativeIndizes, hrIndizes, gkIndizes, himmelsIndizes, rechenIndizes };
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

// Schritt i: Segment i und was ihm folgt, nach dem Bauplan einer der beiden
// Stufen. Ein Vollkreis bekommt seine Richtung und ein Gate der Form A seine
// Anschlusszeile erst mit dem nächsten Segment.
function schritt(zufall, plan, z, i) {
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
  } else if (plan.hrIndizes.has(i)) {
    hrSetzen(zufall, segment, kurs);
  } else if (plan.gkIndizes.has(i)) {
    gkSetzen(zufall, segment, kurs);
  } else {
    let passt = (k) => kurs === null || imBereich(abstand(kurs, k));
    if (plan.gateNach.has(i - 1) && plan.stufe === 3 && z.gate.form === 'a') {
      const art = zufall.auswahl(ANSCHLUESSE.filter((a) => anschlussMoeglich(a, kurs)));
      z.gate.anschluss = art;
      passt = (k) => anschlussPasst(art, kurs, k);
    }
    eigenerKurs(zufall, segment, plan.himmelsIndizes.has(i), passt);
  }
  if (plan.rechenIndizes.has(i)) segment.rechenaufgabe = mitVorzeichen(zufall, 100, RECHEN_BIS[plan.stufe]);
  segment.dauer = plan.stufe === 3 ? dauerStufe3(zufall) : dauerWaehlen(zufall);
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
    const kurve = kurveErzeugen(zufall, plan.stufe, z.verlauf, z.bilanz, z.hoehe);
    z.elemente.push(kurve);
    z.kurs = normieren(z.kurs + (kurve.richtung === 'rechts' ? kurve.winkel : -kurve.winkel));
  }
  if (plan.gateNach.has(i)) {
    z.gate = plan.stufe === 3
      ? gateStufe3(zufall, plan.gates.get(i), z.kurs, z.verlauf, z.bilanz, z.hoehe, z)
      : gateErzeugen(zufall, z.kurs, z.verlauf, z.bilanz, z.hoehe);
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

// Kette nach dem Bauplan "plan", Schritt für Schritt. Mit "pruefer"
// (schrittpruefer aus geometrie.js) wird jeder Schritt sofort gezeichnet und
// wiederholt, solange er einen früheren Teil des Wegs kreuzt oder ihm zu nahe
// kommt. Scheitert ein Schritt SCHRITT_VERSUCHE Mal, wird der Schritt davor
// wiederholt; nach KANDIDAT_VERSUCHE Schritten insgesamt ist das Ergebnis null.
// Ohne "pruefer" entsteht die Kette ohne Blick auf den Weg.
function elementeSchrittweise(zufall, plan, start, pruefer) {
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
    schritt(zufall, plan, z, i);
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
