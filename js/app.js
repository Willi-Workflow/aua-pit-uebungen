// Oberfläche: Adressanker auf Ansichten abbilden, Blatt anzeigen, drucken.
// Adressen: #/  #/stufe2  #/stufe2/blatt/7  #/stufe3  #/stufe2/endlos

import { erzeugeBlatt, BLAETTER_JE_STUFE } from './blatt.js';
import { zeichneParcours } from './zeichnung.js';
import { kursText } from './kurs.js';

const LEGENDE = `<div class="legende">
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/></svg> horizontal</span>
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/><line x1="0" y1="6" x2="40" y2="6" stroke="#fff" stroke-width="6" stroke-dasharray="5 2.5"/></svg> steigen</span>
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/><line x1="0" y1="6" x2="40" y2="6" stroke="#fff" stroke-width="6"/></svg> sinken</span>
</div>`;

function kopf(titel, zurueck, aktionen = '') {
  const zurueckKnopf = zurueck ? `<a href="${zurueck}">Zurück</a>` : '';
  return `<header class="kopf">${zurueckKnopf}<h1>${titel}</h1>${aktionen}</header>`;
}

function startseite() {
  return kopf('AUA PIT Übungsblätter', null)
    + '<div class="inhalt"><nav class="stufen"><a href="#/stufe2">Stufe 2</a><a href="#/stufe3">Stufe 3</a></nav></div>';
}

function stufenseite(stufe) {
  const zahlen = Array.from({ length: BLAETTER_JE_STUFE }, (_, i) => `<li><a href="#/stufe${stufe}/blatt/${i + 1}">${i + 1}</a></li>`).join('');
  return kopf(`Stufe ${stufe}`, '#/')
    + `<div class="inhalt"><h2>Blätter</h2><ol class="raster">${zahlen}</ol></div>`;
}

function platzhalter(titel, zurueck, text) {
  return kopf(titel, zurueck) + `<div class="inhalt"><p>${text}</p></div>`;
}

function blattseite(stufe, nummer) {
  const blatt = erzeugeBlatt(stufe, nummer);
  const zeilen = blatt.textteil.zeilen.map((z) => `<li>${z.satz}</li>`).join('');
  const drucken = '<button type="button" data-aktion="drucken">Drucken</button>';
  return kopf(`Stufe ${stufe} · Blatt ${nummer}`, `#/stufe${stufe}`, drucken)
    + `<div class="inhalt"><article class="blatt">
<h2>AUA PIT Stufe ${stufe}, Blatt ${nummer}</h2>
<p class="ausgang">Ausgangskurs ${kursText(blatt.textteil.ausgangskurs)}°, ${blatt.textteil.ausgangshoehe} ft</p>
<ol class="textteil">${zeilen}</ol>
${zeichneParcours(blatt.parcours)}
${LEGENDE}
</article></div>`;
}

export function ansichtFuer(hash) {
  const teile = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (teile.length === 0) return startseite();
  const stufe = Number((teile[0].match(/^stufe(\d)$/) || [])[1]);
  if (stufe !== 2 && stufe !== 3) return platzhalter('Nicht gefunden', '#/', 'Diese Seite gibt es nicht.');
  if (stufe === 3) return platzhalter('Stufe 3', '#/', 'Stufe 3 kommt in einem späteren Abschnitt.');
  if (teile.length === 1) return stufenseite(stufe);
  if (teile[1] === 'endlos') return platzhalter(`Stufe ${stufe} · Endlos`, `#/stufe${stufe}`, 'Der Endlosmodus kommt in einem späteren Abschnitt.');
  if (teile[1] === 'blatt') {
    const nummer = Number(teile[2]);
    if (Number.isInteger(nummer) && nummer >= 1 && nummer <= BLAETTER_JE_STUFE) return blattseite(stufe, nummer);
  }
  return platzhalter('Nicht gefunden', `#/stufe${stufe}`, 'Dieses Blatt gibt es nicht.');
}

const wurzel = document.querySelector('#app');

function anzeigen() {
  wurzel.innerHTML = ansichtFuer(location.hash);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', anzeigen);
wurzel.addEventListener('click', (ereignis) => {
  if (ereignis.target.closest('[data-aktion="drucken"]')) window.print();
});
anzeigen();
