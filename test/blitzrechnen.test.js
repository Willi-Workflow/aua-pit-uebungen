import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ansichtFuer } from '../js/app.js';
import { EINSTELLUNGEN, EINSTELLUNGEN_SCHLUESSEL, VORGABEN, einstellungenLesen, einstellungenSchreiben } from '../js/blitzeinstellungen.js';
import { Zufall } from '../js/zufall.js';
import { baueKopfaufgabe } from '../js/kopfrechnen.js';
import { erzeugeAusschnitt } from '../js/ausschnitt.js';
import { kopfBuehne, ausschnittBuehne, zaehlerLeiste } from '../js/blitzansicht.js';

function speicher(anfang = {}) {
  const daten = new Map(Object.entries(anfang));
  return { getItem: (k) => (daten.has(k) ? daten.get(k) : null), setItem: (k, v) => daten.set(k, String(v)), daten };
}
const gesperrt = { getItem() { throw new Error('gesperrt'); }, setItem() { throw new Error('gesperrt'); } };
const zaehle = (text, muster) => (text.match(muster) || []).length;

// ------------------------------------------------------------ Einstellungen

test('Einstellungen: Vorgaben und Auswahl je Gruppe wie im Entwurf', () => {
  assert.equal(EINSTELLUNGEN_SCHLUESSEL, 'blitzrechnen.einstellungen');
  assert.deepEqual(VORGABEN, { antwortart: 'eintippen', anzeigezeit: 5, antwortzeit: 10, aufgabenstellung: 'geschrieben' });
  assert.deepEqual(EINSTELLUNGEN.antwortart.werte, ['eintippen', 'aufloesung']);
  assert.deepEqual(EINSTELLUNGEN.anzeigezeit.werte, [3, 5, 8]);
  assert.deepEqual(EINSTELLUNGEN.antwortzeit.werte, [10, 15, 20]);
  assert.deepEqual(EINSTELLUNGEN.aufgabenstellung.werte, ['geschrieben', 'ton', 'beides']);
});

test('Einstellungen: ohne Speicher, mit gesperrtem oder leerem Speicher gelten die Vorgaben', () => {
  for (const s of [null, undefined, gesperrt, speicher(), speicher({ [EINSTELLUNGEN_SCHLUESSEL]: 'kein JSON' }), speicher({ [EINSTELLUNGEN_SCHLUESSEL]: '[1,2]' })]) {
    assert.deepEqual(einstellungenLesen(s), VORGABEN);
  }
});

test('Einstellungen: schreiben und wieder lesen, ungültige Werte fallen einzeln auf die Vorgabe', () => {
  const s = speicher();
  const werte = { antwortart: 'aufloesung', anzeigezeit: 8, antwortzeit: 20, aufgabenstellung: 'beides' };
  assert.equal(einstellungenSchreiben(werte, s), true);
  assert.deepEqual(JSON.parse(s.daten.get(EINSTELLUNGEN_SCHLUESSEL)), werte);
  assert.deepEqual(einstellungenLesen(s), werte);
  const teils = speicher({ [EINSTELLUNGEN_SCHLUESSEL]: JSON.stringify({ anzeigezeit: 4, antwortzeit: 15, aufgabenstellung: 'ton', fremd: 1 }) });
  assert.deepEqual(einstellungenLesen(teils), { antwortart: 'eintippen', anzeigezeit: 5, antwortzeit: 15, aufgabenstellung: 'ton' });
  assert.equal(einstellungenSchreiben(werte, gesperrt), false);
  assert.equal(einstellungenSchreiben(werte, null), false);
});

// ------------------------------------------------------------ Adressen

test('Adressen: Auswahlseite mit drei Karten und Knopf Einstellungen, Zurück zur Startseite', () => {
  const html = ansichtFuer('#/blitzrechnen');
  assert.ok(html.includes('<h1 class="titel">Blitzrechnen</h1>'));
  for (const [ziel, titel] of [['kopfrechnen', 'Kopfrechnen mit Kursen'], ['stufe2', 'Blitzrechnen Stufe 2'], ['stufe3', 'Blitzrechnen Stufe 3']]) {
    assert.ok(new RegExp(`<a class="karte" href="#/blitzrechnen/${ziel}"><span class="karte-titel">${titel}</span>`).test(html), titel);
  }
  assert.ok(html.includes('<a class="knopf" href="#/blitzrechnen/einstellungen">Einstellungen</a>'));
  assert.ok(html.includes('<a class="zurueck" href="#/">Zurück</a>'));
  assert.ok(html.includes('<span class="ort">Blitzrechnen</span>'));
});

