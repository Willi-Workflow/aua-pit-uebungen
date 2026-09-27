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

- Stufe 3 (seit 27.09.2026 umgesetzt, siehe Abschnitt "Stufe 3" am Ende)
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

- Kurs: Grad (ganzzahlig, 000 bis 359), Himmelsrichtung, oder keine Angabe (dann relative Kursänderung an der Ecke davor oder Gradzahl an der Kurve davor)
- Dauer: 10, 15, 20 oder 30 s, 30 s selten
- Profil: horizontal, steigen, sinken
- Rechenaufgabe: keine oder eine ganze Zahl von ±100 bis ±490 (Stufe 3: bis ±350), auch an Segmenten ohne Kurs (Vorlage: `+115` unter `/30"`)

**Vollkreis**

- Drehrichtung links oder rechts
- Profil je Hälfte, die beiden Hälften dürfen gleich oder verschieden sein
- Kurs vor und nach dem Vollkreis ist derselbe

**Gradzahl-Kurve** (seit 27.09.2026 auch in Stufe 2, wie in den beiden Handzeichnungen `PHOTO-2026-07-29-10-05-34.jpg` und `… 2.jpg`)

- Nackter Drehwinkel an der Bogenmitte (`120`, `273`), Richtung aus der Zeichnung, eigenes Profil über Winkel / 3 s
- Stufe 2: Winkel 30 bis 350, nie 180, rund ein Drittel Schleifen über 180° (Ziehung 37 %, auf den fertigen Blättern 181 von 556); Radius 24, Schleifen 35
- Das Segment danach trägt nur die Zeit (`/15"`)

**Ecke** zwischen zwei Elementen

- Folgt ein Segment mit Kurs: Drehung auf kürzestem Weg, keine Beschriftung. Kursunterschied zwischen 20° und 160°, damit die Richtung eindeutig ist.
- Folgt ein Segment ohne Kurs: relative Kursänderung zwischen 20° und 340°, nicht 180°, mit Vorzeichen als Beschriftung an der Ecke.
- Vor einem Vollkreis: keine Drehung.

### Mengen je Blatt

Seit 27.09.2026 nach Zählung der Vorlagen (Willi: "zu einfach und nicht oft genug auszurechnen"). Die PDF hat auf 18 Segmenten 2 relative Ecken und 5 Rechenaufgaben, die erste Handzeichnung 6 Kurven mit nacktem Winkel und 4 Gates mit 8 Relativwerten bis ±410, die zweite rund 11 Kurven mit nacktem Winkel und nur 5 absolute Kurse auf rund 16 Segmenten. Vorher hatte Stufe 2 je Blatt 3 bis 4 Kursberechnungen und 4 bis 5 Rechenaufgaben bis ±350, 12 von 19 Segmenten mit absolutem Kurs.

- 18 bis 22 Segmente (mit Gates 15 bis 19)
- 2 Vollkreise, nicht direkt hintereinander, nicht am Anfang oder Ende
- 8 bis 11 Kursberechnungen: 3 bis 4 Ecken mit relativer Kursänderung und 5 bis 7 Gradzahl-Kurven (mit Gates 4 bis 6; bei nur 4 Kurven 4 relative Ecken)
- Gates, Vollkreise und Kurven folgen auf Segment 2 bis Anzahl minus 2, je Stelle höchstens eines; zwischen zwei Gates mindestens zwei Segmente
- 5 bis 7 Rechenaufgaben, Beträge 100 bis 490
- 3 bis 4 Kurse als Himmelsrichtung, alle übrigen in Grad (im Mittel 7 von 19,5 Segmenten)
- Profile etwa gleich verteilt, kein Profil öfter als dreimal hintereinander (Vollkreishälften zählen mit)
- Höhe ab der Endhöhe des Textteils zwischen 1000 und 3000 ft, gerechnet mit 8 ft/s: Segmente mit ihrer Dauer, Vollkreishälften 60 s, Kurven Winkel / 3 s, Gate-Zeilen mit ihren Sekunden, Ecken ohne Höhenänderung. Die Profilwahl schließt Steig- oder Sinkflug aus, der den Rahmen verließe; bei Gate-Zeilen steht die Dauer dafür vor dem Profil fest.

