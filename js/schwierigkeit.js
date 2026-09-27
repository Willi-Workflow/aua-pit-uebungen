// Schwierigkeit des Blitzrechnens: leicht, normal, schwer. Hier stehen die
// Wertebereiche, aus denen Kopfaufgaben und Ausschnitte ihre Zahlen ziehen, und
// die Vorgabezeiten je Schwierigkeit. Normal entspricht den Vorlagen. Die
// nummerierten Blätter kennen keine Schwierigkeit und ziehen ihre Zahlen weiter
// wie bisher in elemente.js. Kein DOM.
//
// Gerechnet wird immer der neue Kurs aus einer Basis (aktueller Kurs, Gegenkurs
// oder Himmelsrichtung) und einer Zahl mit Vorzeichen, Ergebnis modulo 360.
// Überlauf heißt: Basis plus Zahl erreicht 360 oder fällt unter 0.
//   leicht: Kurse in Zehnerschritten, Zahlen 10 bis 150 in Zehnerschritten,
//           Überlauf in höchstens einem von drei Fällen
//   normal: Kurse 000 bis 359, Zahlen 20 bis 490, Überlauf in etwa der Hälfte
//   schwer: wie normal, aber keine Zahl mit Endziffer 0 oder 5, ein Drittel der
//           Zahlen über 360, Himmelsrichtungen mit halbem Grad

import { normieren } from './kurs.js';

export const SCHWIERIGKEITEN = ['leicht', 'normal', 'schwer'];
export const VORGABE_SCHWIERIGKEIT = 'normal';

// Anzeige- und Antwortzeit in Sekunden, solange keine Zeit selbst gewählt ist
export const VORGABEZEITEN = {
  leicht: { anzeigezeit: 8, antwortzeit: 15 },
  normal: { anzeigezeit: 5, antwortzeit: 10 },
  schwer: { anzeigezeit: 3, antwortzeit: 8 },
};

// Anteil der Aufgaben mit Überlauf, wo er möglich ist; bei schwer nur für die
// Zahlen unter 360, die übrigen laufen immer über
export const UEBERLAUF = { leicht: 0.25, normal: 0.5, schwer: 0.5 };
// Anteil der Zahlen von 361 bis 490 bei schwer, nur bei Kurs plus oder minus Zahl
export const UEBER_360 = 1 / 3;

// Beträge je Zusammenhang, jeweils von bis:
//   zahl:  Kurs plus oder minus Zahl, Rechenaufgabe, relative Gate-Zeile ohne Gradzeichen
//   ecke:  relative Ecke; sie ist eine gezeichnete Drehung, deshalb unter 360 und nie 180
//   formA: relative Gate-Zeile mit Gradzeichen (Form A der Stufe 3), bis 190 wie in der PDF
//   gk:    GK plus oder minus n
//   hr:    Himmelsrichtung plus oder minus n
export const BETRAEGE = {
  leicht: { zahl: [10, 150], ecke: [10, 150], formA: [20, 150], gk: [10, 60], hr: [10, 130] },
  normal: { zahl: [20, 490], ecke: [20, 340], formA: [20, 190], gk: [10, 60], hr: [10, 130] },
  schwer: { zahl: [20, 490], ecke: [20, 340], formA: [20, 190], gk: [10, 60], hr: [10, 130] },
};

// Drehwinkel der Gradzahl-Kurven. Normal wie Stufe 2 mit rund einem Drittel
// Schleifen über 180°.
export const KURVENWINKEL = { leicht: [30, 150], normal: [30, 350], schwer: [150, 350] };
const SCHLEIFEN_ANTEIL = 0.37;

// anl. Kurs: plus n oder plus a×b. Normal wie auf den Blättern (n und a×b von 20
// bis 160, a von 2 bis 9, b von 2 bis 13); leicht nur plus n in Zehnerschritten;
// schwer nur a×b wie "9×13" ohne Faktor 5, 10 oder 15.
export const ANL = {
  leicht: { n: [20, 150] },
  normal: { n: [20, 160], a: [2, 9], b: [2, 13] },
  schwer: { a: [3, 9], b: [11, 17] },
};
const ANL_ERGEBNIS = [20, 160];

export function gueltigeSchwierigkeit(schwierigkeit) {
  return SCHWIERIGKEITEN.includes(schwierigkeit) ? schwierigkeit : VORGABE_SCHWIERIGKEIT;
}

