import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import { AUSSCHNITT_ARTEN, erzeugeAusschnitt, zeichneAusschnitt } from '../js/ausschnitt.js';
import { zaehleKreuzungen, kleinsterAbstand, beschriftungFrei, LINIENBREITE_ABSTAND } from '../js/geometrie.js';
import { svgLesen } from '../werkzeuge/pruefen/svg.js';
import { SCHWIERIGKEITEN } from '../js/schwierigkeit.js';

const RICHTUNGEN = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const norm = (g) => ((g % 360) + 360) % 360;
const abstand = (a, b) => { const d = norm(a - b); return Math.min(d, 360 - d); };
function naechste(kurs) {
  let beste = 0;
  for (let j = 1; j < 16; j++) if (abstand(kurs, j * 22.5) < abstand(kurs, beste * 22.5)) beste = j;
  return beste;
}

// Ohne Angabe entstehen die Ausschnitte in der Schwierigkeit normal
const ANZAHL = 200;
const ausschnitte = {
  2: Array.from({ length: ANZAHL }, (_, i) => erzeugeAusschnitt(new Zufall(`ausschnitt-2-${i}`), 2)),
  3: Array.from({ length: ANZAHL }, (_, i) => erzeugeAusschnitt(new Zufall(`ausschnitt-3-${i}`), 3)),
};

