// Schreibt die Vorschaubilder der Blattliste nach vorschau/stufe<s>/<nummer>.svg,
// für beide Stufen oder nur die angegebene (node werkzeuge/vorschauen.js 3).
// Im Browser wären 100 Blätter zu je rund 0,2 bis 0,3 s zu langsam, deshalb
// werden die Bilder einmal erzeugt und eingecheckt. Nach jeder Änderung an der
// Erzeugung neu ausführen: npm run vorschauen

import { mkdir, writeFile } from 'node:fs/promises';
import { erzeugeBlatt, BLAETTER_JE_STUFE, STUFEN } from '../js/blatt.js';
import { zeichneVorschau } from '../js/zeichnung.js';

const angegeben = process.argv[2] ? Number(process.argv[2]) : null;
if (angegeben !== null && !STUFEN.includes(angegeben)) {
  console.error(`Stufe ${process.argv[2]} gibt es nicht, möglich: ${STUFEN.join(', ')}`);
  process.exit(1);
}

for (const stufe of angegeben === null ? STUFEN : [angegeben]) {
  const ordner = new URL(`../vorschau/stufe${stufe}/`, import.meta.url);
  const start = Date.now();
  await mkdir(ordner, { recursive: true });
  let geschrieben = 0;
  for (let nummer = 1; nummer <= BLAETTER_JE_STUFE; nummer++) {
    const svg = zeichneVorschau(erzeugeBlatt(stufe, nummer).parcours);
    await writeFile(new URL(`${nummer}.svg`, ordner), svg);
    geschrieben += 1;
  }
  const sekunden = ((Date.now() - start) / 1000).toFixed(1).replace('.', ',');
  console.log(`${geschrieben} Vorschaubilder für Stufe ${stufe} geschrieben in ${sekunden} s`);
}
