// Textteil der Stufe 2: jeder Satz muss einem der zehn Muster entsprechen, Kurs und Höhe werden mitgeführt

import { DEUTSCH, ENGLISCH, RATE, HMIN, HMAX, norm, abst, inDir, kursName } from './grundlagen.js';
import { befund } from './befunde.js';

const P = '(Horizontalflug|Steigflug|Sinkflug)';
const PK = '(horizontal|Steigflug|Sinkflug)';
const R = '([A-Z]{1,3})';
const MUSTER = [
  ['absolut', new RegExp(`^Auf Kurs (\\d{3}) drehen, ${P} (\\d+) s\\.$`)],
  ['relativ', new RegExp(`^(Links|Rechts)kurve um (\\d+)°, neuer Kurs (\\d+) s ${P}\\.$`)],
  ['himmelsrichtung', new RegExp(`^(Links|Rechts)kurve auf ${R}, (\\d+) s ${P}\\.$`)],
  ['gradkurs', new RegExp(`^(Links|Rechts) auf (\\d{3})°, (\\d+) s ${P}\\.$`)],
  ['schnellsterR', new RegExp(`^Auf schnellstem Weg ${R}, (\\d+) s (geradeaus|Steigflug|Sinkflug)\\.$`)],
  ['schnellsterG', new RegExp(`^Auf schnellstem Weg nach (\\d{3})°, (\\d+) s (geradeaus|Steigflug|Sinkflug)\\.$`)],
  ['gegenkurs', new RegExp(`^(Links|Rechts) auf den Gegenkurs von ${R}, (\\d+) s ${P}\\.$`)],
  ['vollkreis', new RegExp(`^Vollkreis nach (links|rechts), erste 180° ${PK}, zweite 180° ${PK}\\.$`)],
  ['halbkreis', new RegExp(`^180°-Kurve nach (links|rechts), erst 90° ${PK}, zweite 90° ${PK}, (\\d+) s geradeaus\\.$`)],
  ['hoehe', /^(Links|Rechts) auf (\d{3})°, (\d+) ft (steigen|sinken), nach (\d+) ft (Links|Rechts)kurve auf (\d{3})° einleiten\.$/],
];
const PROFILWORT = { Horizontalflug: 'horizontal', horizontal: 'horizontal', geradeaus: 'horizontal', Steigflug: 'steigen', Sinkflug: 'sinken', steigen: 'steigen', sinken: 'sinken' };
const ZEITEN = [10, 15, 20];

function gradLesen(text, stelle) {
  const g = Number(text);
  if (g > 359) befund('Fehler', 'Textteil', 'Kurs 000 bis 359', stelle, text, '000 bis 359');
  return g;
}
function richtungLesen(name, stelle, teil = 'Textteil') {
  const i = DEUTSCH.indexOf(name);
  if (i < 0) {
    befund('Fehler', teil, 'Himmelsrichtung deutsch', stelle, name, 'eine der 16 deutschen Richtungen');
    const j = ENGLISCH.indexOf(name);
    return j < 0 ? NaN : j * 22.5;
  }
  return i * 22.5;
}

