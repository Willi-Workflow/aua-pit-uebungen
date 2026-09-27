import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { erzeugeBlatt, BLAETTER_JE_STUFE, STUFEN, hatGates } from '../js/blatt.js';
import { differenz } from '../js/kurs.js';
import { STUFE3, KURVENRATE } from '../js/elemente.js';
import {
  beschriftungFrei, beschriftungsAbstand, kleinsterAbstand, zaehleKreuzungen, startOben, LINIENBREITE_ABSTAND,
} from '../js/geometrie.js';

// Alle Blätter beider Stufen einmal erzeugen, die Prüfungen unten teilen sie sich
const beginn = Date.now();
const blaetter = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => erzeugeBlatt(2, i + 1));
const dauer = Date.now() - beginn;
// Rechenzeit je Blatt als CPU-Zeit: Die Wanduhr zählt parallel laufende
// Prüfdateien und einen Ruhezustand des Rechners mit. Die CPU-Zeit zählt
// dagegen die Fäden mit, die den Code der Stufe 3 beim ersten Aufruf übersetzen;
// das fiel ganz auf Blatt 1 (allein 320 bis 360 ms statt rund 190, unter Last bis
// 540). Ein Blatt vorab, ungemessen, nimmt diese einmalige Übersetzung heraus.
erzeugeBlatt(3, BLAETTER_JE_STUFE);
const zeiten3 = [];
const blaetter3 = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => {
  const start = process.cpuUsage();
  const blatt = erzeugeBlatt(3, i + 1);
  const { user, system } = process.cpuUsage(start);
  zeiten3.push((user + system) / 1000);
  return blatt;
});

// Fingerabdruck (SHA-256) des JSON aller 100 Blätter der Stufe 2. Stufe 3 hat
// eigene Zufallsschlüssel und Erzeugungspfade; ändert sich hier etwas, hat eine
// Änderung Stufe 2 mitverändert. Seit dem Bau der Stufe 3 bewusst geändert nur
// durch den Ausschluss der Gate-Zeilen, die genau auf dem Gegenkurs enden: Das
// betraf allein Blatt 51 (vorher 2f4d1e59…1864723).
const STUFE2_FINGERABDRUCK = 'ac5eff849283b6c5355e9620af915aded66c4f2e5b2ca4abace9787f37c2d97c';

test('Konstanten', () => {
  assert.equal(BLAETTER_JE_STUFE, 100);
  assert.deepEqual(STUFEN, [2, 3]);
});

test('Stufe 2 ist Byte für Byte unverändert', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(blaetter)).digest('hex'), STUFE2_FINGERABDRUCK);
});

test('unbekannte Stufe und ungültige Nummern werfen', () => {
  assert.throws(() => erzeugeBlatt(4, 1), /Stufe 4/);
  assert.throws(() => erzeugeBlatt(1, 1), /Stufe 1/);
  assert.throws(() => erzeugeBlatt(3, 0), /Blatt 0/);
  assert.throws(() => erzeugeBlatt(2, 0), /Blatt 0/);
  assert.throws(() => erzeugeBlatt(2, 101), /Blatt 101/);
  assert.throws(() => erzeugeBlatt(2, 1.5), /Blatt 1.5/);
});

test('gleiche Nummer, gleiches Blatt; verschiedene Nummern, verschiedene Blätter', () => {
  assert.deepEqual(erzeugeBlatt(2, 7), erzeugeBlatt(2, 7));
  assert.notDeepEqual(erzeugeBlatt(2, 7).textteil, erzeugeBlatt(2, 8).textteil);
});

test('hatGates: Nummer teilbar durch 3', () => {
  assert.equal(hatGates(2, 3), true);
  assert.equal(hatGates(2, 99), true);
  assert.equal(hatGates(2, 1), false);
  assert.equal(hatGates(2, 7), false);
  assert.equal(hatGates(2, 100), false);
  assert.equal(hatGates(3, 1), true);
  assert.equal(hatGates(3, 100), true);
});

