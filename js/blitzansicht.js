// Ansichten des Blitzrechnens als HTML-Zeichenketten, ohne DOM: Auswahlseite,
// Einstellungen, Übungsseiten und die Bühne einer laufenden Übung in jedem
// Zustand. Die Abläufe mit Zeit und Ton steuert blitzlauf.js im Browser; hier
// entstehen nur die Zustände, deshalb lassen sie sich ohne Browser prüfen.
// Prüfmodus: Eine Übungsadresse mit "?probe=..." zeigt einen Zustand direkt
// und mit angehaltenem Zeitbalken, etwa für Bildschirmfotos:
//   #/blitzrechnen/kopfrechnen?probe=aufgabe|ergebnis|loesung
//   #/blitzrechnen/stufe2?probe=anzeige|ausgeblendet|loesung
// dazu wahlweise art=<Aufgabenart>, saat=<Text>, frage=<Nummer ab 0>,
// antwort=eintippen|aufloesung, stellung=geschrieben|ton|beides.

import { EINSTELLUNGEN, einstellungenLesen, einstellungenKurz } from './blitzeinstellungen.js';
import { KOPF_ARTEN, erzeugeKopfaufgabe } from './kopfrechnen.js';
import { AUSSCHNITT_ARTEN, erzeugeAusschnitt, zeichneAusschnitt } from './ausschnitt.js';
import { frageRichtig, loesungText, eingabeText, kursAnzeige, richtungName } from './antwort.js';
import { kursText, normieren } from './kurs.js';
import { Zufall } from './zufall.js';

export const BEREICHE = {
  kopfrechnen: {
    titel: 'Kopfrechnen mit Kursen',
    ort: 'Kopfrechnen',
    karte: 'Kurs plus oder minus eine Zahl, Gegenkurs, Himmelsrichtungen in Grad und umgekehrt, geschrieben oder per Ton',
    text: 'Kurs plus oder minus eine Zahl, Gegenkurs, Himmelsrichtung in Grad, nächste Himmelsrichtung und GK plus oder minus, gemischt und ohne Ende.',
  },
  stufe2: {
    titel: 'Blitzrechnen Stufe 2',
    ort: 'Stufe 2',
    stufe: 2,
    karte: 'Ein Ausschnitt wie auf dem Blatt, kurz zu sehen, dann aus dem Gedächtnis rechnen',
    text: 'Ein Ausschnitt wie auf dem Blatt erscheint kurz, dann rechnest du aus dem Gedächtnis: Kurs nach einer Ecke oder einer Gradzahl-Kurve, Rechenaufgabe, Himmelsrichtung in Grad oder die Kurse eines Gates.',
  },
  stufe3: {
    titel: 'Blitzrechnen Stufe 3',
    ort: 'Stufe 3',
    stufe: 3,
    karte: 'Dazu HR, GK, Gates in drei Formen und anl. Kurs',
    text: 'Wie Stufe 2, dazu HR, GK, Gates in drei Formen mit dem Drehsinn zum nächsten Kurs und anl. Kurs.',
  },
};

// Ein Ausschnitt erscheint doppelt so groß wie seine Einheiten, höchstens so breit wie der Platz
const AUSSCHNITT_MASSSTAB = 2;

