# PIT-Übungsblätter, Entwurf für den ersten Bauabschnitt

Stand: 26.09.2026

## Ziel

Eine Browser-App, die Übungsblätter für die PIT-Übungen (AUA) erzeugt, nach dem Vorbild der beiden Vorlagen `AUA PIT Stufe 2.pdf` und `AUA PIT Stufe 3.pdf`. Hannah öffnet die App auf dem Handy oder Rechner, wählt eine Stufe und ein nummeriertes Blatt und fliegt es im Simulator ab. Die App erzeugt nur, sie speichert nichts und kennt keine Nutzer.

Dieser erste Bauabschnitt umfasst:

- das App-Gerüst mit Startseite, Stufenwahl, Blattliste und Blattansicht
- Stufe 2 vollständig: Textteil plus gezeichneter Parcours
- Druckansicht auf A4 hochkant
- Veröffentlichung über GitHub Pages

Nicht in diesem Abschnitt, aber in der Adressstruktur schon vorgesehen:

- Stufe 3 (die Kürzel `HR`, `GK`, `K`, `anl. Kurs` sind noch ungeklärt)
- Endlosmodus je Stufe
- zufällig gemischte Schreibweise der Himmelsrichtungen

## Fachliche Grundlagen

### Ablauf einer Übung der Stufe 2

Ausgangskurs und Ausgangshöhe sind immer gleich: **090°, 2000 ft**. Die Übung beginnt mit dem Textteil, der von dort aus geflogen wird. Direkt anschließend, ohne Unterbrechung, folgt der gezeichnete Parcours. Er übernimmt Kurs und Höhe nach der letzten Zeile des Textteils: Sein erstes Segment trägt einen eigenen Kurs, 20° bis 160° vom Endkurs des Textteils, damit die Drehrichtung auf kürzestem Weg eindeutig ist, und die Höhe bleibt wie im Textteil zwischen 1000 und 3000 ft.

### Zeichensprache des Parcours

| Zeichen | Bedeutung |
|---|---|
| dicke schwarze Linie | Horizontalflug |
| weiße Linie mit dünnem schwarzem Rand | Sinkflug |
| weiße Linie mit Sprossen (Leiter) | Steigflug |
| `250°/15"` | Kurs 250°, 15 Sekunden halten |
| `SSE/10"` | Kurs als Himmelsrichtung (englische Schreibweise) |
| `/30"` | Segment ohne Kursangabe, Kurs ergibt sich aus der relativen Kursänderung an der Ecke davor |
| `+90°`, `-156°` an einer Ecke | relative Kursänderung, plus nach rechts, minus nach links |
| `+230`, `-156` ohne Gradzeichen an einem Segment mit Kurs | Rechenaufgabe: Kursanzeige plus oder minus die Zahl, Ergebnis laut sagen. Kein Einfluss auf Flugweg oder Linie |
| Vollkreis (Schleife) | 360°-Kurve, Querstrich bei 180°, Profil kann sich dort ändern |
| kurze Querstriche | Übergang zwischen zwei Elementen |

Regel zur Unterscheidung: Relative Kursänderungen stehen nur an Ecken vor Segmenten ohne Kurs. Rechenaufgaben stehen nur an Segmenten mit Kurs. Beides zugleich gibt es nicht.

### Himmelsrichtungen

Sechzehn Richtungen im Abstand von 22,5°. Schreibweise je Kontext, als Einstellung in `kurs.js` hinterlegt:

- Textteil: deutsch (N, NNO, NO, ONO, O, OSO, SO, SSO, S, SSW, SW, WSW, W, WNW, NW, NNW)
- Zeichnung: englisch (N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW)

Eine spätere Umstellung auf zufällig gemischte Schreibweise soll nur diese Einstellung betreffen.

## Erzeugung des Textteils

Die Erzeugung führt einen **Flugzustand** mit: aktueller Kurs in Grad und Höhe in Fuß, Start bei 090° und 2000 ft. Jede Zeile entsteht aus einer Satzschablone, die aus dem Zustand einen Satz bildet und den Zustand fortschreibt.

