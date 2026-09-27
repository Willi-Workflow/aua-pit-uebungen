// Parcours der Stufe 2: Bausteine, Geometrie und Kandidatensuche.
// Ein Parcours ist eine Kette aus Segmenten, Vollkreisen und auf manchen Blättern
// Gates. Zwischen zwei Segmenten liegt eine Ecke: kürzester Weg, wenn das nächste
// Segment einen Kurs trägt, sonst eine relative Kursänderung, die an der Ecke
// beschriftet wird. Ein Gate ersetzt eine Ecke durch einen Kasten mit drei bis
// vier Anweisungen, die aus dem Gedächtnis geflogen und nicht gezeichnet werden.

import { normieren, differenz, drehung as drehwinkel, kursText, himmelsrichtungGrad, himmelsrichtungName, SCHREIBWEISE } from './kurs.js';

// Maße in Einheiten der Zeichnung, abgelesen an der Vorlage: ein 10-Sekunden-Segment
// ist etwa sechsmal so lang wie der Strich breit (9), ein Vollkreis hat etwa seinen Radius.
export const SEKUNDE_LAENGE = 5;
export const ECKENRADIUS = 12;
export const SCHLEIFENRADIUS = 28;
export const KREISRADIUS = 35;
export const KANDIDATEN = 12000;
export const SEITENVERHAELTNIS = { min: 0.7, max: 1.25 };
// Der Start liegt im oberen Teil des gedrehten Umrisses, höchstens bei diesem
// Anteil der Höhe von oben gemessen
export const START_OBEN = 0.34;
// Kleinster Abstand der Mittellinien zweier Stücke: Bei Strichbreite 9 berühren
// sich die Striche dann höchstens, sie liegen nie übereinander.
export const LINIENBREITE_ABSTAND = 9;
export const ZEILENABSTAND = 9;
// Halbe Länge eines Querstrichs, er ragt so weit zu beiden Seiten der Mittellinie
export const MARKENLAENGE = 7;

// Flugzeugsymbol am Anfang: Mittelpunkt so weit hinter dem Start, entgegen der
// Richtung des ersten Segments, Radius eines Kreises, der das Symbol umschließt
export const FLUGZEUG_ABSTAND = 19;
export const FLUGZEUG_RADIUS = 14;

const BESCHRIFTUNGSABSTAND = 12;
// Halbe Breite eines Zeichens bei Schriftgröße 9; im Browser gemessen 2,4 bis 3,1
const HALBE_ZEICHENBREITE = 2.9;
const HALBE_STRICHBREITE = 4.5;
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

