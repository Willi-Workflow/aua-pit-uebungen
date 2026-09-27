"""Erzeugt die Tonschnipsel für Blitzrechnen, die es in keiner anderen App gab.

Stimme Ralf DE Doku (jJxw1Rvgr2c60UdJHPBn), eleven_multilingual_v2, wie die
Zahlenklänge der Bundeswehr-Lern-App. Der Schlüssel kommt aus dem macOS-
Schlüsselbund (Dienst elevenlabs, Konto willi) und steht nirgends im
Repository. Vorhandene Dateien in klaenge/ werden übersprungen; wer einen
Schnipsel neu will, löscht ihn vorher. Die Rohfassung landet in einem Ordner
unter dem temporären Verzeichnis, die beschnittene Fassung (Randstille weg) in
klaenge/. Braucht ffmpeg. Jeder Aufruf kostet Guthaben bei ElevenLabs.

Aufruf: python3 werkzeuge/klaenge_erzeuge.py
"""

import json
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

VOICE = "jJxw1Rvgr2c60UdJHPBn"
MODELL = "eleven_multilingual_v2"
ROH = Path(tempfile.gettempdir()) / "blitzrechnen-klaenge-roh"
FERTIG = Path(__file__).resolve().parent.parent / "klaenge"

# Dateiname, Text, Aussprachekontext davor und danach
SCHNIPSEL = [
    ("gegenkurs_von", "Gegenkurs von", "Aufgabe: ", " zwei vier sieben"),
    ("himmelsrichtung", "Himmelsrichtung", "Aufgabe: ", " Süd-Süd-West"),
    ("naechste_himmelsrichtung_zu", "nächste Himmelsrichtung zu", "Aufgabe: ", " eins eins eins"),
    ("grad", "Grad", "zwei vier sieben ", "."),
    ("anliegender_kurs", "anliegender Kurs", "Aufgabe: ", " plus neunzig"),
    ("hr_N", "Nord", "Himmelsrichtung ", "."),
    ("hr_NNE", "Nord-Nord-Ost", "Himmelsrichtung ", "."),
    ("hr_NE", "Nord-Ost", "Himmelsrichtung ", "."),
    ("hr_ENE", "Ost-Nord-Ost", "Himmelsrichtung ", "."),
    ("hr_E", "Ost", "Himmelsrichtung ", "."),
    ("hr_ESE", "Ost-Süd-Ost", "Himmelsrichtung ", "."),
    ("hr_SE", "Süd-Ost", "Himmelsrichtung ", "."),
    ("hr_SSE", "Süd-Süd-Ost", "Himmelsrichtung ", "."),
    ("hr_S", "Süd", "Himmelsrichtung ", "."),
    ("hr_SSW", "Süd-Süd-West", "Himmelsrichtung ", "."),
    ("hr_SW", "Süd-West", "Himmelsrichtung ", "."),
    ("hr_WSW", "West-Süd-West", "Himmelsrichtung ", "."),
    ("hr_W", "West", "Himmelsrichtung ", "."),
    ("hr_WNW", "West-Nord-West", "Himmelsrichtung ", "."),
    ("hr_NW", "Nord-West", "Himmelsrichtung ", "."),
    ("hr_NNW", "Nordnordwest", "Himmelsrichtung ", "."),
]


def schluessel():
    return subprocess.check_output(
        ["security", "find-generic-password", "-s", "elevenlabs", "-a", "willi", "-w"], text=True
    ).strip()


def erzeugen(key, name, text, davor, danach):
    ziel = ROH / f"{name}.mp3"
    daten = json.dumps({
        "text": text,
        "model_id": MODELL,
        "previous_text": davor,
        "next_text": danach,
        "voice_settings": {"stability": 0.6, "similarity_boost": 0.8},
    }).encode()
    anfrage = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
        data=daten,
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    with urllib.request.urlopen(anfrage, timeout=60) as antwort:
        ziel.write_bytes(antwort.read())


def beschneiden(name):
    """Randstille weg, vorn und hinten, damit die Schnipsel dicht aneinander passen."""
    quelle = ROH / f"{name}.mp3"
    ziel = FERTIG / f"{name}.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(quelle),
        "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,"
               "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse",
        "-codec:a", "libmp3lame", "-b:a", "128k", str(ziel),
    ], check=True)


def main():
    ROH.mkdir(exist_ok=True)
    FERTIG.mkdir(exist_ok=True)
    offen = [s for s in SCHNIPSEL if not (FERTIG / f"{s[0]}.mp3").exists()]
    if not offen:
        print("alle Schnipsel vorhanden, nichts zu tun")
        return 0
    key = schluessel()
    for name, text, davor, danach in offen:
        erzeugen(key, name, text, davor, danach)
        beschneiden(name)
        print(f"{name:32} erzeugt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