### Satzschablonen

| Schablone | Beispiel | Zustandsänderung |
|---|---|---|
| Absoluter Kurs ohne Richtung | Auf Kurs 270 drehen, Horizontalflug 20 s. | Kurs = 270 |
| Relative Kurve | Linkskurve um 55°, neuer Kurs 15 s. | Kurs = Kurs − 55 |
| Kurve auf Himmelsrichtung | Linkskurve auf SSW, 20 s Sinkflug. | Kurs = 202,5 |
| Kurve auf Gradkurs | Links auf 140°, 15 s Sinkflug. | Kurs = 140 |
| Schnellster Weg | Auf schnellstem Weg nach 195°, 10 s geradeaus. | Kurs = 195 |
| Gegenkurs | Links auf den Gegenkurs von SSW, 20 s Sinkflug. | Kurs = 22,5 |
| Vollkreis geteilt | Vollkreis nach rechts, erste 180° Steigflug, zweite 180° horizontal. | Kurs unverändert |
| Halbkreis geteilt | 180°-Kurve nach rechts, erst 90° Sinkflug, zweite 90° Steigflug, 10 s geradeaus. | Kurs = Kurs + 180 |
| Höhe mit Einleitung | Rechts auf 340°, 500 ft sinken, nach 250 ft Linkskurve auf 170° einleiten. | Kurs = 170, Höhe − 500 |

Bei Schablonen mit ausdrücklicher Drehrichtung (Links auf, Rechts auf, Linkskurve auf) wird der Zielkurs so gewählt, dass die Drehung in dieser Richtung zwischen 20° und 340° beträgt. Beim Halbkreis richtet sich die Drehrichtung nach dem Satz.

### Regeln

- **12 Zeilen** je Blatt, darüber die Zeile "Ausgangskurs 090°, 2000 ft".
- Vollkreis, Halbkreis und Höhe mit Einleitung kommen **höchstens je einmal** vor, die übrigen Schablonen füllen den Rest, keine Schablone dreimal hintereinander.
- **Zeiten** 10, 15 oder 20 s.
- **Höhenangaben** in Schritten von 50 ft, zwischen 200 und 800 ft, Einleitungspunkt zwischen 100 ft und Gesamthöhe minus 100 ft.
- **Kein trivialer Kurswechsel**: neuer Kurs mindestens 20° vom aktuellen entfernt. Bei relativen Kurven liegt der Winkel zwischen 20° und 160°.
- **Profile** horizontal, steigen, sinken etwa gleich verteilt, kein Profil öfter als dreimal hintereinander.
- **Höhe bleibt im Rahmen** 1000 bis 3000 ft. Die Erzeugung rechnet mit 500 ft/min (etwa 8 ft/s) und wählt bei drohender Grenzüberschreitung das Gegenprofil.

## Erzeugung des Parcours

### Bausteine

**Segment**

- Kurs: Grad (ganzzahlig, 000 bis 359), Himmelsrichtung, oder keine Angabe (dann relative Kursänderung an der Ecke davor)
- Dauer: 10, 15, 20 oder 30 s, 30 s selten
- Profil: horizontal, steigen, sinken
- Rechenaufgabe: keine oder eine ganze Zahl von ±100 bis ±350, auch an Segmenten ohne Kurs (Vorlage: `+115` unter `/30"`)

**Vollkreis**

- Drehrichtung links oder rechts
- Profil je Hälfte, die beiden Hälften dürfen gleich oder verschieden sein
- Kurs vor und nach dem Vollkreis ist derselbe

**Ecke** zwischen zwei Elementen

- Folgt ein Segment mit Kurs: Drehung auf kürzestem Weg, keine Beschriftung. Kursunterschied zwischen 20° und 160°, damit die Richtung eindeutig ist.
- Folgt ein Segment ohne Kurs: relative Kursänderung zwischen 20° und 340°, nicht 180°, mit Vorzeichen als Beschriftung an der Ecke.
- Vor einem Vollkreis: keine Drehung.

### Mengen je Blatt

