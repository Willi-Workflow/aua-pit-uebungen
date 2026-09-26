import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normieren, gegenkurs, differenz, drehung, istGanzzahl, kursText,
  himmelsrichtungGrad, himmelsrichtungName, HIMMELSRICHTUNGEN, SCHREIBWEISE,
} from '../js/kurs.js';

test('normieren bringt jeden Wert nach 0 bis 359', () => {
  assert.equal(normieren(360), 0);
  assert.equal(normieren(-30), 330);
  assert.equal(normieren(725), 5);
  assert.equal(normieren(22.5), 22.5);
});

test('gegenkurs', () => {
  assert.equal(gegenkurs(90), 270);
  assert.equal(gegenkurs(202.5), 22.5);
});

test('differenz ist der kürzeste Weg, rechts positiv', () => {
  assert.equal(differenz(90, 120), 30);
  assert.equal(differenz(90, 60), -30);
  assert.equal(differenz(350, 10), 20);
  assert.equal(differenz(10, 350), -20);
  assert.equal(differenz(90, 270), 180);
});

test('drehung in gegebener Richtung', () => {
  assert.equal(drehung(90, 120, 'rechts'), 30);
  assert.equal(drehung(90, 120, 'links'), 330);
  assert.equal(drehung(350, 10, 'rechts'), 20);
});

test('istGanzzahl', () => {
  assert.equal(istGanzzahl(90), true);
  assert.equal(istGanzzahl(22.5), false);
});

test('kursText ist dreistellig', () => {
  assert.equal(kursText(5), '005');
  assert.equal(kursText(90), '090');
  assert.equal(kursText(360), '000');
});

test('Himmelsrichtungen in beiden Schreibweisen', () => {
  assert.equal(HIMMELSRICHTUNGEN.deutsch.length, 16);
  assert.equal(HIMMELSRICHTUNGEN.englisch.length, 16);
  assert.equal(himmelsrichtungGrad(9), 202.5);
  assert.equal(himmelsrichtungName(9, 'deutsch'), 'SSW');
  assert.equal(himmelsrichtungName(4, 'deutsch'), 'O');
  assert.equal(himmelsrichtungName(4, 'englisch'), 'E');
  assert.equal(himmelsrichtungName(1, 'deutsch'), 'NNO');
  assert.equal(himmelsrichtungName(1, 'englisch'), 'NNE');
  assert.equal(SCHREIBWEISE.textteil, 'deutsch');
  assert.equal(SCHREIBWEISE.zeichnung, 'englisch');
});