function html(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ------------------------------------------------------------ Seiten

function auswahlseite(einstellungen) {
  const karten = Object.entries(BEREICHE)
    .map(([name, b]) => `<a class="karte" href="#/blitzrechnen/${name}"><span class="karte-titel">${b.titel}</span><span class="karte-text">${b.karte}</span></a>`)
    .join('\n');
  return `<main class="rahmen blitzauswahl">
<h1 class="titel">Blitzrechnen</h1>
<p class="unterzeile">Kurze Aufgaben nacheinander und ohne Ende. Gezählt wird nur, solange eine Übung läuft.</p>
<nav class="bereiche" aria-label="Bereiche">
${karten}
</nav>
<div class="einstellungszeile"><a class="knopf" href="#/blitzrechnen/einstellungen">Einstellungen</a><p class="einstellungen-kurz">${einstellungenKurz(einstellungen)}</p></div>
</main>`;
}

function einstellungsseite(einstellungen) {
  const gruppen = Object.entries(EINSTELLUNGEN).map(([name, g]) => {
    const knoepfe = g.werte
      .map((wert) => `<button type="button" class="knopf" data-einstellung="${name}" data-wert="${wert}" aria-pressed="${einstellungen[name] === wert}">${g.namen[wert]}</button>`)
      .join('');
    return `<section class="gruppe"><h2 class="gruppe-titel" id="gruppe-${name}">${g.titel}</h2>`
      + `<div class="wahl" role="group" aria-labelledby="gruppe-${name}">${knoepfe}</div>`
      + `<p class="gruppe-text">${g.text}</p></section>`;
  }).join('\n');
  return `<main class="rahmen einstellungsseite" data-einstellungen>
<h1 class="titel">Einstellungen</h1>
<p class="unterzeile">Gelten für alle drei Bereiche und bleiben nur auf diesem Gerät gespeichert.</p>
<div class="gruppen">
${gruppen}
</div>
<p class="meldung" data-meldung aria-live="polite"></p>
<p><a class="knopf haupt" href="#/blitzrechnen">Fertig</a></p>
</main>`;
}

function uebungsseite(name, abfrage, einstellungen) {
  const b = BEREICHE[name];
  const probe = abfrage.probe ? probeBuehne(name, abfrage, einstellungen) : null;
  const probeMarke = probe ? ` data-probe="${html(abfrage.probe)}"` : '';
  return `<main class="rahmen blitzseite${probe ? ' laeuft' : ''}" data-blitz="${name}"${probeMarke}>
<div class="blitz-kopf"><h1 class="titel">${b.titel}</h1><p class="unterzeile">${b.text}</p></div>
<div class="buehne">${probe || startBuehne(name, einstellungen)}</div>
</main>`;
}

// Inhalt einer Adresse unter #/blitzrechnen: { ort, zurueck, inhalt } für die
// Kopfleiste und den Hauptteil, null für eine unbekannte Adresse. "teile" sind
// die Teile des Pfads nach "blitzrechnen", "abfrage" die Werte nach dem "?".
export function blitzInhalt(teile, abfrage = {}, einstellungen = einstellungenLesen()) {
  if (teile.length === 0) return { ort: 'Blitzrechnen', zurueck: '#/', inhalt: auswahlseite(einstellungen) };
  if (teile.length > 1) return null;
  if (teile[0] === 'einstellungen') return { ort: 'Blitzrechnen, Einstellungen', zurueck: '#/blitzrechnen', inhalt: einstellungsseite(einstellungen) };
  if (Object.hasOwn(BEREICHE, teile[0])) {
    return { ort: `Blitzrechnen, ${BEREICHE[teile[0]].ort}`, zurueck: '#/blitzrechnen', inhalt: uebungsseite(teile[0], abfrage, einstellungen) };
  }
  return null;
}

// ------------------------------------------------------------ Bausteine der Bühne

export function startBuehne(name, einstellungen) {
  return `<div class="startflaeche">
<button type="button" class="knopf haupt gross" data-aktion="start">Start</button>
<p class="einstellungen-kurz">${einstellungenKurz(einstellungen, name)}. <a href="#/blitzrechnen/einstellungen">Einstellungen ändern</a></p>
</div>`;
}

export function zaehlerLeiste(stand) {
  return `<div class="zaehlerleiste"><span class="zaehler"><strong>${stand.richtig}</strong> / ${stand.gesamt} richtig</span>`
    + `<span class="serie">Serie ${stand.serie}</span>`
    + '<button type="button" class="knopf" data-aktion="beenden">Beenden</button></div>';
}

// Schmaler Balken, der über "sekunden" abläuft. Ohne "laeuft" steht er voll und
// wartet (Ton wird noch abgespielt), "angehalten" hält ihn bei 60 Prozent fest
// (Prüfmodus). Ohne Sekunden ein leerer Platzhalter gleicher Höhe.
function zeitbalken(sekunden, zustand = {}) {
  if (!sekunden) return '<div class="zeitbalken leer" aria-hidden="true"></div>';
  const laeuft = zustand.zeitLaeuft !== false;
  const klasse = `zeitbalken${laeuft ? ' laeuft' : ''}${zustand.angehalten ? ' angehalten' : ''}`;
  const verzoegerung = zustand.angehalten ? `; animation-delay: -${Number((sekunden * 0.4).toFixed(2))}s` : '';
  return `<div class="${klasse}" aria-hidden="true" data-sekunden="${sekunden}"><span style="animation-duration: ${sekunden}s${verzoegerung}"></span></div>`;
}

function richtungsKnoepfe() {
  const knoepfe = Array.from({ length: 16 }, (_, i) => `<button type="button" class="knopf richtung" data-aktion="richtung" data-wert="${i}">${richtungName(i)}</button>`);
  return `<div class="richtungen" role="group" aria-label="Himmelsrichtungen">${knoepfe.join('')}</div>`;
}

function drehsinnKnoepfe() {
  return '<div class="drehsinn" role="group" aria-label="Drehsinn">'
    + '<button type="button" class="knopf" data-aktion="drehsinn" data-wert="links">links</button>'
    + '<button type="button" class="knopf" data-aktion="drehsinn" data-wert="rechts">rechts</button></div>';
}

// Eingabe für einen Kurs: nur Ziffern (Komma für halbe Grade geht auch), Enter prüft
function kursFeld(beschriftung) {
  return `<form class="antwortform" data-aktion="pruefen" novalidate>
<label class="feldname" for="antwort">${beschriftung}</label>
<div class="feldzeile"><input id="antwort" class="eingabe" name="antwort" type="text" inputmode="numeric" maxlength="5" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><button type="submit" class="knopf haupt">Prüfen</button></div>
</form>`;
}

function frageEingabe(frage, beschriftung) {
  if (frage.antwort === 'richtung') return `<p class="feldname">${beschriftung}</p>${richtungsKnoepfe()}`;
  if (frage.antwort === 'drehsinn') return `<p class="feldname">${beschriftung}</p>${drehsinnKnoepfe()}`;
  return kursFeld(beschriftung);
}

function selbstKnoepfe(markiert) {
  const knopf = (wert, text) => `<button type="button" class="knopf" data-aktion="hatte" data-wert="${wert}" aria-pressed="${markiert === wert}"${markiert ? ' disabled' : ''}>${text}</button>`;
  return `<div class="selbst" role="group" aria-label="Selbst zählen">${knopf('ja', 'Hatte ich')}${knopf('nein', 'Hatte ich nicht')}</div>`;
}

const WEITER = '<button type="button" class="knopf haupt" data-aktion="weiter">Weiter</button>';

function urteil(richtig, text) {
  return `<p class="urteil ${richtig ? 'richtig' : 'falsch'}" role="status">${text}</p>`;
}

// ------------------------------------------------------------ Kopfrechnen

// Zustände: "aufgabe" ({ zeitLaeuft, tonHinweis }), "ergebnis" beim Eintippen
// ({ eingabe, richtig, zeitAbgelaufen }), "aufloesung" ({ markiert: null, "ja", "nein" })
export function kopfBuehne(aufgabe, einstellungen, zustand, stand) {
  const mitText = einstellungen.aufgabenstellung !== 'ton';
  const mitTon = einstellungen.aufgabenstellung !== 'geschrieben';
  const teile = [];
  if (zustand.phase === 'aufgabe') {
    // Lange Texte ("Nächste Himmelsrichtung zu 111") etwas kleiner, damit sie auf dem Handy nicht dreizeilig werden
    if (mitText) teile.push(`<p class="aufgabe-text${aufgabe.text.length > 14 ? ' lang' : ''}">${aufgabe.text}</p>`);
    if (mitTon) {
      teile.push(`<div class="tonzeile">${mitText ? '' : '<p class="aufgabe-ton">Aufgabe per Ton</p>'}<button type="button" class="knopf" data-aktion="nochmal">Nochmal hören</button></div>`);
    }
    if (zustand.tonHinweis) teile.push(`<p class="hinweis">${zustand.tonHinweis}</p>`);
    if (einstellungen.antwortart === 'aufloesung') {
      teile.push(`<p class="phase-text">Im Kopf rechnen. Die Lösung erscheint nach ${einstellungen.antwortzeit} s.</p>`);
    } else if (aufgabe.antwort === 'richtung') {
      teile.push(`<p class="feldname">Nächste Himmelsrichtung</p>${richtungsKnoepfe()}`);
    } else {
      teile.push(kursFeld('Antwort in Grad'));
    }
  } else if (zustand.phase === 'ergebnis') {
    teile.push(`<p class="aufgabe-text klein">${aufgabe.text}</p>`);
    teile.push(urteil(zustand.richtig, zustand.richtig ? 'Richtig' : zustand.zeitAbgelaufen ? 'Zeit abgelaufen' : 'Falsch'));
    const deine = zustand.eingabe === null || zustand.eingabe === undefined ? '' : `, deine Antwort ${html(eingabeText(aufgabe, zustand.eingabe))}`;
    teile.push(`<p class="loesung-zeile">Lösung <strong>${loesungText(aufgabe)}</strong>${deine}</p>`, WEITER);
  } else {
    teile.push(`<p class="aufgabe-text klein">${aufgabe.text}</p>`);
    teile.push(`<p class="loesung-zeile">Lösung <strong>${loesungText(aufgabe)}</strong></p>`, selbstKnoepfe(zustand.markiert), WEITER);
  }
  const sekunden = zustand.phase === 'aufgabe' ? einstellungen.antwortzeit : 0;
  return `<div class="blitz-aufgabe">${zaehlerLeiste(stand)}${zeitbalken(sekunden, zustand)}<div class="kopfaufgabe">${teile.join('\n')}</div></div>`;
}

// ------------------------------------------------------------ Ausschnitte

function ausschnittFigur(a, ausgeblendet) {
  const svg = zeichneAusschnitt(a);
  const breite = Number(svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) /)[1]);
  const abdeckung = ausgeblendet ? '\n<div class="abdeckung"><span>Ausschnitt ausgeblendet</span></div>' : '';
  return `<figure class="ausschnitt${ausgeblendet ? ' ausgeblendet' : ''}">
<figcaption class="ankunft">Ankunft auf Kurs ${kursText(a.ankunft)}</figcaption>
<div class="ausschnitt-bild" style="max-width: ${Math.round(breite * AUSSCHNITT_MASSSTAB)}px">${svg}</div>${abdeckung}
</figure>`;
}

