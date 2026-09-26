# AUA PIT Übungsblätter

Erzeugt Übungsblätter für die PIT-Übungen nach dem Vorbild der Vorlagen "AUA PIT Stufe 2" und "AUA PIT Stufe 3". Jedes Blatt besteht aus einem Textteil (zwölf Anweisungen ab Ausgangskurs 090°, 2000 ft) und einem gezeichneten Parcours, der direkt anschließt.

Die App speichert nichts. Blatt 7 der Stufe 2 ist immer dasselbe Blatt, weil die Nummer den Zufall festlegt.

**Adresse:** https://willi-workflow.github.io/aua-pit-uebungen/

## Stand

- Stufe 2 vollständig: Textteil und Parcours, 100 nummerierte Blätter, Druck auf A4
- Stufe 3 und Endlosmodus folgen

## Zeichensprache

| Linie | Bedeutung |
|---|---|
| dick schwarz | Horizontalflug |
| weiß mit Rand | Sinkflug |
| weiß mit Sprossen | Steigflug |

`250°/15"` Kurs und Sekunden. `SSE/10"` Kurs als Himmelsrichtung. `/30"` ohne Kurs: der Kurs ergibt sich aus der relativen Kursänderung an der Ecke davor (`+90°`, `-156°`). Eine Zahl ohne Gradzeichen an einem Segment (`+230`) ist eine Rechenaufgabe: Kursanzeige plus oder minus die Zahl, Ergebnis laut sagen. Rechenaufgaben können auch an Segmenten ohne Kurs stehen (`/30"` mit `+115`), dann gilt der Kurs, der sich aus der Ecke davor ergibt.

Ein Kasten an der Strecke ist ein Gate: Seine drei bis vier Zeilen werden ohne gezeichnete Linie der Reihe nach aus dem Gedächtnis geflogen, je Zeile ein Kurs (`+72` oder `-400` zum aktuellen Kurs gerechnet, `SSW` oder `123°` direkt), ein Pfeil für Horizontal-, Steig- oder Sinkflug (`→`, `↗`, `↘`) und die Sekunden. Gates stehen auf jedem Blatt mit einer Nummer teilbar durch 3, danach geht es vom Kurs der letzten Zeile auf kürzestem Weg zum Kurs des nächsten Segments.

## Örtlich starten

Die App besteht aus ES-Modulen, deshalb braucht sie einen kleinen Server:

    python3 -m http.server 8765

Dann http://127.0.0.1:8765/ öffnen.

## Prüfen

    node --test

Braucht Node 20 oder neuer, keine Abhängigkeiten.

## Aufbau

| Datei | Zuständigkeit |
|---|---|
| `js/zufall.js` | bestimmter Zufall aus Stufe und Blattnummer |
| `js/kurs.js` | Gradrechnung, Himmelsrichtungen, Schreibweise |
| `js/textteil.js` | Satzschablonen mit Flugzustand |
| `js/parcours.js` | Bausteine, Geometrie, Kreuzungsprüfung, Kandidatensuche |
| `js/zeichnung.js` | SVG aus dem Parcours |
| `js/blatt.js` | Blatt aus Stufe und Nummer |
| `js/app.js` | Adressen und Ansichten |

Entwurf und Plan liegen unter `docs/superpowers/`.