// Kurs einer Segmentbeschriftung ("123°/15"", "SSE/10"", als Gegenkurs-Angabe
// "GK 303°/15"" für 123°, "GK NNW/10"" für SSE) oder null ("/15"", "HR/20"")
function segmentKurs(zeile) {
  let m;
  if ((m = zeile.match(/^(\d{3})°\/\d+"$/))) return Number(m[1]);
  if ((m = zeile.match(/^([A-Z]{1,3})\/\d+"$/)) && !['HR', 'GK'].includes(m[1])) return RICHTUNGEN.indexOf(m[1]) * 22.5;
  if ((m = zeile.match(/^GK (\d{3})°\/\d+"$/))) return norm(Number(m[1]) + 180);
  if ((m = zeile.match(/^GK ([A-Z]{1,3})\/\d+"$/))) return norm(RICHTUNGEN.indexOf(m[1]) * 22.5 + 180);
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
  if (art === 'gkAngabe') {
    assert.match(mitte.zeilen[0], /^GK (\d{3}°|[A-Z]{1,3})\/\d+"$/);
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

test('Ausschnitte Stufe 2: nur Elemente der Stufe 2, Gradzahl-Kurve nur als Aufgabe, Gates mit drei Zeilen', () => {
  let kurven = 0;
  const schleifen = { unter: 0, ueber: 0 };
  for (const a of ausschnitte[2]) {
    const svg = zeichneAusschnitt(a);
    assert.ok(!/>(HR|GK)[ /]/.test(svg), 'HR oder GK in Stufe 2');
    const kurve = a.elemente.filter((e) => e.art === 'kurve');
    assert.equal(kurve.length, a.art === 'kurve' ? 1 : 0, `${a.art}: Kurven`);
    if (a.art === 'kurve') {
      kurven += 1;
      schleifen[kurve[0].winkel > 180 ? 'ueber' : 'unter'] += 1;
      assert.ok(kurve[0].winkel >= 30 && kurve[0].winkel <= 350 && kurve[0].winkel !== 180);
      assert.equal(a.fragen.length, 1);
      assert.equal(a.fragen[0].text, 'Kurs nach der Kurve');
    }
    if (a.art === 'gate') assert.equal(a.fragen.length, 3);
  }
  assert.ok(kurven > 20, `nur ${kurven} Kurven-Ausschnitte`);
  assert.ok(schleifen.unter > 0 && schleifen.ueber > 0, `Kurven und Schleifen: ${JSON.stringify(schleifen)}`);
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

// Gegenkurs-Angabe wie im Gegenkursbeispiel: Die Beschriftung nennt den
// Gegenkurs, gezeichnet ist der tatsächliche Kurs, und der ist die Antwort
test('Ausschnitte Stufe 3: Angabe als Gegenkurs, gezeichnet und gefragt ist der tatsächliche Kurs', () => {
  let mitGk = 0;
  for (let i = 0; i < 40; i++) {
    const a = erzeugeAusschnitt(new Zufall(`gk-angabe-${i}`), 3, 'gkAngabe');
    const segment = a.elemente[1];
    assert.equal(segment.alsGegenkurs, true);
    assert.equal(a.fragen[0].loesung, segment.kurs);
    const svg = svgLesen(zeichneAusschnitt(a));
    const text = svg.texte.find((t) => /^GK (\d{3}°|[A-Z]{1,3})\//.test(t.zeilen[0]));
    assert.ok(text, 'Beschriftung mit GK');
    assert.equal(segmentKurs(text.zeilen[0]), segment.kurs);
    // Die zweite Strecke ist das Aufgabensegment, gezeichnet in seinem tatsächlichen Kurs
    const strecke = svg.stuecke.filter((st) => st.art === 'strecke')[1];
    assert.ok(abstand(strecke.kurs, segment.kurs) < 0.5, `gezeichnet ${strecke.kurs}, Kurs ${segment.kurs}`);
  }
  // Auch als Folgesegment oder mit Rechenaufgabe kommen Angaben als Gegenkurs vor
  for (const a of ausschnitte[3]) if (a.art !== 'gkAngabe' && a.elemente.some((e) => e.alsGegenkurs)) mitGk += 1;
  assert.ok(mitGk > 20, `nur ${mitGk} weitere Ausschnitte mit GK-Angabe`);
  assert.ok(!ausschnitte[3][0].elemente[0].alsGegenkurs && ausschnitte[3].every((a) => !a.elemente[0].alsGegenkurs), 'Startsegment ohne GK-Angabe');
  assert.ok(ausschnitte[2].every((a) => a.elemente.every((e) => !('alsGegenkurs' in e))), 'Stufe 2 ohne GK-Angabe');
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
  // Stufe 2 kennt die Gradzahl-Kurve, aber kein HR, GK und anl. Kurs
  assert.equal(erzeugeAusschnitt(new Zufall('x'), 2, 'kurve').art, 'kurve');
  for (const art of ['hr', 'hrKurs', 'gk', 'anl', 'gkAngabe']) assert.throws(() => erzeugeAusschnitt(new Zufall('x'), 2, art));
});

// ------------------------------------------------------------ Schwierigkeit

// Wertebereiche je Schwierigkeit, von bis, als Betrag: Kurs plus oder minus Zahl
// (Rechenaufgabe, relative Gate-Zeile ohne Gradzeichen), relative Ecke, Form A
// mit Gradzeichen, GK ± n, Himmelsrichtung ± n, Drehwinkel der Kurve
const BEREICHE = {
  leicht: { zahl: [20, 250], ecke: [20, 250], formA: [20, 150], gk: [10, 60], hr: [10, 130], kurve: [30, 250] },
  normal: { zahl: [20, 490], ecke: [20, 340], formA: [20, 190], gk: [10, 60], hr: [10, 130], kurve: [30, 350] },
  schwer: { zahl: [20, 490], ecke: [20, 340], formA: [20, 190], gk: [10, 60], hr: [10, 130], kurve: [151, 349] },
};
const JE_SCHWIERIGKEIT = 100;
const nachSchwierigkeit = Object.fromEntries([2, 3].map((stufe) => [stufe, Object.fromEntries(SCHWIERIGKEITEN.map((s) => [
  s, Array.from({ length: JE_SCHWIERIGKEIT }, (_, i) => erzeugeAusschnitt(new Zufall(`schwierig-${stufe}-${s}-${i}`), stufe, null, s)),
]))]));

// Alle Zahlen, die ein gezeichneter Ausschnitt nennt, nur aus dem Bild gelesen
function zahlenAusBild(svgText) {
  const { texte } = svgLesen(svgText);
  const w = { zahl: [], ecke: [], formA: [], gk: [], hr: [], hrRichtung: [], anl: [], anlProdukt: [], kurve: [], gateGrad: [], gateRichtung: [], rechenBasis: [] };
  for (const t of texte) {
    const erste = t.zeilen[0];
    let m;
    if (t.klasse === 'gate') {
      for (const zeile of t.zeilen) {
        const c = zeile.match(/^[→↗↘] (.+) \d+"$/);
        const a = c ? c[1] : zeile.replace(/ [→↗↘] \d+"$/, '');
        if ((m = a.match(/^([+-]\d+)°$/))) w.formA.push(Number(m[1]));
        else if ((m = a.match(/^([+-]\d+)$/))) w.zahl.push(Number(m[1]));
        else if ((m = a.match(/^GK ([+-]\d+)°$/))) w.gk.push(Number(m[1]));
        else if ((m = a.match(/^anl\. Kurs \+(\d)×(\d{1,2})$/))) w.anlProdukt.push([Number(m[1]), Number(m[2])]);
        else if ((m = a.match(/^anl\. Kurs \+(\d+)°$/))) w.anl.push(Number(m[1]));
        else if ((m = a.match(/^([A-Z]{1,3}) ([+-]\d+)°$/)) && m[1] !== 'GK') {
          w.hr.push(Number(m[2]));
          w.hrRichtung.push(RICHTUNGEN.indexOf(m[1]));
        } else if ((m = a.match(/^(\d{3})°$/))) w.gateGrad.push(Number(m[1]));
        else if ((m = a.match(/^([A-Z]{1,3})$/)) && a !== 'GK') w.gateRichtung.push(RICHTUNGEN.indexOf(m[1]));
      }
    } else if (t.zeilen.length === 1 && /^[+-]\d+°$/.test(erste)) w.ecke.push(parseInt(erste, 10));
    else if (t.zeilen.length === 1 && /^\d+$/.test(erste)) w.kurve.push(Number(erste));
    else if (t.zeilen.length === 2 && /\/\d+"$/.test(erste)) {
      w.zahl.push(Number(t.zeilen[1]));
      w.rechenBasis.push(segmentKurs(erste));
    }
  }
  return w;
}

function wertebereichePruefen(a, s) {
  const w = zahlenAusBild(zeichneAusschnitt(a));
  const b = BEREICHE[s];
  const text = `${s}, ${a.art}`;
  for (const art of ['zahl', 'ecke', 'formA', 'gk', 'hr']) {
    for (const wert of w[art]) {
      const betrag = Math.abs(wert);
      assert.ok(betrag >= b[art][0] && betrag <= b[art][1], `${text}: ${art} ${wert} außerhalb ${b[art]}`);
      if (s === 'leicht') assert.equal(betrag % 5, 0, `${text}: ${art} ${wert} nicht in Fünferschritten`);
      if (s === 'schwer') assert.notEqual(betrag % 5, 0, `${text}: ${art} ${wert} mit Endziffer 0 oder 5`);
    }
  }
  for (const wert of w.ecke) assert.notEqual(Math.abs(wert), 180);
  for (const winkel of w.kurve) {
    assert.ok(winkel >= b.kurve[0] && winkel <= b.kurve[1] && winkel !== 180, `${text}: Kurve ${winkel}`);
    if (s === 'leicht') assert.equal(winkel % 5, 0, `${text}: Kurve ${winkel}`);
    if (s === 'schwer') assert.equal(winkel % 2, 1, `${text}: Kurve ${winkel} gerade`);
  }
  if (s === 'leicht') {
    for (const i of [...w.hrRichtung, ...w.gateRichtung]) assert.ok(i % 2 === 0, `${text}: Richtung ${RICHTUNGEN[i]}`);
    for (const wert of w.anl) assert.ok(wert % 5 === 0 && wert >= 20 && wert <= 150, `${text}: anl. Kurs +${wert}`);
    assert.equal(w.anlProdukt.length, 0, `${text}: anl. Kurs mit Produkt`);
  }
  if (s === 'normal') {
    for (const wert of w.anl) assert.ok(wert >= 20 && wert <= 160);
    for (const [x, y] of w.anlProdukt) assert.ok(x >= 2 && x <= 9 && y >= 2 && y <= 13 && x * y >= 20 && x * y <= 160);
  }
  if (s === 'schwer') {
    for (const i of w.hrRichtung) assert.equal(i % 2, 1, `${text}: ${RICHTUNGEN[i]} ohne halben Grad`);
    assert.equal(w.anl.length, 0, `${text}: anl. Kurs ohne Produkt`);
    for (const [x, y] of w.anlProdukt) assert.ok(x % 5 !== 0 && y % 5 !== 0 && y >= 11 && x * y <= 160, `${text}: ${x}×${y}`);
  }
  return w;
}

for (const stufe of [2, 3]) {
  for (const s of SCHWIERIGKEITEN) {
    test(`Ausschnitte Stufe ${stufe}, ${s}: ${JE_SCHWIERIGKEIT} Lösungen nachgerechnet, kreuzungsfrei, Wertebereiche aus den Beschriftungen`, () => {
      const arten = new Set();
      for (const a of nachSchwierigkeit[stufe][s]) {
        assert.equal(a.schwierigkeit, s);
        arten.add(a.art);
        const nach = nachrechnen(zeichneAusschnitt(a), a.art);
        assert.equal(a.ankunft, nach.ankunft, `${a.art}: Ankunft`);
        assert.deepEqual(a.fragen.map((f) => f.loesung), nach.loesungen, `${s}, ${a.art}: Lösungen`);
        const geo = a.geometrie;
        assert.equal(zaehleKreuzungen(geo.stuecke), 0, `${a.art}: Kreuzung`);
        assert.ok(kleinsterAbstand(geo.stuecke, 0, geo.flugzeug) >= LINIENBREITE_ABSTAND, `${a.art}: Striche zu nah`);
        assert.ok(beschriftungFrei(geo), `${a.art}: Beschriftung verdeckt`);
        wertebereichePruefen(a, s);
      }
      assert.deepEqual(arten, new Set(AUSSCHNITT_ARTEN[stufe]), `${s}: nicht alle Arten`);
    });
  }
}

test('Ausschnitte nach Schwierigkeit: jede Art gezielt, Rechenaufgaben mit Überlauf und über 360 wie beim Kopfrechnen', () => {
  const zahlen = {};
  for (const s of SCHWIERIGKEITEN) {
    for (const stufe of [2, 3]) {
      for (const art of AUSSCHNITT_ARTEN[stufe]) {
        for (let i = 0; i < 5; i++) {
          const a = erzeugeAusschnitt(new Zufall(`gezielt-${s}-${stufe}-${art}-${i}`), stufe, art, s);
          assert.equal(a.art, art);
          assert.deepEqual(a.fragen.map((f) => f.loesung), nachrechnen(zeichneAusschnitt(a), art).loesungen, `${s}, ${art}`);
          wertebereichePruefen(a, s);
        }
      }
    }
    // Rechenaufgaben: Basis aus der Beschriftung, Zahl darunter
    zahlen[s] = Array.from({ length: 150 }, (_, i) => {
      const w = zahlenAusBild(zeichneAusschnitt(erzeugeAusschnitt(new Zufall(`rechen-${s}-${i}`), 2, 'rechen', s)));
      return { basis: w.rechenBasis[0], zahl: w.zahl[0] };
    });
  }
  const anteil = (liste, bedingung) => liste.filter(bedingung).length / liste.length;
  const ueber = (x) => x.basis + x.zahl >= 360 || x.basis + x.zahl < 0;
  const leicht = anteil(zahlen.leicht, ueber);
  assert.ok(leicht > 0.1 && leicht <= 0.45, `leicht: Überlauf in ${leicht}`);
  const normal = anteil(zahlen.normal, ueber);
  assert.ok(normal >= 0.35 && normal <= 0.65, `normal: Überlauf in ${normal}`);
  const gross = anteil(zahlen.schwer, (x) => Math.abs(x.zahl) > 360);
  assert.ok(gross >= 0.2 && gross <= 0.47, `schwer: über 360 in ${gross}`);
  assert.ok(anteil(zahlen.schwer, ueber) >= 0.5, 'schwer: Überlauf zu selten');
  // Himmelsrichtung ± n mit halbem Grad im Ergebnis bei schwer, auch im Ausschnitt
  let halbe = 0;
  for (let i = 0; i < 30; i++) {
    const a = erzeugeAusschnitt(new Zufall(`anl-schwer-${i}`), 3, 'anl', 'schwer');
    halbe += a.fragen.filter((f) => f.antwort === 'kurs' && !Number.isInteger(f.loesung)).length;
  }
  assert.ok(halbe > 0, 'keine halben Grade bei schwer');
});

test('Ausschnitte: ohne Schwierigkeit gilt normal, eine unbekannte ebenso', () => {
  for (const stufe of [2, 3]) {
    const eins = zeichneAusschnitt(erzeugeAusschnitt(new Zufall(`vorgabe-${stufe}`), stufe));
    assert.equal(zeichneAusschnitt(erzeugeAusschnitt(new Zufall(`vorgabe-${stufe}`), stufe, null, 'normal')), eins);
    assert.equal(zeichneAusschnitt(erzeugeAusschnitt(new Zufall(`vorgabe-${stufe}`), stufe, null, 'mittel')), eins);
    assert.equal(erzeugeAusschnitt(new Zufall(`vorgabe-${stufe}`), stufe).schwierigkeit, 'normal');
  }
});
