// Textteil der Stufe 2: zwölf Anweisungen aus Satzschablonen.
// Die Erzeugung führt den Flugzustand (Kurs, Höhe) mit, damit Gegenkurs,
// schnellster Weg und Höhenangaben immer zum vorherigen Satz passen.

import {
  normieren, gegenkurs, differenz, kursText, istGanzzahl,
  himmelsrichtungGrad, himmelsrichtungName, SCHREIBWEISE,
} from './kurs.js';

export const AUSGANGSKURS = 90;
export const AUSGANGSHOEHE = 2000;
export const ZEILEN = 12;
export const HOEHE_MIN = 1000;
export const HOEHE_MAX = 3000;

const STEIGRATE = 8; // ft je Sekunde, entspricht rund 500 ft/min
const ZEITEN = [10, 15, 20];
const KREISHAELFTE = 60; // Sekunden je 180° bei Standardkurve
const PROFILE = ['horizontal', 'steigen', 'sinken'];
const PROFILWORT = { horizontal: 'Horizontalflug', steigen: 'Steigflug', sinken: 'Sinkflug' };
const KREISWORT = { horizontal: 'horizontal', steigen: 'Steigflug', sinken: 'Sinkflug' };
const KURVE = { links: 'Linkskurve', rechts: 'Rechtskurve' };
const SEITE = { links: 'Links', rechts: 'Rechts' };
const RICHTUNGEN = ['links', 'rechts'];

// Diese drei kommen höchstens einmal je Blatt vor, die übrigen füllen den Rest.
const BESONDERE = ['vollkreis', 'halbkreis', 'hoehe'];
const GEWOEHNLICHE = ['absolut', 'relativ', 'himmelsrichtung', 'gradkurs', 'schnellster', 'gegenkurs'];

function abstand(von, nach) {
  return Math.abs(differenz(von, nach));
}

// Ganzzahliger Kurs, dessen kürzester Abstand zum Ausgangskurs im Bereich liegt
function zielGrad(k, min, max, ausgangskurs = k.zustand.kurs) {
  for (;;) {
    const kurs = k.zufall.ganzzahl(0, 359);
    const a = abstand(ausgangskurs, kurs);
    if (a >= min && a <= max) return kurs;
  }
}

// Index einer Himmelsrichtung, deren Kurs weit genug vom aktuellen entfernt liegt
function zielHimmelsrichtung(k, min, max) {
  for (;;) {
    const index = k.zufall.ganzzahl(0, 15);
    const a = abstand(k.zustand.kurs, himmelsrichtungGrad(index));
    if (a >= min && a <= max) return index;
  }
}

function richtungsname(index) {
  return himmelsrichtungName(index, SCHREIBWEISE.textteil);
}

// Wählt ein Profil, das die Höhe im Rahmen hält und nicht viermal hintereinander
// gleich ist, gleicht die Bilanz aus und schreibt Höhe und Verlauf fort.
function profilAnwenden(k, sekunden, erlaubteProfile = PROFILE) {
  const letzte = k.profile.slice(-3);
  const erlaubt = erlaubteProfile.filter((p) => {
    if (letzte.length === 3 && letzte.every((v) => v === p)) return false;
    if (p === 'steigen') return k.zustand.hoehe + STEIGRATE * sekunden <= HOEHE_MAX;
    if (p === 'sinken') return k.zustand.hoehe - STEIGRATE * sekunden >= HOEHE_MIN;
    return true;
  });
  const profil = k.zufall.gewichteteAuswahl(erlaubt.map((p) => ({ wert: p, gewicht: Math.max(1, 5 - k.bilanz[p]) })));
  if (profil === 'steigen') k.zustand.hoehe += STEIGRATE * sekunden;
  if (profil === 'sinken') k.zustand.hoehe -= STEIGRATE * sekunden;
  k.profile.push(profil);
  k.bilanz[profil] += 1;
  return profil;
}

function horizontalAnwenden(k) {
  k.profile.push('horizontal');
  k.bilanz.horizontal += 1;
}

