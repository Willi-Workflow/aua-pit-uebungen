// Oberfläche: Adressanker auf Ansichten abbilden, Blatt anzeigen, drucken.
// Adressen: #/  #/stufe2  #/stufe2/blatt/7  #/stufe3  #/stufe2/endlos  #/blitzrechnen

import { erzeugeBlatt, hatGates, BLAETTER_JE_STUFE, STUFEN } from './blatt.js';
import { zeichneParcours } from './zeichnung.js';
import { kursText } from './kurs.js';

const NAME = 'AUA PIT Übungsblätter';

const LEGENDE = `<div class="legende">
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/></svg> horizontal</span>
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/><line x1="0" y1="6" x2="40" y2="6" stroke="#fff" stroke-width="6" stroke-dasharray="5 2.5"/></svg> steigen</span>
<span><svg viewBox="0 0 40 12"><line x1="0" y1="6" x2="40" y2="6" stroke="#000" stroke-width="9"/><line x1="0" y1="6" x2="40" y2="6" stroke="#fff" stroke-width="6"/></svg> sinken</span>
</div>`;

const GATEHINWEIS = '<p class="gatehinweis"><strong>Mit Gates:</strong> Kästchen am Parcours aus dem Gedächtnis fliegen. Relative Werte mit dem aktuellen Kurs verrechnen, gedreht wird auf kürzestem Weg.</p>';

// Kursrose wie auf der Kursanzeige im Flug auf dem Ausgangskurs aller Blätter:
// Die Skala ist so gedreht, dass 090 oben unter dem festen Zeiger steht, die
// Ziffern stehen radial mit dem Kopf nach außen. Gezeichnet im Feld -100 bis
// 100; die Linienbreiten stehen in style.css und bleiben bei jeder Größe gleich.
// detailliert = false ergibt das Zeichen der Kopfleiste: Kreis, vier lange
// Striche, Zeiger.
const ROSE_KURS = 90;

function aufRose(kurs, radius) {
  const winkel = ((kurs - ROSE_KURS) * Math.PI) / 180;
  return { x: +(radius * Math.sin(winkel)).toFixed(2), y: +(-radius * Math.cos(winkel)).toFixed(2) };
}

