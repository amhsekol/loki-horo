// ======================= Vimshottari Dasha =============================
// Computes the nested Vimshottari timeline from the Moon's sidereal
// longitude at birth:
//   Level 1: Maha Dasha (main period)
//   Level 2: Bhukti / Antardasha (sub-period)
//   Level 3: Antharam / Pratyantardasha (sub-sub-period)
//   Level 4: Sookshma Dasha (sub-sub-sub-period)
// Each node carries start date, end date and duration.

import type { Bilingual } from "./constants";
import { GRAHAS } from "./constants";

// Vimshottari lord sequence (by GRAHAS index) and their period lengths in years.
// Order: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury
export const DASHA_SEQUENCE: number[] = [8, 5, 0, 1, 2, 7, 4, 6, 3];
export const DASHA_YEARS: Record<number, number> = {
  8: 7,   // Ketu
  5: 20,  // Venus
  0: 6,   // Sun
  1: 10,  // Moon
  2: 7,   // Mars
  7: 18,  // Rahu
  4: 16,  // Jupiter
  6: 19,  // Saturn
  3: 17,  // Mercury
};
export const TOTAL_DASHA_YEARS = 120;

// Average tropical-year length in days (Vimshottari convention uses 365.25).
const DAYS_PER_YEAR = 365.25;
const NAK_SPAN = 360 / 27; // 13°20' per nakshatra

export interface DashaNode {
  lordIndex: number;      // GRAHAS index of the ruling planet
  lord: Bilingual;        // bilingual name
  start: Date;
  end: Date;
  durationDays: number;
  durationMonths: number; // convenience: days / 30.4375
  children?: DashaNode[]; // next level down (undefined at deepest level)
}

// Position of `startLord` within the sequence.
function seqStartFrom(lordIndex: number): number[] {
  const pos = DASHA_SEQUENCE.indexOf(lordIndex);
  const out: number[] = [];
  for (let i = 0; i < DASHA_SEQUENCE.length; i++) {
    out.push(DASHA_SEQUENCE[(pos + i) % DASHA_SEQUENCE.length]);
  }
  return out;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setTime(r.getTime() + days * 24 * 60 * 60 * 1000);
  return r;
}

function mkNode(lordIndex: number, start: Date, durationDays: number, children?: DashaNode[]): DashaNode {
  return {
    lordIndex,
    lord: GRAHAS[lordIndex],
    start,
    end: addDays(start, durationDays),
    durationDays,
    durationMonths: durationDays / 30.4375,
    children,
  };
}

// Build the nested sub-periods for a parent period of `parentDays` starting
// at `parentStart`, beginning the sub-sequence from `startLord`.
// `depth` counts remaining levels to expand (0 = leaf, no children).
function buildSubPeriods(
  parentStart: Date,
  parentDays: number,
  startLord: number,
  depth: number,
): DashaNode[] {
  const seq = seqStartFrom(startLord);
  const nodes: DashaNode[] = [];
  let cursor = new Date(parentStart.getTime());
  for (const lord of seq) {
    const subDays = parentDays * (DASHA_YEARS[lord] / TOTAL_DASHA_YEARS);
    const children = depth > 0 ? buildSubPeriods(cursor, subDays, lord, depth - 1) : undefined;
    nodes.push(mkNode(lord, cursor, subDays, children));
    cursor = addDays(cursor, subDays);
  }
  return nodes;
}

export interface DashaTimeline {
  startLord: number;         // lord of the first (birth) Maha Dasha
  balanceYears: number;      // remaining years of the birth Maha Dasha at birth
  periods: DashaNode[];      // Maha Dashas, each with nested children
}

/**
 * Compute the full Vimshottari timeline.
 * @param moonSiderealLon  Moon's sidereal longitude at birth (0..360)
 * @param birth            birth moment as a JS Date (local civil time is fine — we only use it as an epoch offset)
 * @param depth            nesting depth: 1=Maha+Bhukti, 2=+Antharam, 3=+Sookshma (default 3)
 * @param cycles           how many 120-year cycles to generate (default 1 → covers full 120y ≥ 100y)
 */
export function computeDasha(
  moonSiderealLon: number,
  birth: Date,
  depth: number = 3,
  cycles: number = 1,
): DashaTimeline {
  const nakIndex = Math.floor(moonSiderealLon / NAK_SPAN) % 27;
  const posInNak = moonSiderealLon - nakIndex * NAK_SPAN; // 0..NAK_SPAN
  const fractionElapsed = posInNak / NAK_SPAN;            // 0..1 of the birth nakshatra

  // Starting lord = lord of the Moon's nakshatra (nakIndex % 9 into the sequence).
  const startLord = DASHA_SEQUENCE[nakIndex % 9];
  const startLordFullYears = DASHA_YEARS[startLord];
  const balanceYears = startLordFullYears * (1 - fractionElapsed);

  // The birth Maha Dasha's true start is *before* birth (since part elapsed).
  // elapsed portion in days:
  const elapsedDays = startLordFullYears * fractionElapsed * DAYS_PER_YEAR;
  const firstDashaTrueStart = addDays(birth, -elapsedDays);

  const periods: DashaNode[] = [];
  let cursor = new Date(firstDashaTrueStart.getTime());

  // The Maha Dasha sequence starting from startLord, repeated `cycles` times.
  const fullSeq = seqStartFrom(startLord);
  for (let c = 0; c < cycles; c++) {
    for (const lord of fullSeq) {
      const dashaDays = DASHA_YEARS[lord] * DAYS_PER_YEAR;
      const children = depth > 0 ? buildSubPeriods(cursor, dashaDays, lord, depth - 1) : undefined;
      periods.push(mkNode(lord, cursor, dashaDays, children));
      cursor = addDays(cursor, dashaDays);
    }
  }

  return { startLord, balanceYears, periods };
}