function bereich(von, bis, schritt = 1) {
  const werte = [];
  for (let n = von; n <= bis; n += schritt) werte.push(n);
  return werte;
}

const ohneFuenfer = (n) => n % 5 !== 0;

export function ueberlauf(basis, wert) {
  const summe = basis + wert;
  return summe >= 360 || summe < 0;
}

// Beträge eines Zusammenhangs, ohne Vorzeichen, einmal berechnet
const betraegeSpeicher = new Map();
export function betraege(schwierigkeit, zusammenhang) {
  const schluessel = `${schwierigkeit}/${zusammenhang}`;
  if (!betraegeSpeicher.has(schluessel)) {
    const [von, bis] = BETRAEGE[schwierigkeit][zusammenhang];
    let werte;
    if (schwierigkeit === 'leicht') werte = bereich(Math.ceil(von / 10) * 10, bis, 10);
    else werte = bereich(von, bis).filter((n) => schwierigkeit === 'normal' || ohneFuenfer(n));
    // Eine Ecke von 180° hätte keine Richtung
    if (zusammenhang === 'ecke') werte = werte.filter((n) => n !== 180);
    betraegeSpeicher.set(schluessel, werte);
  }
  return betraegeSpeicher.get(schluessel);
}

// Beträge mit beiden Vorzeichen, ebenfalls einmal berechnet
const vorzeichenSpeicher = new Map();
function mitVorzeichen(werte) {
  if (!vorzeichenSpeicher.has(werte)) vorzeichenSpeicher.set(werte, werte.flatMap((n) => [n, -n]));
  return vorzeichenSpeicher.get(werte);
}

// Wählt aus "werte" (Zahlen mit Vorzeichen) einen: mit Wahrscheinlichkeit
// "anteil" einen mit Überlauf ab "basis", sonst einen ohne; gibt es die gewünschte
// Sorte nicht, die andere. "wertVon" liest die Zahl aus einem Eintrag.
function nachUeberlauf(zufall, werte, basis, anteil, wertVon = (w) => w) {
  const mit = werte.filter((w) => ueberlauf(basis, wertVon(w)));
  const ohne = werte.filter((w) => !ueberlauf(basis, wertVon(w)));
  const gewuenscht = zufall.wuerfel(anteil);
  const liste = gewuenscht ? (mit.length ? mit : ohne) : (ohne.length ? ohne : mit);
  if (!liste.length) throw new Error('Kein Wert im Bereich');
  return zufall.auswahl(liste);
}

// Zahl mit Vorzeichen zur Basis "basis" im Zusammenhang "zusammenhang" (siehe
// BETRAEGE), die "gueltig" erfüllt. Bei schwer ist ein Drittel der Zahlen
// über 360, soweit der Zusammenhang sie kennt; ohne gültigen Wert wirft sie.
export function zahlWaehlen(zufall, schwierigkeit, zusammenhang, basis, gueltig = () => true) {
  const alle = mitVorzeichen(betraege(schwierigkeit, zusammenhang)).filter(gueltig);
  let werte = alle;
  if (schwierigkeit === 'schwer' && zusammenhang === 'zahl') {
    const gross = alle.filter((w) => Math.abs(w) > 360);
    const klein = alle.filter((w) => Math.abs(w) < 360);
    if (zufall.wuerfel(UEBER_360) && gross.length) return zufall.auswahl(gross);
    werte = klein.length ? klein : gross;
  }
  return nachUeberlauf(zufall, werte, basis, UEBERLAUF[schwierigkeit]);
}

// Ein Kurs, von dem aus gerechnet wird: leicht in Zehnerschritten, sonst 000
// bis 359; "passt" muss für mindestens einen Kurs gelten
export function kursWaehlen(zufall, schwierigkeit, passt = () => true) {
  let kurs;
  do {
    kurs = schwierigkeit === 'leicht' ? zufall.ganzzahl(0, 35) * 10 : zufall.ganzzahl(0, 359);
  } while (!passt(kurs));
  return kurs;
}

// Ungerader Kurs von 001 bis 359, für schwer bei Gegenkurs und nächster Himmelsrichtung
export function ungeraderKurs(zufall) {
  return zufall.ganzzahl(0, 179) * 2 + 1;
}

