# Herkunft der Tonschnipsel

Gebraucht vom Blitzrechnen, Bereich Kopfrechnen mit Kursen, Aufgabenstellung per Ton (`js/kopfrechnen.js`, Abspielen in `js/blitzlauf.js`). Alle Dateien sind Kopien, keine Verweise. Stimme überall "Ralf DE Doku" von ElevenLabs (`jJxw1Rvgr2c60UdJHPBn`, Modell `eleven_multilingual_v2`).

## Aus der Bundeswehr-Lern-App

Quelle `~/Desktop/Claude/Bundeswehr/App/stimme/`, dort mit ElevenLabs erzeugt und an den Rändern von Stille befreit:

- `n0.mp3` bis `n490.mp3`: Ziffern 0 bis 9 für die Kurse (ziffernweise gesprochen), 10 bis 19 für Gegenkurs plus oder minus (`GK −19°`), 20 bis 490 für die Zahlen der Rechenaufgaben
- `op_mal.mp3`, `name_kurs.mp3` ("Kurs")

## Aus der Phase-II-App

Quelle `~/Desktop/Claude/Phase II/App/klaenge/zahlen/`. Dort am 03.09.2026 neu erzeugt, weil die Fassungen der Bundeswehr-Lern-App englisch gefärbt oder verwaschen waren, per Whisper-Rücktranskription geprüft und von Willi abgehört (siehe HERKUNFT.md dort). Diese Fassungen haben Vorrang:

- `n9.mp3`, `n11.mp3`, `n99.mp3`
- `op_plus.mp3`, `op_minus.mp3`

## Neu erzeugt am 27.09.2026

Mit `werkzeuge/klaenge_erzeuge.py` (liest den Schlüssel aus dem macOS-Schlüsselbund, Dienst `elevenlabs`), je Schnipsel mit Aussprachekontext davor und danach, Randstille beschnitten, per Whisper-Rücktranskription geprüft:

- `gegenkurs_von.mp3`, `himmelsrichtung.mp3`, `naechste_himmelsrichtung_zu.mp3`, `grad.mp3`, `anliegender_kurs.mp3`
- `hr_N.mp3` bis `hr_NNW.mp3`: die 16 Himmelsrichtungen, im Dateinamen mit den englischen Kürzeln wie in der Zeichnung, gesprochen deutsch ("Süd-Süd-West")

`op_mal.mp3` und `anliegender_kurs.mp3` braucht die App derzeit nicht; sie liegen für Aufgaben mit `anl. Kurs +7×8` bereit.
