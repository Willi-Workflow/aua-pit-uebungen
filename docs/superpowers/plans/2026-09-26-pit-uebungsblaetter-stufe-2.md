# PIT-Übungsblätter, Umsetzungsplan für den ersten Bauabschnitt

> **Für ausführende Agenten:** ERFORDERLICHER ABLAUF: superpowers:subagent-driven-development (empfohlen) oder superpowers:executing-plans, Aufgabe für Aufgabe. Schritte tragen Kontrollkästchen (`- [ ]`).

**Ziel:** Eine Browser-App ohne Bausystem, die für Stufe 2 nummerierte Übungsblätter (Textteil plus gezeichneter Parcours) erzeugt und über GitHub Pages für Hannah erreichbar ist.

**Aufbau:** Reine ES-Module. Die Erzeugung (Zufall, Kursrechnung, Textteil, Parcours) ist browserunabhängig und wird mit dem Prüfläufer von Node geprüft. Die Zeichnung erzeugt SVG als Zeichenkette. `app.js` hängt nur die Ansichten an den Adressanker.

**Werkzeuge:** HTML, CSS, JavaScript (ES-Module), SVG, Node 24 (`node --test`), Python `http.server` zum örtlichen Start, `gh` für GitHub.

**Entwurf:** `docs/superpowers/specs/2026-09-26-pit-uebungsblaetter-stufe-2-design.md`

## Globale Randbedingungen

