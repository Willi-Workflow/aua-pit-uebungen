import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import { erzeugeElemente, geometrie, zaehleKreuzungen, erzeugeParcours, seitenverhaeltnisPasst, SEKUNDE_LAENGE, KANDIDATEN } from '../js/parcours.js';
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

function naheBei(a, b, toleranz = 0.01) {
  return Math.abs(a - b) <= toleranz;
}

test('Strecke: Kurs 090 läuft nach rechts, Länge nach Dauer', () => {
  const geo = geometrie([{ art: 'segment', kurs: 90, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 20, profil: 'horizontal', rechenaufgabe: null }]);
  assert.equal(geo.stuecke.length, 1);
  assert.equal(geo.stuecke[0].art, 'strecke');
  const [start, ende] = geo.stuecke[0].punkte;
  assert.ok(naheBei(ende.x - start.x, 20 * SEKUNDE_LAENGE));
  assert.ok(naheBei(ende.y, start.y));
  assert.equal(geo.marken.length, 2);
  assert.deepEqual(geo.beschriftungen[0].zeilen, ['090°/20"']);
});

test('Strecke: Kurs 180 läuft nach unten', () => {
  const geo = geometrie([{ art: 'segment', kurs: 180, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'sinken', rechenaufgabe: null }]);
  const [start, ende] = geo.stuecke[0].punkte;
  assert.ok(naheBei(ende.y - start.y, 10 * SEKUNDE_LAENGE));
  assert.ok(naheBei(ende.x, start.x));
});

test('Ecke: Rechtskurve von 000 auf 090 endet rechts oben vom Startpunkt', () => {
  const geo = geometrie([
    { art: 'segment', kurs: 0, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'horizontal', rechenaufgabe: null },
    { art: 'segment', kurs: 90, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'horizontal', rechenaufgabe: null },
  ]);
  assert.equal(geo.stuecke.length, 3);
  assert.equal(geo.stuecke[1].art, 'bogen');
  const bogen = geo.stuecke[1].punkte;
  const anfang = bogen[0];
  const ende = bogen[bogen.length - 1];
  assert.ok(ende.x > anfang.x && ende.y < anfang.y, `Bogen endet bei ${ende.x}, ${ende.y}`);
  assert.ok(geo.stuecke[1].pfad.includes(' 0 1 '), 'Rechtskurve hat sweep-flag 1');
  assert.equal(geo.beschriftungen.length, 2);
});

test('relative Ecke wird beschriftet und ergibt den Kurs des nächsten Segments', () => {
  const geo = geometrie([
    { art: 'segment', kurs: 90, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'horizontal', rechenaufgabe: null },
    { art: 'segment', kurs: 30, anzeige: 'keine', himmelsrichtung: null, relativ: -60, dauer: 15, profil: 'steigen', rechenaufgabe: null },
  ]);
  const texte = geo.beschriftungen.map((b) => b.zeilen.join(' '));
  assert.ok(texte.includes('-60°'), texte.join(' | '));
  assert.ok(texte.includes('/15"'), texte.join(' | '));
  assert.ok(geo.stuecke[1].pfad.includes(' 0 0 '), 'Linkskurve hat sweep-flag 0');
  const letzte = geo.stuecke[2].punkte;
  const dx = letzte[1].x - letzte[0].x;
  const dy = letzte[1].y - letzte[0].y;
  assert.ok(naheBei(Math.atan2(dx, -dy) * 180 / Math.PI, 30, 0.1), 'letzte Strecke läuft auf Kurs 030');
});

test('Vollkreis: zwei Halbbögen, Rückkehr zum Ausgangspunkt, Marke bei 180°', () => {
  const geo = geometrie([
    { art: 'segment', kurs: 90, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'horizontal', rechenaufgabe: null },
    { art: 'vollkreis', richtung: 'rechts', profile: ['steigen', 'horizontal'] },
    { art: 'segment', kurs: 30, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'sinken', rechenaufgabe: null },
  ]);
  assert.equal(geo.stuecke.length, 5);
  assert.equal(geo.stuecke[1].profil, 'steigen');
  assert.equal(geo.stuecke[2].profil, 'horizontal');
  const streckenEnde = geo.stuecke[0].punkte[1];
  const kreisEnde = geo.stuecke[2].punkte[geo.stuecke[2].punkte.length - 1];
  assert.deepEqual(kreisEnde, streckenEnde);
  assert.equal(geo.marken.length, 4);
});

