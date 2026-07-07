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
import { GRAHAS, RASIS, RASIS_HI, RASI_LORDS, aspectFromTo } from "./constants";
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

// ---------------------------------------------------------------------------
// SPECIAL LAGNA-SPECIFIC PLACEMENT RULES (classical bhava-lord yogas)
// ---------------------------------------------------------------------------
// Some guruji / classical rules override the plain dignity + house reading for
// a particular planet in a particular house, but ONLY for a specific lagna.
// Example (confirmed from a guruji session): for MITHUNA (Gemini) lagna,
// Budha/Mercury in the 12th house is specially FAVOURABLE (subha) — even
// though a lagna-lord in the 12th normally reads as weak/medium.
//
// The table is intentionally an extensible lookup keyed on
//   { lagnaSign, planetIndex, natalHouse }  →  { disp, points, note }
// so more guruji rules can be dropped in over time without touching the
// scoring code. `points` is the strength (0..100) to show on the meters, and
// `note` is an optional short reason appended to the pillar/clause text.
//
// Planet indices: 0=Surya 1=Chandra 2=Sevvai 3=Budha 4=Guru 5=Sukra 6=Sani 7=Rahu 8=Ketu
// Sign indices:   0=Mesha .. 2=Mithuna(Gemini) .. 11=Meena

export interface SpecialPlacementRule {
  lagnaSign: number;
  planetIndex: number;
  natalHouse: number;         // 1..12, counted from Lagna
  disp: Disposition;          // overriding disposition
  points: number;             // overriding strength (0..100) for the meters
  note: Bilingual;            // short classical reason
}

export const SPECIAL_PLACEMENT_RULES: SpecialPlacementRule[] = [
  {
    // Mithuna lagna + Budha (lagna lord) in the 12th → specially favourable.
    lagnaSign: 2,
    planetIndex: 3,
    natalHouse: 12,
    disp: "subha",
    points: 80,
    note: {
      ta: "சிறப்பு விதி: மிதுன லக்னத்திற்கு புதன் 12-ல் இருப்பது மிகவும் சாதகம் (லக்னாதிபதி வியய ஸ்தானத்தில் — சிறப்பு யோகம்).",
      en: "Special rule: for Mithuna (Gemini) lagna, Mercury in the 12th is highly favourable (lagna lord in the 12th — a special yoga).",
      hi: "विशेष नियम: मिथुन लग्न के लिए बुध का 12वें में होना अत्यंत अनुकूल है (लग्नेश व्यय भाव में — विशेष योग)।",
    },
  },
];

