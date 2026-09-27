# AUA PIT Übungsblätter

Erzeugt Übungsblätter für die PIT-Übungen nach dem Vorbild der Vorlagen "AUA PIT Stufe 2" und "AUA PIT Stufe 3". Ein Blatt der Stufe 2 besteht aus einem Textteil (zwölf Anweisungen ab Ausgangskurs 090°, 2000 ft) und einem gezeichneten Parcours, der direkt anschließt. Ein Blatt der Stufe 3 ist genauso aufgebaut, Textteil und Parcours, der Parcours mit den zusätzlichen Zeichen der Stufe 3.

Die App speichert nichts außer den Einstellungen des Blitzrechnens, und die nur auf dem Gerät. Blatt 7 der Stufe 2 ist immer dasselbe Blatt, weil die Nummer den Zufall festlegt.

**Adresse:** https://willi-workflow.github.io/aua-pit-uebungen/

## Stand

- Stufe 2 vollständig: Textteil und Parcours, 100 nummerierte Blätter, Druck auf A4
- Stufe 3 vollständig: Textteil wie Stufe 2 und Parcours nach den drei Vorlagen (PDF, Gegenkursbeispiel, Handzeichnung), 100 nummerierte Blätter, alle mit Gates, Druck auf A4
- Blitzrechnen vollständig: Kopfrechnen mit Kursen (geschrieben, per Ton oder beides) und Ausschnitte für Stufe 2 und Stufe 3
- Endlosmodus folgt

## Zeichensprache

| Linie | Bedeutung |
|---|---|
| dick schwarz | Horizontalflug |
| weiß mit Rand | Sinkflug |
| weiß mit Sprossen | Steigflug |

`250°/15"` Kurs und Sekunden. `SSE/10"` Kurs als Himmelsrichtung. `/30"` ohne Kurs: der Kurs ergibt sich aus der relativen Kursänderung an der Ecke davor (`+90°`, `-156°`) oder aus der Gradzahl an der Kurve davor. **Gradzahl an einer Kurve** (`300`, `145`, ohne Vorzeichen und Gradzeichen) wie in den Handzeichnungen: Die Kurve dreht um diesen Winkel in der gezeichneten Richtung, in ihrer eigenen Linienart; ab 180° ist sie eine Schleife, deren Ein- und Ausfahrt sich sauber kreuzen. Eine Zahl ohne Gradzeichen an einem Segment (`+230`) ist eine Rechenaufgabe: Kursanzeige plus oder minus die Zahl, Ergebnis laut sagen. Rechenaufgaben können auch an Segmenten ohne Kurs stehen (`/30"` mit `+115`), dann gilt der Kurs, der sich aus der Ecke oder Kurve davor ergibt.

In Stufe 2 ist wie in den Vorlagen fast jeder Kurs auszurechnen: je Blatt 8 bis 11 Kursberechnungen, 3 bis 4 relative Ecken und 5 bis 7 Gradzahl-Kurven (Winkel 30 bis 350, rund ein Drittel Schleifen; auf Blättern mit Gates 4 bis 6), dazu 5 bis 7 Rechenaufgaben mit Beträgen von 100 bis 490, 3 bis 4 Himmelsrichtungen und zwei Vollkreise; die übrigen Segmente tragen einen Gradkurs.

Ein Kasten an der Strecke ist ein Gate: Seine drei bis vier Zeilen werden ohne gezeichnete Linie der Reihe nach aus dem Gedächtnis geflogen, je Zeile ein Kurs (`+72` oder `-400` zum aktuellen Kurs gerechnet und auf kürzestem Weg gedreht, `SSW` oder `123°` direkt), ein Pfeil für Horizontal-, Steig- oder Sinkflug (`→`, `↗`, `↘`) und die Sekunden. Gates stehen in Stufe 2 auf jedem Blatt mit einer Nummer teilbar durch 3, in Stufe 3 auf jedem Blatt; danach geht es vom Kurs der letzten Zeile auf kürzestem Weg zum Kurs des nächsten Segments. Den Hinweis dazu ("Mit Gates: …") tragen nur die Gate-Blätter der Stufe 2; auf den Blättern der Stufe 3 steht über dem Parcours nur der Textteil, Kürzel und Regeln setzt sie voraus.

### Stufe 3

Stufe 3 hat alle Zeichen der Stufe 2 und dazu:

