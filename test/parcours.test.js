import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import {
  erzeugeElemente, gateStellenWaehlen, geometrie, zaehleKreuzungen, kleinsterAbstand, beschriftungFrei, erzeugeParcours,
  seitenverhaeltnisPasst, SEKUNDE_LAENGE, KANDIDATEN, ZEILENABSTAND, LINIENBREITE_ABSTAND, MARKENLAENGE,
} from '../js/parcours.js';
import { erzeugeBlatt, BLAETTER_JE_STUFE, hatGates } from '../js/blatt.js';
import { normieren, differenz } from '../js/kurs.js';

const listen = Array.from({ length: 200 }, (_, i) => erzeugeElemente(new Zufall(`elemente-${i}`)));
const gateListen = Array.from({ length: 200 }, (_, i) => erzeugeElemente(new Zufall(`gates-${i}`), true));

function segmente(elemente) {
  return elemente.filter((e) => e.art === 'segment');
}

function gates(elemente) {
  return elemente.filter((e) => e.art === 'gate');
}

// Profile in Flugreihenfolge: Segmente, Kreishälften und Gate-Zeilen
function profilFolge(elemente) {
  return elemente.flatMap((e) => {
    if (e.art === 'segment') return [e.profil];
    if (e.art === 'gate') return e.zeilen.map((z) => z.profil);
    return e.profile;
  });
}

test('Mengen je Blatt, ohne Gates 18 bis 22 Segmente, mit Gates 15 bis 19', () => {
  for (const s of listen.map(segmente)) assert.ok(s.length >= 18 && s.length <= 22, `${s.length} Segmente ohne Gates`);
  const gateLaengen = new Set(gateListen.map((e) => segmente(e).length));
  for (const zahl of gateLaengen) assert.ok(zahl >= 15 && zahl <= 19, `${zahl} Segmente mit Gates`);
  assert.ok(gateLaengen.has(15) && gateLaengen.has(19), 'Randwerte 15 und 19 kommen nicht vor');
  for (const elemente of [...listen, ...gateListen]) {
    const s = segmente(elemente);
    assert.equal(elemente.filter((e) => e.art === 'vollkreis').length, 2);
    const relative = s.filter((e) => e.relativ !== null).length;
    assert.ok(relative >= 3 && relative <= 4, `${relative} relative Ecken`);
    const himmel = s.filter((e) => e.anzeige === 'himmelsrichtung').length;
    assert.ok(himmel >= 3 && himmel <= 4, `${himmel} Himmelsrichtungen`);
    const rechnen = s.filter((e) => e.rechenaufgabe !== null).length;
    assert.ok(rechnen >= 4 && rechnen <= 5, `${rechnen} Rechenaufgaben`);
  }
});

test('Rechenaufgaben mit Betrag 100 bis 350, auch an Segmenten ohne Kurs', () => {
  let ohneKurs = 0;
  for (const elemente of listen) {
    for (const s of segmente(elemente)) {
      if (s.rechenaufgabe === null) continue;
      if (s.anzeige === 'keine') ohneKurs += 1;
      assert.ok(Math.abs(s.rechenaufgabe) >= 100 && Math.abs(s.rechenaufgabe) <= 350);
    }
  }
  assert.ok(ohneKurs > 0, 'keine Rechenaufgabe an einem Segment ohne Kurs, wie in der Vorlage (/30" mit +115)');
});

