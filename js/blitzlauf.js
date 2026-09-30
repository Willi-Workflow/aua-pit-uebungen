// Ablauf des Blitzrechnens im Browser: Zeitgeber, Ton, Eingaben und das
// Speichern der Einstellungen. Die Bühne kommt in jedem Zustand fertig aus
// blitzansicht.js, hier wird nur gewechselt. Im Prüfmodus (data-probe) läuft
// nichts, der Zustand steht still.
//
// Kopfrechnen: Aufgabe, Antwortzeit, Ergebnis (Eintippen) oder Lösung mit
// Selbstzählung (Auflösung), dann Weiter. Per Ton beginnt die Antwortzeit erst,
// wenn die Tonfolge zu Ende ist.
// Ausschnitte: Schritte aus ausschnittAblauf. Zuerst der Ankunftskurs mit der
// Kursanzeige für die Anzeigezeit (Klick, Tippen oder Leertaste beenden das
// früher), dann der Ausschnitt für die Anzeigezeit, dann ausgeblendet; beim
// Eintippen die Fragen nacheinander mit je eigener Antwortzeit, bei der
// Auflösung alle zugleich mit der Antwortzeit je Frage; dann der Ausschnitt mit
// den Lösungen daneben.

import {
  EINSTELLUNGEN, einstellungenLesen, einstellungenSchreiben, einstellungSetzen, zeitenZuruecksetzen,
} from './blitzeinstellungen.js';
import { erzeugeKopfaufgabe, klangPfad } from './kopfrechnen.js';
import { erzeugeAusschnitt } from './ausschnitt.js';
import { frageRichtig } from './antwort.js';
import {
  BEREICHE, kopfBuehne, ausschnittBuehne, ausschnittAblauf, eigeneZeitenText,
} from './blitzansicht.js';
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

// Ein Klick setzt einen Wert. Eine neue Schwierigkeit bringt ihre Zeiten mit,
// solange keine eigenen gewählt sind; deshalb werden danach alle Knöpfe neu
// markiert, nicht nur die der geklickten Gruppe.
function einstellungenBedienen(seite) {
  let werte = einstellungenLesen();
  const meldung = seite.querySelector('[data-meldung]');
  const markieren = () => {
    for (const k of seite.querySelectorAll('[data-einstellung]')) {
      k.setAttribute('aria-pressed', String(String(werte[k.dataset.einstellung]) === k.dataset.wert));
    }
    const zeile = seite.querySelector('[data-zeiten-eigen]');
    if (zeile) {
      zeile.hidden = werte.eigeneZeiten.length === 0;
      zeile.querySelector('[data-zeiten-text]').textContent = eigeneZeitenText(werte);
    }
  };
  const speichern = () => {
    meldung.textContent = einstellungenSchreiben(werte)
      ? 'Gespeichert.'
      : 'Der Browser lässt kein Speichern zu, es gelten weiter die Vorgaben.';
  };
  const klick = (ereignis) => {
    if (ereignis.target.closest('[data-zeiten-zuruecksetzen]')) {
      werte = zeitenZuruecksetzen(werte);
    } else {
      const knopf = ereignis.target.closest('[data-einstellung]');
      if (!knopf) return;
      const name = knopf.dataset.einstellung;
      const wert = EINSTELLUNGEN[name].werte.find((w) => String(w) === knopf.dataset.wert);
      if (wert === undefined) return;
      werte = einstellungSetzen(werte, name, wert);
    }
    markieren();
    speichern();
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
    ablauf: [],
    schritt: 0,
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
    z.aufgabe = erzeugeKopfaufgabe(z.zufall, null, z.einstellungen.schwierigkeit);
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

  // Beginnt Schritt "nummer" des Ablaufs: Zustand setzen, zeigen, Zeit starten.
  // Die Antworten laufen von Frage zu Frage mit; die Lösung zählt beim Eintippen
  // den Ausschnitt als richtig, wenn alle Fragen richtig sind.
  function schrittBeginnen(nummer) {
    zeitStoppen();
    const schritt = z.ablauf[nummer];
    const antworten = nummer === 0 ? [] : z.zustand.antworten || [];
    z.schritt = nummer;
    if (schritt.phase === 'loesung') {
      if (z.einstellungen.antwortart === 'eintippen') zaehlen(antworten.length > 0 && antworten.every((r) => r.richtig));
      z.zustand = { phase: 'loesung', antworten, markiert: null };
    } else {
      z.zustand = { phase: schritt.phase, frage: schritt.frage ?? null, antworten };
    }
    zeigen();
    if (schritt.sekunden) nach(schritt.sekunden, schrittAbgelaufen);
  }

  const schrittWeiter = () => schrittBeginnen(z.schritt + 1);

  // Läuft die Zeit einer Frage beim Eintippen ab, zählt sie ohne Antwort
  function schrittAbgelaufen() {
    if (z.zustand.phase === 'ausgeblendet' && z.zustand.frage !== null) frageBeantwortet(null);
    else schrittWeiter();
  }

  function frageBeantwortet(eingabe) {
    if (z.zustand.phase !== 'ausgeblendet' || z.zustand.frage === null) return;
    const frage = z.aufgabe.fragen[z.zustand.frage];
    z.zustand.antworten.push({ eingabe, richtig: frageRichtig(frage, eingabe) });
    schrittWeiter();
  }

  // Klick, Tippen oder Leertaste während der Ankunft: gleich zum Ausschnitt
  function ankunftBeenden() {
    if (z.zustand && z.zustand.phase === 'ankunft') schrittWeiter();
  }

  function ausschnittNaechste() {
    z.aufgabe = erzeugeAusschnitt(z.zufall, bereich.stufe, null, z.einstellungen.schwierigkeit);
    z.ablauf = ausschnittAblauf(z.aufgabe, z.einstellungen);
    schrittBeginnen(0);
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
    if (!knopf || !seite.contains(knopf)) {
      // Ein Klick oder Tippen irgendwo auf die Übung beendet die Ankunft, nur
      // nicht auf einem Link, Knopf oder Feld
      if (!ereignis.target.closest('a, button, input')) ankunftBeenden();
      return;
    }
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
  // Knopf löst Enter ihn selbst aus. Die Leertaste beendet ebenso die Ankunft,
  // gehaltene Tasten zählen nur einmal.
  function taste(ereignis) {
    if (!z.aktiv) return;
    const ziel = ereignis.target;
    if (ziel && ziel.closest && ziel.closest('input, button, a, textarea, select')) return;
    if (ereignis.key === ' ' && z.zustand && z.zustand.phase === 'ankunft') {
      ereignis.preventDefault();
      if (!ereignis.repeat) ankunftBeenden();
      return;
    }
    if (ereignis.key !== 'Enter') return;
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
