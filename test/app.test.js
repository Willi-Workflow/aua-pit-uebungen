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

test('Startseite hat unter der Kursrose den Knopf Blitzrechnen, er führt zur Auswahlseite', () => {
  const start = ansichtFuer('#/');
  const rose = start.indexOf('class="kursrose"');
  const knopf = start.indexOf('href="#/blitzrechnen"');
  assert.ok(rose >= 0 && knopf > rose, 'Knopf fehlt oder steht nicht nach der Kursrose');
  assert.ok(start.includes('class="blitz-zeichen"') && start.includes('>Blitzrechnen</span></a>'));
  const auswahl = ansichtFuer('#/blitzrechnen');
  assert.ok(!auswahl.includes('Blitzrechnen kommt'), 'Blitzrechnen ist kein Platzhalter mehr');
  assert.ok(auswahl.includes('href="#/blitzrechnen/kopfrechnen"'));
});

test('Startseite: Stufe 3 ist eine aktive Karte mit Unterzeile', () => {
  const html = ansichtFuer('#/');
  assert.ok(html.includes('<a class="karte" href="#/stufe3"><span class="karte-titel">Stufe 3</span><span class="karte-text">Textteil und Parcours, 100 Blätter, alle mit Gates</span></a>'));
  assert.ok(!html.includes('Nur Parcours') && !html.includes('nur den Parcours'), 'Stufe 3 hat jetzt einen Textteil');
  assert.ok(!html.includes('spaeter'), 'keine Karte mehr als Platzhalter');
});

test('Blattliste der Stufe 3: 100 Vorschaubilder aus vorschau/stufe3, ohne Gate-Marke', () => {
  const html = ansichtFuer('#/stufe3');
  assert.equal((html.match(/<img src="vorschau\/stufe3\/\d+\.svg" alt="" loading="lazy"/g) || []).length, 100);
  assert.ok(html.includes('href="#/stufe3/blatt/7"'));
  assert.ok(!html.includes('class="gatemarke"'));
  assert.ok(html.includes('Textteil und Parcours, alle mit Gates.'));
  assert.ok(!html.includes('Nur Parcours'));
  assert.ok(!html.includes('Jedes dritte Blatt'));
});

// Stufe 3 wie Stufe 2: Titel, Ausgangskurs, zwölf Sätze, Parcours, Legende.
// Die früheren Zeilen über dem Parcours (Start, Kürzel, Gate-Hinweis) entfallen.
test('Blattansicht der Stufe 3: wie Stufe 2 mit Ausgangskurs und zwölf Sätzen, ohne Erklärzeile und Gate-Hinweis', () => {
  const html = ansichtFuer('#/stufe3/blatt/3');
  assert.ok(html.includes('<h1>AUA PIT Stufe 3, Blatt 3</h1>'));
  assert.ok(html.includes('<article class="blatt">'));
  assert.ok(!html.includes('ohne-textteil'));
  const teile = ['<h1>', '<p class="ausgang">Ausgangskurs 090°, 2000 ft</p>', '<ol class="textteil">', '<svg xmlns="http://www.w3.org/2000/svg" class="parcours"', 'class="legende"'];
  const stellen = teile.map((t) => html.indexOf(t));
  assert.ok(stellen.every((x, j) => x >= 0 && (j === 0 || x > stellen[j - 1])), `Reihenfolge ${stellen.join(', ')}`);
  const textteil = html.slice(html.indexOf('<ol class="textteil">'), html.indexOf('</ol>', html.indexOf('<ol class="textteil">')));
  assert.equal((textteil.match(/<li>/g) || []).length, 12);
  // Zwischen Ausgangskurs und Textteil steht nichts mehr
  assert.equal(html.slice(stellen[1] + teile[1].length, stellen[2]).trim(), '');
  assert.ok(!html.includes('class="erklaerung"') && !html.includes('HR = nächste Himmelsrichtung'), 'Erklärzeile');
  assert.ok(!html.includes('Mit Gates:') && !html.includes('class="gatehinweis"'), 'Gate-Hinweis');
  assert.ok(!html.includes('Kurs vom ersten Segment') && !html.includes('2000 ft,'), 'Startzeile');
  // In der Zeichnung nur "Start", die Höhe kommt vom Ende des Textteils
  assert.ok(/<text class="fett" [^>]*><tspan x="0" dy="0">Start<\/tspan><\/text>/.test(html));
  assert.ok(!html.includes('Start 2000 ft'));
  assert.ok(/<text class="fett" [^>]*><tspan x="0" dy="0">Ende<\/tspan><\/text>/.test(html));
  assert.ok(ansichtFuer('#/stufe3/blatt/101').includes('Nicht gefunden'));
});

test('Blattansicht der Stufe 2 bleibt: Gate-Hinweis auf Gate-Blättern zwischen Ausgangskurs und Textteil', () => {
  const html = ansichtFuer('#/stufe2/blatt/3');
  const ausgang = html.indexOf('<p class="ausgang">Ausgangskurs 090°, 2000 ft</p>');
  const hinweis = html.indexOf('<p class="gatehinweis"><strong>Mit Gates:</strong>');
  assert.ok(ausgang >= 0 && hinweis > ausgang && html.indexOf('<ol class="textteil">') > hinweis);
  assert.ok(html.includes('<article class="blatt">'));
  assert.ok(!html.includes('<text class="fett"'), 'Stufe 2 ohne Start und Ende');
});
