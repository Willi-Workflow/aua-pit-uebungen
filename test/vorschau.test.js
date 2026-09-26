import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { erzeugeBlatt, BLAETTER_JE_STUFE } from '../js/blatt.js';
import { zeichneVorschau } from '../js/zeichnung.js';

const ordner = new URL('../vorschau/stufe2/', import.meta.url);
const HINWEIS = 'Vorschaubilder fehlen oder sind veraltet, bitte "npm run vorschauen" ausführen';

const blatt = erzeugeBlatt(2, 1);
const svg = zeichneVorschau(blatt.parcours);

test('Vorschau: nur Linien als Attribute, kein Stilblock, keine Beschriftung', () => {
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('preserveAspectRatio="xMidYMid meet"'));
  assert.ok(svg.includes('<g fill="none" stroke="#000" stroke-width="11" stroke-linecap="round">'));
  assert.ok(!svg.includes('<style'), 'Stilblock gehört nicht in die Vorschau');
  assert.ok(!svg.includes('<text'), 'Beschriftungen gehören nicht in die Vorschau');
  assert.ok(!svg.includes('<line'), 'Marken gehören nicht in die Vorschau');
  const linien = blatt.parcours.geometrie.stuecke.filter((s) => s.art !== 'gate');
  assert.equal((svg.match(/<path /g) || []).length, linien.length);
});

test('Vorschau: viewBox ist der Umriss mit Rand 20, Zahlen mit höchstens einer Nachkommastelle', () => {
  const m = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  assert.ok(m, 'viewBox fehlt');
  const [x, y, b, h] = m.slice(1).map(Number);
  const u = blatt.parcours.geometrie.umriss;
  assert.ok(Math.abs(x - (u.minX - 20)) <= 0.05 && Math.abs(y - (u.minY - 20)) <= 0.05);
  assert.ok(Math.abs(b - (u.maxX - u.minX + 40)) <= 0.05 && Math.abs(h - (u.maxY - u.minY + 40)) <= 0.05);
  for (const zahl of svg.match(/-?\d+\.\d+/g) || []) {
    assert.ok(zahl.split('.')[1].length === 1, `mehr als eine Nachkommastelle: ${zahl}`);
  }
});

test('Vorschau: Gate als weißes Rechteck mit schwarzem Rand über den Linien', () => {
  const ecken = [{ x: 40.26, y: -10.04 }, { x: 80.55, y: -10.04 }, { x: 80.55, y: 10.02 }, { x: 40.26, y: 10.02 }, { x: 40.26, y: -10.04 }];
  const parcours = {
    geometrie: {
      umriss: { minX: 0, minY: -10.04, maxX: 120, maxY: 10.02 },
      stuecke: [
        { art: 'strecke', profil: 'horizontal', pfad: 'M 0 0 L 40.26 0', punkte: [] },
        { art: 'gate', profil: null, pfad: 'M 40.26 -10.04 H 80.55 V 10.02 H 40.26 Z', punkte: ecken },
        { art: 'strecke', profil: 'sinken', pfad: 'M 80.55 0 L 120 0', punkte: [] },
      ],
    },
  };
  const bild = zeichneVorschau(parcours);
  assert.equal((bild.match(/<path /g) || []).length, 2, 'der Kasten ist kein Linienstück');
  assert.ok(bild.includes('<rect x="40.3" y="-10" width="40.3" height="20.1" fill="#fff" stroke="#000" stroke-width="4"/>'));
  assert.ok(bild.indexOf('<rect') > bild.indexOf('</g>'), 'der Kasten liegt über den Linien');
});

test('für jedes Blatt der Stufe 2 liegt ein Vorschaubild unter 6 KB vor', () => {
  const fehlend = [];
  const zuGross = [];
  for (let nummer = 1; nummer <= BLAETTER_JE_STUFE; nummer++) {
    const datei = new URL(`${nummer}.svg`, ordner);
    if (!existsSync(datei)) fehlend.push(nummer);
    else if (readFileSync(datei).length >= 6 * 1024) zuGross.push(nummer);
  }
  assert.ok(fehlend.length === 0, `${HINWEIS}; fehlend: ${fehlend.join(', ')}`);
  assert.ok(zuGross.length === 0, `Vorschaubilder ab 6 KB: ${zuGross.join(', ')}`);
});

test('Stichprobe: Vorschaubilder passen zum aktuellen Erzeuger', () => {
  for (let nummer = 1; nummer <= 91; nummer += 10) {
    const datei = new URL(`${nummer}.svg`, ordner);
    const inhalt = existsSync(datei) ? readFileSync(datei, 'utf8') : '';
    assert.ok(inhalt === zeichneVorschau(erzeugeBlatt(2, nummer).parcours), `Blatt ${nummer}: ${HINWEIS}`);
  }
});