- 18 bis 22 Segmente
- 2 Vollkreise, nicht direkt hintereinander, nicht am Anfang oder Ende
- 3 bis 4 Ecken mit relativer Kursänderung
- 4 bis 5 Rechenaufgaben
- 3 bis 4 Kurse als Himmelsrichtung, alle übrigen in Grad
- Profile etwa gleich verteilt, kein Profil öfter als dreimal hintereinander (Vollkreishälften zählen mit)
- Höhe ab der Endhöhe des Textteils zwischen 1000 und 3000 ft, gerechnet mit 8 ft/s: Segmente mit ihrer Dauer, Vollkreishälften 60 s, Gate-Zeilen mit ihren Sekunden, Ecken ohne Höhenänderung. Die Profilwahl schließt Steig- oder Sinkflug aus, der den Rahmen verließe; bei Gate-Zeilen steht die Dauer dafür vor dem Profil fest.

### Passform

Die Zeichnung ist geografisch echt, deshalb ergeben zufällige Kurse oft Knäuel. Die Erzeugung zieht aus dem Zufallsstrom des Blatts **4000 Kandidaten**, ungedreht: Norden zeigt immer nach oben, wie in der Vorlage. Alle Prüfungen laufen auf dieser ungedrehten Geometrie, billige zuerst. Zulässig ist ein Kandidat, der alle Bedingungen erfüllt:

1. Der Weg kreuzt sich nicht selbst (Kreisbögen als Polygonzüge, benachbarte Stücke zählen nicht; die Kreuzung von Ein- und Ausfahrt einer Schleife über 180° ist gewollt).
2. Die Striche berühren sich höchstens: Mittellinien mindestens 9 Einheiten auseinander, sobald eine Strecke dazwischen liegt. Das Flugzeugsymbol am Start (Kreis mit Radius 14) ist dabei ein Hindernis für alle Stücke außer der ersten Strecke.
3. Das Verhältnis Breite zu Höhe des Umrisses liegt zwischen 0,7 und 1,25.
4. Der Start liegt im oberen Teil des Umrisses, höchstens 34 % der Höhe von oben (`START_OBEN`).
5. Jede Beschriftung steht frei: Kein fremder Strich, keine andere Beschriftung und nicht das Flugzeugsymbol berühren sie. Angrenzende Schleifen und Vollkreishälften zählen dabei als fremd, nur die eigene Strecke und gewöhnliche Eckbögen nicht.

Der Start liegt also nicht durch eine Drehung des Blatts oben, sondern weil die Auswahl unter den vielen probierten Verläufen nur einen mit dem Start im oberen Teil zulässt.

Unter den zulässigen gewinnt der mit der höchsten Füllung (Weglänge je Umrisskante), bei Gleichstand der frühere. Ist keiner zulässig, gewinnt der mit den wenigsten Kreuzungen, dann dem größten Strichabstand, den wenigsten verdeckten Beschriftungen, dem Start oben und dem Seitenverhältnis am nächsten an 1. Die Kandidatensuche ist Teil des bestimmten Zufallsstroms, gleiche Blattnummer ergibt also immer denselben Kandidaten.

## Gates

Vorbild sind die Kästen in der Handzeichnung zur Stufe 2 (Fotos vom 29.07.2026 im Vorlagenordner `Stufe 2/`).

### Fachliche Regel

Ein Gate ist eine Folge von drei bis vier Anweisungen, die aus dem Gedächtnis geflogen werden; die zugehörigen Segmente werden nicht gezeichnet. Man kommt mit dem Kurs des vorherigen Segments am Gate an. Je Zeile gilt:

- **Erster Wert:** Eine Zahl mit Vorzeichen (`+72`, `-400`) wird mit dem aktuellen Kurs verrechnet (`090 + 72 = 162`, `123 - 400 = -277 = 083`). Eine Himmelsrichtung (`SSW`) oder ein Gradkurs (`123°`) gilt direkt.
- **Pfeil:** `→` Horizontalflug, `↗` Steigflug, `↘` Sinkflug.
- **Zahl dahinter:** Dauer in Sekunden.

```
+72 → 10"
SSW ↗ 15"
123° → 15"
-400 ↘ 10"
```

