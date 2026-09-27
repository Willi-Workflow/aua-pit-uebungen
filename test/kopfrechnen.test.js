import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Zufall } from '../js/zufall.js';
import { KOPF_ARTEN, ARTEN_GEWICHTE, erzeugeKopfaufgabe, baueKopfaufgabe, ziffernFolge, klangPfad } from '../js/kopfrechnen.js';
import { SCHWIERIGKEITEN } from '../js/schwierigkeit.js';
import { eingabeLesen, kursRichtig, kursAnzeige, frageRichtig, loesungText } from '../js/antwort.js';

const RICHTUNGEN = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const norm = (g) => ((g % 360) + 360) % 360;
const abstand = (a, b) => { const d = norm(a - b); return Math.min(d, 360 - d); };
const zehner = (n) => n % 10 === 0;
const ohneFuenfer = (n) => n % 5 !== 0;
const imBereich = (n, von, bis) => n >= von && n <= bis;
const ueberlauf = (basis, zahl) => basis + zahl >= 360 || basis + zahl < 0;
const RECHNEND = ['kursPlusZahl', 'gkPlus', 'richtungPlus', 'gkRichtung', 'anlKurs'];

// Je Schwierigkeit 500 Aufgaben je Art, jede mit eigenem Zufall
const ANZAHL = 500;
const jeArt = Object.fromEntries(SCHWIERIGKEITEN.map((s) => [s, Object.fromEntries(KOPF_ARTEN.map((art) => [
  art, Array.from({ length: ANZAHL }, (_, i) => erzeugeKopfaufgabe(new Zufall(`kopf-${s}-${art}-${i}`), art, s)),
]))]));

function richtung(name) {
  assert.ok(RICHTUNGEN.includes(name), `unbekannte Richtung ${name}`);
  return RICHTUNGEN.indexOf(name);
}
const zeichen = (z) => (z === '+' ? 1 : -1);
const klang = (zahl) => (zahl < 0 ? 'op_minus' : 'op_plus');
const ziffern = (text) => [...text].map((z) => `n${z}`);

