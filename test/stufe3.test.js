import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import {
  erzeugeElemente, STUFE3, STUFE3_START, KURVE_WINKEL, KURVENRATE, hrAbstand, anschlussPasst, anschlussMoeglich, anschlussDrehung,
} from '../js/elemente.js';
import {
  geometrie, bahn, gateTexte, schrittpruefer, zaehleKreuzungen, kleinsterAbstand, beschriftungFrei, KURVENRADIUS, KURVENSCHLEIFE, KEHRENRADIUS,
  LINIENBREITE_ABSTAND, FLUGZEUG_RADIUS,
} from '../js/geometrie.js';
import { normieren, differenz, naechsteHimmelsrichtung, himmelsrichtungGrad } from '../js/kurs.js';

const STUFE_3 = { stufe: 3 };
// Ohne Prüfer entsteht die Kette ohne Blick auf den Weg, schnell genug für viele Stichproben
const listen = Array.from({ length: 400 }, (_, i) => erzeugeElemente(new Zufall(`stufe3-${i}`), STUFE_3, STUFE3_START));
// Mit Prüfer wie in der Kandidatensuche, nur die fertigen Kandidaten
const geprueft = Array.from({ length: 60 }, (_, i) => erzeugeElemente(new Zufall(`stufe3-schritt-${i}`), STUFE_3, STUFE3_START, schrittpruefer()))
  .filter(Boolean);
const alle = [...listen, ...geprueft];

const segmente = (elemente) => elemente.filter((e) => e.art === 'segment');
const zaehle = (elemente, art) => elemente.filter((e) => e.art === art).length;

function imBereich(wert, [von, bis]) {
  return wert >= von && wert <= bis;
}

// Kurs vor Element k: nach einem Gate der Kurs der letzten Zeile, nach einer
// Kurve der Kurs davor plus oder minus Winkel, nach einem Vollkreis der Kurs davor
function kursVor(elemente, k) {
  let kurs = null;
  for (let j = 0; j < k; j++) {
    const e = elemente[j];
    if (e.art === 'segment') kurs = e.kurs;
    else if (e.art === 'kurve') kurs = normieren(kurs + (e.richtung === 'rechts' ? e.winkel : -e.winkel));
    else if (e.art === 'gate') kurs = e.zeilen[e.zeilen.length - 1].kursDanach;
  }
  return kurs;
}

test('Stufe 3: Mengen je Blatt nach dem Entwurf, Randwerte kommen vor', () => {
  const gesehen = { segmente: new Set(), vollkreise: new Set(), kurven: new Set(), gates: new Set(), relative: new Set(), hrgk: new Set(), rechen: new Set(), himmel: new Set() };
  for (const elemente of alle) {
    const s = segmente(elemente);
    const zahlen = {
      segmente: s.length,
      vollkreise: zaehle(elemente, 'vollkreis'),
      kurven: zaehle(elemente, 'kurve'),
      gates: zaehle(elemente, 'gate'),
      relative: s.filter((e) => e.relativ !== null).length,
      hrgk: s.filter((e) => ['hr', 'hrKurs', 'gk'].includes(e.anzeige)).length,
      rechen: s.filter((e) => e.rechenaufgabe !== null).length,
      himmel: s.filter((e) => e.anzeige === 'himmelsrichtung').length,
    };
    const soll = {
      segmente: STUFE3.segmente, vollkreise: STUFE3.vollkreise, kurven: STUFE3.kurven, gates: STUFE3.gates, relative: STUFE3.relative,
      hrgk: STUFE3.hrgk, rechen: STUFE3.rechenaufgaben, himmel: STUFE3.himmelsrichtungen,
    };
    for (const [name, wert] of Object.entries(zahlen)) {
      assert.ok(imBereich(wert, soll[name]), `${name}: ${wert}, erlaubt ${soll[name]}`);
      gesehen[name].add(wert);
    }
    for (const e of s) {
      assert.ok([10, 15, 20, 25].includes(e.dauer), `Dauer ${e.dauer}`);
      if (e.rechenaufgabe !== null) assert.ok(Number.isInteger(e.rechenaufgabe) && Math.abs(e.rechenaufgabe) >= 100 && Math.abs(e.rechenaufgabe) <= 350);
    }
  }
  assert.deepEqual(STUFE3.segmente, [18, 24]);
  for (const [name, werte] of Object.entries(gesehen)) {
    const soll = { segmente: STUFE3.segmente, vollkreise: STUFE3.vollkreise, kurven: STUFE3.kurven, gates: STUFE3.gates, relative: STUFE3.relative, hrgk: STUFE3.hrgk, rechen: STUFE3.rechenaufgaben, himmel: STUFE3.himmelsrichtungen }[name];
    assert.ok(werte.has(soll[0]) && werte.has(soll[1]), `${name}: Randwerte ${soll} nicht beide gesehen`);
  }
});

