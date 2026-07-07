// Aditya Guruji — INTERPRETIVE analysis engine.
// Implements his framework: Subathuvam (beneficence), Papathuvam (maleficence)
// and the net Sootchuma Valu (subtle strength) for every planet, then applies:
//   - Astamana (combustion, degree-graded: 9° / 2° / 0°)
//   - Bhadhakadhipathi (the "destroyer" lord by ascendant type)
//   - 6-8-12 (dusthana) affliction
//   - Adhi Yoga (benefics in 6/7/8 from the Moon)
//   - a per-planet Subathuvam scoreboard so the user sees "what's going on".
//
// Note (per the user's own teaching): Neechabanga / Parivartana can lift a
// debilitated planet but are NOT an antidote to Astamana — a combust planet
// stays weakened even with neechabanga. We honour that here.
//
// Planet indices: 0=Sun 1=Moon 2=Mars 3=Mercury 4=Jupiter 5=Venus 6=Saturn 7=Rahu 8=Ketu
// Sign indices:   0=Aries .. 11=Pisces

import type { Bilingual } from "./constants";
import { GRAHAS, RASIS, RASI_LORDS, aspectFromTo } from "./constants";
import type { PlanetPosition } from "./engine";

export type Tone = "good" | "mixed" | "caution" | "info";

// Net beneficence band for a planet.
export type ValuBand = "high" | "medium" | "low" | "afflicted";

export interface PlanetValu {
  index: number;
  name: Bilingual;
  subathuvam: number;   // 0..100 beneficence score
  papathuvam: number;   // 0..100 maleficence pressure
  net: number;          // sootchuma valu = subathuvam - papathuvam (can be negative)
  band: ValuBand;
  notes: Bilingual[];   // what raised/lowered it
}

export interface GurujiFinding {
  title: Bilingual;
  verdict: Bilingual;
  tone: Tone;
  reasons: Bilingual[];
}

export interface GurujiAnalysis {
  headline: Bilingual;
  planets: PlanetValu[];       // the Subathuvam / Papathuvam scoreboard
  findings: GurujiFinding[];   // Astamana, Bhadhaka, 6-8-12, Adhi Yoga
}

// ---- helpers ---------------------------------------------------------------

const DUSTHANA = new Set([6, 8, 12]);
const NATURAL_BENEFIC = new Set([4, 5]); // Jupiter, Venus
const NATURAL_MALEFIC = new Set([0, 2, 6, 7, 8]); // Sun, Mars, Saturn, Rahu, Ketu

function houseOf(sign: number, lagna: number): number {
  return ((sign - lagna + 12) % 12) + 1;
}
function signAtHouse(house: number, lagna: number): number {
  return (lagna + (house - 1)) % 12;
}
function planet(planets: PlanetPosition[], idx: number): PlanetPosition {
  return planets.find((p) => p.index === idx)!;
}
// English ordinal (1 → 1st, 2 → 2nd, 3 → 3rd, else Nth).
function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function nm(idx: number): Bilingual {
  return GRAHAS[idx];
}

// Combustion (astamana) orb per planet — classical degrees from the Sun.
const ASTAMANA_ORB: Record<number, number> = {
  1: 12, // Moon
  2: 17, // Mars
  3: 14, // Mercury
  4: 11, // Jupiter
  5: 10, // Venus
  6: 15, // Saturn
};