### Passform

Die Zeichnung ist geografisch echt, deshalb ergeben zufällige Kurse oft Knäuel. Die Erzeugung zieht aus dem Zufallsstrom des Blatts **1000 Kandidaten** (`KANDIDATEN_STUFE_2`; bis zu den Gradzahl-Kurven 12000 ungeprüfte), jeden wie in Stufe 3 Schritt für Schritt mit dem `schrittpruefer` gebaut (siehe Stufe 3, Erzeugung), ungedreht: Norden zeigt immer nach oben, wie in der Vorlage. Alle Prüfungen laufen auf dieser ungedrehten Geometrie, billige zuerst. Zulässig ist ein Kandidat, der alle Bedingungen erfüllt:

1. Der Weg kreuzt sich nicht selbst (Kreisbögen als Polygonzüge, benachbarte Stücke zählen nicht; die Kreuzung von Ein- und Ausfahrt einer Schleife über 180° ist gewollt, aber wie in Stufe 3 nur sauber, mindestens 9 vor den äußeren Enden).
2. Die Striche berühren sich höchstens: Mittellinien mindestens 9 Einheiten auseinander, sobald eine Strecke dazwischen liegt. Das Flugzeugsymbol am Start (Kreis mit Radius 14) ist dabei ein Hindernis für alle Stücke außer der ersten Strecke.
3. Das Verhältnis Breite zu Höhe des Umrisses liegt zwischen 0,7 und 1,25.
4. Der Start liegt im oberen Teil des Umrisses, höchstens 34 % der Höhe von oben (`START_OBEN`).
5. Jede Beschriftung steht frei: Kein fremder Strich, keine andere Beschriftung und nicht das Flugzeugsymbol berühren sie. Angrenzende Schleifen und Vollkreishälften zählen dabei als fremd, nur die eigene Strecke und gewöhnliche Eckbögen nicht. Seit den Gradzahl-Kurven steht jede Beschriftung wie in Stufe 3 ihrem eigenen Stück deutlich näher als jedem fremden (Zuordnung).
6. Die Beschriftung erscheint im A4-Druck mit mindestens 6 pt (`DRUCKSCHRIFT_MIN`). Gerechnet wird mit der Fläche, die die Zeichnung im Druck bekommt, in Chrome gemessen: 703 × 688 Pixel, auf Gate-Blättern mit dem zweizeiligen Gate-Hinweis 703 × 652 (`DRUCKFLAECHE`, `druckschrift` in `zeichnung.js`); die Schrift 9 der Zeichnung erscheint mit 9 × 0,75 × Maßstab pt. Die Rechnung weicht von der Messung in Chrome um höchstens 0,01 pt ab.
7. Kein Querstrich berührt die Tinte einer Beschriftung (`querstrichAnBeschriftung`, Tinte aus den in Chrome gemessenen Zeichenmaßen wie im Prüfwerkzeug).
8. Keine Beschriftung berührt einen ihrer eigenen Bögen (`eigenerBogenAnBeschriftung`); die Prüfung auf freie Lage (5.) lässt die angrenzenden Bögen eines Segments aus. Seit den Kursangaben als Gegenkurs lief sonst in Stufe 3 eine Angabe in der Kehre vor `GK/…` bis in den Bogen (Blatt 48 und 95); in Stufe 2 verletzte kein Sieger die Regel.

Beide Regeln verwerfen nur ganze Kandidaten; so änderten sich in Stufe 2 nur die Blätter, deren Sieger sie verletzte: 39 (5,1 auf 6,1 pt), 7, 33, 41, 53 und 78 (Querstrich an einer Ziffer). Seit den Kursangaben als Gegenkurs gelten sie auch in Stufe 3, dort mit einem Vorzug: Unter den zulässigen Kandidaten gewinnen zuerst die mit mindestens 7 pt (`DRUCKSCHRIFT_WUNSCH`), erst dann entscheidet die Füllung. In Stufe 2 ist der Vorzug gleich der Untergrenze, also ohne Wirkung.

