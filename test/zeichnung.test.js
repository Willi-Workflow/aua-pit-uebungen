import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import { erzeugeParcours } from '../js/parcours.js';
import { zeichneParcours, RAND } from '../js/zeichnung.js';
import { erzeugeBlatt } from '../js/blatt.js';

const parcours = erzeugeParcours(new Zufall('stufe-2/blatt-1'), { stufe: 2, mitGates: false });
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

test('Marken und Beschriftungen sind vollständig, Querstriche quer zur gezeichneten Richtung', () => {
  assert.equal(anzahl(svg, /class="marke"/g), parcours.geometrie.marken.length);
  // Alle Texte außer dem N am Nordpfeil sind Beschriftungen
  assert.equal(anzahl(svg, /<text (?!class="nord")/g), parcours.geometrie.beschriftungen.length);
  const striche = [...svg.matchAll(/<line class="marke" x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"\/>/g)].map((m) => m.slice(1).map(Number));
  parcours.geometrie.marken.forEach((m, i) => {
    const [x1, y1, x2, y2] = striche[i];
    const r = (m.gezeichnet * Math.PI) / 180;
    // Senkrecht zur gezeichneten Richtung (sin, -cos) heißt: Skalarprodukt 0
    const skalar = ((x2 - x1) * Math.sin(r) - (y2 - y1) * Math.cos(r)) / Math.hypot(x2 - x1, y2 - y1);
    assert.ok(Math.abs(skalar) < 0.01, `Querstrich ${i} nicht quer: ${skalar}`);
  });
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
  assert.equal(anzahl(gateSvg, /<text (?!class="nord")/g), gateParcours.geometrie.beschriftungen.length);
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
  // Reihenfolge: alle Linien, dann Kästen, dann Marken, Flugzeug und Texte
  const letzteLinie = Math.max(...['horizontal', 'rand', 'sinken', 'steigen'].map((k) => gateSvg.lastIndexOf(`<path class="${k}"`)));
  assert.ok(letzteLinie < gateSvg.indexOf('<rect '), 'Kasten vor einer Linie');
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

test('Flugzeugsymbol am Anfang des Parcours, in gezeichneter Richtung des ersten Segments', () => {
  const start = parcours.geometrie.marken[0];
  const m = svg.match(/<path class="flugzeug" transform="translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\) scale\([\d.]+\)"/);
  assert.ok(m, 'Flugzeugsymbol fehlt');
  const [x, y, winkel] = m.slice(1).map(Number);
  assert.equal(winkel, start.gezeichnet);
  // Die Lage stammt aus der Geometrie, dort prüft die Kandidatensuche sie
  const { mitte } = parcours.geometrie.flugzeug;
  assert.ok(Math.abs(x - mitte.x) < 0.01 && Math.abs(y - mitte.y) < 0.01, `Symbol bei ${x}, ${y}, Geometrie ${mitte.x}, ${mitte.y}`);
  const r = (start.gezeichnet * Math.PI) / 180;
  const abstand = Math.hypot(x - start.punkt.x, y - start.punkt.y);
  assert.ok(abstand > 10 && abstand < 25, `Abstand ${abstand}`);
  // Das Symbol liegt hinter dem Startpunkt, entgegen der Flugrichtung
  assert.ok((x - start.punkt.x) * Math.sin(r) + (y - start.punkt.y) * -Math.cos(r) < 0, 'Symbol liegt vor dem Start');
  assert.ok(svg.includes('.parcours .flugzeug { fill: #000;'), 'Stil für das Symbol fehlt');
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/).slice(1).map(Number);
  assert.ok(x - 14 >= vb[0] && y - 14 >= vb[1] && x + 14 <= vb[0] + vb[2] && y + 14 <= vb[1] + vb[3], 'Symbol ragt aus der viewBox');
});

test('Nordpfeil oben rechts, zeigt nach Norden der Zeichnung, mit fettem N davor', () => {
  const { drehung, umriss } = parcours.geometrie;
  const m = svg.match(/<path class="nordpfeil" d="M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) Z"\/>/);
  assert.ok(m, 'Nordpfeil fehlt');
  const [x0, y0, x1, y1, xs, ys, xl, yl, xr, yr] = m.slice(1).map(Number);
  // Richtung des Schafts gleich vektor(-drehung) = (sin(-d), -cos(-d))
  const r = (-drehung * Math.PI) / 180;
  const laenge = Math.hypot(x1 - x0, y1 - y0);
  assert.ok(Math.abs((x1 - x0) / laenge - Math.sin(r)) < 0.01 && Math.abs((y1 - y0) / laenge + Math.cos(r)) < 0.01, `Schaft zeigt nach ${x1 - x0}, ${y1 - y0}`);
  // Spitze vorn, 44 Einheiten vom Schaftende, Mitte bei (maxX + 30, minY + 30) des Umrisses samt Flugzeug
  assert.ok(Math.abs(Math.hypot(xs - x0, ys - y0) - 44) < 0.02, 'Länge 44');
  const mitte = { x: (x0 + xs) / 2, y: (y0 + ys) / 2 };
  const { mitte: flug } = parcours.geometrie.flugzeug;
  const maxX = Math.max(umriss.maxX, flug.x + 14);
  const minY = Math.min(umriss.minY, flug.y - 14);
  assert.ok(Math.abs(mitte.y - (minY + 30)) < 0.02, `Mitte ${mitte.x}, ${mitte.y}`);
  assert.ok(Math.abs(mitte.x - (maxX + 30)) < 0.02 || Math.min(x0, xs, xl, xr) > maxX + 8.5, `Mitte ${mitte.x}, ${mitte.y}`);
  // Die Spitze ist ein Dreieck um die Pfeilachse
  assert.ok(Math.abs((xl + xr) / 2 - x1) < 0.02 && Math.abs((yl + yr) / 2 - y1) < 0.02, 'Spitze nicht symmetrisch');
  // N 8 Einheiten hinter der Spitze, fett, als eigene Klasse
  const n = svg.match(/<text class="nord" transform="translate\(([-\d.]+) ([-\d.]+)\)">N<\/text>/);
  assert.ok(n, 'N fehlt');
  const [nx, ny] = n.slice(1).map(Number);
  assert.ok(Math.abs(nx - (xs + 8 * Math.sin(r))) < 0.02 && Math.abs(ny - (ys - 8 * Math.cos(r))) < 0.02, `N bei ${nx}, ${ny}`);
  assert.ok(/\.parcours text\.nord \{[^}]*font-weight: 700/.test(svg), 'N nicht fett');
  assert.ok(/\.parcours \.nordpfeil \{[^}]*fill: #000/.test(svg), 'Stil des Pfeils fehlt');
  // viewBox umschließt Pfeil und N
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/).slice(1).map(Number);
  for (const [px, py, rand] of [[x0, y0, 0], [xs, ys, 0], [xl, yl, 0], [xr, yr, 0], [nx, ny, 5]]) {
    assert.ok(px - rand >= vb[0] && py - rand >= vb[1] && px + rand <= vb[0] + vb[2] && py + rand <= vb[1] + vb[3], `Punkt ${px}, ${py} außerhalb der viewBox`);
  }
});

// Nordpfeil und N eines gezeichneten Blatts, dazu der Umriss samt Flugzeugsymbol
function nordpfeilLesen(parcours) {
  const bild = zeichneParcours(parcours);
  const m = bild.match(/<path class="nordpfeil" d="M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) Z"\/>/);
  const [x0, y0, x1, y1, xs, ys, xl, yl, xr, yr] = m.slice(1).map(Number);
  const [nx, ny] = bild.match(/<text class="nord" transform="translate\(([-\d.]+) ([-\d.]+)\)">N<\/text>/).slice(1).map(Number);
  const { umriss, flugzeug } = parcours.geometrie;
  return { x0, y0, x1, y1, xs, ys, xl, yl, xr, yr, nx, ny, maxX: Math.max(umriss.maxX, flugzeug.mitte.x + 14), minY: Math.min(umriss.minY, flugzeug.mitte.y - 14) };
}

test('Nordpfeil auf Blättern 1 bis 100 zeigt nach oben, Drehung ist 0', () => {
  for (let nummer = 1; nummer <= 100; nummer += 11) {
    const blatt = erzeugeBlatt(2, nummer);
    assert.equal(blatt.parcours.drehung, 0, `Blatt ${nummer}`);
    const { x0, y0, x1, y1 } = nordpfeilLesen(blatt.parcours);
    const l = Math.hypot(x1 - x0, y1 - y0);
    assert.ok(Math.abs((x1 - x0) / l) < 0.01 && Math.abs((y1 - y0) / l + 1) < 0.01, `Blatt ${nummer}`);
  }
});

test('Nordpfeil hält in jeder Richtung mindestens 8 Einheiten Abstand zum Umriss, sonst steht er bei (maxX + 30, minY + 30)', () => {
  const geo = parcours.geometrie;
  let verschoben = 0;
  for (let drehung = 0; drehung < 360; drehung += 15) {
    const p = nordpfeilLesen({ geometrie: { ...geo, drehung } });
    const links = Math.min(p.x0, p.xs, p.xl, p.xr, p.nx - 6);
    assert.ok(links >= p.maxX + 8 - 0.02, `Drehung ${drehung}: Pfeil reicht bis ${links - p.maxX} an den Umriss`);
    assert.ok(Math.abs((p.y0 + p.ys) / 2 - (p.minY + 30)) < 0.02, `Drehung ${drehung}: Höhe`);
    const mitteX = (p.x0 + p.xs) / 2;
    if (Math.abs(mitteX - (p.maxX + 30)) > 0.02) {
      verschoben += 1;
      assert.ok(Math.abs(links - (p.maxX + 8)) < 0.02, `Drehung ${drehung}: weiter verschoben als nötig`);
    }
  }
  // Nur Pfeile, die nach links zeigen, rücken nach rechts
  assert.ok(verschoben > 0 && verschoben < 12, `${verschoben} von 24 Richtungen verschoben`);
});
