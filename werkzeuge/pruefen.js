// Logikprüfung der Übungsblätter, nach der zweiten Logikprüfung der Stufe 2 und
// erweitert um Stufe 3.
//
// Erzeugt alle 100 Blätter einer Stufe und rechnet dann nur aus dem, was eine
// Pilotin sieht: den Sätzen des Textteils und dem gezeichneten SVG
// (Pfade, Gate-Kästen, Querstriche, Flugzeugsymbol, Nordpfeil, Texte). Innere
// Felder des Erzeugers werden nur am Ende zum Abgleich der eigenen Rechnung
// gelesen. Die Tinte der Texte wird aus in Chrome gemessenen Zeichenmaßen der
// Schrift 9 (system-ui auf macOS) berechnet, ohne Browser.
//
// Aufruf: node werkzeuge/pruefen.js 2|3 [--blaetter 1-100] [--json befunde.json]
// Ausgabe: Befunde je Kategorie (Fehler, Unschärfe, Hinweis) und Regel. Der
// Rückgabewert ist 1, sobald es einen Fehler gibt.
//
// Module unter werkzeuge/pruefen/: grundlagen.js (Maße, Geometrie, Bögen),
// befunde.js, tinte.js (Zeichenmaße), svg.js (Blatt lesen), textteil.js und
// parcours.js (Textteil und Parcours beider Stufen).

import { writeFileSync } from 'node:fs';
import { erzeugeBlatt } from '../js/blatt.js';
import { zeichneParcours } from '../js/zeichnung.js';
import { befunde, befund, blattSetzen } from './pruefen/befunde.js';
import { svgLesen } from './pruefen/svg.js';
import { textteilPruefen } from './pruefen/textteil.js';
import { parcoursPruefen } from './pruefen/parcours.js';

const argumente = process.argv.slice(2);
const STUFE = Number(argumente[0]);
if (![2, 3].includes(STUFE)) {
  console.error('Aufruf: node werkzeuge/pruefen.js 2|3 [--blaetter 1-100] [--json befunde.json]');
  process.exit(2);
}
function option(name) {
  const i = argumente.indexOf(name);
  return i >= 0 ? argumente[i + 1] : null;
}
const [VON, BIS] = (option('--blaetter') || '1-100').split('-').map(Number);
const JSON_AUS = option('--json');

const beginn = Date.now();
const statistik = [];
let abgleichAbweichungen = 0;
let abgleichKurse = 0;
for (let nummer = VON; nummer <= BIS; nummer++) {
  blattSetzen(nummer);
  const blatt = erzeugeBlatt(STUFE, nummer);
  const svgText = zeichneParcours(blatt.parcours);
  // Beide Stufen: Textteil ab 090°, 2000 ft, der Parcours schließt an Kurs und
  // Höhe nach dem letzten Satz an
  if (!blatt.textteil) {
    befund('Fehler', 'Textteil', 'Textteil vorhanden', 'Blatt', 'keiner', 'zwölf Sätze');
    continue;
  }
  if (blatt.textteil.ausgangskurs !== 90 || blatt.textteil.ausgangshoehe !== 2000) befund('Fehler', 'Textteil', 'Ausgangskurs 090°, 2000 ft', 'Kopf', `${blatt.textteil.ausgangskurs}/${blatt.textteil.ausgangshoehe}`, '090°, 2000 ft');
  const text = textteilPruefen(blatt.textteil.zeilen.map((z) => z.satz));
  const textEnde = { kurs: text.kurs, hoehe: text.hoehe };
  const svg = svgLesen(svgText);
  const erg = parcoursPruefen(blatt, svg, textEnde, STUFE);
  if (!erg) continue;
  const grenze = [...text.profile.slice(-3), ...erg.profile.slice(0, 3)];
  for (let j = 3; j < grenze.length; j++) {
    const vier = grenze.slice(j - 3, j + 1);
    if (vier.every((p) => p === vier[0])) { befund('Hinweis', 'Übergang', 'kein Profil viermal hintereinander über die Grenze Textteil/Parcours', 'Übergang', vier[0], 'höchstens dreimal'); break; }
  }
  for (const x of erg.sichtBefunde) {
    let kat; let regel;
    if (x.innen) { kat = 'Unschärfe'; regel = 'keine Beschriftung in Vollkreis, Schleife oder Kurve'; }
    else if (x.querstrich) { kat = 'Hinweis'; regel = 'Querstrich ragt höchstens 2 in den Gate-Kasten'; }
    else if (x.unterKasten !== undefined) { kat = x.unterKasten ? 'Fehler' : 'Unschärfe'; regel = 'kein fremder Strich unter oder an einem Gate-Kasten'; }
    else if (x.text === 'Flugzeugsymbol' || x.text === 'Nordpfeil' || x.text === 'N des Nordpfeils') { kat = 'Unschärfe'; regel = `${x.text} frei`; }
    else if (x.mit.startsWith('Querstrich')) { kat = x.tief >= 0.59 ? 'Unschärfe' : 'Hinweis'; regel = 'Beschriftung frei von Querstrichen'; }
    else if (x.mit.startsWith('Text')) { kat = x.tief >= 0.5 ? 'Fehler' : 'Unschärfe'; regel = 'Beschriftungen überlappen nicht'; }
    else if (x.kasten) { kat = x.tief >= 99 ? 'Fehler' : 'Unschärfe'; regel = 'Beschriftung außerhalb der Gate-Kästen'; }
    else if (x.mit === 'Flugzeugsymbol' || x.mit.startsWith('N')) { kat = 'Fehler'; regel = 'Beschriftung frei von Flugzeugsymbol und Nordpfeil'; }
    else { kat = x.tief >= 2 ? 'Fehler' : x.tief >= 0.8 ? 'Unschärfe' : 'Hinweis'; regel = 'Beschriftung frei von Strichen'; }
    befund(kat, 'Sicht', regel, x.text, `${x.mit}${x.zeileText ? ` an Zeile ${x.zeileText}` : ''}, Eindringtiefe ${x.tief >= 99 ? 'im Kasten' : x.tief.toFixed(2)}`, 'frei', x.t ? { x: x.t.t.x, y: x.t.t.y } : null);
  }
  // Abgleich der eigenen Rechnung mit dem inneren Zustand des Erzeugers
  const soll = [];
  for (const e of blatt.parcours.elemente) {
    if (e.art === 'segment') soll.push({ art: 'segment', kurs: e.kurs });
    if (e.art === 'gate') for (const z of e.zeilen) soll.push({ art: 'gate', kurs: z.kursDanach });
  }
  const gleich = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < 0.05;
  if (soll.length !== erg.flugKurse.length) abgleichAbweichungen += 1;
  else soll.forEach((s, j) => { abgleichKurse += 1; if (s.art !== erg.flugKurse[j].art || !gleich(s.kurs, erg.flugKurse[j].kurs)) abgleichAbweichungen += 1; });
  statistik.push({ nummer, zahl: erg.zahl, anteilWeg: erg.anteilWeg, verhaeltnis: erg.verhaeltnis, hoeheEnde: erg.hoeheEnde, zulaessig: blatt.parcours.zulaessig });
}