test('Stufe 3: Gates, Vollkreise und Kurven nie am ersten oder letzten Segment und nie direkt hintereinander', () => {
  for (const elemente of alle) {
    assert.equal(elemente[0].art, 'segment');
    assert.equal(elemente[elemente.length - 1].art, 'segment');
    let segmentNr = 0;
    const anzahl = segmente(elemente).length;
    elemente.forEach((e, k) => {
      if (e.art === 'segment') { segmentNr += 1; return; }
      assert.ok(['vollkreis', 'kurve', 'gate'].includes(e.art));
      assert.equal(elemente[k - 1].art, 'segment', `${e.art} direkt nach ${elemente[k - 1].art}`);
      assert.equal(elemente[k + 1].art, 'segment', `${e.art} direkt vor ${elemente[k + 1].art}`);
      assert.ok(segmentNr >= 2, `${e.art} nach Segment ${segmentNr}`);
      assert.ok(anzahl - segmentNr >= 2, `${e.art} nach Segment ${segmentNr} von ${anzahl}`);
    });
  }
});

test('Stufe 3: Gradzahl-Kurve mit Winkel 40 bis 340 ohne 180, Richtung, eigenem Profil; das Segment danach ohne Kurs', () => {
  const winkel = [];
  const richtungen = new Set();
  for (const elemente of alle) {
    elemente.forEach((e, k) => {
      if (e.art !== 'kurve') return;
      assert.ok(Number.isInteger(e.winkel) && e.winkel >= KURVE_WINKEL.min && e.winkel <= KURVE_WINKEL.max && e.winkel !== 180, `${e.winkel}`);
      assert.ok(['links', 'rechts'].includes(e.richtung));
      assert.ok(['horizontal', 'steigen', 'sinken'].includes(e.profil));
      winkel.push(e.winkel);
      richtungen.add(e.richtung);
      const nach = elemente[k + 1];
      assert.equal(nach.anzeige, 'keine');
      assert.equal(nach.relativ, null, 'nach einer Kurve keine relative Ecke');
      const vorher = kursVor(elemente, k);
      assert.equal(nach.kurs, normieren(vorher + (e.richtung === 'rechts' ? e.winkel : -e.winkel)));
    });
  }
  assert.equal(KURVENRATE, 3);
  assert.ok(winkel.some((w) => w < 90) && winkel.some((w) => w > 270) && winkel.some((w) => w > 180 && w < 270));
  assert.deepEqual([...richtungen].sort(), ['links', 'rechts']);
});