function roseStrich(kurs, innen, aussen, art) {
  const a = aufRose(kurs, innen);
  const b = aufRose(kurs, aussen);
  return `<line class="rose-strich ${art}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
}

function kursrose(groesse, detailliert) {
  if (!detailliert) {
    // Der Zeiger liegt innen über dem Strich bei 090, damit das Zeichen bei
    // 22 px als Anzeige und nicht als Stoppuhr gelesen wird
    const striche = [0, 90, 180, 270].map((k) => roseStrich(k, 58, 90, 'lang')).join('');
    return `<svg class="zeichen" viewBox="-100 -100 200 200" width="${groesse}" height="${groesse}" aria-hidden="true" focusable="false">`
      + `<circle class="rose-scheibe" r="90"/>${striche}<path class="rose-zeiger" d="M -25 -90 H 25 L 0 -46 Z"/></svg>`;
  }
  const striche = [];
  for (let k = 0; k < 360; k += 5) {
    if (k % 30 === 0) striche.push(roseStrich(k, 76, 90, 'lang'));
    else if (k % 10 === 0) striche.push(roseStrich(k, 81, 90, 'mittel'));
    else striche.push(roseStrich(k, 85, 90, 'kurz'));
  }
  const ziffern = [];
  for (let k = 0; k < 360; k += 30) {
    const art = k === ROSE_KURS ? ' ausgang' : '';
    ziffern.push(`<text class="rose-ziffer${art}" transform="rotate(${k - ROSE_KURS}) translate(0 -64)">${k / 10}</text>`);
  }
  // In der Mitte das Flugzeugsymbol mit der Nase nach oben, darüber der feste Zeiger
  return `<svg class="kursrose" viewBox="-100 -100 200 200" width="${groesse}" height="${groesse}" role="img" aria-label="Kursrose, Ausgangskurs 090°">`
    + '<circle class="rose-scheibe" r="90"/>'
    + striche.join('')
    + ziffern.join('')
    + '<path class="rose-flugzeug" transform="scale(0.85)" d="M 0 -25 C 2 -25 3 -22 3 -18 V -8 L 27 -4 V 0 L 3 -1 V 12 L 10 15 V 18 H -10 V 15 L -3 12 V -1 L -27 0 V -4 L -3 -8 V -18 C -3 -22 -2 -25 0 -25 Z"/>'
    + '<path class="rose-zeiger" d="M -7 -100 H 7 L 0 -91.5 Z"/>'
    + '</svg>';
}

// Kopfleiste: ganz links Zurück als Textlink, dann Zeichen und Name, bei
// Unterseiten hinter einem Trenner der Ort, rechts die Knöpfe
function kopf(ort, zurueck, aktionen = '') {
  const aktuell = ort ? '' : ' aria-current="page"';
  const zurueckLink = zurueck ? `<a class="zurueck" href="${zurueck}">Zurück</a>` : '';
  const marke = `<a class="marke" href="#/"${aktuell}>${kursrose(22, false)}<span class="name">${NAME}</span></a>`;
  const ortTeil = ort ? `<span class="ort">${ort}</span>` : '';
  const rechts = aktionen ? `<div class="aktionen">${aktionen}</div>` : '';
  return `<header class="kopf"><div class="kopf-innen rahmen">${zurueckLink}${marke}${ortTeil}${rechts}</div></header>`;
}

function startseite() {
  return kopf(null, null)
    + `<main class="rahmen startseite">
<div class="start-text">
<h1 class="titel-gross">Übungsblätter für die PIT-Übungen</h1>
<p class="einleitung">Jedes Blatt hat zwölf Anweisungen im Textteil und einen gezeichneten Parcours, der daran anschließt. Wähle eine Stufe und ein Blatt, übe am Bildschirm oder drucke es auf A4 aus.</p>
</div>
<figure class="start-rose">${kursrose(280, true)}<figcaption>Ausgangskurs 090°, 2000 ft</figcaption><a class="knopf" href="#/blitzrechnen">Blitzrechnen</a></figure>
<nav class="stufen" aria-label="Stufen">
<a class="karte" href="#/stufe2"><span class="karte-titel">Stufe 2</span><span class="karte-text">Textteil und Parcours, ${BLAETTER_JE_STUFE} Blätter, jedes dritte mit Gates</span></a>
<a class="karte spaeter" href="#/stufe3"><span class="karte-titel">Stufe 3</span><span class="karte-text">Kommt in einem späteren Abschnitt</span></a>
</nav>
</main>`;
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
    + `<main class="rahmen liste">
<h1 class="titel">Stufe ${stufe}</h1>
<p class="unterzeile">${BLAETTER_JE_STUFE} Blätter. Jedes dritte Blatt hat Gates.</p>
<ol class="raster">
${karten}
</ol>
</main>`;
}

function platzhalter(titel, zurueck, text) {
  return kopf(titel, zurueck)
    + `<main class="rahmen hinweisseite"><h1 class="titel">${titel}</h1><p class="unterzeile">${text}</p></main>`;
}

function blattseite(stufe, nummer) {
  let blatt;
  try {
    blatt = erzeugeBlatt(stufe, nummer);
  } catch (fehler) {
    // Sollte nach der Adressprüfung nicht vorkommen; wenn doch, lieber eine Meldung als eine leere Seite
    return platzhalter('Fehler', `#/stufe${stufe}`, `Dieses Blatt konnte nicht erzeugt werden: ${fehler.message}`);
  }
  // Zahl und Einheit nicht trennen, sonst steht auf dem Handy "15" am Zeilenende und "s" darunter
  const zeilen = blatt.textteil.zeilen.map((z) => `<li>${z.satz.replace(/(\d) (s|ft)\b/g, '$1\u00a0$2')}</li>`).join('');
  const drucken = '<button type="button" class="knopf" data-aktion="drucken">Drucken</button>';
  return kopf(`Stufe ${stufe}, Blatt ${nummer}`, `#/stufe${stufe}`, drucken)
    + `<main class="rahmen blattseite"><article class="blatt">
<h1>AUA PIT Stufe ${stufe}, Blatt ${nummer}</h1>
<p class="ausgang">Ausgangskurs ${kursText(blatt.textteil.ausgangskurs)}°, ${blatt.textteil.ausgangshoehe} ft</p>
${hatGates(stufe, nummer) ? GATEHINWEIS : ''}
<ol class="textteil">${zeilen}</ol>
${zeichneParcours(blatt.parcours)}
${LEGENDE}
</article></main>`;
}

export function ansichtFuer(hash) {
  const teile = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (teile.length === 0) return startseite();
  if (teile[0] === 'blitzrechnen') return platzhalter('Blitzrechnen', '#/', 'Blitzrechnen kommt in einem späteren Abschnitt.');
  const stufe = Number((teile[0].match(/^stufe(\d)$/) || [])[1]);
  if (!STUFEN.includes(stufe)) return platzhalter('Nicht gefunden', '#/', 'Diese Seite gibt es nicht.');
  if (stufe === 3) return platzhalter('Stufe 3', '#/', 'Diese Stufe kommt in einem späteren Abschnitt.');
  if (teile.length === 1) return stufenseite(stufe);
  if (teile[1] === 'endlos') return platzhalter(`Stufe ${stufe}, Endlos`, `#/stufe${stufe}`, 'Der Endlosmodus kommt in einem späteren Abschnitt.');
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
