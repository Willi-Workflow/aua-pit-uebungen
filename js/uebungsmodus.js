// Übungsmodus der Blattansicht im Browser. "Start" schaltet die ganze Seite
// über die Fullscreen-API (mit webkit-Rückfall) in den Vollbildmodus und legt
// das Blatt mit der Klasse "vollbild" als A4-Seite mittig über alles, damit es
// auch ohne die API geht (iPhone). Die Seite selbst wird Vollbild, nicht das
// Blatt, weil der Browser ein Vollbild-Element auf den ganzen Bildschirm zieht
// und es dann nicht mehr A4 wäre. Leertaste, Tippen und Klicken
// zeigen die nächste Lösung, Rücktaste und Pfeil links blenden die letzte aus,
// Escape, "Beenden" oder das Verlassen des Vollbilds über den Browser beenden
// den Modus und blenden alle Lösungen aus. Die Logik der Tasten steht in
// loesungen.js. Im Prüfmodus (data-probe) steht der Zustand still.

import { tasteZuAktion, naechsterStand, zaehlerText } from './loesungen.js';

function vollbildElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

// Ruft eine Methode der Fullscreen-API auf; ein abgelehntes Versprechen oder
// ein Fehler lässt es beim Vollbild über die Klasse
function versuchen(methode, ziel) {
  if (!methode) return;
  try {
    const ergebnis = methode.call(ziel);
    if (ergebnis && typeof ergebnis.catch === 'function') ergebnis.catch(() => {});
  } catch {
    // ohne API bleibt die Klasse "vollbild"
  }
}

// Startet die Bedienung, wenn die Ansicht ein Blatt zeigt, und liefert eine
// Funktion, die sie wieder beendet
export function uebungsmodusLaufen(wurzel) {
  const blatt = wurzel.querySelector('.blatt');
  if (!blatt || blatt.hasAttribute('data-probe') || !blatt.querySelector('.loesung')) return () => {};
  // Jede Lösung steht zweimal da, als weißer Umriss und als roter Text
  const loesungen = [...blatt.querySelectorAll('.loesung')];
  const anzahl = blatt.querySelectorAll('.loesung:not(.umriss)').length;
  const zaehler = blatt.querySelector('[data-zaehler]');
  let aktiv = false;
  let stand = 0;

  const zeigen = () => {
    for (const l of loesungen) l.classList.toggle('gezeigt', Number(l.dataset.schritt) <= stand);
    if (zaehler) zaehler.textContent = zaehlerText(stand, anzahl);
  };

  const starten = () => {
    if (aktiv) return;
    aktiv = true;
    stand = 0;
    zeigen();
    blatt.classList.add('vollbild');
    document.documentElement.classList.add('vollbild-offen');
    // Sonst löste die Leertaste den Knopf "Start" noch einmal aus
    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
    const seite = document.documentElement;
    versuchen(seite.requestFullscreen || seite.webkitRequestFullscreen, seite);
  };

  const beenden = () => {
    if (!aktiv) return;
    aktiv = false;
    stand = 0;
    zeigen();
    blatt.classList.remove('vollbild');
    document.documentElement.classList.remove('vollbild-offen');
    if (vollbildElement()) versuchen(document.exitFullscreen || document.webkitExitFullscreen, document);
  };

  const ausfuehren = (aktion) => {
    if (aktion === 'ende') {
      beenden();
      return;
    }
    stand = naechsterStand(stand, anzahl, aktion);
    zeigen();
  };

  const klick = (ereignis) => {
    if (ereignis.target.closest('[data-aktion="vollbild"]')) {
      starten();
      return;
    }
    if (!aktiv || !blatt.contains(ereignis.target)) return;
    if (ereignis.target.closest('[data-aktion="beenden"]')) beenden();
    else ausfuehren('weiter');
  };

  const taste = (ereignis) => {
    if (!aktiv || ereignis.altKey || ereignis.ctrlKey || ereignis.metaKey) return;
    const aktion = tasteZuAktion(ereignis.key);
    if (!aktion) return;
    ereignis.preventDefault();
    ausfuehren(aktion);
  };

  // Verlässt jemand das Vollbild über den Browser (Escape, Geste), endet der
  // Modus. Kam das Vollbild erst, nachdem der Modus schon wieder beendet war,
  // wird es gleich wieder verlassen.
  const vollbildGewechselt = () => {
    const element = vollbildElement();
    if (aktiv && !element) beenden();
    else if (!aktiv && element === document.documentElement) versuchen(document.exitFullscreen || document.webkitExitFullscreen, document);
  };

  wurzel.addEventListener('click', klick);
  document.addEventListener('keydown', taste);
  document.addEventListener('fullscreenchange', vollbildGewechselt);
  document.addEventListener('webkitfullscreenchange', vollbildGewechselt);
  return () => {
    beenden();
    wurzel.removeEventListener('click', klick);
    document.removeEventListener('keydown', taste);
    document.removeEventListener('fullscreenchange', vollbildGewechselt);
    document.removeEventListener('webkitfullscreenchange', vollbildGewechselt);
  };
}