// Himmelsrichtungen, auf die gerechnet wird (Index 0 bis 15): leicht nur N, E,
// S, W (Grad in Zehnerschritten), schwer nur die mit halbem Grad (NNE, ENE, …)
export function rechenRichtungen(schwierigkeit) {
  if (schwierigkeit === 'leicht') return [0, 4, 8, 12];
  if (schwierigkeit === 'schwer') return bereich(1, 15, 2);
  return bereich(0, 15);
}

// Himmelsrichtungen, die direkt geflogen werden (Gate-Zeile "SSW"): leicht nur
// N, E, S, W, damit das Rechnen danach bei Zehnerschritten bleibt, sonst alle 16
export function flugRichtungen(schwierigkeit) {
  return schwierigkeit === 'leicht' ? [0, 4, 8, 12] : bereich(0, 15);
}

// Himmelsrichtung und Zahl für "Himmelsrichtung ± n", mit "gegenkurs" für "GK
// von Himmelsrichtung ± n": zuerst eine Richtung aus rechenRichtungen, zu der eine
// Zahl passt, dann die Zahl. "gueltig" prüft den Kurs danach.
export function richtungPlusWaehlen(zufall, schwierigkeit, zusammenhang, gueltig = () => true, gegenkurs = false) {
  const werte = mitVorzeichen(betraege(schwierigkeit, zusammenhang));
  const basisVon = (index) => normieren(index * 22.5 + (gegenkurs ? 180 : 0));
  const moeglich = rechenRichtungen(schwierigkeit).filter((i) => werte.some((w) => gueltig(normieren(basisVon(i) + w))));
  if (!moeglich.length) throw new Error('Keine Himmelsrichtung im Bereich');
  const index = zufall.auswahl(moeglich);
  const basis = basisVon(index);
  return { index, wert: zahlWaehlen(zufall, schwierigkeit, zusammenhang, basis, (w) => gueltig(normieren(basis + w))) };
}

// Drehwinkel einer Gradzahl-Kurve: leicht 30 bis 150 in Zehnerschritten,
// normal 30 bis 350 ohne 180, schwer ungerade von 151 bis 349
export function kurvenWinkel(zufall, schwierigkeit) {
  const [von, bis] = KURVENWINKEL[schwierigkeit];
  if (schwierigkeit === 'leicht') return zufall.ganzzahl(von / 10, bis / 10) * 10;
  if (schwierigkeit === 'schwer') return zufall.ganzzahl(Math.ceil((von - 1) / 2), Math.floor((bis - 1) / 2)) * 2 + 1;
  return zufall.wuerfel(SCHLEIFEN_ANTEIL) ? zufall.ganzzahl(181, bis) : zufall.ganzzahl(von, 179);
}

// Mögliche Angaben "anl. Kurs" je Schwierigkeit: { typ: 'anl', wert } für
// plus n, { typ: 'anlProdukt', a, b, wert } für plus a×b
const anlSpeicher = new Map();
export function anlAngaben(schwierigkeit) {
  if (!anlSpeicher.has(schwierigkeit)) {
    const g = ANL[schwierigkeit];
    const plus = g.n ? bereich(...g.n, schwierigkeit === 'leicht' ? 10 : 1).map((wert) => ({ typ: 'anl', wert })) : [];
    const produkte = [];
    if (g.a) {
      for (const a of bereich(...g.a)) {
        for (const b of bereich(...g.b)) {
          const wert = a * b;
          if (wert < ANL_ERGEBNIS[0] || wert > ANL_ERGEBNIS[1]) continue;
          if (schwierigkeit === 'schwer' && (!ohneFuenfer(a) || !ohneFuenfer(b))) continue;
          produkte.push({ typ: 'anlProdukt', a, b, wert });
        }
      }
    }
    anlSpeicher.set(schwierigkeit, { plus, produkte });
  }
  return anlSpeicher.get(schwierigkeit);
}

// anl. Kurs ab "basis": bei normal je zur Hälfte plus n oder plus a×b
export function anlWaehlen(zufall, schwierigkeit, basis) {
  const { plus, produkte } = anlAngaben(schwierigkeit);
  let liste;
  if (!produkte.length) liste = plus;
  else if (!plus.length) liste = produkte;
  else liste = zufall.wuerfel(0.5) ? plus : produkte;
  return nachUeberlauf(zufall, liste, basis, UEBERLAUF[schwierigkeit], (angabe) => angabe.wert);
}
