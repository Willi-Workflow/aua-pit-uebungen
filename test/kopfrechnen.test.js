import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Zufall } from '../js/zufall.js';
import { KOPF_ARTEN, erzeugeKopfaufgabe, baueKopfaufgabe, ziffernFolge, klangPfad } from '../js/kopfrechnen.js';
import { eingabeLesen, kursRichtig, kursAnzeige, frageRichtig, loesungText } from '../js/antwort.js';

const RICHTUNGEN = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const norm = (g) => ((g % 360) + 360) % 360;
const abstand = (a, b) => { const d = norm(a - b); return Math.min(d, 360 - d); };

// Viele Aufgaben je Art, jede mit eigenem Zufall
const jeArt = Object.fromEntries(KOPF_ARTEN.map((art) => [art, Array.from({ length: 300 }, (_, i) => erzeugeKopfaufgabe(new Zufall(`kopf-${art}-${i}`), art))]));
const alle = Object.values(jeArt).flat();

// Rechnet die Lösung nur aus dem geschriebenen Text nach, ohne die Felder der Aufgabe
function ausDemText(text) {
  let m;
  if ((m = text.match(/^(\d{3}) ([+−]) (\d+)$/))) {
    const zahl = Number(m[3]);
    assert.ok(zahl >= 20 && zahl <= 490, `Zahl ${zahl} außerhalb 20 bis 490`);
    return norm(Number(m[1]) + (m[2] === '+' ? zahl : -zahl));
  }
  if ((m = text.match(/^Gegenkurs von (\d{3})$/))) return norm(Number(m[1]) + 180);
  if ((m = text.match(/^([A-Z]{1,3}) in Grad$/))) {
    assert.ok(RICHTUNGEN.includes(m[1]), `unbekannte Richtung ${m[1]}`);
    return RICHTUNGEN.indexOf(m[1]) * 22.5;
  }
  if ((m = text.match(/^Nächste Himmelsrichtung zu (\d{3})$/))) {
    // Die Richtung mit dem kleinsten Abstand, durch Probieren aller 16
    const kurs = Number(m[1]);
    let beste = 0;
    for (let j = 1; j < 16; j++) if (abstand(kurs, j * 22.5) < abstand(kurs, beste * 22.5)) beste = j;
    return beste;
  }
  if ((m = text.match(/^GK ([+−])(\d+)° ab (\d{3})$/))) {
    const wert = Number(m[2]);
    assert.ok(wert >= 10 && wert <= 60, `GK ± ${wert} außerhalb 10 bis 60`);
    return norm(Number(m[3]) + 180 + (m[1] === '+' ? wert : -wert));
  }
  throw new Error(`Aufgabentext nicht lesbar: ${text}`);
}

test('Kopfrechnen: jede Art liefert Aufgabe, Lösung und Tonfolge', () => {
  assert.deepEqual(KOPF_ARTEN, ['kursPlusZahl', 'gegenkurs', 'richtungInGrad', 'naechsteRichtung', 'gkPlus']);
  for (const [art, aufgaben] of Object.entries(jeArt)) {
    for (const a of aufgaben) {
      assert.equal(a.art, art);
      assert.ok(typeof a.text === 'string' && a.text.length > 0);
      assert.ok(Array.isArray(a.tonfolge) && a.tonfolge.length >= 3, `${a.text}: Tonfolge zu kurz`);
      assert.equal(a.antwort, art === 'naechsteRichtung' ? 'richtung' : 'kurs');
      assert.ok(Number.isFinite(a.loesung));
    }
  }
});