- **Start** und **Ende** stehen fett am Flugzeugsymbol und am Ende des letzten Segments. Die Höhe am Start ist die nach dem letzten Satz des Textteils.
- **HR** = nächste Himmelsrichtung. `HR/20"`: vom aktuellen Kurs auf die nächste Himmelsrichtung drehen (010° auf N), das ist eine kleine Ecke. `HR 111°/15"`: 111° auf die nächste Himmelsrichtung runden, hier ESE (112,5°).
- **GK** = Gegenkurs. `GK/15"` fliegt den Gegenkurs des aktuellen Kurses; die Kehre davor ist gezeichnet. In Gates `GK` und `GK -19°` (Gegenkurs minus 19). Wie in der Handzeichnung kommt Gegenkurs je Blatt drei- bis fünfmal vor: ein bis zwei Segmente `GK/…`, nie zwei direkt hintereinander, und zwei bis drei Gate-Zeilen.
- **anl. Kurs** = anliegender, also gerade geflogener Kurs: `anl. Kurs +98°` ist der aktuelle Kurs plus 98, `anl. Kurs +7×8` plus 56, `anl. Kurs +9×13` plus 117. Selten, höchstens einmal je Blatt.
- **K** in der letzten Zeile eines Gates ist der Kurs des nächsten gezeichneten Segments: `über N auf K` dreht so, dass die Drehung durch Norden (000°) geht, auch wenn das die lange Seite ist, `über S auf K` durch Süden, `kürz. W. auf K` auf kürzestem Weg.
- **Gates in drei Formen:** wie in der PDF drei Zeilen mit Gradzeichen am Relativwert (`+127° → 15"`, bis `+190°`, das Vorzeichen nennt die Richtung), höchstens eine davon mit Gegenkurs (`GK → 15"`, `GK -19° ↘ 20"`), und der Zeile mit K; wie im Gegenkursbeispiel vier Zeilen wie in Stufe 2 (`-322 ↗ 15"`), ohne Gegenkurs; wie in der Handzeichnung mit dem Pfeil voran (`↗ NNE +102° 15"`, `→ GK 25"`), mit mindestens einer Zeile Gegenkurs.

Jede Beschriftung steht deutlich näher an ihrem eigenen Strich als an jedem anderen, zu dem sie passen könnte, und Schleifen kreuzen Ein- und Ausfahrt sauber. Norden ist oben, der Start liegt oben; der Pfeil zeigt nach Norden. Das Flugzeug steht am Start und zeigt in die erste Flugrichtung. In beiden Stufen beginnt der Parcours 20° bis 160° vom Endkurs des Textteils und hält wie der Textteil die Höhe zwischen 1000 und 3000 ft, ab der Höhe nach dem letzten Satz.

## Blitzrechnen

Unter `#/blitzrechnen` (Karte mit Blitz unter der Kursrose) drei Übungen, jede ohne Ende, mit Zähler "richtig / gesamt" und Serie, nichts wird gespeichert:

- **Kopfrechnen mit Kursen** (`#/blitzrechnen/kopfrechnen`): Kurs plus oder minus eine Zahl von 20 bis 490 (`247 + 230`, Antwort modulo 360), Gegenkurs, Himmelsrichtung in Grad, nächste Himmelsrichtung zu einem Kurs (Antwort über 16 Knöpfe) und `GK −19° ab 247`. Die Aufgabe steht geschrieben da, wird per Ton angesagt oder beides; per Ton beginnt die Antwortzeit erst nach der Ansage, "Nochmal hören" spielt sie erneut.
- **Blitzrechnen Stufe 2 und Stufe 3** (`#/blitzrechnen/stufe2`, `…/stufe3`): Ein Ausschnitt wie auf dem Blatt ("Ankunft auf Kurs 247", Startsegment, ein Aufgabenelement, Folgesegment) ist für die Anzeigezeit zu sehen und verschwindet dann; danach kommen die Fragen, bei einem Gate eine je Zeile mit eigener Antwortzeit, bei Form A zuletzt der Drehsinn zum nächsten Kurs. Zum Schluss steht der Ausschnitt wieder da, die Lösungen daneben. Stufe 2: relative Ecke, Rechenaufgabe, Himmelsrichtung, Gate mit drei Zeilen. Stufe 3 zusätzlich `HR/`, `HR 111°/`, `GK/`, Gradzahl-Kurve, Gates der Formen A, B, C und `anl. Kurs`. Die Ausschnitte werden aus Ketten der Blatterzeugung geschnitten, ohne Kandidatensuche, und nur genommen, wenn sie kreuzungsfrei sind und alle Beschriftungen frei stehen.