// Liest nur den geschriebenen Text, ohne die Felder der Aufgabe: Art, Lösung,
// Basis und Zahl (für den Überlauf), die übrigen Teile für die Wertebereiche und
// die Tonfolge, wie sie aus dem Text folgt
function ausDemText(text) {
  let m;
  if ((m = text.match(/^(\d{3}) ([+−]) (\d+)$/))) {
    const kurs = Number(m[1]);
    const zahl = zeichen(m[2]) * Number(m[3]);
    return { art: 'kursPlusZahl', loesung: norm(kurs + zahl), kurs, basis: kurs, zahl, ton: ['name_kurs', ...ziffern(m[1]), klang(zahl), `n${m[3]}`] };
  }
  if ((m = text.match(/^Gegenkurs von (\d{3})$/))) {
    return { art: 'gegenkurs', loesung: norm(Number(m[1]) + 180), kurs: Number(m[1]), ton: ['gegenkurs_von', ...ziffern(m[1])] };
  }
  if ((m = text.match(/^([A-Z]{1,3}) in Grad$/))) {
    const index = richtung(m[1]);
    return { art: 'richtungInGrad', loesung: index * 22.5, index, ton: ['himmelsrichtung', `hr_${m[1]}`, 'grad'] };
  }
  if ((m = text.match(/^Nächste Himmelsrichtung zu (\d{3})$/))) {
    // Die Richtung mit dem kleinsten Abstand, durch Probieren aller 16
    const kurs = Number(m[1]);
    let beste = 0;
    for (let j = 1; j < 16; j++) if (abstand(kurs, j * 22.5) < abstand(kurs, beste * 22.5)) beste = j;
    return { art: 'naechsteRichtung', loesung: beste, kurs, ton: ['naechste_himmelsrichtung_zu', ...ziffern(m[1])] };
  }
  if ((m = text.match(/^GK ([+−])(\d+)° ab (\d{3})$/))) {
    const kurs = Number(m[3]);
    const zahl = zeichen(m[1]) * Number(m[2]);
    const basis = norm(kurs + 180);
    return { art: 'gkPlus', loesung: norm(basis + zahl), kurs, basis, zahl, ton: ['gegenkurs_von', ...ziffern(m[3]), klang(zahl), `n${m[2]}`] };
  }
  if ((m = text.match(/^GK von ([A-Z]{1,3}) ([+−])(\d+)°$/))) {
    const index = richtung(m[1]);
    const zahl = zeichen(m[2]) * Number(m[3]);
    const basis = norm(index * 22.5 + 180);
    return { art: 'gkRichtung', loesung: norm(basis + zahl), index, basis, zahl, ton: ['gegenkurs_von', `hr_${m[1]}`, klang(zahl), `n${m[3]}`] };
  }
  if ((m = text.match(/^([A-Z]{1,3}) ([+−])(\d+)°$/))) {
    const index = richtung(m[1]);
    const zahl = zeichen(m[2]) * Number(m[3]);
    const basis = index * 22.5;
    return { art: 'richtungPlus', loesung: norm(basis + zahl), index, basis, zahl, ton: ['himmelsrichtung', `hr_${m[1]}`, klang(zahl), `n${m[3]}`] };
  }
  if ((m = text.match(/^anl\. Kurs (\d{3}) \+(\d)×(\d{1,2})$/))) {
    const kurs = Number(m[1]);
    const a = Number(m[2]);
    const b = Number(m[3]);
    return { art: 'anlKurs', loesung: norm(kurs + a * b), kurs, basis: kurs, zahl: a * b, a, b, ton: ['anliegender_kurs', ...ziffern(m[1]), 'op_plus', `n${a}`, 'op_mal', `n${b}`] };
  }
  if ((m = text.match(/^anl\. Kurs (\d{3}) \+(\d+)°$/))) {
    const kurs = Number(m[1]);
    const zahl = Number(m[2]);
    return { art: 'anlKurs', loesung: norm(kurs + zahl), kurs, basis: kurs, zahl, ton: ['anliegender_kurs', ...ziffern(m[1]), 'op_plus', `n${zahl}`] };
  }
  throw new Error(`Aufgabentext nicht lesbar: ${text}`);
}

const anteil = (liste, bedingung) => liste.filter(bedingung).length / liste.length;
const gelesen = (s, art) => jeArt[s][art].map((a) => ausDemText(a.text));

test('Kopfrechnen: acht Arten, jede liefert je Schwierigkeit Aufgabe, Lösung und Tonfolge', () => {
  assert.deepEqual(KOPF_ARTEN, ['kursPlusZahl', 'gegenkurs', 'richtungInGrad', 'naechsteRichtung', 'gkPlus', 'richtungPlus', 'gkRichtung', 'anlKurs']);
  assert.deepEqual(SCHWIERIGKEITEN, ['leicht', 'normal', 'schwer']);
  for (const s of SCHWIERIGKEITEN) {
    for (const [art, aufgaben] of Object.entries(jeArt[s])) {
      assert.equal(aufgaben.length, ANZAHL);
      for (const a of aufgaben) {
        assert.equal(a.art, art);
        assert.ok(typeof a.text === 'string' && a.text.length > 0);
        assert.ok(Array.isArray(a.tonfolge) && a.tonfolge.length >= 3, `${a.text}: Tonfolge zu kurz`);
        assert.equal(a.antwort, art === 'naechsteRichtung' ? 'richtung' : 'kurs');
        assert.ok(Number.isFinite(a.loesung));
      }
    }
  }
});