Nach dem Gate gilt der Kurs der letzten Zeile. Das nächste gezeichnete Segment trägt immer einen eigenen Kurs und wird von dort auf kürzestem Weg angesteuert.

### Verteilung

Blätter mit einer Nummer teilbar durch 3 (3, 6, …, 99) haben Gates, alle anderen keine. Das entscheidet `hatGates(stufe, nummer)` in `js/blatt.js`; die Blattliste kann Gate-Blätter damit später kennzeichnen. Ohne Gates zieht die Erzeugung genau dieselben Zufallszahlen wie vorher, die übrigen Blätter bleiben also unverändert.

### Datenmodell

Ein Gate ist ein eigenes Element der Kette:

```js
{ art: 'gate', zeilen: [{ kurs, kursDanach, profil, dauer }, …] }
```

`kurs` ist `{ typ: 'relativ', wert }`, `{ typ: 'himmelsrichtung', index }` oder `{ typ: 'grad', grad }`, `kursDanach` der Kurs nach der Zeile.

- **15 bis 19 gezeichnete Segmente** auf Gate-Blättern statt 18 bis 22, wie in der Handzeichnung mit vier Kästen; mit 18 bis 22 wurde die Zeichnung so groß, dass die Schrift im Druck bei 11 von 33 Gate-Blättern unter 6 pt lag.
- **3 bis 4 Gates** je Gate-Blatt, an Ecken zwischen zwei Segmenten; mindestens zwei Segmente zwischen zwei Gates, keins direkt vor oder nach einem Vollkreis, keins am ersten oder letzten Segment. Auch bei 15 Segmenten bleiben dafür mindestens sechs Stellen, und die reichen immer für drei Gates.
- **3 bis 4 Zeilen** je Gate, etwa zur Hälfte relativ, zu je einem Viertel Himmelsrichtung und Gradkurs, mindestens eine relative Zeile.
- **Relativwerte** mit Betrag 20 bis 490 und beiden Vorzeichen; der Kurs danach liegt mindestens 20° vom Kurs davor. Himmelsrichtung und Gradkurs liegen wie bei Segmenten 20° bis 160° vom Kurs davor.
- **Profil** über dieselbe Wahl wie bei Segmenten; die Gate-Zeilen zählen für die Bilanz und für "nie viermal hintereinander" mit. **Dauer** 10, 15 oder 20 s.
- Das **Segment nach einem Gate** hat immer eine Kursangabe (Grad oder Himmelsrichtung), keine relative Ecke, weil die Ecke im Gate verschwindet. Sein Kurs liegt 20° bis 160° vom letzten Gate-Kurs.

### Zeichnung und Passform

- Der Kasten ist achsenparallel, 6,2 Einheiten je Zeichen der längsten Zeile plus 10 breit und 9 je Zeile plus 8 hoch. Die ankommende Linie endet ohne Bogen am Kastenrand, der Mittelpunkt liegt in Richtung ihres Kurses dahinter. Die nächste Linie beginnt dort, wo ihr Kurs vom Mittelpunkt aus den Rand verlässt, mit einem Querstrich.
- Verlässt die Linie den Kasten schräg, rückt der Querstrich auf ihr so weit nach außen, dass er höchstens 2 Einheiten in den Kasten ragt und den Text nicht berührt.
- Der Kasten ist weiß mit schwarzem Rand und liegt über den Linien, darüber Querstriche und Texte. Die Zeilen stehen linksbündig und senkrecht mittig im Kasten.
- In der Kandidatensuche ist der Kasten ein Stück wie eine Strecke: Fremde Stücke dürfen ihn nicht kreuzen und bleiben mindestens eine Strichbreite entfernt. Die Strecken davor und danach werden gegeneinander geprüft, damit der Austritt nicht auf der Ankunft liegt. Andere Beschriftungen halten Abstand zum Kasten und stehen nicht darin.

## Zeichnung

