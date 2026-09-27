import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ansichtFuer } from '../js/app.js';
import {
  EINSTELLUNGEN, EINSTELLUNGEN_SCHLUESSEL, VORGABEN, ZEITEN, einstellungenLesen, einstellungenSchreiben, einstellungSetzen, zeitenZuruecksetzen, einstellungenKurz,
} from '../js/blitzeinstellungen.js';
import { VORGABEZEITEN } from '../js/schwierigkeit.js';
import { Zufall } from '../js/zufall.js';
import { baueKopfaufgabe } from '../js/kopfrechnen.js';
import { erzeugeAusschnitt } from '../js/ausschnitt.js';
import { kopfBuehne, ausschnittBuehne, zaehlerLeiste, blitzInhalt, eigeneZeitenText } from '../js/blitzansicht.js';

function speicher(anfang = {}) {
  const daten = new Map(Object.entries(anfang));
  return { getItem: (k) => (daten.has(k) ? daten.get(k) : null), setItem: (k, v) => daten.set(k, String(v)), daten };
}
const gesperrt = { getItem() { throw new Error('gesperrt'); }, setItem() { throw new Error('gesperrt'); } };
const zaehle = (text, muster) => (text.match(muster) || []).length;

// ------------------------------------------------------------ Einstellungen

test('Einstellungen: Vorgaben und Auswahl je Gruppe wie im Entwurf, Schwierigkeit zuerst', () => {
  assert.equal(EINSTELLUNGEN_SCHLUESSEL, 'blitzrechnen.einstellungen');
  assert.deepEqual(VORGABEN, {
    schwierigkeit: 'normal', antwortart: 'eintippen', anzeigezeit: 5, antwortzeit: 10, aufgabenstellung: 'geschrieben', eigeneZeiten: [],
  });
  assert.deepEqual(Object.keys(EINSTELLUNGEN), ['schwierigkeit', 'antwortart', 'anzeigezeit', 'antwortzeit', 'aufgabenstellung']);
  assert.deepEqual(EINSTELLUNGEN.schwierigkeit.werte, ['leicht', 'normal', 'schwer']);
  assert.deepEqual(EINSTELLUNGEN.antwortart.werte, ['eintippen', 'aufloesung']);
  assert.deepEqual(EINSTELLUNGEN.anzeigezeit.werte, [3, 5, 8]);
  assert.deepEqual(EINSTELLUNGEN.antwortzeit.werte, [8, 10, 15, 20]);
  assert.deepEqual(EINSTELLUNGEN.aufgabenstellung.werte, ['geschrieben', 'ton', 'beides']);
  assert.deepEqual(ZEITEN, ['anzeigezeit', 'antwortzeit']);
  assert.deepEqual(VORGABEZEITEN, {
    leicht: { anzeigezeit: 8, antwortzeit: 15 }, normal: { anzeigezeit: 5, antwortzeit: 10 }, schwer: { anzeigezeit: 3, antwortzeit: 8 },
  });
  // Jede Vorgabezeit lässt sich auch von Hand wählen
  for (const zeiten of Object.values(VORGABEZEITEN)) for (const name of ZEITEN) assert.ok(EINSTELLUNGEN[name].werte.includes(zeiten[name]));
});

test('Einstellungen: ohne Speicher, mit gesperrtem oder leerem Speicher gelten die Vorgaben', () => {
  for (const s of [null, undefined, gesperrt, speicher(), speicher({ [EINSTELLUNGEN_SCHLUESSEL]: 'kein JSON' }), speicher({ [EINSTELLUNGEN_SCHLUESSEL]: '[1,2]' })]) {
    assert.deepEqual(einstellungenLesen(s), VORGABEN);
  }
});