Gemessen nach den Gradzahl-Kurven: alle 100 Blätter zulässig, CPU-Zeit je Blatt im Median 181 ms, höchstens 323 ms; Druckschrift der Parcours-Beschriftungen im Median 7,9 pt, kleinste 5,1 pt (Blatt 39, einziges unter 6 pt), vorher 7,6 und 5,4 pt. Mit den Regeln 6 und 7: Median 7,9 pt, kleinste 6,1 pt (Blatt 39), alle 100 auf einer Seite.

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
- **Relativwerte** mit Betrag 20 bis 490 und beiden Vorzeichen; der Kurs danach liegt mindestens 20° vom Kurs davor und ist nie genau der Gegenkurs (sonst bliebe die Drehrichtung offen). Einen Kandidaten mit einer solchen Zeile verwirft die Kandidatensuche, statt den Wert neu zu ziehen, damit sich der Zufallsstrom der übrigen Kandidaten nicht verschiebt; das änderte nur Blatt 51. Himmelsrichtung und Gradkurs liegen wie bei Segmenten 20° bis 160° vom Kurs davor.
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
| `#/stufe3` | Stufenseite der Stufe 3, Blattliste ohne Gate-Marke (seit 27.09.2026) |
| `#/stufe3/blatt/7` | Blattansicht der Stufe 3, aufgebaut wie die der Stufe 2 |
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
js/elemente.js              Bausteine und Mengen je Stufe
js/geometrie.js             Weg, Querstriche, Beschriftungen, Maße der Passform
js/parcours.js              Kandidatensuche
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

- Endlosmodus je Stufe, Auswahl zwischen nur Textteil, nur Parcours oder gemischt
- Schreibweise der Himmelsrichtungen zufällig gemischt
- Versionsnummer im Zufallsstartwert, falls Blattnummern stabil bleiben müssen

## Stufe 3

Stand: 27.09.2026, seit dem zweiten Umbau am selben Tag mit Textteil und häufigerem Gegenkurs. Vorlagen im Ordner `Stufe 3/` (bleibt außerhalb des Repositorys): `AUA PIT Stufe 3.pdf`, das Gegenkursbeispiel (`PHOTO-2026-07-29-10-05-34 3.jpg`) und die Handzeichnung mit START und ZIEL (`WhatsApp Image 2026-08-08 at 16.24.30.jpeg`). Alle drei sind Stufe 3; ihre Elemente kommen gemischt über die 100 Blätter vor. Stufe 3 hat eigene Zufallsschlüssel (`stufe-3/blatt-7`). Die Textteile der Stufe 2 bleiben Byte für Byte, wie sie waren (Fingerabdruck in `test/blaetter.test.js`); ihr Parcours ist seit den Gradzahl-Kurven neu.

### Fachliche Regeln (von Willi bestätigt)

