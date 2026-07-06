// KN Rao (Jaimini + special-technique) module.
// Implements the concepts KN Rao popularised across his books:
//   1. Jaimini Chara Karakas (7 movable significators, ranked by longitude-in-sign)
//   2. Chara Dasha (Jaimini sign-based dasha) — his signature predictive tool
//   3. Bhrigu Bindu (Moon + Rahu midpoint destiny point)
//   4. Special Lagnas (Hora, Ghatika) + Arudha Lagna + Karakamsa (AK in navamsa)
//
// All inputs are sidereal (Lahiri) — same as the rest of the engine.

import { RASIS, GRAHAS, NAKSHATRAS, RASI_LORDS, type Bilingual } from "./constants";

const norm360 = (x: number) => ((x % 360) + 360) % 360;
const signOf = (lon: number) => Math.floor(norm360(lon) / 30) % 12;
const degInSign = (lon: number) => norm360(lon) - signOf(lon) * 30;

// ---------------------------------------------------------------------------
// 1. CHARA KARAKAS
// ---------------------------------------------------------------------------
// 7 planets (Sun..Saturn) compete; the one with the highest degree-within-sign
// is Atmakaraka, next Amatyakaraka, and so on. (KN Rao uses the 7-karaka scheme;
// Rahu is sometimes included in the 8-karaka scheme but the classic 7 is standard.)

export interface CharaKaraka {
  role: Bilingual;      // Atmakaraka, etc.
  roleShort: string;    // AK, AmK, ...
  planetIndex: number;  // 0..6
  planet: Bilingual;
  degInSign: number;    // longitude within its sign
  signIndex: number;
  sign: Bilingual;
  meaning: Bilingual;   // what this karaka signifies
}

const KARAKA_ROLES: { role: Bilingual; short: string; meaning: Bilingual }[] = [
  { role: { ta: "ஆத்மகாரகன்", en: "Atmakaraka" }, short: "AK", meaning: { ta: "ஆன்மா, சுயம், வாழ்க்கையின் நோக்கம்", en: "Soul, self, life's central purpose" } },
  { role: { ta: "அமாத்யகாரகன்", en: "Amatyakaraka" }, short: "AmK", meaning: { ta: "தொழில், அறிவு, ஆலோசகர்", en: "Career, intellect, the counsellor" } },
  { role: { ta: "பிராத்ருகாரகன்", en: "Bhratrikaraka" }, short: "BK", meaning: { ta: "உடன்பிறந்தோர், தைரியம்", en: "Siblings, courage, gurus" } },
  { role: { ta: "மாத்ருகாரகன்", en: "Matrikaraka" }, short: "MK", meaning: { ta: "தாய், மனம், கல்வி", en: "Mother, mind, education" } },
  { role: { ta: "புத்ரகாரகன்", en: "Putrakaraka" }, short: "PK", meaning: { ta: "குழந்தைகள், படைப்பாற்றல்", en: "Children, creativity, intelligence" } },
  { role: { ta: "ஞாதிகாரகன்", en: "Gnatikaraka" }, short: "GK", meaning: { ta: "எதிரிகள், நோய், போட்டி", en: "Enemies, disease, obstacles" } },
  { role: { ta: "தாராகாரகன்", en: "Darakaraka" }, short: "DK", meaning: { ta: "வாழ்க்கைத் துணை, கூட்டாண்மை", en: "Spouse, partnerships" } },
];

/** planetLons: sidereal longitudes for planets 0..6 (Sun..Saturn). */
export function computeCharaKarakas(planetLons: number[]): CharaKaraka[] {
  const arr = [0, 1, 2, 3, 4, 5, 6].map((idx) => ({
    idx,
    deg: degInSign(planetLons[idx]),
    sign: signOf(planetLons[idx]),
  }));
  // Rank by degree-in-sign descending.
  arr.sort((a, b) => b.deg - a.deg);
  return arr.map((p, rank) => ({
    role: KARAKA_ROLES[rank].role,
    roleShort: KARAKA_ROLES[rank].short,
    planetIndex: p.idx,
    planet: GRAHAS[p.idx],
    degInSign: p.deg,
    signIndex: p.sign,
    sign: RASIS[p.sign],
    meaning: KARAKA_ROLES[rank].meaning,
  }));
}