test('Einstellungen: schreiben und wieder lesen, ungültige Werte fallen einzeln auf die Vorgabe', () => {
  const s = speicher();
  const werte = { schwierigkeit: 'schwer', antwortart: 'aufloesung', anzeigezeit: 8, antwortzeit: 20, aufgabenstellung: 'beides', eigeneZeiten: ['anzeigezeit', 'antwortzeit'] };
  assert.equal(einstellungenSchreiben(werte, s), true);
  assert.deepEqual(JSON.parse(s.daten.get(EINSTELLUNGEN_SCHLUESSEL)), werte);
  assert.deepEqual(einstellungenLesen(s), werte);
  const gespeichert = (inhalt) => speicher({ [EINSTELLUNGEN_SCHLUESSEL]: JSON.stringify(inhalt) });
  // Ungültige Schwierigkeit und Zeit einzeln ersetzt; eine ungültige Zeit ist nie selbst gewählt
  assert.deepEqual(einstellungenLesen(gespeichert({ schwierigkeit: 'mittel', anzeigezeit: 4, antwortzeit: 15, aufgabenstellung: 'ton', eigeneZeiten: ['anzeigezeit', 'antwortzeit', 'fremd'], fremd: 1 })), {
    schwierigkeit: 'normal', antwortart: 'eintippen', anzeigezeit: 5, antwortzeit: 15, aufgabenstellung: 'ton', eigeneZeiten: ['antwortzeit'],
  });
  for (const kaputt of [{ eigeneZeiten: 'antwortzeit' }, { eigeneZeiten: null }, { eigeneZeiten: {} }]) {
    assert.deepEqual(einstellungenLesen(gespeichert({ schwierigkeit: 'leicht', ...kaputt })), {
      schwierigkeit: 'leicht', antwortart: 'eintippen', anzeigezeit: 8, antwortzeit: 15, aufgabenstellung: 'geschrieben', eigeneZeiten: [],
    });
  }
  assert.equal(einstellungenSchreiben(werte, gesperrt), false);
  assert.equal(einstellungenSchreiben(werte, null), false);
});

test('Einstellungen: Zeiten folgen der Schwierigkeit, bis eine Zeit selbst gewählt ist', () => {
  const gespeichert = (inhalt) => speicher({ [EINSTELLUNGEN_SCHLUESSEL]: JSON.stringify(inhalt) });
  for (const [schwierigkeit, zeiten] of Object.entries(VORGABEZEITEN)) {
    // Gespeicherte Zeiten ohne eigene Wahl zählen nicht, es gilt die Vorgabe der Schwierigkeit
    const gelesen = einstellungenLesen(gespeichert({ schwierigkeit, anzeigezeit: 5, antwortzeit: 20, eigeneZeiten: [] }));
    assert.equal(gelesen.anzeigezeit, zeiten.anzeigezeit, schwierigkeit);
    assert.equal(gelesen.antwortzeit, zeiten.antwortzeit, schwierigkeit);
  }
  const eigen = einstellungenLesen(gespeichert({ schwierigkeit: 'schwer', anzeigezeit: 8, antwortzeit: 20, eigeneZeiten: ['antwortzeit'] }));
  assert.equal(eigen.anzeigezeit, 3);
  assert.equal(eigen.antwortzeit, 20);

  // Klicks wie in den Einstellungen
  let werte = einstellungenLesen(null);
  werte = einstellungSetzen(werte, 'schwierigkeit', 'schwer');
  assert.deepEqual([werte.anzeigezeit, werte.antwortzeit, werte.eigeneZeiten], [3, 8, []]);
  werte = einstellungSetzen(werte, 'antwortzeit', 20);
  assert.deepEqual([werte.anzeigezeit, werte.antwortzeit, werte.eigeneZeiten], [3, 20, ['antwortzeit']]);
  werte = einstellungSetzen(werte, 'schwierigkeit', 'leicht');
  assert.deepEqual([werte.anzeigezeit, werte.antwortzeit, werte.eigeneZeiten], [8, 20, ['antwortzeit']]);
  werte = einstellungSetzen(werte, 'anzeigezeit', 5);
  werte = einstellungSetzen(werte, 'schwierigkeit', 'schwer');
  assert.deepEqual([werte.anzeigezeit, werte.antwortzeit, werte.eigeneZeiten], [5, 20, ['anzeigezeit', 'antwortzeit']]);
  // Auch eine Zeit, die gerade der Vorgabe entspricht, gilt nach dem Klick als eigene Wahl
  const gleich = einstellungSetzen(einstellungSetzen(einstellungenLesen(null), 'anzeigezeit', 5), 'schwierigkeit', 'leicht');
  assert.deepEqual([gleich.anzeigezeit, gleich.antwortzeit], [5, 15]);
  werte = zeitenZuruecksetzen(werte);
  assert.deepEqual([werte.anzeigezeit, werte.antwortzeit, werte.eigeneZeiten], [3, 8, []]);
  // Geschrieben und wieder gelesen bleibt alles, wie es war
  const s = speicher();
  const mitEigener = einstellungSetzen(werte, 'antwortzeit', 15);
  einstellungenSchreiben(mitEigener, s);
  assert.deepEqual(einstellungenLesen(s), mitEigener);
  // Die Vorgaben selbst ändern sich dabei nicht
  assert.deepEqual(VORGABEN.eigeneZeiten, []);
  assert.equal(VORGABEN.schwierigkeit, 'normal');
});

