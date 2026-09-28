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
import { standZeigen } from '../js/uebungsmodus.js';
import { ansichtFuer } from '../js/app.js';

// Stufe 2, Blatt 3, von Hand nachgerechnet: 101 - 160 = 301, 301 + 235 = 176,
// 301 + 211 = 152, 152 + 317 = 109, 109 - 104 = 005, 131 + 86 = 217,
// 217 + 186 = 043, Gate 132°, 132 - 220 = 272, 356°. Jede Lösung ersetzt ihre
// Zeile ganz: Dauer, Pfeil und Zeit bleiben, wie sie auf dem Blatt stehen.
test('Stufe 2, Blatt 3: Arten, ersetzte Zeilen und Lösungen der ersten Rechenstellen', () => {
  const stellen = rechenstellen(erzeugeBlatt(2, 3));
  assert.equal(stellen.length, 24);
  assert.deepEqual(stellen.slice(0, 10).map((s) => `${s.art} ${s.bezug} | ${s.text}`), [
    'kurs /10" | 301°/10"', 'rechen +235 | 176', 'kurs /30" | 152°/30"', 'kurs /15" | 109°/15"', 'rechen -104 | 005',
    'kurs /10" | 217°/10"', 'rechen +186 | 043', 'gate 132° ↘ 20" | 132° ↘ 20"', 'gate -220 ↘ 15" | 272° ↘ 15"', 'gate 356° ↗ 15" | 356° ↗ 15"',
  ]);
  // Halbe Grade nach einer Himmelsrichtung mit Komma
  assert.ok(stellen.some((s) => s.text === '150,5°/30"') && stellen.some((s) => s.text === '037,5'));
  assert.ok(stellen.some((s) => s.bezug === '+306 → 15"' && s.text === '193,5° → 15"'));
});

test('Stufe 3, Blatt 6: Gegenkurs-Angaben, Anschlusszeilen, GK/, HR und Form C', () => {
  const stellen = rechenstellen(erzeugeBlatt(3, 6));
  const texte = stellen.map((s) => `${s.art} ${s.bezug} | ${s.text}`);
  assert.equal(texte[0], 'gegenkurs GK NE/20" | 225°/20"');
  assert.equal(texte[1], 'gegenkurs GK 072°/15" | 252°/15"');
  assert.ok(texte.includes('anschluss über S auf K | über S auf 144°'));
  assert.ok(texte.includes('anschluss kürz. W. auf K | kürz. W. auf 130°'));
  assert.ok(texte.includes('gk GK/15" | 241°/15"'));
  assert.ok(texte.includes('hr HR 182°/10" | S/10"'));
  assert.ok(texte.includes('gate SSW ↘ 10" | 202,5° ↘ 10"'));
  assert.ok(texte.includes('gate GK → 10" | 232° → 10"'));
  // Form C mit dem Pfeil voran: Pfeil und Zeit bleiben, der Wert wird ersetzt
  assert.ok(texte.includes('gate ↘ ESE -28° 25" | ↘ 084,5° 25"'));
  assert.ok(texte.includes('gate → GK 20" | → 303° 20"'));
  // Himmelsrichtung ohne GK ist keine Rechenstelle
  assert.ok(!stellen.some((s) => s.bezug === 'NE/15"'));
});

// Rote Lösungen und weiße Umrisse eines SVG mit Lösungen: Klasse, Schritt,
// transform, Zeilenhöhe, gestauchte Länge, Text
// Inhalt einer Lösung: rot ist der Text selbst, schwarz (Dauer, Pfeil, "über N
// auf") steht in tspans mit der Klasse "schwarz"
const INHALT = '((?:[^<]|<tspan class="schwarz">[^<]*<\\/tspan>)+)';
const LAGE = 'data-schritt="(\\d+)" transform="([^"]+)" y="([-\\d.]+)"((?: textLength="[\\d.]+" lengthAdjust="spacingAndGlyphs")?)';
const ROT = new RegExp(`<text class="loesung( start)?( gezeigt)?" ${LAGE}>${INHALT}<\\/text>`, 'g');
const UMRISS = new RegExp(`<text class="loesung umriss( start)?( gezeigt)?" ${LAGE}>${INHALT}<\\/text>`, 'g');

function roteLesen(svg, muster = ROT) {
  return [...svg.matchAll(muster)].map((m) => ({
    anker: m[1] ? 'start' : 'middle', gezeigt: Boolean(m[2]), schritt: Number(m[3]), transform: m[4], y: Number(m[5]), laenge: m[6],
    text: m[7].replace(/<\/?tspan[^>]*>/g, ''),
    rot: m[7].replace(/<tspan class="schwarz">[^<]*<\/tspan>/g, ''),
  }));
}

