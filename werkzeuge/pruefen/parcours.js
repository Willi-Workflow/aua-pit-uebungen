// Parcours beider Stufen, nur aus dem gezeichneten SVG: Weg, Kurse, Ecken, Kurven,
// Gates, Mengen, Höhe, Querstriche, Flugzeugsymbol, Start und Ende, Lesbarkeit

import {
  ENGLISCH, RATE, HMIN, HMAX, SEK_LAENGE, HALB, KURVENRATE, MENGEN, norm, diff, abst, peilung, vek, d3, kursName, hrIndex, hrAbstand,
  sub, len, dist, kreuz, punktStrecke, schneiden, imPolygon, zugPolygon, polygonPolygon, zugZug, anwenden, bogenGeometrie, bogenAusTangente,
} from './grundlagen.js';
import { befund } from './befunde.js';
import { tinteMessen, tintenPolygon } from './tinte.js';
import { flugzeugPolygon } from './svg.js';

const PFEILPROFIL = { '→': 'horizontal', '↗': 'steigen', '↘': 'sinken' };
const ANSCHLUSS = /^(über N|über S|kürz\. W\.) auf K$/;

// Zeile "Wert Pfeil Sekunden" (Stufe 2, Form A und B) oder "Pfeil Ausdruck
// Sekunden" (Form C)
function gateZeileLesen(z) {
  const c = z.match(/^([→↗↘]) (.+) (\d+)"$/);
  if (c) {
    const zeile = { form: 'c', profil: PFEILPROFIL[c[1]], sek: Number(c[3]), text: z };
    const a = c[2];
    let m;
    if ((m = a.match(/^([A-Z]{1,3})$/)) && a !== 'GK') return { ...zeile, typ: 'richtung', richtung: m[1] };
    if ((m = a.match(/^([A-Z]{1,3}) ([+-]\d+)°$/)) && m[1] !== 'GK') return { ...zeile, typ: 'richtungPlus', richtung: m[1], wert: Number(m[2]) };
    if (a === 'GK') return { ...zeile, typ: 'gk' };
    if ((m = a.match(/^GK ([+-]\d+)°$/))) return { ...zeile, typ: 'gkPlus', wert: Number(m[1]) };
    if ((m = a.match(/^anl\. Kurs \+(\d+)°$/))) return { ...zeile, typ: 'anl', wert: Number(m[1]) };
    if ((m = a.match(/^anl\. Kurs \+(\d+)×(\d+)$/))) return { ...zeile, typ: 'anlProdukt', a: Number(m[1]), b: Number(m[2]), wert: Number(m[1]) * Number(m[2]) };
    return null;
  }
  const m = z.match(/^([+-]\d+°?|[A-Z]{1,3}|\d{3}°) ([→↗↘]) (\d+)"$/);
  if (!m) return null;
  const zeile = { profil: PFEILPROFIL[m[2]], sek: Number(m[3]), text: z };
  if (/^[+-]\d+°?$/.test(m[1])) return { ...zeile, typ: 'relativ', wert: parseInt(m[1], 10), gradzeichen: m[1].endsWith('°') };
  if (/°$/.test(m[1])) return { ...zeile, typ: 'grad', wert: Number(m[1].slice(0, -1)) };
  return { ...zeile, typ: 'richtung', richtung: m[1] };
}

// Kursbeschriftung eines Segments: "250°/15"", "SSE/10"", "/30"", in Stufe 3
// auch "HR/20"", "HR 111°/15"", "GK/15"", darunter höchstens eine Rechenaufgabe
function beschriftungLesen(zeilen) {
  const m = zeilen[0].match(/^(?:(\d{3})°|(HR)|HR (\d{3})°|(GK)|([A-Z]{1,3}))?\/(\d+)"$/);
  if (!m) return null;
  const r = {
    grad: m[1] !== undefined ? Number(m[1]) : null,
    hr: m[2] !== undefined,
    hrGrad: m[3] !== undefined ? Number(m[3]) : null,
    gk: m[4] !== undefined,
    richtung: m[5] || null,
    sek: Number(m[6]),
    rechen: null,
    roh: zeilen.join(' | '),
  };
  r.mitKurs = r.grad !== null || r.richtung !== null;
  r.hrgk = r.hr || r.hrGrad !== null || r.gk;
  if (zeilen.length > 2) r.fehler = 'mehr als zwei Zeilen';
  if (zeilen.length === 2) {
    const q = zeilen[1].match(/^([+-])(\d+)$/);
    if (!q) r.fehler = `zweite Zeile ${zeilen[1]} ist keine Rechenaufgabe ohne Gradzeichen`;
    else r.rechen = Number(q[1] + q[2]);
  }
  return r;
}

const istKreisRadius = (r) => Math.abs(r - 35) < 0.01;
const istKurvenRadius = (r) => Math.abs(r - 24) < 0.01;

export function parcoursPruefen(b, svg, textEnde, stufe) {
  const M = MENGEN[stufe];
  const { stuecke, kaesten, marken, texte } = svg;
  const kaputt = stuecke.filter((s) => s.fehler);
  kaputt.forEach((s) => befund('Fehler', 'Parcours', 'Zeichnung lesbar', 'SVG', s.fehler, 'gültige Pfade'));
  if (kaputt.length) return null;

  // Nordpfeil: Richtung vom Schaftende zur Spitze ist Norden der Zeichnung
  const np = svg.nordpfeil.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pEnde = { x: np[0], y: np[1] }; const pBasis = { x: np[2], y: np[3] }; const pKopf = { x: np[4], y: np[5] };
  const pLinks = { x: np[6], y: np[7] }; const pRechts = { x: np[8], y: np[9] };
  const nordGezeichnet = peilung(pKopf.x - pEnde.x, pKopf.y - pEnde.y);
  const drehung = norm(-nordGezeichnet);
  if (Math.min(drehung, 360 - drehung) > 0.05) befund('Fehler', 'Parcours', 'Norden oben', 'Nordpfeil', `Drehung ${drehung.toFixed(2)}°`, 'Nordpfeil zeigt nach oben');
  const pfeilPoly = [pKopf, pLinks, pRechts];
  const nordText = svg.nord;
  const nordErwartet = { x: pKopf.x + vek(nordGezeichnet).x * 8, y: pKopf.y + vek(nordGezeichnet).y * 8 };
  if (dist(nordErwartet, nordText.t) > 0.3) befund('Unschärfe', 'Parcours', 'N vor der Spitze des Nordpfeils', 'Nordpfeil', `Abstand ${dist(nordErwartet, nordText.t).toFixed(1)}`, 'N 8 Einheiten vor der Spitze');
  const wahrerKurs = (gez) => norm(gez + drehung);

  // Kette bilden: Segmente, Ecken, Vollkreise, Kurven (Stufe 3), Gates
  const kette = [];
  let i = 0;
  const aufRand = (p, k) => Math.min(...[0, 1, 2, 3].map((j) => punktStrecke(p, k.poly[j], k.poly[(j + 1) % 4]))) < 0.06;
  while (i < stuecke.length) {
    const s = stuecke[i];
    if (s.art === 'bogen' && !s.punkte) {
      const vorher = stuecke[i - 1];
      const ein = vorher && dist(vorher.ende, s.start) <= 0.03 ? vorher.ausKurs : null;
      if (ein === null) {
        befund('Fehler', 'Parcours', 'Bogen schließt an', `Stück ${i + 1}`, 'Bogen ohne Vorgänger', 'Strecke oder Bogen davor');
        Object.assign(s, bogenGeometrie(s.start, s.ende, s.r, s.fA, s.fS));
      } else {
        Object.assign(s, bogenAusTangente(s, ein));
        if (s.fehlerRadius > 0.06) befund('Fehler', 'Parcours', 'Bogen tangential angesetzt', `Stück ${i + 1}`, `Endpunkt ${s.fehlerRadius.toFixed(2)} neben dem Kreis`, 'auf dem Kreis');
        if (!s.passtFlag) befund('Fehler', 'Parcours', 'Bogen-Flag passt zum Winkel', `Stück ${i + 1}`, `${s.dreh.toFixed(1)}° bei großem Bogen ${s.fA}`, 'passend');
      }
    }
    if (i > 0) {
      const vorher = stuecke[i - 1];
      if (dist(vorher.ende, s.start) > 0.03) {
        const k = kaesten.find((q) => aufRand(vorher.ende, q) && aufRand(s.start, q));
        if (!k) befund('Fehler', 'Parcours', 'Weg zusammenhängend', `Stück ${i + 1}`, `Lücke ${dist(vorher.ende, s.start).toFixed(2)} ohne Gate-Kasten`, 'lückenlos');
        else kette.push({ art: 'gate', kasten: k, ankunft: vorher.ende, austritt: s.start });
      } else {
        const sprung = abst(vorher.ausKurs, s.einKurs);
        if (sprung > 0.6) befund('Fehler', 'Parcours', 'Richtung stetig am Übergang', `Stück ${i} zu ${i + 1}`, `Knick ${sprung.toFixed(2)}°`, 'kein Knick');
      }
    }
    if (s.art === 'bogen' && istKreisRadius(s.r) && stuecke[i + 1] && stuecke[i + 1].art === 'bogen' && istKreisRadius(stuecke[i + 1].r)) {
      const t = stuecke[i + 1];
      if (!t.punkte) Object.assign(t, bogenAusTangente(t, s.ausKurs));
      if (t.fehlerRadius > 0.06) befund('Fehler', 'Parcours', 'Bogen tangential angesetzt', `Stück ${i + 2}`, `Endpunkt ${t.fehlerRadius.toFixed(2)} neben dem Kreis`, 'auf dem Kreis');
      const sprung2 = abst(s.ausKurs, t.einKurs);
      if (sprung2 > 0.6) befund('Fehler', 'Parcours', 'Richtung stetig am Übergang', `Stück ${i + 1} zu ${i + 2}`, `Knick ${sprung2.toFixed(2)}°`, 'kein Knick');
      const ok = Math.abs(Math.abs(s.dreh) - 180) < 0.5 && Math.abs(Math.abs(t.dreh) - 180) < 0.5 && Math.sign(s.dreh) === Math.sign(t.dreh) && dist(t.ende, s.start) < 0.03 && dist(s.ende, t.start) < 0.03;
      if (!ok) befund('Fehler', 'Parcours', 'Vollkreis aus zwei Halbkreisen gleicher Richtung', `Stück ${i + 1}`, `Drehung ${s.dreh.toFixed(1)}° und ${t.dreh.toFixed(1)}°`, 'zweimal 180° gleiche Richtung, geschlossen');
      kette.push({ art: 'vollkreis', stuecke: [s, t], richtung: s.dreh > 0 ? 'rechts' : 'links', profile: [s.profil, t.profil], punkt: s.start, gegen: s.ende });
      const nach = stuecke[i + 2];
      if (nach && dist(t.ende, nach.start) <= 0.03 && nach.art === 'bogen' && !nach.punkte) Object.assign(nach, bogenAusTangente(nach, t.ausKurs));
      i += 2; continue;
    }
    // Gradzahl-Kurve: Radius 24 oder eine einzelne Schleife mit Radius 35
    if (s.art === 'bogen' && (istKurvenRadius(s.r) || istKreisRadius(s.r))) kette.push({ art: 'kurve', stueck: s, index: i });
    else if (s.art === 'bogen') kette.push({ art: 'ecke', stueck: s, index: i });
    else kette.push({ art: 'segment', stueck: s, index: i });
    i += 1;
  }

  // Beschriftungen einteilen, Tinte berechnen
  const tinte = tinteMessen(texte);
  texte.forEach((t, k) => {
    t.tinte = tinte[k].zeilen.map((z) => tintenPolygon(t.t, z));
    t.tinteLokal = tinte[k].zeilen;
  });
  const segTexte = []; const eckTexte = []; const gateTexte = []; const kurvenTexte = []; const fettTexte = [];
  for (const t of texte) {
    if (t.klasse === 'nord') continue;
    if (t.klasse === 'gate') { gateTexte.push(t); continue; }
    if (t.klasse === 'fett') { fettTexte.push(t); continue; }
    if (t.zeilen.length === 1 && /^[+-]\d+°$/.test(t.zeilen[0])) { eckTexte.push(t); continue; }
    if (t.zeilen.length === 1 && /^\d+$/.test(t.zeilen[0])) { kurvenTexte.push(t); continue; }
    const l = beschriftungLesen(t.zeilen);
    if (!l) { befund('Fehler', 'Parcours', 'Beschriftung lesbar', 'Text', t.zeilen.join(' | '), 'Kurs/Sekunden, relative Angabe oder Gradzahl'); continue; }
    if (l.fehler) befund('Fehler', 'Parcours', 'Rechenaufgabe ohne Gradzeichen', l.roh, l.fehler, 'zweite Zeile wie +230');
    if (stufe === 2 && l.hrgk) befund('Fehler', 'Parcours', 'HR und GK nur in Stufe 3', l.roh, 'HR oder GK', 'Kurs, Himmelsrichtung oder ohne');
    t.lesung = l; segTexte.push(t);
    if (t.t.w < -90 || t.t.w > 90) befund('Fehler', 'Sicht', 'Beschriftung nicht auf dem Kopf', l.roh, `Drehung ${t.t.w}°`, '-90 bis 90°');
  }
  if (stufe === 2 && (kurvenTexte.length || fettTexte.length)) befund('Fehler', 'Parcours', 'Gradzahlen, Start und Ende nur in Stufe 3', 'Texte', [...kurvenTexte, ...fettTexte].map((t) => t.zeilen[0]).join(', '), 'keine');

  // Segmentbeschriftungen zu Strecken: parallel, Fußpunkt auf der Strecke, kleinster Abstand
  const segmente = kette.filter((e) => e.art === 'segment');
  const kandidaten = [];
  for (const t of segTexte) {
    const w = (t.t.w * Math.PI) / 180;
    const u = { x: Math.cos(w), y: Math.sin(w) };
    const mitte = anwenden(t.t, { x: 0, y: ((t.zeilen.length - 1) * 9) / 2 });
    t.blockMitte = mitte;
    for (const e of segmente) {
      const s = e.stueck; const v = vek(s.kurs);
      const parallel = Math.abs(kreuz(u, v)) < Math.sin((2 * Math.PI) / 180);
      const rel = sub(mitte, s.start);
      const tt = (rel.x * v.x + rel.y * v.y) / s.laenge;
      const quer = Math.abs(kreuz(v, rel));
      if (parallel && tt > -0.05 && tt < 1.05) kandidaten.push({ t, e, kosten: quer });
    }
  }
  kandidaten.sort((a, b2) => a.kosten - b2.kosten);
  for (const k of kandidaten) {
    if (k.t.segment || k.e.text) continue;
    k.t.segment = k.e; k.e.text = k.t; k.t.eigenAbstand = k.kosten;
  }
  for (const t of segTexte) {
    if (!t.segment) { befund('Fehler', 'Parcours', 'Beschriftung einem Segment zuzuordnen', t.lesung.roh, 'keine parallele Strecke daneben', 'eigene Strecke'); continue; }
    const andere = kandidaten.filter((k) => k.t === t && k.e !== t.segment);
    if (andere.length && andere[0].kosten < t.eigenAbstand + 4) {
      befund('Unschärfe', 'Parcours', 'Beschriftung eindeutig einem Segment zuzuordnen', t.lesung.roh, `eigene Strecke ${t.eigenAbstand.toFixed(1)}, parallele fremde ${andere[0].kosten.toFixed(1)} entfernt`, 'fremde mindestens 4 weiter');
    }
  }
  for (const e of segmente) if (!e.text) befund('Fehler', 'Parcours', 'jedes Segment beschriftet', `Segment bei Stück ${e.index + 1}`, 'ohne Beschriftung', 'Kurs/Sekunden');

  // Eck- und Kurvenbeschriftungen wie eine Pilotin per Ausschluss verteilen:
  // relative Angaben an Ecken vor Segmenten ohne Kurs, Gradzahlen an Kurven, so
  // dass die Summe der Abstände (Tinte zu Bogen) am kleinsten ist. Danach wird
  // geprüft, ob eine Angabe näher an einem anderen Bogen steht und ob eine
  // Vertauschung ähnlich gut passte. Vollkreise tragen nie eine Angabe und sind
  // keine Mitbewerber; steht eine Angabe näher an einem Vollkreis als an ihrem
  // Bogen, ist das nur ein Hinweis.
  const kreisStuecke = new Set(kette.filter((e) => e.art === 'vollkreis').flatMap((e) => e.stuecke));
  const perms = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, j) => perms([...arr.slice(0, j), ...arr.slice(j + 1)]).map((r) => [x, ...r])));
  const verteilen = (angaben, boegen, name) => {
    for (const t of angaben) {
      t.abstaende = new Map(boegen.map((e) => [e, zugPolygon(e.stueck.punkte, t.tinte[0])]));
      let naechster = null; let nd = Infinity; let kreisD = Infinity;
      for (const st of stuecke) {
        if (st.art !== 'bogen') continue;
        const d = zugPolygon(st.punkte, t.tinte[0]);
        if (kreisStuecke.has(st)) kreisD = Math.min(kreisD, d);
        else if (d < nd) { nd = d; naechster = st; }
      }
      t.naechsterBogen = naechster; t.naechsterAbstand = nd; t.kreisAbstand = kreisD;
    }
    if (angaben.length !== boegen.length) {
      befund('Fehler', 'Parcours', `je ${name} genau eine Angabe`, 'Parcours', `${angaben.length} Angaben, ${boegen.length} Stellen`, 'gleich viele');
      return;
    }
    if (!angaben.length) return;
    const varianten = perms(boegen.map((_, j) => j)).map((pm) => ({ pm, kosten: pm.reduce((sum, j, k) => sum + angaben[k].abstaende.get(boegen[j]), 0) }));
    varianten.sort((a, b2) => a.kosten - b2.kosten);
    const beste = varianten[0];
    beste.pm.forEach((j, k) => { const t = angaben[k]; const e = boegen[j]; t.ecke = e; t.eckAbstand = t.abstaende.get(e); e.texte = [t]; });
    if (varianten[1] && varianten[1].kosten < beste.kosten + 3) {
      const anders = varianten[1].pm.map((j, k) => (j !== beste.pm[k] ? angaben[k].zeilen[0] : null)).filter(Boolean);
      if (new Set(anders).size > 1) befund('Unschärfe', 'Parcours', `${name}: Angaben nicht vertauschbar`, anders.join(' / '), `Vertauschung kostet nur ${(varianten[1].kosten - beste.kosten).toFixed(1)} Einheiten mehr Abstand`, 'mindestens 3');
    }
    for (const t of angaben) {
      if (t.naechsterBogen !== t.ecke.stueck && t.naechsterAbstand < t.eckAbstand) {
        const art = istKreisRadius(t.naechsterBogen.r) ? 'Schleife' : 'anderer Bogen';
        befund('Unschärfe', 'Parcours', `${name}: Angabe steht an ihrem Bogen`, t.zeilen[0], `${art} ${t.naechsterAbstand.toFixed(1)} entfernt, eigener Bogen ${t.eckAbstand.toFixed(1)}`, 'eigener Bogen am nächsten', { x: t.t.x, y: t.t.y });
      }
      if (t.kreisAbstand < t.eckAbstand) {
        befund('Hinweis', 'Parcours', `${name}: Angabe näher an einem Vollkreis als an ihrem Bogen (Vollkreise tragen nie eine Angabe)`, t.zeilen[0], `Vollkreis ${t.kreisAbstand.toFixed(1)} entfernt, eigener Bogen ${t.eckAbstand.toFixed(1)}`, 'eigener Bogen am nächsten', { x: t.t.x, y: t.t.y });
      }
    }
  };
  const relEcken = kette.filter((e, j) => e.art === 'ecke' && kette[j + 1] && kette[j + 1].art === 'segment' && kette[j + 1].text && !kette[j + 1].text.lesung.mitKurs && !kette[j + 1].text.lesung.hrgk);
  verteilen(eckTexte, relEcken, 'relative Ecke');
  verteilen(kurvenTexte, kette.filter((e) => e.art === 'kurve'), 'Gradzahl-Kurve');

  // Flug nachrechnen
  let kurs = textEnde.kurs; let hoehe = textEnde.hoehe;
  const profile = [];
  const zahl = { segmente: 0, vollkreise: 0, kurven: 0, relativ: 0, hrgk: 0, rechen: 0, richtung: 0, gates: 0, formen: { a: 0, b: 0, c: 0 }, anl: 0 };
  const hoeheFliegen = (p, sek, stelle) => {
    profile.push(p);
    if (p === 'steigen') hoehe += RATE * sek;
    if (p === 'sinken') hoehe -= RATE * sek;
    if (hoehe < HMIN - 1e-9 || hoehe > HMAX + 1e-9) befund('Fehler', 'Parcours', 'Höhe 1000 bis 3000 ft', stelle, `${Math.round(hoehe)} ft`, '1000 bis 3000 ft');
  };
  const flugKurse = [];
  let vorigesElement = null; let segNr = 0; const gateLagen = []; const besondere = [];
  let offenerAnschluss = null; // Anschlusszeile des Gates davor (Form A)
  for (let n = 0; n < kette.length; n++) {
    const e = kette[n];
    if (e.art === 'segment') {
      segNr += 1; zahl.segmente += 1;
      const s = e.stueck; const t = e.text;
      const stelle = `Segment ${segNr}${t ? ` (${t.lesung.roh})` : ''}`;
      const gezeichnet = wahrerKurs(s.kurs);
      let soll = null;
      const eckeDavor = vorigesElement && vorigesElement.art === 'ecke' ? vorigesElement : null;
      const kurveDavor = vorigesElement && vorigesElement.art === 'kurve' ? vorigesElement : null;
      const relText = eckeDavor && eckeDavor.texte && eckeDavor.texte.length ? eckeDavor.texte : [];
      if (t) {
        const l = t.lesung;
        const sek = s.laenge / SEK_LAENGE;
        if (Math.abs(sek - l.sek) > 0.02) befund('Fehler', 'Parcours', 'Länge passt zur Dauer (5 Einheiten je s)', stelle, `gezeichnet ${sek.toFixed(2)} s`, `${l.sek} s`);
        if (!M.dauern.includes(l.sek)) befund('Fehler', 'Parcours', `Dauer ${M.dauern.join(', ')} s`, stelle, `${l.sek} s`, M.dauern.join(', '));
        if (l.rechen !== null) {
          zahl.rechen += 1;
          if (Math.abs(l.rechen) < 100 || Math.abs(l.rechen) > 350) befund('Fehler', 'Parcours', 'Rechenaufgabe Betrag 100 bis 350', stelle, String(l.rechen), '100 bis 350');
        }
        if (relText.length && (l.mitKurs || l.hrgk)) befund('Fehler', 'Parcours', 'relative Ecke nur vor Segment ohne Kurs', stelle, `Ecke ${relText[0].zeilen[0]} und Kurs am Segment`, 'eines von beiden');
        if (kurveDavor && (l.mitKurs || l.hrgk)) befund('Fehler', 'Parcours', 'nach einer Gradzahl-Kurve ein Segment ohne Kurs', stelle, l.roh, '/10" ohne Kurs');
        if (l.hrgk) {
          // HR und GK: der Kurs ergibt sich aus dem aktuellen oder genannten Kurs, die Ecke davor ist gezeichnet
          zahl.hrgk += 1;
          if (!eckeDavor) befund('Fehler', 'Parcours', 'HR und GK nach einer gezeichneten Ecke', stelle, vorigesElement ? vorigesElement.art : 'Anfang', 'Ecke');
          const d0 = eckeDavor ? eckeDavor.stueck.dreh : NaN;
          if (l.gk) {
            soll = norm(kurs + 180);
            if (eckeDavor && Math.abs(Math.abs(d0) - 180) > 0.6) befund('Fehler', 'Parcours', 'GK: Kehre von 180°', stelle, `gezeichnet ${d0.toFixed(1)}°`, '180° in beliebiger Richtung');
          } else if (l.hr) {
            const a = hrAbstand(kurs);
            if (a === 11.25) befund('Fehler', 'Parcours', 'HR eindeutig (Kurs nicht genau zwischen zwei Himmelsrichtungen)', stelle, `ab ${kursName(kurs)}`, 'nicht 11,25° neben einer Himmelsrichtung');
            else if (a < 5) befund('Fehler', 'Parcours', 'HR/: Ecke mindestens 5°', stelle, `ab ${kursName(kurs)}: ${a}°`, '5° bis 11,25°');
            soll = hrIndex(kurs) * 22.5;
            if (eckeDavor && Math.abs(d0 - diff(kurs, soll)) > 0.6) befund('Fehler', 'Parcours', 'HR/: Ecke auf kürzestem Weg zur nächsten Himmelsrichtung', stelle, `gezeichnet ${d0.toFixed(1)}°`, `${diff(kurs, soll).toFixed(1)}°`);
          } else {
            const g = l.hrGrad;
            if (g > 359) befund('Fehler', 'Parcours', 'Kurs 000 bis 359', stelle, String(g), '000 bis 359');
            if (hrAbstand(g) === 11.25) befund('Fehler', 'Parcours', 'HR eindeutig (Kurs nicht genau zwischen zwei Himmelsrichtungen)', stelle, `${g}°`, 'nicht 11,25° neben einer Himmelsrichtung');
            if (hrAbstand(g) === 0) befund('Hinweis', 'Parcours', 'HR mit Kurs: Kurs ist schon eine Himmelsrichtung', stelle, `${g}°`, 'neben einer Himmelsrichtung');
            soll = hrIndex(g) * 22.5;
            const d = diff(kurs, soll);
            if (Math.abs(d) < 20 || Math.abs(d) > 160) befund('Fehler', 'Parcours', 'Ecke vor Segment mit Kurs 20 bis 160° (kürzester Weg)', stelle, `${kursName(kurs)} nach ${kursName(soll)}: ${Math.abs(d)}°`, '20 bis 160°');
            if (eckeDavor && Math.abs(d0 - d) > 0.6) befund('Fehler', 'Parcours', 'Eckbogen auf kürzestem Weg', stelle, `gezeichnet ${d0.toFixed(1)}°`, `${d.toFixed(1)}°`);
          }
        } else if (l.mitKurs) {
          if (l.richtung !== null) {
            zahl.richtung += 1;
            const j = ENGLISCH.indexOf(l.richtung);
            if (j < 0) befund('Fehler', 'Parcours', 'Himmelsrichtung englisch', stelle, l.richtung, 'englische Schreibweise');
            soll = j * 22.5;
          } else {
            soll = l.grad;
            if (soll > 359) befund('Fehler', 'Parcours', 'Kurs 000 bis 359', stelle, String(soll), '000 bis 359');
          }
          if (segNr === 1) {
            // Beide Stufen schließen an den Textteil an
            const a = abst(textEnde.kurs, soll);
            if (a < 20 || a > 160) befund('Fehler', 'Übergang', 'erstes Segment 20 bis 160° vom Endkurs des Textteils', stelle, `${kursName(textEnde.kurs)} nach ${kursName(soll)}: ${a}°`, '20 bis 160°');
          } else if (vorigesElement && vorigesElement.art === 'gate') {
            const a = abst(kurs, soll);
            if (offenerAnschluss) {
              // Form A: die Anschlusszeile legt die Drehung fest
              const art = offenerAnschluss;
              if (art === 'kürz. W.') {
                if (a < 20 || a > 160) befund('Fehler', 'Gate', 'kürz. W. auf K: 20 bis 160°', stelle, `${kursName(kurs)} nach ${kursName(soll)}: ${a}°`, '20 bis 160°');
              } else {
                const grenze = art === 'über N' ? 0 : 180;
                if (norm(kurs) === grenze || norm(soll) === grenze) befund('Fehler', 'Gate', `${art} auf K eindeutig`, stelle, `von ${kursName(kurs)} auf ${kursName(soll)}`, `weder Anfang noch Ziel auf ${d3(grenze)}°`);
                else if (a === 180) befund('Fehler', 'Gate', `${art} auf K eindeutig`, stelle, `${kursName(kurs)} nach ${kursName(soll)}: genau 180°`, 'nicht 180°');
                else if (a < 20) befund('Unschärfe', 'Gate', `${art} auf K: deutlicher Kurswechsel`, stelle, `${kursName(kurs)} nach ${kursName(soll)}: ${a}°`, 'mindestens 20°');
              }
              zahl.anschluss = (zahl.anschluss || 0) + 1;
            } else if (a < 20 || a > 160) befund('Fehler', 'Gate', 'Segment nach Gate 20 bis 160° vom letzten Gate-Kurs', stelle, `${kursName(kurs)} nach ${kursName(soll)}: ${a}°`, '20 bis 160°');
          } else if (eckeDavor) {
            const d = diff(kurs, soll);
            if (Math.abs(d) < 20 || Math.abs(d) > 160) befund('Fehler', 'Parcours', 'Ecke vor Segment mit Kurs 20 bis 160° (kürzester Weg)', stelle, `${kursName(kurs)} nach ${kursName(soll)}: ${Math.abs(d)}°`, '20 bis 160°');
            if (Math.abs(eckeDavor.stueck.dreh - d) > 0.6) befund('Fehler', 'Parcours', 'Eckbogen auf kürzestem Weg', stelle, `gezeichnet ${eckeDavor.stueck.dreh.toFixed(1)}°`, `${d.toFixed(1)}°`);
          } else if (!kurveDavor) {
            befund('Fehler', 'Parcours', 'Kurswechsel zwischen zwei Segmenten gezeichnet', stelle, 'keine Ecke', 'Ecke oder Gate');
          }
        } else if (kurveDavor) {
          // Segment ohne Kurs nach einer Gradzahl-Kurve: Kurs davor plus oder minus Winkel
          soll = kurveDavor.kursDanach;
        } else {
          // Segment ohne Kurs: relative Ecke davor
          if (!eckeDavor || !relText.length) {
            befund('Fehler', 'Parcours', 'Segment ohne Kurs hat relative Ecke oder Kurve davor', stelle, eckeDavor ? 'Ecke ohne Angabe' : 'keine Ecke davor', 'Angabe wie +90°');
          } else {
            zahl.relativ += 1;
            const r = relText[0].wert !== undefined ? relText[0].wert : Number(relText[0].zeilen[0].slice(0, -1));
            if (Math.abs(r) < 20 || Math.abs(r) > 340 || Math.abs(r) === 180) befund('Fehler', 'Parcours', 'relative Kursänderung 20 bis 340°, nicht 180°', stelle, `${r}°`, '20 bis 340°, nicht 180°');
            else if (Math.abs(Math.abs(r) - 180) <= 15) befund('Hinweis', 'Parcours', 'relative Kursänderung nahe 180°', stelle, `${r}°`, 'deutlich von 180° verschieden');
            if (Math.abs(eckeDavor.stueck.dreh - r) > 0.6) befund('Fehler', 'Parcours', 'Eckbogen passt zur relativen Angabe', stelle, `gezeichnet ${eckeDavor.stueck.dreh.toFixed(1)}°`, `${r}°`);
            if (!Number.isInteger(kurs)) befund('Hinweis', 'Parcours', 'relative Ecke ab ganzzahligem Kurs', stelle, `ab ${kursName(kurs)} ergibt ${kursName(norm(kurs + r))}`, 'ganzzahliger Kurs');
            soll = norm(kurs + r);
          }
        }
        if (!l.mitKurs && !l.hrgk) {
          if (vorigesElement && vorigesElement.art === 'gate') befund('Fehler', 'Gate', 'Segment nach Gate trägt einen Kurs', stelle, 'ohne Kurs', 'Kurs oder Himmelsrichtung');
          if (segNr === 1) befund('Fehler', 'Übergang', 'erstes Segment trägt einen Kurs', stelle, 'ohne Kurs', 'eigener Kurs');
        }
        if (l.hrgk && vorigesElement && vorigesElement.art === 'gate') befund('Fehler', 'Gate', 'Segment nach Gate mit eigenem Kurs, nicht HR oder GK', stelle, l.roh, 'Kurs oder Himmelsrichtung');
        if (soll !== null && !Number.isNaN(soll)) {
          if (abst(soll, gezeichnet) > 0.4) befund('Fehler', 'Parcours', 'gezeichnete Richtung passt zum Kurs', stelle, `gezeichnet ${gezeichnet.toFixed(1)}°`, `${kursName(soll)}`);
          kurs = soll;
        } else kurs = gezeichnet;
        hoeheFliegen(s.profil, l.sek, stelle);
      } else {
        kurs = gezeichnet;
        hoeheFliegen(s.profil, s.laenge / SEK_LAENGE, stelle);
      }
      offenerAnschluss = null;
      const naechstes = kette[n + 1];
      if (naechstes && naechstes.art === 'ecke' && naechstes.stueck.profil !== s.profil) befund('Hinweis', 'Parcours', 'Eckbogen in der Linienart des Segments davor', stelle, naechstes.stueck.profil, s.profil);
      e.kurs = kurs;
      flugKurse.push({ art: 'segment', kurs });
    } else if (e.art === 'vollkreis') {
      zahl.vollkreise += 1;
      const stelle = `Vollkreis nach Segment ${segNr}`;
      besondere.push({ art: 'Vollkreis', nachSeg: segNr, n });
      if (!vorigesElement || vorigesElement.art !== 'segment') befund('Fehler', 'Parcours', 'Vollkreis folgt auf ein Segment', stelle, vorigesElement ? vorigesElement.art : 'Anfang', 'Segment');
      const ein = wahrerKurs(e.stuecke[0].einKurs);
      if (abst(ein, kurs) > 2) befund('Fehler', 'Parcours', 'Vollkreis beginnt auf dem Kurs davor', stelle, kursName(ein), kursName(kurs));
      const aus = wahrerKurs(e.stuecke[1].ausKurs);
      if (abst(aus, kurs) > 2) befund('Fehler', 'Parcours', 'Vollkreis endet auf dem Kurs davor', stelle, kursName(aus), kursName(kurs));
      hoeheFliegen(e.profile[0], 60, `${stelle}, erste Hälfte`);
      hoeheFliegen(e.profile[1], 60, `${stelle}, zweite Hälfte`);
      for (const [p, k, name] of [[e.punkt, e.stuecke[0].einKurs, 'Berührpunkt'], [e.gegen, e.stuecke[1].einKurs, '180°']]) {
        const ok = marken.some((mk) => dist(mk.m, p) < 0.1 && Math.abs(Math.cos(((peilung(mk.b.x - mk.a.x, mk.b.y - mk.a.y) - k) * Math.PI) / 180)) < 0.02);
        if (!ok) befund('Unschärfe', 'Parcours', 'Querstrich am Vollkreis', `${stelle}, ${name}`, 'fehlt', 'Querstrich quer zum Weg');
      }
    } else if (e.art === 'kurve') {
      zahl.kurven += 1;
      const s = e.stueck;
      const stelle = `Gradzahl-Kurve nach Segment ${segNr}`;
      besondere.push({ art: 'Kurve', nachSeg: segNr, n });
      if (stufe === 2) befund('Fehler', 'Parcours', 'Gradzahl-Kurven nur in Stufe 3', stelle, `Radius ${s.r}`, 'keine');
      if (!vorigesElement || vorigesElement.art !== 'segment') befund('Fehler', 'Parcours', 'Kurve folgt auf ein Segment', stelle, vorigesElement ? vorigesElement.art : 'Anfang', 'Segment');
      const naechstes = kette[n + 1];
      if (!naechstes || naechstes.art !== 'segment') befund('Fehler', 'Parcours', 'auf eine Kurve folgt ein Segment ohne Ecke', stelle, naechstes ? naechstes.art : 'Ende', 'Segment');
      const w = Math.abs(s.dreh);
      if (w < 40 - 0.5 || w > 340 + 0.5 || Math.abs(w - 180) < 0.5) befund('Fehler', 'Parcours', 'Kurve 40 bis 340°, nicht 180°', stelle, `${w.toFixed(1)}°`, '40 bis 340°');
      if ((w > 180) !== istKreisRadius(s.r)) befund('Fehler', 'Parcours', 'Kurvenradius 35 ab 180°, sonst 24', stelle, `Radius ${s.r} bei ${w.toFixed(1)}°`, w > 180 ? '35' : '24');
      const text = e.texte && e.texte[0];
      if (text && Math.abs(Number(text.zeilen[0]) - w) > 0.6) befund('Fehler', 'Parcours', 'Gradzahl passt zur gezeichneten Kurve', stelle, `Angabe ${text.zeilen[0]}, gezeichnet ${w.toFixed(1)}°`, 'gleich');
      const ein = wahrerKurs(s.einKurs);
      if (abst(ein, kurs) > 0.6) befund('Fehler', 'Parcours', 'Kurve beginnt auf dem Kurs davor', stelle, kursName(ein), kursName(kurs));
      // Querstrich am Anfang der Kurve, quer zum Weg
      const okAnfang = marken.some((mk) => dist(mk.m, s.start) < 0.1 && Math.abs(Math.cos(((peilung(mk.b.x - mk.a.x, mk.b.y - mk.a.y) - s.einKurs) * Math.PI) / 180)) < 0.02);
      if (!okAnfang) befund('Unschärfe', 'Parcours', 'Querstrich am Anfang der Kurve', stelle, 'fehlt', 'Querstrich quer zum Weg');
      // Drehung in gezeichneter Richtung, mit der Gradzahl als Betrag
      const betrag = text ? Number(text.zeilen[0]) : w;
      e.kursDanach = norm(kurs + Math.sign(s.dreh) * betrag);
      hoeheFliegen(s.profil, betrag / KURVENRATE, stelle);
    } else if (e.art === 'ecke') {
      const naechstes = kette[n + 1];
      if (!naechstes || naechstes.art !== 'segment') befund('Fehler', 'Parcours', 'Ecke führt zu einem Segment', `Ecke nach Segment ${segNr}`, naechstes ? naechstes.art : 'Ende', 'Segment');
      if (vorigesElement && vorigesElement.art === 'ecke') befund('Fehler', 'Parcours', 'Ecke folgt auf Segment oder Vollkreis', `Ecke nach Segment ${segNr}`, 'zwei Ecken hintereinander', 'eine');
    } else if (e.art === 'gate') {
      zahl.gates += 1;
      const stelle = `Gate ${zahl.gates} nach Segment ${segNr}`;
      gateLagen.push({ nachSeg: segNr, n });
      besondere.push({ art: 'Gate', nachSeg: segNr, n });
      const k = e.kasten;
      const gt = gateTexte.filter((t) => imPolygon(t.t, k.poly));
      if (gt.length !== 1) befund('Fehler', 'Gate', 'ein Text je Gate-Kasten', stelle, `${gt.length} Texte`, 'einer');
      const text = gt[0];
      if (text) {
        text.kasten = k;
        const zeilenTexte = [...text.zeilen];
        let anschluss = null;
        if (ANSCHLUSS.test(zeilenTexte[zeilenTexte.length - 1])) anschluss = zeilenTexte.pop().match(ANSCHLUSS)[1];
        const zeilen = zeilenTexte.map(gateZeileLesen);
        const formC = zeilen.length && zeilen.every((z) => z && z.form === 'c');
        const form = stufe === 2 ? 'stufe2' : formC ? 'c' : anschluss ? 'a' : 'b';
        if (stufe === 3) zahl.formen[form] += 1;
        const muster = {
          stufe2: [3, 4, 'Wert Pfeil Sekunden'], a: [3, 3, 'Wert Pfeil Sekunden, Relativwerte mit Gradzeichen'],
          b: [4, 4, 'Wert Pfeil Sekunden, Relativwerte ohne Gradzeichen'], c: [3, 4, 'Pfeil Ausdruck Sekunden'],
        }[form];
        if (zeilen.length < muster[0] || zeilen.length > muster[1]) befund('Fehler', 'Gate', `Zeilenzahl ${form === 'stufe2' ? 'Stufe 2' : `Form ${form.toUpperCase()}`}`, stelle, `${zeilen.length} Zeilen`, muster[0] === muster[1] ? String(muster[0]) : `${muster[0]} bis ${muster[1]}`);
        if (stufe === 2 && anschluss) befund('Fehler', 'Gate', 'Anschlusszeile nur in Stufe 3', stelle, anschluss, 'keine');
        if (stufe === 3 && formC && anschluss) befund('Fehler', 'Gate', 'Anschlusszeile nur in Form A', stelle, anschluss, 'keine');
        if ((form === 'stufe2' || form === 'b') && !zeilen.some((z) => z && z.typ === 'relativ')) befund('Fehler', 'Gate', 'mindestens eine relative Zeile', stelle, text.zeilen.join(' / '), 'eine Zeile wie +72');
        if (form === 'a' && !zeilen.some((z) => z && z.typ === 'relativ')) befund('Hinweis', 'Gate', 'Form A mit relativer Zeile wie in der PDF', stelle, text.zeilen.join(' / '), 'eine Zeile wie +127°');
        zeilen.forEach((z, j) => {
          const st = `${stelle}, Zeile ${j + 1} (${zeilenTexte[j]})`;
          if (!z) { befund('Fehler', 'Gate', 'Gate-Zeile lesbar', st, zeilenTexte[j], muster[2]); return; }
          if ((form === 'c') !== (z.form === 'c')) { befund('Fehler', 'Gate', 'Zeilen eines Gates in einer Form', st, zeilenTexte[j], muster[2]); return; }
          if (z.typ === 'relativ' && form === 'a' && !z.gradzeichen) befund('Fehler', 'Gate', 'Form A: Relativwert mit Gradzeichen', st, zeilenTexte[j], '+127°');
          if (z.typ === 'relativ' && (form === 'b' || form === 'stufe2') && z.gradzeichen) befund('Fehler', 'Gate', 'Relativwert ohne Gradzeichen', st, zeilenTexte[j], '+72');
          // Zwei Kehren ohne Richtung hintereinander führen auf den alten Kurs zurück; der Entwurf schließt sie aus
          if (z.typ === 'gk' && j > 0 && zeilen[j - 1] && zeilen[j - 1].typ === 'gk') befund('Unschärfe', 'Gate', 'Form C: keine zwei reinen GK hintereinander', st, `${zeilenTexte[j - 1]} / ${zeilenTexte[j]}`, 'GK ± n oder ein anderer Ausdruck');
          let neu;
          let beliebigeRichtung = false;
          if (z.typ === 'relativ') {
            // Form A wie in der PDF (+182°) bis 190, Form B und Stufe 2 bis 490
            const [min, max] = form === 'a' ? [20, 190] : [20, 490];
            if (Math.abs(z.wert) < min || Math.abs(z.wert) > max) befund('Fehler', 'Gate', `Relativwert Betrag ${min} bis ${max}`, st, String(z.wert), `${min} bis ${max}`);
            neu = norm(kurs + z.wert);
            const d = diff(kurs, neu); const a = Math.abs(d);
            // Über den Gate-Blättern der Stufe 2 steht "Relative Werte mit dem
            // aktuellen Kurs verrechnen, gedreht wird auf kürzestem Weg"; Stufe 3
            // setzt die Regel ohne diese Zeile voraus. Zeigt das Vorzeichen in die
            // andere Richtung, ist das nach dieser Regel eindeutig (Hinweis). Unscharf ist
            // der kürzeste Weg über 160° und genau 180°: Dann bleibt nur das
            // Vorzeichen als Richtung, der Kurs danach ist in jeder Lesart derselbe.
            // Form A nimmt wie die PDF (+182°) Werte bis 190; über 160° zeigt dort
            // das Vorzeichen mit Gradzeichen die Richtung (Hinweis), nur genau 180°
            // bleibt unscharf.
            const text = `${kursName(kurs)} ${z.wert > 0 ? '+' : ''}${z.wert} = ${kursName(neu)}`;
            if (a === 180) {
              beliebigeRichtung = true;
              befund('Unschärfe', 'Gate', 'Drehrichtung bei Relativwert (kürzester Weg über 160°)', st, `${text}; genau 180°, Richtung nur aus dem Vorzeichen (${z.wert > 0 ? 'rechts' : 'links'})`, 'kürzester Weg höchstens 160°');
            } else if (a > 160 && form === 'a') {
              befund('Hinweis', 'Gate', 'Form A: Relativwert über 160° wie in der PDF (+182°)', st, `${text}; kürzester Weg ${d > 0 ? 'rechts' : 'links'} ${Math.round(a * 10) / 10}°`, 'Vorzeichen nennt die Richtung');
            } else if (a > 160) {
              befund('Unschärfe', 'Gate', 'Drehrichtung bei Relativwert (kürzester Weg über 160°)', st, `${text}; kürzester Weg ${d > 0 ? 'rechts' : 'links'} ${Math.round(a * 10) / 10}°`, 'kürzester Weg höchstens 160°');
            } else if (a >= 20 && (z.wert > 0) !== (d > 0)) {
              befund('Hinweis', 'Gate', `Vorzeichen gegen kürzesten Weg (${stufe === 2 ? 'Regel steht über dem Blatt' : 'Regel aus Stufe 2, nicht auf dem Blatt'})`, st, `${text}; kürzester Weg ${d > 0 ? 'rechts' : 'links'} ${Math.round(a * 10) / 10}°, Vorzeichen deutet ${z.wert > 0 ? 'rechts' : 'links'}`, 'kürzester Weg');
            }
            if (!Number.isInteger(kurs)) befund('Hinweis', 'Gate', 'Relativwert ab ganzzahligem Kurs', st, `ab ${kursName(kurs)}`, 'ganzzahliger Kurs');
          } else if (z.typ === 'richtung' || z.typ === 'richtungPlus') {
            const j2 = ENGLISCH.indexOf(z.richtung);
            if (j2 < 0) befund('Fehler', 'Gate', 'Himmelsrichtung englisch', st, z.richtung, 'englisch');
            neu = j2 * 22.5;
            if (z.typ === 'richtungPlus') {
              if (Math.abs(z.wert) < 10 || Math.abs(z.wert) > 130) befund('Fehler', 'Gate', 'Himmelsrichtung ± 10 bis 130', st, String(z.wert), '10 bis 130');
              neu = norm(neu + z.wert);
            }
          } else if (z.typ === 'grad') {
            neu = z.wert;
            if (neu > 359) befund('Fehler', 'Gate', 'Kurs 000 bis 359', st, String(neu), '000 bis 359');
          } else if (z.typ === 'gk') {
            neu = norm(kurs + 180);
            beliebigeRichtung = true;
          } else if (z.typ === 'gkPlus') {
            if (Math.abs(z.wert) < 10 || Math.abs(z.wert) > 60) befund('Fehler', 'Gate', 'GK ± 10 bis 60', st, String(z.wert), '10 bis 60');
            neu = norm(kurs + 180 + z.wert);
          } else {
            zahl.anl += 1;
            if (z.typ === 'anlProdukt' && (z.a < 2 || z.a > 9 || z.b < 2 || z.b > 13)) befund('Fehler', 'Gate', 'anl. Kurs +a×b mit a von 2 bis 9, b von 2 bis 13 (wie 9×13)', st, `${z.a}×${z.b}`, 'a 2 bis 9, b 2 bis 13');
            if (z.wert < 20 || z.wert > 160) befund('Fehler', 'Gate', 'anl. Kurs: Ergebnis 20 bis 160', st, String(z.wert), '20 bis 160');
            neu = norm(kurs + z.wert);
          }
          const a = abst(kurs, neu);
          if (!beliebigeRichtung) {
            if (a < 20) befund('Fehler', 'Gate', 'neuer Kurs mindestens 20° vom alten', st, `${kursName(kurs)} nach ${kursName(neu)}: ${a}°`, 'mindestens 20°');
            else if (a === 180) befund('Fehler', 'Gate', 'Drehrichtung eindeutig', st, `${kursName(kurs)} nach ${kursName(neu)}: genau 180°`, 'nicht 180°');
            else if (a > 160 && z.typ !== 'relativ') befund(z.typ === 'richtung' || z.typ === 'grad' ? 'Fehler' : 'Unschärfe', 'Gate', 'kürzester Weg eindeutig (20 bis 160°)', st, `${kursName(kurs)} nach ${kursName(neu)}: ${a}°`, '20 bis 160°');
          }
          if (!M.gateDauern.includes(z.sek)) befund('Fehler', 'Gate', `Gate-Dauer ${M.gateDauern.join(', ')} s`, st, `${z.sek} s`, M.gateDauern.join(', '));
          hoeheFliegen(z.profil, z.sek, st);
          kurs = neu;
          flugKurse.push({ art: 'gate', kurs });
        });
        offenerAnschluss = anschluss;
        // Text passt in den Kasten
        const innen = [{ x: k.x + 0.75, y: k.y + 0.75 }, { x: k.x + k.w - 0.75, y: k.y + 0.75 }, { x: k.x + k.w - 0.75, y: k.y + k.h - 0.75 }, { x: k.x + 0.75, y: k.y + k.h - 0.75 }];
        for (const poly of text.tinte) {
          if (!poly.every((p) => imPolygon(p, innen))) befund('Fehler', 'Sicht', 'Gate-Text im Kasten', stelle, 'Text ragt über den Rand', 'ganz im Kasten');
        }
      }
      // Ankunft und Austritt
      const vorSeg = vorigesElement && vorigesElement.art === 'segment' ? vorigesElement : null;
      const nachSeg = kette[n + 1] && kette[n + 1].art === 'segment' ? kette[n + 1] : null;
      if (!vorSeg || !nachSeg) befund('Fehler', 'Gate', 'Gate zwischen zwei Segmenten', stelle, `${vorigesElement ? vorigesElement.art : 'Anfang'} / ${kette[n + 1] ? kette[n + 1].art : 'Ende'}`, 'Segment / Segment');
      if (nachSeg) {
        const s = nachSeg.stueck;
        const mitteK = { x: k.x + k.w / 2, y: k.y + k.h / 2 };
        const strahl = peilung(s.start.x - mitteK.x, s.start.y - mitteK.y);
        if (abst(strahl, s.kurs) > 1.5) befund('Hinweis', 'Gate', 'Austritt in Richtung des neuen Kurses vom Kastenmittelpunkt', stelle, `Strahl ${strahl.toFixed(1)}°, Linie ${s.kurs.toFixed(1)}°`, 'gleich');
        const mitteLinie = { x: (s.start.x + s.ende.x) / 2, y: (s.start.y + s.ende.y) / 2 };
        if (imPolygon(mitteLinie, k.poly)) befund('Fehler', 'Gate', 'abgehende Linie läuft nach außen', stelle, 'läuft durch den Kasten', 'nach außen');
      }
      if (vorSeg) {
        const s = vorSeg.stueck;
        const mitteLinie = { x: (s.start.x + s.ende.x) / 2, y: (s.start.y + s.ende.y) / 2 };
        if (imPolygon(mitteLinie, k.poly)) befund('Fehler', 'Gate', 'ankommende Linie endet am Kasten', stelle, 'läuft durch den Kasten', 'endet am Rand');
      }
      if (dist(e.ankunft, e.austritt) < 9) befund('Unschärfe', 'Gate', 'Ankunft und Austritt getrennt', stelle, `Abstand ${dist(e.ankunft, e.austritt).toFixed(1)}`, 'mindestens eine Strichbreite');
    }
    vorigesElement = e;
  }

  // Mengen
  if (kette[0].art !== 'segment') befund('Fehler', 'Mengen', 'Parcours beginnt mit Segment', 'Anfang', kette[0].art, 'Segment');
  if (kette[kette.length - 1].art !== 'segment') befund('Fehler', 'Mengen', 'Parcours endet mit Segment', 'Ende', kette[kette.length - 1].art, 'Segment');
  const bereich = (wert, [von, bis], regel) => { if (wert < von || wert > bis) befund('Fehler', 'Mengen', `${regel} ${von} bis ${bis}`, 'Parcours', String(wert), `${von} bis ${bis}`); };
  if (stufe === 2) {
    const gatesSoll = b.nummer % 3 === 0;
    const [smin, smax] = gatesSoll ? [15, 19] : [18, 22];
    bereich(zahl.segmente, [smin, smax], 'Segmente');
    bereich(zahl.vollkreise, [2, 2], 'Vollkreise');
    bereich(zahl.relativ, [3, 4], 'relative Ecken');
    bereich(zahl.rechen, [4, 5], 'Rechenaufgaben');
    bereich(zahl.richtung, [3, 4], 'Himmelsrichtungen');
    if (gatesSoll) bereich(zahl.gates, [3, 4], 'Gates (Nummer teilbar durch 3)');
    if (!gatesSoll && zahl.gates) befund('Fehler', 'Mengen', 'keine Gates auf anderen Blättern', 'Parcours', String(zahl.gates), '0');
    const kreise = besondere.filter((x) => x.art === 'Vollkreis');
    for (let j = 1; j < kreise.length; j++) {
      if (kreise[j].nachSeg === kreise[j - 1].nachSeg) befund('Fehler', 'Mengen', 'Vollkreise nicht direkt hintereinander', `nach Segment ${kreise[j].nachSeg}`, 'direkt hintereinander', 'mindestens ein Segment dazwischen');
    }
    for (const v of kreise) {
      if (v.nachSeg === zahl.segmente) befund('Fehler', 'Mengen', 'Vollkreis nicht am Ende', `nach Segment ${v.nachSeg}`, 'am Ende', 'nicht am Ende');
      if (v.nachSeg < 1) befund('Fehler', 'Mengen', 'Vollkreis nicht am Anfang', 'Anfang', 'am Anfang', 'nicht am Anfang');
    }
    gateLagen.forEach((g, j) => {
      if (g.nachSeg < 2) befund('Fehler', 'Mengen', 'Gate nicht am ersten Segment', `Gate ${j + 1}`, `nach Segment ${g.nachSeg}`, 'mindestens zwei Segmente davor');
      if (zahl.segmente - g.nachSeg < 2) befund('Fehler', 'Mengen', 'Gate nicht am letzten Segment', `Gate ${j + 1}`, `nach Segment ${g.nachSeg} von ${zahl.segmente}`, 'mindestens zwei Segmente danach');
      if (j > 0 && g.nachSeg - gateLagen[j - 1].nachSeg < 2) befund('Fehler', 'Mengen', 'mindestens zwei Segmente zwischen zwei Gates', `Gate ${j} und ${j + 1}`, `${g.nachSeg - gateLagen[j - 1].nachSeg} Segmente`, 'mindestens 2');
      if (kette[g.n - 1] && kette[g.n - 1].art === 'vollkreis') befund('Fehler', 'Mengen', 'Gate nicht direkt nach Vollkreis', `Gate ${j + 1}`, 'direkt nach Vollkreis', 'Segment dazwischen');
      if (kette[g.n + 1] && kette[g.n + 1].art === 'vollkreis') befund('Fehler', 'Mengen', 'Gate nicht direkt vor Vollkreis', `Gate ${j + 1}`, 'direkt vor Vollkreis', 'Segment dazwischen');
    });
  } else {
    bereich(zahl.segmente, M.segmente, 'Segmente');
    bereich(zahl.vollkreise, M.vollkreise, 'Vollkreise');
    bereich(zahl.kurven, M.kurven, 'Gradzahl-Kurven');
    bereich(zahl.gates, M.gates, 'Gates');
    bereich(zahl.relativ, M.relativ, 'relative Ecken');
    bereich(zahl.hrgk, M.hrgk, 'Segmente mit HR oder GK');
    bereich(zahl.rechen, M.rechen, 'Rechenaufgaben');
    bereich(zahl.richtung, M.richtung, 'Himmelsrichtungen');
    if (zahl.anl > 1) befund('Fehler', 'Mengen', 'anl. Kurs höchstens einmal je Blatt', 'Parcours', String(zahl.anl), 'höchstens 1');
    // Gates, Vollkreise und Kurven: nie am ersten oder letzten Segment, mindestens ein Segment dazwischen
    besondere.forEach((x, j) => {
      if (x.nachSeg < 2) befund('Fehler', 'Mengen', `${x.art} nicht am ersten Segment`, `${x.art} nach Segment ${x.nachSeg}`, 'am ersten Segment', 'mindestens zwei Segmente davor');
      if (zahl.segmente - x.nachSeg < 2) befund('Fehler', 'Mengen', `${x.art} nicht am letzten Segment`, `${x.art} nach Segment ${x.nachSeg}`, `von ${zahl.segmente}`, 'mindestens zwei Segmente danach');
      if (j > 0 && besondere[j - 1].nachSeg === x.nachSeg) befund('Fehler', 'Mengen', 'Gates, Vollkreise und Kurven nicht direkt hintereinander', `${besondere[j - 1].art} und ${x.art} nach Segment ${x.nachSeg}`, 'direkt hintereinander', 'mindestens ein Segment dazwischen');
    });
  }
  for (let j = 3; j < profile.length; j++) {
    if (profile.slice(j - 3, j + 1).every((p) => p === profile[j])) befund('Fehler', 'Mengen', 'kein Profil viermal hintereinander (Parcours)', `Profil ${j - 2} bis ${j + 1}`, profile[j], 'höchstens dreimal');
  }
  const zp = { horizontal: 0, steigen: 0, sinken: 0 };
  profile.forEach((p) => { zp[p] += 1; });
  const zw = Object.values(zp);
  if (Math.min(...zw) === 0 || Math.max(...zw) > 2.5 * Math.min(...zw)) befund('Hinweis', 'Mengen', 'Profile etwa gleich verteilt (Parcours)', 'Parcours', JSON.stringify(zp), 'etwa gleich');

  // Querstriche an jedem Segmentanfang und am Ende
  for (const e of segmente) {
    const s = e.stueck;
    const v = vek(s.kurs);
    const ok = marken.some((mk) => {
      const rel = sub(mk.m, s.start);
      const laengs = rel.x * v.x + rel.y * v.y;
      const quer = Math.abs(kreuz(v, rel));
      const richtung = peilung(mk.b.x - mk.a.x, mk.b.y - mk.a.y);
      return quer < 0.1 && laengs > -0.1 && laengs < 12 && Math.abs(Math.cos(((richtung - s.kurs) * Math.PI) / 180)) < 0.02;
    });
    if (!ok) befund('Unschärfe', 'Parcours', 'Querstrich am Segmentanfang', e.text ? e.text.lesung.roh : `Stück ${e.index + 1}`, 'fehlt', 'Querstrich');
  }
  const letztes = stuecke[stuecke.length - 1];
  if (!marken.some((mk) => dist(mk.m, letztes.ende) < 0.1)) befund('Hinweis', 'Parcours', 'Querstrich am Ende', 'Ende', 'fehlt', 'Querstrich');

  // Flugzeugsymbol
  const fz = flugzeugPolygon(svg.flugzeug);
  const erstes = segmente[0].stueck;
  if (abst(fz.t.w, erstes.kurs) > 0.6) befund('Fehler', 'Parcours', 'Flugzeugsymbol zeigt in die erste Flugrichtung', 'Flugzeug', `${fz.t.w}°`, `${erstes.kurs.toFixed(1)}°`);
  const fzSoll = { x: erstes.start.x - vek(erstes.kurs).x * 19, y: erstes.start.y - vek(erstes.kurs).y * 19 };
  if (dist(fzSoll, fz.t) > 0.2) befund('Unschärfe', 'Parcours', 'Flugzeugsymbol am Start', 'Flugzeug', `Abstand ${dist(fzSoll, fz.t).toFixed(1)} von der Sollage`, '19 hinter dem Start');

  // Start und Ende (Stufe 3): fett, waagerecht, "Start" hinter dem
  // Flugzeugsymbol, "Ende" hinter dem Ende des letzten Segments. Die Höhe steht
  // nicht am Start, sie kommt vom Ende des Textteils.
  if (stufe === 3) {
    const start = fettTexte.filter((t) => t.zeilen.join() === 'Start');
    const ende = fettTexte.filter((t) => t.zeilen.join() === 'Ende');
    if (start.length !== 1 || ende.length !== 1 || fettTexte.length !== 2) befund('Fehler', 'Parcours', 'Start und Ende je einmal beschriftet, fett', 'Start/Ende', fettTexte.map((t) => t.zeilen.join(' ')).join(', ') || 'keine', 'Start, Ende');
    if (!/\.parcours text\.fett \{[^}]*font-weight: 700/.test(svg.stil)) befund('Fehler', 'Sicht', 'Start und Ende fett', 'Stil', 'keine Regel für fett', 'font-weight: 700');
    const lage = (t, anker, richtung, name, maxAbstand) => {
      if (!t) return;
      if (t.t.w !== 0) befund('Fehler', 'Sicht', `${name} waagerecht`, name, `Drehung ${t.t.w}°`, '0°');
      const d = dist(t.t, anker);
      const winkel = abst(peilung(t.t.x - anker.x, t.t.y - anker.y), richtung);
      if (d > maxAbstand || winkel > 50) befund('Unschärfe', 'Parcours', `${name} an seiner Stelle`, name, `Abstand ${d.toFixed(1)}, ${winkel.toFixed(0)}° neben der Richtung`, `höchstens ${maxAbstand}, höchstens 50°`);
    };
    // Mitte 23 hinter dem Symbol plus höchstens die halbe Textbreite
    lage(start[0], fz.t, norm(erstes.kurs + 180), 'Start', 75);
    const letzteStrecke = segmente[segmente.length - 1].stueck;
    lage(ende[0], letzteStrecke.ende, letzteStrecke.kurs, 'Ende', 45);
    // "Start" gehört sichtbar zum Flugzeugsymbol, "Ende" zum Ende des Wegs:
    // Die Tinte steht dem eigenen Punkt näher als dem anderen (Blatt 92 hatte
    // "Start 2000 ft" direkt unter "Ende")
    const naeher = (t, eigen, fremd, name, fremdName) => {
      if (!t) return;
      const d = (p) => Math.min(...t.tinte.map((poly) => zugPolygon([p], poly)));
      if (d(fremd) <= d(eigen)) befund('Unschärfe', 'Parcours', 'Start und Ende näher an ihrem Punkt als am anderen', name, `${fremdName} ${d(fremd).toFixed(1)}, eigener Punkt ${d(eigen).toFixed(1)}`, 'eigener Punkt am nächsten');
    };
    naeher(start[0], fz.t, letzteStrecke.ende, 'Start', 'Ende des Wegs');
    naeher(ende[0], letzteStrecke.ende, fz.t, 'Ende', 'Flugzeugsymbol');
  }

  // Start oben
  const allePunkte = stuecke.flatMap((s) => s.punkte).concat(kaesten.flatMap((k) => k.poly));
  const minY = Math.min(...allePunkte.map((p) => p.y)); const maxY = Math.max(...allePunkte.map((p) => p.y));
  const minX = Math.min(...allePunkte.map((p) => p.x)); const maxX = Math.max(...allePunkte.map((p) => p.x));
  const tintenPunkte = texte.filter((t) => t.klasse !== 'nord').flatMap((t) => t.tinte.flat());
  const minYT = Math.min(minY, ...tintenPunkte.map((p) => p.y)); const maxYT = Math.max(maxY, ...tintenPunkte.map((p) => p.y));
  const startP = erstes.start;
  const anteilWeg = (startP.y - minY) / (maxY - minY);
  const anteilMitText = (startP.y - minYT) / (maxYT - minYT);
  if (anteilWeg > 0.34) befund('Fehler', 'Parcours', 'Start im oberen Drittel', 'Start', `${Math.round(anteilWeg * 100)} % der Weghöhe von oben`, 'höchstens 34 %');
  else if (anteilMitText > 0.34) befund('Hinweis', 'Parcours', 'Start im oberen Drittel (Umriss mit Beschriftungen)', 'Start', `${Math.round(anteilMitText * 100)} %`, 'höchstens 34 %');
  const verhaeltnis = (maxX - minX) / (maxY - minY);

  // ------------------------------------------------ Lesbarkeit
  const hindernisse = [];
  const stueckName = (s, j) => `${s.art === 'strecke' ? 'Strecke' : (istKreisRadius(s.r) ? 'Vollkreis oder Schleife' : (s.r > 20 ? 'Schleife oder Kurve' : 'Eckbogen'))} ${j + 1}`;
  stuecke.forEach((s, j) => hindernisse.push({ name: stueckName(s, j), zug: s.punkte, halb: HALB, stueck: s, j }));
  const markenH = marken.map((mk, j) => ({ name: `Querstrich ${j + 1}`, zug: [mk.a, mk.b], halb: 0.6 }));
  const kastenH = kaesten.map((k, j) => ({ name: `Gate-Kasten ${j + 1}`, zug: [...k.poly, k.poly[0]], halb: 0.75, kasten: k }));
  const pfeilH = [{ name: 'Nordpfeil Schaft', zug: [pEnde, pBasis], halb: 0.75 }, { name: 'Nordpfeil Spitze', zug: [...pfeilPoly, pfeilPoly[0]], halb: 0.75, poly: pfeilPoly }];
  const nordTinte = svg.nord.tinte[0];

  const lesbar = (t, zeilenPolys) => {
    const ergebnisse = [];
    for (const [zi, poly] of zeilenPolys.entries()) {
      // Striche unter einem Gate-Kasten verdeckt der weiße Kasten, für Gate-Texte zählen sie nicht
      for (const h of [...(t.klasse === 'gate' ? [] : hindernisse), ...markenH, ...pfeilH]) {
        const d = h.poly ? polygonPolygon(h.poly, poly) : zugPolygon(h.zug, poly);
        const tief = h.halb - d;
        if (tief > 0) ergebnisse.push({ zeile: zi, mit: h.name, tief, zeileText: t.zeilen[zi] });
      }
      if (t.klasse !== 'gate') {
        for (const h of kastenH) {
          const d = zugPolygon(h.zug, poly);
          const innen = poly.some((p) => imPolygon(p, h.kasten.poly));
          if (d < h.halb || innen) ergebnisse.push({ zeile: zi, mit: h.name, tief: innen ? 99 : h.halb - d, zeileText: t.zeilen[zi], kasten: true });
        }
      }
      const fd = polygonPolygon(fz.poly, poly);
      if (fd < 0.3) ergebnisse.push({ zeile: zi, mit: 'Flugzeugsymbol', tief: 0.3 - fd, zeileText: t.zeilen[zi] });
      const nd = polygonPolygon(nordTinte, poly);
      if (nd < 0.5) ergebnisse.push({ zeile: zi, mit: 'N des Nordpfeils', tief: 0.5 - nd, zeileText: t.zeilen[zi] });
    }
    return ergebnisse;
  };
  const alleTexte = texte.filter((t) => t.klasse !== 'nord');
  const sichtBefunde = [];
  for (const t of alleTexte) {
    const name = t.klasse === 'gate' ? `Gate-Text ${t.zeilen[0]}` : t.zeilen.join(' | ');
    for (const x of lesbar(t, t.tinte)) sichtBefunde.push({ text: name, ...x, t });
    for (const o of alleTexte) {
      if (o === t || alleTexte.indexOf(o) < alleTexte.indexOf(t)) continue;
      for (const a of t.tinte) for (const c of o.tinte) {
        const d = polygonPolygon(a, c);
        if (d < 0.5) sichtBefunde.push({ text: name, mit: `Text ${o.klasse === 'gate' ? `Gate ${o.zeilen[0]}` : o.zeilen.join(' | ')}`, tief: 0.5 - d, zeile: 0, zeileText: '', t });
      }
    }
    // In Vollkreis, Schleife oder Kurve
    if (t.klasse !== 'gate') {
      const m = anwenden(t.t, { x: 0, y: ((t.zeilen.length - 1) * 9) / 2 });
      for (const s of stuecke) {
        if (s.art === 'bogen' && s.r > 20 && dist(m, s.mitte) < s.radius - 2) sichtBefunde.push({ text: name, mit: `Inneres ${istKreisRadius(s.r) ? 'Vollkreis oder Schleife' : 'Kurve oder Schleife'}`, tief: 0, innen: true, zeile: 0, zeileText: '', t });
      }
    }
  }
  for (const h of [...hindernisse, ...kastenH]) {
    const d = zugPolygon(h.zug, nordTinte);
    if (d < h.halb) sichtBefunde.push({ text: 'N des Nordpfeils', mit: h.name, tief: h.halb - d, zeile: 0, zeileText: 'N' });
  }
  for (const h of hindernisse) {
    const d = zugZug(h.zug, [pEnde, pBasis]);
    const d2 = zugPolygon(h.zug, pfeilPoly);
    if (Math.min(d, d2) < h.halb + 0.75) sichtBefunde.push({ text: 'Nordpfeil', mit: h.name, tief: h.halb + 0.75 - Math.min(d, d2), zeile: 0, zeileText: '' });
  }
  for (const h of [...hindernisse, ...kastenH]) {
    if (h.j === 0) continue;
    const d = zugPolygon(h.zug, fz.poly);
    if (d < h.halb) sichtBefunde.push({ text: 'Flugzeugsymbol', mit: h.name, tief: h.halb - d, zeile: 0, zeileText: '' });
  }
  // Gate-Kästen: fremde Stücke dürfen nicht darunter laufen
  const gateElemente = kette.filter((e) => e.art === 'gate');
  for (const g of gateElemente) {
    const k = g.kasten;
    for (const h of hindernisse) {
      const s = h.stueck;
      const istAnkunft = dist(s.ende, g.ankunft) < 0.03 && s.art === 'strecke';
      const istAustritt = dist(s.start, g.austritt) < 0.03 && s.art === 'strecke';
      if (istAnkunft || istAustritt) continue;
      const d = zugPolygon(s.punkte, k.poly);
      if (d < HALB) sichtBefunde.push({ text: `Gate-Kasten bei ${k.x.toFixed(0)},${k.y.toFixed(0)}`, mit: h.name, tief: HALB - d, zeile: 0, zeileText: '', unterKasten: d === 0 });
    }
    for (const [j, mk] of marken.entries()) {
      const tiefe = Math.max(...[mk.a, mk.b].map((p) => Math.min(p.x - k.x, k.x + k.w - p.x, p.y - k.y, k.y + k.h - p.y)));
      if (tiefe > 2.05) sichtBefunde.push({ text: `Gate-Kasten bei ${k.x.toFixed(0)},${k.y.toFixed(0)}`, mit: `Querstrich ${j + 1}`, tief: tiefe, zeile: 0, zeileText: '', querstrich: true });
    }
  }
  // Kreuzungen und Engstellen zwischen Stücken, die nicht zu einer Figur gehören;
  // Ein- und Ausfahrt einer Schleife über 180° (Ecke oder Kurve) dürfen sich
  // kreuzen, aber nur sauber: der Kreuzungspunkt auf beiden mindestens 9 vor dem
  // äußeren Ende (Anfang der Einfahrt, Ende der Ausfahrt). Sonst endet die
  // Ausfahrt im oder dicht am Strich der Einfahrt wie ein T (Stufe 3, Blatt 80).
  for (let a = 0; a < stuecke.length; a++) {
    let getrennt = false;
    for (let c = a + 2; c < stuecke.length; c++) {
      const zwischen = stuecke[c - 1];
      const gateDazwischen = dist(stuecke[c - 1].ende, stuecke[c].start) > 0.03;
      if (zwischen.art === 'strecke' || gateDazwischen) getrennt = true;
      const A = stuecke[a].punkte; const C = stuecke[c].punkte;
      let x = 0;
      for (let m = 0; m + 1 < A.length; m++) for (let q = 0; q + 1 < C.length; q++) if (schneiden(A[m], A[m + 1], C[q], C[q + 1])) x += 1;
      const mitte = stuecke[a + 1];
      const schleife = c === a + 2 && !gateDazwischen && mitte.art === 'bogen' && Math.abs(mitte.dreh) > 180 && stuecke[a].art === 'strecke';
      if (x && !schleife) befund('Fehler', 'Sicht', 'Weg kreuzt sich nicht', `Stück ${a + 1} und ${c + 1}`, `${x} Kreuzung(en)`, 'keine');
      if (schleife) {
        const lage = schleifenLage(stuecke[a], stuecke[c]);
        if (lage) befund('Unschärfe', 'Sicht', 'Schleife: Ein- und Ausfahrt kreuzen sich sauber', `Stück ${a + 1} und ${c + 1}`, lage, 'Kreuzung mindestens 9 vor beiden äußeren Enden, sonst Mittellinien mindestens 9');
      }
      if (getrennt) {
        const d = zugZug(A, C);
        if (d < 9 && !x) befund(d < 6 ? 'Unschärfe' : 'Hinweis', 'Sicht', 'Striche liegen nicht übereinander (Mittellinien mindestens 9)', `Stück ${a + 1} und ${c + 1}`, `Abstand ${d.toFixed(1)}`, 'mindestens 9');
      }
    }
  }
  const ueber = stuecke.slice(1).some((st) => st.punkte.some((p) => p.y < fz.t.y - 20 && Math.abs(p.x - fz.t.x) < 40));
  if (ueber) befund('Hinweis', 'Parcours', 'Start am oberen Rand der Figur', 'Start', `Weg verläuft über dem Flugzeugsymbol, Start bei ${Math.round(anteilWeg * 100)} % der Höhe`, 'nichts über dem Start');
  const mitText = verhaeltnisBerechnen(stuecke, kaesten, texte);
  if (mitText < 0.7 || mitText > 1.25) befund('Hinweis', 'Sicht', 'Seitenverhältnis 0,7 bis 1,25 (mit Beschriftungen)', 'Umriss', mitText.toFixed(2), '0,7 bis 1,25');

  // viewBox umschließt alles
  const [vx, vy, vw, vh] = svg.vb;
  const ausserhalb = [...allePunkte, ...tintenPunkte, ...nordTinte, ...fz.poly, pKopf, pEnde, pLinks, pRechts].filter((p) => p.x < vx || p.y < vy || p.x > vx + vw || p.y > vy + vh);
  if (ausserhalb.length) befund('Fehler', 'Sicht', 'viewBox umschließt die Zeichnung', 'viewBox', `${ausserhalb.length} Punkte außerhalb`, 'alle innen');

  // Segmentbeschriftung näher an fremdem Strich als am eigenen?
  for (const t of segTexte) {
    if (!t.segment) continue;
    const eigen = t.segment.stueck;
    const eigenD = Math.min(...t.tinte.map((poly) => zugPolygon(eigen.punkte, poly)));
    const iE = stuecke.indexOf(eigen);
    let fremdD = Infinity; let fremdName = ''; let fremdWinkel = 90;
    const wT = (t.t.w * Math.PI) / 180; const uT = { x: Math.cos(wT), y: Math.sin(wT) };
    stuecke.forEach((st, j) => {
      if (j === iE) return;
      if ((j === iE - 1 || j === iE + 1) && st.art === 'bogen' && st.r < 20) return;
      const d = Math.min(...t.tinte.map((poly) => zugPolygon(st.punkte, poly)));
      if (d < fremdD) {
        fremdD = d; fremdName = stueckName(st, j);
        let best = Infinity; let dir = null;
        for (let q = 0; q + 1 < st.punkte.length; q++) {
          const dd = Math.min(...t.tinte.map((poly) => zugPolygon([st.punkte[q], st.punkte[q + 1]], poly)));
          if (dd < best) { best = dd; dir = sub(st.punkte[q + 1], st.punkte[q]); }
        }
        const cosw = Math.abs(uT.x * dir.x + uT.y * dir.y) / len(dir);
        fremdWinkel = (Math.acos(Math.min(1, cosw)) * 180) / Math.PI;
      }
    });
    if (fremdD < eigenD) befund('Hinweis', 'Parcours', 'Beschriftung näher am eigenen Strich als an fremden', t.lesung.roh, `eigener Strich ${eigenD.toFixed(1)}, ${fremdName} ${fremdD.toFixed(1)} (Mittellinie zu Tinte), fremder Strich ${fremdWinkel.toFixed(0)}° zur Schrift`, 'eigener Strich am nächsten', { x: t.t.x, y: t.t.y });
  }
  return { flugKurse, drehung, zahl, profile, anteilWeg, anteilMitText, verhaeltnis, sichtBefunde, hoeheEnde: hoehe };
}