- **Textteil wie Stufe 2.** Über dem Parcours stehen die Zeile "Ausgangskurs 090°, 2000 ft" und zwölf Sätze aus denselben Schablonen wie in Stufe 2, aus demselben Zufallsstrom wie der Parcours. Der Parcours schließt an Kurs und Höhe nach dem letzten Satz an: erstes Segment 20° bis 160° vom Endkurs, Höhe ab der Endhöhe des Textteils. In der Zeichnung steht "Start" am Flugzeugsymbol, ohne Höhe, und "Ende" am letzten Segment. Weitere Zeilen über dem Parcours gibt es nicht, auch keinen Gate-Hinweis; die Kürzel unten setzt das Blatt voraus. (Bis zum zweiten Umbau hatte Stufe 3 keinen Textteil, begann auf 2000 ft mit dem Kurs des ersten Segments und trug über dem Parcours "Start 2000 ft, Kurs vom ersten Segment", eine Zeile mit den Kürzeln und den Gate-Hinweis.)
- **HR = Himmelsrichtung**, der nächstgelegene Strich der Kompassrose. `HR/20"`: vom aktuellen Kurs auf die nächste Himmelsrichtung drehen, 20 s halten (010° auf N, 015° auf NNE). `HR 111°/15"`: 111° auf die nächste Himmelsrichtung runden (ESE, 112,5°), 15 s fliegen. Die PDF schreibt auch `042°/20" HR`; die App nutzt die Form mit HR voran.
- **GK = Gegenkurs.** `GK/15"` als Segment: Gegenkurs des aktuellen Kurses 15 s fliegen. In Gates: `GK` und `GK -19°` (Gegenkurs minus 19). Wie in der Handzeichnung (drei GK-Aufgaben auf einem Blatt) mindestens dreimal je Blatt, meist vier- bis fünfmal: 1 bis 2 Segmente `GK/…`, nie zwei direkt hintereinander, und 2 bis 3 Gate-Zeilen `GK` oder `GK ± n`. Vorher hatten 21 von 100 Blättern kein GK.
- **Kursangabe als Gegenkurs** (seit 27.09.2026, wie im Gegenkursbeispiel): 60 bis 80 % der Segmente mit eigenem Kurs (Gradkurs oder Himmelsrichtung, nicht HR, nicht `GK/…`, nicht ohne Kurs) nennen den Gegenkurs des tatsächlichen Kurses: `GK 247°/15"` für 067°, `GK SSW/10"` für NNE. Gezeichnet ist der tatsächliche Kurs, `kurs` am Segment bleibt der tatsächliche, das Feld `alsGegenkurs` markiert die Angabe. Über die 100 Blätter 788 von 1134 (69,5 %), je Blatt mindestens 60 %. Nach einem Gate der Form A ist K der tatsächliche Kurs des nächsten Segments.
- **anl. Kurs = anliegender Kurs**, der gerade geflogene: `anl. Kurs +98°` ist der aktuelle Kurs plus 98, `anl. Kurs +7×8` der aktuelle Kurs plus 56. Selten, höchstens eine Zeile je Blatt.
- **K** in "über N auf K" ist der Kurs des nächsten gezeichneten Segments. Er wird über Norden (die Drehung geht durch 000°), über Süden (durch 180°) oder auf kürzestem Weg angesteuert.
- **Nackte Gradzahlen an Kurven** (`300`, `145`): Drehwinkel der Kurve; ob rechts oder links, zeigt die gezeichnete Kurve.
- **Rechenaufgaben** wie in Stufe 2 (`+95` an einem Segment, ohne Gradzeichen).
- Himmelsrichtungen in der Zeichnung englisch (`SCHREIBWEISE.zeichnung`), auch in Gates.

### Elemente

Alle Elemente der Stufe 2 (Segment mit Grad, Himmelsrichtung oder ohne Kurs, Vollkreis mit zwei Profilen, Ecke mit relativer Kursänderung, Rechenaufgabe, Gate) und dazu:

