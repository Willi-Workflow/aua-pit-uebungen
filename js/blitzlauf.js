// Ablauf des Blitzrechnens im Browser: Zeitgeber, Ton, Eingaben und das
// Speichern der Einstellungen. Die Bühne kommt in jedem Zustand fertig aus
// blitzansicht.js, hier wird nur gewechselt. Im Prüfmodus (data-probe) läuft
// nichts, der Zustand steht still.
//
// Kopfrechnen: Aufgabe, Antwortzeit, Ergebnis (Eintippen) oder Lösung mit
// Selbstzählung (Auflösung), dann Weiter. Per Ton beginnt die Antwortzeit erst,
// wenn die Tonfolge zu Ende ist.
// Ausschnitte: Anzeigezeit, dann ausgeblendet; beim Eintippen die Fragen
// nacheinander mit je eigener Antwortzeit, bei der Auflösung alle zugleich mit
// der Antwortzeit je Frage; dann der Ausschnitt mit den Lösungen daneben.

import { EINSTELLUNGEN, einstellungenLesen, einstellungenSchreiben } from './blitzeinstellungen.js';
import { erzeugeKopfaufgabe, klangPfad } from './kopfrechnen.js';
import { erzeugeAusschnitt } from './ausschnitt.js';
import { frageRichtig } from './antwort.js';
import { BEREICHE, kopfBuehne, ausschnittBuehne } from './blitzansicht.js';
import { Zufall } from './zufall.js';

// Pause zwischen zwei Tonschnipseln in Millisekunden
export const TONPAUSE = 120;

// Startet, was die gezeigte Seite braucht, und liefert eine Funktion, die es
// wieder beendet
export function blitzLaufen(wurzel) {
  const einstellungsseite = wurzel.querySelector('[data-einstellungen]');
  if (einstellungsseite) return einstellungenBedienen(einstellungsseite);
  const seite = wurzel.querySelector('[data-blitz]');
  if (!seite || seite.hasAttribute('data-probe')) return () => {};
  return uebungLaufen(seite);
}

function einstellungenBedienen(seite) {
  const werte = einstellungenLesen();
  const meldung = seite.querySelector('[data-meldung]');
  const klick = (ereignis) => {
    const knopf = ereignis.target.closest('[data-einstellung]');
    if (!knopf) return;
    const name = knopf.dataset.einstellung;
    const wert = EINSTELLUNGEN[name].werte.find((w) => String(w) === knopf.dataset.wert);
    if (wert === undefined) return;
    werte[name] = wert;
    for (const k of seite.querySelectorAll(`[data-einstellung="${name}"]`)) k.setAttribute('aria-pressed', String(k === knopf));
    meldung.textContent = einstellungenSchreiben(werte)
      ? 'Gespeichert.'
      : 'Der Browser lässt kein Speichern zu, es gelten weiter die Vorgaben.';
  };
  seite.addEventListener('click', klick);
  return () => seite.removeEventListener('click', klick);
}

function warten(ms) {
  return new Promise((weiter) => setTimeout(weiter, ms));
}