test('relative Ecken haben keine Kursanzeige, Winkel 20 bis 340 ohne 180, Kurs stimmt', () => {
  for (const elemente of [...listen, ...gateListen]) {
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

// Kurs, mit dem man am Element k ankommt: nach einem Gate der Kurs der letzten
// Zeile, nach einem Vollkreis der Kurs des Segments davor
function kursVor(elemente, k) {
  const vorher = elemente[k - 1];
  if (vorher.art === 'gate') return vorher.zeilen[vorher.zeilen.length - 1].kursDanach;
  if (vorher.art === 'vollkreis') return elemente[k - 2].kurs;
  return vorher.kurs;
}

test('Kurswechsel an Ecken mit Kurs zwischen 20 und 160 Grad, nach einem Gate vom letzten Gate-Kurs', () => {
  for (const elemente of [...listen, ...gateListen]) {
    elemente.forEach((e, k) => {
      if (e.art !== 'segment' || k === 0 || e.relativ !== null) return;
      const a = Math.abs(differenz(kursVor(elemente, k), e.kurs));
      assert.ok(a >= 20 && a <= 160, `${kursVor(elemente, k)} nach ${e.kurs}`);
    });
  }
});

test('Himmelsrichtungen und Gradkurse sind stimmig', () => {
  for (const elemente of [...listen, ...gateListen]) {
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
  for (const elemente of [...listen, ...gateListen]) {
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

test('kein Profil öfter als dreimal hintereinander, Vollkreishälften und Gate-Zeilen zählen mit', () => {
  for (const elemente of [...listen, ...gateListen]) {
    const p = profilFolge(elemente);
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
  assert.deepEqual(erzeugeElemente(new Zufall('x'), true), erzeugeElemente(new Zufall('x'), true));
  assert.deepEqual(erzeugeElemente(new Zufall('x'), false), erzeugeElemente(new Zufall('x')));
});

test('Gates: mit Gates 3 bis 4 Gates zu je 3 bis 4 Zeilen, ohne Gates keins', () => {
  for (const elemente of gateListen) {
    const g = gates(elemente);
    assert.ok(g.length >= 3 && g.length <= 4, `${g.length} Gates`);
    for (const gate of g) assert.ok(gate.zeilen.length >= 3 && gate.zeilen.length <= 4, `${gate.zeilen.length} Zeilen`);
  }
  for (const elemente of listen) assert.equal(gates(elemente).length, 0);
});

test('Gate-Stellen: auch im ungünstigsten Fall mit 15 Segmenten mindestens drei, mit Abstand', () => {
  // 15 Segmente: Stellen 1 bis 12; Vollkreise nach 4 und 8, relative Ecken an 10 bis 13
  // lassen nur 1, 2, 3, 5, 6, 7 übrig. Wer zuerst 2 und 6 nimmt, bliebe bei zwei.
  const erlaubt = [1, 2, 3, 5, 6, 7];
  for (let i = 0; i < 300; i++) {
    const stellen = [...gateStellenWaehlen(new Zufall(`stellen-${i}`), 15, [4, 8], new Set([10, 11, 12, 13]))];
    assert.ok(stellen.length >= 3 && stellen.length <= 4, `${stellen.length} Gates: ${stellen}`);
    for (const a of stellen) {
      assert.ok(erlaubt.includes(a), `Stelle ${a}`);
      for (const b of stellen) if (a !== b) assert.ok(Math.abs(a - b) >= 2, `${a} und ${b} zu nah`);
    }
  }
});

test('Gate-Zeilen: Kurs danach stimmt, mindestens 20° Kurswechsel, Relativbeträge 20 bis 490, mindestens eine relative Zeile', () => {
  const typen = { relativ: 0, himmelsrichtung: 0, grad: 0 };
  for (const elemente of gateListen) {
    elemente.forEach((gate, k) => {
      if (gate.art !== 'gate') return;
      assert.equal(elemente[k - 1].art, 'segment', 'vor einem Gate steht ein Segment');
      let kursDavor = elemente[k - 1].kurs;
      let relative = 0;
      for (const z of gate.zeilen) {
        typen[z.kurs.typ] += 1;
        if (z.kurs.typ === 'relativ') {
          relative += 1;
          const betrag = Math.abs(z.kurs.wert);
          assert.ok(Number.isInteger(z.kurs.wert) && betrag >= 20 && betrag <= 490, `${z.kurs.wert}`);
          assert.equal(z.kursDanach, normieren(kursDavor + z.kurs.wert));
        } else if (z.kurs.typ === 'himmelsrichtung') {
          assert.ok(z.kurs.index >= 0 && z.kurs.index <= 15);
          assert.equal(z.kursDanach, z.kurs.index * 22.5);
        } else {
          assert.equal(z.kurs.typ, 'grad');
          assert.ok(Number.isInteger(z.kurs.grad) && z.kurs.grad >= 0 && z.kurs.grad <= 359);
          assert.equal(z.kursDanach, z.kurs.grad);
        }
        const wechsel = Math.abs(differenz(kursDavor, z.kursDanach));
        assert.ok(wechsel >= 20, `nur ${wechsel}° von ${kursDavor} nach ${z.kursDanach}`);
        if (z.kurs.typ !== 'relativ') assert.ok(wechsel <= 160, `${wechsel}° von ${kursDavor} nach ${z.kursDanach}`);
        assert.ok(['horizontal', 'steigen', 'sinken'].includes(z.profil));
        assert.ok([10, 15, 20].includes(z.dauer), `${z.dauer}`);
        kursDavor = z.kursDanach;
      }
      assert.ok(relative >= 1, 'Gate ohne relative Zeile');
    });
  }
  // Verteilung etwa 50, 25, 25 Prozent; relativ etwas mehr wegen der Pflichtzeile
  const summe = typen.relativ + typen.himmelsrichtung + typen.grad;
  assert.ok(typen.relativ / summe >= 0.45 && typen.relativ / summe <= 0.62, JSON.stringify(typen));
  assert.ok(typen.himmelsrichtung / summe >= 0.17 && typen.himmelsrichtung / summe <= 0.32, JSON.stringify(typen));
  assert.ok(typen.grad / summe >= 0.17 && typen.grad / summe <= 0.32, JSON.stringify(typen));
});

test('Segment nach einem Gate hat eine Kursangabe, 20 bis 160 Grad vom letzten Gate-Kurs', () => {
  for (const elemente of gateListen) {
    elemente.forEach((gate, k) => {
      if (gate.art !== 'gate') return;
      const nach = elemente[k + 1];
      assert.equal(nach.art, 'segment');
      assert.notEqual(nach.anzeige, 'keine');
      assert.equal(nach.relativ, null);
      const a = Math.abs(differenz(gate.zeilen[gate.zeilen.length - 1].kursDanach, nach.kurs));
      assert.ok(a >= 20 && a <= 160, `${a}°`);
    });
  }
});

test('Gates nicht am ersten oder letzten Segment, nicht neben einem Vollkreis, mindestens zwei Segmente dazwischen', () => {
  for (const elemente of gateListen) {
    const erstes = elemente.findIndex((e) => e.art === 'segment');
    const letztes = elemente.findLastIndex((e) => e.art === 'segment');
    let segmenteSeitGate = null;
    elemente.forEach((e, k) => {
      if (e.art === 'segment' && segmenteSeitGate !== null) segmenteSeitGate += 1;
      if (e.art !== 'gate') return;
      assert.equal(elemente[k - 1].art, 'segment', 'kein Vollkreis direkt vor dem Gate');
      assert.equal(elemente[k + 1].art, 'segment', 'kein Vollkreis direkt nach dem Gate');
      assert.notEqual(k - 1, erstes, 'Gate am ersten Segment');
      assert.notEqual(k + 1, letztes, 'Gate am letzten Segment');
      if (segmenteSeitGate !== null) assert.ok(segmenteSeitGate >= 2, `nur ${segmenteSeitGate} Segmente zwischen zwei Gates`);
      segmenteSeitGate = 0;
    });
  }
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

test('Vollkreis: zwei Halbbögen, Rückkehr zum Ausgangspunkt, Marken am Berührpunkt und bei 180°', () => {
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
  // Anfang, Berührpunkt, 180°, Ende der Ecke nach dem Kreis, Ende
  assert.equal(geo.marken.length, 5);
  assert.ok(geo.marken.some((m) => naheBei(m.punkt.x, streckenEnde.x) && naheBei(m.punkt.y, streckenEnde.y)), 'Querstrich am Berührpunkt fehlt');
  // Die Ecke nach dem Kreis gehört noch zur zweiten Kreishälfte
  assert.equal(geo.stuecke[3].profil, 'horizontal');
  assert.equal(kleinsterAbstand(geo.stuecke), Infinity, 'Berührpunkt und Ecke gehören zur Figur und zählen nicht als Überlagerung');
});

test('Ecke wird im Profil des vorherigen Segments gezeichnet, das neue Profil beginnt am Querstrich', () => {
  const geo = geometrie([
    { art: 'segment', kurs: 0, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'steigen', rechenaufgabe: null },
    { art: 'segment', kurs: 90, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'sinken', rechenaufgabe: null },
  ]);
  assert.equal(geo.stuecke[1].art, 'bogen');
  assert.equal(geo.stuecke[1].profil, 'steigen');
  assert.equal(geo.stuecke[2].profil, 'sinken');
  const bogenEnde = geo.stuecke[1].punkte[geo.stuecke[1].punkte.length - 1];
  assert.ok(geo.marken.some((m) => naheBei(m.punkt.x, bogenEnde.x) && naheBei(m.punkt.y, bogenEnde.y) && m.kurs === 90), 'Querstrich am Bogenende fehlt');
});

test('Beschriftungen kennen Segmentmitte, Kurs und ihre eigenen Stücke', () => {
  const geo = geometrie([
    { art: 'segment', kurs: 90, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'horizontal', rechenaufgabe: null },
    { art: 'segment', kurs: 30, anzeige: 'keine', himmelsrichtung: null, relativ: -60, dauer: 15, profil: 'steigen', rechenaufgabe: null },
    { art: 'segment', kurs: 120, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'sinken', rechenaufgabe: null },
  ]);
  const [erste, ecke, zweite, dritte] = geo.beschriftungen;
  assert.deepEqual(erste.eigeneStuecke, [0, 1]);
  assert.equal(erste.kurs, 90);
  assert.ok(naheBei(erste.mitte.x, 5 * SEKUNDE_LAENGE) && naheBei(erste.mitte.y, 0));
  assert.deepEqual(ecke.zeilen, ['-60°']);
  assert.equal(ecke.mitte, null);
  assert.deepEqual([...ecke.eigeneStuecke].sort(), [0, 1, 2]);
  assert.deepEqual(zweite.eigeneStuecke, [1, 2, 3]);
  assert.deepEqual(dritte.eigeneStuecke, [3, 4]);
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

test('zaehleKreuzungen: Schleifenausnahme nur zwischen zwei Strecken', () => {
  const strecke = (a, b) => ({ art: 'strecke', profil: 'horizontal', pfad: '', punkte: [a, b], schleife: false });
  const bogen = (a, b, schleife) => ({ art: 'bogen', profil: 'horizontal', pfad: '', punkte: [a, b], schleife });
  const kreuzUeberSchleife = (art) => [
    art === 'strecke' ? strecke({ x: 0, y: 10 }, { x: 0, y: 0 }) : bogen({ x: 0, y: 10 }, { x: 0, y: 0 }, false),
    bogen({ x: 0, y: 0 }, { x: -5, y: 5 }, true),
    strecke({ x: -5, y: 5 }, { x: 5, y: 5 }),
  ];
  assert.equal(zaehleKreuzungen(kreuzUeberSchleife('strecke')), 0);
  assert.equal(zaehleKreuzungen(kreuzUeberSchleife('bogen')), 1);
});

test('kleinsterAbstand misst nur zwischen Stücken, die eine Strecke trennt, und bricht früh ab', () => {
  const strecke = (a, b) => ({ art: 'strecke', profil: 'horizontal', pfad: '', punkte: [a, b], schleife: false });
  const bogen = (a, b) => ({ art: 'bogen', profil: 'horizontal', pfad: '', punkte: [a, b], schleife: false });
  // Haarnadel: hin, kurzes Querstück, zurück im Abstand 6
  const haarnadel = [
    strecke({ x: 0, y: 0 }, { x: 100, y: 0 }),
    strecke({ x: 100, y: 0 }, { x: 100, y: 6 }),
    strecke({ x: 100, y: 6 }, { x: 0, y: 6 }),
  ];
  assert.ok(naheBei(kleinsterAbstand(haarnadel), 6));
  assert.ok(kleinsterAbstand(haarnadel, LINIENBREITE_ABSTAND) < LINIENBREITE_ABSTAND);
  // Zwei Strecken, die nur ein Eckbogen verbindet, liegen an der Ecke dicht beieinander, das gehört zur Figur
  const ecke = [
    strecke({ x: 0, y: 0 }, { x: 100, y: 0 }),
    bogen({ x: 100, y: 0 }, { x: 104, y: 1 }),
    strecke({ x: 104, y: 1 }, { x: 200, y: 30 }),
  ];
  assert.equal(kleinsterAbstand(ecke), Infinity);
  // Eine Ecke mit 20° Kurswechsel aus geometrie(): Sehne rund 4 Einheiten, trotzdem kein Befund
  const flach = geometrie([
    { art: 'segment', kurs: 90, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'horizontal', rechenaufgabe: null },
    { art: 'segment', kurs: 110, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'horizontal', rechenaufgabe: null },
  ]);
  assert.equal(kleinsterAbstand(flach.stuecke), Infinity);
});

test('beschriftungFrei erkennt fremde Strecken und andere Beschriftungen im Text', () => {
  const strecke = (a, b) => ({ art: 'strecke', profil: 'horizontal', pfad: '', punkte: [a, b], schleife: false });
  const beschriftung = { zeilen: ['090°/20"'], x: 50, y: -11, winkel: 0, mitte: { x: 50, y: 0 }, kurs: 90, eigeneStuecke: [0] };
  const eigene = strecke({ x: 0, y: 0 }, { x: 100, y: 0 });
  const quer = strecke({ x: 60, y: -40 }, { x: 60, y: -20 });
  assert.equal(beschriftungFrei({ stuecke: [eigene, quer], beschriftungen: [beschriftung] }), false, 'fremde Strecke kurz vor dem Text');
  const querDurch = strecke({ x: 45, y: -40 }, { x: 45, y: 40 });
  assert.equal(beschriftungFrei({ stuecke: [eigene, querDurch], beschriftungen: [beschriftung] }), false, 'fremde Strecke durch den Text');
  const fern = strecke({ x: 300, y: -40 }, { x: 300, y: 40 });
  assert.equal(beschriftungFrei({ stuecke: [eigene, fern], beschriftungen: [beschriftung] }), true);
  // Die eigene Strecke liegt 11 Einheiten neben dem Text und stört nicht
  assert.equal(beschriftungFrei({ stuecke: [eigene], beschriftungen: [beschriftung] }), true);
  const zweite = { ...beschriftung, x: 70, y: -13 };
  assert.equal(beschriftungFrei({ stuecke: [eigene], beschriftungen: [beschriftung, zweite] }), false, 'zwei Beschriftungen übereinander');
});

test('beschriftungFrei: keine Beschriftung innerhalb eines Vollkreises, auch wenn sie keinen Strich berührt', () => {
  const kreisGeo = geometrie([
    { art: 'segment', kurs: 90, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer: 10, profil: 'horizontal', rechenaufgabe: null },
    { art: 'vollkreis', richtung: 'rechts', profile: ['steigen', 'horizontal'] },
  ]);
  assert.ok(kreisGeo.stuecke[1].kreis && kreisGeo.stuecke[2].kreis, 'Kreishälften kennen ihren Kreis');
  const { mitte } = kreisGeo.stuecke[1].kreis;
  const innen = { zeilen: ['+78°'], x: mitte.x, y: mitte.y, winkel: 0, mitte: null, kurs: null, eigeneStuecke: [] };
  assert.equal(beschriftungFrei({ stuecke: kreisGeo.stuecke, beschriftungen: [innen] }), false);
  const aussen = { ...innen, x: mitte.x + 200 };
  assert.equal(beschriftungFrei({ stuecke: kreisGeo.stuecke, beschriftungen: [aussen] }), true);
});

test('seitenverhaeltnisPasst', () => {
  assert.equal(seitenverhaeltnisPasst({ minX: 0, minY: 0, maxX: 100, maxY: 100 }), true);
  assert.equal(seitenverhaeltnisPasst({ minX: 0, minY: 0, maxX: 70, maxY: 100 }), true);
  assert.equal(seitenverhaeltnisPasst({ minX: 0, minY: 0, maxX: 125, maxY: 100 }), true);
  assert.equal(seitenverhaeltnisPasst({ minX: 0, minY: 0, maxX: 65, maxY: 100 }), false);
  assert.equal(seitenverhaeltnisPasst({ minX: 0, minY: 0, maxX: 130, maxY: 100 }), false);
  assert.equal(seitenverhaeltnisPasst({ minX: 0, minY: 0, maxX: 300, maxY: 100 }), false);
});

test('erzeugeParcours ist bestimmt und liefert Kandidat, Kreuzungen und Umriss', () => {
  const a = erzeugeParcours(new Zufall('stufe-2/blatt-1'));
  const b = erzeugeParcours(new Zufall('stufe-2/blatt-1'));
  assert.deepEqual(a, b);
  assert.ok(a.kandidat >= 1 && a.kandidat <= KANDIDATEN);
  assert.ok(a.kreuzungen >= 0);
  assert.ok(a.fuellung > 0);
  assert.equal(typeof a.zulaessig, 'boolean');
  assert.ok(a.geometrie.umriss.maxX > a.geometrie.umriss.minX);
  assert.equal(a.geometrie.beschriftungen.length >= a.elemente.filter((e) => e.art === 'segment').length, true);
});

test('erzeugeParcours findet fast immer einen zulässigen Kandidaten, und zulässig heißt alle Filter bestanden', () => {
  let zulaessig = 0;
  for (let i = 0; i < 30; i++) {
    const p = erzeugeParcours(new Zufall(`suche-${i}`));
    if (!p.zulaessig) continue;
    zulaessig += 1;
    assert.equal(p.kreuzungen, 0);
    assert.equal(zaehleKreuzungen(p.geometrie.stuecke), 0);
    assert.ok(kleinsterAbstand(p.geometrie.stuecke) >= LINIENBREITE_ABSTAND);
    assert.ok(seitenverhaeltnisPasst(p.geometrie.umriss));
    assert.equal(beschriftungFrei(p.geometrie), true);
  }
  assert.ok(zulaessig >= 27, `nur ${zulaessig} von 30 zulässig`);
});

const blaetter = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => erzeugeBlatt(2, i + 1));

test('keine Zeile einer Segmentbeschriftung liegt auf ihrer eigenen Linie, Blätter 1 bis 100', () => {
  for (const blatt of blaetter) {
    for (const b of blatt.parcours.geometrie.beschriftungen) {
      if (b.mitte === null) continue;
      const w = (b.winkel * Math.PI) / 180;
      const k = (b.kurs * Math.PI) / 180;
      const d = { x: Math.sin(k), y: -Math.cos(k) };
      for (let i = 0; i < b.zeilen.length; i++) {
        const c = { x: b.x - i * ZEILENABSTAND * Math.sin(w), y: b.y + i * ZEILENABSTAND * Math.cos(w) };
        const abstand = Math.abs(d.x * (c.y - b.mitte.y) - d.y * (c.x - b.mitte.x));
        assert.ok(abstand >= 8.5, `Blatt ${blatt.nummer}, "${b.zeilen[i]}" nur ${abstand.toFixed(1)} von der Linie`);
      }
    }
  }
});

test('zulässige Blätter 1 bis 100 haben freie Beschriftungen', () => {
  for (const blatt of blaetter) {
    if (!blatt.parcours.zulaessig) continue;
    assert.equal(beschriftungFrei(blatt.parcours.geometrie), true, `Blatt ${blatt.nummer}`);
  }
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

// Beispiel aus der Handzeichnung: Ankunft auf 090, Gate mit vier Zeilen, danach 180
const BEISPIEL_GATE = {
  art: 'gate',
  zeilen: [
    { kurs: { typ: 'relativ', wert: 72 }, kursDanach: 162, profil: 'horizontal', dauer: 10 },
    { kurs: { typ: 'himmelsrichtung', index: 9 }, kursDanach: 202.5, profil: 'steigen', dauer: 15 },
    { kurs: { typ: 'grad', grad: 123 }, kursDanach: 123, profil: 'horizontal', dauer: 15 },
    { kurs: { typ: 'relativ', wert: -400 }, kursDanach: 83, profil: 'sinken', dauer: 10 },
  ],
};

function segment(kurs, dauer = 10) {
  return { art: 'segment', kurs, anzeige: 'grad', himmelsrichtung: null, relativ: null, dauer, profil: 'horizontal', rechenaufgabe: null };
}

// Abstand eines Punkts zum Rand eines achsenparallelen Kastens aus seinen Ecken
function randAbstand(punkt, ecken) {
  const xs = ecken.map((q) => q.x);
  const ys = ecken.map((q) => q.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const innen = punkt.x >= minX && punkt.x <= maxX && punkt.y >= minY && punkt.y <= maxY;
  if (innen) return Math.min(punkt.x - minX, maxX - punkt.x, punkt.y - minY, maxY - punkt.y);
  const dx = Math.max(minX - punkt.x, 0, punkt.x - maxX);
  const dy = Math.max(minY - punkt.y, 0, punkt.y - maxY);
  return Math.hypot(dx, dy);
}

// Wie tief ein Punkt im Kasten liegt, 0 außerhalb
function tiefeImKasten(punkt, ecken) {
  const xs = ecken.map((q) => q.x);
  const ys = ecken.map((q) => q.y);
  return Math.max(0, Math.min(punkt.x - Math.min(...xs), Math.max(...xs) - punkt.x, punkt.y - Math.min(...ys), Math.max(...ys) - punkt.y));
}

function punktAufStrecke(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy);
  return t >= -1e-9 && t <= 1 + 1e-9 && Math.abs(vx * (p.y - a.y) - vy * (p.x - a.x)) / Math.hypot(vx, vy) < 0.01;
}

function richtungGrad(von, nach) {
  return normieren((Math.atan2(nach.x - von.x, -(nach.y - von.y)) * 180) / Math.PI);
}

test('Gate-Kasten: Maße aus dem Text, Ankunft am Rand in Kursrichtung, Austritt am Rand zum nächsten Kurs', () => {
  const geo = geometrie([segment(90), BEISPIEL_GATE, segment(180)]);
  assert.deepEqual(geo.stuecke.map((s) => s.art), ['strecke', 'gate', 'strecke']);
  const kasten = geo.stuecke[1];
  assert.equal(kasten.punkte.length, 5);
  assert.deepEqual(kasten.punkte[4], kasten.punkte[0]);
  assert.equal(kasten.profil, null);
  assert.equal(kasten.schleife, false);
  // Breite 6,2 je Zeichen der längsten Zeile ("123° → 15"" hat 10) plus 10, Höhe 4 Zeilen zu 9 plus 8
  const xs = kasten.punkte.map((q) => q.x);
  const ys = kasten.punkte.map((q) => q.y);
  assert.ok(naheBei(Math.max(...xs) - Math.min(...xs), 72));
  assert.ok(naheBei(Math.max(...ys) - Math.min(...ys), 44));
  // Ankunft (50, 0) ist die Mitte der linken Kante, Austritt die Mitte der unteren
  assert.ok(naheBei(Math.min(...xs), 50) && naheBei(Math.min(...ys), -22));
  const austritt = geo.stuecke[2].punkte[0];
  assert.ok(naheBei(austritt.x, 86) && naheBei(austritt.y, 22), `Austritt ${austritt.x}, ${austritt.y}`);
  assert.ok(naheBei(geo.stuecke[2].punkte[1].y, 22 + 10 * SEKUNDE_LAENGE), 'nächste Strecke läuft ohne Bogen nach Süden');
  // Querstrich am Austritt
  assert.ok(geo.marken.some((m) => naheBei(m.punkt.x, 86) && naheBei(m.punkt.y, 22) && m.kurs === 180), 'Querstrich am Austritt fehlt');
  // Beschriftung im Kasten
  const text = geo.beschriftungen.find((b) => b.gate);
  assert.deepEqual(text.zeilen, ['+72 → 10"', 'SSW ↗ 15"', '123° → 15"', '-400 ↘ 10"']);
  assert.ok(naheBei(text.x, 86) && naheBei(text.y, 0));
  assert.equal(text.winkel, 0);
  assert.ok(text.eigeneStuecke.includes(1));
  // Der Umriss enthält die Kastenecken
  assert.ok(geo.umriss.maxX >= 122 - 0.01 && geo.umriss.maxY >= 22 - 0.01 && geo.umriss.minY <= -22 + 0.01);
});

test('Gate-Kasten in erzeugten Parcours: Ankunft und Austritt auf dem Rand, nächste Strecke beginnt am Austritt', () => {
  let geprueft = 0;
  for (const elemente of gateListen.slice(0, 40)) {
    const geo = geometrie(elemente);
    const ketteGates = gates(elemente);
    const kaesten = geo.stuecke.map((s, i) => i).filter((i) => geo.stuecke[i].art === 'gate');
    assert.equal(kaesten.length, ketteGates.length);
    for (const g of kaesten) {
      const kasten = geo.stuecke[g];
      assert.equal(kasten.punkte.length, 5);
      const davor = geo.stuecke[g - 1];
      const danach = geo.stuecke[g + 1];
      assert.equal(davor.art, 'strecke');
      assert.equal(danach.art, 'strecke');
      const ankunft = davor.punkte[davor.punkte.length - 1];
      const austritt = danach.punkte[0];
      assert.ok(randAbstand(ankunft, kasten.punkte) < 0.01, `Ankunft ${randAbstand(ankunft, kasten.punkte)} vom Rand`);
      assert.ok(randAbstand(austritt, kasten.punkte) < 0.01, `Austritt ${randAbstand(austritt, kasten.punkte)} vom Rand`);
      // Vom Ankunftspunkt geht es in Richtung des alten Kurses zur Mitte, von der Mitte zum Austritt im neuen Kurs
      const mitte = { x: (kasten.punkte[0].x + kasten.punkte[2].x) / 2, y: (kasten.punkte[0].y + kasten.punkte[2].y) / 2 };
      const kursDavor = richtungGrad(davor.punkte[0], ankunft);
      const kursDanach = richtungGrad(austritt, danach.punkte[1]);
      assert.ok(Math.abs(differenz(richtungGrad(ankunft, mitte), kursDavor)) < 0.01);
      assert.ok(Math.abs(differenz(richtungGrad(mitte, austritt), kursDanach)) < 0.01);
      // Querstrich am Austritt: auf der Strecke, höchstens 20 Einheiten weiter, kein Ende tiefer als 2 im Kasten
      const marke = geo.marken.find((m) => punktAufStrecke(m.punkt, austritt, danach.punkte[1]) && Math.hypot(m.punkt.x - austritt.x, m.punkt.y - austritt.y) <= 20);
      assert.ok(marke, 'Querstrich am Austritt fehlt');
      assert.ok(Math.abs(differenz(marke.kurs, kursDanach)) < 0.01, 'Querstrich quer zur Strecke');
      const r = (marke.kurs * Math.PI) / 180;
      for (const seite of [1, -1]) {
        const ende = { x: marke.punkt.x + seite * Math.cos(r) * MARKENLAENGE, y: marke.punkt.y + seite * Math.sin(r) * MARKENLAENGE };
        assert.ok(tiefeImKasten(ende, kasten.punkte) <= 2 + 1e-9, `Querstrich ragt ${tiefeImKasten(ende, kasten.punkte).toFixed(2)} in den Kasten`);
      }
      geprueft += 1;
    }
  }
  assert.ok(geprueft >= 120, `nur ${geprueft} Kästen geprüft`);
});

test('Gate: Strecke davor und danach zählen gegeneinander, ein Austritt am Ankunftspunkt ist eine Überlagerung', () => {
  const kehre = geometrie([segment(90), BEISPIEL_GATE, segment(270)]);
  assert.ok(kleinsterAbstand(kehre.stuecke) < LINIENBREITE_ABSTAND, 'Austritt zurück über die Ankunft wird nicht erkannt');
  const ecke = geometrie([segment(90), BEISPIEL_GATE, segment(180)]);
  assert.ok(kleinsterAbstand(ecke.stuecke) >= LINIENBREITE_ABSTAND);
});

test('Gate: der Kasten ist für andere Beschriftungen belegt, auch innen, und fremde Strecken kreuzen ihn', () => {
  const geo = geometrie([segment(90), BEISPIEL_GATE, segment(180)]);
  assert.equal(beschriftungFrei(geo), true, 'Gate-Text mit Strecke davor und danach ist frei');
  const fremd = { zeilen: ['120°/10"'], x: 86, y: 0, winkel: 0, mitte: null, kurs: null, eigeneStuecke: [] };
  assert.equal(beschriftungFrei({ ...geo, beschriftungen: [...geo.beschriftungen, fremd] }), false, 'Beschriftung im Kasten');
  const quer = { art: 'strecke', profil: 'horizontal', pfad: '', punkte: [{ x: 86, y: -60 }, { x: 86, y: -10 }], schleife: false };
  assert.equal(zaehleKreuzungen([...geo.stuecke, quer]), 1, 'fremde Strecke in den Kasten');
});

const GATE_ZEILE = /^(\+\d+|-\d+|[NESW]{1,3}|\d{3}°) [→↗↘] (10|15|20)"$/;

test('Blätter mit Nummer teilbar durch 3 haben 3 bis 4 Gates, die anderen keine; Gate-Texte im Muster', () => {
  for (const blatt of blaetter) {
    const anzahl = gates(blatt.parcours.elemente).length;
    const texte = blatt.parcours.geometrie.beschriftungen.filter((b) => b.gate);
    assert.equal(hatGates(2, blatt.nummer), blatt.nummer % 3 === 0);
    if (blatt.nummer % 3 === 0) {
      assert.ok(anzahl >= 3 && anzahl <= 4, `Blatt ${blatt.nummer}: ${anzahl} Gates`);
    } else {
      assert.equal(anzahl, 0, `Blatt ${blatt.nummer}`);
    }
    assert.equal(texte.length, anzahl);
    assert.equal(blatt.parcours.geometrie.stuecke.filter((s) => s.art === 'gate').length, anzahl);
    for (const b of texte) {
      for (const zeile of b.zeilen) assert.match(zeile, GATE_ZEILE, `Blatt ${blatt.nummer}`);
    }
  }
});
