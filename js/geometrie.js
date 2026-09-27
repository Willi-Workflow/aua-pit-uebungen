// Geometrie des Parcours: Weg, Querstriche und Beschriftungen aus der Kette der
// Elemente, dazu die Maße, nach denen die Kandidatensuche auswählt (Kreuzungen,
// Strichabstand, freie Beschriftungen, Seitenverhältnis, Füllung, Start oben).

import { normieren, differenz, drehung as drehwinkel, kursText, himmelsrichtungName, SCHREIBWEISE } from './kurs.js';

// Maße in Einheiten der Zeichnung, abgelesen an der Vorlage: ein 10-Sekunden-Segment
// ist etwa sechsmal so lang wie der Strich breit (9), ein Vollkreis hat etwa seinen Radius.
export const SEKUNDE_LAENGE = 5;
export const ECKENRADIUS = 12;
export const SCHLEIFENRADIUS = 28;
export const KREISRADIUS = 35;
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
export function bahn(elemente, drehung = 0) {
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
export function vollenden(roh) {
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

export function seitenverhaeltnis(umriss) {
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
export function fuellungObergrenze(stuecke) {
  const k = kasten(stuecke.flatMap((s) => s.punkte));
  return gesamtlaenge(stuecke) / (k.maxX - k.minX + k.maxY - k.minY);
}
