// Bestimmter Zufall: gleicher Schlüssel, gleiche Zahlenfolge.
// Hash nach FNV-1a, Generator mulberry32. Beides klein und ohne Abhängigkeit.

export function hashZeichenkette(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(startwert) {
  let a = startwert >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function blattSchluessel(stufe, nummer) {
  return `stufe-${stufe}/blatt-${nummer}`;
}

export class Zufall {
  constructor(schluessel) {
    this.naechste = mulberry32(hashZeichenkette(schluessel));
  }

  // Gleichverteilt in [0, 1)
  zahl() {
    return this.naechste();
  }

  // Ganze Zahl von "von" bis "bis", beide Ränder eingeschlossen
  ganzzahl(von, bis) {
    return von + Math.floor(this.zahl() * (bis - von + 1));
  }

  auswahl(liste) {
    return liste[this.ganzzahl(0, liste.length - 1)];
  }

  wuerfel(wahrscheinlichkeit) {
    return this.zahl() < wahrscheinlichkeit;
  }

  // eintraege: [{ wert, gewicht }], Gewicht beliebig positiv
  gewichteteAuswahl(eintraege) {
    const summe = eintraege.reduce((s, e) => s + e.gewicht, 0);
    let rest = this.zahl() * summe;
    for (const eintrag of eintraege) {
      rest -= eintrag.gewicht;
      if (rest < 0) return eintrag.wert;
    }
    return eintraege[eintraege.length - 1].wert;
  }

  // Gemischte Kopie nach Fisher-Yates, das Original bleibt unverändert
  mischen(liste) {
    const kopie = liste.slice();
    for (let i = kopie.length - 1; i > 0; i--) {
      const j = this.ganzzahl(0, i);
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  }
}