test('alle 100 Blätter der Stufe 2 entstehen, Gates nur bei Nummern teilbar durch 3, mindestens 90 zulässig', () => {
  const gruppen = { mit: { blaetter: 0, zulaessig: 0 }, ohne: { blaetter: 0, zulaessig: 0 } };
  let kandidatenSumme = 0;
  for (const blatt of blaetter) {
    const { nummer } = blatt;
    assert.equal(blatt.stufe, 2);
    assert.equal(blatt.nummer, nummer);
    assert.equal(blatt.textteil.zeilen.length, 12);
    assert.ok(blatt.parcours.elemente.length >= 20);
    const anzahlGates = blatt.parcours.elemente.filter((e) => e.art === 'gate').length;
    if (nummer % 3 === 0) {
      assert.ok(anzahlGates >= 3 && anzahlGates <= 4, `Blatt ${nummer}: ${anzahlGates} Gates`);
    } else {
      assert.equal(anzahlGates, 0, `Blatt ${nummer} hat Gates`);
    }
    const gruppe = hatGates(2, nummer) ? gruppen.mit : gruppen.ohne;
    gruppe.blaetter += 1;
    kandidatenSumme += blatt.parcours.kandidat;
    if (blatt.parcours.zulaessig) gruppe.zulaessig += 1;
  }
  const zulaessig = gruppen.mit.zulaessig + gruppen.ohne.zulaessig;
  console.log(`Stufe 2: ${zulaessig} von ${BLAETTER_JE_STUFE} Blättern zulässig, mit Gates ${gruppen.mit.zulaessig} von ${gruppen.mit.blaetter}, ohne Gates ${gruppen.ohne.zulaessig} von ${gruppen.ohne.blaetter}; Siegerkandidat im Mittel Nummer ${kandidatenSumme / BLAETTER_JE_STUFE}, ${dauer} ms, ${dauer / BLAETTER_JE_STUFE} ms je Blatt`);
  assert.equal(gruppen.mit.blaetter, 33);
  assert.ok(zulaessig >= 90, `nur ${zulaessig} von ${BLAETTER_JE_STUFE} zulässig`);
  assert.ok(gruppen.mit.zulaessig >= 27, `nur ${gruppen.mit.zulaessig} von ${gruppen.mit.blaetter} Blättern mit Gates zulässig`);
});

test('der Parcours beginnt in beiden Stufen 20 bis 160 Grad vom Endkurs des Textteils', () => {
  for (const blatt of [...blaetter, ...blaetter3]) {
    const endkurs = blatt.textteil.zeilen[blatt.textteil.zeilen.length - 1].kursDanach;
    const erstes = blatt.parcours.elemente[0];
    assert.equal(erstes.art, 'segment');
    const a = Math.abs(differenz(endkurs, erstes.kurs));
    assert.ok(a >= 20 && a <= 160, `Stufe ${blatt.stufe}, Blatt ${blatt.nummer}: ${endkurs} auf ${erstes.kurs}, ${a}°`);
  }
});

// Nach "gedreht wird auf kürzestem Weg" bliebe bei genau 180° die Drehrichtung
// offen (Blatt 51 hatte "-180 ↘ 10"" von 303° auf 123°)
test('Stufe 2: keine relative Gate-Zeile, deren Kurs danach genau der Gegenkurs ist', () => {
  for (const blatt of blaetter) {
    let kurs = null;
    for (const e of blatt.parcours.elemente) {
      if (e.art === 'segment') kurs = e.kurs;
      if (e.art !== 'gate') continue;
      for (const z of e.zeilen) {
        if (z.kurs.typ === 'relativ') {
          const a = Math.abs(differenz(kurs, z.kursDanach));
          assert.notEqual(a, 180, `Blatt ${blatt.nummer}: ${kurs} ${z.kurs.wert} = ${z.kursDanach}`);
        }
        kurs = z.kursDanach;
      }
    }
  }
});

test('Stufe 3: gleiche Nummer, gleiches Blatt; Textteil wie Stufe 2 mit zwölf Sätzen ab 090°, 2000 ft', () => {
  assert.deepEqual(erzeugeBlatt(3, 7), blaetter3[6]);
  assert.notDeepEqual(blaetter3[6].parcours.elemente, blaetter3[7].parcours.elemente);
  assert.notDeepEqual(blaetter3[6].textteil, blaetter3[7].textteil);
  for (const blatt of blaetter3) {
    assert.equal(blatt.stufe, 3);
    assert.equal(blatt.textteil.ausgangskurs, 90);
    assert.equal(blatt.textteil.ausgangshoehe, 2000);
    assert.equal(blatt.textteil.zeilen.length, 12);
    assert.ok(blatt.textteil.zeilen.every((z) => typeof z.satz === 'string' && z.satz.length > 0));
  }
});

