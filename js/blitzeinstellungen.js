// Einstellungen des Blitzrechnens, nur auf dem Gerät gespeichert. Lesen und
// Schreiben vertragen einen fehlenden oder gesperrten Speicher: Dann gelten die
// Vorgaben, und Schreiben meldet false. Jeder Wert wird einzeln geprüft; was
// nicht zu seiner Gruppe gehört, fällt auf die Vorgabe zurück.
//
// Anzeige- und Antwortzeit folgen der Schwierigkeit (VORGABEZEITEN), bis Hannah
// eine davon selbst wählt; welche das sind, steht in "eigeneZeiten". Ein älterer
// Speicherstand ohne dieses Feld zählt eine Zeit als selbst gewählt, wenn sie von
// der früheren Vorgabe (5 s und 10 s) abweicht, denn damals wurden bei jedem
// Klick alle Werte gespeichert.

import { SCHWIERIGKEITEN, VORGABE_SCHWIERIGKEIT, VORGABEZEITEN } from './schwierigkeit.js';

export const EINSTELLUNGEN_SCHLUESSEL = 'blitzrechnen.einstellungen';

// Je Gruppe die Auswahl, die Vorgabe und die Namen der Knöpfe. Die Vorgabe der
// Zeiten ist die der Schwierigkeit normal.
export const EINSTELLUNGEN = {
  schwierigkeit: {
    titel: 'Schwierigkeit',
    text: 'Normal wie auf den Vorlagen. Leicht: beliebige Kurse, Zahlen bis 280, etwa ein Drittel davon in Fünferschritten, etwa jede dritte Aufgabe über 360 hinaus. Schwer: krumme Zahlen, öfter über 360, halbe Grade und Aufgaben in zwei Schritten wie GK von SSW −37° oder anl. Kurs +9×13.',
    werte: SCHWIERIGKEITEN,
    vorgabe: VORGABE_SCHWIERIGKEIT,
    namen: { leicht: 'leicht', normal: 'normal', schwer: 'schwer' },
  },
  antwortart: {
    titel: 'Antwortart',
    text: 'Beim Eintippen prüft die App jede Antwort sofort. Bei der Auflösung rechnest du nur im Kopf, die Lösung erscheint nach der Antwortzeit, und du zählst selbst.',
    werte: ['eintippen', 'aufloesung'],
    vorgabe: 'eintippen',
    namen: { eintippen: 'Eintippen mit Prüfung', aufloesung: 'Auflösung ohne Tippen' },
  },
  anzeigezeit: {
    titel: 'Anzeigezeit des Ausschnitts',
    text: 'So lange steht in Stufe 2 und 3 erst der Ankunftskurs da, dann der Ausschnitt. Ohne eigene Wahl leicht 8 s, normal 5 s, schwer 3 s.',
    werte: [3, 5, 8],
    vorgabe: VORGABEZEITEN[VORGABE_SCHWIERIGKEIT].anzeigezeit,
    namen: { 3: '3 s', 5: '5 s', 8: '8 s' },
  },
  antwortzeit: {
    titel: 'Antwortzeit',
    text: 'Zeit je Antwort, bei einem Gate für jede Zeile neu. Ohne eigene Wahl leicht 15 s, normal 10 s, schwer 8 s.',
    werte: [8, 10, 15, 20],
    vorgabe: VORGABEZEITEN[VORGABE_SCHWIERIGKEIT].antwortzeit,
    namen: { 8: '8 s', 10: '10 s', 15: '15 s', 20: '20 s' },
  },
  aufgabenstellung: {
    titel: 'Aufgabenstellung beim Kopfrechnen',
    text: 'Per Ton wird die Aufgabe angesagt und nicht angezeigt.',
    werte: ['geschrieben', 'ton', 'beides'],
    vorgabe: 'geschrieben',
    namen: { geschrieben: 'geschrieben', ton: 'per Ton', beides: 'beides' },
  },
};

// Die Gruppen, deren Vorgabe von der Schwierigkeit abhängt
export const ZEITEN = ['anzeigezeit', 'antwortzeit'];

