import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import { AUSSCHNITT_ARTEN, erzeugeAusschnitt, zeichneAusschnitt } from '../js/ausschnitt.js';
import { zaehleKreuzungen, kleinsterAbstand, beschriftungFrei, LINIENBREITE_ABSTAND } from '../js/geometrie.js';
import { svgLesen } from '../werkzeuge/pruefen/svg.js';

const RICHTUNGEN = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const norm = (g) => ((g % 360) + 360) % 360;
const abstand = (a, b) => { const d = norm(a - b); return Math.min(d, 360 - d); };
function naechste(kurs) {
  let beste = 0;
  for (let j = 1; j < 16; j++) if (abstand(kurs, j * 22.5) < abstand(kurs, beste * 22.5)) beste = j;
  return beste;
}

const ANZAHL = 200;
const ausschnitte = {
  2: Array.from({ length: ANZAHL }, (_, i) => erzeugeAusschnitt(new Zufall(`ausschnitt-2-${i}`), 2)),
  3: Array.from({ length: ANZAHL }, (_, i) => erzeugeAusschnitt(new Zufall(`ausschnitt-3-${i}`), 3)),
};

// Kurs einer Segmentbeschriftung ("123°/15"", "SSE/10"") oder null ("/15"", "HR/20"")
function segmentKurs(zeile) {
  let m;
  if ((m = zeile.match(/^(\d{3})°\/\d+"$/))) return Number(m[1]);
  if ((m = zeile.match(/^([A-Z]{1,3})\/\d+"$/)) && !['HR', 'GK'].includes(m[1])) return RICHTUNGEN.indexOf(m[1]) * 22.5;
  return null;
}

// Eine Gate-Zeile ab "kurs": Stufe 2, Form A und B "Wert Pfeil Sekunden", Form C "Pfeil Ausdruck Sekunden"
function gateZeile(zeile, kurs) {
  let m;
  const c = zeile.match(/^[→↗↘] (.+) \d+"$/);
  if (c) {
    const a = c[1];
    if ((m = a.match(/^([A-Z]{1,3})$/)) && a !== 'GK') return RICHTUNGEN.indexOf(m[1]) * 22.5;
    if ((m = a.match(/^([A-Z]{1,3}) ([+-]\d+)°$/)) && m[1] !== 'GK') return norm(RICHTUNGEN.indexOf(m[1]) * 22.5 + Number(m[2]));
    if (a === 'GK') return norm(kurs + 180);
    if ((m = a.match(/^GK ([+-]\d+)°$/))) return norm(kurs + 180 + Number(m[1]));
    if ((m = a.match(/^anl\. Kurs \+(\d+)°$/))) return norm(kurs + Number(m[1]));
    if ((m = a.match(/^anl\. Kurs \+(\d)×(\d{1,2})$/))) return norm(kurs + Number(m[1]) * Number(m[2]));
    throw new Error(`Gate-Zeile nicht lesbar: ${zeile}`);
  }
  // Form A kann als Wert auch "GK" oder "GK -19°" tragen
  m = zeile.match(/^([+-]\d+°?|[A-Z]{1,3}|\d{3}°|GK [+-]\d+°) [→↗↘] \d+"$/);
  if (!m) throw new Error(`Gate-Zeile nicht lesbar: ${zeile}`);
  if (m[1] === 'GK') return norm(kurs + 180);
  if (m[1].startsWith('GK ')) return norm(kurs + 180 + parseInt(m[1].slice(3), 10));
  if (/^[+-]/.test(m[1])) return norm(kurs + parseInt(m[1], 10));
  if (m[1].endsWith('°')) return Number(m[1].slice(0, -1));
  return RICHTUNGEN.indexOf(m[1]) * 22.5;
}

// Drehsinn einer Anschlusszeile vom Kurs "von" auf K: kürzester Weg, oder die
// Richtung, deren Drehung durch 000° (über N) beziehungsweise 180° (über S) führt
function drehsinn(anschluss, von, nach) {
  const rechtsHerum = norm(nach - von);
  if (anschluss === 'kürz. W.') return rechtsHerum < 180 ? 'rechts' : 'links';
  const grenze = anschluss === 'über N' ? 0 : 180;
  const bisGrenze = norm(grenze - von);
  return bisGrenze > 0 && bisGrenze < rechtsHerum ? 'rechts' : 'links';
}

// Rechnet die Lösungen nur aus dem gezeichneten Ausschnitt nach: Beschriftungen,
// Gate-Text, Kurvenbogen. Die Felder des Erzeugers bleiben außen vor, nur die Art
// sagt, welche Beschriftung die Aufgabe ist.
function nachrechnen(svgText, art) {
  const svg = svgLesen(svgText);
  const texte = svg.texte;
  const segmente = texte.filter((t) => t.klasse === '' && /\/\d+"$/.test(t.zeilen[0]));
  const erstes = segmente[0].zeilen[0].match(/^(\d{3})°\/\d+"$/);
  assert.ok(erstes && segmente[0].zeilen.length === 1, `Startsegment ohne Kurs: ${segmente[0].zeilen.join(' | ')}`);
  const ankunft = Number(erstes[1]);
  const mitte = segmente[1];
  if (art === 'relativ') {
    const ecke = texte.filter((t) => /^[+-]\d+°$/.test(t.zeilen[0]));
    assert.equal(ecke.length, 1);
    assert.match(mitte.zeilen[0], /^\/\d+"$/);
    return { ankunft, loesungen: [norm(ankunft + parseInt(ecke[0].zeilen[0], 10))] };
  }
  if (art === 'rechen') {
    assert.equal(mitte.zeilen.length, 2);
    return { ankunft, loesungen: [norm(segmentKurs(mitte.zeilen[0]) + Number(mitte.zeilen[1]))] };
  }
  if (art === 'himmelsrichtung') {
    assert.match(mitte.zeilen[0], /^[A-Z]{1,3}\/\d+"$/);
    return { ankunft, loesungen: [segmentKurs(mitte.zeilen[0])] };
  }
  if (art === 'hr') {
    assert.match(mitte.zeilen[0], /^HR\/\d+"$/);
    return { ankunft, loesungen: [naechste(ankunft)] };
  }
  if (art === 'hrKurs') {
    const m = mitte.zeilen[0].match(/^HR (\d{3})°\/\d+"$/);
    assert.ok(m, mitte.zeilen[0]);
    return { ankunft, loesungen: [naechste(Number(m[1]))] };
  }
  if (art === 'gk') {
    assert.match(mitte.zeilen[0], /^GK\/\d+"$/);
    return { ankunft, loesungen: [norm(ankunft + 180)] };
  }
  if (art === 'kurve') {
    const zahl = texte.filter((t) => /^\d+$/.test(t.zeilen[0]));
    assert.equal(zahl.length, 1);
    const boegen = svg.stuecke.filter((s) => s.art === 'bogen' && (Math.abs(s.r - 24) < 0.01 || Math.abs(s.r - 35) < 0.01));
    assert.equal(boegen.length, 1, 'genau ein Kurvenbogen');
    assert.match(mitte.zeilen[0], /^\/\d+"$/);
    const winkel = Number(zahl[0].zeilen[0]);
    return { ankunft, loesungen: [norm(ankunft + (boegen[0].fS === 1 ? winkel : -winkel))] };
  }
  // Gate: je Zeile der Kurs danach, bei einer Anschlusszeile dazu der Drehsinn auf K
  const gate = texte.filter((t) => t.klasse === 'gate');
  assert.equal(gate.length, 1);
  const zeilen = [...gate[0].zeilen];
  const anschluss = /^(über N|über S|kürz\. W\.) auf K$/.test(zeilen[zeilen.length - 1]) ? zeilen.pop().replace(' auf K', '') : null;
  const loesungen = [];
  let kurs = ankunft;
  for (const z of zeilen) {
    kurs = gateZeile(z, kurs);
    loesungen.push(kurs);
  }
  if (anschluss) loesungen.push(drehsinn(anschluss, kurs, segmentKurs(segmente[segmente.length - 1].zeilen[0])));
  return { ankunft, loesungen, zeilen };
}

for (const stufe of [2, 3]) {
  test(`Ausschnitte Stufe ${stufe}: ${ANZAHL} Lösungen stimmen mit der Nachrechnung aus den Beschriftungen überein`, () => {
    for (const a of ausschnitte[stufe]) {
      const svg = zeichneAusschnitt(a);
      const nach = nachrechnen(svg, a.art);
      assert.equal(a.ankunft, nach.ankunft, `${a.art}: Ankunft`);
      assert.deepEqual(a.fragen.map((f) => f.loesung), nach.loesungen, `${a.art}: Lösungen`);
    }
  });

  test(`Ausschnitte Stufe ${stufe}: kreuzungsfrei, Striche mit Abstand, Beschriftungen frei`, () => {
    for (const a of ausschnitte[stufe]) {
      const geo = a.geometrie;
      assert.equal(zaehleKreuzungen(geo.stuecke), 0, `${a.art}: Kreuzung`);
      assert.ok(kleinsterAbstand(geo.stuecke, 0, geo.flugzeug) >= LINIENBREITE_ABSTAND, `${a.art}: Striche zu nah`);
      assert.ok(beschriftungFrei(geo), `${a.art}: Beschriftung verdeckt`);
    }
  });

  test(`Ausschnitte Stufe ${stufe}: alle Aufgabenarten kommen vor, ein Aufgabenelement zwischen Start- und Folgesegment`, () => {
    const arten = new Set(ausschnitte[stufe].map((a) => a.art));
    assert.deepEqual(arten, new Set(AUSSCHNITT_ARTEN[stufe]));
    for (const a of ausschnitte[stufe]) {
      const segmente = a.elemente.filter((e) => e.art === 'segment');
      assert.equal(segmente.length, a.art === 'gate' || a.art === 'anl' ? 2 : 3, `${a.art}: Segmente`);
      assert.equal(a.elemente[0].art, 'segment');
      assert.equal(a.elemente[a.elemente.length - 1].art, 'segment');
      assert.ok(!a.elemente.some((e) => e.art === 'vollkreis'), 'kein Vollkreis');
      // Nur das Aufgabenelement trägt eine Aufgabe: eine Rechenaufgabe nur bei "rechen"
      assert.equal(segmente.filter((s) => s.rechenaufgabe !== null).length, a.art === 'rechen' ? 1 : 0, `${a.art}: Rechenaufgaben`);
      // Folgesegment mit eigenem Gradkurs
      assert.equal(segmente[segmente.length - 1].anzeige, 'grad');
      assert.ok(a.fragen.length >= 1 && a.fragen.every((f) => f.text && ['kurs', 'richtung', 'drehsinn'].includes(f.antwort)));
      const svg = zeichneAusschnitt(a);
      assert.ok(!svg.includes('<path class="nordpfeil"') && !svg.includes('<text class="nord"'), 'Nordpfeil im Ausschnitt');
      assert.ok(svg.includes('class="flugzeug"'), 'Flugzeugsymbol fehlt');
    }
  });
}

test('Ausschnitte Stufe 2: nur Elemente der Stufe 2, Gates mit drei Zeilen', () => {
  for (const a of ausschnitte[2]) {
    const svg = zeichneAusschnitt(a);
    assert.ok(!/>(HR|GK)[ /]/.test(svg), 'HR oder GK in Stufe 2');
    assert.ok(!a.elemente.some((e) => e.art === 'kurve'));
    if (a.art === 'gate') assert.equal(a.fragen.length, 3);
  }
});

test('Ausschnitte Stufe 3: Gates in allen drei Formen, Form A mit Frage nach dem Drehsinn', () => {
  const formen = new Set();
  for (const a of ausschnitte[3]) {
    if (a.art !== 'gate' && a.art !== 'anl') continue;
    const gate = a.elemente.find((e) => e.art === 'gate');
    formen.add(gate.form);
    const drehsinn = a.fragen.filter((f) => f.antwort === 'drehsinn');
    assert.equal(drehsinn.length, gate.form === 'a' ? 1 : 0);
    if (drehsinn.length) assert.equal(a.fragen[a.fragen.length - 1].text, 'Drehsinn zum nächsten Kurs?');
  }
  assert.deepEqual(formen, new Set(['a', 'b', 'c']));
});

test('Ausschnitte: jede Art lässt sich gezielt erzeugen, gleicher Startwert gibt gleichen Ausschnitt', () => {
  for (const stufe of [2, 3]) {
    for (const art of AUSSCHNITT_ARTEN[stufe]) {
      for (let i = 0; i < 10; i++) {
        const a = erzeugeAusschnitt(new Zufall(`gezielt-${stufe}-${art}-${i}`), stufe, art);
        assert.equal(a.art, art);
        assert.deepEqual(a.fragen.map((f) => f.loesung), nachrechnen(zeichneAusschnitt(a), art).loesungen);
      }
    }
  }
  const anl = erzeugeAusschnitt(new Zufall('anl'), 3, 'anl');
  assert.ok(/anl\. Kurs \+/.test(zeichneAusschnitt(anl)));
  const eins = zeichneAusschnitt(erzeugeAusschnitt(new Zufall('gleich'), 3));
  assert.equal(zeichneAusschnitt(erzeugeAusschnitt(new Zufall('gleich'), 3)), eins);
  assert.throws(() => erzeugeAusschnitt(new Zufall('x'), 2, 'kurve'));
});