- Keine Abhängigkeiten, weder zur Laufzeit noch zum Prüfen. Kein `npm install`.
- Ausgangskurs `090°`, Ausgangshöhe `2000 ft`, immer.
- Textteil: `12` Zeilen, Zeiten `10, 15, 20` s, Höhe zwischen `1000` und `3000` ft, Steigrate `8` ft/s.
- Parcours: `18` bis `22` Segmente, `2` Vollkreise, `3` bis `4` relative Ecken, `4` bis `5` Rechenaufgaben (`±100` bis `±350`), `3` bis `4` Himmelsrichtungen, Dauer `10, 15, 20, 30` s.
- Geometrie: `1 s = 3` Einheiten, Eckenradius `12`, Vollkreisradius `35`, Linienbreite `9`, weiße Linie `6`.
- Kandidatensuche: bis zu `200` Kandidaten, Seitenverhältnis Breite zu Höhe zwischen `0,6` und `1,2`.
- Himmelsrichtungen: Textteil deutsch (`NNO`, `O`), Zeichnung englisch (`NNE`, `E`), als Einstellung `SCHREIBWEISE` in `js/kurs.js`.
- `100` Blätter je Stufe, Zufallsschlüssel `stufe-2/blatt-7`.
- Adressen: `#/`, `#/stufe2`, `#/stufe2/blatt/7`, `#/stufe3` (Platzhalter), `#/stufe2/endlos` (Platzhalter).
- Bezeichner, Kommentare, Commit-Nachrichten und Oberflächentexte auf Deutsch. Keine Gedankenstriche, keine Emojis, keine Anglizismen, wo ein deutsches Wort existiert.
- Commit-Nachrichten enden mit `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Die Ordner `Stufe 2/` und `Stufe 3/` sind Vorlagen, bleiben in `.gitignore` und werden nie eingecheckt.

## Dateien

| Datei | Zuständigkeit |
|---|---|
| `package.json` | nur `"type": "module"` und das Prüfkommando |
| `js/zufall.js` | Hash, mulberry32, Klasse `Zufall`, `blattSchluessel` |
| `js/kurs.js` | Gradrechnung, Himmelsrichtungen, Schreibweise |
| `js/textteil.js` | Flugzustand, Satzschablonen, `erzeugeTextteil` |
| `js/parcours.js` | `erzeugeElemente`, `geometrie`, `zaehleKreuzungen`, `erzeugeParcours` |
| `js/zeichnung.js` | `zeichneParcours` (SVG-Zeichenkette) |
| `js/blatt.js` | `erzeugeBlatt(stufe, nummer)`, `BLAETTER_JE_STUFE` (ohne DOM, damit prüfbar) |
| `js/app.js` | Adressen, Ansichten, Druckknopf |
| `index.html`, `style.css` | Gerüst, Bildschirm, Druck |
| `test/*.test.js` | eine Prüfdatei je Modul, dazu `test/blaetter.test.js` für alle 100 Blätter |
| `README.md`, `.nojekyll` | Zweck, Start, Prüfung, Adresse; Pages ohne Jekyll |

Abweichung vom Entwurf: `js/blatt.js` kommt hinzu, damit die Erzeugung eines ganzen Blatts ohne Browser prüfbar ist. `app.js` bleibt reine Oberfläche.

---

### Aufgabe 1: Bestimmter Zufall

**Dateien:**
- Erstellen: `package.json`
- Erstellen: `js/zufall.js`
- Prüfung: `test/zufall.test.js`

**Schnittstellen:**
- Liefert: `class Zufall(schluessel: string)` mit `zahl(): number` in [0,1), `ganzzahl(von, bis): number` beide Ränder eingeschlossen, `auswahl(liste)`, `wuerfel(wahrscheinlichkeit): boolean`, `gewichteteAuswahl([{wert, gewicht}])`, `mischen(liste)` (Kopie). Außerdem `hashZeichenkette(text): number`, `mulberry32(startwert): () => number`, `blattSchluessel(stufe, nummer): string`.

- [ ] **Schritt 1: package.json anlegen**

```json
{
  "name": "aua-pit-uebungen",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Schritt 2: Fehlschlagende Prüfung schreiben**

`test/zufall.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall, hashZeichenkette, blattSchluessel } from '../js/zufall.js';

test('gleicher Schlüssel, gleiche Folge', () => {
  const a = new Zufall('stufe-2/blatt-7');
  const b = new Zufall('stufe-2/blatt-7');
  const folgeA = Array.from({ length: 20 }, () => a.zahl());
  const folgeB = Array.from({ length: 20 }, () => b.zahl());
  assert.deepEqual(folgeA, folgeB);
});

test('verschiedene Schlüssel, verschiedene Folgen', () => {
  const a = new Zufall('stufe-2/blatt-7');
  const b = new Zufall('stufe-2/blatt-8');
  assert.notEqual(a.zahl(), b.zahl());
});

test('zahl liegt in [0, 1)', () => {
  const z = new Zufall('bereich');
  for (let i = 0; i < 1000; i++) {
    const n = z.zahl();
    assert.ok(n >= 0 && n < 1);
  }
});

test('ganzzahl bleibt im Bereich und erreicht beide Ränder', () => {
  const z = new Zufall('bereich');
  const gesehen = new Set();
  for (let i = 0; i < 1000; i++) {
    const n = z.ganzzahl(3, 6);
    assert.ok(n >= 3 && n <= 6);
    gesehen.add(n);
  }
  assert.deepEqual([...gesehen].sort(), [3, 4, 5, 6]);
});

test('auswahl liefert nur Elemente der Liste', () => {
  const z = new Zufall('auswahl');
  for (let i = 0; i < 100; i++) assert.ok(['a', 'b', 'c'].includes(z.auswahl(['a', 'b', 'c'])));
});

test('wuerfel mit 0 nie, mit 1 immer', () => {
  const z = new Zufall('wuerfel');
  for (let i = 0; i < 50; i++) {
    assert.equal(z.wuerfel(0), false);
    assert.equal(z.wuerfel(1), true);
  }
});

test('gewichteteAuswahl liefert nur vorhandene Werte und bevorzugt hohe Gewichte', () => {
  const z = new Zufall('gewichte');
  let b = 0;
  for (let i = 0; i < 1000; i++) {
    const wert = z.gewichteteAuswahl([{ wert: 'a', gewicht: 1 }, { wert: 'b', gewicht: 9 }]);
    assert.ok(wert === 'a' || wert === 'b');
    if (wert === 'b') b += 1;
  }
  assert.ok(b > 800, `b kam nur ${b} mal`);
});

test('mischen behält alle Elemente und verändert das Original nicht', () => {
  const z = new Zufall('mischen');
  const original = [1, 2, 3, 4, 5, 6, 7, 8];
  const gemischt = z.mischen(original);
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(gemischt.slice().sort((a, b) => a - b), original);
  assert.notDeepEqual(gemischt, original);
});

test('blattSchluessel ist eindeutig je Stufe und Nummer', () => {
  assert.equal(blattSchluessel(2, 7), 'stufe-2/blatt-7');
  assert.notEqual(hashZeichenkette(blattSchluessel(2, 7)), hashZeichenkette(blattSchluessel(3, 7)));
});
```

- [ ] **Schritt 3: Prüfung laufen lassen, sie muss fehlschlagen**

Befehl: `node --test test/zufall.test.js`
Erwartung: Fehler `Cannot find module '.../js/zufall.js'`

- [ ] **Schritt 4: Modul schreiben**

`js/zufall.js`:

```js
// Bestimmter Zufall: gleicher Schlüssel, gleiche Zahlenfolge.
// Hash nach FNV-1a, Generator mulberry32. Beides klein und ohne Abhängigkeit.

export function hashZeichenkette(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(startwert) {
  let a = startwert >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function blattSchluessel(stufe, nummer) {
  return `stufe-${stufe}/blatt-${nummer}`;
}

export class Zufall {
  constructor(schluessel) {
    this.naechste = mulberry32(hashZeichenkette(schluessel));
  }

  // Gleichverteilt in [0, 1)
  zahl() {
    return this.naechste();
  }

  // Ganze Zahl von "von" bis "bis", beide Ränder eingeschlossen
  ganzzahl(von, bis) {
    return von + Math.floor(this.zahl() * (bis - von + 1));
  }

  auswahl(liste) {
    return liste[this.ganzzahl(0, liste.length - 1)];
  }

  wuerfel(wahrscheinlichkeit) {
    return this.zahl() < wahrscheinlichkeit;
  }

  // eintraege: [{ wert, gewicht }], Gewicht beliebig positiv
  gewichteteAuswahl(eintraege) {
    const summe = eintraege.reduce((s, e) => s + e.gewicht, 0);
    let rest = this.zahl() * summe;
    for (const eintrag of eintraege) {
      rest -= eintrag.gewicht;
      if (rest < 0) return eintrag.wert;
    }
    return eintraege[eintraege.length - 1].wert;
  }

  // Gemischte Kopie nach Fisher-Yates, das Original bleibt unverändert
  mischen(liste) {
    const kopie = liste.slice();
    for (let i = kopie.length - 1; i > 0; i--) {
      const j = this.ganzzahl(0, i);
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  }
}
```

- [ ] **Schritt 5: Prüfung laufen lassen, sie muss bestehen**

Befehl: `node --test test/zufall.test.js`
Erwartung: `# pass 9`, `# fail 0`

- [ ] **Schritt 6: Commit**

```bash
git add package.json js/zufall.js test/zufall.test.js
git commit -m "Bestimmter Zufall aus Blattschlüssel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Aufgabe 2: Kursrechnung und Himmelsrichtungen

**Dateien:**
- Erstellen: `js/kurs.js`
- Prüfung: `test/kurs.test.js`

**Schnittstellen:**
- Liefert: `normieren(grad)`, `gegenkurs(grad)`, `differenz(von, nach)` in (−180, 180], rechts positiv, `drehung(von, nach, richtung)` in [0, 360), `istGanzzahl(grad)`, `kursText(grad)` dreistellig, `himmelsrichtungGrad(index)`, `himmelsrichtungName(index, schreibweise)`, `HIMMELSRICHTUNGEN`, `SCHREIBWEISE = { textteil: 'deutsch', zeichnung: 'englisch' }`.

- [ ] **Schritt 1: Fehlschlagende Prüfung schreiben**

`test/kurs.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normieren, gegenkurs, differenz, drehung, istGanzzahl, kursText,
  himmelsrichtungGrad, himmelsrichtungName, HIMMELSRICHTUNGEN, SCHREIBWEISE,
} from '../js/kurs.js';

test('normieren bringt jeden Wert nach 0 bis 359', () => {
  assert.equal(normieren(360), 0);
  assert.equal(normieren(-30), 330);
  assert.equal(normieren(725), 5);
  assert.equal(normieren(22.5), 22.5);
});

test('gegenkurs', () => {
  assert.equal(gegenkurs(90), 270);
  assert.equal(gegenkurs(202.5), 22.5);
});

test('differenz ist der kürzeste Weg, rechts positiv', () => {
  assert.equal(differenz(90, 120), 30);
  assert.equal(differenz(90, 60), -30);
  assert.equal(differenz(350, 10), 20);
  assert.equal(differenz(10, 350), -20);
  assert.equal(differenz(90, 270), 180);
});

test('drehung in gegebener Richtung', () => {
  assert.equal(drehung(90, 120, 'rechts'), 30);
  assert.equal(drehung(90, 120, 'links'), 330);
  assert.equal(drehung(350, 10, 'rechts'), 20);
});

test('istGanzzahl', () => {
  assert.equal(istGanzzahl(90), true);
  assert.equal(istGanzzahl(22.5), false);
});

test('kursText ist dreistellig', () => {
  assert.equal(kursText(5), '005');
  assert.equal(kursText(90), '090');
  assert.equal(kursText(360), '000');
});

test('Himmelsrichtungen in beiden Schreibweisen', () => {
  assert.equal(HIMMELSRICHTUNGEN.deutsch.length, 16);
  assert.equal(HIMMELSRICHTUNGEN.englisch.length, 16);
  assert.equal(himmelsrichtungGrad(9), 202.5);
  assert.equal(himmelsrichtungName(9, 'deutsch'), 'SSW');
  assert.equal(himmelsrichtungName(4, 'deutsch'), 'O');
  assert.equal(himmelsrichtungName(4, 'englisch'), 'E');
  assert.equal(himmelsrichtungName(1, 'deutsch'), 'NNO');
  assert.equal(himmelsrichtungName(1, 'englisch'), 'NNE');
  assert.equal(SCHREIBWEISE.textteil, 'deutsch');
  assert.equal(SCHREIBWEISE.zeichnung, 'englisch');
});
```

- [ ] **Schritt 2: Prüfung laufen lassen, sie muss fehlschlagen**

Befehl: `node --test test/kurs.test.js`
Erwartung: Fehler `Cannot find module '.../js/kurs.js'`

- [ ] **Schritt 3: Modul schreiben**

`js/kurs.js`:

```js
// Gradrechnung und Himmelsrichtungen. Kurse sind Zahlen in Grad, 0 bis 359,
// bei Himmelsrichtungen auch halbe Grade (22,5). Norden ist 0, rechts herum.

export const HIMMELSRICHTUNGEN = {
  deutsch: ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
  englisch: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
};

// Welche Schreibweise wo gilt. Für eine spätere zufällige Mischung nur hier ändern.
export const SCHREIBWEISE = { textteil: 'deutsch', zeichnung: 'englisch' };

export function normieren(grad) {
  return ((grad % 360) + 360) % 360;
}

export function gegenkurs(grad) {
  return normieren(grad + 180);
}

// Kürzeste Differenz von "von" nach "nach" in (-180, 180], rechts positiv
export function differenz(von, nach) {
  const d = normieren(nach - von);
  return d > 180 ? d - 360 : d;
}

// Drehwinkel in der gegebenen Richtung ('rechts' oder 'links') in [0, 360)
export function drehung(von, nach, richtung) {
  return richtung === 'rechts' ? normieren(nach - von) : normieren(von - nach);
}

export function istGanzzahl(grad) {
  return Number.isInteger(grad);
}

// Dreistellig mit führenden Nullen, wie in der Luftfahrt üblich
export function kursText(grad) {
  return String(Math.round(normieren(grad))).padStart(3, '0');
}

export function himmelsrichtungGrad(index) {
  return index * 22.5;
}

export function himmelsrichtungName(index, schreibweise) {
  return HIMMELSRICHTUNGEN[schreibweise][index];
}
```

- [ ] **Schritt 4: Prüfung laufen lassen, sie muss bestehen**

Befehl: `node --test test/kurs.test.js`
Erwartung: `# pass 7`, `# fail 0`

- [ ] **Schritt 5: Commit**

```bash
git add js/kurs.js test/kurs.test.js
git commit -m "Kursrechnung und Himmelsrichtungen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Aufgabe 3: Textteil

**Dateien:**
- Erstellen: `js/textteil.js`
- Prüfung: `test/textteil.test.js`

**Schnittstellen:**
- Nutzt: `Zufall` aus Aufgabe 1; `normieren, gegenkurs, differenz, kursText, istGanzzahl, himmelsrichtungGrad, himmelsrichtungName, SCHREIBWEISE` aus Aufgabe 2.
- Liefert: `erzeugeTextteil(zufall)` gibt `{ ausgangskurs: 90, ausgangshoehe: 2000, profile: string[], zeilen: [{ schablone, satz, kursVorher, hoeheVorher, kursDanach, hoeheDanach }] }` zurück. Außerdem die Konstanten `AUSGANGSKURS, AUSGANGSHOEHE, ZEILEN, HOEHE_MIN, HOEHE_MAX`.

- [ ] **Schritt 1: Fehlschlagende Prüfung schreiben**

`test/textteil.test.js`:

```js
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
```

- [ ] **Schritt 2: Prüfung laufen lassen, sie muss fehlschlagen**

Befehl: `node --test test/textteil.test.js`
Erwartung: Fehler `Cannot find module '.../js/textteil.js'`

- [ ] **Schritt 3: Modul schreiben**

`js/textteil.js`:

```js
// Textteil der Stufe 2: zwölf Anweisungen aus Satzschablonen.
// Die Erzeugung führt den Flugzustand (Kurs, Höhe) mit, damit Gegenkurs,
// schnellster Weg und Höhenangaben immer zum vorherigen Satz passen.

import {
  normieren, gegenkurs, differenz, kursText, istGanzzahl,
  himmelsrichtungGrad, himmelsrichtungName, SCHREIBWEISE,
} from './kurs.js';

export const AUSGANGSKURS = 90;
export const AUSGANGSHOEHE = 2000;
export const ZEILEN = 12;
export const HOEHE_MIN = 1000;
export const HOEHE_MAX = 3000;

const STEIGRATE = 8; // ft je Sekunde, entspricht rund 500 ft/min
const ZEITEN = [10, 15, 20];
const KREISHAELFTE = 60; // Sekunden je 180° bei Standardkurve
const PROFILE = ['horizontal', 'steigen', 'sinken'];
const PROFILWORT = { horizontal: 'Horizontalflug', steigen: 'Steigflug', sinken: 'Sinkflug' };
const KREISWORT = { horizontal: 'horizontal', steigen: 'Steigflug', sinken: 'Sinkflug' };
const KURVE = { links: 'Linkskurve', rechts: 'Rechtskurve' };
const SEITE = { links: 'Links', rechts: 'Rechts' };
const RICHTUNGEN = ['links', 'rechts'];

// Diese drei kommen höchstens einmal je Blatt vor, die übrigen füllen den Rest.
const BESONDERE = ['vollkreis', 'halbkreis', 'hoehe'];
const GEWOEHNLICHE = ['absolut', 'relativ', 'himmelsrichtung', 'gradkurs', 'schnellster', 'gegenkurs'];

function abstand(von, nach) {
  return Math.abs(differenz(von, nach));
}

// Ganzzahliger Kurs, dessen kürzester Abstand zum Ausgangskurs im Bereich liegt
function zielGrad(k, min, max, ausgangskurs = k.zustand.kurs) {
  for (;;) {
    const kurs = k.zufall.ganzzahl(0, 359);
    const a = abstand(ausgangskurs, kurs);
    if (a >= min && a <= max) return kurs;
  }
}

// Index einer Himmelsrichtung, deren Kurs weit genug vom aktuellen entfernt liegt
function zielHimmelsrichtung(k, min, max) {
  for (;;) {
    const index = k.zufall.ganzzahl(0, 15);
    const a = abstand(k.zustand.kurs, himmelsrichtungGrad(index));
    if (a >= min && a <= max) return index;
  }
}

function richtungsname(index) {
  return himmelsrichtungName(index, SCHREIBWEISE.textteil);
}

// Wählt ein Profil, das die Höhe im Rahmen hält und nicht viermal hintereinander
// gleich ist, gleicht die Bilanz aus und schreibt Höhe und Verlauf fort.
function profilAnwenden(k, sekunden, erlaubteProfile = PROFILE) {
  const letzte = k.profile.slice(-3);
  const erlaubt = erlaubteProfile.filter((p) => {
    if (letzte.length === 3 && letzte.every((v) => v === p)) return false;
    if (p === 'steigen') return k.zustand.hoehe + STEIGRATE * sekunden <= HOEHE_MAX;
    if (p === 'sinken') return k.zustand.hoehe - STEIGRATE * sekunden >= HOEHE_MIN;
    return true;
  });
  const profil = k.zufall.gewichteteAuswahl(erlaubt.map((p) => ({ wert: p, gewicht: Math.max(1, 5 - k.bilanz[p]) })));
  if (profil === 'steigen') k.zustand.hoehe += STEIGRATE * sekunden;
  if (profil === 'sinken') k.zustand.hoehe -= STEIGRATE * sekunden;
  k.profile.push(profil);
  k.bilanz[profil] += 1;
  return profil;
}

function horizontalAnwenden(k) {
  k.profile.push('horizontal');
  k.bilanz.horizontal += 1;
}

// Richtungen, in die eine Höhenänderung von mindestens 200 ft möglich ist,
// ohne die Grenzen zu verlassen und ohne viermal dasselbe Profil
function hoehenRichtungen(k) {
  const letzte = k.profile.slice(-3);
  return ['steigen', 'sinken'].filter((p) => {
    if (letzte.length === 3 && letzte.every((v) => v === p)) return false;
    const spielraum = p === 'steigen' ? HOEHE_MAX - k.zustand.hoehe : k.zustand.hoehe - HOEHE_MIN;
    return spielraum >= 200;
  });
}

const SCHABLONEN = {
  absolut: {
    anwendbar: () => true,
    erzeugen(k) {
      const kurs = zielGrad(k, 20, 180);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = kurs;
      return `Auf Kurs ${kursText(kurs)} drehen, ${PROFILWORT[profil]} ${sekunden} s.`;
    },
  },
  relativ: {
    // Nur bei ganzzahligem Kurs, sonst entstünden halbe Grade im Ergebnis
    anwendbar: (k) => istGanzzahl(k.zustand.kurs),
    erzeugen(k) {
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const winkel = k.zufall.ganzzahl(20, 160);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = normieren(k.zustand.kurs + (richtung === 'rechts' ? winkel : -winkel));
      return `${KURVE[richtung]} um ${winkel}°, neuer Kurs ${sekunden} s ${PROFILWORT[profil]}.`;
    },
  },
  himmelsrichtung: {
    anwendbar: () => true,
    erzeugen(k) {
      const index = zielHimmelsrichtung(k, 20, 180);
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = himmelsrichtungGrad(index);
      return `${KURVE[richtung]} auf ${richtungsname(index)}, ${sekunden} s ${PROFILWORT[profil]}.`;
    },
  },
  gradkurs: {
    anwendbar: () => true,
    erzeugen(k) {
      const kurs = zielGrad(k, 20, 180);
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = kurs;
      return `${SEITE[richtung]} auf ${kursText(kurs)}°, ${sekunden} s ${PROFILWORT[profil]}.`;
    },
  },
  schnellster: {
    anwendbar: () => true,
    erzeugen(k) {
      // Höchstens 160°, damit der schnellste Weg eindeutig ist
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      const wort = profil === 'horizontal' ? 'geradeaus' : PROFILWORT[profil];
      if (k.zufall.wuerfel(0.5)) {
        const index = zielHimmelsrichtung(k, 20, 160);
        k.zustand.kurs = himmelsrichtungGrad(index);
        return `Auf schnellstem Weg ${richtungsname(index)}, ${sekunden} s ${wort}.`;
      }
      const kurs = zielGrad(k, 20, 160);
      k.zustand.kurs = kurs;
      return `Auf schnellstem Weg nach ${kursText(kurs)}°, ${sekunden} s ${wort}.`;
    },
  },
  gegenkurs: {
    anwendbar: () => true,
    erzeugen(k) {
      // Genannt wird eine Himmelsrichtung, geflogen wird ihr Gegenkurs
      let index;
      for (;;) {
        index = k.zufall.ganzzahl(0, 15);
        if (abstand(k.zustand.kurs, gegenkurs(himmelsrichtungGrad(index))) >= 20) break;
      }
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const sekunden = k.zufall.auswahl(ZEITEN);
      const profil = profilAnwenden(k, sekunden);
      k.zustand.kurs = gegenkurs(himmelsrichtungGrad(index));
      return `${SEITE[richtung]} auf den Gegenkurs von ${richtungsname(index)}, ${sekunden} s ${PROFILWORT[profil]}.`;
    },
  },
  vollkreis: {
    anwendbar: () => true,
    erzeugen(k) {
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const erste = profilAnwenden(k, KREISHAELFTE);
      const zweite = profilAnwenden(k, KREISHAELFTE);
      return `Vollkreis nach ${richtung}, erste 180° ${KREISWORT[erste]}, zweite 180° ${KREISWORT[zweite]}.`;
    },
  },
  halbkreis: {
    anwendbar: () => true,
    erzeugen(k) {
      const richtung = k.zufall.auswahl(RICHTUNGEN);
      const erste = profilAnwenden(k, KREISHAELFTE / 2);
      // Das Geradeausstück danach ist horizontal. Damit daraus nicht vier gleiche
      // Profile werden, darf die zweite Hälfte nach zwei horizontalen nicht horizontal sein.
      const letzteZwei = k.profile.slice(-2);
      const erlaubt = letzteZwei.length === 2 && letzteZwei.every((p) => p === 'horizontal') ? ['steigen', 'sinken'] : PROFILE;
      const zweite = profilAnwenden(k, KREISHAELFTE / 2, erlaubt);
      const sekunden = k.zufall.auswahl(ZEITEN);
      horizontalAnwenden(k);
      k.zustand.kurs = gegenkurs(k.zustand.kurs);
      return `180°-Kurve nach ${richtung}, erst 90° ${KREISWORT[erste]}, zweite 90° ${KREISWORT[zweite]}, ${sekunden} s geradeaus.`;
    },
  },
  hoehe: {
    anwendbar: (k) => hoehenRichtungen(k).length > 0,
    erzeugen(k) {
      const profil = k.zufall.auswahl(hoehenRichtungen(k));
      const spielraum = profil === 'steigen' ? HOEHE_MAX - k.zustand.hoehe : k.zustand.hoehe - HOEHE_MIN;
      const hoechstens = Math.min(800, Math.floor(spielraum / 50) * 50);
      const gesamt = 50 * k.zufall.ganzzahl(4, hoechstens / 50); // 200 bis hoechstens
      const einleitung = 50 * k.zufall.ganzzahl(2, gesamt / 50 - 2); // 100 bis gesamt - 100
      const kurs1 = zielGrad(k, 20, 180);
      const kurs2 = zielGrad(k, 20, 180, kurs1);
      const seite = k.zufall.auswahl(RICHTUNGEN);
      const kurve = k.zufall.auswahl(RICHTUNGEN);
      k.zustand.hoehe += profil === 'steigen' ? gesamt : -gesamt;
      k.profile.push(profil);
      k.bilanz[profil] += 1;
      k.zustand.kurs = kurs2;
      return `${SEITE[seite]} auf ${kursText(kurs1)}°, ${gesamt} ft ${profil}, nach ${einleitung} ft ${KURVE[kurve]} auf ${kursText(kurs2)}° einleiten.`;
    },
  },
};

// Gewöhnliche Schablone, die anwendbar ist und nicht zum dritten Mal in Folge käme
function gewoehnlicheWaehlen(k, bisher) {
  const [vorletzte, letzte] = bisher.slice(-2);
  for (;;) {
    const schablonenName = k.zufall.auswahl(GEWOEHNLICHE);
    if (schablonenName === letzte && schablonenName === vorletzte) continue;
    if (!SCHABLONEN[schablonenName].anwendbar(k)) continue;
    return schablonenName;
  }
}

export function erzeugeTextteil(zufall) {
  const k = {
    zufall,
    zustand: { kurs: AUSGANGSKURS, hoehe: AUSGANGSHOEHE },
    profile: [],
    bilanz: { horizontal: 0, steigen: 0, sinken: 0 },
  };

  // Besondere Schablonen vorab auf freie Zeilen verteilen, jede mit 75 Prozent
  const vorgaben = new Array(ZEILEN).fill(null);
  for (const besondere of BESONDERE) {
    if (!zufall.wuerfel(0.75)) continue;
    const freie = vorgaben.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
    vorgaben[zufall.auswahl(freie)] = besondere;
  }

  const zeilen = [];
  const namen = [];
  for (let i = 0; i < ZEILEN; i++) {
    let schablonenName = vorgaben[i];
    if (schablonenName === null || !SCHABLONEN[schablonenName].anwendbar(k)) {
      schablonenName = gewoehnlicheWaehlen(k, namen);
    }
    const kursVorher = k.zustand.kurs;
    const hoeheVorher = k.zustand.hoehe;
    const satz = SCHABLONEN[schablonenName].erzeugen(k);
    namen.push(schablonenName);
    zeilen.push({
      schablone: schablonenName,
      satz,
      kursVorher,
      hoeheVorher,
      kursDanach: k.zustand.kurs,
      hoeheDanach: k.zustand.hoehe,
    });
  }

  return { ausgangskurs: AUSGANGSKURS, ausgangshoehe: AUSGANGSHOEHE, profile: k.profile, zeilen };
}
```

- [ ] **Schritt 4: Prüfung laufen lassen, sie muss bestehen**

Befehl: `node --test test/textteil.test.js`
Erwartung: `# pass 11`, `# fail 0`

Falls "alle neun Schablonen kommen vor" fehlschlägt: prüfen, ob `hoehe` nie anwendbar ist (dann `hoehenRichtungen` ansehen). Falls "kein Profil öfter als dreimal" fehlschlägt: den Verlauf in der Meldung lesen und die Stelle finden, an der ein Profil ohne `profilAnwenden` angehängt wurde.

- [ ] **Schritt 5: Zwei Blätter ansehen**

Befehl:

```bash
node -e "
import('./js/zufall.js').then(async ({ Zufall }) => {
  const { erzeugeTextteil } = await import('./js/textteil.js');
  for (const n of [1, 2]) {
    console.log('Blatt', n);
    for (const z of erzeugeTextteil(new Zufall('stufe-2/blatt-' + n)).zeilen) console.log(' ', z.satz);
  }
});
"
```

Erwartung: zweimal zwölf lesbare Sätze im Stil der Vorlage. Auffällige Sätze notieren, nicht ändern; die Wortwahl wird mit Willi abgestimmt.

- [ ] **Schritt 6: Commit**

```bash
git add js/textteil.js test/textteil.test.js
git commit -m "Textteil der Stufe 2 aus Satzschablonen mit Flugzustand

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Aufgabe 4: Parcours, Bausteine

**Dateien:**
- Erstellen: `js/parcours.js` (erster Teil, wird in Aufgabe 5 erweitert)
- Prüfung: `test/parcours.test.js` (erster Teil)

**Schnittstellen:**
- Nutzt: `Zufall`; `normieren, differenz, himmelsrichtungGrad` aus `kurs.js`.
- Liefert: `erzeugeElemente(zufall)` gibt eine Liste aus Segmenten `{ art: 'segment', kurs, anzeige: 'grad'|'himmelsrichtung'|'keine', himmelsrichtung: index|null, relativ: number|null, dauer, profil, rechenaufgabe: number|null }` und Vollkreisen `{ art: 'vollkreis', richtung: 'links'|'rechts', profile: [p1, p2] }` zurück. Konstanten `SEKUNDE_LAENGE, ECKENRADIUS, KREISRADIUS, KANDIDATEN, SEITENVERHAELTNIS`.

- [ ] **Schritt 1: Fehlschlagende Prüfung schreiben**

`test/parcours.test.js`:

```js
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
```

- [ ] **Schritt 2: Prüfung laufen lassen, sie muss fehlschlagen**

Befehl: `node --test test/parcours.test.js`
Erwartung: Fehler `Cannot find module '.../js/parcours.js'`

- [ ] **Schritt 3: Modul schreiben, erster Teil**

`js/parcours.js`:

```js
// Parcours der Stufe 2: Bausteine, Geometrie und Kandidatensuche.
// Ein Parcours ist eine Kette aus Segmenten und Vollkreisen. Zwischen zwei
// Segmenten liegt eine Ecke: kürzester Weg, wenn das nächste Segment einen Kurs
// trägt, sonst eine relative Kursänderung, die an der Ecke beschriftet wird.

import { normieren, differenz, drehung, kursText, himmelsrichtungGrad, himmelsrichtungName, SCHREIBWEISE } from './kurs.js';

export const SEKUNDE_LAENGE = 3;
export const ECKENRADIUS = 12;
export const KREISRADIUS = 35;
export const KANDIDATEN = 200;
export const SEITENVERHAELTNIS = { min: 0.6, max: 1.2 };

const BESCHRIFTUNGSABSTAND = 11;
const PROFILE = ['horizontal', 'steigen', 'sinken'];

function abstand(von, nach) {
  return Math.abs(differenz(von, nach));
}

function imBereich(a) {
  return a >= 20 && a <= 160;
}

function bereich(von, bis) {
  return Array.from({ length: bis - von + 1 }, (_, i) => von + i);
}

function verschiedeneIndizes(zufall, anzahl, kandidaten) {
  return zufall.mischen(kandidaten).slice(0, anzahl);
}

// Profil, das nicht viermal hintereinander gleich ist, mit Ausgleich der Bilanz
function profilWaehlen(zufall, verlauf, bilanz) {
  const letzte = verlauf.slice(-3);
  const erlaubt = PROFILE.filter((p) => !(letzte.length === 3 && letzte.every((v) => v === p)));
  const profil = zufall.gewichteteAuswahl(erlaubt.map((p) => ({ wert: p, gewicht: Math.max(1, 8 - bilanz[p]) })));
  verlauf.push(profil);
  bilanz[profil] += 1;
  return profil;
}

function dauerWaehlen(zufall) {
  return zufall.gewichteteAuswahl([
    { wert: 10, gewicht: 3 },
    { wert: 15, gewicht: 3 },
    { wert: 20, gewicht: 3 },
    { wert: 30, gewicht: 1 },
  ]);
}

export function erzeugeElemente(zufall) {
  const anzahl = zufall.ganzzahl(18, 22);

  // Vollkreise folgen auf Segment a und b, mit mindestens zwei Segmenten davor,
  // einem dazwischen und einem danach
  const kreisNach = [zufall.ganzzahl(1, anzahl - 4)];
  kreisNach.push(zufall.ganzzahl(kreisNach[0] + 2, anzahl - 2));

  const relativeIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(3, 4), bereich(1, anzahl - 1)));
  const mitKurs = bereich(0, anzahl - 1).filter((i) => !relativeIndizes.has(i));
  const himmelsIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(3, 4), mitKurs));
  const rechenIndizes = new Set(verschiedeneIndizes(zufall, zufall.ganzzahl(4, 5), mitKurs));

  const verlauf = [];
  const bilanz = { horizontal: 0, steigen: 0, sinken: 0 };
  const elemente = [];
  let kurs = null;

  for (let i = 0; i < anzahl; i++) {
    const segment = { art: 'segment', kurs: null, anzeige: 'grad', himmelsrichtung: null, relativ: null, rechenaufgabe: null };
    if (relativeIndizes.has(i)) {
      let winkel;
      do { winkel = zufall.ganzzahl(20, 340); } while (winkel === 180);
      segment.anzeige = 'keine';
      segment.relativ = zufall.auswahl([1, -1]) * winkel;
      segment.kurs = normieren(kurs + segment.relativ);
    } else if (himmelsIndizes.has(i)) {
      let index;
      do { index = zufall.ganzzahl(0, 15); } while (kurs !== null && !imBereich(abstand(kurs, himmelsrichtungGrad(index))));
      segment.anzeige = 'himmelsrichtung';
      segment.himmelsrichtung = index;
      segment.kurs = himmelsrichtungGrad(index);
    } else {
      let grad;
      do { grad = zufall.ganzzahl(0, 359); } while (kurs !== null && !imBereich(abstand(kurs, grad)));
      segment.kurs = grad;
    }
    if (rechenIndizes.has(i)) segment.rechenaufgabe = zufall.auswahl([1, -1]) * zufall.ganzzahl(100, 350);
    segment.dauer = dauerWaehlen(zufall);
    segment.profil = profilWaehlen(zufall, verlauf, bilanz);
    elemente.push(segment);
    kurs = segment.kurs;

    if (kreisNach.includes(i)) {
      const erste = profilWaehlen(zufall, verlauf, bilanz);
      const zweite = profilWaehlen(zufall, verlauf, bilanz);
      elemente.push({ art: 'vollkreis', richtung: null, profile: [erste, zweite] });
    }
  }

  // Drehrichtung der Vollkreise entgegen der folgenden Ecke, damit die Schleife
  // nicht vom nächsten Segment durchschnitten wird
  for (let i = 0; i < elemente.length; i++) {
    if (elemente[i].art !== 'vollkreis') continue;
    const vorher = elemente[i - 1];
    const nachher = elemente[i + 1];
    const eckeRechts = nachher.relativ !== null ? nachher.relativ > 0 : differenz(vorher.kurs, nachher.kurs) > 0;
    elemente[i].richtung = eckeRechts ? 'links' : 'rechts';
  }

  return elemente;
}
```

Hinweis: `drehung, kursText, himmelsrichtungName, SCHREIBWEISE` und `BESCHRIFTUNGSABSTAND` werden erst in Aufgabe 5 gebraucht, bleiben aber schon importiert, damit Aufgabe 5 nur anhängt.

- [ ] **Schritt 4: Prüfung laufen lassen, sie muss bestehen**

Befehl: `node --test test/parcours.test.js`
Erwartung: `# pass 8`, `# fail 0`

Falls "kein Profil öfter als dreimal" mit fehlendem Profil fehlschlägt: Bei 18 Segmenten plus 4 Kreishälften und Ausgleichsgewichten kommt jedes Profil vor. Sonst Gewicht `8 - bilanz` prüfen.

- [ ] **Schritt 5: Commit**

```bash
git add js/parcours.js test/parcours.test.js
git commit -m "Parcours der Stufe 2: Bausteine und Mengenregeln

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Aufgabe 5: Parcours, Geometrie, Kreuzungen, Kandidatensuche

**Dateien:**
- Ändern: `js/parcours.js` (anhängen)
- Prüfung: `test/parcours.test.js` (anhängen)

**Schnittstellen:**
- Liefert: `geometrie(elemente)` gibt `{ stuecke: [{ art: 'strecke'|'bogen', profil, pfad, punkte: [{x,y}] }], marken: [{ punkt, kurs }], beschriftungen: [{ zeilen: string[], x, y, winkel }], umriss: { minX, minY, maxX, maxY } }` zurück. `zaehleKreuzungen(stuecke, grenze?)` gibt die Zahl echter Kreuzungen nicht benachbarter Stücke zurück. `seitenverhaeltnisPasst(umriss)`. `erzeugeParcours(zufall)` gibt `{ elemente, geometrie, kreuzungen, kandidat }` zurück.
- Koordinaten: Norden ist −y, Osten +x, wie im SVG. Kurs 0 zeigt nach oben.

- [ ] **Schritt 1: Fehlschlagende Prüfung anhängen**

An `test/parcours.test.js` anhängen (die Importzeile oben um `geometrie, zaehleKreuzungen, erzeugeParcours, seitenverhaeltnisPasst, SEKUNDE_LAENGE` erweitern):

```js
import { geometrie, zaehleKreuzungen, erzeugeParcours, seitenverhaeltnisPasst, SEKUNDE_LAENGE } from '../js/parcours.js';

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
  assert.ok(a.kandidat >= 1 && a.kandidat <= 200);
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
```

- [ ] **Schritt 2: Prüfung laufen lassen, sie muss fehlschlagen**

Befehl: `node --test test/parcours.test.js`
Erwartung: Fehler, weil `geometrie` kein Export ist (`does not provide an export named 'geometrie'`)

- [ ] **Schritt 3: Geometrie, Kreuzungen und Kandidatensuche anhängen**

An `js/parcours.js` anhängen:

```js
// Richtungsvektor eines Kurses im Bildschirmkoordinatensystem (Norden ist -y)
function vektor(kurs) {
  const r = (kurs * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
}

// Rechte Normale zum Kurs
function rechts(kurs) {
  return vektor(kurs + 90);
}

// Zwei Nachkommastellen, ohne nachlaufende Nullen, damit der Pfad kurz bleibt
function punktText(punkt) {
  return `${Number(punkt.x.toFixed(2))} ${Number(punkt.y.toFixed(2))}`;
}

// Kreisbogen ab "start" mit Anfangskurs "kursVon" um "winkel" Grad in "richtung".
// Liefert SVG-Pfad, Polygonzug für die Kreuzungsprüfung, Endpunkt, Endkurs und
// einen Punkt außen an der Bogenmitte für die Beschriftung.
function bogen(start, kursVon, winkel, richtung, radius) {
  const s = richtung === 'rechts' ? 1 : -1;
  const n0 = rechts(kursVon);
  const zentrum = { x: start.x + s * radius * n0.x, y: start.y + s * radius * n0.y };
  const punktBei = (kurs, r = radius) => {
    const n = rechts(kurs);
    return { x: zentrum.x - s * r * n.x, y: zentrum.y - s * r * n.y };
  };
  const kursNach = normieren(kursVon + s * winkel);
  const ende = punktBei(kursNach);
  const schritte = Math.max(2, Math.ceil(winkel / 10));
  const punkte = [];
  for (let i = 0; i <= schritte; i++) punkte.push(punktBei(kursVon + (s * winkel * i) / schritte));
  punkte[0] = start;
  const aussen = punktBei(kursVon + (s * winkel) / 2, radius + BESCHRIFTUNGSABSTAND);
  const pfad = `M ${punktText(start)} A ${radius} ${radius} 0 ${winkel > 180 ? 1 : 0} ${s === 1 ? 1 : 0} ${punktText(ende)}`;
  return { pfad, punkte, ende, kursNach, aussen };
}

function strecke(start, kurs, laenge) {
  const v = vektor(kurs);
  const ende = { x: start.x + v.x * laenge, y: start.y + v.y * laenge };
  const mitte = { x: (start.x + ende.x) / 2, y: (start.y + ende.y) / 2 };
  return { pfad: `M ${punktText(start)} L ${punktText(ende)}`, punkte: [start, ende], ende, mitte };
}

function vorzeichenText(zahl) {
  return zahl > 0 ? `+${zahl}` : `${zahl}`;
}

function kursBeschriftung(element) {
  const dauer = `/${element.dauer}"`;
  if (element.anzeige === 'keine') return dauer;
  if (element.anzeige === 'himmelsrichtung') return `${himmelsrichtungName(element.himmelsrichtung, SCHREIBWEISE.zeichnung)}${dauer}`;
  return `${kursText(element.kurs)}°${dauer}`;
}

// Beschriftung parallel zum Segment, links versetzt, nie auf dem Kopf
function segmentBeschriftung(element, mitte) {
  const links = rechts(element.kurs + 180);
  let winkel = normieren(element.kurs - 90);
  if (winkel > 180) winkel -= 360;
  if (winkel > 90) winkel -= 180;
  if (winkel < -90) winkel += 180;
  const zeilen = [kursBeschriftung(element)];
  if (element.rechenaufgabe !== null) zeilen.push(vorzeichenText(element.rechenaufgabe));
  return {
    zeilen,
    x: mitte.x + links.x * BESCHRIFTUNGSABSTAND,
    y: mitte.y + links.y * BESCHRIFTUNGSABSTAND,
    winkel,
  };
}

function umrissBerechnen(stuecke, beschriftungen) {
  const xs = [];
  const ys = [];
  for (const s of stuecke) for (const q of s.punkte) { xs.push(q.x); ys.push(q.y); }
  for (const b of beschriftungen) { xs.push(b.x - 22, b.x + 22); ys.push(b.y - 10, b.y + 10); }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function geometrie(elemente) {
  const stuecke = [];
  const marken = [];
  const beschriftungen = [];
  let punkt = { x: 0, y: 0 };
  let kurs = null;

  for (const element of elemente) {
    if (element.art === 'vollkreis') {
      const erste = bogen(punkt, kurs, 180, element.richtung, KREISRADIUS);
      const zweite = bogen(erste.ende, erste.kursNach, 180, element.richtung, KREISRADIUS);
      // Der Kreis schließt sich exakt am Ausgangspunkt, damit die Kreuzungsprüfung
      // Berührungen an diesem Punkt als solche erkennt
      zweite.punkte[zweite.punkte.length - 1] = punkt;
      stuecke.push({ art: 'bogen', profil: element.profile[0], pfad: erste.pfad, punkte: erste.punkte });
      stuecke.push({ art: 'bogen', profil: element.profile[1], pfad: zweite.pfad, punkte: zweite.punkte });
      marken.push({ punkt: erste.ende, kurs: erste.kursNach });
      continue;
    }

    if (kurs !== null) {
      const richtung = element.relativ !== null
        ? (element.relativ > 0 ? 'rechts' : 'links')
        : (differenz(kurs, element.kurs) >= 0 ? 'rechts' : 'links');
      const winkel = element.relativ !== null ? Math.abs(element.relativ) : drehung(kurs, element.kurs, richtung);
      const ecke = bogen(punkt, kurs, winkel, richtung, ECKENRADIUS);
      stuecke.push({ art: 'bogen', profil: element.profil, pfad: ecke.pfad, punkte: ecke.punkte });
      if (element.relativ !== null) {
        beschriftungen.push({ zeilen: [`${vorzeichenText(element.relativ)}°`], x: ecke.aussen.x, y: ecke.aussen.y, winkel: 0 });
      }
      punkt = ecke.ende;
    }

    marken.push({ punkt, kurs: element.kurs });
    const gerade = strecke(punkt, element.kurs, element.dauer * SEKUNDE_LAENGE);
    stuecke.push({ art: 'strecke', profil: element.profil, pfad: gerade.pfad, punkte: gerade.punkte });
    beschriftungen.push(segmentBeschriftung(element, gerade.mitte));
    punkt = gerade.ende;
    kurs = element.kurs;
  }

  marken.push({ punkt, kurs });
  return { stuecke, marken, beschriftungen, umriss: umrissBerechnen(stuecke, beschriftungen) };
}

function kreuzprodukt(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

// Echte Kreuzung zweier Strecken. Berührungen an Endpunkten und kollineare
// Überlappungen zählen nicht, deshalb strenge Vorzeichenprüfung.
function schneidenSich(a1, a2, b1, b2) {
  const d1 = kreuzprodukt(b2.x - b1.x, b2.y - b1.y, a1.x - b1.x, a1.y - b1.y);
  const d2 = kreuzprodukt(b2.x - b1.x, b2.y - b1.y, a2.x - b1.x, a2.y - b1.y);
  const d3 = kreuzprodukt(a2.x - a1.x, a2.y - a1.y, b1.x - a1.x, b1.y - a1.y);
  const d4 = kreuzprodukt(a2.x - a1.x, a2.y - a1.y, b2.x - a1.x, b2.y - a1.y);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// Kreuzungen zwischen nicht benachbarten Stücken. Bricht ab, sobald die Zahl
// über "grenze" liegt, damit die Kandidatensuche nicht unnötig zählt.
export function zaehleKreuzungen(stuecke, grenze = Infinity) {
  let anzahl = 0;
  for (let i = 0; i < stuecke.length; i++) {
    for (let j = i + 2; j < stuecke.length; j++) {
      const a = stuecke[i].punkte;
      const b = stuecke[j].punkte;
      for (let m = 0; m + 1 < a.length; m++) {
        for (let n = 0; n + 1 < b.length; n++) {
          if (schneidenSich(a[m], a[m + 1], b[n], b[n + 1])) {
            anzahl += 1;
            if (anzahl > grenze) return anzahl;
          }
        }
      }
    }
  }
  return anzahl;
}

export function seitenverhaeltnisPasst(umriss) {
  const verhaeltnis = (umriss.maxX - umriss.minX) / (umriss.maxY - umriss.minY);
  return verhaeltnis >= SEITENVERHAELTNIS.min && verhaeltnis <= SEITENVERHAELTNIS.max;
}

// Zieht bis zu KANDIDATEN Parcours aus dem Zufallsstrom und nimmt den ersten,
// der kreuzungsfrei ist und ins Hochformat passt. Sonst den besten.
export function erzeugeParcours(zufall) {
  let bester = null;
  for (let kandidat = 1; kandidat <= KANDIDATEN; kandidat++) {
    const elemente = erzeugeElemente(zufall);
    const geo = geometrie(elemente);
    const grenze = bester ? bester.kreuzungen : Infinity;
    const kreuzungen = zaehleKreuzungen(geo.stuecke, grenze);
    const passt = seitenverhaeltnisPasst(geo.umriss);
    if (kreuzungen === 0 && passt) return { elemente, geometrie: geo, kreuzungen, kandidat };
    const besser = !bester
      || kreuzungen < bester.kreuzungen
      || (kreuzungen === bester.kreuzungen && passt && !bester.passt);
    if (besser) bester = { elemente, geometrie: geo, kreuzungen, kandidat, passt };
  }
  return { elemente: bester.elemente, geometrie: bester.geometrie, kreuzungen: bester.kreuzungen, kandidat: bester.kandidat };
}
```

- [ ] **Schritt 4: Prüfung laufen lassen, sie muss bestehen**

Befehl: `node --test test/parcours.test.js`
Erwartung: `# pass 18`, `# fail 0`

Falls "findet meist einen kreuzungsfreien Kandidaten" fehlschlägt: zuerst `KANDIDATEN` auf 400 setzen und erneut laufen lassen. Hilft das nicht, liegt es an der Geometrie (etwa ein Vorzeichenfehler in `bogen`), nicht an der Suche. Dann die Ecken-Prüfungen oben genau lesen. Nie die Prüfschwelle senken, ohne Willi zu fragen.

Falls "Vollkreis: Rückkehr zum Ausgangspunkt" fehlschlägt: `zweite.punkte[...] = punkt` prüft die exakte Gleichheit, der SVG-Pfad darf abweichen.

- [ ] **Schritt 5: Laufzeit messen**

Befehl:

```bash
node -e "
import('./js/zufall.js').then(async ({ Zufall }) => {
  const { erzeugeParcours } = await import('./js/parcours.js');
  const start = Date.now();
  let kandidaten = 0;
  for (let n = 1; n <= 20; n++) kandidaten += erzeugeParcours(new Zufall('stufe-2/blatt-' + n)).kandidat;
  console.log('20 Blätter in', Date.now() - start, 'ms, Kandidaten im Mittel', kandidaten / 20);
});
"
```

Erwartung: unter 3000 ms für 20 Blätter. Liegt es darüber, den Wert notieren und weitermachen, das Blatt wird trotzdem in unter einer Sekunde erzeugt.

- [ ] **Schritt 6: Commit**

```bash
git add js/parcours.js test/parcours.test.js
git commit -m "Parcours der Stufe 2: Geometrie, Kreuzungsprüfung, Kandidatensuche

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Aufgabe 6: Zeichnung als SVG

**Dateien:**
- Erstellen: `js/zeichnung.js`
- Prüfung: `test/zeichnung.test.js`

**Schnittstellen:**
- Nutzt: das Ergebnis von `erzeugeParcours` (Aufgabe 5), genauer `parcours.geometrie` mit `stuecke, marken, beschriftungen, umriss`.
- Liefert: `zeichneParcours(parcours): string`, ein vollständiges `<svg>` mit eingebetteten Stilen, und die Konstante `RAND`.

- [ ] **Schritt 1: Fehlschlagende Prüfung schreiben**

`test/zeichnung.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall } from '../js/zufall.js';
import { erzeugeParcours } from '../js/parcours.js';
import { zeichneParcours, RAND } from '../js/zeichnung.js';

const parcours = erzeugeParcours(new Zufall('stufe-2/blatt-1'));
const svg = zeichneParcours(parcours);

function anzahl(text, muster) {
  return (text.match(muster) || []).length;
}

test('vollständiges SVG mit viewBox, das den Umriss samt Rand umschließt', () => {
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  const m = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  assert.ok(m, 'viewBox fehlt');
  const [x, y, b, h] = m.slice(1).map(Number);
  const u = parcours.geometrie.umriss;
  assert.ok(x <= u.minX - RAND + 0.01 && y <= u.minY - RAND + 0.01);
  assert.ok(x + b >= u.maxX + RAND - 0.01 && y + h >= u.maxY + RAND - 0.01);
});

test('je Stück ein Pfad, Sinken und Steigen mit weißer Linie über schwarzem Rand', () => {
  const { stuecke } = parcours.geometrie;
  const horizontal = stuecke.filter((s) => s.profil === 'horizontal').length;
  const sinken = stuecke.filter((s) => s.profil === 'sinken').length;
  const steigen = stuecke.filter((s) => s.profil === 'steigen').length;
  assert.equal(anzahl(svg, /class="horizontal"/g), horizontal);
  assert.equal(anzahl(svg, /class="rand"/g), sinken + steigen);
  assert.equal(anzahl(svg, /class="sinken"/g), sinken);
  assert.equal(anzahl(svg, /class="steigen"/g), steigen);
  assert.ok(svg.includes('stroke-dasharray'), 'Sprossen fehlen');
});

test('Marken und Beschriftungen sind vollständig', () => {
  assert.equal(anzahl(svg, /class="marke"/g), parcours.geometrie.marken.length);
  assert.equal(anzahl(svg, /<text /g), parcours.geometrie.beschriftungen.length);
  for (const b of parcours.geometrie.beschriftungen) {
    for (const zeile of b.zeilen) assert.ok(svg.includes(`>${zeile}</tspan>`), `Beschriftung ${zeile} fehlt`);
  }
});

test('Zahlen ohne überflüssige Nullen, keine wissenschaftliche Schreibweise', () => {
  assert.ok(!/\d\.\d*0"/.test(svg), 'nachlaufende Nullen');
  assert.ok(!/e[-+]\d/.test(svg), 'wissenschaftliche Schreibweise');
});
```

- [ ] **Schritt 2: Prüfung laufen lassen, sie muss fehlschlagen**

Befehl: `node --test test/zeichnung.test.js`
Erwartung: Fehler `Cannot find module '.../js/zeichnung.js'`

- [ ] **Schritt 3: Modul schreiben**

`js/zeichnung.js`:

```js
// Zeichnet einen Parcours als SVG-Zeichenkette. Stile liegen im SVG selbst,
// damit das Bild auch außerhalb der App (Druck, Bildschirmfoto) gleich aussieht.
//
// Linienarten: horizontal = dicke schwarze Linie; sinken = schwarzer Rand mit
// weißer Linie darüber; steigen = dasselbe, die weiße Linie gestrichelt, so dass
// die Lücken als Sprossen erscheinen.

export const RAND = 30;

const LINIENBREITE = 9;
const WEISSBREITE = 6;
const MARKENLAENGE = 9;
const ZEILENABSTAND = 9;

function zahl(wert) {
  return Number(wert.toFixed(2)).toString();
}

function stueck(s) {
  if (s.profil === 'horizontal') return `<path class="horizontal" d="${s.pfad}"/>`;
  return `<path class="rand" d="${s.pfad}"/><path class="${s.profil}" d="${s.pfad}"/>`;
}

// Kurzer Strich quer zum Kurs am Übergang zwischen zwei Elementen
function marke(m) {
  const r = (m.kurs * Math.PI) / 180;
  const nx = Math.cos(r) * MARKENLAENGE;
  const ny = Math.sin(r) * MARKENLAENGE;
  return `<line class="marke" x1="${zahl(m.punkt.x - nx)}" y1="${zahl(m.punkt.y - ny)}" x2="${zahl(m.punkt.x + nx)}" y2="${zahl(m.punkt.y + ny)}"/>`;
}

function beschriftung(b) {
  const zeilen = b.zeilen
    .map((text, i) => `<tspan x="0" dy="${i === 0 ? 0 : ZEILENABSTAND}">${text}</tspan>`)
    .join('');
  return `<text transform="translate(${zahl(b.x)} ${zahl(b.y)}) rotate(${zahl(b.winkel)})">${zeilen}</text>`;
}

export function zeichneParcours(parcours) {
  const { stuecke, marken, beschriftungen, umriss } = parcours.geometrie;
  const x = umriss.minX - RAND;
  const y = umriss.minY - RAND;
  const breite = umriss.maxX - umriss.minX + 2 * RAND;
  const hoehe = umriss.maxY - umriss.minY + 2 * RAND;
  const teile = [
    ...stuecke.map(stueck),
    ...marken.map(marke),
    ...beschriftungen.map(beschriftung),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" class="parcours" viewBox="${zahl(x)} ${zahl(y)} ${zahl(breite)} ${zahl(hoehe)}" role="img" aria-label="Parcours">
<style>
.horizontal, .rand { fill: none; stroke: #000; stroke-width: ${LINIENBREITE}; }
.sinken, .steigen { fill: none; stroke: #fff; stroke-width: ${WEISSBREITE}; }
.steigen { stroke-dasharray: 5 2.5; }
.marke { stroke: #000; stroke-width: 1.2; }
text { font: 8px system-ui, -apple-system, sans-serif; text-anchor: middle; dominant-baseline: middle; }
</style>
${teile.join('\n')}
</svg>`;
}
```

- [ ] **Schritt 4: Prüfung laufen lassen, sie muss bestehen**

Befehl: `node --test test/zeichnung.test.js`
Erwartung: `# pass 4`, `# fail 0`

- [ ] **Schritt 5: Ein SVG als Datei ansehen**

Befehl:

```bash
node -e "
import('./js/zufall.js').then(async ({ Zufall }) => {
  const { erzeugeParcours } = await import('./js/parcours.js');
  const { zeichneParcours } = await import('./js/zeichnung.js');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.ZIEL, zeichneParcours(erzeugeParcours(new Zufall('stufe-2/blatt-1'))));
});
" 
```

mit `ZIEL=<Scratchpad>/blatt-1.svg` in der Umgebung. Die Datei mit dem Read-Werkzeug ansehen (SVG wird als Bild gezeigt) oder mit `qlmanage -p` öffnen. Erwartung: durchgehende Linie mit drei erkennbaren Linienarten, zwei Schleifen, Beschriftungen entlang der Segmente, keine Beschriftung auf dem Kopf.

- [ ] **Schritt 6: Commit**

```bash
git add js/zeichnung.js test/zeichnung.test.js
git commit -m "Zeichnung des Parcours als SVG

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Aufgabe 7: Blatt als Ganzes, alle 100 Blätter

**Dateien:**
- Erstellen: `js/blatt.js`
- Prüfung: `test/blaetter.test.js`

**Schnittstellen:**
- Nutzt: `Zufall, blattSchluessel`, `erzeugeTextteil`, `erzeugeParcours`, `seitenverhaeltnisPasst`.
- Liefert: `erzeugeBlatt(stufe, nummer)` gibt `{ stufe, nummer, textteil, parcours }` zurück, wirft bei unbekannter Stufe oder Nummer außerhalb 1 bis `BLAETTER_JE_STUFE`. Konstanten `BLAETTER_JE_STUFE = 100`, `STUFEN = [2, 3]`.

- [ ] **Schritt 1: Fehlschlagende Prüfung schreiben**

`test/blaetter.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erzeugeBlatt, BLAETTER_JE_STUFE, STUFEN } from '../js/blatt.js';
import { seitenverhaeltnisPasst } from '../js/parcours.js';

test('Konstanten', () => {
  assert.equal(BLAETTER_JE_STUFE, 100);
  assert.deepEqual(STUFEN, [2, 3]);
});

test('unbekannte Stufe und ungültige Nummern werfen', () => {
  assert.throws(() => erzeugeBlatt(3, 1), /Stufe 3/);
  assert.throws(() => erzeugeBlatt(2, 0), /Blatt 0/);
  assert.throws(() => erzeugeBlatt(2, 101), /Blatt 101/);
  assert.throws(() => erzeugeBlatt(2, 1.5), /Blatt 1.5/);
});

test('gleiche Nummer, gleiches Blatt; verschiedene Nummern, verschiedene Blätter', () => {
  assert.deepEqual(erzeugeBlatt(2, 7), erzeugeBlatt(2, 7));
  assert.notDeepEqual(erzeugeBlatt(2, 7).textteil, erzeugeBlatt(2, 8).textteil);
});

test('alle 100 Blätter der Stufe 2 entstehen, mindestens 90 kreuzungsfrei und passend', () => {
  let frei = 0;
  let kandidatenSumme = 0;
  const start = Date.now();
  for (let nummer = 1; nummer <= BLAETTER_JE_STUFE; nummer++) {
    const blatt = erzeugeBlatt(2, nummer);
    assert.equal(blatt.stufe, 2);
    assert.equal(blatt.nummer, nummer);
    assert.equal(blatt.textteil.zeilen.length, 12);
    assert.ok(blatt.parcours.elemente.length >= 20);
    kandidatenSumme += blatt.parcours.kandidat;
    if (blatt.parcours.kreuzungen === 0 && seitenverhaeltnisPasst(blatt.parcours.geometrie.umriss)) frei += 1;
  }
  console.log(`Stufe 2: ${frei} von ${BLAETTER_JE_STUFE} Blättern kreuzungsfrei und passend, ${kandidatenSumme / BLAETTER_JE_STUFE} Kandidaten im Mittel, ${Date.now() - start} ms`);
  assert.ok(frei >= 90, `nur ${frei} kreuzungsfrei und passend`);
});
```

- [ ] **Schritt 2: Prüfung laufen lassen, sie muss fehlschlagen**

Befehl: `node --test test/blaetter.test.js`
Erwartung: Fehler `Cannot find module '.../js/blatt.js'`

- [ ] **Schritt 3: Modul schreiben**

`js/blatt.js`:

```js
// Ein Blatt ist Textteil plus Parcours aus einem Zufallsstrom je Stufe und Nummer.
// Kein DOM, damit ganze Blätter ohne Browser geprüft werden können.

import { Zufall, blattSchluessel } from './zufall.js';
import { erzeugeTextteil } from './textteil.js';
import { erzeugeParcours } from './parcours.js';

export const BLAETTER_JE_STUFE = 100;
export const STUFEN = [2, 3];

export function erzeugeBlatt(stufe, nummer) {
  if (stufe !== 2) throw new Error(`Stufe ${stufe} ist noch nicht umgesetzt`);
  if (!Number.isInteger(nummer) || nummer < 1 || nummer > BLAETTER_JE_STUFE) {
    throw new Error(`Blatt ${nummer} gibt es nicht`);
  }
  const zufall = new Zufall(blattSchluessel(stufe, nummer));
  const textteil = erzeugeTextteil(zufall);
  const parcours = erzeugeParcours(zufall);
  return { stufe, nummer, textteil, parcours };
}
```

- [ ] **Schritt 4: Alle Prüfungen laufen lassen, sie müssen bestehen**

Befehl: `node --test`
Erwartung: alle Dateien bestanden, `# fail 0`, in der Ausgabe die Zeile `Stufe 2: N von 100 Blättern kreuzungsfrei und passend` mit N ≥ 90. N notieren, er kommt in die Abschlussmeldung.

Falls N unter 90 liegt: `KANDIDATEN` in `js/parcours.js` auf 400 setzen, erneut laufen lassen, den neuen Wert notieren und in der Abschlussmeldung nennen. Nie die Schwelle senken.

- [ ] **Schritt 5: Commit**

```bash
git add js/blatt.js test/blaetter.test.js
git commit -m "Blatt aus Stufe und Nummer, Prüfung aller 100 Blätter

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Aufgabe 8: Oberfläche, Adressen, Druck, Sichtprüfung

**Dateien:**
- Erstellen: `index.html`, `style.css`, `js/app.js`
- Prüfung: Sichtprüfung headless mit Chrome, keine automatische Prüfdatei (die Erzeugung ist bereits geprüft, `app.js` enthält nur Ansichten)

**Schnittstellen:**
- Nutzt: `erzeugeBlatt, BLAETTER_JE_STUFE` aus `blatt.js`, `zeichneParcours` aus `zeichnung.js`, `kursText` aus `kurs.js`.
- Liefert: `ansichtFuer(hash): string` (HTML der Ansicht für einen Adressanker), damit die Zuordnung Adresse zu Ansicht später prüfbar bleibt.

- [ ] **Schritt 1: index.html anlegen**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AUA PIT Übungsblätter</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main id="app"></main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Schritt 2: style.css anlegen**

```css
/* Nüchtern: Systemschrift, Schwarz auf Weiß, ein Grau für die Kopfleiste.
   Das Blatt ist der Inhalt, alles andere tritt zurück. */