test('Kopfrechnen: Lösung aus dem Aufgabentext nachgerechnet (Modulo, Gegenkurs, Halbgrade)', () => {
  for (const a of alle) assert.equal(a.loesung, ausDemText(a.text), a.text);
  // Halbgrade kommen nur bei Himmelsrichtungen vor
  assert.ok(jeArt.richtungInGrad.some((a) => !Number.isInteger(a.loesung)));
  for (const art of ['kursPlusZahl', 'gegenkurs', 'gkPlus']) assert.ok(jeArt[art].every((a) => Number.isInteger(a.loesung)));
  // Über 360 und unter 0 kommen vor, das Ergebnis liegt immer in 0 bis 359
  assert.ok(jeArt.kursPlusZahl.some((a) => a.text.includes('+') && ausDemText(a.text) < Number(a.text.slice(0, 3))));
  assert.ok(jeArt.kursPlusZahl.some((a) => a.text.includes('−') && ausDemText(a.text) > Number(a.text.slice(0, 3))));
  for (const a of alle) if (a.antwort === 'kurs') assert.ok(a.loesung >= 0 && a.loesung < 360);
});

test('Kopfrechnen: Beispiele aus dem Entwurf, Text und Tonfolge', () => {
  const beispiele = [
    [baueKopfaufgabe('kursPlusZahl', { kurs: 247, zahl: 230 }), '247 + 230', 117, ['name_kurs', 'n2', 'n4', 'n7', 'op_plus', 'n230']],
    [baueKopfaufgabe('kursPlusZahl', { kurs: 5, zahl: -20 }), '005 − 20', 345, ['name_kurs', 'n0', 'n0', 'n5', 'op_minus', 'n20']],
    [baueKopfaufgabe('gegenkurs', { kurs: 247 }), 'Gegenkurs von 247', 67, ['gegenkurs_von', 'n2', 'n4', 'n7']],
    [baueKopfaufgabe('richtungInGrad', { index: 9 }), 'SSW in Grad', 202.5, ['himmelsrichtung', 'hr_SSW', 'grad']],
    [baueKopfaufgabe('naechsteRichtung', { kurs: 111 }), 'Nächste Himmelsrichtung zu 111', 5, ['naechste_himmelsrichtung_zu', 'n1', 'n1', 'n1']],
    [baueKopfaufgabe('gkPlus', { kurs: 247, wert: -19 }), 'GK −19° ab 247', 48, ['gegenkurs_von', 'n2', 'n4', 'n7', 'op_minus', 'n19']],
    [baueKopfaufgabe('gkPlus', { kurs: 350, wert: 40 }), 'GK +40° ab 350', 210, ['gegenkurs_von', 'n3', 'n5', 'n0', 'op_plus', 'n40']],
  ];
  for (const [a, text, loesung, tonfolge] of beispiele) {
    assert.equal(a.text, text);
    assert.equal(a.loesung, loesung, text);
    assert.deepEqual(a.tonfolge, tonfolge, text);
  }
  assert.deepEqual(ziffernFolge(7), ['n0', 'n0', 'n7']);
  assert.equal(klangPfad('hr_SSW'), 'klaenge/hr_SSW.mp3');
});

test('Kopfrechnen: Tonfolge nennt nur vorhandene Dateien, Kurse ziffernweise', () => {
  for (const a of alle) {
    for (const name of a.tonfolge) assert.ok(existsSync(new URL(`../${klangPfad(name)}`, import.meta.url)), `${a.text}: ${name} fehlt`);
    const kurs = a.text.match(/\d{3}/);
    if (kurs && a.art !== 'richtungInGrad') {
      const ziffern = [...kurs[0]].map((z) => `n${z}`);
      assert.ok(a.tonfolge.join(' ').includes(ziffern.join(' ')), `${a.text}: Kurs nicht ziffernweise`);
    }
  }
});

test('Kopfrechnen: gemischt, alle Arten kommen vor, gleicher Startwert gibt gleiche Folge', () => {
  const folge = (saat) => { const z = new Zufall(saat); return Array.from({ length: 200 }, () => erzeugeKopfaufgabe(z)); };
  const a = folge('sitzung-1');
  assert.deepEqual(new Set(a.map((x) => x.art)), new Set(KOPF_ARTEN));
  assert.deepEqual(folge('sitzung-1').map((x) => x.text), a.map((x) => x.text));
  assert.notDeepEqual(folge('sitzung-2').map((x) => x.text), a.map((x) => x.text));
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
