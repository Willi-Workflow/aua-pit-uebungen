import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ansichtFuer } from '../js/app.js';

test('Startseite nennt beide Stufen', () => {
  const html = ansichtFuer('#/');
  assert.ok(html.includes('Stufe 2'));
  assert.ok(html.includes('Stufe 3'));
});

test('Blattansicht zeigt Blatt 7 mit Zeichnung', () => {
  const html = ansichtFuer('#/stufe2/blatt/7');
  assert.ok(html.includes('Blatt 7'));
  assert.ok(html.includes('<svg'));
});

test('unbekannte Blätter und Stufen ergeben "Nicht gefunden"', () => {
  assert.ok(ansichtFuer('#/stufe2/blatt/999').includes('Nicht gefunden'));
  assert.ok(ansichtFuer('#/stufe9').includes('Nicht gefunden'));
});