test('Stufe 3: HR rundet auf die nächste Himmelsrichtung, GK ist der Gegenkurs', () => {
  const arten = { hr: 0, hrKurs: 0, gk: 0 };
  for (const elemente of alle) {
    elemente.forEach((e, k) => {
      if (e.art !== 'segment' || !['hr', 'hrKurs', 'gk'].includes(e.anzeige)) return;
      arten[e.anzeige] += 1;
      assert.ok(k > 0 && elemente[k - 1].art !== 'kurve' && elemente[k - 1].art !== 'gate', 'HR/GK braucht eine gezeichnete Ecke davor');
      const vorher = kursVor(elemente, k);
      assert.equal(e.relativ, null);
      if (e.anzeige === 'hr') {
        // HR/: nächste Himmelsrichtung, 5° bis unter 11,25° entfernt, nie genau in der Mitte
        assert.equal(e.himmelsrichtung, naechsteHimmelsrichtung(vorher));
        assert.equal(e.kurs, himmelsrichtungGrad(e.himmelsrichtung));
        const a = Math.abs(differenz(vorher, e.kurs));
        assert.ok(a >= 5 && a < 11.25, `${vorher} auf ${e.kurs}: ${a}°`);
      } else if (e.anzeige === 'hrKurs') {
        // HR 111°: 111 auf OSO (112,5), der Gradkurs 1° bis 10° neben der Himmelsrichtung
        assert.ok(Number.isInteger(e.hrGrad) && e.hrGrad >= 0 && e.hrGrad <= 359);
        assert.ok(hrAbstand(e.hrGrad) >= 1 && hrAbstand(e.hrGrad) <= 10, `${e.hrGrad}`);
        assert.equal(e.himmelsrichtung, naechsteHimmelsrichtung(e.hrGrad));
        assert.equal(e.kurs, himmelsrichtungGrad(e.himmelsrichtung));
        const a = Math.abs(differenz(vorher, e.kurs));
        assert.ok(a >= 20 && a <= 160, `${vorher} auf ${e.kurs}: ${a}°`);
      } else {
        assert.equal(e.kurs, normieren(vorher + 180));
        assert.ok(['links', 'rechts'].includes(e.gkRichtung));
      }
    });
  }
  assert.ok(arten.hr > 50 && arten.hrKurs > 50 && arten.gk > 50, JSON.stringify(arten));
  // Beispiele aus dem Brief: 010 auf N, 015 auf NNE, 111 auf OSO
  assert.equal(naechsteHimmelsrichtung(10), 0);
  assert.equal(naechsteHimmelsrichtung(15), 1);
  assert.equal(himmelsrichtungGrad(naechsteHimmelsrichtung(111)), 112.5);
  assert.equal(hrAbstand(11.25), 11.25);
});

test('Stufe 3: Segmente mit eigenem Kurs 20 bis 160 Grad nach einer Ecke oder einem Gate der Form B und C', () => {
  for (const elemente of alle) {
    elemente.forEach((e, k) => {
      if (e.art !== 'segment' || k === 0 || !['grad', 'himmelsrichtung'].includes(e.anzeige)) return;
      const vorher = elemente[k - 1];
      if (vorher.art === 'gate' && vorher.form === 'a') return;
      const a = Math.abs(differenz(kursVor(elemente, k), e.kurs));
      assert.ok(a >= 20 && a <= 160, `${a}°`);
    });
  }
});

const GATE_A = /^([+-]\d+°|[NESW]{1,3}|\d{3}°) [→↗↘] (10|15|20|25)"$/;
const GATE_B = /^([+-]\d+|[NESW]{1,3}|\d{3}°) [→↗↘] (10|15|20|25)"$/;
const GATE_C = /^[→↗↘] ([NESW]{1,3}|[NESW]{1,3} [+-]\d+°|GK|GK [+-]\d+°|anl\. Kurs \+\d+°|anl\. Kurs \+\d×\d) (10|15|20|25)"$/;
const ANSCHLUSS = /^(über N|über S|kürz\. W\.) auf K$/;