test('Kopfrechnen: je Schwierigkeit Lösung und Tonfolge aus dem Aufgabentext nachgerechnet (modulo 360, Halbgrade)', () => {
  for (const s of SCHWIERIGKEITEN) {
    for (const [art, aufgaben] of Object.entries(jeArt[s])) {
      for (const a of aufgaben) {
        const nach = ausDemText(a.text);
        assert.equal(nach.art, art, a.text);
        assert.equal(a.loesung, nach.loesung, `${s}: ${a.text}`);
        assert.deepEqual(a.tonfolge, nach.ton, `${s}: ${a.text}`);
        if (a.antwort === 'kurs') assert.ok(a.loesung >= 0 && a.loesung < 360, a.text);
        // Eine halbe Gradzahl ist richtig mit beiden ganzen Nachbarn und mit ,5
        if (!Number.isInteger(a.loesung)) {
          for (const e of [Math.floor(a.loesung), Math.ceil(a.loesung) % 360, kursAnzeige(a.loesung)]) assert.ok(kursRichtig(String(e), a.loesung), `${a.text}: ${e}`);
        }
      }
    }
  }
  // Über 360 und unter 0 kommen in jeder Schwierigkeit vor
  for (const s of SCHWIERIGKEITEN) {
    const kpz = gelesen(s, 'kursPlusZahl');
    assert.ok(kpz.some((x) => x.kurs + x.zahl >= 360), `${s}: kein Überlauf über 360`);
    assert.ok(kpz.some((x) => x.kurs + x.zahl < 0), `${s}: kein Überlauf unter 0`);
  }
});

test('Kopfrechnen leicht: Kurse und Zahlen in Zehnerschritten, Zahl 10 bis 150, Überlauf höchstens in einem von drei Fällen', () => {
  const s = 'leicht';
  for (const x of gelesen(s, 'kursPlusZahl')) {
    assert.ok(zehner(x.kurs) && zehner(x.zahl) && imBereich(Math.abs(x.zahl), 10, 150), `${x.kurs} ${x.zahl}`);
  }
  for (const x of gelesen(s, 'gkPlus')) assert.ok(zehner(x.kurs) && zehner(x.zahl) && imBereich(Math.abs(x.zahl), 10, 60));
  for (const art of ['richtungPlus', 'gkRichtung']) {
    for (const x of gelesen(s, art)) {
      assert.ok([0, 4, 8, 12].includes(x.index), `${art}: nur N, E, S, W`);
      assert.ok(zehner(x.zahl) && imBereich(Math.abs(x.zahl), 10, art === 'gkRichtung' ? 60 : 130));
    }
  }
  for (const x of gelesen(s, 'anlKurs')) assert.ok(zehner(x.kurs) && zehner(x.zahl) && imBereich(x.zahl, 20, 150) && x.a === undefined);
  // Ganze Grade in Zehnerschritten als Ergebnis
  for (const art of RECHNEND) for (const a of jeArt[s][art]) assert.ok(zehner(a.loesung), a.text);
  for (const art of RECHNEND) {
    const wert = anteil(gelesen(s, art), (x) => ueberlauf(x.basis, x.zahl));
    assert.ok(wert <= 1 / 3, `${art}: Überlauf in ${wert}`);
  }
  assert.ok(anteil(gelesen(s, 'kursPlusZahl'), (x) => ueberlauf(x.basis, x.zahl)) > 0.1, 'leicht ganz ohne Überlauf');
});

test('Kopfrechnen normal: wie die Vorlagen, Zahl 20 bis 490, Überlauf etwa in der Hälfte, GK ± 10 bis 60, Himmelsrichtung ± 10 bis 130', () => {
  const s = 'normal';
  const kpz = gelesen(s, 'kursPlusZahl');
  for (const x of kpz) assert.ok(imBereich(x.kurs, 0, 359) && imBereich(Math.abs(x.zahl), 20, 490));
  const ueber = anteil(kpz, (x) => ueberlauf(x.basis, x.zahl));
  assert.ok(ueber >= 0.4 && ueber <= 0.6, `Überlauf in ${ueber}`);
  assert.ok(kpz.some((x) => Math.abs(x.zahl) > 360) && kpz.some((x) => !zehner(x.zahl)) && kpz.some((x) => !zehner(x.kurs)));
  for (const x of gelesen(s, 'gkPlus')) assert.ok(imBereich(Math.abs(x.zahl), 10, 60));
  for (const x of gelesen(s, 'gkRichtung')) assert.ok(imBereich(Math.abs(x.zahl), 10, 60));
  const hr = gelesen(s, 'richtungPlus');
  for (const x of hr) assert.ok(imBereich(Math.abs(x.zahl), 10, 130));
  assert.equal(new Set(hr.map((x) => x.index)).size, 16);
  const anl = gelesen(s, 'anlKurs');
  for (const x of anl) {
    if (x.a === undefined) assert.ok(imBereich(x.zahl, 20, 160));
    else assert.ok(imBereich(x.a, 2, 9) && imBereich(x.b, 2, 13) && imBereich(x.zahl, 20, 160));
  }
  assert.ok(anl.some((x) => x.a === undefined) && anl.some((x) => x.a !== undefined), 'plus n und plus a×b');
});

