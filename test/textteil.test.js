import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import { erzeugeTextteil, ZEILEN, HOEHE_MIN, HOEHE_MAX } from '../js/textteil.js';
import { normieren, gegenkurs, differenz, HIMMELSRICHTUNGEN, himmelsrichtungGrad } from '../js/kurs.js';

const PROFIL = '(Horizontalflug|Steigflug|Sinkflug)';
const KREIS = '(horizontal|Steigflug|Sinkflug)';
const RICHTUNG = '([NOSW]{1,3})';
const ZEIT = '(10|15|20)';

// Ein Muster je Schablone. Die Gruppen werden unten zur Nachrechnung verwendet.
const MUSTER = {
  absolut: new RegExp(`^Auf Kurs (\\d{3}) drehen, ${PROFIL} ${ZEIT} s\\.$`),
  relativ: new RegExp(`^(Links|Rechts)kurve um (\\d+)°, neuer Kurs ${ZEIT} s ${PROFIL}\\.$`),
  himmelsrichtung: new RegExp(`^(Links|Rechts)kurve auf ${RICHTUNG}, ${ZEIT} s ${PROFIL}\\.$`),
  gradkurs: new RegExp(`^(Links|Rechts) auf (\\d{3})°, ${ZEIT} s ${PROFIL}\\.$`),
  schnellster: new RegExp(`^Auf schnellstem Weg (?:nach (\\d{3})°|${RICHTUNG}), ${ZEIT} s (geradeaus|Steigflug|Sinkflug)\\.$`),
  gegenkurs: new RegExp(`^(Links|Rechts) auf den Gegenkurs von ${RICHTUNG}, ${ZEIT} s ${PROFIL}\\.$`),
  vollkreis: new RegExp(`^Vollkreis nach (links|rechts), erste 180° ${KREIS}, zweite 180° ${KREIS}\\.$`),
  halbkreis: new RegExp(`^180°-Kurve nach (links|rechts), erst 90° ${KREIS}, zweite 90° ${KREIS}, ${ZEIT} s geradeaus\\.$`),
  hoehe: new RegExp(`^(Links|Rechts) auf (\\d{3})°, (\\d+) ft (sinken|steigen), nach (\\d+) ft (Links|Rechts)kurve auf (\\d{3})° einleiten\\.$`),
};

function gradVonName(richtungsname) {
  const index = HIMMELSRICHTUNGEN.deutsch.indexOf(richtungsname);
  assert.notEqual(index, -1, `unbekannte Himmelsrichtung ${richtungsname}`);
  return himmelsrichtungGrad(index);
}

const blaetter = Array.from({ length: 300 }, (_, i) => erzeugeTextteil(new Zufall(`textteil-${i}`)));

test('zwölf Zeilen, Ausgang 090° und 2000 ft', () => {
  for (const blatt of blaetter) {
    assert.equal(blatt.zeilen.length, ZEILEN);
    assert.equal(blatt.ausgangskurs, 90);
    assert.equal(blatt.ausgangshoehe, 2000);
    assert.equal(blatt.zeilen[0].kursVorher, 90);
    assert.equal(blatt.zeilen[0].hoeheVorher, 2000);
  }
});

test('gleicher Schlüssel, gleicher Textteil', () => {
  const a = erzeugeTextteil(new Zufall('stufe-2/blatt-1'));
  const b = erzeugeTextteil(new Zufall('stufe-2/blatt-1'));
  assert.deepEqual(a, b);
});

test('Zustand wird lückenlos fortgeschrieben', () => {
  for (const blatt of blaetter) {
    for (let i = 1; i < blatt.zeilen.length; i++) {
      assert.equal(blatt.zeilen[i].kursVorher, blatt.zeilen[i - 1].kursDanach);
      assert.equal(blatt.zeilen[i].hoeheVorher, blatt.zeilen[i - 1].hoeheDanach);
    }
  }
});