test('Stufe 3: Gates in drei Formen mit Zeilenmuster und Werten nach dem Entwurf', () => {
  const formen = { a: 0, b: 0, c: 0 };
  const typenC = {};
  for (const elemente of alle) {
    let anl = 0;
    elemente.forEach((gate, k) => {
      if (gate.art !== 'gate') return;
      formen[gate.form] += 1;
      const texte = gateTexte(gate);
      if (gate.form === 'a') {
        assert.equal(gate.zeilen.length, 3);
        assert.equal(texte.length, 4);
        texte.slice(0, 3).forEach((t) => assert.match(t, GATE_A));
        assert.match(texte[3], ANSCHLUSS);
      } else if (gate.form === 'b') {
        assert.equal(gate.zeilen.length, 4);
        assert.equal(gate.anschluss, null);
        texte.forEach((t) => assert.match(t, GATE_B));
      } else {
        assert.ok(gate.zeilen.length >= 3 && gate.zeilen.length <= 4);
        assert.equal(gate.anschluss, null);
        texte.forEach((t) => assert.match(t, GATE_C));
      }
      if (gate.form !== 'c') assert.ok(gate.zeilen.some((z) => z.kurs.typ === 'relativ'), 'Form A und B mit relativer Zeile');
      let kurs = kursVor(elemente, k);
      for (const z of gate.zeilen) {
        const { typ } = z.kurs;
        let ziel;
        if (typ === 'relativ') {
          const betrag = Math.abs(z.kurs.wert);
          assert.ok(gate.form !== 'c');
          assert.ok(betrag >= 20 && betrag <= (gate.form === 'a' ? 160 : 490), `${gate.form}: ${z.kurs.wert}`);
          ziel = normieren(kurs + z.kurs.wert);
        } else if (typ === 'himmelsrichtung') ziel = himmelsrichtungGrad(z.kurs.index);
        else if (typ === 'grad') {
          assert.ok(gate.form !== 'c');
          ziel = z.kurs.grad;
        } else {
          assert.equal(gate.form, 'c', `${typ} nur in Form C`);
          typenC[typ] = (typenC[typ] || 0) + 1;
          if (typ === 'hrPlus') {
            assert.ok(Math.abs(z.kurs.wert) >= 10 && Math.abs(z.kurs.wert) <= 130);
            ziel = normieren(himmelsrichtungGrad(z.kurs.index) + z.kurs.wert);
          } else if (typ === 'gk') ziel = normieren(kurs + 180);
          else if (typ === 'gkPlus') {
            assert.ok(Math.abs(z.kurs.wert) >= 10 && Math.abs(z.kurs.wert) <= 60);
            ziel = normieren(kurs + 180 + z.kurs.wert);
          } else if (typ === 'anl') {
            anl += 1;
            assert.ok(z.kurs.wert >= 20 && z.kurs.wert <= 160);
            ziel = normieren(kurs + z.kurs.wert);
          } else {
            assert.equal(typ, 'anlProdukt');
            anl += 1;
            assert.ok(z.kurs.a >= 2 && z.kurs.a <= 9 && z.kurs.b >= 2 && z.kurs.b <= 9);
            assert.equal(z.kurs.wert, z.kurs.a * z.kurs.b);
            assert.ok(z.kurs.wert >= 20 && z.kurs.wert <= 160);
            ziel = normieren(kurs + z.kurs.wert);
          }
        }
        assert.equal(z.kursDanach, ziel);
        const a = Math.abs(differenz(kurs, ziel));
        if (typ === 'gk') assert.equal(a, 180);
        else assert.ok(a >= 20 && a <= 160, `${gate.form} ${typ}: ${kurs} auf ${ziel}, ${a}°`);
        assert.ok([10, 15, 20, 25].includes(z.dauer));
        kurs = ziel;
      }
    });
    assert.ok(anl <= 1, `${anl} Zeilen mit anl. Kurs auf einem Blatt`);
  }
  const summe = formen.a + formen.b + formen.c;
  for (const f of ['a', 'b', 'c']) assert.ok(formen[f] / summe > 0.28 && formen[f] / summe < 0.39, JSON.stringify(formen));
  for (const typ of ['hrPlus', 'gk', 'gkPlus', 'anl', 'anlProdukt']) assert.ok(typenC[typ] > 0, `${typ} kommt nicht vor: ${JSON.stringify(typenC)}`);
});

test('Stufe 3: Anschlusszeile nur bei Form A, eindeutig, das Segment danach trägt den Kurs K', () => {
  const arten = { ueberN: 0, ueberS: 0, kuerzester: 0 };
  let langeSeite = 0;
  for (const elemente of alle) {
    elemente.forEach((gate, k) => {
      if (gate.art !== 'gate') return;
      const nach = elemente[k + 1];
      assert.ok(['grad', 'himmelsrichtung'].includes(nach.anzeige), 'nach dem Gate ein Segment mit eigenem Kurs');
      if (gate.form !== 'a') return;
      const von = gate.zeilen[gate.zeilen.length - 1].kursDanach;
      arten[gate.anschluss] += 1;
      assert.ok(anschlussMoeglich(gate.anschluss, von));
      assert.ok(anschlussPasst(gate.anschluss, von, nach.kurs), `${gate.anschluss} von ${von} auf ${nach.kurs}`);
      const d = anschlussDrehung(gate.anschluss, von, nach.kurs);
      assert.equal(normieren(von + d), nach.kurs);
      if (gate.anschluss === 'kuerzester') assert.ok(Math.abs(d) >= 20 && Math.abs(d) <= 160);
      else {
        // Die Drehung führt genau durch 000° beziehungsweise 180°
        const grenze = gate.anschluss === 'ueberN' ? 0 : 180;
        const weg = normieren(d > 0 ? grenze - von : von - grenze);
        assert.ok(weg > 0 && weg < Math.abs(d), `${gate.anschluss}: ${von} ${d > 0 ? '+' : ''}${d}`);
        if (Math.abs(d) > 180) langeSeite += 1;
      }
    });
  }
  assert.ok(arten.ueberN > 20 && arten.ueberS > 20 && arten.kuerzester > 20, JSON.stringify(arten));
  assert.ok(langeSeite > 10, 'über N/S auch auf der langen Seite');
  // Randfälle: über N nicht von oder auf 000°, nicht 180°, kürzester Weg 20 bis 160
  assert.equal(anschlussMoeglich('ueberN', 0), false);
  assert.equal(anschlussMoeglich('ueberS', 180), false);
  assert.equal(anschlussPasst('ueberN', 90, 0), false);
  assert.equal(anschlussPasst('ueberN', 90, 270), false);
  assert.equal(anschlussPasst('ueberN', 90, 300), true);
  assert.equal(anschlussDrehung('ueberN', 90, 300), -150);
  assert.equal(anschlussDrehung('ueberS', 90, 300), 210);
  assert.equal(anschlussPasst('kuerzester', 90, 260), false);
  assert.equal(anschlussPasst('kuerzester', 90, 250), true);
});

