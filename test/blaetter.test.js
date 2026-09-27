import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { erzeugeBlatt, BLAETTER_JE_STUFE, STUFEN, hatGates } from '../js/blatt.js';
import { differenz } from '../js/kurs.js';
import { STUFE2, STUFE3, KURVENRATE } from '../js/elemente.js';
import {
  beschriftungFrei, beschriftungsAbstand, kleinsterAbstand, zaehleKreuzungen, startOben, querstrichAnBeschriftung, eigenerBogenAnBeschriftung,
  LINIENBREITE_ABSTAND,
} from '../js/geometrie.js';
import { druckschrift, DRUCKFLAECHE, zeichneParcours, zeichneVorschau } from '../js/zeichnung.js';
import { DRUCKSCHRIFT_MIN } from '../js/parcours.js';
import { blaetterAbgleichen } from '../werkzeuge/pruefen/loesungen.js';

// Alle Blätter beider Stufen einmal erzeugen, die Prüfungen unten teilen sie sich
// Rechenzeit je Blatt als CPU-Zeit, siehe Stufe 3 unten. Vorab ungemessen ein
// Blatt ohne und eines mit Gates: Sonst fiel die einmalige Übersetzung des
// Gate-Codes auf Blatt 3 (unter Last bis 498 ms statt rund 300)
erzeugeBlatt(2, BLAETTER_JE_STUFE);
erzeugeBlatt(2, 99);
const beginn = Date.now();
const zeiten2 = [];
const blaetter = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => {
  const start = process.cpuUsage();
  const blatt = erzeugeBlatt(2, i + 1);
  const { user, system } = process.cpuUsage(start);
  zeiten2.push((user + system) / 1000);
  return blatt;
});
const dauer = Date.now() - beginn;
// Rechenzeit je Blatt als CPU-Zeit: Die Wanduhr zählt parallel laufende
// Prüfdateien und einen Ruhezustand des Rechners mit. Die CPU-Zeit zählt
// dagegen die Fäden mit, die den Code der Stufe 3 beim ersten Aufruf übersetzen;
// das fiel ganz auf Blatt 1 (allein 320 bis 360 ms statt rund 190, unter Last bis
// 540). Ein Blatt vorab, ungemessen, nimmt diese einmalige Übersetzung heraus.
erzeugeBlatt(3, BLAETTER_JE_STUFE);
const zeiten3 = [];
const blaetter3 = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => {
  const start = process.cpuUsage();
  const blatt = erzeugeBlatt(3, i + 1);
  const { user, system } = process.cpuUsage(start);
  zeiten3.push((user + system) / 1000);
  return blatt;
});

// Fingerabdruck (SHA-256) des JSON der Textteile aller 100 Blätter der Stufe 2.
// Der Parcours der Stufe 2 ist seit den Gradzahl-Kurven neu (bis dahin hatte der
// Fingerabdruck aller Blätter ac5eff84…d97c); der Textteil entsteht vor dem
// Parcours aus demselben Zufallsstrom und bleibt, wie er war.
const STUFE2_TEXTTEILE_FINGERABDRUCK = 'f00cf8950f089e1b4fe68339d35ed23ae8c91986108611c028977cfea0d1ba49';

// Fingerabdruck (SHA-256) aller 200 Blätter: je Blatt, erst Stufe 2, dann Stufe 3,
// das JSON des Textteils, der gezeichnete Parcours und das Vorschaubild. Stand
// 27.09.2026, gemessen vor und nach der Schwierigkeit im Blitzrechnen, die nur
// für Ausschnitte gilt. Ändert sich ein Blatt gewollt, diesen Wert neu setzen
// und die Vorschaubilder neu erzeugen (npm run vorschauen).
const BLAETTER_FINGERABDRUCK = '8bd541da511fb33f07e6aa79de9ac9038f794719788e2ee2f052311feb308590';

test('Konstanten', () => {
  assert.equal(BLAETTER_JE_STUFE, 100);
  assert.deepEqual(STUFEN, [2, 3]);
});

test('Textteile der Stufe 2 sind Byte für Byte unverändert', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(blaetter.map((b) => b.textteil))).digest('hex'), STUFE2_TEXTTEILE_FINGERABDRUCK);
});

test('alle 200 Blätter unverändert: Textteil, Zeichnung und Vorschaubild', () => {
  const h = createHash('sha256');
  for (const b of [...blaetter, ...blaetter3]) h.update(JSON.stringify(b.textteil)).update(zeichneParcours(b.parcours)).update(zeichneVorschau(b.parcours));
  assert.equal(h.digest('hex'), BLAETTER_FINGERABDRUCK);
});