// Höhen im Parcours der Stufe 3 in Flugreihenfolge ab "hoehe": Segmente,
// Kreishälften (60 s), Kurven (Winkel / 3 s) und Gate-Zeilen, 8 ft je Sekunde
function hoehenStufe3(elemente, hoehe) {
  const verlauf = [];
  const fliegen = (profil, sekunden) => {
    if (profil === 'steigen') hoehe += 8 * sekunden;
    if (profil === 'sinken') hoehe -= 8 * sekunden;
    verlauf.push(hoehe);
  };
  for (const e of elemente) {
    if (e.art === 'segment') fliegen(e.profil, e.dauer);
    else if (e.art === 'vollkreis') e.profile.forEach((p) => fliegen(p, 60));
    else if (e.art === 'kurve') fliegen(e.profil, e.winkel / KURVENRATE);
    else e.zeilen.forEach((z) => fliegen(z.profil, z.dauer));
  }
  return verlauf;
}

test('Stufe 3: Höhe im Parcours ab dem Ende des Textteils zwischen 1000 und 3000 ft', () => {
  const anfaenge = new Set();
  for (const blatt of blaetter3) {
    const ende = blatt.textteil.zeilen[blatt.textteil.zeilen.length - 1].hoeheDanach;
    anfaenge.add(ende);
    const verlauf = hoehenStufe3(blatt.parcours.elemente, ende);
    assert.ok(verlauf.every((h) => h >= 1000 - 1e-9 && h <= 3000 + 1e-9), `Blatt ${blatt.nummer}: ${Math.min(...verlauf)} bis ${Math.max(...verlauf)} ft`);
  }
  assert.ok(anfaenge.size > 5, 'der Parcours beginnt nicht immer auf derselben Höhe');
});

test('Stufe 3: alle 100 Blätter entstehen, mindestens 90 zulässig, jedes unter 500 ms CPU-Zeit', () => {
  const zulaessig = blaetter3.filter((b) => b.parcours.zulaessig).length;
  const mittel = zeiten3.reduce((s, z) => s + z, 0) / zeiten3.length;
  const sortiert = [...zeiten3].sort((a, b) => a - b);
  console.log(`Stufe 3: ${zulaessig} von ${BLAETTER_JE_STUFE} Blättern zulässig; CPU-Zeit je Blatt Median ${sortiert[50].toFixed(0)} ms, Mittel ${mittel.toFixed(0)} ms, höchstens ${sortiert[99].toFixed(0)} ms (Blatt ${zeiten3.indexOf(sortiert[99]) + 1})`);
  assert.ok(zulaessig >= 90, `nur ${zulaessig} zulässig`);
  assert.ok(sortiert[99] < 500, `bis ${sortiert[99]} ms je Blatt`);
  for (const blatt of blaetter3) {
    if (!blatt.parcours.zulaessig) continue;
    const geo = blatt.parcours.geometrie;
    assert.equal(zaehleKreuzungen(geo.stuecke, Infinity, true), 0, `Blatt ${blatt.nummer}`);
    assert.ok(kleinsterAbstand(geo.stuecke, 0, geo.flugzeug, true) >= LINIENBREITE_ABSTAND, `Blatt ${blatt.nummer}`);
    assert.equal(beschriftungFrei(geo), true, `Blatt ${blatt.nummer}`);
    assert.equal(startOben(geo), true, `Blatt ${blatt.nummer}`);
    assert.equal(geo.drehung, 0);
  }
});

// Ein- und Ausfahrt einer Schleife (Strecke, Bogen über 180°, Strecke): Kreuzung
// und ihr Abstand zu den äußeren Enden (Anfang der Einfahrt, Ende der Ausfahrt),
// ohne Kreuzung der kleinste Abstand der Mittellinien
function schleifenLage(ein, aus) {
  const [p, q] = ein.punkte;
  const [r, s] = aus.punkte;
  const d1 = { x: q.x - p.x, y: q.y - p.y };
  const d2 = { x: s.x - r.x, y: s.y - r.y };
  const kreuz = (a, b) => a.x * b.y - a.y * b.x;
  const nenner = kreuz(d1, d2);
  const w = { x: r.x - p.x, y: r.y - p.y };
  const t = nenner === 0 ? -1 : kreuz(w, d2) / nenner;
  const u = nenner === 0 ? -1 : kreuz(w, d1) / nenner;
  if (t > 0 && t < 1 && u > 0 && u < 1) {
    return { kreuzung: true, vorEnden: Math.min(t * Math.hypot(d1.x, d1.y), (1 - u) * Math.hypot(d2.x, d2.y)) };
  }
  const punktStrecke = (x, a, b) => {
    const v = { x: b.x - a.x, y: b.y - a.y };
    const k = Math.max(0, Math.min(1, ((x.x - a.x) * v.x + (x.y - a.y) * v.y) / (v.x * v.x + v.y * v.y)));
    return Math.hypot(x.x - a.x - k * v.x, x.y - a.y - k * v.y);
  };
  return { kreuzung: false, abstand: Math.min(punktStrecke(p, r, s), punktStrecke(q, r, s), punktStrecke(r, p, q), punktStrecke(s, p, q)) };
}

