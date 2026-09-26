import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall, hashZeichenkette, blattSchluessel } from '../js/zufall.js';

test('gleicher Schlüssel, gleiche Folge', () => {
  const a = new Zufall('stufe-2/blatt-7');
  const b = new Zufall('stufe-2/blatt-7');
  const folgeA = Array.from({ length: 20 }, () => a.zahl());
  const folgeB = Array.from({ length: 20 }, () => b.zahl());
  assert.deepEqual(folgeA, folgeB);
});

test('verschiedene Schlüssel, verschiedene Folgen', () => {
  const a = new Zufall('stufe-2/blatt-7');
  const b = new Zufall('stufe-2/blatt-8');
  assert.notEqual(a.zahl(), b.zahl());
});

test('zahl liegt in [0, 1)', () => {
  const z = new Zufall('bereich');
  for (let i = 0; i < 1000; i++) {
    const n = z.zahl();
    assert.ok(n >= 0 && n < 1);
  }
});

test('ganzzahl bleibt im Bereich und erreicht beide Ränder', () => {
  const z = new Zufall('bereich');
  const gesehen = new Set();
  for (let i = 0; i < 1000; i++) {
    const n = z.ganzzahl(3, 6);
    assert.ok(n >= 3 && n <= 6);
    gesehen.add(n);
  }
  assert.deepEqual([...gesehen].sort(), [3, 4, 5, 6]);
});

test('auswahl liefert nur Elemente der Liste', () => {
  const z = new Zufall('auswahl');
  for (let i = 0; i < 100; i++) assert.ok(['a', 'b', 'c'].includes(z.auswahl(['a', 'b', 'c'])));
});

test('wuerfel mit 0 nie, mit 1 immer', () => {
  const z = new Zufall('wuerfel');
  for (let i = 0; i < 50; i++) {
    assert.equal(z.wuerfel(0), false);
    assert.equal(z.wuerfel(1), true);
  }
});

test('gewichteteAuswahl liefert nur vorhandene Werte und bevorzugt hohe Gewichte', () => {
  const z = new Zufall('gewichte');
  let b = 0;
  for (let i = 0; i < 1000; i++) {
    const wert = z.gewichteteAuswahl([{ wert: 'a', gewicht: 1 }, { wert: 'b', gewicht: 9 }]);
    assert.ok(wert === 'a' || wert === 'b');
    if (wert === 'b') b += 1;
  }
  assert.ok(b > 800, `b kam nur ${b} mal`);
});

test('mischen behält alle Elemente und verändert das Original nicht', () => {
  const z = new Zufall('mischen');
  const original = [1, 2, 3, 4, 5, 6, 7, 8];
  const gemischt = z.mischen(original);
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(gemischt.slice().sort((a, b) => a - b), original);
  assert.notDeepEqual(gemischt, original);
});

test('blattSchluessel ist eindeutig je Stufe und Nummer', () => {
  assert.equal(blattSchluessel(2, 7), 'stufe-2/blatt-7');
  assert.notEqual(hashZeichenkette(blattSchluessel(2, 7)), hashZeichenkette(blattSchluessel(3, 7)));
});