function uebungLaufen(seite) {
  const name = seite.dataset.blitz;
  const bereich = BEREICHE[name];
  const buehne = seite.querySelector('.buehne');
  const z = {
    einstellungen: einstellungenLesen(),
    zufall: null,
    stand: { richtig: 0, gesamt: 0, serie: 0 },
    aufgabe: null,
    zustand: null,
    zeitgeber: null,
    tonNummer: 0,
    klaenge: [],
    tonAbbruch: null,
    aktiv: true,
  };

  // ---------------------------------------------------------- Anzeige

  const fokussieren = () => {
    const feld = buehne.querySelector('input.eingabe');
    if (feld) {
      feld.focus();
      return;
    }
    const weiterKnopf = buehne.querySelector('[data-aktion="weiter"]');
    if (weiterKnopf) weiterKnopf.focus({ preventScroll: true });
  };

  const zeigen = () => {
    buehne.innerHTML = name === 'kopfrechnen'
      ? kopfBuehne(z.aufgabe, z.einstellungen, z.zustand, z.stand)
      : ausschnittBuehne(z.aufgabe, z.einstellungen, z.zustand, z.stand);
    fokussieren();
  };

  const zaehlen = (richtig) => {
    z.stand.gesamt += 1;
    if (richtig) {
      z.stand.richtig += 1;
      z.stand.serie += 1;
    } else {
      z.stand.serie = 0;
    }
  };

  // ---------------------------------------------------------- Zeit

  const zeitStoppen = () => {
    clearTimeout(z.zeitgeber);
    z.zeitgeber = null;
  };

  const nach = (sekunden, handlung) => {
    zeitStoppen();
    z.zeitgeber = setTimeout(() => {
      z.zeitgeber = null;
      if (z.aktiv) handlung();
    }, sekunden * 1000);
  };

  // ---------------------------------------------------------- Ton

  const tonStoppen = () => {
    z.tonNummer += 1;
    if (z.tonAbbruch) z.tonAbbruch();
    for (const klang of z.klaenge) klang.pause();
    z.klaenge = [];
  };

  const abspielen = (klang) => new Promise((fertig) => {
    let erledigt = false;
    const ende = (gut) => {
      if (erledigt) return;
      erledigt = true;
      z.tonAbbruch = null;
      fertig(gut);
    };
    z.tonAbbruch = () => ende(false);
    klang.addEventListener('ended', () => ende(true), { once: true });
    klang.addEventListener('error', () => ende(false), { once: true });
    const versprechen = klang.play();
    if (versprechen && versprechen.catch) versprechen.catch(() => ende(false));
  });

  const tonHinweis = (text) => {
    if (buehne.querySelector('.hinweis')) return;
    const absatz = document.createElement('p');
    absatz.className = 'hinweis';
    absatz.textContent = text;
    const zeile = buehne.querySelector('.tonzeile');
    if (zeile) zeile.after(absatz);
  };

  // Spielt die Tonfolge der Aufgabe; danach beginnt die Antwortzeit, falls sie
  // noch nicht läuft. Ein neuer Aufruf bricht einen laufenden ab.
  const tonSpielen = async () => {
    tonStoppen();
    const nummer = z.tonNummer;
    z.klaenge = z.aufgabe.tonfolge.map((schnipsel) => {
      const klang = new Audio(klangPfad(schnipsel));
      klang.preload = 'auto';
      return klang;
    });
    let gut = true;
    for (let i = 0; i < z.klaenge.length && gut; i++) {
      gut = await abspielen(z.klaenge[i]);
      if (nummer !== z.tonNummer) return;
      if (gut && i < z.klaenge.length - 1) await warten(TONPAUSE);
      if (nummer !== z.tonNummer) return;
    }
    if (!gut) tonHinweis('Der Ton ließ sich nicht abspielen.');
    if (z.zustand && z.zustand.phase === 'aufgabe' && !z.zustand.zeitLaeuft) kopfZeitStarten();
  };

  // ---------------------------------------------------------- Kopfrechnen

  function kopfZeitStarten() {
    z.zustand.zeitLaeuft = true;
    const balken = buehne.querySelector('.zeitbalken');
    if (balken) balken.classList.add('laeuft');
    nach(z.einstellungen.antwortzeit, kopfZeitAb);
  }

  function kopfZeitAb() {
    tonStoppen();
    if (z.einstellungen.antwortart === 'aufloesung') {
      z.zustand = { phase: 'aufloesung', markiert: null };
    } else {
      zaehlen(false);
      z.zustand = { phase: 'ergebnis', eingabe: null, richtig: false, zeitAbgelaufen: true };
    }
    zeigen();
  }

  function kopfNaechste() {
    tonStoppen();
    z.aufgabe = erzeugeKopfaufgabe(z.zufall);
    const mitTon = z.einstellungen.aufgabenstellung !== 'geschrieben';
    z.zustand = { phase: 'aufgabe', zeitLaeuft: !mitTon };
    zeigen();
    if (mitTon) tonSpielen();
    else nach(z.einstellungen.antwortzeit, kopfZeitAb);
  }

  function kopfAntwort(eingabe) {
    if (z.zustand.phase !== 'aufgabe' || z.einstellungen.antwortart !== 'eintippen') return;
    zeitStoppen();
    tonStoppen();
    const richtig = frageRichtig(z.aufgabe, eingabe);
    zaehlen(richtig);
    z.zustand = { phase: 'ergebnis', eingabe, richtig };
    zeigen();
  }

  // ---------------------------------------------------------- Ausschnitte

  function loesungZeigen() {
    zeitStoppen();
    const antworten = z.zustand.antworten || [];
    if (z.einstellungen.antwortart === 'eintippen') zaehlen(antworten.length > 0 && antworten.every((r) => r.richtig));
    z.zustand = { phase: 'loesung', antworten, markiert: null };
    zeigen();
  }

  function frageBeantwortet(eingabe) {
    if (z.zustand.phase !== 'ausgeblendet' || z.zustand.frage === null) return;
    const frage = z.aufgabe.fragen[z.zustand.frage];
    z.zustand.antworten.push({ eingabe, richtig: frageRichtig(frage, eingabe) });
    if (z.zustand.frage + 1 < z.aufgabe.fragen.length) {
      z.zustand.frage += 1;
      zeigen();
      nach(z.einstellungen.antwortzeit, () => frageBeantwortet(null));
    } else {
      loesungZeigen();
    }
  }

  function ausblenden() {
    if (z.einstellungen.antwortart === 'aufloesung') {
      z.zustand = { phase: 'ausgeblendet', frage: null, antworten: [] };
      zeigen();
      nach(z.einstellungen.antwortzeit * z.aufgabe.fragen.length, loesungZeigen);
    } else {
      z.zustand = { phase: 'ausgeblendet', frage: 0, antworten: [] };
      zeigen();
      nach(z.einstellungen.antwortzeit, () => frageBeantwortet(null));
    }
  }

  function ausschnittNaechste() {
    z.aufgabe = erzeugeAusschnitt(z.zufall, bereich.stufe);
    z.zustand = { phase: 'anzeige' };
    zeigen();
    nach(z.einstellungen.anzeigezeit, ausblenden);
  }

  // ---------------------------------------------------------- gemeinsam

  const naechste = () => (name === 'kopfrechnen' ? kopfNaechste() : ausschnittNaechste());

  const starten = () => {
    z.einstellungen = einstellungenLesen();
    // Frischer Zufall je Sitzung, danach bestimmt
    z.zufall = new Zufall(`blitz/${name}/${Date.now()}`);
    seite.classList.add('laeuft');
    naechste();
  };

  const weiter = () => {
    if (z.zustand && ['ergebnis', 'aufloesung', 'loesung'].includes(z.zustand.phase)) naechste();
  };

  const markieren = (wert) => {
    if (z.einstellungen.antwortart !== 'aufloesung' || !z.zustand || z.zustand.markiert) return;
    if (!['aufloesung', 'loesung'].includes(z.zustand.phase)) return;
    z.zustand.markiert = wert;
    zaehlen(wert === 'ja');
    zeigen();
  };

  const antworten = (eingabe) => (name === 'kopfrechnen' ? kopfAntwort(eingabe) : frageBeantwortet(eingabe));

  const beenden = () => {
    z.aktiv = false;
    zeitStoppen();
    tonStoppen();
    document.removeEventListener('keydown', taste);
  };

  // ---------------------------------------------------------- Ereignisse

  const klick = (ereignis) => {
    const knopf = ereignis.target.closest('[data-aktion]');
    if (!knopf || !seite.contains(knopf)) return;
    const { aktion, wert } = knopf.dataset;
    if (aktion === 'start') starten();
    else if (aktion === 'beenden') {
      beenden();
      window.location.hash = '#/blitzrechnen';
    } else if (aktion === 'weiter') weiter();
    else if (aktion === 'nochmal') tonSpielen();
    else if (aktion === 'richtung') antworten(Number(wert));
    else if (aktion === 'drehsinn') antworten(wert);
    else if (aktion === 'hatte') markieren(wert);
  };

  const absenden = (ereignis) => {
    const formular = ereignis.target.closest('form[data-aktion="pruefen"]');
    if (!formular) return;
    ereignis.preventDefault();
    const eingabe = formular.querySelector('input.eingabe').value.trim();
    if (eingabe) antworten(eingabe);
  };

  // Nur Ziffern, dazu Komma oder Punkt für halbe Grade
  const eingeben = (ereignis) => {
    const feld = ereignis.target;
    if (!feld.matches('input.eingabe')) return;
    const sauber = feld.value.replace(/[^0-9.,]/g, '');
    if (sauber !== feld.value) feld.value = sauber;
  };

  // Enter geht weiter, wenn gerade kein Feld oder Knopf den Fokus hat; auf einem
  // Knopf löst Enter ihn selbst aus
  function taste(ereignis) {
    if (ereignis.key !== 'Enter' || !z.aktiv) return;
    const ziel = ereignis.target;
    if (ziel && ziel.closest && ziel.closest('input, button, a, textarea, select')) return;
    if (z.zustand && ['ergebnis', 'aufloesung', 'loesung'].includes(z.zustand.phase)) {
      ereignis.preventDefault();
      weiter();
    }
  }

  seite.addEventListener('click', klick);
  seite.addEventListener('submit', absenden);
  seite.addEventListener('input', eingeben);
  document.addEventListener('keydown', taste);
  return beenden;
}
