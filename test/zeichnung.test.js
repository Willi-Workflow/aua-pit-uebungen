import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import { erzeugeParcours } from '../js/parcours.js';
import { zeichneParcours, RAND } from '../js/zeichnung.js';

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

test('je Stück ein Pfad, Sinken und Steigen mit weißer Linie über schwarzem Rand', () => {
  const { stuecke } = parcours.geometrie;
  const horizontal = stuecke.filter((s) => s.profil === 'horizontal').length;
  const sinken = stuecke.filter((s) => s.profil === 'sinken').length;
  const steigen = stuecke.filter((s) => s.profil === 'steigen').length;
  assert.equal(anzahl(svg, /class="horizontal"/g), horizontal);
  assert.equal(anzahl(svg, /class="rand"/g), sinken + steigen);
  assert.equal(anzahl(svg, /class="sinken"/g), sinken);
  assert.equal(anzahl(svg, /class="steigen"/g), steigen);
  assert.ok(svg.includes('stroke-dasharray'), 'Sprossen fehlen');
});

test('Marken und Beschriftungen sind vollständig', () => {
  assert.equal(anzahl(svg, /class="marke"/g), parcours.geometrie.marken.length);
  assert.equal(anzahl(svg, /<text /g), parcours.geometrie.beschriftungen.length);
  for (const b of parcours.geometrie.beschriftungen) {
    for (const zeile of b.zeilen) assert.ok(svg.includes(`>${zeile}</tspan>`), `Beschriftung ${zeile} fehlt`);
  }
});

test('Zahlen ohne überflüssige Nullen, keine wissenschaftliche Schreibweise', () => {
  assert.ok(!/\d\.\d*0"/.test(svg), 'nachlaufende Nullen');
  assert.ok(!/e[-+]\d/.test(svg), 'wissenschaftliche Schreibweise');
});