test('unbekannte Stufe und ungültige Nummern werfen', () => {
  assert.throws(() => erzeugeBlatt(4, 1), /Stufe 4/);
  assert.throws(() => erzeugeBlatt(1, 1), /Stufe 1/);
  assert.throws(() => erzeugeBlatt(3, 0), /Blatt 0/);
  assert.throws(() => erzeugeBlatt(2, 0), /Blatt 0/);
  assert.throws(() => erzeugeBlatt(2, 101), /Blatt 101/);
  assert.throws(() => erzeugeBlatt(2, 1.5), /Blatt 1.5/);
});

test('gleiche Nummer, gleiches Blatt; verschiedene Nummern, verschiedene Blätter', () => {
  assert.deepEqual(erzeugeBlatt(2, 7), erzeugeBlatt(2, 7));
  assert.notDeepEqual(erzeugeBlatt(2, 7).textteil, erzeugeBlatt(2, 8).textteil);
});

test('hatGates: Nummer teilbar durch 3', () => {
  assert.equal(hatGates(2, 3), true);
  assert.equal(hatGates(2, 99), true);
  assert.equal(hatGates(2, 1), false);
  assert.equal(hatGates(2, 7), false);
  assert.equal(hatGates(2, 100), false);
  assert.equal(hatGates(3, 1), true);
  assert.equal(hatGates(3, 100), true);
});

test('alle 100 Blätter der Stufe 2 entstehen, Gates nur bei Nummern teilbar durch 3, mindestens 90 zulässig, jedes unter 500 ms CPU-Zeit', () => {
  const gruppen = { mit: { blaetter: 0, zulaessig: 0 }, ohne: { blaetter: 0, zulaessig: 0 } };
  let kandidatenSumme = 0;
  for (const blatt of blaetter) {
    const { nummer } = blatt;
    assert.equal(blatt.stufe, 2);
    assert.equal(blatt.nummer, nummer);
    assert.equal(blatt.textteil.zeilen.length, 12);
    assert.ok(blatt.parcours.elemente.length >= 20);
    const anzahlGates = blatt.parcours.elemente.filter((e) => e.art === 'gate').length;
    if (nummer % 3 === 0) {
      assert.ok(anzahlGates >= 3 && anzahlGates <= 4, `Blatt ${nummer}: ${anzahlGates} Gates`);
    } else {
      assert.equal(anzahlGates, 0, `Blatt ${nummer} hat Gates`);
    }
    const gruppe = hatGates(2, nummer) ? gruppen.mit : gruppen.ohne;
    gruppe.blaetter += 1;
    kandidatenSumme += blatt.parcours.kandidat;
    if (blatt.parcours.zulaessig) gruppe.zulaessig += 1;
  }
  const zulaessig = gruppen.mit.zulaessig + gruppen.ohne.zulaessig;
  console.log(`Stufe 2: ${zulaessig} von ${BLAETTER_JE_STUFE} Blättern zulässig, mit Gates ${gruppen.mit.zulaessig} von ${gruppen.mit.blaetter}, ohne Gates ${gruppen.ohne.zulaessig} von ${gruppen.ohne.blaetter}; Siegerkandidat im Mittel Nummer ${kandidatenSumme / BLAETTER_JE_STUFE}, ${dauer} ms, ${dauer / BLAETTER_JE_STUFE} ms je Blatt`);
  const sortiert = [...zeiten2].sort((a, b) => a - b);
  console.log(`Stufe 2: CPU-Zeit je Blatt Median ${sortiert[50].toFixed(0)} ms, höchstens ${sortiert[99].toFixed(0)} ms (Blatt ${zeiten2.indexOf(sortiert[99]) + 1})`);
  assert.ok(sortiert[99] < 500, `bis ${sortiert[99]} ms je Blatt`);
  assert.equal(gruppen.mit.blaetter, 33);
  assert.ok(zulaessig >= 90, `nur ${zulaessig} von ${BLAETTER_JE_STUFE} zulässig`);
  assert.ok(gruppen.mit.zulaessig >= 27, `nur ${gruppen.mit.zulaessig} von ${gruppen.mit.blaetter} Blättern mit Gates zulässig`);
});