// Richtungen, in die eine Höhenänderung von mindestens 200 ft möglich ist,
// ohne die Grenzen zu verlassen und ohne viermal dasselbe Profil
function hoehenRichtungen(k) {
  const letzte = k.profile.slice(-3);
  return ['steigen', 'sinken'].filter((p) => {
    if (letzte.length === 3 && letzte.every((v) => v === p)) return false;
    const spielraum = p === 'steigen' ? HOEHE_MAX - k.zustand.hoehe : k.zustand.hoehe - HOEHE_MIN;
    return spielraum >= 200;
  });
}

const SCHABLONEN = {
  absolut: {
    anwendbar: () => true,
    erzeugen(k) {
      // Höchstens 160°, sonst wäre die Drehrichtung offen
      const kurs = zielGrad(k, 20, 160);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = kurs;
      return `Auf Kurs ${kursText(kurs)} drehen, ${PROFILWORT[profil]} ${sekunden} s.`;
    },
  },
  relativ: {
    // Nur bei ganzzahligem Kurs, sonst entstünden halbe Grade im Ergebnis
    anwendbar: (k) => istGanzzahl(k.zustand.kurs),
    erzeugen(k) {
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const winkel = k.zufall.ganzzahl(20, 160);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = normieren(k.zustand.kurs + (richtung === 'rechts' ? winkel : -winkel));
      return `${KURVE[richtung]} um ${winkel}°, neuer Kurs ${sekunden} s ${PROFILWORT[profil]}.`;
    },
  },
  himmelsrichtung: {
    anwendbar: () => true,
    erzeugen(k) {
      const index = zielHimmelsrichtung(k, 20, 180);
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = himmelsrichtungGrad(index);
      return `${KURVE[richtung]} auf ${richtungsname(index)}, ${sekunden} s ${PROFILWORT[profil]}.`;
    },
  },
  gradkurs: {
    anwendbar: () => true,
    erzeugen(k) {
      const kurs = zielGrad(k, 20, 180);
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = kurs;
      return `${SEITE[richtung]} auf ${kursText(kurs)}°, ${sekunden} s ${PROFILWORT[profil]}.`;
    },
  },
  schnellster: {
    anwendbar: () => true,
    erzeugen(k) {
      // Höchstens 160°, damit der schnellste Weg eindeutig ist
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      const wort = profil === 'horizontal' ? 'geradeaus' : PROFILWORT[profil];
      if (k.zufall.wuerfel(0.5)) {
        const index = zielHimmelsrichtung(k, 20, 160);
        k.zustand.kurs = himmelsrichtungGrad(index);
        return `Auf schnellstem Weg ${richtungsname(index)}, ${sekunden} s ${wort}.`;
      }
      const kurs = zielGrad(k, 20, 160);
      k.zustand.kurs = kurs;
      return `Auf schnellstem Weg nach ${kursText(kurs)}°, ${sekunden} s ${wort}.`;
    },
  },
  gegenkurs: {
    anwendbar: () => true,
    erzeugen(k) {
      // Genannt wird eine Himmelsrichtung, geflogen wird ihr Gegenkurs
      let index;
      for (;;) {
        index = k.zufall.ganzzahl(0, 15);
        if (abstand(k.zustand.kurs, gegenkurs(himmelsrichtungGrad(index))) >= 20) break;
      }
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = gegenkurs(himmelsrichtungGrad(index));
      return `${SEITE[richtung]} auf den Gegenkurs von ${richtungsname(index)}, ${sekunden} s ${PROFILWORT[profil]}.`;
    },
  },
  vollkreis: {
    anwendbar: () => true,
    erzeugen(k) {
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const erste = profilAnwenden(k, KREISHAELFTE);
      // Die zweite Hälfte wechselt das Profil, sonst wäre die Marke bei 180° ohne Aufgabe
      const zweite = profilAnwenden(k, KREISHAELFTE, PROFILE.filter((p) => p !== erste));
      return `Vollkreis nach ${richtung}, erste 180° ${KREISWORT[erste]}, zweite 180° ${KREISWORT[zweite]}.`;
    },
  },
  halbkreis: {
    anwendbar: () => true,
    erzeugen(k) {
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const erste = profilAnwenden(k, KREISHAELFTE / 2);
      // Die zweite Hälfte wechselt das Profil. Außerdem ist das Geradeausstück danach
      // horizontal; damit daraus nicht vier gleiche Profile werden, darf die zweite
      // Hälfte nach zwei horizontalen nicht horizontal sein.
      const andere = PROFILE.filter((p) => p !== erste);
      const letzteZwei = k.profile.slice(-2);
      const ohneVierHorizontale = letzteZwei.length === 2 && letzteZwei.every((p) => p === 'horizontal') ? ['steigen', 'sinken'] : PROFILE;
      const beides = andere.filter((p) => ohneVierHorizontale.includes(p));
      const zweite = profilAnwenden(k, KREISHAELFTE / 2, beides.length > 0 ? beides : andere);
      const sekunden = k.zufall.auswahl(ZEITEN);
      horizontalAnwenden(k);
      k.zustand.kurs = gegenkurs(k.zustand.kurs);
      return `180°-Kurve nach ${richtung}, erst 90° ${KREISWORT[erste]}, zweite 90° ${KREISWORT[zweite]}, ${sekunden} s geradeaus.`;
    },
  },
  hoehe: {
    anwendbar: (k) => hoehenRichtungen(k).length > 0,
    erzeugen(k) {
      const profil = k.zufall.auswahl(hoehenRichtungen(k));
      const spielraum = profil === 'steigen' ? HOEHE_MAX - k.zustand.hoehe : k.zustand.hoehe - HOEHE_MIN;
      const hoechstens = Math.min(800, Math.floor(spielraum / 50) * 50);
      const gesamt = 50 * k.zufall.ganzzahl(4, hoechstens / 50); // 200 bis hoechstens
      const einleitung = 50 * k.zufall.ganzzahl(2, gesamt / 50 - 2); // 100 bis gesamt - 100
      const kurs1 = zielGrad(k, 20, 180);
      const kurs2 = zielGrad(k, 20, 180, kurs1);
      const seite = k.zufall.auswahl(RICHTUNGEN);
      const kurve = k.zufall.auswahl(RICHTUNGEN);
      k.zustand.hoehe += profil === 'steigen' ? gesamt : -gesamt;
      k.profile.push(profil);
      k.bilanz[profil] += 1;
      k.zustand.kurs = kurs2;
      return `${SEITE[seite]} auf ${kursText(kurs1)}°, ${gesamt} ft ${profil}, nach ${einleitung} ft ${KURVE[kurve]} auf ${kursText(kurs2)}° einleiten.`;
    },
  },
};