// Profile und Höhen in Flugreihenfolge: Segmente, Kreishälften (60 s), Kurven
// (Winkel / 3 s) und Gate-Zeilen
function flug(elemente) {
  const schritte = [];
  for (const e of elemente) {
    if (e.art === 'segment') schritte.push([e.profil, e.dauer]);
    else if (e.art === 'vollkreis') schritte.push([e.profile[0], 60], [e.profile[1], 60]);
    else if (e.art === 'kurve') schritte.push([e.profil, e.winkel / KURVENRATE]);
    else for (const z of e.zeilen) schritte.push([z.profil, z.dauer]);
  }
  return schritte;
}

test('Stufe 3: Höhe ab 2000 ft zwischen 1000 und 3000 ft, kein Profil viermal hintereinander', () => {
  let tiefste = 3000;
  let hoechste = 1000;
  for (const elemente of alle) {
    let hoehe = STUFE3_START.hoehe;
    const profile = [];
    for (const [profil, sekunden] of flug(elemente)) {
      if (profil === 'steigen') hoehe += 8 * sekunden;
      if (profil === 'sinken') hoehe -= 8 * sekunden;
      assert.ok(hoehe >= 1000 - 1e-9 && hoehe <= 3000 + 1e-9, `${hoehe} ft`);
      tiefste = Math.min(tiefste, hoehe);
      hoechste = Math.max(hoechste, hoehe);
      profile.push(profil);
    }
    for (let i = 3; i < profile.length; i++) {
      assert.ok(!profile.slice(i - 3, i + 1).every((p) => p === profile[i]), `viermal ${profile[i]}`);
    }
  }
  assert.ok(tiefste < 1300 && hoechste > 2700, 'der Rahmen wird genutzt');
});

test('Stufe 3: gleicher Schlüssel, gleiche Elemente, auch mit Prüfer', () => {
  assert.deepEqual(erzeugeElemente(new Zufall('y'), STUFE_3, STUFE3_START), erzeugeElemente(new Zufall('y'), STUFE_3, STUFE3_START));
  assert.deepEqual(
    erzeugeElemente(new Zufall('y'), STUFE_3, STUFE3_START, schrittpruefer()),
    erzeugeElemente(new Zufall('y'), STUFE_3, STUFE3_START, schrittpruefer()),
  );
});

test('Stufe 3: Kandidaten mit Prüfer kreuzen sich nicht und halten den Strichabstand, auch zum Flugzeugsymbol', () => {
  assert.ok(geprueft.length >= 30, `nur ${geprueft.length} von 60 Kandidaten fertig`);
  for (const elemente of geprueft) {
    const roh = bahn(elemente, 0, true);
    assert.equal(zaehleKreuzungen(roh.stuecke, Infinity, true), 0);
    assert.ok(kleinsterAbstand(roh.stuecke, 0, roh.flugzeug, true) >= LINIENBREITE_ABSTAND);
  }
});

