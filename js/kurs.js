// Gradrechnung und Himmelsrichtungen. Kurse sind Zahlen in Grad, 0 bis 359,
// bei Himmelsrichtungen auch halbe Grade (22,5). Norden ist 0, rechts herum.

export const HIMMELSRICHTUNGEN = {
  deutsch: ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
  englisch: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
};

// Welche Schreibweise wo gilt. Für eine spätere zufällige Mischung nur hier ändern.
export const SCHREIBWEISE = { textteil: 'deutsch', zeichnung: 'englisch' };

export function normieren(grad) {
  return ((grad % 360) + 360) % 360;
}

export function gegenkurs(grad) {
  return normieren(grad + 180);
}

// Kürzeste Differenz von "von" nach "nach" in (-180, 180], rechts positiv
export function differenz(von, nach) {
  const d = normieren(nach - von);
  return d > 180 ? d - 360 : d;
}

// Drehwinkel in der gegebenen Richtung ('rechts' oder 'links') in [0, 360)
export function drehung(von, nach, richtung) {
  return richtung === 'rechts' ? normieren(nach - von) : normieren(von - nach);
}

export function istGanzzahl(grad) {
  return Number.isInteger(grad);
}

// Dreistellig mit führenden Nullen, wie in der Luftfahrt üblich
export function kursText(grad) {
  return String(normieren(Math.round(grad))).padStart(3, '0');
}

export function himmelsrichtungGrad(index) {
  return index * 22.5;
}

export function himmelsrichtungName(index, schreibweise) {
  return HIMMELSRICHTUNGEN[schreibweise][index];
}

// Index der nächstgelegenen Himmelsrichtung, 0 bis 15. Genau in der Mitte
// zwischen zwei Richtungen (11,25° daneben) ist das nicht eindeutig; wer das
// braucht, prüft es vorher.
export function naechsteHimmelsrichtung(grad) {
  return Math.round(normieren(grad) / 22.5) % 16;
}
