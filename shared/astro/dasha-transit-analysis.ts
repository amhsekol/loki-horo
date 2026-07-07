// ============================================================================
// DASHA × GOCHARA — current & timeline prediction engine
// ============================================================================
// This module answers the user's request in classical terms:
//
//   For the running Maha / Bhukti / Antara dasha, it identifies the three
//   ruling planets and, for each, judges:
//     (1) its SUBHATVAM / PAPATVAM in the NATAL chart  — natal dignity + house
//     (2) its SUBHATVAM / PAPATVAM in the CURRENT GOCHARA (transit) — how the
//         same planet sits in the sky today (transit sign dignity + its house
//         from the natal Moon / Janma-rasi, per gochara-phala convention)
//     (3) the combined verdict of natal-promise × transit-trigger.
//
//   Saturn (Sani, 6) and Jupiter (Guru, 4) transits are always weighed — the
//   classical "double transit" — plus every other planet's transit position is
//   available so the reading reflects the whole sky, not just the dasha lords.
//
//   Finally it builds a PERIOD-BY-PERIOD timeline of the Bhukti (and, inside the
//   running Maha, Antara) windows that overlap the past 5 and next 5 years, each
//   with a time-stamped outcome so the user gets accurate, time-wise guidance.
//
// Planet indices: 0=Sun 1=Moon 2=Mars 3=Mercury 4=Jupiter 5=Venus 6=Saturn 7=Rahu 8=Ketu
// Sign indices:   0=Mesha .. 11=Meena
// ----------------------------------------------------------------------------

import type { Bilingual } from "./constants";
import { GRAHAS, RASIS, RASI_LORDS, aspectFromTo } from "./constants";
import type { PlanetPosition, transitPositions as TransitFn } from "./engine";
import type { DashaTimeline, DashaNode } from "./dasha";
import { computeDignity, type DignityResult } from "./dignity";
import type { Tone, Finding } from "./knrao-analysis";

export type { Tone, Finding } from "./knrao-analysis";

// Benefic / malefic classification used to describe subha vs papa in words.
const NATURAL_BENEFIC = new Set([4, 5, 3, 1]); // Jupiter, Venus, Mercury, Moon
const NATURAL_MALEFIC = new Set([0, 2, 6, 7, 8]); // Sun, Mars, Saturn, Rahu, Ketu

// Dignity → "subha" (favourable) or "papa" (afflicted) leaning, with a 0..100
// strength read straight from the dignity points (uccham 100 … neecham 0).
export type Disposition = "subha" | "mixed" | "papa";

function dignityDisposition(dig: DignityResult | null): { disp: Disposition; points: number } {
  if (!dig) return { disp: "mixed", points: 50 }; // Rahu/Ketu — no rulership dignity
  if (dig.points >= 60) return { disp: "subha", points: dig.points }; // own/MT/exalted
  if (dig.points <= 10) return { disp: "papa", points: dig.points };  // enemy/debilitated
  return { disp: "mixed", points: dig.points };                        // friend/neutral
}

// House (1..12) of a sign counted from a reference sign (Lagna or Janma-rasi).
function houseFrom(sign: number, ref: number): number {
  return ((sign - ref + 12) % 12) + 1;
}

// Gochara-phala: transiting a planet through the 3rd/6th/10th/11th (upachaya)
// from the Janma-rasi is broadly supportive; the 1st(over Moon)/4th/8th/12th is
// straining; the rest is neutral. This is the classical "result of transit".
function gocharaHouseTone(houseFromMoon: number): Disposition {
  if ([3, 6, 10, 11].includes(houseFromMoon)) return "subha";
  if ([4, 8, 12].includes(houseFromMoon)) return "papa";
  return "mixed";
}

// ---- Per-lord reading (natal + transit) ------------------------------------

export interface LordReading {
  level: "maha" | "bhukti" | "antara";
  levelLabel: Bilingual;
  lordIndex: number;
  lord: Bilingual;
  start: string;   // ISO yyyy-mm-dd
  end: string;
  // Natal
  natalSign: number;
  natalSignName: Bilingual;
  natalHouse: number;      // from Lagna
  natalDignity: DignityResult | null;
  natalDisp: Disposition;
  // Transit (current sky)
  transitSign: number;
  transitSignName: Bilingual;
  transitDignity: DignityResult | null;
  transitHouseFromMoon: number;
  transitDisp: Disposition;
  transitRetro: boolean;
  // Combined
  combined: Disposition;
  verdict: Bilingual;
  reasons: Bilingual[];
}

// Combine natal promise with the current transit trigger into one disposition.
function combineDisp(natal: Disposition, transit: Disposition): Disposition {
  const score = (d: Disposition) => (d === "subha" ? 1 : d === "papa" ? -1 : 0);
  const s = score(natal) + score(transit);
  if (s >= 1) return "subha";
  if (s <= -1) return "papa";
  return "mixed";
}