test('Kopfrechnen schwer: keine Endziffer 0 oder 5, ein Drittel über 360, zweistufig, Halbgrade, ungerade Kurse', () => {
  const s = 'schwer';
  const kpz = gelesen(s, 'kursPlusZahl');
  for (const x of kpz) assert.ok(imBereich(Math.abs(x.zahl), 20, 490) && ohneFuenfer(x.zahl), `${x.zahl}`);
  const gross = anteil(kpz, (x) => Math.abs(x.zahl) > 360);
  assert.ok(gross >= 0.25 && gross <= 0.42, `über 360 in ${gross}`);
  assert.ok(anteil(kpz, (x) => ueberlauf(x.basis, x.zahl)) >= 0.55, 'Überlauf seltener als bei normal');
  for (const x of gelesen(s, 'gkPlus')) assert.ok(imBereich(Math.abs(x.zahl), 10, 60) && ohneFuenfer(x.zahl));
  for (const art of ['richtungPlus', 'gkRichtung']) {
    for (const x of gelesen(s, art)) {
      assert.ok(x.index % 2 === 1, `${art}: Richtung ohne halben Grad`);
      assert.ok(ohneFuenfer(x.zahl) && imBereich(Math.abs(x.zahl), 10, art === 'gkRichtung' ? 60 : 130));
    }
  }
  for (const art of ['richtungPlus', 'gkRichtung', 'richtungInGrad']) for (const a of jeArt[s][art]) assert.ok(!Number.isInteger(a.loesung), `${a.text}: kein halber Grad`);
  for (const x of gelesen(s, 'anlKurs')) {
    assert.ok(x.a !== undefined && ohneFuenfer(x.a) && ohneFuenfer(x.b) && x.b >= 11 && imBereich(x.zahl, 20, 160), `${x.a}×${x.b}`);
  }
  for (const art of ['gegenkurs', 'naechsteRichtung']) for (const x of gelesen(s, art)) assert.ok(x.kurs % 2 === 1, `${art}: gerader Kurs ${x.kurs}`);
});

