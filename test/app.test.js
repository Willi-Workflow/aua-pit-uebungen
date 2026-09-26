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

test('Blattliste zeigt je Blatt Vorschaubild und Nummer, Gate-Blätter markiert', () => {
  const html = ansichtFuer('#/stufe2');
  assert.equal((html.match(/<img src="vorschau\/stufe2\/\d+\.svg" alt="" loading="lazy"/g) || []).length, 100);
  assert.ok(html.includes('<img src="vorschau/stufe2/7.svg"'));
  assert.ok(html.includes('Blatt 7'));
  assert.equal((html.match(/class="gatemarke"/g) || []).length, 33);
  assert.ok(/Blatt 3<\/span><span class="gatemarke">/.test(html), 'Blatt 3 ohne Gate-Marke');
  assert.ok(!/Blatt 7<\/span><span class="gatemarke">/.test(html), 'Blatt 7 mit Gate-Marke');
});

test('Gate-Blätter tragen in der Blattansicht den Hinweis auf die Gates', () => {
  assert.ok(ansichtFuer('#/stufe2/blatt/3').includes('Mit Gates:'));
  assert.ok(!ansichtFuer('#/stufe2/blatt/7').includes('Mit Gates:'));
});
