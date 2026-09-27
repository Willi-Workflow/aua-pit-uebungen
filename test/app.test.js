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

test('Startseite zeigt die Kursrose, die Kopfleiste ihr Zeichen', () => {
  const html = ansichtFuer('#/');
  assert.equal((html.match(/<svg[^>]*class="kursrose"/g) || []).length, 1);
  assert.equal((html.match(/<text class="rose-ziffer/g) || []).length, 12, 'zwölf Ziffern 0 bis 33');
  assert.ok(/<text class="rose-ziffer ausgang"[^>]*>9<\/text>/.test(html), 'Ausgangskurs 090 hervorgehoben');
  assert.ok(ansichtFuer('#/stufe2/blatt/7').includes('<svg class="zeichen"'));
});

test('Blattliste enthält 100 Vorschaubilder', () => {
  const html = ansichtFuer('#/stufe2');
  assert.equal((html.match(/<img [^>]*src="vorschau\/stufe2\//g) || []).length, 100);
});

test('Kopfleiste nennt den Ort ohne Mittelpunkte und Pfeile', () => {
  const html = ansichtFuer('#/stufe2/blatt/7');
  assert.ok(html.includes('<span class="ort">Stufe 2, Blatt 7</span>'));
  for (const hash of ['#/', '#/stufe2', '#/stufe2/blatt/7', '#/stufe3', '#/stufe3/blatt/7', '#/stufe2/endlos']) {
    const ansicht = ansichtFuer(hash);
    assert.ok(!ansicht.includes('·'), `Mittelpunkt in ${hash}`);
    assert.ok(!ansicht.includes('←'), `Pfeil in ${hash}`);
  }
});

test('Startseite hat unter der Kursrose den Knopf Blitzrechnen, die Seite ist ein Platzhalter', () => {
  const start = ansichtFuer('#/');
  const rose = start.indexOf('class="kursrose"');
  const knopf = start.indexOf('href="#/blitzrechnen"');
  assert.ok(rose >= 0 && knopf > rose, 'Knopf fehlt oder steht nicht nach der Kursrose');
  assert.ok(start.includes('class="blitz-zeichen"') && start.includes('>Blitzrechnen</span></a>'));
  assert.ok(ansichtFuer('#/blitzrechnen').includes('Blitzrechnen kommt'));
});

test('Startseite: Stufe 3 ist eine aktive Karte mit Unterzeile', () => {
  const html = ansichtFuer('#/');
  assert.ok(html.includes('<a class="karte" href="#/stufe3"><span class="karte-titel">Stufe 3</span><span class="karte-text">Nur Parcours, 100 Blätter, alle mit Gates</span></a>'));
  assert.ok(!html.includes('spaeter'), 'keine Karte mehr als Platzhalter');
});

test('Blattliste der Stufe 3: 100 Vorschaubilder aus vorschau/stufe3, ohne Gate-Marke', () => {
  const html = ansichtFuer('#/stufe3');
  assert.equal((html.match(/<img src="vorschau\/stufe3\/\d+\.svg" alt="" loading="lazy"/g) || []).length, 100);
  assert.ok(html.includes('href="#/stufe3/blatt/7"'));
  assert.ok(!html.includes('class="gatemarke"'));
  assert.ok(html.includes('Nur Parcours, alle mit Gates.'));
  assert.ok(!html.includes('Jedes dritte Blatt'));
});

test('Blattansicht der Stufe 3: kein Textteil, Start und Kürzel über dem Parcours, Start und Ende in der Zeichnung', () => {
  const html = ansichtFuer('#/stufe3/blatt/3');
  assert.ok(html.includes('<h1>AUA PIT Stufe 3, Blatt 3</h1>'));
  assert.ok(html.includes('<article class="blatt ohne-textteil">'));
  assert.ok(html.includes('<p class="ausgang">Start 2000 ft, Kurs vom ersten Segment</p>'));
  assert.ok(html.includes('<p class="erklaerung">HR = nächste Himmelsrichtung, GK = Gegenkurs, K = Kurs des nächsten Segments, nackte Gradzahl an einer Kurve = Drehwinkel in gezeichneter Richtung</p>'));
  assert.ok(html.includes('Mit Gates:'));
  assert.ok(!html.includes('class="textteil"'));
  assert.ok(!html.includes('Ausgangskurs'));
  assert.ok(html.includes('<svg xmlns="http://www.w3.org/2000/svg" class="parcours"'));
  assert.ok(/<text class="fett" [^>]*><tspan x="0" dy="0">Start<\/tspan><\/text>/.test(html));
  assert.ok(/<text class="fett" [^>]*><tspan x="0" dy="0">Ende<\/tspan><\/text>/.test(html));
  assert.ok(html.includes('class="legende"'));
  assert.ok(ansichtFuer('#/stufe3/blatt/101').includes('Nicht gefunden'));
});