test('Stufe 3: Schleifen kreuzen Ein- und Ausfahrt sauber, kein Segment endet im Strich einer Einfahrt', () => {
  let sauber = 0;
  for (const blatt of blaetter3) {
    const { stuecke } = blatt.parcours.geometrie;
    for (let i = 0; i + 2 < stuecke.length; i++) {
      if (stuecke[i].art !== 'strecke' || !stuecke[i + 1].schleife || stuecke[i + 2].art !== 'strecke') continue;
      const lage = schleifenLage(stuecke[i], stuecke[i + 2]);
      if (lage.kreuzung) {
        assert.ok(lage.vorEnden >= LINIENBREITE_ABSTAND, `Blatt ${blatt.nummer}, Stück ${i + 1}: Kreuzung ${lage.vorEnden.toFixed(1)} vor einem Ende`);
        sauber += 1;
      } else {
        assert.ok(lage.abstand >= LINIENBREITE_ABSTAND, `Blatt ${blatt.nummer}, Stück ${i + 1}: Ausfahrt ${lage.abstand.toFixed(1)} neben der Einfahrt`);
      }
    }
  }
  assert.ok(sauber > 100, `nur ${sauber} Schleifen mit Kreuzung`);
});

// Jede Beschriftung an einem Segment, einer Ecke oder einer Kurve steht ihrem
// eigenen Stück deutlich näher als jedem fremden, dem man sie zuordnen könnte:
// Das nächste ist mindestens 1,5-mal so weit weg (Achse der Kapsel zur
// Mittellinie). Eigen sind das beschriftete Stück und die angrenzenden seiner
// Figur. Mitbewerber einer Bogenangabe sind alle fremden Bögen außer
// Vollkreishälften (Vollkreise tragen nie eine Angabe), einer Segmentbeschriftung
// alle fremden Strecken, die höchstens 20° gegen die eigene geneigt sind. Vorher
// standen Bogenangaben näher an fremden Bögen (Blatt 2, 51, 63, 74) und
// Segmentbeschriftungen zwischen parallelen Strecken (Blatt 56, 97).
function mitbewerber(eigenes, fremd) {
  if (fremd.art !== eigenes.art) return false;
  if (fremd.art === 'bogen') return !(fremd.kreis && !fremd.schleife && !fremd.kurve);
  const richtung = (s) => Math.atan2(s.punkte[1].y - s.punkte[0].y, s.punkte[1].x - s.punkte[0].x);
  const neigung = Math.abs(Math.sin(richtung(eigenes) - richtung(fremd)));
  return neigung <= Math.sin((20 * Math.PI) / 180) + 1e-9;
}

test('Stufe 3: Beschriftungen stehen ihrem Stück deutlich näher als jedem fremden', () => {
  let geprueft = 0;
  for (const blatt of blaetter3) {
    if (!blatt.parcours.zulaessig) continue;
    const { stuecke, beschriftungen } = blatt.parcours.geometrie;
    for (const b of beschriftungen) {
      if (b.gate || b.fett) continue;
      const art = b.zeilen[0].includes('/') ? 'strecke' : 'bogen';
      const eigenes = b.eigeneStuecke.find((i) => stuecke[i].art === art);
      const eigen = beschriftungsAbstand(b, stuecke[eigenes].punkte);
      let fremd = Infinity;
      stuecke.forEach((s, i) => {
        if (!b.eigeneStuecke.includes(i) && mitbewerber(stuecke[eigenes], s)) fremd = Math.min(fremd, beschriftungsAbstand(b, s.punkte));
      });
      assert.ok(fremd >= 1.5 * eigen, `Blatt ${blatt.nummer}, ${b.zeilen.join(' | ')}: eigen ${eigen.toFixed(1)}, fremd ${fremd.toFixed(1)}`);
      geprueft += 1;
    }
  }
  assert.ok(geprueft > 2500, `nur ${geprueft} Beschriftungen`);
});