export function textteilPruefen(saetze) {
  let kurs = 90; let hoehe = 2000;
  const profile = [];
  const schablonen = [];
  const verlauf = [];
  if (saetze.length !== 12) befund('Fehler', 'Textteil', '12 Sätze', 'Textteil', `${saetze.length} Sätze`, '12');
  const hoeheSetzen = (neu, stelle) => {
    hoehe = neu;
    if (hoehe < HMIN || hoehe > HMAX) befund('Fehler', 'Textteil', 'Höhe 1000 bis 3000 ft', stelle, `${hoehe} ft`, '1000 bis 3000 ft');
  };
  const profilFliegen = (p, sek, stelle) => {
    profile.push(p);
    if (p === 'steigen') hoeheSetzen(hoehe + RATE * sek, stelle);
    if (p === 'sinken') hoeheSetzen(hoehe - RATE * sek, stelle);
  };
  const zeitPruefen = (sek, stelle) => { if (!ZEITEN.includes(sek)) befund('Fehler', 'Textteil', 'Zeiten 10, 15 oder 20 s', stelle, `${sek} s`, '10, 15 oder 20 s'); };
  const kuerzesterWeg = (ziel, stelle) => {
    const a = abst(kurs, ziel);
    if (a < 20) befund('Fehler', 'Textteil', 'Kurswechsel mindestens 20°', stelle, `${kursName(kurs)} nach ${kursName(ziel)}: ${a}°`, 'mindestens 20°');
    else if (a === 180) befund('Fehler', 'Textteil', 'schnellster Weg eindeutig', stelle, `${kursName(kurs)} nach ${kursName(ziel)}: genau 180°`, 'höchstens 160°');
    else if (a > 160) befund('Unschärfe', 'Textteil', 'schnellster Weg eindeutig', stelle, `${kursName(kurs)} nach ${kursName(ziel)}: ${a}°`, 'höchstens 160°');
  };
  const gerichtet = (richtung, ziel, stelle, von = kurs) => {
    const d = inDir(von, ziel, richtung);
    if (d < 20 || d > 340) befund('Fehler', 'Textteil', 'Drehung in Vorgaberichtung 20 bis 340°', stelle, `${richtung} von ${kursName(von)} auf ${kursName(ziel)}: ${Math.round(d * 10) / 10}°`, '20 bis 340°');
    return d;
  };

  saetze.forEach((satz, i) => {
    const stelle = `Satz ${i + 1}`;
    let art = null; let m = null;
    for (const [name, re] of MUSTER) { m = satz.match(re); if (m) { art = name; break; } }
    if (!art) { befund('Fehler', 'Textteil', 'Satz lesbar', stelle, satz, 'eines der zehn Muster'); schablonen.push('?'); return; }
    schablonen.push(art.replace(/[RG]$/, ''));
    const kursVorher = kurs;
    if (art === 'absolut') {
      const ziel = gradLesen(m[1], stelle); kuerzesterWeg(ziel, stelle);
      zeitPruefen(+m[3], stelle); profilFliegen(PROFILWORT[m[2]], +m[3], stelle); kurs = ziel;
    } else if (art === 'relativ') {
      const w = +m[2];
      if (w < 20 || w > 160) befund('Fehler', 'Textteil', 'relative Kurve 20 bis 160°', stelle, `${w}°`, '20 bis 160°');
      if (!Number.isInteger(kurs)) befund('Hinweis', 'Textteil', 'relative Kurve ab ganzzahligem Kurs', stelle, `ab ${kursName(kurs)}`, 'ganzzahliger Kurs');
      zeitPruefen(+m[3], stelle); profilFliegen(PROFILWORT[m[4]], +m[3], stelle);
      kurs = norm(kurs + (m[1] === 'Rechts' ? w : -w));
    } else if (art === 'himmelsrichtung') {
      const ziel = richtungLesen(m[2], stelle); gerichtet(m[1] === 'Rechts' ? 'rechts' : 'links', ziel, stelle);
      zeitPruefen(+m[3], stelle); profilFliegen(PROFILWORT[m[4]], +m[3], stelle); kurs = ziel;
    } else if (art === 'gradkurs') {
      const ziel = gradLesen(m[2], stelle); gerichtet(m[1] === 'Rechts' ? 'rechts' : 'links', ziel, stelle);
      zeitPruefen(+m[3], stelle); profilFliegen(PROFILWORT[m[4]], +m[3], stelle); kurs = ziel;
    } else if (art === 'schnellsterR' || art === 'schnellsterG') {
      const ziel = art === 'schnellsterR' ? richtungLesen(m[1], stelle) : gradLesen(m[1], stelle);
      kuerzesterWeg(ziel, stelle); zeitPruefen(+m[2], stelle); profilFliegen(PROFILWORT[m[3]], +m[2], stelle); kurs = ziel;
    } else if (art === 'gegenkurs') {
      const ziel = norm(richtungLesen(m[2], stelle) + 180); gerichtet(m[1] === 'Rechts' ? 'rechts' : 'links', ziel, stelle);
      zeitPruefen(+m[3], stelle); profilFliegen(PROFILWORT[m[4]], +m[3], stelle); kurs = ziel;
    } else if (art === 'vollkreis') {
      const [p1, p2] = [PROFILWORT[m[2]], PROFILWORT[m[3]]];
      if (p1 === p2) befund('Unschärfe', 'Textteil', 'Vollkreis: Hälften mit verschiedenem Profil', stelle, `${p1}/${p2}`, 'verschieden');
      profilFliegen(p1, 60, `${stelle}, erste Hälfte`); profilFliegen(p2, 60, `${stelle}, zweite Hälfte`);
    } else if (art === 'halbkreis') {
      const [p1, p2] = [PROFILWORT[m[2]], PROFILWORT[m[3]]];
      if (p1 === p2) befund('Unschärfe', 'Textteil', '180°-Kurve: Viertel mit verschiedenem Profil', stelle, `${p1}/${p2}`, 'verschieden');
      profilFliegen(p1, 30, `${stelle}, erste 90°`); profilFliegen(p2, 30, `${stelle}, zweite 90°`);
      zeitPruefen(+m[4], stelle); profile.push('horizontal');
      kurs = norm(kurs + 180);
    } else if (art === 'hoehe') {
      const r1 = m[1] === 'Rechts' ? 'rechts' : 'links'; const k1 = gradLesen(m[2], stelle);
      const gesamt = +m[3]; const p = m[4]; const einl = +m[5];
      const r2 = m[6] === 'Rechts' ? 'rechts' : 'links'; const k2 = gradLesen(m[7], stelle);
      const dreh1 = gerichtet(r1, k1, `${stelle}, erste Kurve`);
      gerichtet(r2, k2, `${stelle}, zweite Kurve`, k1);
      if (gesamt % 50 || gesamt < 200 || gesamt > 800) befund('Fehler', 'Textteil', 'Höhenangabe 200 bis 800 ft in 50er Schritten', stelle, `${gesamt} ft`, '200 bis 800 ft');
      if (einl % 50 || einl < 100 || einl > gesamt - 100) befund('Fehler', 'Textteil', 'Einleitung 100 ft bis Gesamthöhe minus 100 ft', stelle, `${einl} ft`, `100 bis ${gesamt - 100} ft`);
      profile.push(p);
      hoeheSetzen(hoehe + (p === 'steigen' ? gesamt : -gesamt), stelle);
      // Zeitmodell: Kurve 3°/s und Höhenänderung 8 ft/s beginnen zugleich
      const tKurve = dreh1 / 3; const tEinl = einl / RATE;
      if (tKurve > tEinl + 1e-9) {
        const erreicht = norm(kursVorher + (r1 === 'rechts' ? 1 : -1) * 3 * tEinl);
        const rest = inDir(erreicht, k2, r2);
        const gleich = r1 === r2;
        const kat = rest < 20 || rest > 180 ? 'Unschärfe' : 'Hinweis';
        befund(kat, 'Textteil', 'erster Kurs vor dem Einleitungspunkt erreichbar (3°/s, 8 ft/s)', stelle,
          `${r1} ${Math.round(dreh1)}° brauchen ${Math.round(tKurve)} s, Einleitung nach ${Math.round(tEinl * 10) / 10} s bei Kurs ${kursName(erreicht)}; von dort ${r2} auf ${kursName(k2)}: ${Math.round(rest)}°${gleich ? '' : ', Drehrichtung kehrt um'}`,
          `erste Kurve höchstens ${Math.round(3 * tEinl)}°`);
      }
      kurs = k2;
    }
    verlauf.push({ kurs, hoehe });
  });

  for (const b of ['vollkreis', 'halbkreis', 'hoehe']) {
    const n = schablonen.filter((s) => s === b).length;
    if (n > 1) befund('Fehler', 'Textteil', 'Vollkreis, 180°-Kurve, Höhe mit Einleitung höchstens einmal', 'Textteil', `${b} ${n}-mal`, 'höchstens einmal');
  }
  for (let i = 2; i < schablonen.length; i++) {
    if (schablonen[i] === schablonen[i - 1] && schablonen[i] === schablonen[i - 2]) befund('Fehler', 'Textteil', 'keine Schablone dreimal hintereinander', `Satz ${i - 1} bis ${i + 1}`, schablonen[i], 'höchstens zweimal');
  }
  for (let i = 3; i < profile.length; i++) {
    if (profile.slice(i - 3, i + 1).every((p) => p === profile[i])) befund('Fehler', 'Textteil', 'kein Profil viermal hintereinander', `Profil ${i - 2} bis ${i + 1}`, profile[i], 'höchstens dreimal');
  }
  const zaehl = { horizontal: 0, steigen: 0, sinken: 0 };
  profile.forEach((p) => { zaehl[p] += 1; });
  const werte = Object.values(zaehl);
  if (Math.min(...werte) === 0 || Math.max(...werte) > 2.5 * Math.min(...werte)) befund('Hinweis', 'Textteil', 'Profile etwa gleich verteilt', 'Textteil', JSON.stringify(zaehl), 'etwa gleich');
  const doppelt = saetze.filter((s, i) => saetze.indexOf(s) !== i);
  if (doppelt.length) befund('Hinweis', 'Textteil', 'gleicher Satz mehrfach', 'Textteil', doppelt[0], 'verschiedene Sätze');
  return { kurs, hoehe, profile, schablonen, verlauf };
}