1. **Gradzahl-Kurve** (`{ art: 'kurve', winkel, richtung, profil }`): eigenes Element zwischen zwei Segmenten, Drehwinkel ganzzahlig 40 bis 340, nicht 180, links oder rechts, eigenes Profil, gezeichnet in dessen Linienart (Sprossen auch auf dem Bogen). Dauer für die Höhe: Winkel / 3 s. Die Gradzahl steht ohne Vorzeichen und Gradzeichen außen an der Bogenmitte, sonst bei einem oder drei Vierteln des Bogens. Radius 24, ab 180° eine Schleife mit Radius 35 wie ein Vollkreis. Querstriche an Anfang und Ende. Das folgende Segment trägt keine Kursangabe (`/10"`), sein Kurs ist der Kurs davor plus oder minus Winkel; es beginnt ohne Ecke am Ende des Bogens. In Kreuzungs- und Abstandsprüfung gilt die Schleifenausnahme wie bei Ecken über 180°, in Stufe 3 aber nur für eine saubere Kreuzung: Der Kreuzungspunkt liegt auf Ein- und Ausfahrt mindestens 9 vor dem äußeren Ende; jede andere Lage gilt wie zwei getrennte Stücke (keine Kreuzung, Mittellinien mindestens 9), damit kein Segment im Strich einer Einfahrt endet.
2. **Segmente mit HR oder GK** (`anzeige` `hr`, `hrKurs`, `gk`), getrennt gezählt: 1 bis 2 mit HR, 1 bis 2 mit GK, zwei GK-Segmente nie direkt hintereinander. `HR/…` nur, wenn der aktuelle Kurs mindestens 5° von der nächsten Himmelsrichtung entfernt liegt (nie genau 11,25°); die Ecke ist dann ein kleiner Bogen von 5° bis unter 11,25°. `HR 111°/…` mit einem Gradkurs 1° bis 10° neben einer Himmelsrichtung; die Ecke dreht 20° bis 160° auf kürzestem Weg. `GK/…` hat eine Kehre von 180° mit Radius 20, die Richtung (`gkRichtung`) ist zufällig und nur in der Zeichnung zu sehen, die beiden Strecken liegen 40 auseinander. HR und GK folgen nie auf ein Gate, eine Kurve oder den Start.
3. **Gates in drei Formen** (`{ art: 'gate', form, zeilen, anschluss }`), je Gate zufällig:
   - **Form A (PDF):** drei Zeilen `Wert Pfeil Zeit` (`+127° → 15"`, `SSW ↗ 15"`, `123° → 15"`), Relativwerte mit Gradzeichen und Betrag 20 bis 190 wie in der PDF (`+182°`), aber nie so, dass der Kurs danach genau der Gegenkurs ist; über 160° nennt das Vorzeichen die Richtung. Höchstens eine der drei Zeilen darf Gegenkurs sein, ebenfalls als Wert vor dem Pfeil (`GK → 15"`, `GK -19° ↘ 20"`). Dazu die **Anschlusszeile** als letzte Zeile: `über N auf K`, `über S auf K` oder `kürz. W. auf K`. "über N" nur, wenn weder der letzte Gate-Kurs noch K auf 000° liegen und die Drehung nicht 180° ist, "über S" ebenso mit 180°; "kürz. W." bei 20° bis 160°. Bei "über N/S" ist die lange Seite erlaubt, K liegt aber mindestens 20° vom letzten Gate-Kurs.
   - **Form B (Gegenkursbeispiel):** vier Zeilen wie in Stufe 2 (`-322 ↗ 15"`, `ENE → 10"`, `083° → 10"`), Relativwerte ohne Gradzeichen mit Betrag 20 bis 490, der Kurs danach 20° bis 160° vom Kurs davor. Keine Anschlusszeile, das nächste Segment liegt 20° bis 160° vom letzten Gate-Kurs. Kein Gegenkurs, wie in der Vorlage.
   - **Form C (Handzeichnung):** drei bis vier Zeilen `Pfeil Ausdruck Zeit` (`↗ NNE +102° 15"`, `→ WSW 15"`, `→ GK 25"`, `↗ GK -19° 20"`, `→ anl. Kurs +98° 25"`, `↘ anl. Kurs +7×8 20"`). Ausdrücke: Himmelsrichtung, Himmelsrichtung ± 10 bis 130, GK, GK ± 10 bis 60, selten `anl. Kurs +n` oder `anl. Kurs +a×b` (a von 2 bis 9, b von 2 bis 13 wie `9×13` in der Handzeichnung, Ergebnis 20 bis 160). Jeder Ausdruck außer dem reinen GK ergibt einen Kurs 20° bis 160° vom Kurs davor; zwei reine GK folgen nie aufeinander. Jedes Gate der Form C hat eine oder zwei Zeilen GK oder GK ± n.
   - Form und Zahl der GK-Zeilen jedes Gates legt der Bauplan des Kandidaten fest (`gatesPlanen`): erst die Zahl der GK-Zeilen des Blatts (2 oder 3), dann die Formen, bis sie dazu passen (höchstens so viele Gates der Form C wie GK-Zeilen, und genug Platz in A und C). Weil das Kombinationen mit viel Form B verwirft, wird B mit 16, A mit 10 und C mit 9 gewichtet; über die 100 Blätter A 100, B 116, C 110.
   - Alle Formen: Ankunft mit dem Kurs davor, jede Zeile rechnet vom Kurs der Zeile davor, Zeiten 10, 15, 20 oder 25 s, Profile aus der gemeinsamen Profilwahl mit Höhenrahmen. Der Kasten ist so breit wie die längste Zeile nach den gemessenen Zeichenbreiten der Schrift (plus 8 % und 10 Einheiten Rand), bis fünf Zeilen hoch.
