# AUA PIT Übungsblätter

Erzeugt Übungsblätter für die PIT-Übungen nach dem Vorbild der Vorlagen "AUA PIT Stufe 2" und "AUA PIT Stufe 3". Ein Blatt der Stufe 2 besteht aus einem Textteil (zwölf Anweisungen ab Ausgangskurs 090°, 2000 ft) und einem gezeichneten Parcours, der direkt anschließt. Ein Blatt der Stufe 3 ist nur der Parcours, Start auf 2000 ft mit dem Kurs des ersten Segments.

Die App speichert nichts. Blatt 7 der Stufe 2 ist immer dasselbe Blatt, weil die Nummer den Zufall festlegt.

**Adresse:** https://willi-workflow.github.io/aua-pit-uebungen/

## Stand

- Stufe 2 vollständig: Textteil und Parcours, 100 nummerierte Blätter, Druck auf A4
- Stufe 3 vollständig: nur Parcours nach den drei Vorlagen (PDF, Gegenkursbeispiel, Handzeichnung), 100 nummerierte Blätter, alle mit Gates, Druck auf A4
- Endlosmodus und Blitzrechnen folgen

## Zeichensprache

| Linie | Bedeutung |
|---|---|
| dick schwarz | Horizontalflug |
| weiß mit Rand | Sinkflug |
| weiß mit Sprossen | Steigflug |

`250°/15"` Kurs und Sekunden. `SSE/10"` Kurs als Himmelsrichtung. `/30"` ohne Kurs: der Kurs ergibt sich aus der relativen Kursänderung an der Ecke davor (`+90°`, `-156°`). Eine Zahl ohne Gradzeichen an einem Segment (`+230`) ist eine Rechenaufgabe: Kursanzeige plus oder minus die Zahl, Ergebnis laut sagen. Rechenaufgaben können auch an Segmenten ohne Kurs stehen (`/30"` mit `+115`), dann gilt der Kurs, der sich aus der Ecke davor ergibt.

Ein Kasten an der Strecke ist ein Gate: Seine drei bis vier Zeilen werden ohne gezeichnete Linie der Reihe nach aus dem Gedächtnis geflogen, je Zeile ein Kurs (`+72` oder `-400` zum aktuellen Kurs gerechnet und auf kürzestem Weg gedreht, `SSW` oder `123°` direkt), ein Pfeil für Horizontal-, Steig- oder Sinkflug (`→`, `↗`, `↘`) und die Sekunden. Gates stehen in Stufe 2 auf jedem Blatt mit einer Nummer teilbar durch 3, in Stufe 3 auf jedem Blatt; danach geht es vom Kurs der letzten Zeile auf kürzestem Weg zum Kurs des nächsten Segments.

### Stufe 3

Stufe 3 hat alle Zeichen der Stufe 2 und dazu:

- **Start** und **Ende** stehen fett am Flugzeugsymbol und am Ende des letzten Segments.
- **Gradzahl an einer Kurve** (`300`, `145`, ohne Vorzeichen und Gradzeichen): Die Kurve dreht um diesen Winkel in der gezeichneten Richtung, in ihrer eigenen Linienart; das Segment danach hat keinen Kurs (`/10"`), sein Kurs ist der Kurs davor plus oder minus der Winkel. Ab 180° ist die Kurve eine Schleife.
- **HR** = nächste Himmelsrichtung. `HR/20"`: vom aktuellen Kurs auf die nächste Himmelsrichtung drehen (010° auf N), das ist eine kleine Ecke. `HR 111°/15"`: 111° auf die nächste Himmelsrichtung runden, hier ESE (112,5°).
- **GK** = Gegenkurs. `GK/15"` fliegt den Gegenkurs des aktuellen Kurses; die Kehre davor ist gezeichnet. In Gates `GK` und `GK -19°` (Gegenkurs minus 19).
- **anl. Kurs** = anliegender, also gerade geflogener Kurs: `anl. Kurs +98°` ist der aktuelle Kurs plus 98, `anl. Kurs +7×8` plus 56. Selten, höchstens einmal je Blatt.
- **K** in der letzten Zeile eines Gates ist der Kurs des nächsten gezeichneten Segments: `über N auf K` dreht so, dass die Drehung durch Norden (000°) geht, auch wenn das die lange Seite ist, `über S auf K` durch Süden, `kürz. W. auf K` auf kürzestem Weg.
- **Gates in drei Formen:** wie in der PDF drei Zeilen mit Gradzeichen am Relativwert (`+127° → 15"`) und der Zeile mit K; wie im Gegenkursbeispiel vier Zeilen wie in Stufe 2 (`-322 ↗ 15"`); wie in der Handzeichnung mit dem Pfeil voran (`↗ NNE +102° 15"`, `→ GK 25"`).