// Wie in PDF und Handzeichnungen ist auf jedem Blatt der Stufe 2 fast jeder
// Kurs auszurechnen: 3 bis 4 relative Ecken und 5 bis 7 Gradzahl-Kurven (auf
// Blättern mit Gates 4 bis 6), zusammen 8 bis 11, dazu 5 bis 7 Rechenaufgaben
// mit Beträgen bis 490. Vorher waren es 3 bis 4 Kursberechnungen und 4 bis 5
// Rechenaufgaben bis 350.
test('Stufe 2: 8 bis 11 Kursberechnungen und 5 bis 7 Rechenaufgaben je Blatt', () => {
  const je = {};
  for (const blatt of blaetter) {
    const { elemente } = blatt.parcours;
    const segmente = elemente.filter((e) => e.art === 'segment');
    const kurven = elemente.filter((e) => e.art === 'kurve').length;
    const relative = segmente.filter((e) => e.relativ !== null).length;
    const rechen = segmente.filter((e) => e.rechenaufgabe !== null);
    const [kmin, kmax] = hatGates(2, blatt.nummer) ? STUFE2.kurvenMitGates : STUFE2.kurven;
    assert.ok(kurven >= kmin && kurven <= kmax, `Blatt ${blatt.nummer}: ${kurven} Kurven`);
    assert.ok(relative >= 3 && relative <= 4, `Blatt ${blatt.nummer}: ${relative} relative Ecken`);
    assert.ok(kurven + relative >= 8 && kurven + relative <= 11, `Blatt ${blatt.nummer}: ${kurven + relative} Kursberechnungen`);
    assert.ok(rechen.length >= 5 && rechen.length <= 7, `Blatt ${blatt.nummer}: ${rechen.length} Rechenaufgaben`);
    assert.ok(rechen.every((e) => Math.abs(e.rechenaufgabe) >= 100 && Math.abs(e.rechenaufgabe) <= 490));
    // Nach jeder Kursberechnung trägt das Segment nur die Zeit
    elemente.forEach((e, k) => {
      if (e.art === 'kurve') assert.equal(elemente[k + 1].anzeige, 'keine', `Blatt ${blatt.nummer}: Segment nach Kurve mit Kurs`);
      if (e.art === 'segment' && e.relativ !== null) assert.equal(e.anzeige, 'keine');
    });
    je[kurven + relative] = (je[kurven + relative] || 0) + 1;
  }
  console.log(`Stufe 2, Kursberechnungen je Blatt: ${JSON.stringify(je)}`);
});

// Im A4-Druck bekommt die Zeichnung 703 × 688 Pixel, auf Gate-Blättern 703 × 652
// (in Chrome gemessen). Vorher lag Blatt 39 bei 5,1 pt; Querstriche liefen auf
// den Blättern 33 und 41 in die erste Ziffer.
test('Stufe 2: Druckschrift mindestens 6 pt, im Median mindestens 7,5 pt, kein Querstrich an einer Beschriftung', () => {
  const pt = blaetter.map((b) => druckschrift(b.parcours.geometrie, hatGates(2, b.nummer) ? DRUCKFLAECHE.hoeheMitGateHinweis : DRUCKFLAECHE.hoehe));
  const sortiert = [...pt].sort((a, b) => a - b);
  console.log(`Stufe 2, Druckschrift: Median ${((sortiert[49] + sortiert[50]) / 2).toFixed(2)} pt, kleinste ${sortiert[0].toFixed(2)} pt (Blatt ${pt.indexOf(sortiert[0]) + 1})`);
  assert.equal(DRUCKSCHRIFT_MIN, 6);
  pt.forEach((wert, i) => assert.ok(wert >= 6, `Blatt ${i + 1}: ${wert.toFixed(2)} pt`));
  assert.ok((sortiert[49] + sortiert[50]) / 2 >= 7.5);
  for (const blatt of blaetter) {
    assert.equal(querstrichAnBeschriftung(blatt.parcours.geometrie), 0, `Blatt ${blatt.nummer}: Querstrich`);
    assert.equal(eigenerBogenAnBeschriftung(blatt.parcours.geometrie), 0, `Blatt ${blatt.nummer}: eigener Bogen`);
  }
});

