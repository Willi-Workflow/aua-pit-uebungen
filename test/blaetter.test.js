import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erzeugeBlatt, BLAETTER_JE_STUFE, STUFEN, hatGates } from '../js/blatt.js';

test('Konstanten', () => {
  assert.equal(BLAETTER_JE_STUFE, 100);
  assert.deepEqual(STUFEN, [2, 3]);
});

test('unbekannte Stufe und ungültige Nummern werfen', () => {
  assert.throws(() => erzeugeBlatt(3, 1), /Stufe 3/);
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
});

test('alle 100 Blätter der Stufe 2 entstehen, Gates nur bei Nummern teilbar durch 3, mindestens 90 zulässig', () => {
  const gruppen = { mit: { blaetter: 0, zulaessig: 0 }, ohne: { blaetter: 0, zulaessig: 0 } };
  let kandidatenSumme = 0;
  const start = Date.now();
  for (let nummer = 1; nummer <= BLAETTER_JE_STUFE; nummer++) {
    const blatt = erzeugeBlatt(2, nummer);
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
  const dauer = Date.now() - start;
  const zulaessig = gruppen.mit.zulaessig + gruppen.ohne.zulaessig;
  console.log(`Stufe 2: ${zulaessig} von ${BLAETTER_JE_STUFE} Blättern zulässig, mit Gates ${gruppen.mit.zulaessig} von ${gruppen.mit.blaetter}, ohne Gates ${gruppen.ohne.zulaessig} von ${gruppen.ohne.blaetter}; Siegerkandidat im Mittel Nummer ${kandidatenSumme / BLAETTER_JE_STUFE}, ${dauer} ms, ${dauer / BLAETTER_JE_STUFE} ms je Blatt`);
  assert.equal(gruppen.mit.blaetter, 33);
  assert.ok(zulaessig >= 90, `nur ${zulaessig} von ${BLAETTER_JE_STUFE} zulässig`);
  assert.ok(gruppen.mit.zulaessig >= 27, `nur ${gruppen.mit.zulaessig} von ${gruppen.mit.blaetter} Blättern mit Gates zulässig`);
});