// Shortest angular gap (0..180) between two longitudes.
function gap(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// Is a planet functioning as a benefic (for aspect/conjunction purposes)?
// Jupiter & Venus always; waxing/strong Moon; unafflicted Mercury.
function isBeneficNature(p: PlanetPosition, moonWaxing: boolean): boolean {
  if (p.index === 4 || p.index === 5) return true;                 // Jupiter, Venus
  if (p.index === 1) return moonWaxing || (p.dignity?.points ?? 20) >= 40; // Moon
  if (p.index === 3) return (p.dignity?.points ?? 20) >= 20;      // Mercury (unafflicted)
  return false;                                                    // Sun, Mars, Saturn, Rahu, Ketu
}

// Planets conjunct a graha (same rasi, excluding itself).
function conjunctWith(planets: PlanetPosition[], p: PlanetPosition): PlanetPosition[] {
  return planets.filter((q) => q.index !== p.index && q.rasiIndex === p.rasiIndex);
}

// Planets casting graha-drishti onto a graha's sign (whole-sign, excludes conjunction).
function aspectorsOf(planets: PlanetPosition[], p: PlanetPosition): PlanetPosition[] {
  return planets.filter(
    (q) => q.index !== p.index && q.rasiIndex !== p.rasiIndex && aspectFromTo(q.index, q.rasiIndex, p.rasiIndex) > 0,
  );
}

// Dikbala (directional strength) — each planet is strongest in a specific
// KENDRA (angle). For Mars (Chevvai) that is the 10th house; full strength when
// the planet is exactly in its dik-bala house, tapering to zero at the opposite.
//   Jupiter & Mercury → 1st (Lagna); Moon & Venus → 4th; Saturn → 7th;
//   Sun & Mars → 10th. (Rahu/Ketu are not assigned dikbala.)
const DIKBALA_HOUSE: Record<number, number> = {
  0: 10, 2: 10,   // Sun, Mars — south (10th)
  4: 1, 3: 1,     // Jupiter, Mercury — east (1st)
  1: 4, 5: 4,     // Moon, Venus — north (4th)
  6: 7,           // Saturn — west (7th)
};

// ---- main ------------------------------------------------------------------

export function analyzeGuruji(
  planets: PlanetPosition[],
  lagnaSign: number,
  moonSign: number,
): GurujiAnalysis {
  const sun = planet(planets, 0);
  const moon = planet(planets, 1);
  // Moon is waxing (sukla paksha) when it is 0..180° ahead of the Sun.
  const moonWaxing = ((moon.siderealLon - sun.siderealLon + 360) % 360) <= 180;

  // ---- Amavasya Yoga detection (Guruji's rule) ---------------------------
  // When Sun and Moon sit in the SAME box (new-moon / Amavasya birth), the
  // Moon is normally "dead" (fully combust). But per Aditya Guruji: to get the
  // GOOD benefit of Amavasya Yoga, EITHER the Sun OR the Moon must be in a
  // powerful position (exalted / moolatrikona / own = dignity points >= 60).
  // When that holds, the powerful luminary keeps its strength "to a certain
  // limit", and the yoga turns auspicious. The TRUE antidote to the burning is
  // Guru's aspect on the combust luminary — if a benefic (esp. Jupiter) sees
  // it, the combustion dosha is substantially rectified. We honour both.
  const sunMoonSameBox = sun.rasiIndex === moon.rasiIndex;
  const sunMoonGap = gap(sun.siderealLon, moon.siderealLon);
  const isAmavasya = sunMoonSameBox && sunMoonGap <= 12; // new-moon conjunction
  const sunPts = sun.dignity?.points ?? 20;
  const moonPts = moon.dignity?.points ?? 20;
  const luminaryPowerful = sunPts >= 60 || moonPts >= 60; // ucham/moolatrikona/own
  // Which luminary is the strong one (drives the redemption)?
  const strongLuminaryIdx = moonPts >= sunPts ? 1 : 0;
  // Does Guru (Jupiter) aspect or conjoin the Moon? Guru must itself have some
  // strength for a meaningful blessing (a debilitated/deeply afflicted Guru
  // gives only partial redemption).
  const guru = planet(planets, 4);
  const guruSeesMoon =
    guru.rasiIndex === moon.rasiIndex ||
    aspectFromTo(guru.index, guru.rasiIndex, moon.rasiIndex) > 0;
  const guruStrong = (guru.dignity?.points ?? 20) >= 40; // friend or better
  // Amavasya Yoga counts as "redeemed" (auspicious) only when a luminary is
  // powerful AND Guru sees the Moon. If Guru is weak, redemption is partial.
  const amavasyaRedeemed = isAmavasya && luminaryPowerful && guruSeesMoon;

  // Shared helper: apply Subathuvam/Papathuvam from CONJUNCTIONS and ASPECTS
  // (other planets "seeing" this graha). Benefic contact raises subathuvam;
  // malefic contact raises papathuvam. Returns the deltas and appends notes.
  // This is the core of Guruji's rule: beneficence/maleficence is not read from
  // dignity alone, but from who joins and who aspects the planet.
  function applyContacts(
    p: PlanetPosition,
    notes: Bilingual[],
  ): { dSub: number; dPapa: number } {
    let dSub = 0;
    let dPapa = 0;
    const conj = conjunctWith(planets, p);
    const asp = aspectorsOf(planets, p);

    const benConj: PlanetPosition[] = [];
    const malConj: PlanetPosition[] = [];
    for (const q of conj) {
      if (isBeneficNature(q, moonWaxing)) { benConj.push(q); dSub += 10; dPapa -= 4; }
      else { malConj.push(q); dPapa += 10; dSub -= 4; }
    }
    // Aspect (drishti) contributions are DEGREE-WEIGHTED: an aspecting planet
    // affects the aspected planet more strongly the closer their degrees are
    // within their signs. 0° apart = full strength (×1.0); 15° apart = half;
    // 30° apart = weakest (×0.1). This shows how CLOSELY each planet acts.
    const benAsp: Bilingual[] = [];
    const malAsp: Bilingual[] = [];
    for (const q of asp) {
      const degGap = Math.abs(p.degInRasi - q.degInRasi); // 0..30
      const closeness = Math.max(0.1, 1 - degGap / 30);   // 1.0 (exact) .. 0.1 (far)
      const pct = Math.round(closeness * 100);
      const strong = closeness >= 0.8;
      const g = nm(q.index);
      const tag: Bilingual = {
        en: `${g.en} (${degGap.toFixed(1)}° ${strong ? "close/tight" : pct >= 40 ? "moderate" : "wide"}, ${pct}%)`,
        ta: `${g.ta} (${degGap.toFixed(1)}° ${strong ? "நெருக்கம்" : pct >= 40 ? "நடுத்தரம்" : "தொலைவு"}, ${pct}%)`,
      };
      if (isBeneficNature(q, moonWaxing)) {
        dSub += Math.round(7 * closeness); dPapa -= Math.round(3 * closeness);
        benAsp.push(tag);
      } else {
        dPapa += Math.round(7 * closeness); dSub -= Math.round(3 * closeness);
        malAsp.push(tag);
      }
    }

    if (benConj.length)
      notes.push({
        ta: `${benConj.map((q) => nm(q.index).ta).join(", ")} உடன் சேர்க்கை (சுப) → சுபத்துவம் உயர்வு.`,
        en: `Conjunct benefic ${benConj.map((q) => nm(q.index).en).join(", ")} → subathuvam raised.`,
      });
    if (malConj.length)
      notes.push({
        ta: `${malConj.map((q) => nm(q.index).ta).join(", ")} உடன் சேர்க்கை (பாப) → பாபத்துவம் உயர்வு.`,
        en: `Conjunct malefic ${malConj.map((q) => nm(q.index).en).join(", ")} → papathuvam raised.`,
      });
    if (benAsp.length)
      notes.push({
        ta: `${benAsp.map((s) => s.ta).join(", ")} பார்வை (சுப) → சுபத்துவம் உயர்வு (பட்ட நெருக்கத்தின்படி).`,
        en: `Aspected by benefic ${benAsp.map((s) => s.en).join(", ")} → subathuvam raised (by degree closeness).`,
      });
    if (malAsp.length)
      notes.push({
        ta: `${malAsp.map((s) => s.ta).join(", ")} பார்வை (பாப) → பாபத்துவம் உயர்வு (பட்ட நெருக்கத்தின்படி).`,
        en: `Aspected by malefic ${malAsp.map((s) => s.en).join(", ")} → papathuvam raised (by degree closeness).`,
      });

    return { dSub, dPapa };
  }

  // ---- 1. Per-planet Subathuvam / Papathuvam / Sootchuma Valu -------------
  const scoreboard: PlanetValu[] = [];
  for (const p of planets) {
    if (p.index === 7 || p.index === 8) {
      // Rahu/Ketu: shadowy — high papathuvam base, no dignity.
      const house = houseOf(p.rasiIndex, lagnaSign);
      let papa = 55;
      let sub = Math.max(0, 40 - (papa - 50)); // base subathuvam before contacts
      const notes: Bilingual[] = [{ ta: "சாயா கிரகம் — இயற்கையாகவே பாபத்துவம் அதிகம்.", en: "Shadow planet — naturally higher papathuvam." }];
      if (DUSTHANA.has(house)) { papa += 10; notes.push({ ta: `${house}-ஆம் (துஸ்தான) பாவத்தில்.`, en: `In the ${house}th (dusthana) house.` }); }
      // Conjunction + aspect contributions (Guruji's core rule) — applies to
      // Rahu/Ketu too, so a benefic seeing Rahu genuinely lifts its subathuvam.
      const rc = applyContacts(p, notes);
      sub += rc.dSub; papa += rc.dPapa;
      sub = Math.max(0, Math.min(100, sub));
      papa = Math.max(0, Math.min(100, papa));
      scoreboard.push({ index: p.index, name: nm(p.index), subathuvam: sub, papathuvam: papa, net: sub - papa, band: bandOf(sub - papa), notes });
      continue;
    }

    // Base beneficence from dignity points (0..100).
    let sub = p.dignity?.points ?? 20;
    let papa = 100 - sub; // inverse baseline
    const notes: Bilingual[] = [
      { ta: `${nm(p.index).ta} ${p.dignity?.label.ta} → அடிப்படை சுபத்துவம் ${sub}.`, en: `${nm(p.index).en} in ${p.dignity?.label.en} → base subathuvam ${sub}.` },
    ];

    // Natural benefic/malefic tilt.
    if (NATURAL_BENEFIC.has(p.index)) { sub += 8; papa -= 8; }
    if (p.index === 0 || p.index === 2 || p.index === 6) { papa += 8; sub -= 4; } // Sun/Mars/Saturn cruel

    // House placement: dusthana lowers subathuvam.
    const house = houseOf(p.rasiIndex, lagnaSign);
    if (DUSTHANA.has(house)) {
      sub -= 12; papa += 12;
      notes.push({ ta: `${house}-ஆம் (துஸ்தான) பாவம் → பாபத்துவம் உயர்வு.`, en: `${house}th (dusthana) house → papathuvam raised.` });
    } else if ([1, 4, 5, 7, 9, 10].includes(house)) {
      sub += 6;
      notes.push({ ta: `${house}-ஆம் (சுப) பாவம் → சுபத்துவம் உயர்வு.`, en: `${house}th (auspicious) house → subathuvam raised.` });
    }

    // Astamana (combustion): degree-graded loss. NOT cancelled by neechabanga.
    if (p.index !== 0) {
      const g = gap(p.siderealLon, sun.siderealLon);
      const orb = ASTAMANA_ORB[p.index] ?? 8;
      if (g <= orb) {
        // Grade: within 2° = near-total; near 0° = dead; up to orb = graded.
        let loss: number;
        let grade: Bilingual;
        if (g <= 2) { loss = 40; grade = { ta: "கிட்டத்தட்ட முழு அஸ்தமனம்", en: "near-total combustion" }; }
        else { loss = Math.round(40 * (1 - (g - 2) / (orb - 2))); grade = { ta: "பகுதி அஸ்தமனம்", en: "partial combustion" }; }
        // Amavasya-Yoga redemption for the Moon: per Guruji, a combust luminary
        // that is itself powerful still delivers "to a certain limit", and
        // Guru's aspect is the real antidote to the burning. When the Amavasya
        // is redeemed (a luminary powerful + Guru sees the Moon), we soften the
        // Moon's combustion loss instead of killing it outright.
        if (p.index === 1 && isAmavasya && (luminaryPowerful || guruSeesMoon)) {
          let relief = 0;
          const reliefNotes: string[] = [];
          const reliefNotesTa: string[] = [];
          // A powerful Moon keeps ~40% of what it would lose.
          if (moonPts >= 60) { relief += Math.round(loss * 0.4); reliefNotes.push("powerful Moon retains strength"); reliefNotesTa.push("வலிமையான சந்திரன் பலத்தை தக்கவைக்கிறது"); }
          // A powerful Sun lends the pair strength (Amavasya-Yoga condition met).
          else if (sunPts >= 60) { relief += Math.round(loss * 0.25); reliefNotes.push("powerful Sun lifts the pair"); reliefNotesTa.push("வலிமையான சூரியன் இணையை உயர்த்துகிறது"); }
          // Guru's aspect is the true antidote — strong Guru rectifies most of it.
          if (guruSeesMoon) {
            const guruRelief = Math.round(loss * (guruStrong ? 0.45 : 0.2));
            relief += guruRelief;
            reliefNotes.push(guruStrong ? "strong Guru's aspect rectifies combustion" : "Guru's aspect partly rectifies combustion");
            reliefNotesTa.push(guruStrong ? "வலிமையான குருவின் பார்வை அஸ்தமனத்தை நிவர்த்திக்கிறது" : "குருவின் பார்வை ஓரளவு நிவர்த்திக்கிறது");
          }
          relief = Math.min(relief, Math.round(loss * 0.85)); // never a full cure
          loss = Math.max(0, loss - relief);
          notes.push({
            ta: `அமாவாசை யோகம் — ${reliefNotesTa.join(", ")}; அஸ்தமன இழப்பு −${relief} குறைக்கப்பட்டது.`,
            en: `Amavasya Yoga — ${reliefNotes.join(", ")}; combustion loss reduced by −${relief}.`,
          });
        }
        sub -= loss; papa += loss;
        notes.push({ ta: `அஸ்தமனம் (சூரியனிடமிருந்து ${g.toFixed(1)}°) — ${grade.ta}, சுபத்துவம் −${loss}. (நீசபங்கம்/பரிவர்த்தனை இதற்கு மாற்று அல்ல.)`, en: `Astamana (${g.toFixed(1)}° from Sun) — ${grade.en}, subathuvam −${loss}. (Neechabanga/parivartana is NOT an antidote.)` });
      }
    }

    // Conjunction + aspect contributions (Guruji's core rule).
    const cc = applyContacts(p, notes);
    sub += cc.dSub; papa += cc.dPapa;

    // Dikbala (directional strength): a planet in its dik-bala house is at full
    // directional power; strength tapers to zero at the opposite house.
    const dikHouse = DIKBALA_HOUSE[p.index];
    if (dikHouse !== undefined) {
      const dist = Math.abs(((house - dikHouse + 12) % 12));
      const away = Math.min(dist, 12 - dist); // 0 (at dik house) .. 6 (opposite)
      const dik = Math.round(12 * (1 - away / 6)); // +12 at full dikbala .. 0 opposite
      if (dik > 0) {
        sub += Math.round(dik / 2);
        const strong = away <= 1;
        notes.push({
          ta: `திக்பலம் (${dikHouse}-ஆம் பாவம்) → ${strong ? "முழு" : "பகுதி"} திசை பலம் (+${Math.round(dik / 2)}).`,
          en: `Dikbala (strongest in ${ord(dikHouse)}) → ${strong ? "full" : "partial"} directional strength (+${Math.round(dik / 2)}).`,
        });
      }
    }

    sub = Math.max(0, Math.min(100, sub));
    papa = Math.max(0, Math.min(100, papa));
    scoreboard.push({ index: p.index, name: nm(p.index), subathuvam: sub, papathuvam: papa, net: sub - papa, band: bandOf(sub - papa), notes });
  }

  const findings: GurujiFinding[] = [];

  // ---- 2. Astamana summary finding ---------------------------------------
  const combust = scoreboard.filter((s) => s.notes.some((n) => n.en.includes("Astamana")));
  if (combust.length) {
    findings.push({
      title: { ta: "அஸ்தமனம் (எரிப்பு)", en: "Astamana (Combustion)" },
      verdict: {
        ta: `${combust.map((c) => c.name.ta).join(", ")} சூரியனால் எரிக்கப்பட்டு பலம் இழக்கிறது.`,
        en: `${combust.map((c) => c.name.en).join(", ")} lose power by combustion under the Sun.`,
      },
      tone: "caution",
      reasons: [{ ta: "பட்டம் அடிப்படையில் (9°/2°/0°) சுபத்துவம் குறைகிறது; நீசபங்கம் இதற்கு மாற்று அல்ல.", en: "Loss is degree-graded (9°/2°/0°); neechabanga does not cancel it." }],
    });
  }

  // ---- 3. Bhadhakadhipathi (the destroyer) --------------------------------
  // Movable (0,3,6,9) → 11th lord; Fixed (1,4,7,10) → 9th lord; Dual (2,5,8,11) → 7th lord.
  const element = lagnaSign % 3; // 0 movable, 1 fixed, 2 dual
  const bhadhakaHouse = element === 0 ? 11 : element === 1 ? 9 : 7;
  const bhadhakaSign = signAtHouse(bhadhakaHouse, lagnaSign);
  const bhadhakaLordIdx = RASI_LORDS[bhadhakaSign];
  const bhadhakaLord = planet(planets, bhadhakaLordIdx);
  const bhadhakaScore = scoreboard.find((s) => s.index === bhadhakaLordIdx)!;
  findings.push({
    title: { ta: "பாதகாதிபதி (அழிப்பவர்)", en: "Bhadhakadhipathi (Destroyer)" },
    verdict: {
      ta: `${element === 0 ? "சர" : element === 1 ? "ஸ்திர" : "உபய"} லக்னம் → ${bhadhakaHouse}-ஆம் அதிபதி ${nm(bhadhakaLordIdx).ta} பாதகன். இதன் தசை/கோச்சாரத்தில் திடீர் தடைகள்.`,
      en: `${element === 0 ? "Movable" : element === 1 ? "Fixed" : "Dual"} lagna → the ${bhadhakaHouse}th lord ${nm(bhadhakaLordIdx).en} is the destroyer. Watch for sudden obstruction in its dasha/transit.`,
    },
    tone: bhadhakaScore.net < 0 ? "caution" : "mixed",
    reasons: [
      { ta: `பாதக அதிபதி ${nm(bhadhakaLordIdx).ta} ${houseOf(bhadhakaLord.rasiIndex, lagnaSign)}-ஆம் பாவத்தில், ${bhadhakaLord.dignity?.label.ta ?? "—"}.`, en: `The destroyer ${nm(bhadhakaLordIdx).en} sits in the ${houseOf(bhadhakaLord.rasiIndex, lagnaSign)}th house, ${bhadhakaLord.dignity?.label.en ?? "—"}.` },
    ],
  });

  // ---- 4. 6-8-12 (dusthana) load -----------------------------------------
  const dusthanaPlanets = planets.filter((p) => DUSTHANA.has(houseOf(p.rasiIndex, lagnaSign)));
  if (dusthanaPlanets.length) {
    findings.push({
      title: { ta: "6-8-12 (துஸ்தான) சுமை", en: "6-8-12 (Dusthana) load" },
      verdict: {
        ta: `${dusthanaPlanets.map((p) => nm(p.index).ta).join(", ")} துஸ்தானத்தில் — போராட்டம் / தடை பகுதிகளை சுட்டுகிறது.`,
        en: `${dusthanaPlanets.map((p) => nm(p.index).en).join(", ")} in dusthanas — pointing to areas of struggle or obstruction.`,
      },
      tone: dusthanaPlanets.length >= 3 ? "caution" : "mixed",
      reasons: [{ ta: "6, 8, 12 பாவங்கள் பாபத்துவம் சுமக்கின்றன.", en: "The 6th, 8th and 12th houses carry papathuvam." }],
    });
  }

  // ---- 5. Adhi Yoga (benefics in 6/7/8 from the Moon) --------------------
  const adhiSigns = [6, 7, 8].map((h) => (moonSign + (h - 1)) % 12);
  const adhiBenefics = planets.filter((p) => NATURAL_BENEFIC.has(p.index) && adhiSigns.includes(p.rasiIndex));
  if (adhiBenefics.length >= 1) {
    findings.push({
      title: { ta: "அதி யோகம்", en: "Adhi Yoga" },
      verdict: {
        ta: `சந்திரனிலிருந்து 6/7/8-இல் நன்மைகள் (${adhiBenefics.map((p) => nm(p.index).ta).join(", ")}) — தலைமை / செழிப்பு யோகம்.`,
        en: `Benefics in the 6th/7th/8th from the Moon (${adhiBenefics.map((p) => nm(p.index).en).join(", ")}) — a leadership/prosperity yoga.`,
      },
      tone: adhiBenefics.length >= 2 ? "good" : "mixed",
      reasons: [{ ta: "அதி யோகம் ராஜயோகம் போன்ற பலம் தரும்.", en: "Adhi Yoga confers raja-yoga-like strength." }],
    });
  }

  // ---- 6. Chevvai (Mars) Dikbalam ----------------------------------------
  // Mars is strongest in the 10th house (south). Full dikbala in the 10th,
  // tapering to zero in the 4th (opposite).
  const mars = planet(planets, 2);
  const marsHouse = houseOf(mars.rasiIndex, lagnaSign);
  const marsAway = Math.min(Math.abs((marsHouse - 10 + 12) % 12), 12 - Math.abs((marsHouse - 10 + 12) % 12));
  const marsDik = Math.round(100 * (1 - marsAway / 6)); // 0..100%
  const marsBand: Bilingual =
    marsAway <= 1
      ? { ta: "முழு திக்பலம் (மிக வலிமை)", en: "full dikbala (very strong)" }
      : marsAway <= 3
      ? { ta: "நடுத்தர திக்பலம்", en: "moderate dikbala" }
      : { ta: "திக்பலம் குறைவு", en: "weak in direction" };
  findings.push({
    title: { ta: "செவ்வாய் திக்பலம்", en: "Chevvai (Mars) Dikbalam" },
    verdict: {
      ta: `செவ்வாய் ${marsHouse}-ஆம் பாவத்தில் — திக்பலம் ${marsDik}% (${marsBand.ta}). செவ்வாய் 10-ஆம் பாவத்தில் முழு திசைப் பலம் பெறும்.`,
      en: `Mars is in the ${marsHouse}th house — dikbala ${marsDik}% (${marsBand.en}). Mars gains full directional strength in the 10th house.`,
    },
    tone: marsAway <= 1 ? "good" : marsAway <= 3 ? "mixed" : "caution",
    reasons: [
      { ta: "திக்பலம் = திசை சார்ந்த பலம். செவ்வாய்க்கு தெற்கு (10-ஆம் பாவம்) முழு பலம்; 4-ஆம் பாவத்தில் பூஜ்ஜியம்.", en: "Dikbala = directional strength. Mars is fullest in the south (10th house) and nil in the 4th." },
    ],
  });

  // ---- 7. Amavasya Yoga (Sun + Moon in the same box) ---------------------
  // Guruji's rule: a new-moon birth is normally an afflicted (dead-Moon) chart,
  // BUT if EITHER luminary is powerful (ucham/moolatrikona/own) it becomes an
  // auspicious yoga that can bring great success — especially when Guru aspects
  // the Moon, which is the true antidote to the burning.
  if (isAmavasya) {
    const strongName = strongLuminaryIdx === 1 ? nm(1) : nm(0);
    const strongPts = strongLuminaryIdx === 1 ? moonPts : sunPts;
    let tone: Tone;
    let verdict: Bilingual;
    const reasons: Bilingual[] = [
      {
        ta: `சூரியனும் சந்திரனும் ${RASIS[sun.rasiIndex].ta} ஒரே பெட்டியில் (${sunMoonGap.toFixed(1)}° இடைவெளி) — அமாவாசை சேர்க்கை.`,
        en: `Sun and Moon share ${RASIS[sun.rasiIndex].en} (${sunMoonGap.toFixed(1)}° apart) — an Amavasya (new-moon) conjunction.`,
      },
    ];
    if (amavasyaRedeemed) {
      tone = guruStrong ? "good" : "mixed";
      verdict = {
        ta: `அமாவாசை யோகம் — ${strongName.ta} வலிமையான நிலையில் (${strongPts}) இருப்பதாலும், குரு சந்திரனை பார்ப்பதாலும் — இது மிகப்பெரிய வெற்றி தரக்கூடிய அதிர்ஷ்ட யோகம்.`,
        en: `Amavasya Yoga is REDEEMED — ${strongName.en} is powerful (${strongPts}) and Guru aspects the Moon. This is a lucky yoga that can bring great success.`,
      };
    } else if (luminaryPowerful) {
      tone = "mixed";
      verdict = {
        ta: `அமாவாசை யோகம் — ${strongName.ta} வலிமையாக உள்ளதால் ஓரளவு காப்பு; ஆனால் குருவின் பார்வை இல்லாமல் முழு நிவர்த்தி இல்லை.`,
        en: `Amavasya Yoga — ${strongName.en} is powerful, giving partial protection; but without Guru's aspect on the Moon the burning is not fully rectified.`,
      };
      reasons.push({ ta: "அமாவாசை யோகத்தின் நல்ல பலனுக்கு சூரியன் அல்லது சந்திரன் வலிமையாக இருக்க வேண்டும்.", en: "For Amavasya Yoga's good result, either the Sun or the Moon must be in a powerful position." });
    } else {
      tone = "caution";
      verdict = {
        ta: "அமாவாசை சேர்க்கை — எந்த ஒளியும் வலிமையாக இல்லாததால் சந்திரன் பலம் இழக்கிறது.",
        en: "Amavasya conjunction — with neither luminary powerful, the Moon loses strength; the yoga does not turn auspicious.",
      };
      reasons.push({ ta: "அமாவாசை யோகத்தின் நல்ல பலனுக்கு சூரியன் அல்லது சந்திரன் வலிமையாக இருக்க வேண்டும்.", en: "For Amavasya Yoga's good result, either the Sun or the Moon must be in a powerful position." });
    }
    if (guruSeesMoon) reasons.push({ ta: `குரு சந்திரனை பார்க்கிறார் — அஸ்தமனத்திற்கு உண்மையான மாற்று${guruStrong ? "" : " (ஆனால் குரு பலவீனமாக உள்ளதால் ஓரளவு மட்டும்)"}.`, en: `Guru aspects the Moon — the real antidote to combustion${guruStrong ? "" : " (though a weak Guru rectifies only partly)"}.` });
    else reasons.push({ ta: "குரு சந்திரனை பார்க்கவில்லை — எரிப்புக்கு முழு மாற்று இல்லை.", en: "Guru does not aspect the Moon — no full antidote to the burning." });
    findings.push({
      title: { ta: "அமாவாசை யோகம்", en: "Amavasya Yoga" },
      verdict,
      tone,
      reasons,
    });
  }

  // ---- headline -----------------------------------------------------------
  const avgNet = Math.round(scoreboard.reduce((s, x) => s + x.net, 0) / scoreboard.length);
  const highCount = scoreboard.filter((s) => s.band === "high").length;
  const afflicted = scoreboard.filter((s) => s.band === "afflicted").length;
  const headline: Bilingual =
    avgNet > 15
      ? { ta: `ஒட்டுமொத்த சூட்சும வலு நேர்மறை (சராசரி +${avgNet}) — சுபத்துவம் மேலோங்குகிறது.`, en: `Overall Sootchuma Valu is positive (avg +${avgNet}) — subathuvam dominates.` }
      : avgNet < -10
      ? { ta: `ஒட்டுமொத்த சூட்சும வலு எதிர்மறை (சராசரி ${avgNet}) — பாபத்துவம் அதிகம், கவனம் தேவை.`, en: `Overall Sootchuma Valu is negative (avg ${avgNet}) — papathuvam is heavy; care is needed.` }
      : { ta: `கலவையான சூட்சும வலு (சராசரி ${avgNet}) — ${highCount} வலுவான, ${afflicted} பாதிக்கப்பட்ட கிரகங்கள்.`, en: `Mixed Sootchuma Valu (avg ${avgNet}) — ${highCount} strong, ${afflicted} afflicted planets.` };

  // Sort scoreboard by net descending so strongest planets show first.
  scoreboard.sort((a, b) => b.net - a.net);

  return { headline, planets: scoreboard, findings };
}

function bandOf(net: number): ValuBand {
  if (net >= 40) return "high";
  if (net >= 10) return "medium";
  if (net >= -20) return "low";
  return "afflicted";
}