// Zustände: "anzeige", "ausgeblendet" ({ frage, antworten } beim Eintippen,
// die Fragen nacheinander; bei der Auflösung alle Fragen zugleich), "loesung"
// ({ antworten, markiert })
export function ausschnittBuehne(a, einstellungen, zustand, stand) {
  const aufloesung = einstellungen.antwortart === 'aufloesung';
  const { fragen } = a;
  let sekunden = 0;
  let seite;
  if (zustand.phase === 'anzeige') {
    sekunden = einstellungen.anzeigezeit;
    seite = `<p class="phase">Einprägen</p><p class="phase-text">Der Ausschnitt verschwindet nach ${sekunden} s.</p>`;
  } else if (zustand.phase === 'ausgeblendet' && aufloesung) {
    sekunden = einstellungen.antwortzeit * fragen.length;
    seite = `<p class="phase">Im Kopf rechnen</p><ol class="fragenliste">${fragen.map((f) => `<li>${f.text}</li>`).join('')}</ol>`
      + `<p class="phase-text">Die Lösung erscheint nach ${sekunden} s.</p>`;
  } else if (zustand.phase === 'ausgeblendet') {
    sekunden = einstellungen.antwortzeit;
    const j = zustand.frage;
    const erledigt = zustand.antworten.length
      ? `<ol class="erledigt">${zustand.antworten.map((r, k) => `<li><span class="frage-text">${fragen[k].text}</span> <span class="wert">${html(eingabeText(fragen[k], r.eingabe))}</span></li>`).join('')}</ol>`
      : '';
    seite = `<p class="phase">Frage ${j + 1} von ${fragen.length}</p>${erledigt}${frageEingabe(fragen[j], fragen[j].text)}`;
  } else {
    const zeilen = fragen.map((f, k) => {
      const r = zustand.antworten[k];
      const klasse = aufloesung ? 'offen' : r && r.richtig ? 'richtig' : 'falsch';
      // Richtig oder falsch auch als Wort, nicht nur als Farbe
      const deine = aufloesung ? '' : `<span class="deine">deine: ${html(eingabeText(f, r ? r.eingabe : null))}, ${klasse}</span>`;
      return `<li class="${klasse}"><span class="frage-text">${f.text}</span><span class="loesung-wert">${loesungText(f)}</span>${deine}</li>`;
    });
    let abschluss;
    if (aufloesung) abschluss = selbstKnoepfe(zustand.markiert);
    else {
      const anzahl = zustand.antworten.filter((r) => r.richtig).length;
      const alle = anzahl === fragen.length;
      abschluss = urteil(alle, fragen.length === 1 ? (alle ? 'Richtig' : 'Falsch') : alle ? 'Alles richtig' : `${anzahl} von ${fragen.length} richtig`);
    }
    seite = `<p class="phase">Lösung</p><ol class="loesungen">${zeilen.join('')}</ol>${abschluss}${WEITER}`;
  }
  return `<div class="blitz-aufgabe">${zaehlerLeiste(stand)}${zeitbalken(sekunden, zustand)}`
    + `<div class="ausschnitt-flaeche">${ausschnittFigur(a, zustand.phase === 'ausgeblendet')}<div class="ausschnitt-seite">${seite}</div></div></div>`;
}