Norden ist oben, der Start liegt oben; der Pfeil zeigt nach Norden. Das Flugzeug steht am Start und zeigt in die erste Flugrichtung. In Stufe 2 beginnt der Parcours 20° bis 160° vom Endkurs des Textteils und hält wie der Textteil die Höhe zwischen 1000 und 3000 ft; in Stufe 3 gilt derselbe Höhenrahmen ab 2000 ft.

## Örtlich starten

Die App besteht aus ES-Modulen, deshalb braucht sie einen kleinen Server:

    python3 -m http.server 8765

Dann http://127.0.0.1:8765/ öffnen.

## Prüfen

    node --test

Braucht Node 20 oder neuer, keine Abhängigkeiten. Die Prüfungen erzeugen alle 100 Blätter beider Stufen und dauern gut eine Minute; eine davon stellt sicher, dass die Blätter der Stufe 2 Byte für Byte gleich bleiben.

## Logikprüfung

    node werkzeuge/pruefen.js 2
    node werkzeuge/pruefen.js 3

oder `npm run pruefen -- 3`. Das Werkzeug erzeugt alle 100 Blätter einer Stufe und rechnet sie wie eine Pilotin nach, nur aus den Sätzen des Textteils und der gezeichneten Grafik: jeder Kurs, jede Ecke, Kurve, Gate-Zeile und Anschlusszeile, die Höhe, die Mengen, Kreuzungen, Strichabstände und ob jede Beschriftung frei steht. Die Tinte der Texte berechnet es aus in Chrome gemessenen Zeichenmaßen, ein Browser ist nicht nötig. Am Ende gleicht es die eigene Rechnung mit dem Erzeuger ab. Ausgabe sind Befunde in drei Stufen: Fehler (falsch oder nicht fliegbar), Unschärfe (fliegbar, aber missverständlich) und Hinweis. Mit `--blaetter 1-10` nur einige Blätter, mit `--json datei.json` alle Befunde als Datei. Bei einem Fehler endet es mit Rückgabewert 1. Stand 27.09.2026: beide Stufen 0 Fehler.

## Aufbau

| Datei | Zuständigkeit |
|---|---|
| `js/zufall.js` | bestimmter Zufall aus Stufe und Blattnummer |
| `js/kurs.js` | Gradrechnung, Himmelsrichtungen, Schreibweise |
| `js/textteil.js` | Satzschablonen mit Flugzustand |
| `js/elemente.js` | Bausteine und Mengen je Stufe |
| `js/geometrie.js` | Weg, Beschriftungen, Kreuzungs- und Abstandsprüfung |
| `js/parcours.js` | Kandidatensuche |
| `js/zeichnung.js` | SVG aus dem Parcours |
| `js/blatt.js` | Blatt aus Stufe und Nummer |
| `js/app.js` | Adressen und Ansichten |

Entwurf und Plan liegen unter `docs/superpowers/`.

## Vorschaubilder

Die Blattliste zeigt zu jedem Blatt ein kleines Bild des Parcours, Norden ist oben, der Start liegt oben, mit kleinem Nordpfeil. Die Bilder liegen fertig unter `vorschau/stufe2/<nummer>.svg` und `vorschau/stufe3/<nummer>.svg`, weil 100 Blätter im Browser zu lange zum Berechnen bräuchten. Erzeugt werden sie von `werkzeuge/vorschauen.js` über `zeichneVorschau` in `js/zeichnung.js`:

    npm run vorschauen

Nach jeder Änderung an der Erzeugung der Blätter (Textteil, Parcours, Zufall, Zeichnung der Vorschau) muss dieser Befehl laufen und die neuen Bilder gehören mit in den Commit. Die Prüfung `test/vorschau.test.js` erzwingt das: Sie vergleicht eine Stichprobe der Dateien mit dem aktuellen Erzeuger und schlägt mit dem Hinweis auf `npm run vorschauen` fehl, wenn die Bilder veraltet sind.