// Wie im Gegenkursbeispiel nennen rund 70 % der Segmente mit eigenem Kurs den
// Gegenkurs; die Druckschrift bleibt trotz der längeren Angaben mindestens 6 pt,
// im Median wie vorher mindestens 7,4 pt, kein Querstrich berührt eine Beschriftung
test('Stufe 3: Kursangaben als Gegenkurs 65 bis 75 %, je Blatt mindestens 50 %, Druckschrift und Querstriche', () => {
  let gk = 0;
  let mitKurs = 0;
  let kleinster = 1;
  for (const blatt of blaetter3) {
    const eigene = blatt.parcours.elemente.filter((e) => e.art === 'segment' && ['grad', 'himmelsrichtung'].includes(e.anzeige));
    const n = eigene.filter((e) => e.alsGegenkurs).length;
    assert.ok(n >= 0.5 * eigene.length, `Blatt ${blatt.nummer}: ${n} von ${eigene.length}`);
    kleinster = Math.min(kleinster, n / eigene.length);
    gk += n;
    mitKurs += eigene.length;
    // Die Beschriftung nennt den Gegenkurs, der Kurs des Segments ist der tatsächliche
    const texte = blatt.parcours.geometrie.beschriftungen.map((b) => b.zeilen[0]);
    assert.equal(texte.filter((t) => /^GK (\d{3}°|[A-Z]{1,3})\//.test(t)).length, n, `Blatt ${blatt.nummer}: Beschriftungen mit GK-Angabe`);
    assert.equal(querstrichAnBeschriftung(blatt.parcours.geometrie), 0, `Blatt ${blatt.nummer}: Querstrich`);
    // In der Kehre vor "GK/…" lief eine Angabe bis in den eigenen Bogen (Blatt 48 und 95)
    assert.equal(eigenerBogenAnBeschriftung(blatt.parcours.geometrie), 0, `Blatt ${blatt.nummer}: eigener Bogen`);
  }
  const pt = blaetter3.map((b) => druckschrift(b.parcours.geometrie));
  const sortiert = [...pt].sort((a, b) => a - b);
  console.log(`Stufe 3, Angaben als Gegenkurs: ${gk} von ${mitKurs} (${((100 * gk) / mitKurs).toFixed(1)} %), je Blatt mindestens ${(100 * kleinster).toFixed(0)} %; Druckschrift Median ${((sortiert[49] + sortiert[50]) / 2).toFixed(2)} pt, kleinste ${sortiert[0].toFixed(2)} pt`);
  assert.ok(gk / mitKurs >= 0.65 && gk / mitKurs <= 0.75);
  assert.ok(sortiert[0] >= 6 && (sortiert[49] + sortiert[50]) / 2 >= 7.4);
});

test('der Parcours beginnt in beiden Stufen 20 bis 160 Grad vom Endkurs des Textteils', () => {
  for (const blatt of [...blaetter, ...blaetter3]) {
    const endkurs = blatt.textteil.zeilen[blatt.textteil.zeilen.length - 1].kursDanach;
    const erstes = blatt.parcours.elemente[0];
    assert.equal(erstes.art, 'segment');
    const a = Math.abs(differenz(endkurs, erstes.kurs));
    assert.ok(a >= 20 && a <= 160, `Stufe ${blatt.stufe}, Blatt ${blatt.nummer}: ${endkurs} auf ${erstes.kurs}, ${a}°`);
  }
});

// Nach "gedreht wird auf kürzestem Weg" bliebe bei genau 180° die Drehrichtung
// offen (Blatt 51 hatte "-180 ↘ 10"" von 303° auf 123°)
test('Stufe 2: keine relative Gate-Zeile, deren Kurs danach genau der Gegenkurs ist', () => {
  for (const blatt of blaetter) {
    let kurs = null;
    for (const e of blatt.parcours.elemente) {
      if (e.art === 'segment') kurs = e.kurs;
      if (e.art !== 'gate') continue;
      for (const z of e.zeilen) {
        if (z.kurs.typ === 'relativ') {
          const a = Math.abs(differenz(kurs, z.kursDanach));
          assert.notEqual(a, 180, `Blatt ${blatt.nummer}: ${kurs} ${z.kurs.wert} = ${z.kursDanach}`);
        }
        kurs = z.kursDanach;
      }
    }
  }
});

test('Stufe 3: gleiche Nummer, gleiches Blatt; Textteil wie Stufe 2 mit zwölf Sätzen ab 090°, 2000 ft', () => {
  assert.deepEqual(erzeugeBlatt(3, 7), blaetter3[6]);
  assert.notDeepEqual(blaetter3[6].parcours.elemente, blaetter3[7].parcours.elemente);
  assert.notDeepEqual(blaetter3[6].textteil, blaetter3[7].textteil);
  for (const blatt of blaetter3) {
    assert.equal(blatt.stufe, 3);
    assert.equal(blatt.textteil.ausgangskurs, 90);
    assert.equal(blatt.textteil.ausgangshoehe, 2000);
    assert.equal(blatt.textteil.zeilen.length, 12);
    assert.ok(blatt.textteil.zeilen.every((z) => typeof z.satz === 'string' && z.satz.length > 0));
  }
});

// Höhen im Parcours der Stufe 3 in Flugreihenfolge ab "hoehe": Segmente,
// Kreishälften (60 s), Kurven (Winkel / 3 s) und Gate-Zeilen, 8 ft je Sekunde
function hoehenStufe3(elemente, hoehe) {
  const verlauf = [];
  const fliegen = (profil, sekunden) => {
    if (profil === 'steigen') hoehe += 8 * sekunden;
    if (profil === 'sinken') hoehe -= 8 * sekunden;
    verlauf.push(hoehe);
  };
  for (const e of elemente) {
    if (e.art === 'segment') fliegen(e.profil, e.dauer);
    else if (e.art === 'vollkreis') e.profile.forEach((p) => fliegen(p, 60));
    else if (e.art === 'kurve') fliegen(e.profil, e.winkel / KURVENRATE);
    else e.zeilen.forEach((z) => fliegen(z.profil, z.dauer));
  }
  return verlauf;
}

test('Stufe 3: Höhe im Parcours ab dem Ende des Textteils zwischen 1000 und 3000 ft', () => {
  const anfaenge = new Set();
  for (const blatt of blaetter3) {
    const ende = blatt.textteil.zeilen[blatt.textteil.zeilen.length - 1].hoeheDanach;
    anfaenge.add(ende);
    const verlauf = hoehenStufe3(blatt.parcours.elemente, ende);
    assert.ok(verlauf.every((h) => h >= 1000 - 1e-9 && h <= 3000 + 1e-9), `Blatt ${blatt.nummer}: ${Math.min(...verlauf)} bis ${Math.max(...verlauf)} ft`);
  }
  assert.ok(anfaenge.size > 5, 'der Parcours beginnt nicht immer auf derselben Höhe');
});

test('Stufe 3: alle 100 Blätter entstehen, mindestens 90 zulässig, jedes unter 500 ms CPU-Zeit', () => {
  const zulaessig = blaetter3.filter((b) => b.parcours.zulaessig).length;
  const mittel = zeiten3.reduce((s, z) => s + z, 0) / zeiten3.length;
  const sortiert = [...zeiten3].sort((a, b) => a - b);
  console.log(`Stufe 3: ${zulaessig} von ${BLAETTER_JE_STUFE} Blättern zulässig; CPU-Zeit je Blatt Median ${sortiert[50].toFixed(0)} ms, Mittel ${mittel.toFixed(0)} ms, höchstens ${sortiert[99].toFixed(0)} ms (Blatt ${zeiten3.indexOf(sortiert[99]) + 1})`);
  assert.ok(zulaessig >= 90, `nur ${zulaessig} zulässig`);
  assert.ok(sortiert[99] < 500, `bis ${sortiert[99]} ms je Blatt`);
  for (const blatt of blaetter3) {
    if (!blatt.parcours.zulaessig) continue;
    const geo = blatt.parcours.geometrie;
    assert.equal(zaehleKreuzungen(geo.stuecke, Infinity, true), 0, `Blatt ${blatt.nummer}`);
    assert.ok(kleinsterAbstand(geo.stuecke, 0, geo.flugzeug, true) >= LINIENBREITE_ABSTAND, `Blatt ${blatt.nummer}`);
    assert.equal(beschriftungFrei(geo), true, `Blatt ${blatt.nummer}`);
    assert.equal(startOben(geo), true, `Blatt ${blatt.nummer}`);
    assert.equal(geo.drehung, 0);
  }
});

// Ein- und Ausfahrt einer Schleife (Strecke, Bogen über 180°, Strecke): Kreuzung
// und ihr Abstand zu den äußeren Enden (Anfang der Einfahrt, Ende der Ausfahrt),
// ohne Kreuzung der kleinste Abstand der Mittellinien
function schleifenLage(ein, aus) {
  const [p, q] = ein.punkte;
  const [r, s] = aus.punkte;
  const d1 = { x: q.x - p.x, y: q.y - p.y };
  const d2 = { x: s.x - r.x, y: s.y - r.y };
  const kreuz = (a, b) => a.x * b.y - a.y * b.x;
  const nenner = kreuz(d1, d2);
  const w = { x: r.x - p.x, y: r.y - p.y };
  const t = nenner === 0 ? -1 : kreuz(w, d2) / nenner;
  const u = nenner === 0 ? -1 : kreuz(w, d1) / nenner;
  if (t > 0 && t < 1 && u > 0 && u < 1) {
    return { kreuzung: true, vorEnden: Math.min(t * Math.hypot(d1.x, d1.y), (1 - u) * Math.hypot(d2.x, d2.y)) };
  }
  const punktStrecke = (x, a, b) => {
    const v = { x: b.x - a.x, y: b.y - a.y };
    const k = Math.max(0, Math.min(1, ((x.x - a.x) * v.x + (x.y - a.y) * v.y) / (v.x * v.x + v.y * v.y)));
    return Math.hypot(x.x - a.x - k * v.x, x.y - a.y - k * v.y);
  };
  return { kreuzung: false, abstand: Math.min(punktStrecke(p, r, s), punktStrecke(q, r, s), punktStrecke(r, p, q), punktStrecke(s, p, q)) };
}

test('Stufe 3: Schleifen kreuzen Ein- und Ausfahrt sauber, kein Segment endet im Strich einer Einfahrt', () => {
  let sauber = 0;
  for (const blatt of blaetter3) {
    const { stuecke } = blatt.parcours.geometrie;
    for (let i = 0; i + 2 < stuecke.length; i++) {
      if (stuecke[i].art !== 'strecke' || !stuecke[i + 1].schleife || stuecke[i + 2].art !== 'strecke') continue;
      const lage = schleifenLage(stuecke[i], stuecke[i + 2]);
      if (lage.kreuzung) {
        assert.ok(lage.vorEnden >= LINIENBREITE_ABSTAND, `Blatt ${blatt.nummer}, Stück ${i + 1}: Kreuzung ${lage.vorEnden.toFixed(1)} vor einem Ende`);
        sauber += 1;
      } else {
        assert.ok(lage.abstand >= LINIENBREITE_ABSTAND, `Blatt ${blatt.nummer}, Stück ${i + 1}: Ausfahrt ${lage.abstand.toFixed(1)} neben der Einfahrt`);
      }
    }
  }
  // Mit 18 bis 21 Segmenten (vorher bis 24) gibt es weniger Schleifen
  assert.ok(sauber > 80, `nur ${sauber} Schleifen mit Kreuzung`);
});

// Jede Beschriftung an einem Segment, einer Ecke oder einer Kurve steht ihrem
// eigenen Stück deutlich näher als jedem fremden, dem man sie zuordnen könnte:
// Das nächste ist mindestens 1,5-mal so weit weg (Achse der Kapsel zur
// Mittellinie). Eigen sind das beschriftete Stück und die angrenzenden seiner
// Figur. Mitbewerber einer Bogenangabe sind alle fremden Bögen außer
// Vollkreishälften (Vollkreise tragen nie eine Angabe), einer Segmentbeschriftung
// alle fremden Strecken, die höchstens 20° gegen die eigene geneigt sind. Vorher
// standen Bogenangaben näher an fremden Bögen (Blatt 2, 51, 63, 74) und
// Segmentbeschriftungen zwischen parallelen Strecken (Blatt 56, 97).
function mitbewerber(eigenes, fremd) {
  if (fremd.art !== eigenes.art) return false;
  if (fremd.art === 'bogen') return !(fremd.kreis && !fremd.schleife && !fremd.kurve);
  const richtung = (s) => Math.atan2(s.punkte[1].y - s.punkte[0].y, s.punkte[1].x - s.punkte[0].x);
  const neigung = Math.abs(Math.sin(richtung(eigenes) - richtung(fremd)));
  return neigung <= Math.sin((20 * Math.PI) / 180) + 1e-9;
}

test('Stufe 3: Beschriftungen stehen ihrem Stück deutlich näher als jedem fremden', () => {
  let geprueft = 0;
  for (const blatt of blaetter3) {
    if (!blatt.parcours.zulaessig) continue;
    const { stuecke, beschriftungen } = blatt.parcours.geometrie;
    for (const b of beschriftungen) {
      if (b.gate || b.fett) continue;
      const art = b.zeilen[0].includes('/') ? 'strecke' : 'bogen';
      const eigenes = b.eigeneStuecke.find((i) => stuecke[i].art === art);
      const eigen = beschriftungsAbstand(b, stuecke[eigenes].punkte);
      let fremd = Infinity;
      stuecke.forEach((s, i) => {
        if (!b.eigeneStuecke.includes(i) && mitbewerber(stuecke[eigenes], s)) fremd = Math.min(fremd, beschriftungsAbstand(b, s.punkte));
      });
      assert.ok(fremd >= 1.5 * eigen, `Blatt ${blatt.nummer}, ${b.zeilen.join(' | ')}: eigen ${eigen.toFixed(1)}, fremd ${fremd.toFixed(1)}`);
      geprueft += 1;
    }
  }
  assert.ok(geprueft > 2200, `nur ${geprueft} Beschriftungen`);
});

// "Start" gehört sichtbar zum Flugzeugsymbol, "Ende" zum Ende des Wegs: Der
// eigene Punkt ist mindestens 1,5-mal näher als der andere (Achse der
// Beschriftung zum Punkt). Auf Blatt 92 stand einmal "Start 2000 ft" direkt unter "Ende".
test('Stufe 3: Start und Ende stehen deutlich näher an ihrem eigenen Punkt als am anderen', () => {
  for (const blatt of blaetter3) {
    const { beschriftungen, flugzeug, marken } = blatt.parcours.geometrie;
    const ende = marken[marken.length - 1].punkt;
    const punkt = (p) => [p, p];
    for (const b of beschriftungen.filter((x) => x.fett)) {
      const [eigen, fremd] = b.zeilen[0] === 'Ende' ? [ende, flugzeug.mitte] : [flugzeug.mitte, ende];
      const de = beschriftungsAbstand(b, punkt(eigen));
      const df = beschriftungsAbstand(b, punkt(fremd));
      assert.ok(df >= 1.5 * de, `Blatt ${blatt.nummer}, ${b.zeilen[0]}: eigen ${de.toFixed(1)}, fremd ${df.toFixed(1)}`);
    }
  }
});

test('Stufe 3: Mengen je Blatt, Start und Ende beschriftet, alle Elemente der Vorlagen kommen vor', () => {
  const formen = { a: 0, b: 0, c: 0 };
  const zahlen = { kurve: 0, vollkreis: 0, hr: 0, hrKurs: 0, gk: 0, gkZeileA: 0, gkZeileC: 0, relativ: 0, anl: 0, anschluss: 0, rechen: 0, himmel: 0 };
  let blaetterMitAnl = 0;
  for (const blatt of blaetter3) {
    const { elemente, geometrie } = blatt.parcours;
    const segmente = elemente.filter((e) => e.art === 'segment');
    const n = (art) => elemente.filter((e) => e.art === art).length;
    const bereich = (wert, [von, bis], name) => assert.ok(wert >= von && wert <= bis, `Blatt ${blatt.nummer}: ${wert} ${name}`);
    bereich(segmente.length, STUFE3.segmente, 'Segmente');
    bereich(n('vollkreis'), STUFE3.vollkreise, 'Vollkreise');
    bereich(n('kurve'), STUFE3.kurven, 'Kurven');
    bereich(n('gate'), STUFE3.gates, 'Gates');
    bereich(segmente.filter((e) => e.relativ !== null).length, STUFE3.relative, 'relative Ecken');
    bereich(segmente.filter((e) => ['hr', 'hrKurs'].includes(e.anzeige)).length, STUFE3.hr, 'HR');
    bereich(segmente.filter((e) => e.anzeige === 'gk').length, STUFE3.gkSegmente, 'GK-Segmente');
    bereich(segmente.filter((e) => e.rechenaufgabe !== null).length, STUFE3.rechenaufgaben, 'Rechenaufgaben');
    bereich(segmente.filter((e) => e.anzeige === 'himmelsrichtung').length, STUFE3.himmelsrichtungen, 'Himmelsrichtungen');
    const texte = geometrie.beschriftungen.map((b) => b.zeilen.join(' | '));
    // Nur "Start": Die Höhe kommt vom Ende des Textteils
    assert.equal(texte.filter((z) => z === 'Start').length, 1, `Blatt ${blatt.nummer}: Start`);
    assert.ok(!texte.some((z) => z.includes('2000 ft')), `Blatt ${blatt.nummer}: Höhe am Start`);
    assert.equal(texte.filter((z) => z === 'Ende').length, 1, `Blatt ${blatt.nummer}: Ende`);
    let anl = 0;
    for (const e of elemente) {
      if (e.art === 'gate') {
        formen[e.form] += 1;
        if (e.anschluss) zahlen.anschluss += 1;
        anl += e.zeilen.filter((z) => z.kurs.typ.startsWith('anl')).length;
        const gk = e.zeilen.filter((z) => z.kurs.typ === 'gk' || z.kurs.typ === 'gkPlus').length;
        if (e.form === 'a') zahlen.gkZeileA += gk;
        if (e.form === 'c') zahlen.gkZeileC += gk;
      } else if (e.art === 'kurve') zahlen.kurve += 1;
      else if (e.art === 'vollkreis') zahlen.vollkreis += 1;
      else {
        if (['hr', 'hrKurs', 'gk'].includes(e.anzeige)) zahlen[e.anzeige] += 1;
        if (e.relativ !== null) zahlen.relativ += 1;
        if (e.rechenaufgabe !== null) zahlen.rechen += 1;
        if (e.anzeige === 'himmelsrichtung') zahlen.himmel += 1;
      }
    }
    assert.ok(anl <= 1, `Blatt ${blatt.nummer}: ${anl} Zeilen anl. Kurs`);
    if (anl) blaetterMitAnl += 1;
  }
  zahlen.anl = blaetterMitAnl;
  console.log(`Stufe 3, 100 Blätter: Gate-Formen ${JSON.stringify(formen)}, Elemente ${JSON.stringify(zahlen)}`);
  const summe = formen.a + formen.b + formen.c;
  for (const f of ['a', 'b', 'c']) assert.ok(formen[f] / summe > 0.25 && formen[f] / summe < 0.42, JSON.stringify(formen));
  for (const [name, zahl] of Object.entries(zahlen)) assert.ok(zahl > 0, `${name} kommt auf keinem Blatt vor`);
  assert.equal(zahlen.anschluss, formen.a, 'jedes Gate der Form A hat eine Anschlusszeile');
  assert.ok(blaetterMitAnl < 60, `anl. Kurs auf ${blaetterMitAnl} Blättern, soll selten sein`);
});

// Gegenkurs wie in der Handzeichnung drei- bis fünfmal je Blatt: 1 bis 2
// Segmente "GK/…", nie zwei direkt hintereinander, und 2 bis 3 Gate-Zeilen "GK"
// oder "GK ± n"; jedes Gate der Form C mit mindestens einer, Form A mit
// höchstens einer, Form B ohne. Vorher hatten 21 von 100 Blättern kein GK.
test('Stufe 3: Gegenkurs mindestens dreimal je Blatt, meist vier- bis fünfmal', () => {
  const jeBlatt = {};
  const summe = { segmente: 0, zeilen: 0 };
  for (const blatt of blaetter3) {
    const { elemente } = blatt.parcours;
    const segmente = elemente.filter((e) => e.art === 'segment');
    const gkSegmente = segmente.filter((e) => e.anzeige === 'gk').length;
    segmente.forEach((e, j) => {
      if (j > 0 && e.anzeige === 'gk') assert.notEqual(segmente[j - 1].anzeige, 'gk', `Blatt ${blatt.nummer}: zwei GK-Segmente hintereinander`);
    });
    let gkZeilen = 0;
    for (const e of elemente) {
      if (e.art !== 'gate') continue;
      const n = e.zeilen.filter((z) => z.kurs.typ === 'gk' || z.kurs.typ === 'gkPlus').length;
      if (e.form === 'c') assert.ok(n >= 1, `Blatt ${blatt.nummer}: Form C ohne GK`);
      if (e.form === 'a') assert.ok(n <= 1, `Blatt ${blatt.nummer}: Form A mit ${n} GK`);
      if (e.form === 'b') assert.equal(n, 0, `Blatt ${blatt.nummer}: Form B mit GK`);
      gkZeilen += n;
    }
    assert.ok(gkSegmente >= STUFE3.gkSegmente[0] && gkSegmente <= STUFE3.gkSegmente[1], `Blatt ${blatt.nummer}: ${gkSegmente} GK-Segmente`);
    assert.ok(gkZeilen >= STUFE3.gkZeilen[0] && gkZeilen <= STUFE3.gkZeilen[1], `Blatt ${blatt.nummer}: ${gkZeilen} GK-Zeilen`);
    assert.ok(gkSegmente + gkZeilen >= 3, `Blatt ${blatt.nummer}: nur ${gkSegmente + gkZeilen} GK`);
    jeBlatt[gkSegmente + gkZeilen] = (jeBlatt[gkSegmente + gkZeilen] || 0) + 1;
    summe.segmente += gkSegmente;
    summe.zeilen += gkZeilen;
  }
  console.log(`Stufe 3, GK je Blatt: ${JSON.stringify(jeBlatt)}; ${summe.segmente} Segmente, ${summe.zeilen} Gate-Zeilen`);
  // "meist 4 bis 5"
  assert.ok((jeBlatt[4] || 0) + (jeBlatt[5] || 0) >= 60, JSON.stringify(jeBlatt));
});

// Übungsmodus: Jede Lösung aller 200 Blätter wie nachgerechnet. Das
// Prüfwerkzeug rechnet jedes Blatt nur aus Sätzen und gedrucktem SVG nach;
// Anzahl, Art, Wert und Reihenfolge der Rechenstellen müssen dazu passen, jede
// Lösung steht dicht an ihrer Beschriftung, lässt die eigene frei und bleibt im
// Zeichenfeld (werkzeuge/pruefen/loesungen.js). Hier, weil die Blätter schon
// erzeugt sind: Eine zweite Erzeugung in einer eigenen Prüfdatei lief parallel
// und hob die CPU-Zeit je Blatt oben über 500 ms.
for (const [stufe, liste] of [[2, blaetter], [3, blaetter3]]) {
  test(`Übungsmodus Stufe ${stufe}: Lösungen aller 100 Blätter wie nachgerechnet, in Parcours-Reihenfolge an ihrer Beschriftung`, () => {
    const e = blaetterAbgleichen(liste);
    console.log(`Übungsmodus Stufe ${stufe}: ${e.stellen} Rechenstellen, im Mittel ${(e.stellen / BLAETTER_JE_STUFE).toFixed(1)} je Blatt; ${e.links} links, ${e.aussen} als Zeile außen; ${e.fremd} berühren fremde Beschriftungen, Kästen oder Lösungen (auf ${e.blaetterFremd} Blättern)`);
    assert.deepEqual(e.fehler.slice(0, 10), [], `${e.fehler.length} Abweichungen`);
    // Fremdes zu berühren ist im Übungsmodus hinnehmbar, soll aber selten bleiben
    assert.ok(e.fremd <= 0.03 * e.stellen, `${e.fremd} von ${e.stellen} Lösungen berühren Fremdes`);
  });
}