// ---------------------------------------------------------------------------
// 2. CHARA DASHA (Jaimini)
// ---------------------------------------------------------------------------
// Direction: from the Lagna sign, count is forward (zodiacal) if the lagna sign
// is odd-footed (Aries, Taurus, Gemini, Libra, Scorpio, Sagittarius — i.e.
// signs 0,1,2 and 6,7,8) ... KN Rao/Jaimini rule:
//   - For a movable/odd sign set the count is direct; even the count is reverse.
// The standard Jaimini rule (as taught by KN Rao):
//   Direct if the lagna is an odd sign (Ar,Ge,Le,Li,Sg,Aq -> 0,2,4,6,8,10)? 
// We use the widely used KN-Rao convention:
//   Sequence is DIRECT (zodiacal) when the Lagna sign lord placement makes it
//   an "odd" sign counted as Aries=1 odd. Practically: direct for odd signs
//   (Ar,Ge,Le,Li,Sg,Aq), reverse for even signs (Ta,Cn,Vi,Sc,Cp,Pi).
//
// Duration of each sign = (distance from the sign to its lord) in years:
//   count from the sign to the sign occupied by its lord.
//   - direct sign: count forward; reverse sign: count backward.
//   duration = (count - 1) years; if lord is in the sign itself -> 12 years;
//   special: exaltation/debilitation adjustments are omitted for clarity.

const ODD_SIGNS = new Set([0, 2, 4, 6, 8, 10]); // Ar,Ge,Le,Li,Sg,Aq

function countForward(from: number, to: number): number {
  return ((to - from + 12) % 12) + 1; // 1..12, inclusive both ends
}
function countBackward(from: number, to: number): number {
  return ((from - to + 12) % 12) + 1;
}

/** Chara Dasha years for a single sign given the sign of its lord. */
function charaYears(sign: number, lordSign: number): number {
  const direct = ODD_SIGNS.has(sign);
  const c = direct ? countForward(sign, lordSign) : countBackward(sign, lordSign);
  // count includes both endpoints; duration = count - 1; lord in own sign -> 12.
  const yrs = c - 1;
  return yrs === 0 ? 12 : yrs;
}

export interface CharaDashaPeriod {
  signIndex: number;
  sign: Bilingual;
  years: number;
  startAge: number;   // age at start (years from birth)
  startYear: number;  // calendar year (from birth year)
}

/**
 * Build the Chara Dasha sequence starting at the Lagna sign.
 * planetSigns: sign index (0..11) for planets 0..8 (needed to find each sign's lord's sign).
 * Dual-lord signs (Sc: Mars/Ketu, Aq: Saturn/Rahu) use the primary planetary lord.
 */
export function computeCharaDasha(
  lagnaSign: number,
  planetSigns: number[],
  birthYear: number,
): CharaDashaPeriod[] {
  const direct = ODD_SIGNS.has(lagnaSign);
  const order: number[] = [];
  for (let i = 0; i < 12; i++) {
    order.push(direct ? (lagnaSign + i) % 12 : ((lagnaSign - i) % 12 + 12) % 12);
  }
  const periods: CharaDashaPeriod[] = [];
  let age = 0;
  for (const sign of order) {
    const lordPlanet = RASI_LORDS[sign];
    const lordSign = planetSigns[lordPlanet];
    const years = charaYears(sign, lordSign);
    periods.push({
      signIndex: sign,
      sign: RASIS[sign],
      years,
      startAge: age,
      startYear: birthYear + Math.floor(age),
    });
    age += years;
  }
  return periods;
}

// ---------------------------------------------------------------------------
// 3. BHRIGU BINDU
// ---------------------------------------------------------------------------
// The midpoint of the Moon and Rahu longitudes. KN Rao treats it as a sensitive
// "destiny point": transits and dashas activating it bring turning points.

export interface BhriguBindu {
  lon: number;
  signIndex: number;
  sign: Bilingual;
  degInSign: number;
  nakshatraIndex: number;
  nakshatra: Bilingual;
  houseFromLagna: number;
}

const NAK_SPAN = 360 / 27;

export function computeBhriguBindu(moonLon: number, rahuLon: number, lagnaSign: number): BhriguBindu {
  // Midpoint along the shorter arc from Moon to Rahu.
  let diff = norm360(rahuLon - moonLon);
  if (diff > 180) diff -= 360;
  const lon = norm360(moonLon + diff / 2);
  const sign = signOf(lon);
  return {
    lon,
    signIndex: sign,
    sign: RASIS[sign],
    degInSign: degInSign(lon),
    nakshatraIndex: Math.floor(lon / NAK_SPAN) % 27,
    nakshatra: NAKSHATRAS[Math.floor(lon / NAK_SPAN) % 27],
    houseFromLagna: ((sign - lagnaSign + 12) % 12) + 1,
  };
}