// "Start" gehört sichtbar zum Flugzeugsymbol, "Ende" zum Ende des Wegs: Der
// eigene Punkt ist mindestens 1,5-mal näher als der andere (Achse der
// Beschriftung zum Punkt). Auf Blatt 92 stand einmal "Start 2000 ft" direkt unter "Ende".
test('Stufe 3: Start und Ende stehen deutlich näher an ihrem eigenen Punkt als am anderen', () => {
  for (const blatt of blaetter3) {
    const { beschriftungen, flugzeug, marken } = blatt.parcours.geometrie;
    const ende = marken[marken.length - 1].punkt;
    const punkt = (p) => [p, p];
    for (const b of beschriftungen.filter((x) => x.fett)) {
      const [eigen, fremd] = b.zeilen[0] === 'Ende' ? [ende, flugzeug.mitte] : [flugzeug.mitte, ende];
      const de = beschriftungsAbstand(b, punkt(eigen));
      const df = beschriftungsAbstand(b, punkt(fremd));
      assert.ok(df >= 1.5 * de, `Blatt ${blatt.nummer}, ${b.zeilen[0]}: eigen ${de.toFixed(1)}, fremd ${df.toFixed(1)}`);
    }
  }
});

test('Stufe 3: Mengen je Blatt, Start und Ende beschriftet, alle Elemente der Vorlagen kommen vor', () => {
  const formen = { a: 0, b: 0, c: 0 };
  const zahlen = { kurve: 0, vollkreis: 0, hr: 0, hrKurs: 0, gk: 0, gkZeileA: 0, gkZeileC: 0, relativ: 0, anl: 0, anschluss: 0, rechen: 0, himmel: 0 };
  let blaetterMitAnl = 0;
  for (const blatt of blaetter3) {
    const { elemente, geometrie } = blatt.parcours;
    const segmente = elemente.filter((e) => e.art === 'segment');
    const n = (art) => elemente.filter((e) => e.art === art).length;
    const bereich = (wert, [von, bis], name) => assert.ok(wert >= von && wert <= bis, `Blatt ${blatt.nummer}: ${wert} ${name}`);
    bereich(segmente.length, STUFE3.segmente, 'Segmente');
    bereich(n('vollkreis'), STUFE3.vollkreise, 'Vollkreise');
    bereich(n('kurve'), STUFE3.kurven, 'Kurven');
    bereich(n('gate'), STUFE3.gates, 'Gates');
    bereich(segmente.filter((e) => e.relativ !== null).length, STUFE3.relative, 'relative Ecken');
    bereich(segmente.filter((e) => ['hr', 'hrKurs'].includes(e.anzeige)).length, STUFE3.hr, 'HR');
    bereich(segmente.filter((e) => e.anzeige === 'gk').length, STUFE3.gkSegmente, 'GK-Segmente');
    bereich(segmente.filter((e) => e.rechenaufgabe !== null).length, STUFE3.rechenaufgaben, 'Rechenaufgaben');
    bereich(segmente.filter((e) => e.anzeige === 'himmelsrichtung').length, STUFE3.himmelsrichtungen, 'Himmelsrichtungen');
    const texte = geometrie.beschriftungen.map((b) => b.zeilen.join(' | '));
    // Nur "Start": Die Höhe kommt vom Ende des Textteils
    assert.equal(texte.filter((z) => z === 'Start').length, 1, `Blatt ${blatt.nummer}: Start`);
    assert.ok(!texte.some((z) => z.includes('2000 ft')), `Blatt ${blatt.nummer}: Höhe am Start`);
    assert.equal(texte.filter((z) => z === 'Ende').length, 1, `Blatt ${blatt.nummer}: Ende`);
    let anl = 0;
    for (const e of elemente) {
      if (e.art === 'gate') {
        formen[e.form] += 1;
        if (e.anschluss) zahlen.anschluss += 1;
        anl += e.zeilen.filter((z) => z.kurs.typ.startsWith('anl')).length;
        const gk = e.zeilen.filter((z) => z.kurs.typ === 'gk' || z.kurs.typ === 'gkPlus').length;
        if (e.form === 'a') zahlen.gkZeileA += gk;
        if (e.form === 'c') zahlen.gkZeileC += gk;
      } else if (e.art === 'kurve') zahlen.kurve += 1;
      else if (e.art === 'vollkreis') zahlen.vollkreis += 1;
      else {
        if (['hr', 'hrKurs', 'gk'].includes(e.anzeige)) zahlen[e.anzeige] += 1;
        if (e.relativ !== null) zahlen.relativ += 1;
        if (e.rechenaufgabe !== null) zahlen.rechen += 1;
        if (e.anzeige === 'himmelsrichtung') zahlen.himmel += 1;
      }
    }
    assert.ok(anl <= 1, `Blatt ${blatt.nummer}: ${anl} Zeilen anl. Kurs`);
    if (anl) blaetterMitAnl += 1;
  }
  zahlen.anl = blaetterMitAnl;
  console.log(`Stufe 3, 100 Blätter: Gate-Formen ${JSON.stringify(formen)}, Elemente ${JSON.stringify(zahlen)}`);
  const summe = formen.a + formen.b + formen.c;
  for (const f of ['a', 'b', 'c']) assert.ok(formen[f] / summe > 0.25 && formen[f] / summe < 0.42, JSON.stringify(formen));
  for (const [name, zahl] of Object.entries(zahlen)) assert.ok(zahl > 0, `${name} kommt auf keinem Blatt vor`);
  assert.equal(zahlen.anschluss, formen.a, 'jedes Gate der Form A hat eine Anschlusszeile');
  assert.ok(blaetterMitAnl < 60, `anl. Kurs auf ${blaetterMitAnl} Blättern, soll selten sein`);
});