function segment(kurs, dauer = 10, weiteres = {}) {
  return { art: 'segment', kurs, anzeige: 'grad', himmelsrichtung: null, relativ: null, rechenaufgabe: null, hrGrad: null, gkRichtung: null, dauer, profil: 'horizontal', ...weiteres };
}

test('Kurve: Bogen im eigenen Profil, Radius 24 unter 180°, Schleife 35 darüber, Querstriche an Anfang und Ende, Gradzahl außen', () => {
  for (const [winkel, radius] of [[90, KURVENRADIUS], [300, KURVENSCHLEIFE]]) {
    const geo = geometrie([
      segment(0, 20),
      { art: 'kurve', winkel, richtung: 'rechts', profil: 'steigen' },
      segment(normieren(winkel), 20, { anzeige: 'keine', profil: 'sinken' }),
    ], 0, true);
    const [erste, kurve, zweite] = geo.stuecke;
    assert.equal(erste.art, 'strecke');
    assert.equal(kurve.art, 'bogen');
    assert.equal(kurve.kurve, true);
    assert.equal(kurve.profil, 'steigen');
    assert.equal(kurve.schleife, winkel > 180);
    assert.equal(kurve.kreis.radius, radius);
    assert.ok(kurve.pfad.includes(`A ${radius} ${radius} 0 ${winkel > 180 ? 1 : 0} 1`), kurve.pfad);
    assert.equal(zweite.art, 'strecke');
    // Das Segment danach beginnt ohne Ecke am Ende der Kurve, in Richtung des neuen Kurses
    const ende = kurve.punkte[kurve.punkte.length - 1];
    assert.ok(Math.hypot(ende.x - zweite.punkte[0].x, ende.y - zweite.punkte[0].y) < 1e-9);
    // Querstriche: Start, Anfang der Kurve, Anfang des Segments danach, Ende
    assert.equal(geo.marken.length, 4);
    assert.ok(Math.hypot(geo.marken[1].punkt.x - erste.punkte[1].x, geo.marken[1].punkt.y - erste.punkte[1].y) < 1e-9);
    assert.ok(Math.hypot(geo.marken[2].punkt.x - ende.x, geo.marken[2].punkt.y - ende.y) < 1e-9);
    // Gradzahl ohne Vorzeichen und Gradzeichen, waagerecht, außerhalb des Bogens
    const text = geo.beschriftungen.find((b) => b.zeilen[0] === String(winkel));
    assert.ok(text, 'Gradzahl fehlt');
    assert.equal(text.winkel, 0);
    assert.ok(Math.hypot(text.x - kurve.kreis.mitte.x, text.y - kurve.kreis.mitte.y) > radius + 10);
    // Kurve und Segment danach: /20" ohne Kurs
    assert.ok(geo.beschriftungen.some((b) => b.zeilen[0] === '/20"'));
  }
  // Eine Schleife über 180° kreuzt Ein- und Ausfahrt, das zählt nicht
  const schleife = geometrie([segment(0, 20), { art: 'kurve', winkel: 300, richtung: 'rechts', profil: 'horizontal' }, segment(300, 20, { anzeige: 'keine' })]);
  assert.equal(zaehleKreuzungen(schleife.stuecke), 0);
});

// Einfahrt 20 s nach Osten, Schleife rechts herum (Radius 28), Ausfahrt 10 s.
// 270°: Die Ausfahrt kreuzt die Einfahrt 22 vor ihrem Ende, sauber wie in der
// Handzeichnung. 240°: Kreuzung nur 1,5 vor dem Ende. 238°: Die Ausfahrt endet
// 0,4 vor dem Strich der Einfahrt, ohne ihn zu kreuzen, ein T wie auf Blatt 80.
test('Schleife: Ein- und Ausfahrt nur als saubere Kreuzung, nie ein Ende im Strich der Einfahrt', () => {
  const kette = (winkel) => [segment(90, 20), segment(normieren(90 + winkel), 10, { anzeige: 'keine', relativ: winkel })];
  for (const [winkel, sauber] of [[270, true], [240, false], [238, false]]) {
    const elemente = kette(winkel);
    assert.equal(schrittpruefer().pruefen(elemente, 2), sauber, `Schrittprüfer bei ${winkel}°`);
    const { stuecke } = bahn(elemente, 0, true);
    assert.equal(stuecke[1].schleife, true);
    const frei = zaehleKreuzungen(stuecke, Infinity, true) === 0 && kleinsterAbstand(stuecke, 0, null, true) >= LINIENBREITE_ABSTAND;
    assert.equal(frei, sauber, `Kreuzungen und Abstand bei ${winkel}°`);
    // Stufe 2 behält die weite Ausnahme, damit ihre Blätter gleich bleiben
    assert.equal(zaehleKreuzungen(stuecke), 0);
    assert.equal(kleinsterAbstand(stuecke), Infinity);
  }
});

