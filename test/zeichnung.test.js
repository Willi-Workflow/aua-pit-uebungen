import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import { erzeugeParcours } from '../js/parcours.js';
import { zeichneParcours, RAND } from '../js/zeichnung.js';
import { erzeugeBlatt } from '../js/blatt.js';

const parcours = erzeugeParcours(new Zufall('stufe-2/blatt-1'));
const svg = zeichneParcours(parcours);

function anzahl(text, muster) {
  return (text.match(muster) || []).length;
}

test('vollständiges SVG mit viewBox, das den Umriss samt Rand umschließt', () => {
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  const m = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  assert.ok(m, 'viewBox fehlt');
  const [x, y, b, h] = m.slice(1).map(Number);
  const u = parcours.geometrie.umriss;
  assert.ok(x <= u.minX - RAND + 0.01 && y <= u.minY - RAND + 0.01);
  assert.ok(x + b >= u.maxX + RAND - 0.01 && y + h >= u.maxY + RAND - 0.01);
});

test('jedes Stück wird gezeichnet, Sinken und Steigen mit weißer Linie über schwarzem Rand', () => {
  const { stuecke } = parcours.geometrie;
  const horizontal = stuecke.filter((s) => s.profil === 'horizontal').length;
  const sinken = stuecke.filter((s) => s.profil === 'sinken').length;
  const steigen = stuecke.filter((s) => s.profil === 'steigen').length;
  assert.equal(anzahl(svg, /class="horizontal"/g), horizontal);
  assert.equal(anzahl(svg, /class="rand"/g), sinken + steigen);
  assert.equal(anzahl(svg, /class="sinken"/g), sinken);
  assert.equal(anzahl(svg, /class="steigen"/g), steigen);
  for (const s of stuecke) {
    if (s.art === 'gate') continue;
    if (s.profil === 'horizontal') {
      assert.ok(svg.includes(`<path class="horizontal" d="${s.pfad}"/>`), `Pfad fehlt: ${s.pfad}`);
    } else {
      assert.ok(svg.includes(`<path class="rand" d="${s.pfad}"/><path class="${s.profil}" d="${s.pfad}"/>`), `Rand und ${s.profil} fehlen: ${s.pfad}`);
    }
  }
  assert.ok(/\.steigen \{[^}]*stroke-dasharray/.test(svg), 'Sprossenregel für steigen fehlt');
});

test('Marken und Beschriftungen sind vollständig', () => {
  assert.equal(anzahl(svg, /class="marke"/g), parcours.geometrie.marken.length);
  assert.equal(anzahl(svg, /<text /g), parcours.geometrie.beschriftungen.length);
  for (const b of parcours.geometrie.beschriftungen) {
    for (const zeile of b.zeilen) assert.ok(svg.includes(`>${zeile}</tspan>`), `Beschriftung ${zeile} fehlt`);
  }
});

test('alle Zahlen mit höchstens zwei Nachkommastellen, ohne nachlaufende Nullen, ohne wissenschaftliche Schreibweise', () => {
  assert.ok(!/e[-+]\d/.test(svg), 'wissenschaftliche Schreibweise');
  const dezimalzahlen = svg.match(/-?\d+\.\d+/g) || [];
  assert.ok(dezimalzahlen.length > 0, 'keine Dezimalzahl gefunden, Prüfung wäre leer');
  for (const zahl of dezimalzahlen) {
    const nachkomma = zahl.split('.')[1];
    assert.ok(nachkomma.length <= 2, `mehr als zwei Nachkommastellen: ${zahl}`);
    assert.ok(!nachkomma.endsWith('0'), `nachlaufende Null: ${zahl}`);
  }
});

test('Gate-Blatt 3: je Gate ein weißer Kasten nach den Linien und vor Marken und Texten, Zeilen linksbündig', () => {
  const gateParcours = erzeugeBlatt(2, 3).parcours;
  const gateSvg = zeichneParcours(gateParcours);
  const kaesten = gateParcours.geometrie.stuecke.filter((s) => s.art === 'gate');
  const texte = gateParcours.geometrie.beschriftungen.filter((b) => b.gate);
  assert.ok(kaesten.length >= 3 && kaesten.length <= 4, `${kaesten.length} Gates`);
  assert.equal(anzahl(gateSvg, /<rect /g), kaesten.length);
  assert.equal(anzahl(gateSvg, /<text /g), gateParcours.geometrie.beschriftungen.length);
  assert.equal(anzahl(gateSvg, /<text class="gate"/g), texte.length);
  for (const b of texte) {
    for (const zeile of b.zeilen) assert.ok(gateSvg.includes(`>${zeile}</tspan>`), `Gate-Zeile ${zeile} fehlt`);
  }
  // Kasten an seinen Ecken
  for (const k of kaesten) {
    const xs = k.punkte.map((q) => q.x);
    const ys = k.punkte.map((q) => q.y);
    const zahl = (w) => Number(w.toFixed(2)).toString();
    const rect = `<rect class="gate" x="${zahl(Math.min(...xs))}" y="${zahl(Math.min(...ys))}" width="${zahl(Math.max(...xs) - Math.min(...xs))}" height="${zahl(Math.max(...ys) - Math.min(...ys))}"/>`;
    assert.ok(gateSvg.includes(rect), `Kasten fehlt: ${rect}`);
  }
  // Reihenfolge: alle Linien, dann Kästen, dann Marken und Texte
  assert.ok(gateSvg.lastIndexOf('<path ') < gateSvg.indexOf('<rect '), 'Kasten vor einer Linie');
  assert.ok(gateSvg.lastIndexOf('<rect ') < gateSvg.indexOf('class="marke"'), 'Kasten nach einer Marke');
  assert.ok(gateSvg.lastIndexOf('<rect ') < gateSvg.indexOf('<text '), 'Kasten nach einem Text');
  // Kasten weiß mit schwarzem Rand 1,5, Gate-Text linksbündig
  assert.ok(/\.parcours rect\.gate \{[^}]*fill: #fff;[^}]*stroke: #000;[^}]*stroke-width: 1\.5/.test(gateSvg), 'Stil des Kastens fehlt');
  assert.ok(/\.parcours text\.gate \{[^}]*text-anchor: start/.test(gateSvg), 'Gate-Text nicht linksbündig');
  // Erste Zeile 5 Einheiten rechts vom linken Kastenrand, Block senkrecht mittig
  for (const b of texte) {
    const kasten = kaesten.find((k) => {
      const xs = k.punkte.map((q) => q.x);
      return Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - b.x) < 0.01;
    });
    const links = Math.min(...kasten.punkte.map((q) => q.x));
    const zahl = (w) => Number(w.toFixed(2)).toString();
    const oben = b.y - ((b.zeilen.length - 1) * 9) / 2;
    assert.ok(gateSvg.includes(`<text class="gate" transform="translate(${zahl(links + 5)} ${zahl(oben)})">`), `Gate-Text an falscher Stelle: ${b.zeilen[0]}`);
  }
});
