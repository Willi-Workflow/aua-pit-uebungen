// Einstellungen des Blitzrechnens, nur auf dem Gerät gespeichert. Lesen und
// Schreiben vertragen einen fehlenden oder gesperrten Speicher: Dann gelten die
// Vorgaben, und Schreiben meldet false. Jeder Wert wird einzeln geprüft; was
// nicht zu seiner Gruppe gehört, fällt auf die Vorgabe zurück.

export const EINSTELLUNGEN_SCHLUESSEL = 'blitzrechnen.einstellungen';

// Je Gruppe die Auswahl, die Vorgabe und die Namen der Knöpfe
export const EINSTELLUNGEN = {
  antwortart: {
    titel: 'Antwortart',
    text: 'Beim Eintippen prüft die App jede Antwort sofort. Bei der Auflösung rechnest du nur im Kopf, die Lösung erscheint nach der Antwortzeit, und du zählst selbst.',
    werte: ['eintippen', 'aufloesung'],
    vorgabe: 'eintippen',
    namen: { eintippen: 'Eintippen mit Prüfung', aufloesung: 'Auflösung ohne Tippen' },
  },
  anzeigezeit: {
    titel: 'Anzeigezeit des Ausschnitts',
    text: 'So lange ist ein Ausschnitt in Stufe 2 und 3 zu sehen.',
    werte: [3, 5, 8],
    vorgabe: 5,
    namen: { 3: '3 s', 5: '5 s', 8: '8 s' },
  },
  antwortzeit: {
    titel: 'Antwortzeit',
    text: 'Zeit je Antwort, bei einem Gate für jede Zeile neu.',
    werte: [10, 15, 20],
    vorgabe: 10,
    namen: { 10: '10 s', 15: '15 s', 20: '20 s' },
  },
  aufgabenstellung: {
    titel: 'Aufgabenstellung beim Kopfrechnen',
    text: 'Per Ton wird die Aufgabe angesagt und nicht angezeigt.',
    werte: ['geschrieben', 'ton', 'beides'],
    vorgabe: 'geschrieben',
    namen: { geschrieben: 'geschrieben', ton: 'per Ton', beides: 'beides' },
  },
};

export const VORGABEN = Object.fromEntries(Object.entries(EINSTELLUNGEN).map(([name, g]) => [name, g.vorgabe]));

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
  if (!gespeichert || typeof gespeichert !== 'object' || Array.isArray(gespeichert)) return { ...VORGABEN };
  return Object.fromEntries(Object.entries(EINSTELLUNGEN).map(([name, g]) => [name, g.werte.includes(gespeichert[name]) ? gespeichert[name] : g.vorgabe]));
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
  const art = EINSTELLUNGEN.antwortart.namen[werte.antwortart];
  const antwort = `Antwortzeit ${werte.antwortzeit} s`;
  const stellung = { geschrieben: 'Aufgabe geschrieben', ton: 'Aufgabe per Ton', beides: 'Aufgabe geschrieben und per Ton' }[werte.aufgabenstellung];
  if (bereich === 'kopfrechnen') return `${art}, ${antwort}, ${stellung}`;
  if (bereich) return `${art}, Anzeige ${werte.anzeigezeit} s, ${antwort}`;
  return `${art}, Anzeige ${werte.anzeigezeit} s, ${antwort}, Kopfrechnen: ${stellung}`;
}