// Lage von Einfahrt "ein" und Ausfahrt "aus" einer Schleife: null bei einer
// sauberen Kreuzung (mindestens 9 vor beiden äußeren Enden) oder mindestens 9
// Abstand ohne Kreuzung, sonst die Beschreibung des Befunds
function schleifenLage(ein, aus) {
  if (aus.art !== 'strecke') return null;
  const [p, q] = ein.punkte; const [r, s] = aus.punkte;
  const d1 = sub(q, p); const d2 = sub(s, r); const w = sub(r, p);
  const nenner = kreuz(d1, d2);
  if (nenner !== 0 && schneiden(p, q, r, s)) {
    const vorEin = (kreuz(w, d2) / nenner) * len(d1);
    const vorAus = (1 - kreuz(w, d1) / nenner) * len(d2);
    return Math.min(vorEin, vorAus) >= 9 ? null : `Kreuzung ${Math.min(vorEin, vorAus).toFixed(1)} vor dem ${vorEin < vorAus ? 'Anfang der Einfahrt' : 'Ende der Ausfahrt'}`;
  }
  const d = zugZug(ein.punkte, aus.punkte);
  return d >= 9 ? null : `ohne Kreuzung, Mittellinien ${d.toFixed(1)} auseinander (Ende im Strich)`;
}

function verhaeltnisBerechnen(stuecke, kaesten, texte) {
  const pkt = stuecke.flatMap((s) => s.punkte).concat(kaesten.flatMap((k) => k.poly)).concat(texte.filter((t) => t.klasse !== 'nord').flatMap((t) => t.tinte.flat()));
  const xs = pkt.map((p) => p.x); const ys = pkt.map((p) => p.y);
  return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
}