SVG, Segmentlänge proportional zur Dauer. Norden zeigt immer nach oben, wie in der Vorlage; das Blatt wird nicht gedreht. Der Start liegt trotzdem oben, weil die Kandidatensuche (siehe Passform) unter den probierten Verläufen nur die mit dem Start im oberen Teil des Umrisses zulässt, höchstens `START_OBEN` von der Höhe. Technisch kann die Geometrie gedreht werden (Parameter `drehung` der Funktion `geometrie`, Standardwert 0), die Blätter nutzen das nicht.

Ein Nordpfeil oben rechts neben dem Umriss zeigt nach Norden, wie in der Handzeichnung: Länge 44, Spitze als Dreieck, ein fettes N 8 Einheiten vor der Spitze, Mitte 30 Einheiten rechts und unterhalb der oberen rechten Ecke. Da Norden in der Zeichnung immer oben liegt, zeigt der Pfeil auf jedem Blatt nach oben. Ein Flugzeugsymbol 19 Einheiten hinter dem Start zeigt in Richtung des ersten Segments. Beide zählen nicht zum Umriss, die `viewBox` wächst um sie.

Startwerte für die Geometrie (in Einheiten des SVG-Koordinatensystems, im Bau anpassbar):

- 1 s Dauer = 5 Einheiten Länge
- Eckenradius 12, Vollkreisradius 35
- Linienbreite 9 für Horizontalflug; Sinken und Steigen als schwarze Linie der Breite 9 mit darüberliegender weißer Linie der Breite 6, beim Steigen die weiße Linie gestrichelt, so dass die Lücken als Sprossen erscheinen

Der Vollkreis ist eine Schleife, die den Weg am Übergangspunkt berührt und ihn dort in derselben Richtung wieder verlässt. Querstriche an jedem Übergang und bei 180° im Vollkreis, senkrecht zum Weg, etwa doppelt so lang wie die Linienbreite.

Beschriftungen laufen parallel zum Segment, um wenige Einheiten zur Seite versetzt, und werden um 180° gedreht, wenn sie sonst auf dem Kopf stünden. Rechenaufgaben stehen in einer zweiten Zeile unter der Kursangabe. Relative Kursänderungen stehen an der Ecke, außen am Bogen. Beschriftungen stehen frei (siehe Passform).

Nach der Erzeugung wird der Umriss samt Beschriftungsrand über die `viewBox` auf die Zeichenfläche skaliert.

## Bestimmter Zufall

Jedes Blatt entsteht aus einem Zufallsgenerator (mulberry32), der mit einem Hash der Zeichenkette `stufe-2/blatt-7` gestartet wird. Gleiche Nummer, gleiches Blatt, ohne Speicherung. Je Stufe gibt es **100 Blätter**, die Zahl ist eine Konstante in `app.js`.

Randbedingung: Jede Änderung an der Erzeugungslogik verändert alle Blätter. Solange Hannah nicht auf bestimmte Nummern angewiesen ist, wird das hingenommen. Falls das später stört, wird eine Versionsnummer in den Startwert aufgenommen.

## Oberfläche

Eine Seite mit drei Ansichten, umgeschaltet über den Adressanker:

| Adresse | Ansicht |
|---|---|
| `#/` | Startseite: Titel, zwei große Knöpfe "Stufe 2" und "Stufe 3" |
| `#/stufe2` | Stufenseite: Zurück, Titel, Liste der Blätter 1 bis 100 als Zahlenraster |
| `#/stufe2/blatt/7` | Blattansicht |
| `#/stufe3` | Platzhalter "Stufe 3 kommt in einem späteren Abschnitt" |
| `#/stufe2/endlos` | reserviert für den Endlosmodus, vorerst Platzhalter |

**Blattansicht**: Kopfleiste mit Zurück, "Stufe 2 · Blatt 7" und "Drucken". Darunter das Blatt: Titel "AUA PIT Stufe 2, Blatt 7", Zeile "Ausgangskurs 090°, 2000 ft", die 12 Textzeilen, der Parcours als SVG, darunter eine kleine Legende der drei Linienarten. Auf dem Handy skaliert das SVG auf Bildschirmbreite.

**Druck**: `@media print` blendet Kopfleiste und Navigation aus, das Blatt füllt eine A4-Seite hochkant, das SVG ist so begrenzt, dass alles auf eine Seite passt.

