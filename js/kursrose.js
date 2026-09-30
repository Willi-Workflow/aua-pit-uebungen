// Kursrose wie auf der Kursanzeige im Flug: Die Skala ist so gedreht, dass der
// Kurs "kurs" oben unter dem festen Zeiger steht, die Ziffern stehen radial mit
// dem Kopf nach außen, das Flugzeug in der Mitte zeigt immer nach oben. Die
// Startseite zeigt sie auf dem Ausgangskurs aller Blätter (090), das
// Blitzrechnen auf dem Ankunftskurs eines Ausschnitts. Gezeichnet im Feld -100
// bis 100; die Linienbreiten stehen in style.css und bleiben bei jeder Größe
// gleich. detailliert = false ergibt das Zeichen der Kopfleiste: Kreis, vier
// lange Striche, Zeiger.
// Eigenes Modul, weil app.js und blitzansicht.js sie beide brauchen und app.js
// blitzansicht.js einbindet.

import { kursText, normieren } from './kurs.js';

// Ausgangskurs aller Blätter, auf ihm steht die Rose der Startseite
export const AUSGANGSKURS = 90;

function aufRose(k, radius, kurs) {
  const winkel = ((k - kurs) * Math.PI) / 180;
  return { x: +(radius * Math.sin(winkel)).toFixed(2), y: +(-radius * Math.cos(winkel)).toFixed(2) };
}

function roseStrich(k, innen, aussen, art, kurs) {
  const a = aufRose(k, innen, kurs);
  const b = aufRose(k, aussen, kurs);
  return `<line class="rose-strich ${art}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
}

// Die beschriftete Zehnerstelle, die dem Zeiger am nächsten steht (alle 30°);
// genau zwischen zwei Ziffern die rechte
export function zifferUnterZeiger(kurs) {
  return normieren(Math.round(kurs / 30) * 30);
}

export function kursrose(groesse, detailliert, kurs = AUSGANGSKURS) {
  if (!detailliert) {
    // Der Zeiger liegt innen über dem oberen Strich, damit das Zeichen bei
    // 22 px als Anzeige und nicht als Stoppuhr gelesen wird
    const striche = [0, 90, 180, 270].map((k) => roseStrich(k, 58, 90, 'lang', kurs)).join('');
    return `<svg class="zeichen" viewBox="-100 -100 200 200" width="${groesse}" height="${groesse}" aria-hidden="true" focusable="false">`
      + `<circle class="rose-scheibe" r="90"/>${striche}<path class="rose-zeiger" d="M -25 -90 H 25 L 0 -46 Z"/></svg>`;
  }
  const striche = [];
  for (let k = 0; k < 360; k += 5) {
    if (k % 30 === 0) striche.push(roseStrich(k, 76, 90, 'lang', kurs));
    else if (k % 10 === 0) striche.push(roseStrich(k, 81, 90, 'mittel', kurs));
    else striche.push(roseStrich(k, 85, 90, 'kurz', kurs));
  }
  // Die Ziffer unter dem Zeiger ist orange; die Klasse heißt nach der Startseite
  const oben = zifferUnterZeiger(kurs);
  const ziffern = [];
  for (let k = 0; k < 360; k += 30) {
    const art = k === oben ? ' ausgang' : '';
    ziffern.push(`<text class="rose-ziffer${art}" transform="rotate(${k - kurs}) translate(0 -64)">${k / 10}</text>`);
  }
  const name = kurs === AUSGANGSKURS ? 'Ausgangskurs 090°' : `Kurs ${kursText(kurs)}°`;
  // In der Mitte das Flugzeugsymbol mit der Nase nach oben, darüber der feste Zeiger
  return `<svg class="kursrose" viewBox="-100 -100 200 200" width="${groesse}" height="${groesse}" role="img" aria-label="Kursrose, ${name}">`
    + '<circle class="rose-scheibe" r="90"/>'
    + striche.join('')
    + ziffern.join('')
    + '<path class="rose-flugzeug" transform="scale(0.85)" d="M 0 -25 C 2 -25 3 -22 3 -18 V -8 L 27 -4 V 0 L 3 -1 V 12 L 10 15 V 18 H -10 V 15 L -3 12 V -1 L -27 0 V -4 L -3 -8 V -18 C -3 -22 -2 -25 0 -25 Z"/>'
    + '<path class="rose-zeiger" d="M -7 -100 H 7 L 0 -91.5 Z"/>'
    + '</svg>';
}