test('Beschriftungen: Himmelsrichtung englisch, Rechenaufgabe als zweite Zeile', () => {
  const geo = geometrie([
    { art: 'segment', kurs: 157.5, anzeige: 'himmelsrichtung', himmelsrichtung: 7, relativ: null, dauer: 10, profil: 'horizontal', rechenaufgabe: 340 },
    { art: 'segment', kurs: 50, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 15, profil: 'steigen', rechenaufgabe: -230 },
  ]);
  assert.deepEqual(geo.beschriftungen[0].zeilen, ['SSE/10"', '+340']);
  assert.deepEqual(geo.beschriftungen[1].zeilen, ['050°/15"', '-230']);
  for (const b of geo.beschriftungen) assert.ok(b.winkel >= -90 && b.winkel <= 90, `Winkel ${b.winkel}`);
});

test('zaehleKreuzungen erkennt eine echte Kreuzung und ignoriert Berührungen an Enden', () => {
  const strecke = (a, b) => ({ art: 'strecke', profil: 'horizontal', pfad: '', punkte: [a, b] });
  const kreuz = [
    strecke({ x: 0, y: 0 }, { x: 10, y: 0 }),
    strecke({ x: 10, y: 0 }, { x: 10, y: 10 }),
    strecke({ x: 10, y: 10 }, { x: 5, y: -5 }),
  ];
  assert.equal(zaehleKreuzungen(kreuz), 1);
  const beruehrung = [
    strecke({ x: 0, y: 0 }, { x: 10, y: 0 }),
    strecke({ x: 10, y: 0 }, { x: 10, y: 10 }),
    strecke({ x: 10, y: 10 }, { x: 0, y: 0 }),
  ];
  assert.equal(zaehleKreuzungen(beruehrung), 0);
  assert.equal(zaehleKreuzungen(kreuz, 0), 1);
});

test('seitenverhaeltnisPasst', () => {
  assert.equal(seitenverhaeltnisPasst({ minX: 0, minY: 0, maxX: 100, maxY: 100 }), true);
  assert.equal(seitenverhaeltnisPasst({ minX: 0, minY: 0, maxX: 300, maxY: 100 }), false);
  assert.equal(seitenverhaeltnisPasst({ minX: 0, minY: 0, maxX: 50, maxY: 100 }), false);
});

test('erzeugeParcours ist bestimmt und liefert Kandidat, Kreuzungen und Umriss', () => {
  const a = erzeugeParcours(new Zufall('stufe-2/blatt-1'));
  const b = erzeugeParcours(new Zufall('stufe-2/blatt-1'));
  assert.deepEqual(a, b);
  assert.ok(a.kandidat >= 1 && a.kandidat <= KANDIDATEN);
  assert.ok(a.kreuzungen >= 0);
  assert.ok(a.geometrie.umriss.maxX > a.geometrie.umriss.minX);
  assert.equal(a.geometrie.beschriftungen.length >= a.elemente.filter((e) => e.art === 'segment').length, true);
});

test('erzeugeParcours findet meist einen kreuzungsfreien Kandidaten', () => {
  let frei = 0;
  for (let i = 0; i < 30; i++) {
    const p = erzeugeParcours(new Zufall(`suche-${i}`));
    if (p.kreuzungen === 0 && seitenverhaeltnisPasst(p.geometrie.umriss)) frei += 1;
  }
  assert.ok(frei >= 27, `nur ${frei} von 30 kreuzungsfrei und passend`);
});

test('Schleife: relative Ecke über 180° kreuzt Einfahrt und Ausfahrt, das zählt nicht', () => {
  const elemente = [
    { art: 'segment', kurs: 0, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 20, profil: 'horizontal', rechenaufgabe: null },
    { art: 'segment', kurs: 270, anzeige: 'keine', himmelsrichtung: null, relativ: 270, dauer: 20, profil: 'horizontal', rechenaufgabe: null },
  ];
  const geo = geometrie(elemente);
  assert.equal(geo.stuecke[1].schleife, true);
  assert.equal(zaehleKreuzungen(geo.stuecke), 0);

  const elementeGegenprobe = [
    { art: 'segment', kurs: 0, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 20, profil: 'horizontal', rechenaufgabe: null },
    { art: 'segment', kurs: 90, anzeige: 'keine', himmelsrichtung: null, relativ: 90, dauer: 20, profil: 'horizontal', rechenaufgabe: null },
  ];
  const geoGegenprobe = geometrie(elementeGegenprobe);
  assert.equal(geoGegenprobe.stuecke[1].schleife, false);
});