test('Kopfrechnen: Beispiele aus dem Entwurf und der Schwierigkeit, Text, Lösung und Tonfolge', () => {
  const beispiele = [
    [baueKopfaufgabe('kursPlusZahl', { kurs: 247, zahl: 230 }), '247 + 230', 117, ['name_kurs', 'n2', 'n4', 'n7', 'op_plus', 'n230']],
    [baueKopfaufgabe('kursPlusZahl', { kurs: 5, zahl: -20 }), '005 − 20', 345, ['name_kurs', 'n0', 'n0', 'n5', 'op_minus', 'n20']],
    [baueKopfaufgabe('gegenkurs', { kurs: 247 }), 'Gegenkurs von 247', 67, ['gegenkurs_von', 'n2', 'n4', 'n7']],
    [baueKopfaufgabe('richtungInGrad', { index: 9 }), 'SSW in Grad', 202.5, ['himmelsrichtung', 'hr_SSW', 'grad']],
    [baueKopfaufgabe('naechsteRichtung', { kurs: 111 }), 'Nächste Himmelsrichtung zu 111', 5, ['naechste_himmelsrichtung_zu', 'n1', 'n1', 'n1']],
    [baueKopfaufgabe('gkPlus', { kurs: 247, wert: -19 }), 'GK −19° ab 247', 48, ['gegenkurs_von', 'n2', 'n4', 'n7', 'op_minus', 'n19']],
    [baueKopfaufgabe('gkPlus', { kurs: 350, wert: 40 }), 'GK +40° ab 350', 210, ['gegenkurs_von', 'n3', 'n5', 'n0', 'op_plus', 'n40']],
    [baueKopfaufgabe('richtungPlus', { index: 1, wert: 102 }), 'NNE +102°', 124.5, ['himmelsrichtung', 'hr_NNE', 'op_plus', 'n102']],
    [baueKopfaufgabe('richtungPlus', { index: 9, wert: 41 }), 'SSW +41°', 243.5, ['himmelsrichtung', 'hr_SSW', 'op_plus', 'n41']],
    [baueKopfaufgabe('gkRichtung', { index: 9, wert: -37 }), 'GK von SSW −37°', 345.5, ['gegenkurs_von', 'hr_SSW', 'op_minus', 'n37']],
    [baueKopfaufgabe('anlKurs', { kurs: 247, a: 9, b: 13 }), 'anl. Kurs 247 +9×13', 4, ['anliegender_kurs', 'n2', 'n4', 'n7', 'op_plus', 'n9', 'op_mal', 'n13']],
    [baueKopfaufgabe('anlKurs', { kurs: 240, wert: 50 }), 'anl. Kurs 240 +50°', 290, ['anliegender_kurs', 'n2', 'n4', 'n0', 'op_plus', 'n50']],
  ];
  for (const [a, text, loesung, tonfolge] of beispiele) {
    assert.equal(a.text, text);
    assert.equal(a.loesung, loesung, text);
    assert.deepEqual(a.tonfolge, tonfolge, text);
  }
  // 202,5 + 41 = 243,5: richtig sind 243, 244 und 243,5
  const hr = baueKopfaufgabe('richtungPlus', { index: 9, wert: 41 });
  for (const e of ['243', '244', '243,5', '243.5']) assert.ok(frageRichtig(hr, e), e);
  for (const e of ['242', '245', '']) assert.ok(!frageRichtig(hr, e), e);
  assert.equal(loesungText(hr), '243,5');
  assert.deepEqual(ziffernFolge(7), ['n0', 'n0', 'n7']);
  assert.equal(klangPfad('hr_SSW'), 'klaenge/hr_SSW.mp3');
});

test('Kopfrechnen: Tonfolge nennt nur vorhandene Dateien, Kurse ziffernweise, nur vorhandene Schnipsel', () => {
  const vorhanden = new Map();
  const gibt = (name) => {
    if (!vorhanden.has(name)) vorhanden.set(name, existsSync(new URL(`../${klangPfad(name)}`, import.meta.url)));
    return vorhanden.get(name);
  };
  for (const s of SCHWIERIGKEITEN) {
    for (const aufgaben of Object.values(jeArt[s])) {
      for (const a of aufgaben) {
        for (const name of a.tonfolge) assert.ok(gibt(name), `${a.text}: ${name} fehlt`);
        const kurs = a.text.match(/(?:^|Kurs |von |zu |ab )(\d{3})(?: |$)/);
        if (kurs) assert.ok(a.tonfolge.join(' ').includes(ziffern(kurs[1]).join(' ')), `${a.text}: Kurs nicht ziffernweise`);
      }
    }
  }
});