function dispWord(d: Disposition): Bilingual {
  switch (d) {
    case "subha": return { ta: "சுபத்துவம்", en: "Subhatvam (favourable)", hi: "शुभत्व (अनुकूल)" };
    case "papa": return { ta: "பாபத்துவம்", en: "Papatvam (afflicted)", hi: "पापत्व (प्रतिकूल)" };
    default: return { ta: "கலப்பு", en: "Mixed", hi: "मिश्रित" };
  }
}

function dispTone(d: Disposition): Tone {
  return d === "subha" ? "good" : d === "papa" ? "caution" : "mixed";
}

function natureWord(idx: number): Bilingual {
  if (NATURAL_BENEFIC.has(idx)) return { ta: "சுபகிரகம்", en: "natural benefic", hi: "स्वाभाविक शुभ" };
  if (NATURAL_MALEFIC.has(idx)) return { ta: "பாபகிரகம்", en: "natural malefic", hi: "स्वाभाविक पाप" };
  return { ta: "நடுநிலை", en: "neutral", hi: "तटस्थ" };
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Build the reading for a single dasha lord given the natal chart and a set of
// transit positions (already computed for the reference moment).
function readLord(
  level: LordReading["level"],
  levelLabel: Bilingual,
  node: { lordIndex: number; lord: Bilingual; start: Date; end: Date },
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
  moonSign: number,
  transit: PlanetPosition[],
): LordReading {
  const idx = node.lordIndex;
  const natal = natalPlanets.find((p) => p.index === idx)!;
  const tr = transit.find((p) => p.index === idx)!;

  const natalHouse = houseFrom(natal.rasiIndex, lagnaSign);
  const natalDisp = dignityDisposition(natal.dignity).disp;

  const transitHouseFromMoon = houseFrom(tr.rasiIndex, moonSign);
  const transitDignityDisp = dignityDisposition(tr.dignity).disp;
  const gocharaTone = gocharaHouseTone(transitHouseFromMoon);
  // Transit disposition blends the sign-dignity and the gochara-house result.
  const transitDisp = combineDisp(transitDignityDisp, gocharaTone);

  const combined = combineDisp(natalDisp, transitDisp);

  const reasons: Bilingual[] = [
    {
      ta: `இயற்கை: ${natureWord(idx).ta}. ஜாதகத்தில் ${natal.rasi.ta.split(" (")[0]}-ல் (${natalHouse}-ம் பாவம்)${natal.dignity ? `, ${natal.dignity.label.ta}` : ""}.`,
      en: `Nature: ${natureWord(idx).en}. Natal in ${natal.rasi.en.split(" (")[0]} (house ${natalHouse})${natal.dignity ? `, ${natal.dignity.label.en}` : ""}.`,
      hi: `स्वभाव: ${natureWord(idx).hi}. जन्म में ${(RASIS[natal.rasiIndex].hi ?? natal.rasi.en.split(" (")[0])} (भाव ${natalHouse})${natal.dignity ? `, ${natal.dignity.label.hi ?? natal.dignity.label.en}` : ""}।`,
    },
    {
      ta: `கோச்சாரம்: இப்போது ${tr.rasi.ta.split(" (")[0]}-ல்${tr.retrograde ? " (வக்ரம்)" : ""}${tr.dignity ? `, ${tr.dignity.label.ta}` : ""} — ஜன்ம ராசியிலிருந்து ${transitHouseFromMoon}-ம் இடம்.`,
      en: `Transit: now in ${tr.rasi.en.split(" (")[0]}${tr.retrograde ? " (retrograde)" : ""}${tr.dignity ? `, ${tr.dignity.label.en}` : ""} — ${transitHouseFromMoon}th from Janma-rasi.`,
      hi: `गोचर: अभी ${(RASIS[tr.rasiIndex].hi ?? tr.rasi.en.split(" (")[0])}${tr.retrograde ? " (वक्री)" : ""}${tr.dignity ? `, ${tr.dignity.label.hi ?? tr.dignity.label.en}` : ""} — जन्म राशि से ${transitHouseFromMoon}वाँ।`,
    },
  ];

  const verdict: Bilingual = {
    ta: `${node.lord.ta} — ஜாதகத்தில் ${dispWord(natalDisp).ta}, கோச்சாரத்தில் ${dispWord(transitDisp).ta}; இணைந்த பலன் ${dispWord(combined).ta}.`,
    en: `${node.lord.en} — ${dispWord(natalDisp).en} natally and ${dispWord(transitDisp).en} in transit; combined ${dispWord(combined).en}.`,
    hi: `${node.lord.hi ?? node.lord.en} — जन्म में ${dispWord(natalDisp).hi}, गोचर में ${dispWord(transitDisp).hi}; संयुक्त ${dispWord(combined).hi}।`,
  };

  return {
    level,
    levelLabel,
    lordIndex: idx,
    lord: node.lord,
    start: fmt(node.start),
    end: fmt(node.end),
    natalSign: natal.rasiIndex,
    natalSignName: natal.rasi,
    natalHouse,
    natalDignity: natal.dignity,
    natalDisp,
    transitSign: tr.rasiIndex,
    transitSignName: tr.rasi,
    transitDignity: tr.dignity,
    transitHouseFromMoon,
    transitDisp,
    transitRetro: tr.retrograde,
    combined,
    verdict,
    reasons,
  };
}

// ---- Double-transit of Sani & Guru over the natal Moon ---------------------

export interface DoubleTransit {
  jupiterSign: number;
  jupiterHouseFromMoon: number;
  saturnSign: number;
  saturnHouseFromMoon: number;
  sadeSati: boolean;         // Saturn over 12th/1st/2nd from Moon
  saturnPhase: Bilingual;    // description of Saturn's phase
  finding: Finding;
}

function analyzeDoubleTransit(moonSign: number, transit: PlanetPosition[]): DoubleTransit {
  const jup = transit.find((p) => p.index === 4)!;
  const sat = transit.find((p) => p.index === 6)!;
  const jH = houseFrom(jup.rasiIndex, moonSign);
  const sH = houseFrom(sat.rasiIndex, moonSign);

  const sadeSati = [12, 1, 2].includes(sH);
  const ashtama = sH === 8;      // Ashtama Sani — 8th from Moon
  const ardhaAshtama = sH === 4; // Kantaka/Ardhashtama — 4th from Moon
  const jupGood = [2, 5, 7, 9, 11].includes(jH); // classically favourable Guru transits from Moon

  const saturnPhase: Bilingual = sadeSati
    ? { ta: "ஏழரை சனி (சாடே சாத்தி)", en: "Sade Sati (7½ Saturn)", hi: "साढ़े साती" }
    : ashtama
      ? { ta: "அஷ்டம சனி", en: "Ashtama Sani (8th)", hi: "अष्टम शनि" }
      : ardhaAshtama
        ? { ta: "அர்த்தாஷ்டம சனி (4-ம்)", en: "Ardhashtama Sani (4th)", hi: "अर्धाष्टम शनि (4था)" }
        : { ta: "சாதாரண சனி கோச்சாரம்", en: "ordinary Saturn transit", hi: "सामान्य शनि गोचर" };

  let tone: Tone;
  if (jupGood && !sadeSati && !ashtama) tone = "good";
  else if (sadeSati || ashtama) tone = jupGood ? "mixed" : "caution";
  else tone = "info";

  const finding: Finding = {
    title: { ta: "குரு–சனி இரட்டைக் கோச்சாரம்", en: "Jupiter–Saturn double transit", hi: "गुरु–शनि द्वि-गोचर" },
    verdict: {
      ta: `கோச்சார குரு ${RASIS[jup.rasiIndex].ta.split(" (")[0]} (ஜன்ம ராசியிலிருந்து ${jH}-ம்); கோச்சார சனி ${RASIS[sat.rasiIndex].ta.split(" (")[0]} (${sH}-ம்) — ${saturnPhase.ta}. ${jupGood ? "குருவின் ஆசி பாதுகாப்பு தருகிறது." : "குருவின் நேரடி ஆதரவு குறைவு; பொறுமை தேவை."}`,
      en: `Transit Jupiter in ${RASIS[jup.rasiIndex].en.split(" (")[0]} (${jH}th from Moon); transit Saturn in ${RASIS[sat.rasiIndex].en.split(" (")[0]} (${sH}th) — ${saturnPhase.en}. ${jupGood ? "Jupiter's grace cushions the period." : "Little direct Jupiter support; patience is needed."}`,
      hi: `गोचर गुरु ${(RASIS[jup.rasiIndex].hi ?? RASIS[jup.rasiIndex].en.split(" (")[0])} (चंद्र से ${jH}वाँ); गोचर शनि ${(RASIS[sat.rasiIndex].hi ?? RASIS[sat.rasiIndex].en.split(" (")[0])} (${sH}वाँ) — ${saturnPhase.hi ?? saturnPhase.en}। ${jupGood ? "गुरु की कृपा रक्षा देती है।" : "गुरु का प्रत्यक्ष समर्थन कम; धैर्य आवश्यक।"}`,
    },
    tone,
    reasons: [
      {
        ta: sadeSati ? "சனி ஜன்ம ராசியை ஒட்டி (12/1/2) — பொறுப்பு, தாமதம், உழைப்பு." : ashtama ? "8-ம் சனி — திடீர் மாற்றம், ஆரோக்கியக் கவனம்." : "சனி உபசய இடங்களில் — நிலையான உழைப்புக்குப் பலன்.",
        en: sadeSati ? "Saturn hugs the Moon (12/1/2) — responsibility, delays, hard work." : ashtama ? "8th Saturn — sudden change, mind health & caution." : "Saturn in upachaya houses — steady effort rewarded.",
        hi: sadeSati ? "शनि चंद्र के निकट (12/1/2) — जिम्मेदारी, विलंब, परिश्रम।" : ashtama ? "अष्टम शनि — अचानक परिवर्तन, स्वास्थ्य सावधानी।" : "शनि उपचय भावों में — निरंतर परिश्रम का फल।",
      },
    ],
  };

  return {
    jupiterSign: jup.rasiIndex, jupiterHouseFromMoon: jH,
    saturnSign: sat.rasiIndex, saturnHouseFromMoon: sH,
    sadeSati, saturnPhase, finding,
  };
}

// ---- Timeline (period-by-period, past 5 & next 5 years) --------------------

export interface TimelinePeriod {
  level: "bhukti" | "antara";
  mahaLordIndex: number;
  bhuktiLordIndex: number;
  antaraLordIndex?: number;
  label: Bilingual;          // e.g. "Sun / Moon" combo
  start: string;
  end: string;
  status: "past" | "current" | "future";
  disposition: Disposition;
  headline: Bilingual;
  detail: Bilingual;
  // Per-lord classical breakdown (maha / bhukti / [antara] + Sani–Guru), each a
  // full sentence: what the lord owns, where it sits natally, how it transits.
  clauses: Bilingual[];
}

// Score a lord for a given moment: natal disposition + its transit disposition
// (at that moment) + the Sani/Guru double-transit context.
function lordMomentScore(
  lordIndex: number,
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
  moonSign: number,
  transit: PlanetPosition[],
): number {
  const natal = natalPlanets.find((p) => p.index === lordIndex)!;
  const tr = transit.find((p) => p.index === lordIndex)!;
  const s = (d: Disposition) => (d === "subha" ? 1 : d === "papa" ? -1 : 0);
  const natalScore = s(dignityDisposition(natal.dignity).disp);
  const trDignity = s(dignityDisposition(tr.dignity).disp);
  const trHouse = s(gocharaHouseTone(houseFrom(tr.rasiIndex, moonSign)));
  return natalScore + trDignity + trHouse;
}

function dispFromScore(score: number): Disposition {
  if (score >= 2) return "subha";
  if (score <= -2) return "papa";
  return "mixed";
}

// Life-area hint from the houses a lord owns/occupies natally — keeps the
// prediction concrete without over-claiming.
function areaHint(lordIndex: number, natalPlanets: PlanetPosition[], lagnaSign: number): Bilingual {
  const natal = natalPlanets.find((p) => p.index === lordIndex)!;
  const house = houseFrom(natal.rasiIndex, lagnaSign);
  const owned = RASI_LORDS.map((l, sign) => (l === lordIndex ? houseFrom(sign, lagnaSign) : 0)).filter(Boolean);
  const houses = Array.from(new Set([house, ...owned])).sort((a, b) => a - b);
  const AREA: Record<number, Bilingual> = {
    1: { ta: "உடல்/சுயம்", en: "self & health", hi: "स्वयं व स्वास्थ्य" },
    2: { ta: "பணம்/குடும்பம்", en: "money & family", hi: "धन व परिवार" },
    3: { ta: "முயற்சி/உடன்பிறப்பு", en: "effort & siblings", hi: "प्रयास व भाई-बहन" },
    4: { ta: "வீடு/மனம்/வாகனம்", en: "home, mind & vehicles", hi: "घर, मन व वाहन" },
    5: { ta: "கல்வி/குழந்தை/படைப்பு", en: "education, children & creativity", hi: "शिक्षा, संतान व सृजन" },
    6: { ta: "போட்டி/கடன்/உடல்நலம்", en: "competition, debts & health", hi: "प्रतिस्पर्धा, ऋण व स्वास्थ्य" },
    7: { ta: "வாழ்க்கைத்துணை/கூட்டு", en: "partner & partnerships", hi: "जीवनसाथी व साझेदारी" },
    8: { ta: "திடீர் மாற்றம்/மறைமுக லாபம்", en: "sudden change & hidden gains", hi: "अचानक परिवर्तन व गुप्त लाभ" },
    9: { ta: "அதிர்ஷ்டம்/பயணம்/தர்மம்", en: "fortune, travel & dharma", hi: "भाग्य, यात्रा व धर्म" },
    10: { ta: "தொழில்/பதவி", en: "career & status", hi: "करियर व पद" },
    11: { ta: "வருமானம்/ஆதாயம்", en: "income & gains", hi: "आय व लाभ" },
    12: { ta: "செலவு/வெளிநாடு/விடுதலை", en: "expenses, abroad & release", hi: "व्यय, विदेश व मुक्ति" },
  };
  const primary = houses.slice(0, 2).map((h) => AREA[h]);
  return {
    ta: primary.map((p) => p.ta).join(", "),
    en: primary.map((p) => p.en).join(", "),
    hi: primary.map((p) => (p.hi ?? p.en)).join(", "),
  };
}

// Ordinal helpers for houses (1st, 2nd, 3rd …) so clauses read naturally.
function ordEn(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function ordTa(n: number): string { return `${n}-ம்`; }
function ordHi(n: number): string { return `${n}वाँ`; }

// Which houses (from Lagna) does this planet OWN? (Rahu/Ketu own nothing.)
function ownedHouses(lordIndex: number, lagnaSign: number): number[] {
  return RASI_LORDS
    .map((owner, sign) => (owner === lordIndex ? houseFrom(sign, lagnaSign) : 0))
    .filter((h): h is number => h > 0)
    .sort((a, b) => a - b);
}

// A full classical clause for one lord inside a period: what it owns, where it
// sits natally (house + dignity), and how it transits right now (house from
// Moon + gochara verdict) — the "Sukra is lord of the 3rd, placed in …, in
// gochara …" sentence the user asked for, for every planet, nothing skipped.
function lordClause(
  roleLabel: Bilingual,
  lordIndex: number,
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
  moonSign: number,
  transit: PlanetPosition[],
): Bilingual {
  const natal = natalPlanets.find((p) => p.index === lordIndex)!;
  const tr = transit.find((p) => p.index === lordIndex)!;
  const nm = GRAHAS[lordIndex];
  const owned = ownedHouses(lordIndex, lagnaSign);
  const natalHouse = houseFrom(natal.rasiIndex, lagnaSign);
  const natalD = dignityDisposition(natal.dignity).disp;
  const trHouseMoon = houseFrom(tr.rasiIndex, moonSign);
  const trTone = gocharaHouseTone(trHouseMoon);
  const trD = combineDisp(dignityDisposition(tr.dignity).disp, trTone);

  const ownedEn = owned.length ? `lord of the ${owned.map(ordEn).join(" & ")}` : "a shadow node (no rulership)";
  const ownedTa = owned.length ? `${owned.map(ordTa).join(", ")} அதிபதி` : "சாயா கிரகம் (அதிபத்தியம் இல்லை)";
  const ownedHi = owned.length ? `${owned.map(ordHi).join(", ")} का स्वामी` : "छाया ग्रह (स्वामित्व नहीं)";

  return {
    ta: `${roleLabel.ta} ${nm.ta} — ${ownedTa}, ஜாதகத்தில் ${natalHouse}-ம் பாவத்தில் (${dispWord(natalD).ta}); கோச்சாரத்தில் ஜன்ம ராசியிலிருந்து ${ordTa(trHouseMoon)} இடம்${tr.retrograde ? " (வக்ரம்)" : ""} → ${dispWord(trD).ta}.`,
    en: `${roleLabel.en} ${nm.en} — ${ownedEn}, natally in the ${ordEn(natalHouse)} house (${dispWord(natalD).en}); in transit ${ordEn(trHouseMoon)} from the Moon${tr.retrograde ? " (retrograde)" : ""} → ${dispWord(trD).en}.`,
    hi: `${roleLabel.hi ?? roleLabel.en} ${nm.hi ?? nm.en} — ${ownedHi}, जन्म में ${ordHi(natalHouse)} भाव में (${dispWord(natalD).hi}); गोचर में चंद्र से ${ordHi(trHouseMoon)}${tr.retrograde ? " (वक्री)" : ""} → ${dispWord(trD).hi}।`,
  };
}

// Short Sani/Guru gochara note for a given moment (woven into every period).
function saniGuruNote(moonSign: number, transit: PlanetPosition[]): Bilingual {
  const jup = transit.find((p) => p.index === 4)!;
  const sat = transit.find((p) => p.index === 6)!;
  const jH = houseFrom(jup.rasiIndex, moonSign);
  const sH = houseFrom(sat.rasiIndex, moonSign);
  const jupGood = [2, 5, 7, 9, 11].includes(jH);
  const sadeSati = [12, 1, 2].includes(sH);
  const ashtama = sH === 8;
  const satNote = sadeSati
    ? { ta: "ஏழரைச் சனி", en: "Sade Sati", hi: "साढ़े साती" }
    : ashtama
      ? { ta: "அஷ்டமச் சனி", en: "Ashtama Sani", hi: "अष्टम शनि" }
      : { ta: "சாதாரண சனி", en: "ordinary Saturn", hi: "सामान्य शनि" };
  return {
    ta: `கோச்சார சனி ${ordTa(sH)} (${satNote.ta}), குரு ${ordTa(jH)} (${jupGood ? "ஆசி" : "நடுநிலை/பலவீனம்"}) — ஜன்ம ராசியிலிருந்து.`,
    en: `Transit Saturn ${ordEn(sH)} (${satNote.en}), Jupiter ${ordEn(jH)} (${jupGood ? "grace" : "neutral/weak"}) — from the Moon.`,
    hi: `गोचर शनि ${ordHi(sH)} (${satNote.hi}), गुरु ${ordHi(jH)} (${jupGood ? "कृपा" : "तटस्थ/कमज़ोर"}) — चंद्र से।`,
  };
}

function periodHeadline(disp: Disposition, area: Bilingual): Bilingual {
  if (disp === "subha") return {
    ta: `சாதகக் காலம் — ${area.ta} தொடர்பாக முன்னேற்றம்.`,
    en: `Favourable window — progress around ${area.en}.`,
    hi: `अनुकूल अवधि — ${area.hi ?? area.en} में प्रगति।`,
  };
  if (disp === "papa") return {
    ta: `கவனம் தேவை — ${area.ta} தொடர்பாக சவால்/தாமதம்.`,
    en: `Guard period — friction or delay around ${area.en}.`,
    hi: `सतर्कता अवधि — ${area.hi ?? area.en} में बाधा/विलंब।`,
  };
  return {
    ta: `கலப்புக் காலம் — ${area.ta} தொடர்பாக ஏற்ற இறக்கம்.`,
    en: `Mixed window — ups and downs around ${area.en}.`,
    hi: `मिश्रित अवधि — ${area.hi ?? area.en} में उतार-चढ़ाव।`,
  };
}

// ---- Top-level result ------------------------------------------------------

export interface DashaTransitResult {
  now: string;
  running: {
    maha?: LordReading;
    bhukti?: LordReading;
    antara?: LordReading;
  };
  doubleTransit: DoubleTransit;
  overall: Disposition;
  overallHeadline: Bilingual;
  timeline: TimelinePeriod[];   // Bhukti windows across ±5 years, current one expanded to Antara
  disclaimer: Bilingual;
}

// Walk the timeline to find the node containing `t` at each level.
function runningNodes(dasha: DashaTimeline, t: number): {
  maha?: DashaNode; bhukti?: DashaNode; antara?: DashaNode;
} {
  const maha = dasha.periods.find((p) => p.start.getTime() <= t && p.end.getTime() > t);
  const bhukti = maha?.children?.find((c) => c.start.getTime() <= t && c.end.getTime() > t);
  const antara = bhukti?.children?.find((c) => c.start.getTime() <= t && c.end.getTime() > t);
  return { maha, bhukti, antara };
}

export function analyzeDashaTransit(
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
  dasha: DashaTimeline,
  transitPositions: typeof TransitFn,
  now: Date = new Date(),
): DashaTransitResult {
  const moonSign = natalPlanets.find((p) => p.index === 1)!.rasiIndex;

  // Transit sky at "now".
  const nowTransit = transitPositions(now);
  const t = now.getTime();
  const { maha, bhukti, antara } = runningNodes(dasha, t);

  const running: DashaTransitResult["running"] = {};
  if (maha) running.maha = readLord("maha", { ta: "மகாதசை", en: "Mahadasha", hi: "महादशा" }, maha, natalPlanets, lagnaSign, moonSign, nowTransit);
  if (bhukti) running.bhukti = readLord("bhukti", { ta: "புக்தி (அந்தர்தசை)", en: "Bhukti (Antardasha)", hi: "भुक्ति (अंतर्दशा)" }, bhukti, natalPlanets, lagnaSign, moonSign, nowTransit);
  if (antara) running.antara = readLord("antara", { ta: "அந்தரம் (பிரத்யந்தர்)", en: "Antara (Pratyantar)", hi: "अंतर (प्रत्यंतर)" }, antara, natalPlanets, lagnaSign, moonSign, nowTransit);

  const doubleTransit = analyzeDoubleTransit(moonSign, nowTransit);

  // Overall = combined of the three running lords, weighted maha>bhukti>antara,
  // nudged by the double-transit tone.
  const s = (d?: Disposition) => (d === "subha" ? 1 : d === "papa" ? -1 : 0);
  let overallScore =
    s(running.maha?.combined) * 3 +
    s(running.bhukti?.combined) * 2 +
    s(running.antara?.combined) * 1;
  if (doubleTransit.finding.tone === "good") overallScore += 1;
  if (doubleTransit.finding.tone === "caution") overallScore -= 1;
  const overall: Disposition = overallScore >= 2 ? "subha" : overallScore <= -2 ? "papa" : "mixed";

  const overallHeadline: Bilingual = {
    ta: `தற்போதைய தசை–கோச்சார இணைப்பு: ${dispWord(overall).ta}. ${running.maha ? GRAHAS[running.maha.lordIndex].ta : ""}${running.bhukti ? " / " + GRAHAS[running.bhukti.lordIndex].ta : ""}${running.antara ? " / " + GRAHAS[running.antara.lordIndex].ta : ""} காலம், ${doubleTransit.saturnPhase.ta} உடன்.`,
    en: `Current dasha × transit blend: ${dispWord(overall).en}. Running ${running.maha ? GRAHAS[running.maha.lordIndex].en : ""}${running.bhukti ? " / " + GRAHAS[running.bhukti.lordIndex].en : ""}${running.antara ? " / " + GRAHAS[running.antara.lordIndex].en : ""}, under ${doubleTransit.saturnPhase.en}.`,
    hi: `वर्तमान दशा × गोचर संयोजन: ${dispWord(overall).hi}. चालू ${running.maha ? (GRAHAS[running.maha.lordIndex].hi ?? GRAHAS[running.maha.lordIndex].en) : ""}${running.bhukti ? " / " + (GRAHAS[running.bhukti.lordIndex].hi ?? GRAHAS[running.bhukti.lordIndex].en) : ""}${running.antara ? " / " + (GRAHAS[running.antara.lordIndex].hi ?? GRAHAS[running.antara.lordIndex].en) : ""}, ${doubleTransit.saturnPhase.hi ?? doubleTransit.saturnPhase.en} के अंतर्गत।`,
  };

  // ---- Timeline: from 1900 through the next 5 years -----------------------
  // The user wants the full historical depth (every Bhukti period back to 1900)
  // available, while near-term timing still runs 5 years ahead. The client
  // defaults the visible window to 1990 and lets the user reveal the older
  // 1900–1990 periods on demand.
  const fiveYears = 5 * 365.25 * 24 * 3600 * 1000;
  const HISTORY_FLOOR = Date.UTC(1900, 0, 1); // Jan 1, 1900
  const winStart = Math.min(HISTORY_FLOOR, t - fiveYears);
  const winEnd = t + fiveYears;

  const timeline: TimelinePeriod[] = [];

  // Cache transit charts by month to avoid recomputing per period midpoint.
  const transitCache = new Map<string, PlanetPosition[]>();
  const transitAt = (d: Date): PlanetPosition[] => {
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    let tp = transitCache.get(key);
    if (!tp) { tp = transitPositions(d); transitCache.set(key, tp); }
    return tp;
  };

  const clamp = (d: Date) => new Date(Math.max(winStart, Math.min(winEnd, d.getTime())));

  for (const md of dasha.periods) {
    if (md.end.getTime() < winStart || md.start.getTime() > winEnd) continue;
    for (const bd of md.children ?? []) {
      if (bd.end.getTime() < winStart || bd.start.getTime() > winEnd) continue;

      const isCurrentBhukti = bd.start.getTime() <= t && bd.end.getTime() > t;

      // For the CURRENT bhukti, expand to Antara windows so the user gets
      // fine-grained near-term timing; otherwise report at Bhukti granularity.
      if (isCurrentBhukti && bd.children?.length) {
        for (const ad of bd.children) {
          if (ad.end.getTime() < winStart || ad.start.getTime() > winEnd) continue;
          const mid = clamp(new Date((ad.start.getTime() + ad.end.getTime()) / 2));
          const tp = transitAt(mid);
          const score =
            lordMomentScore(md.lordIndex, natalPlanets, lagnaSign, moonSign, tp) +
            lordMomentScore(bd.lordIndex, natalPlanets, lagnaSign, moonSign, tp) +
            lordMomentScore(ad.lordIndex, natalPlanets, lagnaSign, moonSign, tp);
          const disp = dispFromScore(score / 3);
          const area = areaHint(ad.lordIndex, natalPlanets, lagnaSign);
          const status: TimelinePeriod["status"] =
            ad.end.getTime() <= t ? "past" : ad.start.getTime() > t ? "future" : "current";
          timeline.push({
            level: "antara",
            mahaLordIndex: md.lordIndex,
            bhuktiLordIndex: bd.lordIndex,
            antaraLordIndex: ad.lordIndex,
            label: {
              ta: `${GRAHAS[md.lordIndex].ta}/${GRAHAS[bd.lordIndex].ta}/${GRAHAS[ad.lordIndex].ta}`,
              en: `${GRAHAS[md.lordIndex].en}/${GRAHAS[bd.lordIndex].en}/${GRAHAS[ad.lordIndex].en}`,
              hi: `${GRAHAS[md.lordIndex].hi ?? GRAHAS[md.lordIndex].en}/${GRAHAS[bd.lordIndex].hi ?? GRAHAS[bd.lordIndex].en}/${GRAHAS[ad.lordIndex].hi ?? GRAHAS[ad.lordIndex].en}`,
            },
            start: fmt(ad.start),
            end: fmt(ad.end),
            status,
            disposition: disp,
            headline: periodHeadline(disp, area),
            detail: {
              ta: `அந்தர அதிபதி ${GRAHAS[ad.lordIndex].ta}; அந்நேர கோச்சாரப் பலனுடன் இணைந்து ${dispWord(disp).ta}.`,
              en: `Antara lord ${GRAHAS[ad.lordIndex].en}; blended with the sky of that time it reads ${dispWord(disp).en}.`,
              hi: `अंतर स्वामी ${GRAHAS[ad.lordIndex].hi ?? GRAHAS[ad.lordIndex].en}; उस समय के गोचर सहित ${dispWord(disp).hi}।`,
            },
            clauses: [
              lordClause({ ta: "மகாதசை:", en: "Maha:", hi: "महादशा:" }, md.lordIndex, natalPlanets, lagnaSign, moonSign, tp),
              lordClause({ ta: "புக்தி:", en: "Bhukti:", hi: "भुक्ति:" }, bd.lordIndex, natalPlanets, lagnaSign, moonSign, tp),
              lordClause({ ta: "அந்தரம்:", en: "Antara:", hi: "अंतर:" }, ad.lordIndex, natalPlanets, lagnaSign, moonSign, tp),
              saniGuruNote(moonSign, tp),
            ],
          });
        }
      } else {
        const mid = clamp(new Date((bd.start.getTime() + bd.end.getTime()) / 2));
        const tp = transitAt(mid);
        const score =
          lordMomentScore(md.lordIndex, natalPlanets, lagnaSign, moonSign, tp) +
          lordMomentScore(bd.lordIndex, natalPlanets, lagnaSign, moonSign, tp);
        const disp = dispFromScore(score / 2);
        const area = areaHint(bd.lordIndex, natalPlanets, lagnaSign);
        const status: TimelinePeriod["status"] =
          bd.end.getTime() <= t ? "past" : bd.start.getTime() > t ? "future" : "current";
        timeline.push({
          level: "bhukti",
          mahaLordIndex: md.lordIndex,
          bhuktiLordIndex: bd.lordIndex,
          label: {
            ta: `${GRAHAS[md.lordIndex].ta} / ${GRAHAS[bd.lordIndex].ta}`,
            en: `${GRAHAS[md.lordIndex].en} / ${GRAHAS[bd.lordIndex].en}`,
            hi: `${GRAHAS[md.lordIndex].hi ?? GRAHAS[md.lordIndex].en} / ${GRAHAS[bd.lordIndex].hi ?? GRAHAS[bd.lordIndex].en}`,
          },
          start: fmt(bd.start),
          end: fmt(bd.end),
          status,
          disposition: disp,
          headline: periodHeadline(disp, area),
          detail: {
            ta: `புக்தி அதிபதி ${GRAHAS[bd.lordIndex].ta}; காலநடு கோச்சாரப் பலனுடன் இணைந்து ${dispWord(disp).ta}.`,
            en: `Bhukti lord ${GRAHAS[bd.lordIndex].en}; blended with the mid-period sky it reads ${dispWord(disp).en}.`,
            hi: `भुक्ति स्वामी ${GRAHAS[bd.lordIndex].hi ?? GRAHAS[bd.lordIndex].en}; मध्य-अवधि गोचर सहित ${dispWord(disp).hi}।`,
          },
          clauses: [
            lordClause({ ta: "மகாதசை:", en: "Maha:", hi: "महादशा:" }, md.lordIndex, natalPlanets, lagnaSign, moonSign, tp),
            lordClause({ ta: "புக்தி:", en: "Bhukti:", hi: "भुक्ति:" }, bd.lordIndex, natalPlanets, lagnaSign, moonSign, tp),
            saniGuruNote(moonSign, tp),
          ],
        });
      }
    }
  }

  timeline.sort((a, b) => a.start.localeCompare(b.start));

  return {
    now: fmt(now),
    running,
    doubleTransit,
    overall,
    overallHeadline,
    timeline,
    disclaimer: {
      ta: "இது விம்சோத்தரி தசை + கோச்சார (குரு/சனி உள்பட) கிளாசிக்கல் விதிகளின் அடிப்படையிலான பொதுவான வழிகாட்டுதல்; உறுதியான கணிப்பு அல்ல. முக்கிய முடிவுகளுக்கு அனுபவமிக்க ஜோதிடரை அணுகவும்.",
      en: "This is general guidance built from classical Vimshottari dasha + gochara (including Jupiter/Saturn) rules — not a guaranteed prediction. Consult an experienced astrologer for major decisions.",
      hi: "यह शास्त्रीय विम्शोत्तरी दशा + गोचर (गुरु/शनि सहित) नियमों पर आधारित सामान्य मार्गदर्शन है — निश्चित भविष्यवाणी नहीं। महत्वपूर्ण निर्णयों हेतु अनुभवी ज्योतिषी से परामर्श लें।",
    },
  };
}
