import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { erzeugeBlatt, BLAETTER_JE_STUFE, STUFEN, hatGates } from '../js/blatt.js';
import { differenz } from '../js/kurs.js';
import { STUFE3 } from '../js/elemente.js';
import { beschriftungFrei, kleinsterAbstand, zaehleKreuzungen, startOben, LINIENBREITE_ABSTAND } from '../js/geometrie.js';

// Alle Blätter beider Stufen einmal erzeugen, die Prüfungen unten teilen sie sich
const beginn = Date.now();
const blaetter = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => erzeugeBlatt(2, i + 1));
const dauer = Date.now() - beginn;
// Rechenzeit je Blatt als CPU-Zeit: Die Wanduhr zählt parallel laufende
// Prüfdateien und einen Ruhezustand des Rechners mit
const zeiten3 = [];
const blaetter3 = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => {
  const start = process.cpuUsage();
  const blatt = erzeugeBlatt(3, i + 1);
  const { user, system } = process.cpuUsage(start);
  zeiten3.push((user + system) / 1000);
  return blatt;
});

// Fingerabdruck (SHA-256) des JSON aller 100 Blätter der Stufe 2. Stufe 3 hat
// eigene Zufallsschlüssel und Erzeugungspfade; ändert sich hier etwas, hat eine
// Änderung Stufe 2 mitverändert. Seit dem Bau der Stufe 3 bewusst geändert nur
// durch den Ausschluss der Gate-Zeilen, die genau auf dem Gegenkurs enden: Das
// betraf allein Blatt 51 (vorher 2f4d1e59…1864723).
const STUFE2_FINGERABDRUCK = 'ac5eff849283b6c5355e9620af915aded66c4f2e5b2ca4abace9787f37c2d97c';

test('Konstanten', () => {
  assert.equal(BLAETTER_JE_STUFE, 100);
  assert.deepEqual(STUFEN, [2, 3]);
});

test('Stufe 2 ist Byte für Byte unverändert', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(blaetter)).digest('hex'), STUFE2_FINGERABDRUCK);
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

test('alle 100 Blätter der Stufe 2 entstehen, Gates nur bei Nummern teilbar durch 3, mindestens 90 zulässig', () => {
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
  assert.equal(gruppen.mit.blaetter, 33);
  assert.ok(zulaessig >= 90, `nur ${zulaessig} von ${BLAETTER_JE_STUFE} zulässig`);
  assert.ok(gruppen.mit.zulaessig >= 27, `nur ${gruppen.mit.zulaessig} von ${gruppen.mit.blaetter} Blättern mit Gates zulässig`);
});

test('der Parcours beginnt 20 bis 160 Grad vom Endkurs des Textteils', () => {
  for (const blatt of blaetter) {
    const endkurs = blatt.textteil.zeilen[blatt.textteil.zeilen.length - 1].kursDanach;
    const erstes = blatt.parcours.elemente[0];
    assert.equal(erstes.art, 'segment');
    const a = Math.abs(differenz(endkurs, erstes.kurs));
    assert.ok(a >= 20 && a <= 160, `Blatt ${blatt.nummer}: ${endkurs} auf ${erstes.kurs}, ${a}°`);
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

test('Stufe 3: gleiche Nummer, gleiches Blatt; kein Textteil', () => {
  assert.deepEqual(erzeugeBlatt(3, 7), blaetter3[6]);
  assert.notDeepEqual(blaetter3[6].parcours.elemente, blaetter3[7].parcours.elemente);
  for (const blatt of blaetter3) {
    assert.equal(blatt.stufe, 3);
    assert.equal(blatt.textteil, null);
  }
});

test('Stufe 3: alle 100 Blätter entstehen, mindestens 90 zulässig, jedes unter 500 ms CPU-Zeit', () => {
  const zulaessig = blaetter3.filter((b) => b.parcours.zulaessig).length;
  const mittel = zeiten3.reduce((s, z) => s + z, 0) / zeiten3.length;
  const sortiert = [...zeiten3].sort((a, b) => a - b);
  console.log(`Stufe 3: ${zulaessig} von ${BLAETTER_JE_STUFE} Blättern zulässig; CPU-Zeit je Blatt Median ${sortiert[50].toFixed(0)} ms, Mittel ${mittel.toFixed(0)} ms, höchstens ${sortiert[99].toFixed(0)} ms`);
  assert.ok(zulaessig >= 90, `nur ${zulaessig} zulässig`);
  assert.ok(sortiert[99] < 500, `bis ${sortiert[99]} ms je Blatt`);
  for (const blatt of blaetter3) {
    if (!blatt.parcours.zulaessig) continue;
    const geo = blatt.parcours.geometrie;
    assert.equal(zaehleKreuzungen(geo.stuecke), 0, `Blatt ${blatt.nummer}`);
    assert.ok(kleinsterAbstand(geo.stuecke, 0, geo.flugzeug) >= LINIENBREITE_ABSTAND, `Blatt ${blatt.nummer}`);
    assert.equal(beschriftungFrei(geo), true, `Blatt ${blatt.nummer}`);
    assert.equal(startOben(geo), true, `Blatt ${blatt.nummer}`);
    assert.equal(geo.drehung, 0);
  }
});

test('Stufe 3: Mengen je Blatt, Start und Ende beschriftet, alle Elemente der Vorlagen kommen vor', () => {
  const formen = { a: 0, b: 0, c: 0 };
  const zahlen = { kurve: 0, vollkreis: 0, hr: 0, hrKurs: 0, gk: 0, relativ: 0, anl: 0, anschluss: 0, rechen: 0, himmel: 0 };
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
    bereich(segmente.filter((e) => ['hr', 'hrKurs', 'gk'].includes(e.anzeige)).length, STUFE3.hrgk, 'HR/GK');
    bereich(segmente.filter((e) => e.rechenaufgabe !== null).length, STUFE3.rechenaufgaben, 'Rechenaufgaben');
    bereich(segmente.filter((e) => e.anzeige === 'himmelsrichtung').length, STUFE3.himmelsrichtungen, 'Himmelsrichtungen');
    const texte = geometrie.beschriftungen.map((b) => b.zeilen.join(' | '));
    assert.equal(texte.filter((z) => z === 'Start').length, 1, `Blatt ${blatt.nummer}: Start`);
    assert.equal(texte.filter((z) => z === 'Ende').length, 1, `Blatt ${blatt.nummer}: Ende`);
    let anl = 0;
    for (const e of elemente) {
      if (e.art === 'gate') {
        formen[e.form] += 1;
        if (e.anschluss) zahlen.anschluss += 1;
        anl += e.zeilen.filter((z) => z.kurs.typ.startsWith('anl')).length;
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