// Look up a special override for a planet at a natal house for a given lagna.
// Returns null when no special rule applies (normal dignity scoring is used).
function specialPlacementRule(
  lagnaSign: number,
  planetIndex: number,
  natalHouse: number,
): SpecialPlacementRule | null {
  return (
    SPECIAL_PLACEMENT_RULES.find(
      (r) =>
        r.lagnaSign === lagnaSign &&
        r.planetIndex === planetIndex &&
        r.natalHouse === natalHouse,
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// PARIVARTANA (mutual sign exchange) — e.g. Sani in a Guru sign while Guru is
// in a Sani sign. Classical texts (Saravali, Phaladeepika) treat the exchange
// like a CONJUNCTION of the two planets and split it into THREE types by the
// houses the two planets OWN (from the lagna):
//
//   • MAHA (great)   — both lords own only auspicious houses (kendra 1/4/7/10,
//                       trikona 1/5/9, or 11). A mutual Raja-yoga: BOTH planets
//                       and both houses are strongly boosted.
//   • KAHALA         — one lord owns the 3rd house (no dusthana involved).
//                       Energises effort but fortunes fluctuate (mixed).
//   • DAINYA (misery)— one lord owns a dusthana (6/8/12). The dusthana lord is
//                       LIFTED (it borrows the other's strength) but the OTHER
//                       planet is DAMAGED. Asymmetric — not a blanket boost.
//
// The exchange amplifies whatever the planets/houses signify (good or bad), and
// classically its full result ripens in the SECOND HALF of that planet's dasha.

type ParivartanaType = "maha" | "kahala" | "dainya";

const DUSTHANAS = [6, 8, 12];
const KENDRA_TRIKONA = [1, 4, 5, 7, 9, 10, 11]; // auspicious (11 = labha)

// Return the partner planet index if `planetIndex` is in a mutual sign exchange,
// else null. A planet in sign S has dispositor D = RASI_LORDS[S]; if D sits in a
// sign ruled by `planetIndex`, the two are in parivartana.
function parivartanaPartner(
  planetIndex: number,
  natalPlanets: PlanetPosition[],
): number | null {
  const me = natalPlanets.find((p) => p.index === planetIndex);
  if (!me) return null;
  const dispositor = RASI_LORDS[me.rasiIndex];
  if (dispositor === planetIndex) return null; // in own sign, not an exchange
  const other = natalPlanets.find((p) => p.index === dispositor);
  if (!other) return null;
  // Does the dispositor sit in a sign that `planetIndex` rules?
  if (RASI_LORDS[other.rasiIndex] === planetIndex) return dispositor;
  return null;
}

// Classify a parivartana pair by the houses each planet OWNS from the lagna.
// Sun/Moon own one house; others own two; nodes own none (excluded upstream).
function parivartanaType(
  planetIndex: number,
  partnerIndex: number,
  lagnaSign: number,
): ParivartanaType {
  const owned = [
    ...ownedHouses(planetIndex, lagnaSign),
    ...ownedHouses(partnerIndex, lagnaSign),
  ];
  // Dainya dominates: any dusthana lordship in the pair.
  if (owned.some((h) => DUSTHANAS.includes(h))) return "dainya";
  // Kahala: 3rd-house lordship involved (and no dusthana).
  if (owned.includes(3)) return "kahala";
  // Maha: everything owned is auspicious.
  if (owned.every((h) => KENDRA_TRIKONA.includes(h))) return "maha";
  // Fallback (e.g. only 2nd/12th-free neutral houses) — treat as kahala/mixed.
  return "kahala";
}

// Given the type, decide THIS planet's disposition + strength floor and whether
// it is the beneficiary or the damaged party (relevant only for Dainya).
function parivartanaEffect(
  planetIndex: number,
  partnerIndex: number,
  lagnaSign: number,
  basePoints: number,
): { type: ParivartanaType; disp: Disposition; points: number; damaged: boolean } {
  const type = parivartanaType(planetIndex, partnerIndex, lagnaSign);
  if (type === "maha") {
    // Both planets strongly lifted.
    return { type, disp: "subha", points: Math.max(basePoints, 78), damaged: false };
  }
  if (type === "kahala") {
    // Energised but fluctuating — nudge toward mixed, mild floor.
    return { type, disp: "mixed", points: Math.max(basePoints, 50), damaged: false };
  }
  // DAINYA: the planet that OWNS the dusthana is the beneficiary (lifted);
  // the other planet is damaged (its result is dragged down).
  const myHouses = ownedHouses(planetIndex, lagnaSign);
  const iOwnDusthana = myHouses.some((h) => DUSTHANAS.includes(h));
  if (iOwnDusthana) {
    // Beneficiary dusthana lord — lifted to subha but modest floor.
    return { type, disp: "subha", points: Math.max(basePoints, 65), damaged: false };
  }
  // Damaged partner — pull disposition to papa, cap strength low.
  return { type, disp: "papa", points: Math.min(basePoints, 30), damaged: true };
}

// --- Dispositor (house-lord) strength -------------------------------------
// Classical Tamil/Vedic principle: a planet borrows the condition of the LORD
// of the sign (house) it sits in. If that dispositor is itself strong (uccham /
// aatchi / moolatrikona) the planet's placement is well-supported and its
// results are far stronger; if the dispositor is weak (pagai / neecham) the
// placement is undermined and results are diluted. A planet in its OWN sign is
// its own lord — no external dependency, so no dispositor adjustment.
type DispositorTier = "strong" | "supported" | "neutral" | "weak";

interface DispositorStrength {
  dispositorIndex: number;      // the lord of this planet's natal sign
  dispositorDignity: DignityResult | null;
  tier: DispositorTier;
  delta: number;                // points adjustment applied to the host planet
}

// Assess the strength of the lord of `planetIndex`'s natal sign.
// Returns null for Rahu/Ketu (dispositor concept applies to the host, so we
// still compute it for them via their sign lord) — we DO compute for nodes,
// since a node in a sign still depends on that sign's lord.
function dispositorStrength(
  planetIndex: number,
  natalSign: number,
  natalPlanets: PlanetPosition[] | undefined,
): DispositorStrength | null {
  if (!natalPlanets) return null;
  const lord = RASI_LORDS[natalSign];
  // A (non-node) planet in its own sign is its own dispositor — skip.
  if (lord === planetIndex) return null;
  const lordPos = natalPlanets.find((p) => p.index === lord);
  if (!lordPos) return null;
  const dig = lordPos.dignity;
  const pts = dig ? dig.points : 20; // nodes have no dignity — treat neutral

  // Map the dispositor's own dignity onto a tier + a bounded points delta for
  // the host planet. Exalted/own lord = big boost ("really powerful"); an
  // enemy/debilitated lord = a real drag.
  let tier: DispositorTier;
  let delta: number;
  if (pts >= 100) { tier = "strong"; delta = 22; }        // uccham
  else if (pts >= 60) { tier = "strong"; delta = 16; }    // aatchi / moolatrikona
  else if (pts >= 40) { tier = "supported"; delta = 8; }  // natpu (friend)
  else if (pts <= 0) { tier = "weak"; delta = -20; }      // neecham
  else if (pts <= 10) { tier = "weak"; delta = -14; }     // pagai (enemy)
  else { tier = "neutral"; delta = 0; }                    // samam

  return { dispositorIndex: lord, dispositorDignity: dig, tier, delta };
}

// Nudge a disposition one step given a signed points delta so the verbal
// verdict stays consistent with the adjusted strength meter.
function nudgeDisp(disp: Disposition, delta: number): Disposition {
  if (delta >= 14 && disp === "mixed") return "subha";
  if (delta >= 20 && disp === "papa") return "mixed";
  if (delta <= -14 && disp === "mixed") return "papa";
  if (delta <= -20 && disp === "subha") return "mixed";
  return disp;
}

// Natal disposition + strength for a planet, applying any special lagna rule
// AND parivartana on top of the plain dignity reading. This is the single
// source of truth for "how good is this planet natally" so pillars, clauses
// and scoring all agree.
function natalDispWithRules(
  planetIndex: number,
  natalSign: number,
  natalHouse: number,
  lagnaSign: number,
  dig: DignityResult | null,
  natalPlanets?: PlanetPosition[],
): {
  disp: Disposition;
  points: number;
  special: SpecialPlacementRule | null;
  parivartanaWith: number | null;
  parivartanaType: ParivartanaType | null;
  parivartanaDamaged: boolean;
  dispositor: DispositorStrength | null;
} {
  const special = specialPlacementRule(lagnaSign, planetIndex, natalHouse);
  if (special)
    return {
      disp: special.disp,
      points: special.points,
      special,
      parivartanaWith: null,
      parivartanaType: null,
      parivartanaDamaged: false,
      dispositor: null,
    };

  const base = dignityDisposition(dig);

  // Parivartana — apply the correct classical type (Maha / Kahala / Dainya).
  // (An exchange already resolves the two-way dispositor relationship, so we do
  // not layer a separate dispositor adjustment on top.)
  const partner = natalPlanets ? parivartanaPartner(planetIndex, natalPlanets) : null;
  if (partner !== null) {
    const eff = parivartanaEffect(planetIndex, partner, lagnaSign, base.points);
    return {
      disp: eff.disp,
      points: eff.points,
      special: null,
      parivartanaWith: partner,
      parivartanaType: eff.type,
      parivartanaDamaged: eff.damaged,
      dispositor: null,
    };
  }

  // Dispositor (house-lord) strength: fold the condition of the sign-lord into
  // this planet's strength. Skipped when the planet is exalted/debilitated in
  // its OWN right at an extreme (its own dignity already dominates), so a
  // strong/weak lord chiefly refines the middle ground.
  const disp = dispositorStrength(planetIndex, natalSign, natalPlanets);
  let points = base.points;
  let leaning = base.disp;
  if (disp && disp.delta !== 0) {
    points = Math.max(0, Math.min(100, base.points + disp.delta));
    leaning = nudgeDisp(base.disp, disp.delta);
  }

  return {
    disp: leaning,
    points,
    special: null,
    parivartanaWith: null,
    parivartanaType: null,
    parivartanaDamaged: false,
    dispositor: disp,
  };
}

// Type-specific note describing a parivartana pairing (with second-half ripening).
function parivartanaNote(
  planetIndex: number,
  partnerIndex: number,
  type: ParivartanaType,
  damaged: boolean,
): Bilingual {
  const a = GRAHAS[planetIndex];
  const b = GRAHAS[partnerIndex];
  const pair = `${a.en}–${b.en}`;
  const pairTa = `${a.ta}–${b.ta}`;
  const pairHi = `${a.hi ?? a.en}–${b.hi ?? b.en}`;

  if (type === "maha") {
    return {
      ta: `மகா பரிவர்த்தனை: ${pairTa} இட மாற்றம் (கேந்திர/திரிகோண அதிபதிகள்) — இரண்டும் மிகுந்த பலம்; ராஜயோக பலன், தசையின் இரண்டாம் பாதியில் முழுமையாக வெளிப்படும்.`,
      en: `Maha parivartana: ${pair} exchange (kendra/trikona lords) — both greatly strengthened, a Raja-yoga link; full result ripens in the SECOND HALF of the dasha.`,
      hi: `महा परिवर्तन: ${pairHi} विनिमय (केन्द्र/त्रिकोण स्वामी) — दोनों अत्यंत बलवान, राजयोग; पूर्ण फल दशा के उत्तरार्ध में।`,
    };
  }
  if (type === "kahala") {
    return {
      ta: `ககல பரிவர்த்தனை: ${pairTa} இட மாற்றம் — முயற்சிகளை தூண்டும், ஆனால் பலன் ஏற்றஇறக்கமாக (கலப்பு); தசையின் இரண்டாம் பாதியில் முழுமை.`,
      en: `Kahala parivartana: ${pair} exchange — energises effort and drive, but fortunes fluctuate (mixed); full result ripens in the SECOND HALF of the dasha.`,
      hi: `कहल परिवर्तन: ${pairHi} विनिमय — प्रयास बढ़ता है पर भाग्य में उतार-चढाव (मिश्रित); पूर्ण फल दशा के उत्तरार्ध में।`,
    };
  }
  // Dainya — asymmetric.
  if (damaged) {
    return {
      ta: `தைன்ய பரிவர்த்தனை: ${pairTa} இட மாற்றம் (டுஷ்டான அதிபதி எதிர்) — இந்த கிரகம் பாதிக்கப்படுகிறது; பலன் குறையும்.`,
      en: `Dainya parivartana: ${pair} exchange with a dusthana (6/8/12) lord — THIS planet is the damaged party; its results are weakened even though the exchange energises the dusthana lord.`,
      hi: `दैन्य परिवर्तन: ${pairHi} विनिमय (दुष्थान स्वामी से) — यह ग्रह क्षतिग्रस्त है, फल कमजोर।`,
    };
  }
  return {
    ta: `தைன்ய பரிவர்த்தனை: ${pairTa} இட மாற்றம் (இந்த கிரகம் டுஷ்டான அதிபதி) — இது பலப்படுத்தப்படுகிறது; எனினும் மற்ற கிரகம் பாதிக்கப்படும்; தசையின் இரண்டாம் பாதியில் முழுமை.`,
    en: `Dainya parivartana: ${pair} exchange — this dusthana (6/8/12) lord is lifted by the exchange, but the OTHER planet is damaged; net result is mixed, ripening in the SECOND HALF of the dasha.`,
    hi: `दैन्य परिवर्तन: ${pairHi} विनिमय — यह दुष्थान स्वामी बल पाता है, पर दूसरा ग्रह क्षतिग्रस्त; पूर्ण फल दशा के उत्तरार्ध में।`,
  };
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

// Build the trilingual clause explaining the dispositor (house-lord) strength
// for a planet placed in a sign it does not own. Returns null when there is no
// dispositor adjustment (own sign, node without data, or exact-neutral lord).
function dispositorClause(
  hostIndex: number,
  disp: DispositorStrength | null,
): Bilingual | null {
  if (!disp) return null;
  const lord = GRAHAS[disp.dispositorIndex];
  const digTa = disp.dispositorDignity ? disp.dispositorDignity.label.ta : "—";
  const digEn = disp.dispositorDignity ? disp.dispositorDignity.label.en : "—";
  const digHi = disp.dispositorDignity
    ? (disp.dispositorDignity.label.hi ?? disp.dispositorDignity.label.en)
    : "—";
  const lordTa = lord.ta;
  const lordEn = lord.en;
  const lordHi = lord.hi ?? lord.en;

  if (disp.tier === "strong") {
    return {
      ta: `இட அதிபதி பலம்: இந்த ராசியின் அதிபதி ${lordTa} ${digTa} — வலிமையான அதிபதி; இந்த கிரகத்தின் பலன் மிகவும் பலப்படுகிறது.`,
      en: `House-lord strength: the lord of this sign, ${lordEn}, is ${digEn} — a strong dispositor, so this planet's results are greatly empowered.`,
      hi: `भाव-स्वामी बल: इस राशि का स्वामी ${lordHi} ${digHi} है — बलवान स्वामी; इस ग्रह का फल अत्यधिक प्रबल होता है।`,
    };
  }
  if (disp.tier === "supported") {
    return {
      ta: `இட அதிபதி பலம்: இந்த ராசியின் அதிபதி ${lordTa} ${digTa} — நட்பு நிலை; இந்த கிரகத்திற்கு மிதமான ஆதரவு.`,
      en: `House-lord strength: the lord of this sign, ${lordEn}, is ${digEn} (friendly) — moderate support for this planet.`,
      hi: `भाव-स्वामी बल: इस राशि का स्वामी ${lordHi} ${digHi} (मित्र) — इस ग्रह को मध्यम समर्थन।`,
    };
  }
  if (disp.tier === "weak") {
    return {
      ta: `இட அதிபதி பலம்: இந்த ராசியின் அதிபதி ${lordTa} ${digTa} — பலவீன அதிபதி (பகை/நீசம்); இந்த கிரகத்தின் பலன் குறைக்கப்படுகிறது.`,
      en: `House-lord strength: the lord of this sign, ${lordEn}, is ${digEn} (enemy/debilitated) — a weak dispositor, so this planet's results are diluted.`,
      hi: `भाव-स्वामी बल: इस राशि का स्वामी ${lordHi} ${digHi} (शत्रु/नीच) — कमजोर स्वामी; इस ग्रह का फल क्षीण होता है।`,
    };
  }
  return null; // neutral tier — no meaningful adjustment to mention
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
  const natalRuled = natalDispWithRules(idx, natal.rasiIndex, natalHouse, lagnaSign, natal.dignity, natalPlanets);
  const natalDisp = natalRuled.disp;

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

  // Dispositor (house-lord) strength clause — the power a planet borrows from
  // the lord of the sign it occupies. Only present when it materially applies.
  const dispClause = dispositorClause(idx, natalRuled.dispositor);
  if (dispClause) reasons.push(dispClause);

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
  // Probabilistic layer: confidence the period is net-favourable, concrete
  // life-area calls, and any flagged significant life events with likelihood.
  probability: Probability;
  lifeAreaCalls: Bilingual[];
  lifeEvents: LifeEvent[];
  // Money timing: is this stretch a net gain window or a loss/expense window,
  // plus how long it lasts (its own duration from start→end).
  wealthTiming: WealthWindow;
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
  const natalHouse = houseFrom(natal.rasiIndex, lagnaSign);
  const natalScore = s(natalDispWithRules(lordIndex, natal.rasiIndex, natalHouse, lagnaSign, natal.dignity, natalPlanets).disp);
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
  const ruled = natalDispWithRules(lordIndex, natal.rasiIndex, natalHouse, lagnaSign, natal.dignity, natalPlanets);
  const natalD = ruled.disp;
  const trHouseMoon = houseFrom(tr.rasiIndex, moonSign);
  const trTone = gocharaHouseTone(trHouseMoon);
  const trD = combineDisp(dignityDisposition(tr.dignity).disp, trTone);

  const ownedEn = owned.length ? `lord of the ${owned.map(ordEn).join(" & ")}` : "a shadow node (no rulership)";
  const ownedTa = owned.length ? `${owned.map(ordTa).join(", ")} அதிபதி` : "சாயா கிரகம் (அதிபத்தியம் இல்லை)";
  const ownedHi = owned.length ? `${owned.map(ordHi).join(", ")} का स्वामी` : "छाया ग्रह (स्वामित्व नहीं)";

  const pariv = ruled.parivartanaWith !== null ? parivartanaNote(lordIndex, ruled.parivartanaWith, ruled.parivartanaType!, ruled.parivartanaDamaged) : null;
  const disp = dispositorClause(lordIndex, ruled.dispositor);
  const specTa = (ruled.special ? ` ${ruled.special.note.ta}` : "") + (pariv ? ` ${pariv.ta}` : "") + (disp ? ` ${disp.ta}` : "");
  const specEn = (ruled.special ? ` ${ruled.special.note.en}` : "") + (pariv ? ` ${pariv.en}` : "") + (disp ? ` ${disp.en}` : "");
  const specHi = (ruled.special ? ` ${ruled.special.note.hi ?? ruled.special.note.en}` : "") + (pariv ? ` ${pariv.hi ?? pariv.en}` : "") + (disp ? ` ${disp.hi ?? disp.en}` : "");

  return {
    ta: `${roleLabel.ta} ${nm.ta} — ${ownedTa}, ஜாதகத்தில் ${natalHouse}-ம் பாவத்தில் (${dispWord(natalD).ta}); கோச்சாரத்தில் ஜன்ம ராசியிலிருந்து ${ordTa(trHouseMoon)} இடம்${tr.retrograde ? " (வக்ரம்)" : ""} → ${dispWord(trD).ta}.${specTa}`,
    en: `${roleLabel.en} ${nm.en} — ${ownedEn}, natally in the ${ordEn(natalHouse)} house (${dispWord(natalD).en}); in transit ${ordEn(trHouseMoon)} from the Moon${tr.retrograde ? " (retrograde)" : ""} → ${dispWord(trD).en}.${specEn}`,
    hi: `${roleLabel.hi ?? roleLabel.en} ${nm.hi ?? nm.en} — ${ownedHi}, जन्म में ${ordHi(natalHouse)} भाव में (${dispWord(natalD).hi}); गोचर में चंद्र से ${ordHi(trHouseMoon)}${tr.retrograde ? " (वक्री)" : ""} → ${dispWord(trD).hi}।${specHi}`,
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

// ---------------------------------------------------------------------------
// PROBABILISTIC READING — the user wants predictions that are "more real, facts
// based on probabilities, straight, and confirm what happened". So instead of
// only a soft subha/papa word, each period carries a CONFIDENCE % and a plain
// likelihood band, plus concrete life-area calls and flagged life events.
// ---------------------------------------------------------------------------

export type ProbBand = "very-likely" | "likely" | "even" | "unlikely" | "very-unlikely";

export interface Probability {
  percent: number;         // 0..100 confidence that the period is net-favourable
  band: ProbBand;
  label: Bilingual;        // e.g. "Likely favourable (72%)"
}

// Map a raw period score to a favourability probability. `maxAbs` is the
// theoretical maximum magnitude of the score (3 per lord × number of lords).
// A logistic-ish squash keeps mid scores honest (near 50%) and pushes the
// extremes toward high confidence without ever claiming certainty.
function probabilityFromScore(score: number, maxAbs: number): Probability {
  const norm = Math.max(-1, Math.min(1, score / maxAbs)); // -1..1
  // 50% at norm 0, ~92% at norm 1, ~8% at norm -1.
  const percent = Math.round(50 + norm * 42);
  let band: ProbBand;
  if (percent >= 75) band = "very-likely";
  else if (percent >= 60) band = "likely";
  else if (percent > 40) band = "even";
  else if (percent > 25) band = "unlikely";
  else band = "very-unlikely";
  const bandWord: Record<ProbBand, Bilingual> = {
    "very-likely": { ta: "மிக சாதகம்", en: "very likely favourable", hi: "अत्यंत संभावित अनुकूल" },
    "likely": { ta: "சாதகமாக இருக்கலாம்", en: "likely favourable", hi: "संभावित अनुकूल" },
    "even": { ta: "ஏற்ற இறக்கம் (சமநிலை)", en: "balanced / uncertain", hi: "संतुलित / अनिश्चित" },
    "unlikely": { ta: "சவால் சாத்தியம்", en: "challenges likely", hi: "बाधाएँ संभावित" },
    "very-unlikely": { ta: "மிகுந்த கவனம் தேவை", en: "strong caution", hi: "अत्यंत सतर्कता" },
  };
  const w = bandWord[band];
  const favPct = band === "unlikely" || band === "very-unlikely" ? 100 - percent : percent;
  return {
    percent,
    band,
    label: {
      ta: `${w.ta} — ${favPct}% நம்பிக்கை`,
      en: `${w.en} — ${favPct}% confidence`,
      hi: `${w.hi ?? w.en} — ${favPct}% विश्वास`,
    },
  };
}

// Concrete, direct life-area calls for a period: for each house the active lords
// touch, state plainly whether that area advances or is strained. "Straight"
// language as requested — no hedging beyond the probability band above.
function lifeAreaCalls(
  lordIndices: number[],
  disp: Disposition,
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
): Bilingual[] {
  const AREA: Record<number, Bilingual> = {
    1: { ta: "உடல்நலம்/சுயம்", en: "Health & self", hi: "स्वास्थ्य व स्वयं" },
    2: { ta: "பணம்/குடும்பம்", en: "Money & family", hi: "धन व परिवार" },
    3: { ta: "முயற்சி/தைரியம்", en: "Effort & courage", hi: "प्रयास व साहस" },
    4: { ta: "வீடு/வாகனம்/மனநிம்மதி", en: "Home, property & peace of mind", hi: "घर, संपत्ति व मन:शांति" },
    5: { ta: "கல்வி/குழந்தை/படைப்பு", en: "Education, children & creativity", hi: "शिक्षा, संतान व सृजन" },
    6: { ta: "கடன்/போட்டி/உடல்நலம்", en: "Debts, rivals & health issues", hi: "ऋण, प्रतिस्पर्धी व रोग" },
    7: { ta: "திருமணம்/கூட்டு", en: "Marriage & partnerships", hi: "विवाह व साझेदारी" },
    8: { ta: "திடீர் மாற்றம்/ஆயுள்", en: "Sudden change & longevity", hi: "अचानक परिवर्तन व आयु" },
    9: { ta: "அதிர்ஷ்டம்/பயணம்/தர்மம்", en: "Fortune, travel & dharma", hi: "भाग्य, यात्रा व धर्म" },
    10: { ta: "தொழில்/பதவி", en: "Career & status", hi: "करियर व पद" },
    11: { ta: "வருமானம்/ஆதாயம்", en: "Income & gains", hi: "आय व लाभ" },
    12: { ta: "செலவு/வெளிநாடு/விடுதலை", en: "Expenses, foreign & letting go", hi: "व्यय, विदेश व मुक्ति" },
  };
  const verb = (d: Disposition): Bilingual =>
    d === "subha"
      ? { ta: "முன்னேற்றம் சாத்தியம்", en: "gains likely", hi: "लाभ संभावित" }
      : d === "papa"
      ? { ta: "இடர்ப்பாடு/தாமதம்", en: "strain or delay", hi: "बाधा या विलंब" }
      : { ta: "ஏற்ற இறக்கம்", en: "mixed movement", hi: "मिश्रित गति" };
  const houses = new Set<number>();
  for (const idx of lordIndices) {
    const natal = natalPlanets.find((p) => p.index === idx);
    if (natal) houses.add(houseFrom(natal.rasiIndex, lagnaSign));
    for (const h of ownedHouses(idx, lagnaSign)) houses.add(h);
  }
  const v = verb(disp);
  return Array.from(houses)
    .sort((a, b) => a - b)
    .slice(0, 4)
    .map((h) => {
      const a = AREA[h];
      return {
        ta: `${a.ta}: ${v.ta}`,
        en: `${a.en}: ${v.en}`,
        hi: `${a.hi ?? a.en}: ${v.hi ?? v.en}`,
      };
    });
}

// ---------------------------------------------------------------------------
// LIFE EVENTS — flag when a classically significant life event could occur in a
// period, with a likelihood. Triggered when the active dasha/bhukti lords own
// or occupy the karaka house AND the natural karaka planet is among the lords.
// House-lord activation is the classical timing rule ("the lord of a bhava,
// during its dasha/bhukti, gives that bhava's result").
// For childbirth we also estimate a probable count and gender from the 5th
// house (putra bhava) using classical significators — see childForecast().
// ---------------------------------------------------------------------------

export interface LifeEvent {
  key: string;             // stable id e.g. "marriage"
  label: Bilingual;
  likelihood: ProbBand;
  note: Bilingual;
  detail?: Bilingual;      // extra specifics, e.g. child count/gender
}

interface EventRule {
  key: string;
  label: Bilingual;
  houses: number[];        // bhavas whose activation signals this event
  karakas: number[];       // natural significator planets that strengthen it
}

const EVENT_RULES: EventRule[] = [
  { key: "marriage", label: { ta: "திருமணம்/உறவு", en: "Marriage / relationship", hi: "विवाह / संबंध" }, houses: [7], karakas: [5] },       // Venus
  { key: "career", label: { ta: "தொழில் மாற்றம்/பதவி உயர்வு", en: "Career change / promotion", hi: "करियर परिवर्तन / पदोन्नति" }, houses: [10, 6], karakas: [0, 6] }, // Sun, Saturn
  { key: "childbirth", label: { ta: "குழந்தை பாக்கியம்", en: "Childbirth", hi: "संतान प्राप्ति" }, houses: [5], karakas: [4] },                 // Jupiter
  { key: "property", label: { ta: "வீடு/நிலம்/வாகனம்", en: "Property / vehicle", hi: "संपत्ति / वाहन" }, houses: [4], karakas: [2, 5] },   // Mars, Venus
  { key: "wealth", label: { ta: "பெரிய ஆதாயம்/செல்வம்", en: "Major financial gain", hi: "बड़ा वित्तीय लाभ" }, houses: [2, 11], karakas: [4, 5] }, // Jupiter, Venus
  { key: "foreign", label: { ta: "வெளிநாடு/நீண்ட பயணம்", en: "Foreign travel / relocation", hi: "विदेश / स्थानांतरण" }, houses: [12, 9], karakas: [6, 7] }, // Saturn, Rahu
  { key: "health", label: { ta: "உடல்நல நிகழ்வு", en: "Health event", hi: "स्वास्थ्य घटना" }, houses: [6, 8], karakas: [6, 2] },     // Saturn, Mars
];

// Odd signs (Mesha, Mithuna, Simha, Tula, Dhanus, Kumbha = indices 0,2,4,6,8,10)
// are male/odd; even signs are female/even. Classical child-sign rule uses the
// 5th house sign + its lord + Jupiter to weigh male vs female.
function childForecast(
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
): { count: Bilingual; gender: Bilingual } {
  const fifthSign = (lagnaSign + 4) % 12;
  const fifthLord = RASI_LORDS[fifthSign];
  const jup = natalPlanets.find((p) => p.index === 4); // Guru
  // Count: benefics (Guru, Sukra, Budha, Chandra) aspecting/occupying 5th add;
  // malefics (Sani, Sevvai, Rahu, Ketu, Surya) in 5th reduce. Simplified count.
  const fifthOccupants = natalPlanets.filter(
    (p) => houseFrom(p.rasiIndex, lagnaSign) === 5,
  );
  const benefics = new Set([1, 3, 4, 5]);
  const malefics = new Set([0, 2, 6, 7, 8]);
  let score = 2; // baseline expectation of ~2 children
  for (const p of fifthOccupants) {
    if (benefics.has(p.index)) score += 1;
    if (malefics.has(p.index)) score -= 1;
  }
  // Jupiter (santana karaka) in a kendra/trikona from lagna boosts fertility.
  if (jup) {
    const jh = houseFrom(jup.rasiIndex, lagnaSign);
    if ([1, 4, 5, 7, 9, 10].includes(jh)) score += 1;
  }
  const n = Math.max(0, Math.min(4, score));
  const countLabel: Bilingual =
    n === 0
      ? { ta: "குழந்தை பாக்கியம் தாமதம்/சவால்", en: "children delayed or challenged", hi: "संतान में विलंब/बाधा" }
      : n === 1
      ? { ta: "தோராயமாக 1 குழந்தை", en: "about 1 child", hi: "लगभग 1 संतान" }
      : n >= 3
      ? { ta: `தோராயமாக ${n} குழந்தைகள்`, en: `about ${n} children`, hi: `लगभग ${n} संतानें` }
      : { ta: "தோராயமாக 2 குழந்தைகள்", en: "about 2 children", hi: "लगभग 2 संतानें" };
  // Gender lean: odd 5th sign + male fifth-lord sign leans male; else female.
  const fifthLordSign = natalPlanets.find((p) => p.index === fifthLord)?.rasiIndex ?? fifthSign;
  const oddSign = (s: number) => s % 2 === 0; // index 0,2,4.. = odd rasi (Mesha=1st=odd)
  const maleVotes = (oddSign(fifthSign) ? 1 : 0) + (oddSign(fifthLordSign) ? 1 : 0);
  const genderLabel: Bilingual =
    maleVotes >= 2
      ? { ta: "முதல் குழந்தை ஆண் சாய்வு", en: "first child leans male", hi: "पहली संतान पुत्र की ओर" }
      : maleVotes === 0
      ? { ta: "முதல் குழந்தை பெண் சாய்வு", en: "first child leans female", hi: "पहली संतान पुत्री की ओर" }
      : { ta: "ஆண்/பெண் கலப்பு சாத்தியம்", en: "mixed — could be either", hi: "पुत्र/पुत्री मिश्रित संभावना" };
  return { count: countLabel, gender: genderLabel };
}

function lifeEvents(
  lordIndices: number[],
  disp: Disposition,
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
): LifeEvent[] {
  // Houses activated by the active lords (owned or occupied).
  const activated = new Set<number>();
  for (const idx of lordIndices) {
    for (const h of ownedHouses(idx, lagnaSign)) activated.add(h);
    const natal = natalPlanets.find((p) => p.index === idx);
    if (natal) activated.add(houseFrom(natal.rasiIndex, lagnaSign));
  }
  const lordSet = new Set(lordIndices);
  const out: LifeEvent[] = [];
  for (const rule of EVENT_RULES) {
    const houseHit = rule.houses.some((h) => activated.has(h));
    if (!houseHit) continue;
    const karakaActive = rule.karakas.some((k) => lordSet.has(k));
    // Likelihood: house activated + karaka among lords + favourable period = high.
    let band: ProbBand;
    if (houseHit && karakaActive && disp === "subha") band = "very-likely";
    else if (houseHit && (karakaActive || disp === "subha")) band = "likely";
    else if (disp === "papa") band = "unlikely";
    else band = "even";
    const bandWord: Record<ProbBand, Bilingual> = {
      "very-likely": { ta: "மிக சாத்தியம்", en: "very likely", hi: "अत्यंत संभावित" },
      "likely": { ta: "சாத்தியம்", en: "likely", hi: "संभावित" },
      "even": { ta: "சாத்தியமுண்டு", en: "possible", hi: "संभव" },
      "unlikely": { ta: "குறைவு", en: "less likely", hi: "कम संभावित" },
      "very-unlikely": { ta: "மிகக் குறைவு", en: "unlikely", hi: "असंभावित" },
    };
    const w = bandWord[band];
    const ev: LifeEvent = {
      key: rule.key,
      label: rule.label,
      likelihood: band,
      note: {
        ta: `${rule.label.ta}: ${w.ta}`,
        en: `${rule.label.en}: ${w.en}`,
        hi: `${rule.label.hi ?? rule.label.en}: ${w.hi ?? w.en}`,
      },
    };
    // For a childbirth signal, attach probable count + gender specifics.
    if (rule.key === "childbirth") {
      const cf = childForecast(natalPlanets, lagnaSign);
      ev.detail = {
        ta: `${cf.count.ta}; ${cf.gender.ta}`,
        en: `${cf.count.en}; ${cf.gender.en}`,
        hi: `${cf.count.hi ?? cf.count.en}; ${cf.gender.hi ?? cf.gender.en}`,
      };
    }
    out.push(ev);
  }
  // Only surface the 3 strongest signals to avoid noise.
  const order: Record<ProbBand, number> = { "very-likely": 0, "likely": 1, "even": 2, "unlikely": 3, "very-unlikely": 4 };
  return out.sort((a, b) => order[a.likelihood] - order[b.likelihood]).slice(0, 3);
}

// ---------------------------------------------------------------------------
// WEALTH TIMING — the user wants clear windows of "when you make money" vs
// "when you lose / spend money", with the duration of each window. We read the
// active lords against the DHANA houses (2, 11 = income & gains) and the VYAYA
// houses (12, 8, 6 = expenses, loss, debt), weigh with the period disposition,
// and label the window plus its own length (from the period's start→end).
// ---------------------------------------------------------------------------

export type WealthDir = "gain" | "loss" | "neutral";

export interface WealthWindow {
  direction: WealthDir;
  label: Bilingual;        // e.g. "Money-making window · ~1 yr 2 mo"
  note: Bilingual;         // plain guidance
}

function durationText(start: string, end: string): Bilingual {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalMonths = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
  const yrs = Math.floor(totalMonths / 12);
  const mos = totalMonths % 12;
  const parts_en: string[] = [];
  const parts_ta: string[] = [];
  const parts_hi: string[] = [];
  if (yrs > 0) {
    parts_en.push(`${yrs} yr`);
    parts_ta.push(`${yrs} வருடம்`);
    parts_hi.push(`${yrs} वर्ष`);
  }
  if (mos > 0 || yrs === 0) {
    parts_en.push(`${mos} mo`);
    parts_ta.push(`${mos} மாதம்`);
    parts_hi.push(`${mos} माह`);
  }
  return { ta: parts_ta.join(" "), en: parts_en.join(" "), hi: parts_hi.join(" ") };
}

function wealthWindow(
  lordIndices: number[],
  disp: Disposition,
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
  start: string,
  end: string,
): WealthWindow {
  const GAIN_HOUSES = new Set([2, 11]);     // dhana + labha
  const LOSS_HOUSES = new Set([12, 8, 6]);  // vyaya + randhra + rina
  let gainHits = 0;
  let lossHits = 0;
  for (const idx of lordIndices) {
    const touched = new Set<number>(ownedHouses(idx, lagnaSign));
    const natal = natalPlanets.find((p) => p.index === idx);
    if (natal) touched.add(houseFrom(natal.rasiIndex, lagnaSign));
    for (const h of touched) {
      if (GAIN_HOUSES.has(h)) gainHits++;
      if (LOSS_HOUSES.has(h)) lossHits++;
    }
  }
  // Disposition tilts the call: a benefic period on a gain house is a strong
  // earning window; a malefic period on a loss house is a clear drain window.
  let net = gainHits - lossHits;
  if (disp === "subha") net += 1;
  if (disp === "papa") net -= 1;
  const dur = durationText(start, end);
  let direction: WealthDir;
  let head: Bilingual;
  let note: Bilingual;
  if (net >= 1 && gainHits > 0) {
    direction = "gain";
    head = { ta: "பணம் சேர்க்கும் காலம்", en: "Money-making window", hi: "धन-अर्जन अवधि" };
    note = {
      ta: "வருமானம்/சேமிப்பு உயர வாய்ப்பு — முதலீடு, சம்பாத்தியம் சாதகம்.",
      en: "Good stretch to earn, save and invest — income tends to rise.",
      hi: "आय व बचत बढ़ने की अवधि — निवेश व अर्जन अनुकूल।",
    };
  } else if (net <= -1 && lossHits > 0) {
    direction = "loss";
    head = { ta: "செலவு/இழப்பு காலம்", en: "Spending / loss window", hi: "व्यय / हानि अवधि" };
    note = {
      ta: "பெரிய செலவு/கடன்/இழப்பு சாத்தியம் — புதிய முதலீடு தவிர்க்கவும்.",
      en: "Watch for big expenses, debt or loss — avoid fresh risky investments.",
      hi: "बड़े व्यय/ऋण/हानि की संभावना — नया जोखिमपूर्ण निवेश टालें।",
    };
  } else {
    direction = "neutral";
    head = { ta: "நிலையான பண காலம்", en: "Steady money window", hi: "स्थिर धन अवधि" };
    note = {
      ta: "பெரிய ஏற்ற இறக்கம் இல்லை — சமநிலையான நிதி நிலை.",
      en: "No major swing — finances stay broadly stable.",
      hi: "बड़ा उतार-चढ़ाव नहीं — वित्त सामान्यतः स्थिर।",
    };
  }
  return {
    direction,
    label: {
      ta: `${head.ta} · ~${dur.ta}`,
      en: `${head.en} · ~${dur.en}`,
      hi: `${head.hi ?? head.en} · ~${dur.hi ?? dur.en}`,
    },
    note,
  };
}

// ---- Lifetime foundation (Lagna, Lagna lord, Sani, 8th lord) ----------------
// A one-time natal read that frames the whole life, independent of any running
// dasha. Classical logic: the LAGNA sets the body/self; its LORD carries the
// overall vitality and direction of the life; SANI (Saturn) governs longevity,
// discipline and hardship (ayush karaka); and the 8TH-HOUSE LORD rules the
// span of life, obstacles and hidden turning points. For each we report its
// subhatvam/papatvam and its strength (from dignity points).

// Turn 0..100 dignity points into a strength word.
function strengthWord(points: number): Bilingual {
  if (points >= 85) return { ta: "மிக பலம்", en: "very strong", hi: "अति बलवान" };
  if (points >= 60) return { ta: "பலம்", en: "strong", hi: "बलवान" };
  if (points >= 35) return { ta: "நடுத்தர பலம்", en: "moderate", hi: "मध्यम" };
  if (points >= 15) return { ta: "பலவீனம்", en: "weak", hi: "कमज़ोर" };
  return { ta: "மிக பலவீனம்", en: "very weak", hi: "अति कमज़ोर" };
}

export interface FoundationPillar {
  role: Bilingual;          // e.g. "Lagna lord", "8th lord (longevity)"
  planetIndex: number | null; // null only for the Lagna sign pillar
  planet: Bilingual;        // planet name (or the Lagna sign for the sign pillar)
  ownedHouses: number[];    // houses it owns from Lagna
  natalHouse: number | null;// natal house from Lagna (null for the sign pillar)
  disposition: Disposition; // subhatvam / papatvam / mixed
  strengthPoints: number;   // 0..100
  note: Bilingual;          // full sentence
}

export interface LifetimeFoundation {
  lagnaSign: number;
  lagnaSignName: Bilingual;
  headline: Bilingual;
  pillars: FoundationPillar[]; // Lagna, Lagna lord, Sani, 8th lord
}

function planetPillar(
  role: Bilingual,
  lordIndex: number,
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
): FoundationPillar {
  const natal = natalPlanets.find((p) => p.index === lordIndex)!;
  const nm = GRAHAS[lordIndex];
  const owned = ownedHouses(lordIndex, lagnaSign);
  const natalHouse = houseFrom(natal.rasiIndex, lagnaSign);
  const ruled = natalDispWithRules(lordIndex, natal.rasiIndex, natalHouse, lagnaSign, natal.dignity, natalPlanets);
  const disp = ruled.disp;
  const pts = ruled.points;
  const str = strengthWord(pts);

  const ownedEn = owned.length ? `lord of the ${owned.map(ordEn).join(" & ")}` : "a shadow node (no rulership)";
  const ownedTa = owned.length ? `${owned.map(ordTa).join(", ")} அதிபதி` : "சாயா கிரகம் (அதிபத்தியம் இல்லை)";
  const ownedHi = owned.length ? `${owned.map(ordHi).join(", ")} का स्वामी` : "छाया ग्रह (स्वामित्व नहीं)";

  const pariv = ruled.parivartanaWith !== null ? parivartanaNote(lordIndex, ruled.parivartanaWith, ruled.parivartanaType!, ruled.parivartanaDamaged) : null;
  const dispCl = dispositorClause(lordIndex, ruled.dispositor);
  const specTa = (ruled.special ? ` ${ruled.special.note.ta}` : "") + (pariv ? ` ${pariv.ta}` : "") + (dispCl ? ` ${dispCl.ta}` : "");
  const specEn = (ruled.special ? ` ${ruled.special.note.en}` : "") + (pariv ? ` ${pariv.en}` : "") + (dispCl ? ` ${dispCl.en}` : "");
  const specHi = (ruled.special ? ` ${ruled.special.note.hi ?? ruled.special.note.en}` : "") + (pariv ? ` ${pariv.hi ?? pariv.en}` : "") + (dispCl ? ` ${dispCl.hi ?? dispCl.en}` : "");

  return {
    role,
    planetIndex: lordIndex,
    planet: nm,
    ownedHouses: owned,
    natalHouse,
    disposition: disp,
    strengthPoints: pts,
    note: {
      ta: `${role.ta}: ${nm.ta} — ${ownedTa}, ஜாதகத்தில் ${ordTa(natalHouse)} பாவத்தில்; ${dispWord(disp).ta}, பலம் ${str.ta} (${pts}/100).${specTa}`,
      en: `${role.en}: ${nm.en} — ${ownedEn}, natally in the ${ordEn(natalHouse)} house; ${dispWord(disp).en}, strength ${str.en} (${pts}/100).${specEn}`,
      hi: `${role.hi ?? role.en}: ${nm.hi ?? nm.en} — ${ownedHi}, जन्म में ${ordHi(natalHouse)} भाव में; ${dispWord(disp).hi}, बल ${str.hi} (${pts}/100)।${specHi}`,
    },
  };
}

function buildLifetimeFoundation(
  natalPlanets: PlanetPosition[],
  lagnaSign: number,
): LifetimeFoundation {
  // Lagna lord = ruler of the lagna sign.
  const lagnaLordIndex = RASI_LORDS[lagnaSign];
  // 8th sign from Lagna, and its lord (the longevity / ayush lord).
  const eighthSign = (lagnaSign + 7) % 12;
  const eighthLordIndex = RASI_LORDS[eighthSign];

  const lagnaName = RASIS[lagnaSign];

  const pillars: FoundationPillar[] = [];

  // (1) The Lagna itself (the sign — the body & self).
  pillars.push({
    role: { ta: "லக்னம்", en: "Lagna (Ascendant)", hi: "लग्न" },
    planetIndex: null,
    planet: { ta: lagnaName.ta.split(" (")[0], en: lagnaName.en.split(" (")[0], hi: (RASIS_HI[lagnaSign] ?? lagnaName.en.split(" (")[0]) },
    ownedHouses: [1],
    natalHouse: 1,
    disposition: "mixed",
    strengthPoints: 50,
    note: {
      ta: `லக்னம்: ${lagnaName.ta.split(" (")[0]} — உடல், சுயம், வாழ்நாள் மொத்தத்தின் அடித்தளம்; அதிபதி ${GRAHAS[lagnaLordIndex].ta}.`,
      en: `Lagna: ${lagnaName.en.split(" (")[0]} — the body, the self, the base of the whole life; its lord is ${GRAHAS[lagnaLordIndex].en}.`,
      hi: `लग्न: ${RASIS_HI[lagnaSign] ?? lagnaName.en.split(" (")[0]} — शरीर, स्वयं व सम्पूर्ण जीवन का आधार; इसका स्वामी ${GRAHAS[lagnaLordIndex].hi ?? GRAHAS[lagnaLordIndex].en}।`,
    },
  });

  // (2) The Lagna lord — vitality & direction of the life.
  pillars.push(planetPillar(
    { ta: "லக்னாதிபதி (வாழ்வின் இயக்கி)", en: "Lagna lord (life-force)", hi: "लग्नेश (जीवन-शक्ति)" },
    lagnaLordIndex, natalPlanets, lagnaSign,
  ));

  // (3) Sani (Saturn) — ayush karaka: longevity, discipline, hardship.
  pillars.push(planetPillar(
    { ta: "சனி (ஆயுள்/ஒழுக்கம்)", en: "Sani / Saturn (longevity & discipline)", hi: "शनि (आयु व अनुशासन)" },
    6, natalPlanets, lagnaSign,
  ));

  // (4) 8th-house lord — span of life, obstacles, turning points.
  pillars.push(planetPillar(
    { ta: "8-ம் அதிபதி (ஆயுள்/மறைமுகம்)", en: "8th lord (life-span & hidden turns)", hi: "अष्टमेश (आयु व गुप्त मोड़)" },
    eighthLordIndex, natalPlanets, lagnaSign,
  ));

  // Overall lifetime headline from the four pillars (skip the sign pillar's neutral 50).
  const scored = pillars.filter((p) => p.planetIndex !== null);
  const score = scored.reduce((a, p) => a + (p.disposition === "subha" ? 1 : p.disposition === "papa" ? -1 : 0), 0);
  const life: Disposition = score >= 2 ? "subha" : score <= -2 ? "papa" : "mixed";
  const headline: Bilingual = life === "subha"
    ? { ta: "வாழ்நாள் அடித்தளம்: வலிமையானது — லக்னம், லக்னாதிபதி, சனி, 8-ம் அதிபதி பெரும்பாலும் சாதகம்.",
        en: "Lifetime foundation: strong — Lagna, Lagna lord, Saturn and the 8th lord are largely favourable.",
        hi: "जीवन-आधार: सशक्त — लग्न, लग्नेश, शनि व अष्टमेश अधिकांशतः अनुकूल।" }
    : life === "papa"
    ? { ta: "வாழ்நாள் அடித்தளம்: கவனம் தேவை — அடிப்படைத் தூண்கள் பலவீனம்/பாபத்துவம் காட்டுகின்றன.",
        en: "Lifetime foundation: needs care — the core pillars lean weak or afflicted.",
        hi: "जीवन-आधार: सतर्कता आवश्यक — मूल स्तंभ कमज़ोर/प्रतिकूल हैं।" }
    : { ta: "வாழ்நாள் அடித்தளம்: கலப்பு — சில தூண்கள் வலிமை, சில பலவீனம்.",
        en: "Lifetime foundation: mixed — some pillars are strong, others weak.",
        hi: "जीवन-आधार: मिश्रित — कुछ स्तंभ सशक्त, कुछ कमज़ोर।" };

  return { lagnaSign, lagnaSignName: lagnaName, headline, pillars };
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
  lifetime: LifetimeFoundation; // Lagna, Lagna lord, Sani, 8th lord — the natal frame of the whole life
  timeline: TimelinePeriod[];   // Bhukti windows across the full lifetime (birth → +100y), current one expanded to Antara
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

  // ---- Timeline: full lifetime (birth → +100 years) -----------------------
  // The user wants a lifetime prediction: every Bhukti period from the birth
  // year through 100 years after birth — not just a 5-year horizon. The client
  // defaults the visible window to 1990 and lets the user reveal the older
  // 1900–1990 periods on demand.
  const HISTORY_FLOOR = Date.UTC(1900, 0, 1); // Jan 1, 1900 (never render older)
  const birthMs = dasha.periods.length ? dasha.periods[0].start.getTime() : t;
  const HUNDRED_YEARS = 100 * 365.25 * 24 * 3600 * 1000;
  const winStart = Math.max(HISTORY_FLOOR, birthMs);
  const winEnd = birthMs + HUNDRED_YEARS;

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
            probability: probabilityFromScore(score, 9),
            lifeAreaCalls: lifeAreaCalls([md.lordIndex, bd.lordIndex, ad.lordIndex], disp, natalPlanets, lagnaSign),
            lifeEvents: lifeEvents([md.lordIndex, bd.lordIndex, ad.lordIndex], disp, natalPlanets, lagnaSign),
            wealthTiming: wealthWindow([md.lordIndex, bd.lordIndex, ad.lordIndex], disp, natalPlanets, lagnaSign, fmt(ad.start), fmt(ad.end)),
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
          probability: probabilityFromScore(score, 6),
          lifeAreaCalls: lifeAreaCalls([md.lordIndex, bd.lordIndex], disp, natalPlanets, lagnaSign),
          lifeEvents: lifeEvents([md.lordIndex, bd.lordIndex], disp, natalPlanets, lagnaSign),
          wealthTiming: wealthWindow([md.lordIndex, bd.lordIndex], disp, natalPlanets, lagnaSign, fmt(bd.start), fmt(bd.end)),
        });
      }
    }
  }

  timeline.sort((a, b) => a.start.localeCompare(b.start));

  const lifetime = buildLifetimeFoundation(natalPlanets, lagnaSign);

  return {
    now: fmt(now),
    running,
    doubleTransit,
    overall,
    overallHeadline,
    lifetime,
    timeline,
    disclaimer: {
      ta: "இது விம்சோத்தரி தசை + கோச்சார (குரு/சனி உள்பட) கிளாசிக்கல் விதிகளின் அடிப்படையிலான பொதுவான வழிகாட்டுதல்; உறுதியான கணிப்பு அல்ல. முக்கிய முடிவுகளுக்கு அனுபவமிக்க ஜோதிடரை அணுகவும்.",
      en: "This is general guidance built from classical Vimshottari dasha + gochara (including Jupiter/Saturn) rules — not a guaranteed prediction. Consult an experienced astrologer for major decisions.",
      hi: "यह शास्त्रीय विम्शोत्तरी दशा + गोचर (गुरु/शनि सहित) नियमों पर आधारित सामान्य मार्गदर्शन है — निश्चित भविष्यवाणी नहीं। महत्वपूर्ण निर्णयों हेतु अनुभवी ज्योतिषी से परामर्श लें।",
    },
  };
}
