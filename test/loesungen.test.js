// Übungsmodus der Blattansicht: Rechenstellen einzelner Blätter, Zeichnung,
// Blattansicht, Prüfmodus, Druck und Tastenlogik. Den Abgleich aller 200
// Blätter mit der Nachrechnung des Prüfwerkzeugs macht test/blaetter.test.js,
// wo die Blätter ohnehin erzeugt werden.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { erzeugeBlatt } from '../js/blatt.js';
import { zeichneParcours } from '../js/zeichnung.js';
import { rechenstellen, tasteZuAktion, naechsterStand, zaehlerText } from '../js/loesungen.js';
import { ansichtFuer } from '../js/app.js';

// Stufe 2, Blatt 3, von Hand nachgerechnet: 101 - 160 = 301, 301 + 235 = 176,
// 301 + 211 = 152, 152 + 317 = 109, 109 - 104 = 005, 131 + 86 = 217,
// 217 + 186 = 043, Gate 132°, 132 - 220 = 272, 356°
test('Stufe 2, Blatt 3: Arten und Texte der ersten Rechenstellen', () => {
  const stellen = rechenstellen(erzeugeBlatt(2, 3));
  assert.equal(stellen.length, 24);
  assert.deepEqual(stellen.slice(0, 10).map((s) => `${s.art} ${s.text}`), [
    'kurs 301°', 'rechen = 176', 'kurs 152°', 'kurs 109°', 'rechen = 005', 'kurs 217°', 'rechen = 043', 'gate 132°', 'gate 272°', 'gate 356°',
  ]);
  // Halbe Grade nach einer Himmelsrichtung mit Komma
  assert.ok(stellen.some((s) => s.text === '150,5°') && stellen.some((s) => s.text === '= 037,5'));
});

test('Stufe 3, Blatt 6: Gegenkurs-Angaben, Anschlusszeilen, GK/ und HR', () => {
  const stellen = rechenstellen(erzeugeBlatt(3, 6));
  const texte = stellen.map((s) => `${s.art} ${s.text} (${s.bezug})`);
  assert.equal(texte[0], 'gegenkurs 225° (GK NE/20")');
  assert.equal(texte[1], 'gegenkurs 252° (GK 072°/15")');
  assert.ok(texte.includes('anschluss K = 144° (über S auf K)'));
  assert.ok(texte.includes('gk 241° (GK/15")'));
  assert.ok(texte.includes('hr S (HR 182°/10")'));
  assert.ok(texte.includes('gate 202,5° (SSW ↘ 10")'));
  // Himmelsrichtung ohne GK ist keine Rechenstelle
  assert.ok(!stellen.some((s) => s.bezug === 'NE/15"'));
});

