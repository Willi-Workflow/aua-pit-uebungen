// Schreibt die Vorschaubilder der Blattliste nach vorschau/stufe2/<nummer>.svg.
// Im Browser wären 100 Blätter zu je rund 0,2 s zu langsam, deshalb werden die
// Bilder einmal erzeugt und eingecheckt. Nach jeder Änderung an der Erzeugung
// neu ausführen: npm run vorschauen

import { mkdir, writeFile } from 'node:fs/promises';
import { erzeugeBlatt, BLAETTER_JE_STUFE } from '../js/blatt.js';
import { zeichneVorschau } from '../js/zeichnung.js';

const STUFE = 2;
const ordner = new URL(`../vorschau/stufe${STUFE}/`, import.meta.url);

const start = Date.now();
await mkdir(ordner, { recursive: true });
let geschrieben = 0;
for (let nummer = 1; nummer <= BLAETTER_JE_STUFE; nummer++) {
  const svg = zeichneVorschau(erzeugeBlatt(STUFE, nummer).parcours);
  await writeFile(new URL(`${nummer}.svg`, ordner), svg);
  geschrieben += 1;
}
const sekunden = ((Date.now() - start) / 1000).toFixed(1).replace('.', ',');
console.log(`${geschrieben} Vorschaubilder für Stufe ${STUFE} geschrieben in ${sekunden} s`);