test('jeder Satz passt zu seiner Schablone, Kurs und Höhe danach stimmen mit dem Satz überein', () => {
  for (const blatt of blaetter) {
    for (const z of blatt.zeilen) {
      const m = z.satz.match(MUSTER[z.schablone]);
      assert.ok(m, `Satz passt nicht zur Schablone ${z.schablone}: ${z.satz}`);
      switch (z.schablone) {
        case 'absolut': assert.equal(z.kursDanach, Number(m[1]), z.satz); break;
        case 'relativ': assert.equal(z.kursDanach, normieren(z.kursVorher + (m[1] === 'Rechts' ? 1 : -1) * Number(m[2])), z.satz); break;
        case 'himmelsrichtung': assert.equal(z.kursDanach, gradVonName(m[2]), z.satz); break;
        case 'gradkurs': assert.equal(z.kursDanach, Number(m[2]), z.satz); break;
        case 'schnellster': assert.equal(z.kursDanach, m[1] ? Number(m[1]) : gradVonName(m[2]), z.satz); break;
        case 'gegenkurs': assert.equal(z.kursDanach, gegenkurs(gradVonName(m[2])), z.satz); break;
        case 'vollkreis': assert.equal(z.kursDanach, z.kursVorher, z.satz); break;
        case 'halbkreis': assert.equal(z.kursDanach, gegenkurs(z.kursVorher), z.satz); break;
        case 'hoehe':
          assert.equal(z.kursDanach, Number(m[7]), z.satz);
          assert.equal(z.hoeheDanach, z.hoeheVorher + (m[4] === 'steigen' ? 1 : -1) * Number(m[3]), z.satz);
          assert.ok(Number(m[3]) >= 200 && Number(m[3]) <= 800 && Number(m[3]) % 50 === 0, z.satz);
          assert.ok(Number(m[5]) >= 100 && Number(m[5]) <= Number(m[3]) - 100 && Number(m[5]) % 50 === 0, z.satz);
          break;
        default: assert.fail(`unbekannte Schablone ${z.schablone}`);
      }
    }
  }
});

test('kein trivialer Kurswechsel', () => {
  for (const blatt of blaetter) {
    for (const z of blatt.zeilen) {
      if (z.schablone === 'vollkreis') continue;
      if (z.schablone === 'hoehe') {
        const m = z.satz.match(MUSTER.hoehe);
        assert.ok(Math.abs(differenz(z.kursVorher, Number(m[2]))) >= 20, z.satz);
        assert.ok(Math.abs(differenz(Number(m[2]), Number(m[7]))) >= 20, z.satz);
        continue;
      }
      assert.ok(Math.abs(differenz(z.kursVorher, z.kursDanach)) >= 20, z.satz);
    }
  }
});

test('relative Kurve nur bei ganzzahligem Kurs, Winkel 20 bis 160', () => {
  for (const blatt of blaetter) {
    for (const z of blatt.zeilen) {
      if (z.schablone !== 'relativ') continue;
      assert.ok(Number.isInteger(z.kursVorher), z.satz);
      const winkel = Number(z.satz.match(MUSTER.relativ)[2]);
      assert.ok(winkel >= 20 && winkel <= 160, z.satz);
    }
  }
});

test('Höhe bleibt zwischen 1000 und 3000 ft', () => {
  for (const blatt of blaetter) {
    for (const z of blatt.zeilen) {
      assert.ok(z.hoeheDanach >= HOEHE_MIN && z.hoeheDanach <= HOEHE_MAX, `${z.hoeheDanach} ft nach: ${z.satz}`);
    }
  }
});

test('kein Profil öfter als dreimal hintereinander', () => {
  for (const blatt of blaetter) {
    const p = blatt.profile;
    for (let i = 3; i < p.length; i++) {
      assert.ok(!(p[i] === p[i - 1] && p[i] === p[i - 2] && p[i] === p[i - 3]), p.join(','));
    }
  }
});

test('Vollkreis, Halbkreis und Höhe höchstens je einmal, keine Schablone dreimal hintereinander', () => {
  for (const blatt of blaetter) {
    const namen = blatt.zeilen.map((z) => z.schablone);
    for (const b of ['vollkreis', 'halbkreis', 'hoehe']) {
      assert.ok(namen.filter((n) => n === b).length <= 1, namen.join(','));
    }
    for (let i = 2; i < namen.length; i++) {
      assert.ok(!(namen[i] === namen[i - 1] && namen[i] === namen[i - 2]), namen.join(','));
    }
  }
});

test('alle neun Schablonen kommen über viele Blätter vor', () => {
  const gesehen = new Set(blaetter.flatMap((b) => b.zeilen.map((z) => z.schablone)));
  assert.equal(gesehen.size, 9, [...gesehen].join(','));
});

test('Himmelsrichtungen im Textteil deutsch', () => {
  for (const blatt of blaetter) {
    for (const z of blatt.zeilen) {
      assert.ok(!/\b(NNE|ENE|ESE|SSE|E)\b/.test(z.satz), z.satz);
    }
  }
});