**Gestaltung**: Systemschrift, Schwarz auf Weiß, ein Grau für die Kopfleiste, keine Farben in der Zeichnung, keine Kacheln, keine Schatten. Das Blatt ist der Inhalt.

## Technik

- HTML, CSS und JavaScript ohne Bausystem, ES-Module über `<script type="module">`
- Örtlich starten mit `python3 -m http.server`, weil Module nicht per Doppelklick auf die Datei laden
- Keine Abhängigkeiten, weder zur Laufzeit noch zum Prüfen

### Dateien

```
index.html                  Gerüst, lädt js/app.js
style.css                   Bildschirm und Druck
js/app.js                   Adressen, Ansichten, Navigation, Blattanzahl
js/zufall.js                Hash und mulberry32
js/kurs.js                  Gradrechnung, Himmelsrichtungen, kürzester Weg, Drehrichtung
js/textteil.js              Flugzustand und Satzschablonen
js/parcours.js              Bausteine, Mengen, Geometrie, Kandidatensuche
js/zeichnung.js             SVG aus einem Parcours
test/*.test.js              eine Prüfdatei je Modul
docs/superpowers/specs/     dieser Entwurf
README.md                   Zweck, örtlicher Start, Prüfung, Adresse der App
.gitignore                  Stufe 2/, Stufe 3/, .DS_Store
```

Die Vorlagenordner `Stufe 2/` und `Stufe 3/` bleiben örtlich im Projektordner und gehen nicht ins Repository.

## Prüfung

Mit dem eingebauten Prüfläufer von Node (`node --test test/`). Geprüft wird:

- **Bestimmtheit**: zweimal dieselbe Nummer ergibt identische Ausgabe, verschiedene Nummern verschiedene
- **kurs.js**: Gradrechnung modulo 360, Umrechnung Himmelsrichtung in beide Schreibweisen, kürzester Weg und Drehrichtung
- **Textteil**: 12 Zeilen, Zustand nach jeder Zeile stimmt mit dem Satz überein (Gegenkurs, schnellster Weg, relative Kurven), Höhe bleibt zwischen 1000 und 3000 ft, Mengenregeln, deutsche Schreibweise
- **Parcours**: Mengenregeln, relative Kursänderungen ergeben den gezeichneten Kurs, Rechenaufgaben nur an Segmenten mit Kurs, Vollkreise nicht am Rand, englische Schreibweise
- **Alle 100 Blätter** der Stufe 2 entstehen ohne Fehler; die Prüfung gibt aus, wie viele davon kreuzungsfrei sind, und schlägt fehl, wenn es weniger als 90 sind
- **Zeichnung**: das SVG enthält je Segment einen Pfad und eine Beschriftung, die `viewBox` umschließt alle Punkte

Die Zeichnung selbst wird zusätzlich per Sichtprüfung headless geprüft (Bildschirmfotos mehrerer Blätter), Willi bekommt eine Auswahl zu sehen.

## Veröffentlichung

- Git-Identität nur für dieses Repository: Name `Willi-Workflow`, Adresse `301326367+Willi-Workflow@users.noreply.github.com`
- Öffentliches Repository `aua-pit-uebungen` unter dem Konto `Willi-Workflow`, angelegt über `gh`
- GitHub Pages aus dem Hauptzweig `main`, Wurzelverzeichnis
- Adresse der App danach: `https://willi-workflow.github.io/aua-pit-uebungen/`, sie kommt in die README und geht an Hannah

## Offene Punkte für spätere Abschnitte

- Stufe 3: Bedeutung von `HR`, `GK`, `K` ("über N auf K", "kürz. W. auf K"), `anl. Kurs`; Kästen mit drei Befehlen und Pfeilen; kein Textteil
- Endlosmodus je Stufe, Auswahl zwischen nur Textteil, nur Parcours oder gemischt
- Schreibweise der Himmelsrichtungen zufällig gemischt
- Versionsnummer im Zufallsstartwert, falls Blattnummern stabil bleiben müssen