// ------------------------------------------------------------ Prüfmodus

// Eine Eingabe, die richtig oder falsch ist, für die Bilder der Lösung
function probeEingabe(frage, richtig) {
  if (frage.antwort === 'kurs') return kursAnzeige(richtig ? frage.loesung : normieren(frage.loesung + 10));
  if (frage.antwort === 'richtung') return richtig ? frage.loesung : (frage.loesung + 1) % 16;
  if (richtig) return frage.loesung;
  return frage.loesung === 'links' ? 'rechts' : 'links';
}

function probeBuehne(name, abfrage, einstellungen) {
  const e = { ...einstellungen };
  if (EINSTELLUNGEN.antwortart.werte.includes(abfrage.antwort)) e.antwortart = abfrage.antwort;
  if (EINSTELLUNGEN.aufgabenstellung.werte.includes(abfrage.stellung)) e.aufgabenstellung = abfrage.stellung;
  const zufall = new Zufall(`probe/${name}/${abfrage.saat || 1}`);
  const leer = { richtig: 0, gesamt: 0, serie: 0 };
  if (name === 'kopfrechnen') {
    const aufgabe = erzeugeKopfaufgabe(zufall, KOPF_ARTEN.includes(abfrage.art) ? abfrage.art : null);
    if (abfrage.probe === 'aufgabe') return kopfBuehne(aufgabe, e, { phase: 'aufgabe', angehalten: true }, leer);
    if (abfrage.probe === 'ergebnis') {
      const eingabe = abfrage.eingabe ?? probeEingabe(aufgabe, true);
      const richtig = frageRichtig(aufgabe, eingabe);
      return kopfBuehne(aufgabe, e, { phase: 'ergebnis', eingabe, richtig }, { richtig: richtig ? 1 : 0, gesamt: 1, serie: richtig ? 1 : 0 });
    }
    if (abfrage.probe === 'loesung') return kopfBuehne(aufgabe, { ...e, antwortart: 'aufloesung' }, { phase: 'aufloesung', markiert: null }, leer);
    return null;
  }
  const { stufe } = BEREICHE[name];
  const a = erzeugeAusschnitt(zufall, stufe, AUSSCHNITT_ARTEN[stufe].includes(abfrage.art) ? abfrage.art : null);
  if (abfrage.probe === 'anzeige') return ausschnittBuehne(a, e, { phase: 'anzeige', angehalten: true }, leer);
  if (abfrage.probe === 'ausgeblendet') {
    const frage = Math.max(0, Math.min(Number(abfrage.frage) || 0, a.fragen.length - 1));
    const antworten = a.fragen.slice(0, frage).map((f) => ({ eingabe: probeEingabe(f, true), richtig: true }));
    return ausschnittBuehne(a, e, { phase: 'ausgeblendet', frage, antworten, angehalten: true }, leer);
  }
  if (abfrage.probe === 'loesung') {
    // Abwechselnd richtig und falsch, damit beide Markierungen zu sehen sind
    const antworten = a.fragen.map((f, k) => {
      const eingabe = probeEingabe(f, k % 2 === 0);
      return { eingabe, richtig: frageRichtig(f, eingabe) };
    });
    const alle = e.antwortart === 'eintippen' && antworten.every((r) => r.richtig);
    const stand = e.antwortart === 'eintippen' ? { richtig: alle ? 1 : 0, gesamt: 1, serie: alle ? 1 : 0 } : leer;
    return ausschnittBuehne(a, e, { phase: 'loesung', antworten, markiert: null }, stand);
  }
  return null;
}