test('Adressen: Einstellungen als Gruppen von Knöpfen, ohne Speicher die Vorgaben gedrückt', () => {
  const html = ansichtFuer('#/blitzrechnen/einstellungen');
  assert.ok(html.includes('data-einstellungen'));
  assert.equal(zaehle(html, /<section class="gruppe">/g), 4);
  assert.equal(zaehle(html, /data-einstellung="/g), 11);
  assert.equal(zaehle(html, /aria-pressed="true"/g), 4);
  for (const [name, wert] of Object.entries(VORGABEN)) {
    assert.ok(new RegExp(`data-einstellung="${name}" data-wert="${wert}" aria-pressed="true"`).test(html), `${name} ${wert}`);
  }
  assert.ok(!html.includes('type="range"'), 'keine Schieberegler');
  assert.ok(html.includes('<a class="zurueck" href="#/blitzrechnen">Zurück</a>'));
});

test('Adressen: die drei Übungen mit Startknopf, unbekannte Adressen nicht gefunden', () => {
  for (const [bereich, titel] of [['kopfrechnen', 'Kopfrechnen mit Kursen'], ['stufe2', 'Blitzrechnen Stufe 2'], ['stufe3', 'Blitzrechnen Stufe 3']]) {
    const html = ansichtFuer(`#/blitzrechnen/${bereich}`);
    assert.ok(html.includes(`data-blitz="${bereich}"`), bereich);
    assert.ok(html.includes(`<h1 class="titel">${titel}</h1>`), bereich);
    assert.ok(html.includes('data-aktion="start"'), bereich);
    assert.ok(!html.includes('data-probe'), bereich);
    assert.ok(html.includes('<a class="zurueck" href="#/blitzrechnen">Zurück</a>'), bereich);
  }
  assert.ok(ansichtFuer('#/blitzrechnen/stufe4').includes('Nicht gefunden'));
  assert.ok(ansichtFuer('#/blitzrechnen/kopfrechnen/7').includes('Nicht gefunden'));
  assert.ok(ansichtFuer('#/blitzrechnen?x=1').includes('<h1 class="titel">Blitzrechnen</h1>'));
});

test('Adressen: Kopfleisten der neuen Seiten ohne Mittelpunkte und Pfeile', () => {
  for (const hash of ['#/blitzrechnen', '#/blitzrechnen/einstellungen', '#/blitzrechnen/kopfrechnen', '#/blitzrechnen/stufe2', '#/blitzrechnen/stufe3']) {
    const html = ansichtFuer(hash);
    assert.ok(!html.includes('·'), `Mittelpunkt in ${hash}`);
    assert.ok(!html.includes('←'), `Pfeil in ${hash}`);
  }
});

// ------------------------------------------------------------ Prüfmodus

test('Prüfmodus Kopfrechnen: Aufgabe geschrieben, per Ton, beides; Knopfleiste der Richtungen', () => {
  const geschrieben = ansichtFuer('#/blitzrechnen/kopfrechnen?probe=aufgabe&art=kursPlusZahl');
  assert.ok(geschrieben.includes('data-probe="aufgabe"'));
  assert.ok(/<p class="aufgabe-text">\d{3} [+−] \d+<\/p>/.test(geschrieben));
  assert.ok(geschrieben.includes('inputmode="numeric"'));
  assert.ok(geschrieben.includes('class="zeitbalken'));
  const ton = ansichtFuer('#/blitzrechnen/kopfrechnen?probe=aufgabe&art=gegenkurs&stellung=ton');
  assert.ok(ton.includes('Nochmal hören') && !/class="aufgabe-text[ "]/.test(ton));
  const beides = ansichtFuer('#/blitzrechnen/kopfrechnen?probe=aufgabe&art=gegenkurs&stellung=beides');
  assert.ok(beides.includes('Nochmal hören') && /<p class="aufgabe-text lang">Gegenkurs von \d{3}<\/p>/.test(beides));
  const richtung = ansichtFuer('#/blitzrechnen/kopfrechnen?probe=aufgabe&art=naechsteRichtung');
  assert.equal(zaehle(richtung, /data-aktion="richtung"/g), 16);
  assert.ok(!richtung.includes('inputmode'));
  assert.ok(ansichtFuer('#/blitzrechnen/kopfrechnen?probe=ergebnis').includes('class="urteil richtig"'));
  const aufloesung = ansichtFuer('#/blitzrechnen/kopfrechnen?probe=loesung');
  assert.ok(aufloesung.includes('Hatte ich</button>') && aufloesung.includes('Hatte ich nicht</button>'));
});

test('Prüfmodus Ausschnitte: sichtbar, ausgeblendet mit Antwortfeld, Lösung daneben', () => {
  for (const stufe of [2, 3]) {
    const anzeige = ansichtFuer(`#/blitzrechnen/stufe${stufe}?probe=anzeige&art=gate`);
    assert.ok(/<figcaption class="ankunft">Ankunft auf Kurs \d{3}<\/figcaption>/.test(anzeige));
    assert.ok(anzeige.includes('<svg') && !anzeige.includes('class="ausschnitt ausgeblendet"'));
    const aus = ansichtFuer(`#/blitzrechnen/stufe${stufe}?probe=ausgeblendet&art=gate`);
    assert.ok(aus.includes('class="ausschnitt ausgeblendet"') && aus.includes('Ausschnitt ausgeblendet'));
    assert.ok(aus.includes('inputmode="numeric"') && aus.includes('Gate, Zeile 1: Kurs danach'));
    const loesung = ansichtFuer(`#/blitzrechnen/stufe${stufe}?probe=loesung&art=gate`);
    assert.ok(loesung.includes('class="loesungen"'));
    assert.ok(zaehle(loesung, /<li class="richtig">/g) >= 1 && zaehle(loesung, /<li class="falsch">/g) >= 1);
  }
  assert.equal(zaehle(ansichtFuer('#/blitzrechnen/stufe3?probe=ausgeblendet&art=hr'), /data-aktion="richtung"/g), 16);
  const aufloesung = ansichtFuer('#/blitzrechnen/stufe2?probe=loesung&antwort=aufloesung&art=relativ');
  assert.ok(aufloesung.includes('Hatte ich nicht</button>') && !aufloesung.includes('<li class="falsch">'));
});

// ------------------------------------------------------------ Bühnen

test('Bühne Kopfrechnen: Zähler, Zeitbalken, Ergebnis richtig und falsch, Auflösung mit Selbstzählung', () => {
  const stand = { richtig: 3, gesamt: 5, serie: 2 };
  const leiste = zaehlerLeiste(stand);
  assert.ok(leiste.includes('<strong>3</strong> / 5 richtig') && leiste.includes('Serie 2') && leiste.includes('data-aktion="beenden"'));
  const aufgabe = baueKopfaufgabe('kursPlusZahl', { kurs: 247, zahl: 230 });
  const e = { ...VORGABEN };
  const laeuft = kopfBuehne(aufgabe, e, { phase: 'aufgabe', zeitLaeuft: true }, stand);
  assert.ok(laeuft.includes('<p class="aufgabe-text">247 + 230</p>'));
  assert.ok(/class="zeitbalken laeuft"[^>]*><span style="animation-duration: 10s"/.test(laeuft));
  const richtig = kopfBuehne(aufgabe, e, { phase: 'ergebnis', eingabe: '117', richtig: true }, stand);
  assert.ok(richtig.includes('class="urteil richtig"') && richtig.includes('<strong>117</strong>') && richtig.includes('data-aktion="weiter"'));
  const falsch = kopfBuehne(aufgabe, e, { phase: 'ergebnis', eingabe: null, richtig: false, zeitAbgelaufen: true }, stand);
  assert.ok(falsch.includes('class="urteil falsch"') && falsch.includes('Zeit abgelaufen'));
  const auf = kopfBuehne(aufgabe, { ...e, antwortart: 'aufloesung' }, { phase: 'aufloesung', markiert: 'ja' }, stand);
  assert.ok(/data-wert="ja" aria-pressed="true"/.test(auf) && auf.includes('<strong>117</strong>'));
});

test('Bühne Ausschnitt: Ankunft über der Zeichnung, Fragen nacheinander, Drehsinn mit links und rechts', () => {
  let formA = null;
  for (let i = 0; !formA; i++) {
    const a = erzeugeAusschnitt(new Zufall(`form-a-${i}`), 3, 'gate');
    if (a.elemente[1].form === 'a') formA = a;
  }
  const e = { ...VORGABEN };
  const stand = { richtig: 0, gesamt: 0, serie: 0 };
  const anzeige = ausschnittBuehne(formA, e, { phase: 'anzeige' }, stand);
  assert.ok(anzeige.includes(`Ankunft auf Kurs ${String(formA.ankunft).padStart(3, '0')}`));
  assert.ok(/class="zeitbalken laeuft"[^>]*><span style="animation-duration: 5s"/.test(anzeige));
  const letzte = formA.fragen.length - 1;
  const antworten = formA.fragen.slice(0, letzte).map((f) => ({ eingabe: '000', richtig: false }));
  const drehsinn = ausschnittBuehne(formA, e, { phase: 'ausgeblendet', frage: letzte, antworten }, stand);
  assert.ok(drehsinn.includes('Drehsinn zum nächsten Kurs?'));
  assert.ok(drehsinn.includes('data-aktion="drehsinn" data-wert="links"') && drehsinn.includes('data-aktion="drehsinn" data-wert="rechts"'));
  assert.ok(drehsinn.includes(`Frage ${letzte + 1} von ${formA.fragen.length}`));
  const loesung = ausschnittBuehne(formA, e, { phase: 'loesung', antworten: [...antworten, { eingabe: formA.fragen[letzte].loesung, richtig: true }] }, stand);
  assert.equal(zaehle(loesung, /<li class="(richtig|falsch)">/g), formA.fragen.length);
  assert.ok(!loesung.includes('class="ausschnitt ausgeblendet"'));
});