// Zuordnung (Stufe 3): Eine Beschriftung steht ihrem eigenen Stück mindestens
// um den Faktor 1,5 näher als jedem fremden, gemessen von der Achse ihrer Kapsel
// zur Mittellinie. "zuordnung" nennt das eigene Stück; Stufe 2 hat das Feld nicht.
const strecke = (a, b) => ({ art: 'strecke', profil: 'horizontal', pfad: '', punkte: [a, b], schleife: false });

test('Zuordnung: Segmentbeschriftung zwischen zwei parallelen Strecken nur mit deutlichem Abstand zur fremden', () => {
  // Eigene Strecke nach Norden, Beschriftung 12 rechts davon, fremde parallele Strecke 26 oder 40 rechts
  const eigene = strecke({ x: 0, y: 0 }, { x: 0, y: -100 });
  const text = { zeilen: ['000°/20"'], x: 12, y: -50, winkel: -90, mitte: { x: 0, y: -50 }, kurs: 0, eigeneStuecke: [0], zuordnung: 0 };
  const nah = strecke({ x: 26, y: -100 }, { x: 26, y: 0 });
  const fern = strecke({ x: 40, y: -100 }, { x: 40, y: 0 });
  assert.equal(beschriftungFrei({ stuecke: [eigene, nah], beschriftungen: [text] }), false, 'fremd 14, eigen 12');
  assert.equal(beschriftungFrei({ stuecke: [eigene, fern], beschriftungen: [text] }), true, 'fremd 28, eigen 12');
  // 15° geneigt zählt noch als parallel, quer (hier 60°) nicht, nur die Berührung
  const geneigt = strecke({ x: 26, y: -50 }, { x: 26 + 50 * Math.sin((15 * Math.PI) / 180), y: -50 + 50 * Math.cos((15 * Math.PI) / 180) });
  assert.equal(beschriftungFrei({ stuecke: [eigene, geneigt], beschriftungen: [text] }), false, '15° geneigt');
  const quer = strecke({ x: 26, y: -50 }, { x: 26 + 50 * Math.sin((60 * Math.PI) / 180), y: -50 + 50 * Math.cos((60 * Math.PI) / 180) });
  assert.equal(beschriftungFrei({ stuecke: [eigene, quer], beschriftungen: [text] }), true, 'quer');
  // Ohne "zuordnung" (Stufe 2) zählt nur die Berührung
  const { zuordnung, ...stufe2 } = text;
  assert.equal(zuordnung, 0);
  assert.equal(beschriftungFrei({ stuecke: [eigene, nah], beschriftungen: [stufe2] }), true);
});

test('Zuordnung: Bogenangabe näher an ihrem Bogen als an jedem fremden', () => {
  // Angabe waagerecht bei y = 25 (Achse von x = -5 bis 15), eigener Bogen darüber
  // mit den Enden bei y = 10 (15 von der Achse), fremder Bogen darunter mit dem
  // Scheitel bei y = 45 (20) oder y = 60 (35)
  const bogen = (y, scheitel) => ({ art: 'bogen', profil: 'horizontal', pfad: '', punkte: [{ x: 0, y }, { x: 5, y: scheitel }, { x: 10, y }], schleife: false });
  const eigen = bogen(10, 5);
  const text = { zeilen: ['+120°'], x: 5, y: 25, winkel: 0, mitte: null, kurs: null, eigeneStuecke: [0], zuordnung: 0 };
  assert.equal(beschriftungFrei({ stuecke: [eigen, bogen(50, 45)], beschriftungen: [text] }), false, 'fremd 20, eigen 15');
  assert.equal(beschriftungFrei({ stuecke: [eigen, bogen(65, 60)], beschriftungen: [text] }), true, 'fremd 35, eigen 15');
  // Eine Vollkreishälfte trägt nie eine Angabe und zählt nicht, eine Kurve schon
  const kreishaelfte = { ...bogen(50, 45), kreis: { mitte: { x: 5, y: 80 }, radius: 35 } };
  assert.equal(beschriftungFrei({ stuecke: [eigen, kreishaelfte], beschriftungen: [text] }), true, 'Vollkreishälfte');
  assert.equal(beschriftungFrei({ stuecke: [eigen, { ...kreishaelfte, kurve: true }], beschriftungen: [text] }), false, 'Kurve');
});

