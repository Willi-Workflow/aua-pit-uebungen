import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, lstatSync } from 'node:fs';

const ordner = new URL('../klaenge/', import.meta.url);
const datei = (name) => new URL(`${name}.mp3`, ordner);

const RICHTUNGEN = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const bereich = (von, bis) => Array.from({ length: bis - von + 1 }, (_, i) => von + i);

// Was der Ton-Baukasten des Kopfrechnens braucht: Ziffern für die Kurse und
// Faktoren, 10 bis 60 für GK plus oder minus, 10 bis 490 für die Rechenaufgaben,
// Rechenzeichen samt "mal" für anl. Kurs +9×13, Wörter und die 16 Himmelsrichtungen
const NOETIG = [
  ...bereich(0, 490).map((n) => `n${n}`),
  'op_plus', 'op_minus', 'op_mal', 'name_kurs',
  'gegenkurs_von', 'himmelsrichtung', 'naechste_himmelsrichtung_zu', 'grad', 'anliegender_kurs',
  ...RICHTUNGEN.map((r) => `hr_${r}`),
];

test('Klänge: alle Dateien des Ton-Baukastens liegen unter klaenge/', () => {
  const fehlen = NOETIG.filter((name) => !existsSync(datei(name)));
  assert.deepEqual(fehlen, []);
});

test('Klänge: jede Datei ist ein nicht leeres MP3', () => {
  for (const name of NOETIG) {
    const inhalt = readFileSync(datei(name));
    assert.ok(inhalt.length > 1000, `${name} zu klein`);
    const id3 = inhalt.subarray(0, 3).toString('latin1') === 'ID3';
    const rahmen = inhalt[0] === 0xff && (inhalt[1] & 0xe0) === 0xe0;
    assert.ok(id3 || rahmen, `${name} beginnt nicht wie ein MP3`);
  }
});

test('Klänge: Herkunft beschrieben, keine Verweise statt Dateien', () => {
  assert.ok(existsSync(new URL('HERKUNFT.md', ordner)));
  const herkunft = readFileSync(new URL('HERKUNFT.md', ordner), 'utf8');
  for (const quelle of ['Bundeswehr-Lern-App', 'Phase-II-App', '27.09.2026', 'klaenge_erzeuge.py']) {
    assert.ok(herkunft.includes(quelle), `HERKUNFT.md nennt ${quelle} nicht`);
  }
  for (const name of NOETIG) assert.ok(!lstatSync(datei(name)).isSymbolicLink(), `${name} ist ein Verweis`);
});

test('Erzeugerskript liest den Schlüssel aus dem Schlüsselbund und enthält keinen', () => {
  const skript = readFileSync(new URL('../werkzeuge/klaenge_erzeuge.py', import.meta.url), 'utf8');
  assert.ok(skript.includes('find-generic-password'));
  assert.ok(!/sk_[0-9a-f]{16,}/i.test(skript), 'Schlüssel im Skript');
  assert.ok(!/"xi-api-key":\s*"[^"]/.test(skript), 'Schlüssel als Zeichenkette im Skript');
});
