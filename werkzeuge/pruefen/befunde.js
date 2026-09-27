// Sammlung der Befunde je Blatt: Fehler, Unschärfe, Hinweis

export const befunde = [];
let aktBlatt = 0;

export function blattSetzen(nummer) {
  aktBlatt = nummer;
}

export function befund(kategorie, teil, regel, stelle, ist, soll, ort = null) {
  befunde.push({ blatt: aktBlatt, kategorie, teil, regel, stelle, ist, soll, ort });
}