:root {
  color-scheme: light;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  color: #000;
  background: #f3f3f3;
}

.kopf {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #e4e4e4;
  border-bottom: 1px solid #ccc;
}

.kopf h1 {
  flex: 1;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.kopf a,
.kopf button {
  font: inherit;
  color: #000;
  background: #fff;
  border: 1px solid #000;
  border-radius: 0;
  padding: 0.4rem 0.8rem;
  text-decoration: none;
  cursor: pointer;
}

.inhalt {
  max-width: 46rem;
  margin: 0 auto;
  padding: 1rem;
}

.inhalt h2 {
  font-size: 1rem;
  margin: 1.5rem 0 0.75rem;
}

.stufen {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.stufen a {
  display: block;
  padding: 2rem 1rem;
  text-align: center;
  font-size: 1.3rem;
  color: #000;
  background: #fff;
  border: 1px solid #000;
  text-decoration: none;
}

.raster {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3.2rem, 1fr));
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.raster a {
  display: block;
  padding: 0.6rem 0;
  text-align: center;
  color: #000;
  background: #fff;
  border: 1px solid #000;
  text-decoration: none;
}

.blatt {
  background: #fff;
  padding: 1.5rem;
  border: 1px solid #ccc;
}

.blatt h2 {
  margin: 0 0 0.25rem;
  font-size: 1.2rem;
}

.ausgang {
  margin: 0 0 1rem;
}

.textteil {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.parcours {
  display: block;
  width: 100%;
  height: auto;
}

.legende {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 0.75rem;
  font-size: 0.85rem;
}

.legende svg {
  width: 2.2rem;
  height: 0.8rem;
  vertical-align: middle;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  body {
    background: #fff;
  }

  .kopf {
    display: none;
  }

  .inhalt {
    max-width: none;
    padding: 0;
  }

  .blatt {
    border: none;
    padding: 0;
  }

  .textteil {
    font-size: 10.5pt;
    line-height: 1.35;
  }

  .parcours {
    max-height: 150mm;
  }
}
```

- [ ] **Schritt 3: app.js anlegen**

`js/app.js`:

```js
// Oberfläche: Adressanker auf Ansichten abbilden, Blatt anzeigen, drucken.
// Adressen: #/  #/stufe2  #/stufe2/blatt/7  #/stufe3  #/stufe2/endlos

import { erzeugeBlatt, BLAETTER_JE_STUFE } from './blatt.js';
import { zeichneParcours } from './zeichnung.js';
import { kursText } from './kurs.js';

const LEGENDE = `<div class="legende">
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/></svg> horizontal</span>
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/><line x1="0" y1="6" x2="40" y2="6" stroke="#fff" stroke-width="6" stroke-dasharray="5 2.5"/></svg> steigen</span>
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/><line x1="0" y1="6" x2="40" y2="6" stroke="#fff" stroke-width="6"/></svg> sinken</span>
</div>`;

function kopf(titel, zurueck, aktionen = '') {
  const zurueckKnopf = zurueck ? `<a href="${zurueck}">Zurück</a>` : '';
  return `<header class="kopf">${zurueckKnopf}<h1>${titel}</h1>${aktionen}</header>`;
}

function startseite() {
  return kopf('AUA PIT Übungsblätter', null)
    + '<div class="inhalt"><nav class="stufen"><a href="#/stufe2">Stufe 2</a><a href="#/stufe3">Stufe 3</a></nav></div>';
}

function stufenseite(stufe) {
  const zahlen = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => `<li><a href="#/stufe${stufe}/blatt/${i + 1}">${i + 1}</a></li>`).join('');
  return kopf(`Stufe ${stufe}`, '#/')
    + `<div class="inhalt"><h2>Blätter</h2><ol class="raster">${zahlen}</ol></div>`;
}

function platzhalter(titel, zurueck, text) {
  return kopf(titel, zurueck) + `<div class="inhalt"><p>${text}</p></div>`;
}

function blattseite(stufe, nummer) {
  const blatt = erzeugeBlatt(stufe, nummer);
  const zeilen = blatt.textteil.zeilen.map((z) => `<li>${z.satz}</li>`).join('');
  const drucken = '<button type="button" data-aktion="drucken">Drucken</button>';
  return kopf(`Stufe ${stufe} · Blatt ${nummer}`, `#/stufe${stufe}`, drucken)
    + `<div class="inhalt"><article class="blatt">
<h2>AUA PIT Stufe ${stufe}, Blatt ${nummer}</h2>
<p class="ausgang">Ausgangskurs ${kursText(blatt.textteil.ausgangskurs)}°, ${blatt.textteil.ausgangshoehe} ft</p>
<ol class="textteil">${zeilen}</ol>
${zeichneParcours(blatt.parcours)}
${LEGENDE}
</article></div>`;
}

export function ansichtFuer(hash) {
  const teile = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (teile.length === 0) return startseite();
  const stufe = Number((teile[0].match(/^stufe(\d)$/) || [])[1]);
  if (stufe !== 2 && stufe !== 3) return platzhalter('Nicht gefunden', '#/', 'Diese Seite gibt es nicht.');
  if (stufe === 3) return platzhalter('Stufe 3', '#/', 'Stufe 3 kommt in einem späteren Abschnitt.');
  if (teile.length === 1) return stufenseite(stufe);
  if (teile[1] === 'endlos') return platzhalter(`Stufe ${stufe} · Endlos`, `#/stufe${stufe}`, 'Der Endlosmodus kommt in einem späteren Abschnitt.');
  if (teile[1] === 'blatt') {
    const nummer = Number(teile[2]);
    if (Number.isInteger(nummer) && nummer >= 1 && nummer <= BLAETTER_JE_STUFE) return blattseite(stufe, nummer);
  }
  return platzhalter('Nicht gefunden', `#/stufe${stufe}`, 'Dieses Blatt gibt es nicht.');
}

const wurzel = document.querySelector('#app');

function anzeigen() {
  wurzel.innerHTML = ansichtFuer(location.hash);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', anzeigen);
wurzel.addEventListener('click', (ereignis) => {
  if (ereignis.target.closest('[data-aktion="drucken"]')) window.print();
});
anzeigen();
```

- [ ] **Schritt 4: Örtlich starten**

Befehl (im Hintergrund, Ausgabe verwerfen):

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory "$PWD"
```

Dann prüfen: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8765/index.html`
Erwartung: `200`

- [ ] **Schritt 5: Bildschirmfotos headless**

Chrome liegt unter `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Fehlt es, mit `ls /Applications | grep -i chrom` nach Chromium oder Brave suchen und den Pfad ersetzen. Fotos ins Scratchpad-Verzeichnis, nicht ins Repository.

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for seite in "start:#/" "stufe2:#/stufe2" "blatt-1:#/stufe2/blatt/1" "blatt-7:#/stufe2/blatt/7" "blatt-42:#/stufe2/blatt/42" "stufe3:#/stufe3"; do
  name="${seite%%:*}"; anker="${seite#*:}"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=800,1700 \
    --screenshot="$SCRATCH/$name.png" "http://127.0.0.1:8765/index.html$anker" 2>/dev/null
done
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=390,1900 \
  --screenshot="$SCRATCH/blatt-7-handy.png" "http://127.0.0.1:8765/index.html#/stufe2/blatt/7" 2>/dev/null
```

mit `SCRATCH` als Scratchpad-Verzeichnis. Jedes Foto mit dem Read-Werkzeug ansehen. Erwartung:
- Startseite: Titel und zwei Knöpfe "Stufe 2", "Stufe 3"
- Stufe 2: Zahlenraster 1 bis 100
- Blatt: Kopfleiste mit Zurück, Titel, Drucken; Blatt mit Ausgangszeile, zwölf Sätzen, Parcours, Legende
- Parcours: drei Linienarten unterscheidbar, zwei Schleifen, Beschriftungen entlang der Segmente, nicht auf dem Kopf, Querstriche an Übergängen
- Handybreite: kein waagerechtes Scrollen, Parcours auf Bildschirmbreite
- Stufe 3: Platzhaltertext

Falls im Foto nur eine leere Seite erscheint: Konsole prüfen mit `"$CHROME" --headless=new --disable-gpu --enable-logging=stderr --v=0 --dump-dom "http://127.0.0.1:8765/index.html#/" 2>&1 | grep -i -E 'error|uncaught'`. Häufigste Ursache: ein Importname stimmt nicht mit dem Export überein.

- [ ] **Schritt 6: Druckansicht prüfen**

```bash
"$CHROME" --headless=new --disable-gpu --print-to-pdf="$SCRATCH/blatt-7.pdf" --no-pdf-header-footer \
  "http://127.0.0.1:8765/index.html#/stufe2/blatt/7" 2>/dev/null
```

Die PDF mit dem Read-Werkzeug ansehen. Erwartung: eine Seite, keine Kopfleiste, Textteil und Parcours vollständig auf der Seite. Läuft der Parcours auf eine zweite Seite, `max-height` in `.parcours` unter `@media print` auf `130mm` senken und erneut prüfen.

- [ ] **Schritt 7: Server beenden**

`pkill -f "http.server 8765"`

- [ ] **Schritt 8: Commit**

```bash
git add index.html style.css js/app.js
git commit -m "Oberfläche: Startseite, Blattliste, Blattansicht, Druck

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Aufgabe 9: README und Veröffentlichung über GitHub Pages

**Dateien:**
- Erstellen: `README.md`, `.nojekyll`

- [ ] **Schritt 1: README schreiben**

`README.md`:

```markdown
# AUA PIT Übungsblätter

Erzeugt Übungsblätter für die PIT-Übungen nach dem Vorbild der Vorlagen "AUA PIT Stufe 2" und "AUA PIT Stufe 3". Jedes Blatt besteht aus einem Textteil (zwölf Anweisungen ab Ausgangskurs 090°, 2000 ft) und einem gezeichneten Parcours, der direkt anschließt.

Die App speichert nichts. Blatt 7 der Stufe 2 ist immer dasselbe Blatt, weil die Nummer den Zufall festlegt.

**Adresse:** https://willi-workflow.github.io/aua-pit-uebungen/

## Stand

- Stufe 2 vollständig: Textteil und Parcours, 100 nummerierte Blätter, Druck auf A4
- Stufe 3 und Endlosmodus folgen

## Zeichensprache

| Linie | Bedeutung |
|---|---|
| dick schwarz | Horizontalflug |
| weiß mit Rand | Sinkflug |
| weiß mit Sprossen | Steigflug |

`250°/15"` Kurs und Sekunden. `SSE/10"` Kurs als Himmelsrichtung. `/30"` ohne Kurs: der Kurs ergibt sich aus der relativen Kursänderung an der Ecke davor (`+90°`, `-156°`). Eine Zahl ohne Gradzeichen an einem Segment (`+230`) ist eine Rechenaufgabe: Kursanzeige plus oder minus die Zahl, Ergebnis laut sagen.

## Örtlich starten

Die App besteht aus ES-Modulen, deshalb braucht sie einen kleinen Server:

    python3 -m http.server 8765

Dann http://127.0.0.1:8765/ öffnen.

## Prüfen

    node --test

Braucht Node 20 oder neuer, keine Abhängigkeiten.

## Aufbau

| Datei | Zuständigkeit |
|---|---|
| `js/zufall.js` | bestimmter Zufall aus Stufe und Blattnummer |
| `js/kurs.js` | Gradrechnung, Himmelsrichtungen, Schreibweise |
| `js/textteil.js` | Satzschablonen mit Flugzustand |
| `js/parcours.js` | Bausteine, Geometrie, Kreuzungsprüfung, Kandidatensuche |
| `js/zeichnung.js` | SVG aus dem Parcours |
| `js/blatt.js` | Blatt aus Stufe und Nummer |
| `js/app.js` | Adressen und Ansichten |

Entwurf und Plan liegen unter `docs/superpowers/`.
```

- [ ] **Schritt 2: .nojekyll anlegen und Commit**

```bash
touch .nojekyll
git add README.md .nojekyll
git commit -m "README und Pages ohne Jekyll

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Schritt 3: Repository auf GitHub anlegen und pushen**

Vorher prüfen, dass die Vorlagen nicht dabei sind: `git ls-files | grep -c "Stufe "` muss `0` ausgeben.

```bash
gh repo create aua-pit-uebungen --public --source=. --remote=origin --push \
  --description "Übungsblätter für die PIT-Übungen der AUA, Stufe 2 und 3"
```

Erwartung: Ausgabe mit `https://github.com/Willi-Workflow/aua-pit-uebungen` und erfolgreichem Push von `main`.

- [ ] **Schritt 4: GitHub Pages einschalten**

```bash
gh api -X POST repos/Willi-Workflow/aua-pit-uebungen/pages -f 'source[branch]=main' -f 'source[path]=/'
```

Erwartung: JSON-Antwort mit `"html_url": "https://willi-workflow.github.io/aua-pit-uebungen/"`. Bei `422` mit "already exists" ist Pages schon an, weiter.

- [ ] **Schritt 5: Warten, bis die Seite ausgeliefert wird**

Alle 20 Sekunden prüfen, höchstens fünf Minuten:

```bash
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' https://willi-workflow.github.io/aua-pit-uebungen/)
  echo "$code"; [ "$code" = "200" ] && break; sleep 20
done
```

Erwartung: irgendwann `200`. Danach ein Bildschirmfoto headless von `https://willi-workflow.github.io/aua-pit-uebungen/#/stufe2/blatt/7` wie in Aufgabe 8 und ansehen: Blatt 7 muss identisch zur örtlichen Fassung aussehen.

Bleibt es bei `404` nach fünf Minuten: `gh api repos/Willi-Workflow/aua-pit-uebungen/pages --jq '.status'` ausgeben und Willi den Stand melden, nicht weiter raten.

- [ ] **Schritt 6: Abschlussmeldung an Willi**

Nennen: Adresse der App, Adresse des Repositorys, Zahl der kreuzungsfreien Blätter aus Aufgabe 7, Laufzeit aus Aufgabe 5, und die Sätze aus Aufgabe 3 Schritt 5, die sprachlich auffällig waren. Nichts davon erfinden, alles aus den Ausgaben.

---

## Nach dem Abschnitt offen

- Wortwahl der Satzschablonen mit Willi abstimmen (er kennt die Sprache der Prüfung)
- Stufe 3: Kürzel klären, dann eigener Entwurf
- Endlosmodus
- Schreibweise der Himmelsrichtungen zufällig mischen: nur `SCHREIBWEISE` in `js/kurs.js` anfassen