// ---------------------------------------------------------------------------
// 4. SPECIAL LAGNAS + KARAKAMSA
// ---------------------------------------------------------------------------
// Hora Lagna & Ghatika Lagna are time-based sensitive points used by KN Rao for
// wealth (HL) and power/authority (GL) timing. Arudha Lagna (AL) is the "image"
// or perceived self. Karakamsa = the navamsa sign of the Atmakaraka (spiritual
// and career signature).

export interface SpecialLagnas {
  horaLagnaSign: number;
  horaLagna: Bilingual;
  ghatikaLagnaSign: number;
  ghatikaLagna: Bilingual;
  arudhaLagnaSign: number;
  arudhaLagna: Bilingual;
  karakamsaSign: number;   // navamsa sign of Atmakaraka
  karakamsa: Bilingual;
  karakamsaPlanet: Bilingual; // the Atmakaraka planet
}

/**
 * Hora Lagna: from sunrise, advances one sign per HALF the ascensional rate —
 * classically 1 sign per 2.5 ghatis; a common formulation:
 *   HL = sunrise-ascendant-longitude + (hours since sunrise) * 30 / (approx).
 * We use the widely-used simplified rule: HL advances 1 rasi every 1 hour from
 * the Lagna at sunrise... To stay accurate with the data we have (the natal
 * ascendant longitude and time-of-day), we compute HL and GL from the elapsed
 * time since sunrise in ghatis:
 *   Hora Lagna: 1 sign per 1 ghati? -> classical HL = 1 sign / 2.5 ghatikas.
 * Because reliable sunrise math already lives in the panchangam path, here we
 * take a pragmatic approach used in many programs:
 *   HL advances from the natal Lagna by (elapsedGhatis / 2.5) signs.
 *   GL advances from the natal Lagna by (elapsedGhatis / 1.25) signs.
 * elapsedGhatis is derived from hoursSinceSunrise (1 ghati = 24 min).
 */
export function computeSpecialLagnas(
  lagnaLon: number,
  lagnaSign: number,
  hoursSinceSunrise: number,
  arudhaLagnaSign: number,
  atmakarakaPlanetIndex: number,
  atmakarakaNavamsaSign: number,
): SpecialLagnas {
  const elapsedGhatis = (hoursSinceSunrise * 60) / 24; // 1 ghati = 24 min
  // Hora Lagna: 1 sign per 2.5 ghatis (from natal lagna longitude).
  const hlSign = signOf(lagnaLon + (elapsedGhatis / 2.5) * 30);
  // Ghatika Lagna: 1 sign per 1.25 ghatis.
  const glSign = signOf(lagnaLon + (elapsedGhatis / 1.25) * 30);
  return {
    horaLagnaSign: hlSign,
    horaLagna: RASIS[hlSign],
    ghatikaLagnaSign: glSign,
    ghatikaLagna: RASIS[glSign],
    arudhaLagnaSign,
    arudhaLagna: RASIS[arudhaLagnaSign],
    karakamsaSign: atmakarakaNavamsaSign,
    karakamsa: RASIS[atmakarakaNavamsaSign],
    karakamsaPlanet: GRAHAS[atmakarakaPlanetIndex],
  };
}

/**
 * Arudha Lagna: count from Lagna to its lord; project the same count from the
 * lord's sign. Exceptions: if AL falls in the 1st or 7th from Lagna, shift by 10.
 */
export function computeArudhaLagna(lagnaSign: number, planetSigns: number[]): number {
  const lord = RASI_LORDS[lagnaSign];
  const lordSign = planetSigns[lord];
  const count = ((lordSign - lagnaSign + 12) % 12); // 0-based distance L -> lord
  let al = (lordSign + count) % 12;
  // Exception: AL cannot be in 1st or 7th from lagna -> use 10th from that sign.
  const houseFromLagna = ((al - lagnaSign + 12) % 12) + 1;
  if (houseFromLagna === 1 || houseFromLagna === 7) {
    al = (al + 9) % 12; // 10th sign from al
  }
  return al;
}

export interface KNRaoResult {
  charaKarakas: CharaKaraka[];
  charaDasha: CharaDashaPeriod[];
  charaDashaDirection: "direct" | "reverse";
  bhriguBindu: BhriguBindu;
  specialLagnas: SpecialLagnas;
}