test('Zeichnung: ohne Option Zeichen für Zeichen wie bisher, mit Option nur um die Lösungen ergänzt', () => {
  for (const [stufe, nummer] of [[2, 3], [2, 7], [3, 6], [3, 50]]) {
    const { parcours } = erzeugeBlatt(stufe, nummer);
    const ohne = zeichneParcours(parcours);
    assert.equal(zeichneParcours(parcours, {}), ohne);
    const stellen = rechenstellen({ parcours });
    const mit = zeichneParcours(parcours, { loesungen: stellen });
    const texte = [...mit.matchAll(/<text class="loesung( ende| mitte)?" data-schritt="(\d+)" transform="([^"]+)">([^<]+)<\/text>/g)];
    const umrisse = [...mit.matchAll(/<text class="loesung umriss( ende| mitte)?" data-schritt="(\d+)" transform="([^"]+)">([^<]+)<\/text>/g)];
    assert.equal(texte.length, stellen.length);
    texte.forEach((m, i) => {
      assert.equal(Number(m[2]), i + 1);
      assert.equal(m[4], stellen[i].text);
      // Der weiße Umriss liegt als eigene Lage darunter, gleich gesetzt
      assert.deepEqual(umrisse[i].slice(1), m.slice(1));
    });
    assert.ok(mit.lastIndexOf('class="loesung umriss') < mit.search(/<text class="loesung(?! umriss)/), 'Umrisse vor den roten Texten');
    assert.ok(!/class="loesung[^"]*gezeigt"/.test(mit), 'ohne loesungenSichtbar ist keine Lösung eingeblendet');
    // Ohne Gruppe und Stilzeilen der Lösungen bleibt genau das bisherige SVG
    const zurueck = mit.replace(/\n<g class="loesungen">[\s\S]*?<\/g>/, '').replace(/\n\.parcours \.loesung[^\n]*/g, '');
    assert.equal(zurueck, ohne);
    // Verborgen, bis "gezeigt" sie einblendet; rot, fett, weißer Umriss
    assert.ok(/\.parcours \.loesung \{ display: none; font: 700 10px [^}]*fill: #c0262d;/.test(mit));
    assert.ok(/\.parcours \.loesung\.umriss \{ fill: #fff; stroke: #fff; stroke-width: 2\.5px;/.test(mit));
    assert.ok(mit.includes('.parcours .loesung.gezeigt { display: inline; }'));
    const drei = zeichneParcours(parcours, { loesungen: stellen, loesungenSichtbar: 3 });
    assert.deepEqual([...drei.matchAll(/class="loesung(?! umriss)[^"]*gezeigt" data-schritt="(\d+)"/g)].map((m) => Number(m[1])), [1, 2, 3]);
  }
});

test('Blattansicht beider Stufen: Knopf Start neben Drucken, Lösungen verborgen, Zähler', () => {
  for (const hash of ['#/stufe2/blatt/3', '#/stufe3/blatt/6']) {
    const html = ansichtFuer(hash);
    const start = html.indexOf('<button type="button" class="knopf" data-aktion="vollbild">Start</button>');
    const drucken = html.indexOf('<button type="button" class="knopf" data-aktion="drucken">Drucken</button>');
    assert.ok(start >= 0 && drucken > start, `${hash}: Start fehlt oder steht nicht vor Drucken`);
    assert.ok(html.includes('<article class="blatt">'), 'das Blatt selbst bleibt, wie es war');
    const anzahl = (html.match(/<text class="loesung[ "](?!umriss)/g) || []).length;
    assert.ok(anzahl > 10, `${hash}: ${anzahl} Lösungen`);
    assert.ok(!/class="loesung[^"]*gezeigt"/.test(html), `${hash}: eine Lösung ist eingeblendet`);
    assert.ok(html.includes(`<span class="zaehler" data-zaehler aria-live="polite">0 / ${anzahl}</span>`));
    // Der Textteil trägt keine Lösungen
    const textteil = html.slice(html.indexOf('<ol class="textteil">'), html.indexOf('</ol>'));
    assert.ok(!textteil.includes('loesung'));
  }
});

test('Prüfmodus: probe=vollbild zeigt das Blatt im Vollbild mit den ersten Lösungen', () => {
  const html = ansichtFuer('#/stufe3/blatt/6?probe=vollbild&schritt=8');
  assert.ok(html.includes('<article class="blatt vollbild" data-probe="vollbild">'));
  const gezeigt = [...html.matchAll(/class="loesung(?! umriss)[^"]*gezeigt" data-schritt="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(gezeigt, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal((html.match(/class="loesung umriss[^"]*gezeigt"/g) || []).length, 8, 'Umrisse mit eingeblendet');
  const anzahl = (html.match(/<text class="loesung[ "](?!umriss)/g) || []).length;
  assert.ok(html.includes(`>8 / ${anzahl}</span>`));
  // Grenzen: mehr als alle zeigt alle, ohne Zahl keine
  const gezeigtZahl = (h) => (h.match(/class="loesung(?! umriss)[^"]*gezeigt"/g) || []).length;
  assert.equal(gezeigtZahl(ansichtFuer('#/stufe3/blatt/6?probe=vollbild&schritt=999')), anzahl);
  assert.equal(gezeigtZahl(ansichtFuer('#/stufe2/blatt/3?probe=vollbild')), 0);
  assert.ok(ansichtFuer('#/stufe2/blatt/3?probe=anders').includes('<article class="blatt">'));
});

// Bereiche der @media-Blöcke einer Art im CSS, über die Klammern gezählt
function mediaBloecke(css, art) {
  const bereiche = [];
  for (const m of css.matchAll(new RegExp(`@media ${art}[^{]*\\{`, 'g'))) {
    let tiefe = 0;
    let i = m.index + m[0].length - 1;
    for (; i < css.length; i++) {
      if (css[i] === '{') tiefe += 1;
      if (css[i] === '}') tiefe -= 1;
      if (tiefe === 0) break;
    }
    bereiche.push([m.index, i]);
  }
  return bereiche;
}

// Der Druck zeigt nie Lösungen: im SVG verborgen, im Druck zusätzlich mit
// !important ausgeblendet, der Vollbildzustand gilt nur auf dem Bildschirm
test('Druck: Lösungen und Bedienung verborgen, Vollbild nur auf dem Bildschirm', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const druck = mediaBloecke(css, 'print');
  assert.equal(druck.length, 1);
  assert.ok(/\.parcours \.loesung,\s*\.uebung-leiste \{\s*display: none !important;/.test(css.slice(...druck[0])), 'Druckregel fehlt');
  const bildschirm = mediaBloecke(css, 'screen');
  const regeln = [...css.matchAll(/\.vollbild[^{]*\{/g)];
  assert.ok(regeln.length >= 5);
  for (const m of regeln) {
    assert.ok(bildschirm.some(([a, e]) => m.index > a && m.index < e), `Regel ${m[0]} außerhalb von @media screen`);
  }
  assert.ok(/\n\.uebung-leiste \{\s*display: none;/.test(css), 'Zähler außerhalb des Vollbilds sichtbar');
});

test('Tasten: Leertaste weiter, Rücktaste und Pfeil links zurück, Escape beendet, Grenzen', () => {
  assert.equal(tasteZuAktion(' '), 'weiter');
  assert.equal(tasteZuAktion('Spacebar'), 'weiter');
  assert.equal(tasteZuAktion('Backspace'), 'zurueck');
  assert.equal(tasteZuAktion('ArrowLeft'), 'zurueck');
  assert.equal(tasteZuAktion('Escape'), 'ende');
  assert.equal(tasteZuAktion('Enter'), null);
  assert.equal(tasteZuAktion('a'), null);
  assert.equal(naechsterStand(0, 11, 'weiter'), 1);
  assert.equal(naechsterStand(10, 11, 'weiter'), 11);
  assert.equal(naechsterStand(11, 11, 'weiter'), 11, 'nicht über die letzte Lösung hinaus');
  assert.equal(naechsterStand(3, 11, 'zurueck'), 2);
  assert.equal(naechsterStand(0, 11, 'zurueck'), 0, 'nicht unter null');
  assert.equal(naechsterStand(7, 11, 'ende'), 0);
  assert.equal(naechsterStand(4, 11, null), 4);
  assert.equal(naechsterStand(0, 0, 'weiter'), 0);
  assert.equal(zaehlerText(3, 11), '3 / 11');
});
