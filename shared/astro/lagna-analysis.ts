// Lagna (ascendant) analysis for the dashboard.
// - Planets occupying the Lagna (whole-sign; plus a tight-orb "conjunct the ascendant point" flag)
// - Planets aspecting the Lagna via full graha drishti (7th for all; +4/8 Mars, +5/9 Jupiter, +3/10 Saturn)
// - The Lagna lord: where it sits, its conjunctions (with degree gaps), and which planets aspect it
//
// Planet indices (GRAHAS): 0=Surya 1=Chandra 2=Sevvai 3=Budha 4=Guru 5=Sukra 6=Sani 7=Rahu 8=Ketu
// Rasi indices (RASIS):    0=Mesha .. 11=Meena

import type { Bilingual } from "./constants";
import { GRAHAS, RASIS, RASI_LORDS } from "./constants";
import type { PlanetPosition } from "./engine";
import type { DignityResult } from "./dignity";

// Special whole-sign aspects (houses ahead, counting the planet's own sign as 1).
// The 7th aspect is universal. Rahu/Ketu are treated like the 7th only here (a common
// simplification; some schools give them Jupiter-like 5/9 — we keep the standard 7th).
const SPECIAL_ASPECTS: Record<number, number[]> = {
  0: [7],          // Surya
  1: [7],          // Chandra
  2: [4, 7, 8],    // Sevvai (Mars): 4th, 7th, 8th
  3: [7],          // Budha
  4: [5, 7, 9],    // Guru (Jupiter): 5th, 7th, 9th
  5: [7],          // Sukra
  6: [3, 7, 10],   // Sani (Saturn): 3rd, 7th, 10th
  7: [7],          // Rahu
  8: [7],          // Ketu
};

// Ordinal house label for an aspect distance (1..12).
export function houseOrdinal(n: number): Bilingual {
  const ta = `${n}-ஆம் பார்வை`;
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return { ta, en: `${n}${suffix} aspect` };
}

