// Oberfläche: Adressanker auf Ansichten abbilden, Blatt anzeigen, drucken.
// Adressen: #/  #/stufe2  #/stufe2/blatt/7  #/stufe3  #/stufe2/endlos

import { erzeugeBlatt, hatGates, BLAETTER_JE_STUFE, STUFEN } from './blatt.js';
import { zeichneParcours } from './zeichnung.js';
import { kursText } from './kurs.js';

const LEGENDE = `<div class="legende">
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/></svg> horizontal</span>
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/><line x1="0" y1="6" x2="40" y2="6" stroke="#fff" stroke-width="6" stroke-dasharray="5 2.5"/></svg> steigen</span>
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/><line x1="0" y1="6" x2="40" y2="6" stroke="#fff" stroke-width="6"/></svg> sinken</span>
</div>`;

const GATEHINWEIS = '<p class="gatehinweis"><strong>Mit Gates:</strong> Kästchen am Parcours aus dem Gedächtnis fliegen.</p>';

// Kopfleiste: links Zurück als Textlink, daneben der Titel, rechts die Knöpfe
function kopf(titel, zurueck, aktionen = '') {
  const zurueckLink = zurueck ? `<a class="zurueck" href="${zurueck}"><span aria-hidden="true">←</span> Zurück</a>` : '';
  const knoepfe = aktionen ? `<div class="aktionen">${aktionen}</div>` : '';
  return `<header class="kopf">${zurueckLink}<h1>${titel}</h1>${knoepfe}</header>`;
}

function startseite() {
  return kopf('AUA PIT Übungsblätter', null)
    + `<div class="inhalt">
<p class="einleitung">Nummerierte Übungsblätter für die PIT-Flugübungen, jedes mit Textteil und gezeichnetem Parcours, zum Üben am Bildschirm oder ausgedruckt auf A4.</p>
<nav class="stufen">
<a class="karte" href="#/stufe2"><span class="karte-titel">Stufe 2</span><span class="karte-text">Textteil und Parcours, ${BLAETTER_JE_STUFE} Blätter, jedes dritte mit Gates</span></a>
<a class="karte spaeter" href="#/stufe3"><span class="karte-titel">Stufe 3</span><span class="karte-text">Kommt in einem späteren Abschnitt</span></a>
</nav>
</div>`;
}

// Karte der Blattliste: fertiges Vorschaubild aus vorschau/, darunter die Nummer
function blattKarte(stufe, nummer) {
  const gates = hatGates(stufe, nummer) ? '<span class="gatemarke">Gates</span>' : '';
  return `<li><a class="blattkarte" href="#/stufe${stufe}/blatt/${nummer}">`
    + `<span class="vorschau"><img src="vorschau/stufe${stufe}/${nummer}.svg" alt="" loading="lazy" width="160" height="120"></span>`
    + `<span class="blattkarte-fuss"><span class="blattnummer">Blatt ${nummer}</span>${gates}</span>`
    + '</a></li>';
}

function stufenseite(stufe) {
  const karten = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => blattKarte(stufe, i + 1)).join('\n');
  return kopf(`Stufe ${stufe}`, '#/')
    + `<div class="inhalt breit">
<p class="einleitung">${BLAETTER_JE_STUFE} Blätter. Blätter mit Gates sind markiert.</p>
<ol class="raster">
${karten}
</ol>
</div>`;
}

function platzhalter(titel, zurueck, text) {
  return kopf(titel, zurueck) + `<div class="inhalt"><p class="einleitung">${text}</p></div>`;
}

function blattseite(stufe, nummer) {
  let blatt;
  try {
    blatt = erzeugeBlatt(stufe, nummer);
  } catch (fehler) {
    // Sollte nach der Adressprüfung nicht vorkommen; wenn doch, lieber eine Meldung als eine leere Seite
    return platzhalter('Fehler', `#/stufe${stufe}`, `Dieses Blatt konnte nicht erzeugt werden: ${fehler.message}`);
  }
  const zeilen = blatt.textteil.zeilen.map((z) => `<li>${z.satz}</li>`).join('');
  const drucken = '<button type="button" class="knopf" data-aktion="drucken">Drucken</button>';
  return kopf(`Stufe ${stufe} · Blatt ${nummer}`, `#/stufe${stufe}`, drucken)
    + `<div class="inhalt"><article class="blatt">
<h2>AUA PIT Stufe ${stufe}, Blatt ${nummer}</h2>
<p class="ausgang">Ausgangskurs ${kursText(blatt.textteil.ausgangskurs)}°, ${blatt.textteil.ausgangshoehe} ft</p>
${hatGates(stufe, nummer) ? GATEHINWEIS : ''}
<ol class="textteil">${zeilen}</ol>
${zeichneParcours(blatt.parcours)}
${LEGENDE}
</article></div>`;
}

export function ansichtFuer(hash) {
  const teile = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (teile.length === 0) return startseite();
  const stufe = Number((teile[0].match(/^stufe(\d)$/) || [])[1]);
  if (!STUFEN.includes(stufe)) return platzhalter('Nicht gefunden', '#/', 'Diese Seite gibt es nicht.');
  if (stufe === 3) return platzhalter('Stufe 3', '#/', 'Stufe 3 kommt in einem späteren Abschnitt.');
  if (teile.length === 1) return stufenseite(stufe);
  if (teile[1] === 'endlos') return platzhalter(`Stufe ${stufe} · Endlos`, `#/stufe${stufe}`, 'Der Endlosmodus kommt in einem späteren Abschnitt.');
  if (teile[1] === 'blatt') {
    const nummer = Number(teile[2]);
    if (Number.isInteger(nummer) && nummer >= 1 && nummer <= BLAETTER_JE_STUFE) return blattseite(stufe, nummer);
  }
  return platzhalter('Nicht gefunden', `#/stufe${stufe}`, 'Dieses Blatt gibt es nicht.');
}

// Nur im Browser: In Node gibt es kein document, dort wird ansichtFuer allein geprüft
if (typeof document !== 'undefined') {
  const wurzel = document.querySelector('#app');

  const anzeigen = () => {
    wurzel.innerHTML = ansichtFuer(location.hash);
    window.scrollTo(0, 0);
  };

  window.addEventListener('hashchange', anzeigen);
  wurzel.addEventListener('click', (ereignis) => {
    if (ereignis.target.closest('[data-aktion="drucken"]')) window.print();
  });
  anzeigen();
}