// Schwarze Zeilen aller Beschriftungen: Klasse und transform ihres Textelements,
// Zeilenhöhe (Summe der dy), Text, Schritt aus data-ersetzt, verborgen
function schwarzeLesen(svg) {
  const zeilen = [];
  for (const m of svg.matchAll(/<text(?: class="([^"]+)")? transform="([^"]+)">(<tspan.*?)<\/text>/g)) {
    let dy = 0;
    for (const z of m[3].matchAll(/<tspan x="0" dy="([\d.]+)"(?: data-ersetzt="(\d+)")?( class="ersetzt")?>([^<]*)<\/tspan>/g)) {
      dy += Number(z[1]);
      zeilen.push({ klasse: m[1] || '', transform: m[2], dy, schritt: z[2] ? Number(z[2]) : null, verborgen: Boolean(z[3]), text: z[4] });
    }
  }
  return zeilen;
}

// Ersetzt eine Lösung ihre Zeile, stehen beide an genau derselben Stelle:
// gleicher transform (Ursprung und Drehung), gleiche Zeilenhöhe, gleicher Anker
// (Gate-Text linksbündig, sonst mittig) und gleiche Schriftgröße
test('Zeichnung: jede Lösung hat genau eine schwarze Zeile an derselben Stelle, ohne Option wie bisher', () => {
  for (const [stufe, nummer] of [[2, 3], [2, 7], [3, 6], [3, 50]]) {
    const { parcours } = erzeugeBlatt(stufe, nummer);
    const ohne = zeichneParcours(parcours);
    assert.equal(zeichneParcours(parcours, {}), ohne);
    const stellen = rechenstellen({ parcours });
    const mit = zeichneParcours(parcours, { loesungen: stellen });
    const rote = roteLesen(mit);
    const schwarze = schwarzeLesen(mit);
    assert.equal(rote.length, stellen.length);
    assert.equal(schwarze.filter((z) => z.schritt !== null).length, stellen.length, 'jede markierte Zeile gehört zu einer Lösung');
    rote.forEach((l, i) => {
      assert.equal(l.schritt, i + 1);
      assert.equal(l.text, stellen[i].text);
      assert.equal(l.rot, stellen[i].wert, `Schritt ${l.schritt}: nur der Wert ist rot`);
      const gegen = schwarze.filter((z) => z.schritt === l.schritt);
      assert.equal(gegen.length, 1, `Schritt ${l.schritt}: ${gegen.length} schwarze Zeilen`);
      const [z] = gegen;
      assert.equal(z.text, stellen[i].bezug);
      assert.equal(l.transform, z.transform, `Schritt ${l.schritt}: Ursprung oder Drehung`);
      assert.equal(l.y, z.dy, `Schritt ${l.schritt}: Zeile`);
      assert.equal(l.anker, z.klasse === 'gate' ? 'start' : 'middle', `Schritt ${l.schritt}: Anker`);
    });
    // Der weiße Umriss liegt als eigene Lage darunter, gleich gesetzt
    assert.deepEqual(roteLesen(mit, UMRISS), rote);
    assert.ok(mit.lastIndexOf('class="loesung umriss') < mit.search(/<text class="loesung(?! umriss)/), 'Umrisse vor den roten Texten');
    assert.ok(!/class="loesung[^"]*gezeigt"/.test(mit) && !mit.includes('class="ersetzt"'), 'ohne loesungenSichtbar ist nichts ersetzt');
    // Ohne Gruppe, Stilzeilen und Markierungen bleibt genau das bisherige SVG
    const zurueck = mit
      .replace(/\n<g class="loesungen">[\s\S]*?<\/g>/, '')
      .replace(/\n\.parcours \.(loesung|ersetzt)[^\n]*/g, '')
      .replace(/ data-ersetzt="\d+"/g, '');
    assert.equal(zurueck, ohne);
    // Gleiche Schriftgröße wie die Beschriftungen, fett und rot; der Anker kommt
    // von den Beschriftungen (mittig), bei Gates linksbündig wie der Gate-Text
    const schrift = ohne.match(/\.parcours text \{ font: ([\d.]+)px/)[1];
    const stil = mit.match(/\.parcours \.loesung \{ ([^}]*)\}/)[1];
    assert.ok(stil.startsWith('display: none; ') && stil.includes(`font: 700 ${schrift}px`) && stil.includes('fill: #c0262d;') && !stil.includes('text-anchor'), stil);
    assert.ok(mit.includes('.parcours .loesung.start { text-anchor: start; }') && ohne.includes('.parcours text.gate { text-anchor: start; }'));
    assert.ok(/\.parcours \.loesung\.umriss \{ fill: #fff; stroke: #fff; stroke-width: 2\.5px;/.test(mit));
    assert.ok(mit.includes('.parcours .loesung.gezeigt { display: inline; }'));
    assert.ok(mit.includes('.parcours .ersetzt { visibility: hidden; }'), 'die ersetzte Zeile behält ihren Platz');
    // Prüfstand 3: genau die ersten drei Lösungen gezeigt und ihre Zeilen verborgen
    const drei = zeichneParcours(parcours, { loesungen: stellen, loesungenSichtbar: 3 });
    assert.deepEqual(roteLesen(drei).filter((l) => l.gezeigt).map((l) => l.schritt), [1, 2, 3]);
    assert.deepEqual(schwarzeLesen(drei).filter((z) => z.verborgen).map((z) => z.schritt), [1, 2, 3]);
  }
});

// Eine zu breite Gate-Lösung wird gestaucht, statt über den Kasten zu ragen
test('Zeichnung: Gate-Lösungen breiter als ihr Kasten gestaucht, Segmente nie', () => {
  const { parcours } = erzeugeBlatt(3, 6);
  const mit = zeichneParcours(parcours, { loesungen: rechenstellen({ parcours }) });
  const rote = roteLesen(mit);
  const gestaucht = rote.filter((l) => l.laenge);
  assert.ok(gestaucht.length >= 1 && gestaucht.every((l) => l.anker === 'start'), JSON.stringify(gestaucht));
  assert.ok(gestaucht.some((l) => l.text === 'über S auf 144°'));
});

// Elemente wie im Browser, nur mit dataset und classList
function element(daten) {
  const klassen = new Set();
  return { dataset: daten, classList: { toggle: (k, an) => (an ? klassen.add(k) : klassen.delete(k)), contains: (k) => klassen.has(k) } };
}

test('Aufdecken verbirgt genau die schwarze Zeile der Lösung, zurück bringt sie wieder', () => {
  const { parcours } = erzeugeBlatt(3, 6);
  const stellen = rechenstellen({ parcours });
  const svg = zeichneParcours(parcours, { loesungen: stellen });
  const rote = roteLesen(svg).map((l) => ({ ...l, el: element({ schritt: String(l.schritt) }) }));
  const umrisse = roteLesen(svg, UMRISS).map((l) => ({ ...l, el: element({ schritt: String(l.schritt) }) }));
  const schwarze = schwarzeLesen(svg).filter((z) => z.schritt !== null).map((z) => ({ ...z, el: element({ ersetzt: String(z.schritt) }) }));
  const loesungen = [...umrisse, ...rote].map((l) => l.el);
  const ersetzte = schwarze.map((z) => z.el);
  for (const stand of [1, 2, 17, 35, 34, 5, 0]) {
    standZeigen(loesungen, ersetzte, stand);
    for (const l of [...rote, ...umrisse]) assert.equal(l.el.classList.contains('gezeigt'), l.schritt <= stand, `Stand ${stand}, Lösung ${l.schritt}`);
    for (const z of schwarze) {
      // Verborgen ist die Zeile genau dann, wenn ihre Lösung gezeigt ist
      const loesung = rote.find((l) => l.schritt === z.schritt);
      assert.equal(z.el.classList.contains('ersetzt'), loesung.el.classList.contains('gezeigt'), `Stand ${stand}, Zeile ${z.text}`);
      assert.equal(z.el.classList.contains('ersetzt'), z.schritt <= stand);
    }
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
    assert.equal((html.match(/ data-ersetzt="\d+"/g) || []).length, anzahl);
    assert.ok(!html.includes('class="ersetzt"'), `${hash}: eine schwarze Zeile ist verborgen`);
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
  // Die schwarzen Zeilen dieser acht Lösungen sind ersetzt, keine andere
  assert.deepEqual([...html.matchAll(/data-ersetzt="(\d+)" class="ersetzt"/g)].map((m) => Number(m[1])), [1, 2, 3, 4, 5, 6, 7, 8]);
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
// !important ausgeblendet, die schwarzen Zeilen dagegen immer sichtbar; der
// Vollbildzustand gilt nur auf dem Bildschirm
test('Druck: Lösungen und Bedienung verborgen, alle schwarzen Zeilen da, Vollbild nur auf dem Bildschirm', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const druck = mediaBloecke(css, 'print');
  assert.equal(druck.length, 1);
  assert.ok(/\.parcours \.loesung,\s*\.uebung-leiste \{\s*display: none !important;/.test(css.slice(...druck[0])), 'Druckregel fehlt');
  assert.ok(/\.parcours \.ersetzt \{\s*visibility: visible !important;/.test(css.slice(...druck[0])), 'Druckregel für ersetzte Zeilen fehlt');
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