// Gewöhnliche Schablone, die anwendbar ist und nicht zum dritten Mal in Folge käme
function gewoehnlicheWaehlen(k, bisher) {
  const [vorletzte, letzte] = bisher.slice(-2);
  for (;;) {
    const schablonenName = k.zufall.auswahl(GEWOEHNLICHE);
    if (schablonenName === letzte && schablonenName === vorletzte) continue;
    if (!SCHABLONEN[schablonenName].anwendbar(k)) continue;
    return schablonenName;
  }
}

export function erzeugeTextteil(zufall) {
  const k = {
    zufall,
    zustand: { kurs: AUSGANGSKURS, hoehe: AUSGANGSHOEHE },
    profile: [],
    bilanz: { horizontal: 0, steigen: 0, sinken: 0 },
  };

  // Besondere Schablonen vorab auf freie Zeilen verteilen, jede mit 75 Prozent
  const vorgaben = new Array(ZEILEN).fill(null);
  for (const besondere of BESONDERE) {
    if (!zufall.wuerfel(0.75)) continue;
    const freie = vorgaben.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
    vorgaben[zufall.auswahl(freie)] = besondere;
  }

  const zeilen = [];
  const namen = [];
  for (let i = 0; i < ZEILEN; i++) {
    let schablonenName = vorgaben[i];
    if (schablonenName === null || !SCHABLONEN[schablonenName].anwendbar(k)) {
      schablonenName = gewoehnlicheWaehlen(k, namen);
    }
    const kursVorher = k.zustand.kurs;
    const hoeheVorher = k.zustand.hoehe;
    const satz = SCHABLONEN[schablonenName].erzeugen(k);
    namen.push(schablonenName);
    zeilen.push({
      schablone: schablonenName,
      satz,
      kursVorher,
      hoeheVorher,
      kursDanach: k.zustand.kurs,
      hoeheDanach: k.zustand.hoehe,
    });
  }

  return { ausgangskurs: AUSGANGSKURS, ausgangshoehe: AUSGANGSHOEHE, profile: k.profile, zeilen };
}