4. **Relative Ecken** wie in Stufe 2 (`-87°`, `+117°`), Radius 12, ab 180° Schleife mit 28.
5. **Start und Ende:** "Start" hinter dem Flugzeugsymbol (die PDF ohne Textteil schrieb "Start 2000'"), "Ende" hinter dem Ende des letzten Segments, jeweils gerade dahinter oder 45° daneben, waagerecht, fett. Sie sind Beschriftungen und müssen frei stehen; jede steht ihrem eigenen Punkt (Flugzeugsymbol beziehungsweise Ende des Wegs) mindestens 1,5-mal näher als dem anderen.
6. **Zuordnung der Beschriftungen:** Eine Beschriftung an einem Segment, einer Ecke oder einer Kurve steht ihrem eigenen Stück deutlich näher als jedem fremden, dem man sie zuordnen könnte: Das nächste ist mindestens 1,5-mal so weit weg (Achse der Beschriftung zur Mittellinie), sonst gilt die Lage als nicht frei. Mitbewerber einer Bogenangabe sind alle fremden Bögen außer Vollkreishälften (Vollkreise tragen nie eine Angabe), einer Segmentbeschriftung alle fremden Strecken, die höchstens 20° gegen die eigene geneigt sind. Mit allen fremden Stücken wären wegen der Gate-Kästen nur 85 Blätter zulässig gewesen, und ohne die Kästen wären die Schleifen über 180° von 222 auf 145 gefallen, weil die kreuzende Ausfahrt die Beschriftung der Einfahrt verdrängt.

### Mengen je Blatt

- 18 bis 21 Segmente (bis zu den Kursangaben als Gegenkurs 18 bis 24; die längeren Angaben brauchen Platz), Dauer 10, 15, 20 oder 25 s (25 s seltener)
- 1 bis 2 Vollkreise, 2 bis 3 Gradzahl-Kurven, 3 bis 4 Gates, 2 bis 3 relative Ecken, 1 bis 2 Segmente mit HR, 1 bis 2 Segmente mit GK, 2 bis 3 Gate-Zeilen mit GK oder GK ± n (zusammen 3 bis 5 Gegenkurs-Aufgaben), 3 bis 5 Rechenaufgaben, 3 bis 5 Himmelsrichtungen
- Gates, Vollkreise und Kurven folgen auf Segment 2 bis Anzahl minus 2, je Stelle höchstens eines: nie am ersten oder letzten Segment, immer mindestens ein Segment dazwischen
- Höhe ab der Endhöhe des Textteils zwischen 1000 und 3000 ft (Segmente, Kreishälften 60 s, Kurven Winkel / 3 s, Gate-Zeilen), kein Profil viermal hintereinander; ohne Textteil (Ausschnitte des Blitzrechnens) ab 2000 ft
- Norden oben, Start oben (`START_OBEN`), Zulässigkeit wie Stufe 2

### Erzeugung

`erzeugeElemente(zufall, einstellungen, start, pruefer)` bekommt je Stufe ein Einstellungsobjekt, `{ stufe: 2, mitGates }` oder `{ stufe: 3 }`, und baut nach dem Bauplan der Stufe (`planStufe2`, `planStufe3`) mit demselben Ablauf (`elementeSchrittweise`). Stufe 3 baut einen Kandidaten Schritt für Schritt (Segment und was ihm folgt) und prüft jeden Schritt sofort gegen den bisherigen Weg (`schrittpruefer` in `geometrie.js`: keine Kreuzung außer der sauberen an Schleifen, Mittellinien mindestens 9 auseinander, Flugzeugsymbol frei, nichts mehr als 120 Einheiten über dem Start). Scheitert ein Schritt viermal, wird der Schritt davor wiederholt; nach 60 gescheiterten Schritten ist der Kandidat verworfen. Ohne diese Prüfung kreuzten sich 99,6 % der Kandidaten; mit ihr kommen gut 60 % durch, und 1000 Kandidaten je Blatt reichen (`KANDIDATEN_STUFE_3`). Mit 1300 lag ein Blatt unter der Last der parallel laufenden Prüfungen knapp über 500 ms. Danach dieselbe Auswahl wie in Stufe 2: zulässig und höchste Füllung.