const zaehlung = {};
for (const f of befunde) zaehlung[`${f.kategorie} | ${f.teil} | ${f.regel}`] = (zaehlung[`${f.kategorie} | ${f.teil} | ${f.regel}`] || 0) + 1;
const je = (kategorie) => befunde.filter((f) => f.kategorie === kategorie);
const blaetterMit = (liste) => new Set(liste.map((f) => f.blatt)).size;
const summe = (feld) => statistik.reduce((s, x) => s + (typeof feld === 'function' ? feld(x) : x.zahl[feld]), 0);
console.log(`Logikprüfung Stufe ${STUFE}, Blätter ${VON} bis ${BIS}, ${((Date.now() - beginn) / 1000).toFixed(1)} s`);
console.log(`Geprüft: ${summe('segmente')} Segmente, ${summe('vollkreise')} Vollkreise, ${summe('kurven')} Gradzahl-Kurven, ${summe('relativ')} relative Ecken, ${STUFE === 3 ? `${summe('hr')} HR, ${summe('gk')} GK-Segmente, ${summe('gkZeilen')} GK-Zeilen, ${summe('gkAngabe')} von ${summe('absolut')} Kursangaben als Gegenkurs, ` : ''}${summe('rechen')} Rechenaufgaben, ${summe('richtung')} Himmelsrichtungen, ${summe('gates')} Gates${STUFE === 3 ? ` (Form A ${summe((x) => x.zahl.formen.a)}, B ${summe((x) => x.zahl.formen.b)}, C ${summe((x) => x.zahl.formen.c)}), ${summe((x) => x.zahl.anschluss || 0)} Anschlusszeilen, ${summe('anl')} Zeilen anl. Kurs` : ''}`);
console.log(`Abgleich mit dem Erzeuger: ${abgleichKurse} Kurse, ${abgleichAbweichungen} Abweichungen`);
console.log('');
console.log(Object.entries(zaehlung).sort().map(([k, v]) => `${String(v).padStart(4)}  ${k}`).join('\n') || '   keine Befunde');
console.log('');
for (const kategorie of ['Fehler', 'Unschärfe', 'Hinweis']) console.log(`${kategorie}: ${je(kategorie).length} auf ${blaetterMit(je(kategorie))} Blättern`);
if (JSON_AUS) writeFileSync(JSON_AUS, JSON.stringify({ befunde, statistik }, null, 1));
process.exitCode = je('Fehler').length || abgleichAbweichungen ? 1 : 0;