// Blätter mit Gates haben 15 bis 19 statt 18 bis 22 Segmente, wie die
// Handzeichnung mit vier Kästen; sonst würde die Zeichnung so groß, dass die
// Schrift im Druck oft unter 6 pt fiele.
// "start" ist der Flugzustand am Ende des Textteils ({ kurs, hoehe }): Das erste
// Segment liegt dann 20° bis 160° von diesem Kurs, und die Profile halten die
// Höhe im Rahmen 1000 bis 3000 ft. Ohne "start" gilt beides nicht.
export function erzeugeElemente(zufall, mitGates = false, start = null) {
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

// Richtungsvektor eines Kurses im Bildschirmkoordinatensystem (Norden ist -y)
export function vektor(kurs) {
  const r = (kurs * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
}

// Rechte Normale zum Kurs
function rechts(kurs) {
  return vektor(kurs + 90);
}

// Zwei Nachkommastellen, ohne nachlaufende Nullen, damit der Pfad kurz bleibt
function punktText(punkt) {
  return `${Number(punkt.x.toFixed(2))} ${Number(punkt.y.toFixed(2))}`;
}

// Kreisbogen ab "start" mit Anfangskurs "kursVon" um "winkel" Grad in "richtung".
// Liefert SVG-Pfad (als Funktion, siehe bahn), Polygonzug für die Prüfungen,
// Länge, Endpunkt, Endkurs und
// "aussen(anteil, abstand)": Punkt und Richtung außerhalb des Bogens, beim Anteil
// des Drehwinkels, "abstand" jenseits der Linie.
function bogen(start, kursVon, winkel, richtung, radius) {
  const s = richtung === 'rechts' ? 1 : -1;
  const n0 = rechts(kursVon);
  const zentrum = { x: start.x + s * radius * n0.x, y: start.y + s * radius * n0.y };
  const punktBei = (kurs, r = radius) => {
    const n = rechts(kurs);
    return { x: zentrum.x - s * r * n.x, y: zentrum.y - s * r * n.y };
  };
  const kursNach = normieren(kursVon + s * winkel);
  const ende = punktBei(kursNach);
  const schritte = Math.max(2, Math.ceil(winkel / 10));
  const punkte = [];
  for (let i = 0; i <= schritte; i++) punkte.push(punktBei(kursVon + (s * winkel * i) / schritte));
  punkte[0] = start;
  const aussen = (anteil, abstand) => {
    const n = rechts(kursVon + s * winkel * anteil);
    return { punkt: punktBei(kursVon + s * winkel * anteil, radius + abstand), richtung: { x: -s * n.x, y: -s * n.y } };
  };
  const pfad = () => `M ${punktText(start)} A ${radius} ${radius} 0 ${winkel > 180 ? 1 : 0} ${s === 1 ? 1 : 0} ${punktText(ende)}`;
  return { pfad, punkte, laenge: (radius * winkel * Math.PI) / 180, ende, kursNach, aussen, kreis: { mitte: zentrum, radius } };
}

function strecke(start, kurs, laenge) {
  const v = vektor(kurs);
  const ende = { x: start.x + v.x * laenge, y: start.y + v.y * laenge };
  return { pfad: () => `M ${punktText(start)} L ${punktText(ende)}`, punkte: [start, ende], laenge, ende };
}

function vorzeichenText(zahl) {
  return zahl > 0 ? `+${zahl}` : `${zahl}`;
}

function kursBeschriftung(element) {
  const dauer = `/${element.dauer}"`;
  if (element.anzeige === 'keine') return dauer;
  if (element.anzeige === 'himmelsrichtung') return `${himmelsrichtungName(element.himmelsrichtung, SCHREIBWEISE.zeichnung)}${dauer}`;
  return `${kursText(element.kurs)}°${dauer}`;
}

function laengsteZeile(zeilen) {
  return Math.max(...zeilen.map((z) => z.length));
}

// Beschriftung parallel zum Segment auf der Seite "seite", nie auf dem Kopf.
// "mitte" ist der Fußpunkt auf der Mittellinie des Segments, in der ersten Lage
// die Segmentmitte. Weitere Zeilen stehen im gedrehten Textrahmen unter der
// ersten. Zeigt "unten" zur Linie, rückt der ganze Block um die zusätzlichen
// Zeilen nach außen, damit keine Zeile auf dem Strich landet. Lage und Winkel
// folgen der gezeichneten Richtung, Kurs minus "drehung"; "kurs" bleibt der Kurs.
function segmentBeschriftung(element, mitte, seite, drehung) {
  const gezeichnet = normieren(element.kurs - drehung);
  const normale = seite === 'links' ? rechts(gezeichnet + 180) : rechts(gezeichnet);
  let winkel = normieren(gezeichnet - 90);
  if (winkel > 180) winkel -= 360;
  if (winkel > 90) winkel -= 180;
  if (winkel < -90) winkel += 180;
  const zeilen = [kursBeschriftung(element)];
  if (element.rechenaufgabe !== null) zeilen.push(vorzeichenText(element.rechenaufgabe));
  const w = (winkel * Math.PI) / 180;
  const untenZurLinie = -Math.sin(w) * normale.x + Math.cos(w) * normale.y < 0;
  const versatz = BESCHRIFTUNGSABSTAND + (untenZurLinie ? (zeilen.length - 1) * ZEILENABSTAND : 0);
  return {
    zeilen,
    x: mitte.x + normale.x * versatz,
    y: mitte.y + normale.y * versatz,
    winkel,
    mitte,
    kurs: element.kurs,
  };
}

const GATE_PFEILE = { horizontal: '→', steigen: '↗', sinken: '↘' };

// Zeile eines Gates: erster Wert, Pfeil für das Profil, Dauer. Relativwerte mit
// Vorzeichen, Himmelsrichtung englisch, Gradkurs dreistellig mit Gradzeichen.
function gateZeileText(zeile) {
  const { kurs } = zeile;
  let wert;
  if (kurs.typ === 'relativ') wert = vorzeichenText(kurs.wert);
  else if (kurs.typ === 'himmelsrichtung') wert = himmelsrichtungName(kurs.index, SCHREIBWEISE.zeichnung);
  else wert = `${kursText(kurs.grad)}°`;
  return `${wert} ${GATE_PFEILE[zeile.profil]} ${zeile.dauer}"`;
}

// Weg vom Kastenmittelpunkt in Richtung "richtung" bis zum Rand
function bisZumRand(richtung, halbeBreite, halbeHoehe) {
  return Math.min(halbeBreite / Math.abs(richtung.x), halbeHoehe / Math.abs(richtung.y));
}

// Achsenparalleler Kasten eines Gates um seine Zeilentexte "texte". Die Ankunft
// liegt auf dem Rand, der Mittelpunkt in Richtung des alten Kurses dahinter; der
// Austritt ist der Punkt, an dem der neue Kurs vom Mittelpunkt aus den Rand verlässt.
function gateKasten(texte, ankunft, kursVorher, kursNachher) {
  const halbeBreite = (6.2 * laengsteZeile(texte) + 10) / 2;
  const halbeHoehe = (texte.length * ZEILENABSTAND + 8) / 2;
  const d = vektor(kursVorher);
  const t = bisZumRand(d, halbeBreite, halbeHoehe);
  const mitte = { x: ankunft.x + d.x * t, y: ankunft.y + d.y * t };
  const d2 = vektor(kursNachher);
  const t2 = bisZumRand(d2, halbeBreite, halbeHoehe);
  const austritt = { x: mitte.x + d2.x * t2, y: mitte.y + d2.y * t2 };
  const linkerRand = mitte.x - halbeBreite;
  const rechterRand = mitte.x + halbeBreite;
  const obererRand = mitte.y - halbeHoehe;
  const untererRand = mitte.y + halbeHoehe;
  // Ecken im Uhrzeigersinn ab links oben, die erste am Ende wiederholt
  const punkte = [
    { x: linkerRand, y: obererRand }, { x: rechterRand, y: obererRand }, { x: rechterRand, y: untererRand },
    { x: linkerRand, y: untererRand }, { x: linkerRand, y: obererRand },
  ];
  const pfad = () => `M ${punktText(punkte[0])} L ${punktText(punkte[1])} L ${punktText(punkte[2])} L ${punktText(punkte[3])} Z`;
  return { mitte, austritt, halbeBreite, halbeHoehe, punkte, pfad };
}

// Querstrich am Austritt eines Gates. Verlässt die Strecke den Kasten schräg,
// ragte ein Querstrich genau am Austritt bis an den Text; er rückt deshalb auf der
// Strecke so weit nach außen, dass keines seiner Enden mehr als 2 Einheiten in den
// Kasten reicht. Verlässt sie ihn senkrecht, liegt er auf dem Kastenrand.
function austrittsMarke(austritt, kurs, ecken) {
  const d = vektor(kurs);
  const n = rechts(kurs);
  const minX = ecken[0].x + 2;
  const minY = ecken[0].y + 2;
  const maxX = ecken[2].x - 2;
  const maxY = ecken[2].y - 2;
  let weg = 0;
  for (const seite of [1, -1]) {
    const ende = { x: austritt.x + seite * MARKENLAENGE * n.x, y: austritt.y + seite * MARKENLAENGE * n.y };
    if (ende.x <= minX || ende.x >= maxX || ende.y <= minY || ende.y >= maxY) continue;
    const wegX = d.x > 0 ? (maxX - ende.x) / d.x : d.x < 0 ? (minX - ende.x) / d.x : Infinity;
    const wegY = d.y > 0 ? (maxY - ende.y) / d.y : d.y < 0 ? (minY - ende.y) / d.y : Infinity;
    weg = Math.max(weg, Math.min(wegX, wegY));
  }
  return { x: austritt.x + weg * d.x, y: austritt.y + weg * d.y };
}

// Beschriftung einer relativen Ecke, waagrecht außen am Bogen. Sie rückt um den
// Teil der halben Textbreite weiter nach außen, der in Richtung der Versetzung
// zeigt, damit der Text nicht in den Bogen ragt.
function eckBeschriftung(text, ecke, anteil) {
  const { richtung } = ecke.aussen(anteil, 0);
  const abstand = BESCHRIFTUNGSABSTAND + Math.abs(richtung.x) * HALBE_ZEICHENBREITE * text.length;
  const { punkt } = ecke.aussen(anteil, abstand);
  return { zeilen: [text], x: punkt.x, y: punkt.y, winkel: 0, mitte: null, kurs: null };
}

function umrissBerechnen(stuecke, beschriftungen) {
  const xs = [];
  const ys = [];
  for (const s of stuecke) for (const q of s.punkte) { xs.push(q.x); ys.push(q.y); }
  for (const b of beschriftungen) {
    // Gate-Texte liegen im Kasten, dessen Ecken schon zählen
    if (b.gate) continue;
    const halbeBreite = 3 + HALBE_ZEICHENBREITE * laengsteZeile(b.zeilen);
    const halbeHoehe = 5 + (b.zeilen.length - 1) * ZEILENABSTAND;
    xs.push(b.x - halbeBreite, b.x + halbeBreite);
    ys.push(b.y - halbeHoehe, b.y + halbeHoehe);
  }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// Weg ohne gesetzte Beschriftungen: Stücke, Querstriche und je Beschriftung die
// möglichen Lagen. Kreuzungen und Abstände hängen nur hiervon ab.
// Gezeichnet wird jeder Kurs als Kurs minus "drehung": Das Blatt ist um diesen
// Winkel gedreht, Norden zeigt in der Zeichnung nach "-drehung". Kurse,
// Drehrichtungen und Beschriftungstexte bleiben, wie sie sind; Gate-Kästen und
// Eckbeschriftungen bleiben waagerecht.
// SVG-Pfade und Beschriftungslagen sind hier noch Funktionen: Die meisten
// Kandidaten scheitern an den Prüfungen des Wegs, erst vollenden braucht sie.
function bahn(elemente, drehung = 0) {
  const gezeichnet = (kurs) => normieren(kurs - drehung);
  const stuecke = [];
  const marken = [];
  const beschriftungen = [];
  let punkt = { x: 0, y: 0 };
  let kurs = null;
  let profil = null; // Profil des zuletzt geflogenen Stücks
  let austrittsKasten = null; // Ecken des Gates, an dessen Austritt das nächste Segment beginnt

  for (let n = 0; n < elemente.length; n++) {
    const element = elemente[n];
    if (element.art === 'gate') {
      // Das nächste Element ist immer ein Segment mit Kurs; es beginnt am
      // Austritt ohne Bogen, sein Querstrich markiert den Austritt
      const texte = element.zeilen.map(gateZeileText);
      const kasten = gateKasten(texte, punkt, gezeichnet(kurs), gezeichnet(elemente[n + 1].kurs));
      stuecke.push({ art: 'gate', profil: null, pfad: kasten.pfad, punkte: kasten.punkte, laenge: 0, schleife: false });
      beschriftungen.push({
        eigeneStuecke: [stuecke.length - 1],
        varianten: () => [{
          zeilen: texte,
          x: kasten.mitte.x,
          y: kasten.mitte.y,
          winkel: 0,
          mitte: null,
          kurs: null,
          gate: true,
          halbeBreite: kasten.halbeBreite,
          halbeHoehe: kasten.halbeHoehe,
        }],
      });
      punkt = kasten.austritt;
      austrittsKasten = kasten.punkte;
      kurs = null; // wie am Anfang: keine Ecke vor dem nächsten Segment
      profil = element.zeilen[element.zeilen.length - 1].profil;
      continue;
    }

    if (element.art === 'vollkreis') {
      const erste = bogen(punkt, gezeichnet(kurs), 180, element.richtung, KREISRADIUS);
      const zweite = bogen(erste.ende, erste.kursNach, 180, element.richtung, KREISRADIUS);
      // Der Kreis schließt sich exakt am Ausgangspunkt, damit die Kreuzungsprüfung
      // Berührungen an diesem Punkt als solche erkennt
      zweite.punkte[zweite.punkte.length - 1] = punkt;
      stuecke.push({ art: 'bogen', profil: element.profile[0], pfad: erste.pfad, punkte: erste.punkte, laenge: erste.laenge, schleife: false, kreis: erste.kreis });
      stuecke.push({ art: 'bogen', profil: element.profile[1], pfad: zweite.pfad, punkte: zweite.punkte, laenge: zweite.laenge, schleife: false, kreis: zweite.kreis });
      // Querstrich am Berührpunkt, der Anfang und Ende zugleich ist, und bei 180°
      marken.push({ punkt, kurs, gezeichnet: gezeichnet(kurs) });
      marken.push({ punkt: erste.ende, kurs: normieren(kurs + 180), gezeichnet: erste.kursNach });
      profil = element.profile[1];
      continue;
    }

    if (kurs !== null) {
      const richtung = element.relativ !== null
        ? (element.relativ > 0 ? 'rechts' : 'links')
        : (differenz(kurs, element.kurs) >= 0 ? 'rechts' : 'links');
      const winkel = element.relativ !== null ? Math.abs(element.relativ) : drehwinkel(kurs, element.kurs, richtung);
      const schleife = winkel > 180;
      const ecke = bogen(punkt, gezeichnet(kurs), winkel, richtung, schleife ? SCHLEIFENRADIUS : ECKENRADIUS);
      // Der Bogen gehört noch zum vorherigen Flugzustand, das neue Profil beginnt am Querstrich danach
      stuecke.push({ art: 'bogen', profil, pfad: ecke.pfad, punkte: ecke.punkte, laenge: ecke.laenge, schleife, kreis: schleife ? ecke.kreis : null });
      if (element.relativ !== null) {
        const text = `${vorzeichenText(element.relativ)}°`;
        beschriftungen.push({
          eigeneStuecke: [stuecke.length - 1],
          varianten: () => [0.5, 0.25, 0.75].map((anteil) => eckBeschriftung(text, ecke, anteil)),
        });
      }
      punkt = ecke.ende;
    }

    const richtung = gezeichnet(element.kurs);
    marken.push({ punkt: austrittsKasten ? austrittsMarke(punkt, richtung, austrittsKasten) : punkt, kurs: element.kurs, gezeichnet: richtung });
    austrittsKasten = null;
    const gerade = strecke(punkt, richtung, element.dauer * SEKUNDE_LAENGE);
    stuecke.push({ art: 'strecke', profil: element.profil, pfad: gerade.pfad, punkte: gerade.punkte, laenge: gerade.laenge, schleife: false });
    beschriftungen.push({
      eigeneStuecke: [stuecke.length - 1],
      varianten: () => [0.5, 0.3, 0.7].flatMap((t) => {
        const fuss = { x: gerade.punkte[0].x + t * (gerade.ende.x - gerade.punkte[0].x), y: gerade.punkte[0].y + t * (gerade.ende.y - gerade.punkte[0].y) };
        return [segmentBeschriftung(element, fuss, 'links', drehung), segmentBeschriftung(element, fuss, 'rechts', drehung)];
      }),
    });
    punkt = gerade.ende;
    kurs = element.kurs;
    profil = element.profil;
  }

  // Eigene Stücke einer Beschriftung: ihr Stück und die angrenzenden, bei einem
  // Segment die Bögen davor und danach, bei einer Ecke und einem Gate die Strecken
  // davor und danach. Die Strecken enden am Kastenrand, der Kasten deckt sie dort ab.
  for (const b of beschriftungen) {
    const eigenes = b.eigeneStuecke[0];
    const nachbarArt = stuecke[eigenes].art === 'strecke' ? 'bogen' : 'strecke';
    b.eigeneStuecke = [eigenes - 1, eigenes, eigenes + 1]
      .filter((i) => i === eigenes || (i >= 0 && i < stuecke.length && stuecke[i].art === nachbarArt));
  }

  marken.push({ punkt, kurs, gezeichnet: gezeichnet(kurs) });
  return { stuecke, marken, entwuerfe: beschriftungen, flugzeug: flugzeugLage(marken[0]), drehung };
}

// Kreis um das Flugzeugsymbol, hinter dem Start entgegen der gezeichneten Richtung
// des ersten Segments
function flugzeugLage(start) {
  const v = vektor(start.gezeichnet);
  return {
    mitte: { x: start.punkt.x - v.x * FLUGZEUG_ABSTAND, y: start.punkt.y - v.y * FLUGZEUG_ABSTAND },
    radius: FLUGZEUG_RADIUS,
  };
}

// Schreibt die SVG-Pfade aus, setzt die Beschriftungen und bestimmt den Umriss
function vollenden(roh) {
  const stuecke = roh.stuecke.map((s) => ({ ...s, pfad: s.pfad() }));
  const entwuerfe = roh.entwuerfe.map((e) => ({ eigeneStuecke: e.eigeneStuecke, varianten: e.varianten() }));
  const beschriftungen = beschriftungenSetzen(stuecke, entwuerfe, roh.flugzeug);
  return {
    stuecke,
    marken: roh.marken,
    beschriftungen,
    umriss: umrissBerechnen(stuecke, beschriftungen),
    flugzeug: roh.flugzeug,
    drehung: roh.drehung,
  };
}

// Geometrie mit Zeichenwinkel "drehung" in Grad, siehe bahn
export function geometrie(elemente, drehung = 0) {
  return vollenden(bahn(elemente, drehung));
}

// Liegt der Start im oberen Teil des Umrisses, höchstens START_OBEN von oben?
export function startOben(geo) {
  const { minY, maxY } = geo.umriss;
  return (geo.marken[0].punkt.y - minY) / (maxY - minY) <= START_OBEN;
}

// Setzt die Beschriftungen der Reihe nach, jede in die erste freie ihrer Lagen:
// Segmente links, dann rechts der Mitte, dann ebenso bei 30 und 70 Prozent der
// Länge; Ecken außen an der Bogenmitte, dann bei einem und drei Vierteln des
// Bogens. Frei heißt: kein fremdes Stück und keine schon gesetzte Beschriftung
// stört. Ist keine Lage frei, bleibt die erste; das verwirft dann die Auswahl.
// So hält es auch die Vorlage: die Beschriftung steht dort, wo Platz ist.
// Gate-Texte stehen fest in ihrem Kasten; die übrigen weichen ihnen und dem
// Flugzeugsymbol von Anfang an aus.
function beschriftungenSetzen(stuecke, entwuerfe, flugzeug) {
  const kaesten = stuecke.map((s) => kasten(s.punkte));
  const gesetzt = [];
  const kapseln = entwuerfe.filter((e) => e.varianten[0].gate).map((e) => beschriftungKapsel(e.varianten[0]));
  if (flugzeug) kapseln.push(flugzeugKapsel(flugzeug));
  for (const entwurf of entwuerfe) {
    const varianten = entwurf.varianten.map((v) => ({ ...v, eigeneStuecke: entwurf.eigeneStuecke }));
    if (varianten[0].gate) {
      gesetzt.push(varianten[0]);
      continue;
    }
    let wahl = varianten[0];
    for (const v of varianten) {
      if (!beschriftungStoert(v, beschriftungKapsel(v), stuecke, kaesten, kapseln)) {
        wahl = v;
        break;
      }
    }
    gesetzt.push(wahl);
    kapseln.push(beschriftungKapsel(wahl));
  }
  return gesetzt;
}

function kreuzprodukt(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

// Echte Kreuzung zweier Strecken. Berührungen an Endpunkten und kollineare
// Überlappungen zählen nicht, deshalb strenge Vorzeichenprüfung.
function schneidenSich(a1, a2, b1, b2) {
  const d1 = kreuzprodukt(b2.x - b1.x, b2.y - b1.y, a1.x - b1.x, a1.y - b1.y);
  const d2 = kreuzprodukt(b2.x - b1.x, b2.y - b1.y, a2.x - b1.x, a2.y - b1.y);
  const d3 = kreuzprodukt(a2.x - a1.x, a2.y - a1.y, b1.x - a1.x, b1.y - a1.y);
  const d4 = kreuzprodukt(a2.x - a1.x, a2.y - a1.y, b2.x - a1.x, b2.y - a1.y);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// Umgebendes Rechteck eines Polygonzugs
function kasten(punkte) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const q of punkte) {
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.y > maxY) maxY = q.y;
  }
  return { minX, minY, maxX, maxY };
}

// Abstand zweier Rechtecke, 0 bei Überlappung. Untergrenze für jeden Abstand ihrer Inhalte.
function kastenAbstand(a, b) {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return Math.hypot(dx, dy);
}

function punktStreckeAbstand(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const laenge2 = vx * vx + vy * vy;
  let t = laenge2 === 0 ? 0 : ((p.x - a.x) * vx + (p.y - a.y) * vy) / laenge2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

// Abstand zweier Strecken: 0, wenn sie sich kreuzen, sonst der kleinste Abstand
// eines Endpunkts zur anderen Strecke
function streckenAbstand(a1, a2, b1, b2) {
  if (schneidenSich(a1, a2, b1, b2)) return 0;
  return Math.min(
    punktStreckeAbstand(a1, b1, b2), punktStreckeAbstand(a2, b1, b2),
    punktStreckeAbstand(b1, a1, a2), punktStreckeAbstand(b2, a1, a2),
  );
}

// Kleinster Abstand zwischen zwei Polygonzügen über alle Streckenpaare
function zugAbstand(a, b) {
  let kleinster = Infinity;
  for (let m = 0; m + 1 < a.length; m++) {
    for (let n = 0; n + 1 < b.length; n++) {
      const d = streckenAbstand(a[m], a[m + 1], b[n], b[n + 1]);
      if (d < kleinster) kleinster = d;
    }
  }
  return kleinster;
}

// Kreuzungen zwischen nicht benachbarten Stücken. Bricht ab, sobald die Zahl
// über "grenze" liegt, damit die Kandidatensuche nicht unnötig zählt.
export function zaehleKreuzungen(stuecke, grenze = Infinity) {
  const kaesten = stuecke.map((s) => kasten(s.punkte));
  let anzahl = 0;
  for (let i = 0; i < stuecke.length; i++) {
    for (let j = i + 2; j < stuecke.length; j++) {
      // Die Kreuzung von Einfahrt und Ausfahrt einer Schleife ist Teil der
      // Figur, wie in der Vorlage, und kein Fehler. Das gilt nur für die Strecke
      // vor der Schleife; ein Kreisbogen davor wird regulär geprüft.
      if (j === i + 2 && stuecke[i + 1].schleife && stuecke[i].art === 'strecke') continue;
      if (kastenAbstand(kaesten[i], kaesten[j]) > 0) continue;
      const a = stuecke[i].punkte;
      const b = stuecke[j].punkte;
      for (let m = 0; m + 1 < a.length; m++) {
        for (let n = 0; n + 1 < b.length; n++) {
          if (schneidenSich(a[m], a[m + 1], b[n], b[n + 1])) {
            anzahl += 1;
            if (anzahl > grenze) return anzahl;
          }
        }
      }
    }
  }
  return anzahl;
}

// Kleinster Abstand zwischen zwei Stücken, die mindestens eine Strecke oder ein
// Gate-Kasten trennt. Stücke, zwischen denen nur Bögen liegen, gehören zu einer
// Figur: an einer Ecke die beiden Strecken (Sehne des Eckbogens, bei 20° nur gut
// 4 Einheiten), am Vollkreis alles, was den Berührpunkt teilt, und die Schleife.
// Die Strecken vor und nach einem Gate zählen dagegen: Liegt der Austritt nahe
// der Ankunft, liefen sie übereinander. Mit "flugzeug" zählt das Symbol als
// Hindernis für alle Stücke außer der ersten Strecke, an der es sitzt. Sein
// Abstand wird in einen Mittellinienabstand umgerechnet: Ein Strich, der den
// Kreis um das Symbol gerade berührt, gilt wie zwei Striche, die sich gerade
// berühren (LINIENBREITE_ABSTAND). Liegt das Symbol in einem Gate-Kasten, ist
// der Abstand 0. Bricht ab, sobald ein Abstand unter "grenze" gefunden ist;
// sonst ist das Ergebnis genau.
export function kleinsterAbstand(stuecke, grenze = 0, flugzeug = null) {
  const kaesten = stuecke.map((s) => kasten(s.punkte));
  let kleinster = Infinity;
  if (flugzeug) {
    const { mitte, radius } = flugzeug;
    const zuschlag = LINIENBREITE_ABSTAND - radius - HALBE_STRICHBREITE;
    const ort = { minX: mitte.x, minY: mitte.y, maxX: mitte.x, maxY: mitte.y };
    for (let j = 1; j < stuecke.length; j++) {
      if (kastenAbstand(ort, kaesten[j]) + zuschlag >= kleinster) continue;
      const innen = stuecke[j].art === 'gate' && kastenAbstand(ort, kaesten[j]) === 0;
      const d = (innen ? 0 : zugAbstand([mitte, mitte], stuecke[j].punkte)) + zuschlag;
      if (d < kleinster) {
        kleinster = d;
        if (kleinster < grenze) return kleinster;
      }
    }
  }
  for (let i = 0; i < stuecke.length; i++) {
    let getrennt = false;
    for (let j = i + 2; j < stuecke.length; j++) {
      if (stuecke[j - 1].art === 'strecke' || stuecke[j - 1].art === 'gate') getrennt = true;
      if (!getrennt) continue;
      if (kastenAbstand(kaesten[i], kaesten[j]) >= kleinster) continue;
      const d = zugAbstand(stuecke[i].punkte, stuecke[j].punkte);
      if (d < kleinster) {
        kleinster = d;
        if (kleinster < grenze) return kleinster;
      }
    }
  }
  return kleinster;
}

// Fläche einer Beschriftung als Kapsel: Achse längs der Zeilen durch die Blockmitte,
// Radius halbe Blockhöhe. Die Halbbreite folgt der gemessenen Zeichenbreite, damit
// auch die Zeilenenden geschützt sind. Ein Gate-Text belegt die Kapsel, die dem
// Kasten einbeschrieben ist; so steht auch innen im Kasten keine fremde Beschriftung.
function beschriftungKapsel(b) {
  if (b.gate) {
    const radius = b.halbeHoehe;
    const achse = Math.max(0, b.halbeBreite - radius);
    const a = { x: b.x - achse, y: b.y };
    const e = { x: b.x + achse, y: b.y };
    return { a, e, radius, umfang: { minX: a.x - radius, minY: b.y - radius, maxX: e.x + radius, maxY: b.y + radius } };
  }
  const w = (b.winkel * Math.PI) / 180;
  const laengs = { x: Math.cos(w), y: Math.sin(w) };
  const unten = { x: -Math.sin(w), y: Math.cos(w) };
  const versatz = ((b.zeilen.length - 1) * ZEILENABSTAND) / 2;
  const mitte = { x: b.x + unten.x * versatz, y: b.y + unten.y * versatz };
  const halbeBreite = HALBE_ZEICHENBREITE * laengsteZeile(b.zeilen) + 2;
  const radius = (b.zeilen.length * ZEILENABSTAND) / 2 + 2;
  const achse = Math.max(0, halbeBreite - radius);
  const a = { x: mitte.x - laengs.x * achse, y: mitte.y - laengs.y * achse };
  const e = { x: mitte.x + laengs.x * achse, y: mitte.y + laengs.y * achse };
  const umfang = { minX: Math.min(a.x, e.x) - radius, minY: Math.min(a.y, e.y) - radius, maxX: Math.max(a.x, e.x) + radius, maxY: Math.max(a.y, e.y) + radius };
  return { a, e, radius, umfang };
}

// Das Flugzeugsymbol als Kapsel ohne Länge, damit Beschriftungen ihm ausweichen
// wie einer anderen Beschriftung
function flugzeugKapsel(flugzeug) {
  const { mitte, radius } = flugzeug;
  return { a: mitte, e: mitte, radius, umfang: { minX: mitte.x - radius, minY: mitte.y - radius, maxX: mitte.x + radius, maxY: mitte.y + radius } };
}

// Stört ein fremdes Stück oder eine der "andere" Kapseln die Beschriftung? Fremd
// ist jedes Stück außer den eigenen, und eigene Schleifen und Vollkreishälften
// (alles mit "kreis") zählen trotzdem als fremd: Sie schwingen seitlich aus und
// laufen sonst durch die Beschriftung des Segments daneben. Ein Strich muss
// mindestens seine halbe Breite vom Text entfernt bleiben, zwei Beschriftungen
// dürfen sich nicht berühren. Innerhalb eines Vollkreises oder einer Schleife
// steht keine Beschriftung, sonst läse man sie als Teil der Figur.
function beschriftungStoert(b, k, stuecke, kaesten, andere) {
  const noetig = k.radius + HALBE_STRICHBREITE;
  for (let s = 0; s < stuecke.length; s++) {
    const { kreis } = stuecke[s];
    if (kreis && punktStreckeAbstand(kreis.mitte, k.a, k.e) < kreis.radius) return true;
    if (b.eigeneStuecke.includes(s) && !kreis) continue;
    if (kastenAbstand(k.umfang, kaesten[s]) >= noetig) continue;
    if (zugAbstand([k.a, k.e], stuecke[s].punkte) < noetig) return true;
  }
  for (const o of andere) {
    if (kastenAbstand(k.umfang, o.umfang) > 0) continue;
    if (streckenAbstand(k.a, k.e, o.a, o.e) < k.radius + o.radius) return true;
  }
  return false;
}

// Zählt Beschriftungen, die ein fremdes Stück, eine andere Beschriftung oder das
// Flugzeugsymbol berühren. Bricht ab, sobald die Zahl über "grenze" liegt.
export function verdeckteBeschriftungen(geo, grenze = Infinity) {
  const { stuecke, beschriftungen, flugzeug } = geo;
  const kaesten = stuecke.map((s) => kasten(s.punkte));
  const kapseln = beschriftungen.map(beschriftungKapsel);
  const symbol = flugzeug ? [flugzeugKapsel(flugzeug)] : [];
  let anzahl = 0;
  for (let i = 0; i < beschriftungen.length; i++) {
    const andere = [...kapseln.filter((_, j) => j !== i), ...symbol];
    if (beschriftungStoert(beschriftungen[i], kapseln[i], stuecke, kaesten, andere)) {
      anzahl += 1;
      if (anzahl > grenze) return anzahl;
    }
  }
  return anzahl;
}

export function beschriftungFrei(geo) {
  return verdeckteBeschriftungen(geo, 0) === 0;
}

function seitenverhaeltnis(umriss) {
  return (umriss.maxX - umriss.minX) / (umriss.maxY - umriss.minY);
}

export function seitenverhaeltnisPasst(umriss) {
  const verhaeltnis = seitenverhaeltnis(umriss);
  return verhaeltnis >= SEITENVERHAELTNIS.min && verhaeltnis <= SEITENVERHAELTNIS.max;
}

function gesamtlaenge(stuecke) {
  return stuecke.reduce((summe, s) => summe + s.laenge, 0);
}

// Weglänge je Umrisskante: hoch heißt kompakt und gut gefüllt, nicht langgezogen
export function fuellungBerechnen(geo) {
  const { minX, minY, maxX, maxY } = geo.umriss;
  return gesamtlaenge(geo.stuecke) / (maxX - minX + maxY - minY);
}

// Füllung ohne Beschriftungen. Beschriftungen vergrößern den Umriss nur, also
// liegt die Füllung des fertigen Kandidaten nie darüber.
function fuellungObergrenze(stuecke) {
  const k = kasten(stuecke.flatMap((s) => s.punkte));
  return gesamtlaenge(stuecke) / (k.maxX - k.minX + k.maxY - k.minY);
}

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
// Prüfung aller. "start" ist der Flugzustand am Ende des Textteils, siehe
// erzeugeElemente.
export function erzeugeParcours(zufall, mitGates = false, start = null) {
  let bester = null;
  let ersatz = null;
  for (let kandidat = 1; kandidat <= KANDIDATEN; kandidat++) {
    const elemente = erzeugeElemente(zufall, mitGates, start);
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