Gemessen über die 100 Blätter nach dem zweiten Umbau: alle 100 zulässig, CPU-Zeit je Blatt allein im Median 197 ms, höchstens 310 ms (während der ganzen Prüfung im Median 250 ms, höchstens 298 ms). Druckschrift der Parcours-Beschriftungen im A4-Druck (Chrome im Druckmodus, gemessene Größe jedes Parcours-SVGs): Median 7,4 pt, kleinste 5,9 pt (Blatt 8), alle 100 auf einer Seite; nach derselben Messung vor dem Umbau Median 7,8 pt, kleinste 6,0 pt. Die zwölf Sätze kosten im Median also 0,4 pt. Nach den Kursangaben als Gegenkurs (18 bis 21 Segmente, Druckregeln wie Stufe 2 mit Vorzug ab 7 pt): alle 100 zulässig, Druckschrift im Median 7,5 pt, kleinste 6,2 pt (Blatt 67; in Chrome gemessen gleich), CPU-Zeit je Blatt allein höchstens 311 ms. Ohne Anpassung wären es 7,0 pt im Median und 8 Blätter unter 6 pt gewesen. GK je Blatt: 22 Blätter mit 3, 53 mit 4, 25 mit 5 (vorher 21 Blätter ohne GK, 22 mit 1, 32 mit 2), zusammen 152 Segmente und 251 Gate-Zeilen (72 in Form A, 179 in Form C).

### Oberfläche und Druck

Startseite mit aktiver Karte "Stufe 3, Textteil und Parcours, 100 Blätter, alle mit Gates", Blattliste mit Vorschaubildern aus `vorschau/stufe3/` und ohne Gate-Marke, Unterzeile "Textteil und Parcours, alle mit Gates.". Die Blattansicht ist wie die der Stufe 2 aufgebaut: Titel, "Ausgangskurs 090°, 2000 ft", die zwölf Sätze, Parcours, Legende; ohne Gate-Hinweis und ohne Erklärzeile. Im Druck teilen sich Textteil und Zeichnung die Seite wie in Stufe 2.

### Prüfung

`test/stufe3.test.js` prüft je Element (Kurve: Winkel, Richtung, Profil, Folgekurs, Radius, Querstriche, Gradzahl; HR: Rundung; GK: Gegenkurs und Kehre; Gates A, B, C: Zeilenmuster, Werte, GK-Zeilen je Form, Anschlusszeile eindeutig; Start und Ende), Mengen samt Gegenkurs, Höhe, Bestimmtheit. `test/blaetter.test.js` erzeugt alle 100 Blätter beider Stufen: Stufe 2 unverändert (Fingerabdruck), Stufe 3 mit zwölf Sätzen, Übergang 20° bis 160°, Höhe ab dem Textteil, mindestens drei GK je Blatt, mindestens 90 zulässig und jedes Blatt unter 500 ms CPU-Zeit. `test/app.test.js` prüft die Blattansicht der Stufe 3 ohne Erklärzeile und Gate-Hinweis und das Etikett "Start".

Das Logik-Prüfwerkzeug `werkzeuge/pruefen.js` (`node werkzeuge/pruefen.js 2` oder `3`) rechnet jedes Blatt nur aus Sätzen und SVG nach, wie eine Pilotin, in beiden Stufen samt Textteil und Übergang in den Parcours, und gleicht am Ende mit dem Erzeuger ab. Es liest GK-Zeilen auch in Form A und prüft die Gegenkurs-Mengen. Beide Stufen: 0 Fehler.