**Einstellungen** (`#/blitzrechnen/einstellungen`, gespeichert im Browser unter `blitzrechnen.einstellungen`, ohne Speicher gelten die Vorgaben): Antwortart Eintippen mit Prüfung (Vorgabe) oder Auflösung ohne Tippen mit "Hatte ich" und "Hatte ich nicht", Anzeigezeit 3, 5 oder 8 s, Antwortzeit 10, 15 oder 20 s, Aufgabenstellung beim Kopfrechnen geschrieben, per Ton oder beides. Beim Eintippen zählen 000 und 360 gleich; liegt die Lösung auf einem halben Grad (202,5), zählen 202, 203 und 202,5.

**Tonschnipsel** liegen als MP3 unter `klaenge/` (rund 12 MB, Herkunft in `klaenge/HERKUNFT.md`). Fehlende Wörter erzeugt `python3 werkzeuge/klaenge_erzeuge.py` über ElevenLabs, mit dem Schlüssel aus dem Schlüsselbund.

**Prüfmodus** für Bildschirmfotos: Eine Übungsadresse mit `?probe=` zeigt einen Zustand direkt, mit angehaltenem Zeitbalken und ohne Ton, etwa `#/blitzrechnen/stufe3?probe=ausgeblendet&art=gate`. Werte: beim Kopfrechnen `aufgabe`, `ergebnis`, `loesung`; bei den Stufen `anzeige`, `ausgeblendet`, `loesung`. Dazu wahlweise `art=` (Aufgabenart), `saat=`, `frage=` (Nummer ab 0), `antwort=eintippen|aufloesung`, `stellung=geschrieben|ton|beides`.

## Örtlich starten

Die App besteht aus ES-Modulen, deshalb braucht sie einen kleinen Server:

    python3 -m http.server 8765

Dann http://127.0.0.1:8765/ öffnen.

## Prüfen

    node --test

Braucht Node 20 oder neuer, keine Abhängigkeiten. Die Prüfungen erzeugen alle 100 Blätter beider Stufen und dauern gut eine Minute; eine davon stellt sicher, dass die Textteile der Stufe 2 Byte für Byte gleich bleiben. Für das Blitzrechnen rechnen sie je Stufe 200 Ausschnitte aus den gezeichneten Beschriftungen nach, prüfen jede Kopfaufgabe gegen ihren Text und jede Tonfolge gegen die Dateien unter `klaenge/`.

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
| `js/zeichnung.js` | SVG aus dem Parcours, für Ausschnitte ohne Nordpfeil |
| `js/blatt.js` | Blatt aus Stufe und Nummer |
| `js/app.js` | Adressen und Ansichten |
| `js/kopfrechnen.js` | Blitzrechnen: Kopfaufgaben mit Text, Lösung und Tonfolge |
| `js/ausschnitt.js` | Blitzrechnen: Ausschnitte aus der Blatterzeugung, Fragen und Lösungen |
| `js/antwort.js` | Blitzrechnen: Antworten lesen, prüfen, als Lösung schreiben |
| `js/blitzeinstellungen.js` | Blitzrechnen: Einstellungen auf dem Gerät |
| `js/blitzansicht.js` | Blitzrechnen: Seiten und Zustände als HTML, Prüfmodus |
| `js/blitzlauf.js` | Blitzrechnen: Ablauf im Browser, Zeitgeber, Ton, Eingaben |
| `klaenge/` | Tonschnipsel des Kopfrechnens |

Entwurf und Plan liegen unter `docs/superpowers/`.

## Vorschaubilder

Die Blattliste zeigt zu jedem Blatt ein kleines Bild des Parcours, Norden ist oben, der Start liegt oben, mit kleinem Nordpfeil. Die Bilder liegen fertig unter `vorschau/stufe2/<nummer>.svg` und `vorschau/stufe3/<nummer>.svg`, weil 100 Blätter im Browser zu lange zum Berechnen bräuchten. Erzeugt werden sie von `werkzeuge/vorschauen.js` über `zeichneVorschau` in `js/zeichnung.js`:

    npm run vorschauen

Nach jeder Änderung an der Erzeugung der Blätter (Textteil, Parcours, Zufall, Zeichnung der Vorschau) muss dieser Befehl laufen und die neuen Bilder gehören mit in den Commit. Die Prüfung `test/vorschau.test.js` erzwingt das: Sie vergleicht eine Stichprobe der Dateien mit dem aktuellen Erzeuger und schlägt mit dem Hinweis auf `npm run vorschauen` fehl, wenn die Bilder veraltet sind.