export const VORGABEN = Object.freeze({
  ...Object.fromEntries(Object.entries(EINSTELLUNGEN).map(([name, g]) => [name, g.vorgabe])),
  eigeneZeiten: Object.freeze([]),
});

// Zeiten, die nicht selbst gewählt sind, auf die Vorgabe der Schwierigkeit setzen
export function zeitenNachSchwierigkeit(werte) {
  const neu = { ...werte, eigeneZeiten: [...(werte.eigeneZeiten || [])] };
  for (const name of ZEITEN) if (!neu.eigeneZeiten.includes(name)) neu[name] = VORGABEZEITEN[neu.schwierigkeit][name];
  return neu;
}

// Einen Wert setzen wie ein Klick in den Einstellungen: Eine Zeit gilt danach
// als selbst gewählt, eine neue Schwierigkeit bringt ihre Zeiten mit, soweit
// keine eigenen gewählt sind
export function einstellungSetzen(werte, name, wert) {
  const neu = { ...werte, [name]: wert, eigeneZeiten: [...(werte.eigeneZeiten || [])] };
  if (ZEITEN.includes(name) && !neu.eigeneZeiten.includes(name)) neu.eigeneZeiten = ZEITEN.filter((z) => z === name || neu.eigeneZeiten.includes(z));
  return zeitenNachSchwierigkeit(neu);
}

// Eigene Zeiten verwerfen, danach gelten wieder die der Schwierigkeit
export function zeitenZuruecksetzen(werte) {
  return zeitenNachSchwierigkeit({ ...werte, eigeneZeiten: [] });
}

// Der Speicher des Browsers, wenn es ihn gibt; der Zugriff selbst kann werfen
function geraeteSpeicher() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function einstellungenLesen(speicher = geraeteSpeicher()) {
  let gespeichert = null;
  try {
    gespeichert = speicher ? JSON.parse(speicher.getItem(EINSTELLUNGEN_SCHLUESSEL)) : null;
  } catch {
    gespeichert = null;
  }
  if (!gespeichert || typeof gespeichert !== 'object' || Array.isArray(gespeichert)) return zeitenNachSchwierigkeit(VORGABEN);
  const werte = Object.fromEntries(Object.entries(EINSTELLUNGEN).map(([name, g]) => [name, g.werte.includes(gespeichert[name]) ? gespeichert[name] : g.vorgabe]));
  const gueltig = (name) => EINSTELLUNGEN[name].werte.includes(gespeichert[name]);
  const eigeneZeiten = Array.isArray(gespeichert.eigeneZeiten)
    ? ZEITEN.filter((name) => gespeichert.eigeneZeiten.includes(name) && gueltig(name))
    : ZEITEN.filter((name) => gueltig(name) && gespeichert[name] !== VORGABEZEITEN.normal[name]);
  return zeitenNachSchwierigkeit({ ...werte, eigeneZeiten });
}

export function einstellungenSchreiben(werte, speicher = geraeteSpeicher()) {
  if (!speicher) return false;
  try {
    speicher.setItem(EINSTELLUNGEN_SCHLUESSEL, JSON.stringify(werte));
    return true;
  } catch {
    return false;
  }
}

// Kurzfassung für die Auswahlseite und den Start einer Übung
export function einstellungenKurz(werte, bereich = null) {
  const schwierigkeit = `Schwierigkeit ${EINSTELLUNGEN.schwierigkeit.namen[werte.schwierigkeit]}`;
  const art = EINSTELLUNGEN.antwortart.namen[werte.antwortart];
  const antwort = `Antwortzeit ${werte.antwortzeit} s`;
  const stellung = { geschrieben: 'Aufgabe geschrieben', ton: 'Aufgabe per Ton', beides: 'Aufgabe geschrieben und per Ton' }[werte.aufgabenstellung];
  if (bereich === 'kopfrechnen') return `${schwierigkeit}, ${art}, ${antwort}, ${stellung}`;
  if (bereich) return `${schwierigkeit}, ${art}, Anzeige ${werte.anzeigezeit} s, ${antwort}`;
  return `${schwierigkeit}, ${art}, Anzeige ${werte.anzeigezeit} s, ${antwort}, Kopfrechnen: ${stellung}`;
}
