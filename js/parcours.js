// Parcours der Stufe 2: Bausteine, Geometrie und Kandidatensuche.
// Ein Parcours ist eine Kette aus Segmenten und Vollkreisen. Zwischen zwei
// Segmenten liegt eine Ecke: kürzester Weg, wenn das nächste Segment einen Kurs
// trägt, sonst eine relative Kursänderung, die an der Ecke beschriftet wird.

import { normieren, differenz, drehung, kursText, himmelsrichtungGrad, himmelsrichtungName, SCHREIBWEISE } from './kurs.js';

export const SEKUNDE_LAENGE = 3;
export const ECKENRADIUS = 12;
export const SCHLEIFENRADIUS = 24;
export const KREISRADIUS = 35;
export const KANDIDATEN = 400;
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

// Richtungsvektor eines Kurses im Bildschirmkoordinatensystem (Norden ist -y)
function vektor(kurs) {
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
// Liefert SVG-Pfad, Polygonzug für die Kreuzungsprüfung, Endpunkt, Endkurs und
// einen Punkt außen an der Bogenmitte für die Beschriftung.
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
  const aussen = punktBei(kursVon + (s * winkel) / 2, radius + BESCHRIFTUNGSABSTAND);
  const pfad = `M ${punktText(start)} A ${radius} ${radius} 0 ${winkel > 180 ? 1 : 0} ${s === 1 ? 1 : 0} ${punktText(ende)}`;
  return { pfad, punkte, ende, kursNach, aussen };
}

function strecke(start, kurs, laenge) {
  const v = vektor(kurs);
  const ende = { x: start.x + v.x * laenge, y: start.y + v.y * laenge };
  const mitte = { x: (start.x + ende.x) / 2, y: (start.y + ende.y) / 2 };
  return { pfad: `M ${punktText(start)} L ${punktText(ende)}`, punkte: [start, ende], ende, mitte };
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

// Beschriftung parallel zum Segment, links versetzt, nie auf dem Kopf
function segmentBeschriftung(element, mitte) {
  const links = rechts(element.kurs + 180);
  let winkel = normieren(element.kurs - 90);
  if (winkel > 180) winkel -= 360;
  if (winkel > 90) winkel -= 180;
  if (winkel < -90) winkel += 180;
  const zeilen = [kursBeschriftung(element)];
  if (element.rechenaufgabe !== null) zeilen.push(vorzeichenText(element.rechenaufgabe));
  return {
    zeilen,
    x: mitte.x + links.x * BESCHRIFTUNGSABSTAND,
    y: mitte.y + links.y * BESCHRIFTUNGSABSTAND,
    winkel,
  };
}

function umrissBerechnen(stuecke, beschriftungen) {
  const xs = [];
  const ys = [];
  for (const s of stuecke) for (const q of s.punkte) { xs.push(q.x); ys.push(q.y); }
  for (const b of beschriftungen) { xs.push(b.x - 22, b.x + 22); ys.push(b.y - 10, b.y + 10); }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function geometrie(elemente) {
  const stuecke = [];
  const marken = [];
  const beschriftungen = [];
  let punkt = { x: 0, y: 0 };
  let kurs = null;

  for (const element of elemente) {
    if (element.art === 'vollkreis') {
      const erste = bogen(punkt, kurs, 180, element.richtung, KREISRADIUS);
      const zweite = bogen(erste.ende, erste.kursNach, 180, element.richtung, KREISRADIUS);
      // Der Kreis schließt sich exakt am Ausgangspunkt, damit die Kreuzungsprüfung
      // Berührungen an diesem Punkt als solche erkennt
      zweite.punkte[zweite.punkte.length - 1] = punkt;
      stuecke.push({ art: 'bogen', profil: element.profile[0], pfad: erste.pfad, punkte: erste.punkte, schleife: false });
      stuecke.push({ art: 'bogen', profil: element.profile[1], pfad: zweite.pfad, punkte: zweite.punkte, schleife: false });
      marken.push({ punkt: erste.ende, kurs: erste.kursNach });
      continue;
    }

    if (kurs !== null) {
      const richtung = element.relativ !== null
        ? (element.relativ > 0 ? 'rechts' : 'links')
        : (differenz(kurs, element.kurs) >= 0 ? 'rechts' : 'links');
      const winkel = element.relativ !== null ? Math.abs(element.relativ) : drehung(kurs, element.kurs, richtung);
      const schleife = winkel > 180;
      const ecke = bogen(punkt, kurs, winkel, richtung, schleife ? SCHLEIFENRADIUS : ECKENRADIUS);
      stuecke.push({ art: 'bogen', profil: element.profil, pfad: ecke.pfad, punkte: ecke.punkte, schleife });
      if (element.relativ !== null) {
        beschriftungen.push({ zeilen: [`${vorzeichenText(element.relativ)}°`], x: ecke.aussen.x, y: ecke.aussen.y, winkel: 0 });
      }
      punkt = ecke.ende;
    }

    marken.push({ punkt, kurs: element.kurs });
    const gerade = strecke(punkt, element.kurs, element.dauer * SEKUNDE_LAENGE);
    stuecke.push({ art: 'strecke', profil: element.profil, pfad: gerade.pfad, punkte: gerade.punkte, schleife: false });
    beschriftungen.push(segmentBeschriftung(element, gerade.mitte));
    punkt = gerade.ende;
    kurs = element.kurs;
  }

  marken.push({ punkt, kurs });
  return { stuecke, marken, beschriftungen, umriss: umrissBerechnen(stuecke, beschriftungen) };
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

// Kreuzungen zwischen nicht benachbarten Stücken. Bricht ab, sobald die Zahl
// über "grenze" liegt, damit die Kandidatensuche nicht unnötig zählt.
export function zaehleKreuzungen(stuecke, grenze = Infinity) {
  let anzahl = 0;
  for (let i = 0; i < stuecke.length; i++) {
    for (let j = i + 2; j < stuecke.length; j++) {
      // Die Kreuzung von Einfahrt und Ausfahrt einer Schleife ist Teil der
      // Figur, wie in der Vorlage, und kein Fehler
      if (j === i + 2 && stuecke[i + 1].schleife) continue;
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

export function seitenverhaeltnisPasst(umriss) {
  const verhaeltnis = (umriss.maxX - umriss.minX) / (umriss.maxY - umriss.minY);
  return verhaeltnis >= SEITENVERHAELTNIS.min && verhaeltnis <= SEITENVERHAELTNIS.max;
}

// Zieht bis zu KANDIDATEN Parcours aus dem Zufallsstrom und nimmt den ersten,
// der kreuzungsfrei ist und ins Hochformat passt. Sonst den besten.
export function erzeugeParcours(zufall) {
  let bester = null;
  for (let kandidat = 1; kandidat <= KANDIDATEN; kandidat++) {
    const elemente = erzeugeElemente(zufall);
    const geo = geometrie(elemente);
    const grenze = bester ? bester.kreuzungen : Infinity;
    const kreuzungen = zaehleKreuzungen(geo.stuecke, grenze);
    const passt = seitenverhaeltnisPasst(geo.umriss);
    if (kreuzungen === 0 && passt) return { elemente, geometrie: geo, kreuzungen, kandidat };
    const besser = !bester
      || kreuzungen < bester.kreuzungen
      || (kreuzungen === bester.kreuzungen && passt && !bester.passt);
    if (besser) bester = { elemente, geometrie: geo, kreuzungen, kandidat, passt };
  }
  return { elemente: bester.elemente, geometrie: bester.geometrie, kreuzungen: bester.kreuzungen, kandidat: bester.kandidat };
}
