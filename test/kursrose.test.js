import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ansichtFuer } from '../js/app.js';
import { kursrose, zifferUnterZeiger, AUSGANGSKURS } from '../js/kursrose.js';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const norm = (grad) => ((grad % 360) + 360) % 360;

// Striche der Rose in der Reihenfolge 0, 5, ..., 355 mit ihrem Winkel auf dem
// Bildschirm (0 oben, rechts herum), aus dem äußeren Endpunkt gelesen
function striche(svg) {
  return [...svg.matchAll(/<line class="rose-strich (\w+)" x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"\/>/g)].map((m) => {
    const x2 = Number(m[4]);
    const y2 = Number(m[5]);
    return { art: m[1], x2, y2, winkel: norm((Math.atan2(x2, -y2) * 180) / Math.PI) };
  });
}

function ziffern(svg) {
  return [...svg.matchAll(/<text class="rose-ziffer( ausgang)?" transform="rotate\(([-\d.]+)\) translate\(0 -64\)">(\d+)<\/text>/g)]
    .map((m) => ({ orange: Boolean(m[1]), drehung: Number(m[2]), wert: Number(m[3]) }));
}

// Winkelabstand ohne Vorzeichen, 0 bis 180
const abstand = (a, b) => Math.min(norm(a - b), norm(b - a));

test('Kursrose auf 090 wie bisher: Startseite und Kopfleiste Zeichen für Zeichen gleich', () => {
  assert.equal(AUSGANGSKURS, 90);
  // Fingerabdrücke der Rose vor dem Parameter "kurs"
  assert.equal(sha(kursrose(280, true)), '5d3f2138c10431c366dda8d21f0b9ff4388f2557d4186083d7357a49f409bd13');
  assert.equal(sha(kursrose(22, false)), '7c0a8a696377301d285e8eb3035dddc97dc7bd532626f496d033e90fdcec85de');
  assert.equal(kursrose(280, true, 90), kursrose(280, true));
  const start = ansichtFuer('#/');
  assert.ok(start.includes(kursrose(280, true)), 'Startseite zeigt die Rose auf 090');
  assert.ok(start.includes(kursrose(22, false)), 'Kopfleiste zeigt das Zeichen auf 090');
  assert.ok(start.includes('aria-label="Kursrose, Ausgangskurs 090°"'));
});

test('Kursrose dreht auf den Kurs: jeder Strich an seinem Platz, der Strich des Kurses oben', () => {
  for (const kurs of [0, 4, 90, 135, 225, 235, 236, 255, 344, 359]) {
    const svg = kursrose(220, true, kurs);
    const liste = striche(svg);
    assert.equal(liste.length, 72, `${kurs}: 72 Striche`);
    liste.forEach((s, i) => {
      assert.ok(abstand(s.winkel, i * 5 - kurs) < 0.05, `${kurs}: Strich ${i * 5} bei ${s.winkel.toFixed(2)}°`);
      assert.equal(s.art, i % 6 === 0 ? 'lang' : i % 2 === 0 ? 'mittel' : 'kurz');
    });
    // Liegt der Kurs auf einem Strich, steht dieser genau oben unter dem Zeiger
    if (kurs % 5 === 0) {
      const oben = liste[kurs / 5];
      assert.ok(Math.abs(oben.x2) < 0.01 && Math.abs(oben.y2 + 90) < 0.01, `${kurs}: Strich oben bei ${oben.x2}, ${oben.y2}`);
    }
    // Der oberste Strich ist immer der des Kurses, auf 5° gerundet
    const oberster = liste.reduce((a, b) => (abstand(b.winkel, 0) < abstand(a.winkel, 0) ? b : a));
    assert.ok(abstand(liste.indexOf(oberster) * 5, kurs) <= 2.5, `${kurs}: oberster Strich`);
    // Der Zeiger bleibt fest oben, das Flugzeug zeigt nach oben
    assert.ok(svg.includes('<path class="rose-zeiger" d="M -7 -100 H 7 L 0 -91.5 Z"/>'));
    assert.ok(svg.includes('<path class="rose-flugzeug" transform="scale(0.85)"'));
    assert.ok(svg.includes(`aria-label="Kursrose, Kurs ${String(kurs).padStart(3, '0')}°"`) || kurs === 90);
  }
});

test('Kursrose: orange ist die Ziffer unter dem Zeiger, nicht fest die 9', () => {
  const faelle = [[90, 9], [236, 24], [4, 0], [359, 0], [344, 33], [135, 15], [225, 24], [255, 27], [120, 12]];
  for (const [kurs, erwartet] of faelle) {
    const liste = ziffern(kursrose(220, true, kurs));
    assert.equal(liste.length, 12, `${kurs}: zwölf Ziffern`);
    const orange = liste.filter((z) => z.orange);
    assert.equal(orange.length, 1, `${kurs}: genau eine orange Ziffer`);
    assert.equal(orange[0].wert, erwartet, `${kurs}: orange ${orange[0].wert}`);
    assert.equal(zifferUnterZeiger(kurs), erwartet * 10);
    // Sie steht höchstens eine halbe Teilung (15°) neben dem Zeiger, keine andere näher
    assert.ok(abstand(orange[0].drehung, 0) <= 15, `${kurs}: orange ${orange[0].drehung}° neben dem Zeiger`);
    for (const z of liste) assert.ok(abstand(z.drehung, 0) >= abstand(orange[0].drehung, 0), `${kurs}: ${z.wert} näher am Zeiger`);
    // Jede Ziffer steht bei ihrem Kurs relativ zum Zeiger
    for (const z of liste) assert.ok(abstand(z.drehung, z.wert * 10 - kurs) < 1e-9, `${kurs}: Ziffer ${z.wert}`);
  }
  // Auf 236 ist die 9 nicht mehr orange
  assert.ok(!/<text class="rose-ziffer ausgang"[^>]*>9<\/text>/.test(kursrose(220, true, 236)));
});

test('Kursrose: Zeichen der Kopfleiste dreht mit, auf 090 unverändert', () => {
  const zeichen = kursrose(22, false, 0);
  const liste = striche(zeichen);
  assert.equal(liste.length, 4);
  assert.deepEqual(liste.map((s) => Math.round(s.winkel)), [0, 90, 180, 270]);
  assert.deepEqual(striche(kursrose(22, false)).map((s) => Math.round(s.winkel)), [270, 0, 90, 180]);
});