// Signed shortest angular gap between two longitudes, in degrees (0..180).
export function angularGap(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// How many signs from sign A to sign B, counting A as 1 (Vedic house count, 1..12).
function houseCount(fromSign: number, toSign: number): number {
  return ((toSign - fromSign + 12) % 12) + 1;
}

export interface PlanetInLagna {
  index: number;
  name: Bilingual;
  degInRasi: number;
  retrograde: boolean;
  dignity: DignityResult | null;
  // Distance in degrees from the exact ascendant point (for the "too close" secondary flag).
  gapFromAscDeg: number;
  tightConjunction: boolean; // within CONJ_ORB of the ascendant point
}

export interface AspectToLagna {
  index: number;
  name: Bilingual;
  fromSign: Bilingual;
  aspectHouse: number;      // 3,4,5,7,8,9,10
  aspectLabel: Bilingual;
  dignity: DignityResult | null;
}

export interface LordConjunction {
  index: number;
  name: Bilingual;
  sameSign: boolean;
  gapDeg: number;           // shortest angular gap to the lord
  tight: boolean;           // within CONJ_ORB
  dignity: DignityResult | null;
}

export interface LagnaLordInfo {
  index: number;
  name: Bilingual;
  sign: Bilingual;
  signIndex: number;
  degInRasi: number;
  retrograde: boolean;
  dignity: DignityResult | null;
  houseFromLagna: number;   // which house (1..12) the lord occupies from Lagna
  conjunctions: LordConjunction[];
  aspectedBy: AspectToLagna[]; // planets aspecting the lord's sign
}

export interface LagnaAnalysis {
  lagnaSign: Bilingual;
  lagnaSignIndex: number;
  lagnaDeg: number;         // degrees within the sign
  lordIndex: number;
  planetsInLagna: PlanetInLagna[];
  aspectsToLagna: AspectToLagna[];
  lord: LagnaLordInfo;
}

// Orb (degrees) within which a same-sign pairing is flagged as a tight conjunction.
export const CONJ_ORB = 8;

// Does planet p (in sign pSign) cast an aspect onto targetSign? If so, which house-distance.
function aspectHouseOnto(pIndex: number, pSign: number, targetSign: number): number | null {
  const dist = houseCount(pSign, targetSign);
  const list = SPECIAL_ASPECTS[pIndex] ?? [7];
  return list.includes(dist) ? dist : null;
}

export function analyzeLagna(
  lagnaSignIndex: number,
  lagnaSid: number,
  planets: PlanetPosition[],
): LagnaAnalysis {
  const lagnaDeg = lagnaSid - lagnaSignIndex * 30;
  const lordIndex = RASI_LORDS[lagnaSignIndex];

  // Planets occupying the Lagna sign.
  const planetsInLagna: PlanetInLagna[] = planets
    .filter((p) => p.rasiIndex === lagnaSignIndex)
    .map((p) => {
      const gap = angularGap(p.siderealLon, lagnaSid);
      return {
        index: p.index,
        name: p.name,
        degInRasi: p.degInRasi,
        retrograde: p.retrograde,
        dignity: p.dignity,
        gapFromAscDeg: gap,
        tightConjunction: gap <= CONJ_ORB,
      };
    })
    .sort((a, b) => a.degInRasi - b.degInRasi);

  // Planets aspecting the Lagna sign (exclude planets sitting in it).
  const aspectsToLagna: AspectToLagna[] = planets
    .filter((p) => p.rasiIndex !== lagnaSignIndex)
    .map((p) => {
      const h = aspectHouseOnto(p.index, p.rasiIndex, lagnaSignIndex);
      return h == null
        ? null
        : {
            index: p.index,
            name: p.name,
            fromSign: p.rasi,
            aspectHouse: h,
            aspectLabel: houseOrdinal(h),
            dignity: p.dignity,
          };
    })
    .filter((x): x is AspectToLagna => x != null)
    .sort((a, b) => a.aspectHouse - b.aspectHouse);

  // The Lagna lord.
  const lordPlanet = planets.find((p) => p.index === lordIndex)!;
  const lordSign = lordPlanet.rasiIndex;

  const conjunctions: LordConjunction[] = planets
    .filter((p) => p.index !== lordIndex && p.rasiIndex === lordSign)
    .map((p) => {
      const gap = angularGap(p.siderealLon, lordPlanet.siderealLon);
      return {
        index: p.index,
        name: p.name,
        sameSign: true,
        gapDeg: gap,
        tight: gap <= CONJ_ORB,
        dignity: p.dignity,
      };
    })
    .sort((a, b) => a.gapDeg - b.gapDeg);

  const aspectedBy: AspectToLagna[] = planets
    .filter((p) => p.index !== lordIndex && p.rasiIndex !== lordSign)
    .map((p) => {
      const h = aspectHouseOnto(p.index, p.rasiIndex, lordSign);
      return h == null
        ? null
        : {
            index: p.index,
            name: p.name,
            fromSign: p.rasi,
            aspectHouse: h,
            aspectLabel: houseOrdinal(h),
            dignity: p.dignity,
          };
    })
    .filter((x): x is AspectToLagna => x != null)
    .sort((a, b) => a.aspectHouse - b.aspectHouse);

  const lord: LagnaLordInfo = {
    index: lordIndex,
    name: GRAHAS[lordIndex],
    sign: RASIS[lordSign],
    signIndex: lordSign,
    degInRasi: lordPlanet.degInRasi,
    retrograde: lordPlanet.retrograde,
    dignity: lordPlanet.dignity,
    houseFromLagna: houseCount(lagnaSignIndex, lordSign),
    conjunctions,
    aspectedBy,
  };

  return {
    lagnaSign: RASIS[lagnaSignIndex],
    lagnaSignIndex,
    lagnaDeg,
    lordIndex,
    planetsInLagna,
    aspectsToLagna,
    lord,
  };
}