test('Einstellungen: älterer Speicherstand ohne Schwierigkeit, abweichende Zeiten gelten als selbst gewählt', () => {
  const alt = (inhalt) => einstellungenLesen(speicher({ [EINSTELLUNGEN_SCHLUESSEL]: JSON.stringify(inhalt) }));
  assert.deepEqual(alt({ antwortart: 'aufloesung', anzeigezeit: 5, antwortzeit: 10, aufgabenstellung: 'ton' }), {
    schwierigkeit: 'normal', antwortart: 'aufloesung', anzeigezeit: 5, antwortzeit: 10, aufgabenstellung: 'ton', eigeneZeiten: [],
  });
  assert.deepEqual(alt({ antwortart: 'eintippen', anzeigezeit: 8, antwortzeit: 10, aufgabenstellung: 'geschrieben' }).eigeneZeiten, ['anzeigezeit']);
  assert.deepEqual(alt({ anzeigezeit: 3, antwortzeit: 20 }).eigeneZeiten, ['anzeigezeit', 'antwortzeit']);
  // Eine ungültige alte Zeit ist keine eigene Wahl
  assert.deepEqual(alt({ anzeigezeit: 4, antwortzeit: 12 }).eigeneZeiten, []);
});

test('Einstellungen: Kurzfassung nennt die Schwierigkeit', () => {
  const werte = einstellungSetzen(einstellungenLesen(null), 'schwierigkeit', 'leicht');
  assert.equal(einstellungenKurz(werte), 'Schwierigkeit leicht, Eintippen mit Prüfung, Anzeige 8 s, Antwortzeit 15 s, Kopfrechnen: Aufgabe geschrieben');
  assert.equal(einstellungenKurz(werte, 'kopfrechnen'), 'Schwierigkeit leicht, Eintippen mit Prüfung, Antwortzeit 15 s, Aufgabe geschrieben');
  assert.equal(einstellungenKurz(werte, 'stufe3'), 'Schwierigkeit leicht, Eintippen mit Prüfung, Anzeige 8 s, Antwortzeit 15 s');
  assert.ok(ansichtFuer('#/blitzrechnen').includes('<p class="einstellungen-kurz">Schwierigkeit normal, '));
  assert.ok(ansichtFuer('#/blitzrechnen/stufe2').includes('<p class="einstellungen-kurz">Schwierigkeit normal, '));
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
  assert.equal(zaehle(html, /<section class="gruppe">/g), 5);
  assert.equal(zaehle(html, /data-einstellung="/g), 15);
  assert.equal(zaehle(html, /aria-pressed="true"/g), 5);
  for (const name of Object.keys(EINSTELLUNGEN)) {
    assert.ok(new RegExp(`data-einstellung="${name}" data-wert="${VORGABEN[name]}" aria-pressed="true"`).test(html), `${name} ${VORGABEN[name]}`);
  }
  assert.ok(html.indexOf('id="gruppe-schwierigkeit"') < html.indexOf('id="gruppe-antwortart"'), 'Schwierigkeit zuerst');
  for (const name of ['leicht', 'normal', 'schwer']) assert.ok(html.includes(`data-einstellung="schwierigkeit" data-wert="${name}"`), name);
  // Ohne eigene Zeiten ist die Zeile zum Zurücksetzen verborgen
  assert.ok(/<p class="zeiten-eigen" data-zeiten-eigen hidden>/.test(html));
  assert.ok(html.includes('data-zeiten-zuruecksetzen>Zeiten nach Schwierigkeit</button>'));
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

test('Einstellungsseite: eigene Zeiten sichtbar mit Knopf zum Zurücksetzen', () => {
  const werte = einstellungSetzen(einstellungSetzen(einstellungenLesen(null), 'schwierigkeit', 'schwer'), 'antwortzeit', 20);
  const html = blitzInhalt(['einstellungen'], {}, werte).inhalt;
  assert.ok(html.includes('<p class="zeiten-eigen" data-zeiten-eigen><span data-zeiten-text>Selbst gewählt: Antwortzeit, sie bleibt bei jeder Schwierigkeit.</span>'));
  assert.ok(/data-einstellung="schwierigkeit" data-wert="schwer" aria-pressed="true"/.test(html));
  assert.ok(/data-einstellung="anzeigezeit" data-wert="3" aria-pressed="true"/.test(html));
  assert.ok(/data-einstellung="antwortzeit" data-wert="20" aria-pressed="true"/.test(html));
  assert.equal(eigeneZeitenText(einstellungSetzen(werte, 'anzeigezeit', 8)), 'Selbst gewählt: Anzeigezeit und Antwortzeit, sie bleiben bei jeder Schwierigkeit.');
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

test('Prüfmodus: Schwierigkeit über die Adresse, mit ihren Zeiten und Wertebereichen', () => {
  const leicht = ansichtFuer('#/blitzrechnen/kopfrechnen?probe=aufgabe&art=kursPlusZahl&schwierigkeit=leicht');
  const m = leicht.match(/<p class="aufgabe-text">(\d{3}) [+−] (\d+)<\/p>/);
  assert.ok(m && Number(m[2]) % 5 === 0 && Number(m[2]) >= 20 && Number(m[2]) <= 250, 'leicht in Fünferschritten bis 250');
  assert.ok(/<span style="animation-duration: 15s/.test(leicht), 'Antwortzeit 15 s bei leicht');
  const schwer = ansichtFuer('#/blitzrechnen/kopfrechnen?probe=aufgabe&art=anlKurs&schwierigkeit=schwer');
  assert.ok(/<p class="aufgabe-text lang">anl\. Kurs \d{3} \+\d×\d{2}<\/p>/.test(schwer), 'anl. Kurs mit Produkt');
  assert.ok(/<span style="animation-duration: 8s/.test(schwer), 'Antwortzeit 8 s bei schwer');
  assert.ok(/GK von [A-Z]{2,3} [+−]\d+°/.test(ansichtFuer('#/blitzrechnen/kopfrechnen?probe=aufgabe&art=gkRichtung&schwierigkeit=schwer')));
  const stufe3 = ansichtFuer('#/blitzrechnen/stufe3?probe=anzeige&art=kurve&schwierigkeit=schwer');
  assert.ok(/<span style="animation-duration: 3s/.test(stufe3), 'Anzeigezeit 3 s bei schwer');
  const winkel = Number(stufe3.match(/<tspan x="0" dy="0">(\d{2,3})<\/tspan>/)[1]);
  assert.ok(winkel % 2 === 1 && winkel > 150 && winkel < 350, `Kurve ${winkel}`);
  // Unbekannte Schwierigkeit: die gespeicherte (ohne Speicher normal)
  assert.ok(/<span style="animation-duration: 10s/.test(ansichtFuer('#/blitzrechnen/kopfrechnen?probe=aufgabe&schwierigkeit=mittel')));
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
  // Stufe 2 mit Gradzahl-Kurve: nackter Winkel im Bild, gefragt ist der Kurs danach
  const kurve = ansichtFuer('#/blitzrechnen/stufe2?probe=ausgeblendet&art=kurve');
  assert.ok(kurve.includes('Kurs nach der Kurve') && kurve.includes('inputmode="numeric"'));
  assert.ok(/<tspan x="0" dy="0">\d{2,3}<\/tspan>/.test(ansichtFuer('#/blitzrechnen/stufe2?probe=anzeige&art=kurve')), 'Gradzahl an der Kurve');
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
