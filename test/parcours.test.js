import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import { erzeugeElemente } from '../js/parcours.js';
import { normieren, differenz } from '../js/kurs.js';

const listen = Array.from({ length: 200 }, (_, i) => erzeugeElemente(new Zufall(`elemente-${i}`)));

function segmente(elemente) {
  return elemente.filter((e) => e.art === 'segment');
}

test('Mengen je Blatt', () => {
  for (const elemente of listen) {
    const s = segmente(elemente);
    assert.ok(s.length >= 18 && s.length <= 22, `${s.length} Segmente`);
    assert.equal(elemente.filter((e) => e.art === 'vollkreis').length, 2);
    const relative = s.filter((e) => e.relativ !== null).length;
    assert.ok(relative >= 3 && relative <= 4, `${relative} relative Ecken`);
    const himmel = s.filter((e) => e.anzeige === 'himmelsrichtung').length;
    assert.ok(himmel >= 3 && himmel <= 4, `${himmel} Himmelsrichtungen`);
    const rechnen = s.filter((e) => e.rechenaufgabe !== null).length;
    assert.ok(rechnen >= 4 && rechnen <= 5, `${rechnen} Rechenaufgaben`);
  }
});

test('Rechenaufgaben nur an Segmenten mit Kurs, Betrag 100 bis 350', () => {
  for (const elemente of listen) {
    for (const s of segmente(elemente)) {
      if (s.rechenaufgabe === null) continue;
      assert.notEqual(s.anzeige, 'keine');
      assert.ok(Math.abs(s.rechenaufgabe) >= 100 && Math.abs(s.rechenaufgabe) <= 350);
    }
  }
});

test('relative Ecken haben keine Kursanzeige, Winkel 20 bis 340 ohne 180, Kurs stimmt', () => {
  for (const elemente of listen) {
    const s = segmente(elemente);
    assert.equal(s[0].relativ, null, 'erstes Segment braucht einen Kurs');
    for (let i = 1; i < s.length; i++) {
      if (s[i].relativ === null) continue;
      assert.equal(s[i].anzeige, 'keine');
      const betrag = Math.abs(s[i].relativ);
      assert.ok(betrag >= 20 && betrag <= 340 && betrag !== 180, `${s[i].relativ}`);
      assert.equal(s[i].kurs, normieren(s[i - 1].kurs + s[i].relativ));
    }
  }
});

test('Kurswechsel an Ecken mit Kurs zwischen 20 und 160 Grad', () => {
  for (const elemente of listen) {
    const s = segmente(elemente);
    for (let i = 1; i < s.length; i++) {
      if (s[i].relativ !== null) continue;
      const a = Math.abs(differenz(s[i - 1].kurs, s[i].kurs));
      assert.ok(a >= 20 && a <= 160, `${s[i - 1].kurs} nach ${s[i].kurs}`);
    }
  }
});

test('Himmelsrichtungen und Gradkurse sind stimmig', () => {
  for (const elemente of listen) {
    for (const s of segmente(elemente)) {
      if (s.anzeige === 'himmelsrichtung') {
        assert.ok(s.himmelsrichtung >= 0 && s.himmelsrichtung <= 15);
        assert.equal(s.kurs, s.himmelsrichtung * 22.5);
      }
      if (s.anzeige === 'grad') assert.ok(Number.isInteger(s.kurs) && s.kurs >= 0 && s.kurs <= 359);
      assert.ok([10, 15, 20, 30].includes(s.dauer));
    }
  }
});

test('Vollkreise nicht am Rand, nicht hintereinander, Drehrichtung entgegen der folgenden Ecke', () => {
  for (const elemente of listen) {
    for (let i = 0; i < elemente.length; i++) {
      if (elemente[i].art !== 'vollkreis') continue;
      assert.ok(i >= 2 && i <= elemente.length - 2, `Vollkreis an Stelle ${i} von ${elemente.length}`);
      assert.equal(elemente[i - 1].art, 'segment');
      assert.equal(elemente[i + 1].art, 'segment');
      const vorher = elemente[i - 1];
      const nachher = elemente[i + 1];
      const eckeRechts = nachher.relativ !== null ? nachher.relativ > 0 : differenz(vorher.kurs, nachher.kurs) > 0;
      assert.equal(elemente[i].richtung, eckeRechts ? 'links' : 'rechts');
      assert.equal(elemente[i].profile.length, 2);
    }
  }
});

test('kein Profil öfter als dreimal hintereinander, Vollkreishälften zählen mit', () => {
  for (const elemente of listen) {
    const p = elemente.flatMap((e) => (e.art === 'segment' ? [e.profil] : e.profile));
    for (let i = 3; i < p.length; i++) {
      assert.ok(!(p[i] === p[i - 1] && p[i] === p[i - 2] && p[i] === p[i - 3]), p.join(','));
    }
    for (const profil of ['horizontal', 'steigen', 'sinken']) {
      assert.ok(p.includes(profil), `${profil} fehlt`);
    }
  }
});

test('gleicher Schlüssel, gleiche Elemente', () => {
  assert.deepEqual(erzeugeElemente(new Zufall('x')), erzeugeElemente(new Zufall('x')));
});