// Gegenkurs wie in der Handzeichnung drei- bis fünfmal je Blatt: 1 bis 2
// Segmente "GK/…", nie zwei direkt hintereinander, und 2 bis 3 Gate-Zeilen "GK"
// oder "GK ± n"; jedes Gate der Form C mit mindestens einer, Form A mit
// höchstens einer, Form B ohne. Vorher hatten 21 von 100 Blättern kein GK.
test('Stufe 3: Gegenkurs mindestens dreimal je Blatt, meist vier- bis fünfmal', () => {
  const jeBlatt = {};
  const summe = { segmente: 0, zeilen: 0 };
  for (const blatt of blaetter3) {
    const { elemente } = blatt.parcours;
    const segmente = elemente.filter((e) => e.art === 'segment');
    const gkSegmente = segmente.filter((e) => e.anzeige === 'gk').length;
    segmente.forEach((e, j) => {
      if (j > 0 && e.anzeige === 'gk') assert.notEqual(segmente[j - 1].anzeige, 'gk', `Blatt ${blatt.nummer}: zwei GK-Segmente hintereinander`);
    });
    let gkZeilen = 0;
    for (const e of elemente) {
      if (e.art !== 'gate') continue;
      const n = e.zeilen.filter((z) => z.kurs.typ === 'gk' || z.kurs.typ === 'gkPlus').length;
      if (e.form === 'c') assert.ok(n >= 1, `Blatt ${blatt.nummer}: Form C ohne GK`);
      if (e.form === 'a') assert.ok(n <= 1, `Blatt ${blatt.nummer}: Form A mit ${n} GK`);
      if (e.form === 'b') assert.equal(n, 0, `Blatt ${blatt.nummer}: Form B mit GK`);
      gkZeilen += n;
    }
    assert.ok(gkSegmente >= STUFE3.gkSegmente[0] && gkSegmente <= STUFE3.gkSegmente[1], `Blatt ${blatt.nummer}: ${gkSegmente} GK-Segmente`);
    assert.ok(gkZeilen >= STUFE3.gkZeilen[0] && gkZeilen <= STUFE3.gkZeilen[1], `Blatt ${blatt.nummer}: ${gkZeilen} GK-Zeilen`);
    assert.ok(gkSegmente + gkZeilen >= 3, `Blatt ${blatt.nummer}: nur ${gkSegmente + gkZeilen} GK`);
    jeBlatt[gkSegmente + gkZeilen] = (jeBlatt[gkSegmente + gkZeilen] || 0) + 1;
    summe.segmente += gkSegmente;
    summe.zeilen += gkZeilen;
  }
  console.log(`Stufe 3, GK je Blatt: ${JSON.stringify(jeBlatt)}; ${summe.segmente} Segmente, ${summe.zeilen} Gate-Zeilen`);
  // "meist 4 bis 5"
  assert.ok((jeBlatt[4] || 0) + (jeBlatt[5] || 0) >= 60, JSON.stringify(jeBlatt));
});