test('Zuordnung: Stufe 3 nennt das eigene Stück jeder Segment-, Eck- und Kurvenbeschriftung, Stufe 2 nicht', () => {
  const elemente = [
    segment(90, 20), segment(210, 20, { anzeige: 'keine', relativ: 120 }),
    { art: 'kurve', winkel: 90, richtung: 'links', profil: 'horizontal' }, segment(120, 20, { anzeige: 'keine' }),
  ];
  const geo = geometrie(elemente, 0, true);
  for (const b of geo.beschriftungen) {
    if (b.fett) assert.equal(b.zuordnung, undefined);
    else assert.equal(geo.stuecke[b.zuordnung].art, b.zeilen[0].includes('/') ? 'strecke' : 'bogen', b.zeilen[0]);
  }
  assert.ok(geometrie(elemente).beschriftungen.every((b) => !('zuordnung' in b)));
});

test('GK: Kehre von 180° mit Radius 20 in der gewählten Richtung, HR mit kleiner Ecke, Beschriftungen HR und GK', () => {
  for (const richtung of ['links', 'rechts']) {
    const geo = geometrie([segment(0, 20), segment(180, 15, { anzeige: 'gk', gkRichtung: richtung })]);
    const [erste, kehre, zweite] = geo.stuecke;
    assert.equal(kehre.art, 'bogen');
    assert.ok(kehre.pfad.includes(`A ${KEHRENRADIUS} ${KEHRENRADIUS} 0 0 ${richtung === 'rechts' ? 1 : 0}`), kehre.pfad);
    // Die beiden Strecken laufen parallel, 40 auseinander, auf der Seite der Kehre
    const versatz = zweite.punkte[0].x - erste.punkte[1].x;
    assert.ok(Math.abs(Math.abs(versatz) - 2 * KEHRENRADIUS) < 1e-9 && Math.sign(versatz) === (richtung === 'rechts' ? 1 : -1));
    assert.ok(geo.beschriftungen.some((b) => b.zeilen[0] === 'GK/15"'));
  }
  const hr = geometrie([segment(128, 20), segment(135, 20, { anzeige: 'hr', himmelsrichtung: 6 }), segment(250, 15, { anzeige: 'hrKurs', himmelsrichtung: 11, hrGrad: 251, kurs: 247.5 })]);
  const texte = hr.beschriftungen.map((b) => b.zeilen[0]);
  assert.ok(texte.includes('HR/20"') && texte.includes('HR 251°/15"'), texte.join(', '));
  assert.ok(hr.stuecke[1].laenge < 2, 'kleine Ecke für 7°');
});

test('Start und Ende: fett, waagerecht, hinter dem Flugzeugsymbol und hinter dem Ende, nur mit startEnde', () => {
  const elemente = [segment(90, 20), segment(180, 20)];
  const ohne = geometrie(elemente);
  assert.ok(!ohne.beschriftungen.some((b) => b.fett), 'Stufe 2 ohne Start und Ende');
  const geo = geometrie(elemente, 0, true);
  const start = geo.beschriftungen.find((b) => b.zeilen[0] === 'Start');
  const ende = geo.beschriftungen.find((b) => b.zeilen[0] === 'Ende');
  assert.ok(start && ende);
  for (const b of [start, ende]) {
    assert.equal(b.fett, true);
    assert.equal(b.winkel, 0);
  }
  // Start links hinter dem Flugzeug, das nach Osten zeigt; Ende unter dem Ende des Wegs nach Süden
  const { mitte } = geo.flugzeug;
  assert.ok(start.x < mitte.x - FLUGZEUG_RADIUS && Math.abs(start.y - mitte.y) < 1e-9);
  const letzter = geo.marken[geo.marken.length - 1].punkt;
  assert.ok(ende.y > letzter.y + 10 && Math.abs(ende.x - letzter.x) < 1e-9);
});