test('Kopfrechnen: gemischt nach Schwierigkeit, Arten ohne Rechnung bei leicht seltener, zweistufige nur bei schwer', () => {
  const folge = (saat, s) => { const z = new Zufall(saat); return Array.from({ length: 3000 }, () => erzeugeKopfaufgabe(z, null, s)); };
  const ohneRechnung = ['gegenkurs', 'richtungInGrad', 'naechsteRichtung'];
  const anteile = {};
  for (const s of SCHWIERIGKEITEN) {
    const a = folge(`sitzung-${s}`, s);
    assert.deepEqual(new Set(a.map((x) => x.art)), new Set(Object.keys(ARTEN_GEWICHTE[s])), s);
    anteile[s] = anteil(a, (x) => ohneRechnung.includes(x.art));
    assert.deepEqual(folge(`sitzung-${s}`, s).map((x) => x.text), a.map((x) => x.text));
  }
  assert.ok(anteile.leicht < anteile.normal - 0.1, JSON.stringify(anteile));
  for (const art of ['gkRichtung', 'anlKurs']) {
    assert.ok(!ARTEN_GEWICHTE.leicht[art] && !ARTEN_GEWICHTE.normal[art] && ARTEN_GEWICHTE.schwer[art] > 0, art);
  }
  // Ohne Angabe gilt normal, eine unbekannte Schwierigkeit ebenso
  const ohne = new Zufall('ohne');
  const normal = new Zufall('ohne');
  const fremd = new Zufall('ohne');
  for (let i = 0; i < 50; i++) {
    const text = erzeugeKopfaufgabe(normal, null, 'normal').text;
    assert.equal(erzeugeKopfaufgabe(ohne).text, text);
    assert.equal(erzeugeKopfaufgabe(fremd, null, 'mittel').text, text);
  }
  assert.notDeepEqual(folge('sitzung-2', 'normal').map((x) => x.text), folge('sitzung-normal', 'normal').map((x) => x.text));
});

test('Antworten: Eingabe lesen, Kurse modulo 360, Halbgrade mit beiden Nachbarn', () => {
  assert.equal(eingabeLesen('117'), 117);
  assert.equal(eingabeLesen('202,5'), 202.5);
  assert.equal(eingabeLesen('202.5'), 202.5);
  assert.equal(eingabeLesen(''), null);
  assert.equal(eingabeLesen('abc'), null);
  assert.equal(eingabeLesen(null), null);
  assert.ok(kursRichtig('117', 117));
  assert.ok(!kursRichtig('118', 117));
  assert.ok(kursRichtig('067', 67) && kursRichtig('67', 67));
  assert.ok(kursRichtig('000', 0) && kursRichtig('360', 0) && kursRichtig('0', 0));
  for (const e of ['202', '203', '202,5', '202.5']) assert.ok(kursRichtig(e, 202.5), e);
  for (const e of ['201', '204', '202,4', '']) assert.ok(!kursRichtig(e, 202.5), e);
  // Halbgrad kurz vor Norden: 359 und 000 (oder 360)
  for (const e of ['359', '000', '360', '359,5']) assert.ok(kursRichtig(e, 359.5), e);
  assert.equal(kursAnzeige(67), '067');
  assert.equal(kursAnzeige(0), '000');
  assert.equal(kursAnzeige(202.5), '202,5');
  assert.equal(kursAnzeige(22.5), '022,5');
});

test('Antworten: Fragen nach Kurs, Richtung und Drehsinn prüfen und als Lösung schreiben', () => {
  assert.ok(frageRichtig({ antwort: 'kurs', loesung: 202.5 }, '203'));
  assert.ok(frageRichtig({ antwort: 'richtung', loesung: 5 }, 5));
  assert.ok(frageRichtig({ antwort: 'richtung', loesung: 5 }, '5'));
  assert.ok(!frageRichtig({ antwort: 'richtung', loesung: 5 }, 6));
  assert.ok(frageRichtig({ antwort: 'drehsinn', loesung: 'links' }, 'links'));
  assert.ok(!frageRichtig({ antwort: 'drehsinn', loesung: 'links' }, 'rechts'));
  assert.ok(!frageRichtig({ antwort: 'kurs', loesung: 10 }, null));
  assert.equal(loesungText({ antwort: 'kurs', loesung: 48 }), '048');
  assert.equal(loesungText({ antwort: 'richtung', loesung: 5 }), 'ESE (112,5)');
  assert.equal(loesungText({ antwort: 'drehsinn', loesung: 'rechts' }), 'rechts');
});
