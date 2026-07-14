/**
 * Bridge: existing engine.ts + guruji-analysis.ts output  →  composer's ChartFacts shape.
 *
 * The composer (composer.ts) needs a normalized ChartFacts object with per-planet
 * dignity, house, aspects, current dasha, and the derived Subathuvam/Papathuvam
 * BAND. About 12% of the rule corpus keys conditions on that derived band, so
 * without it, ~278 rules never fire.
 *
 * This adapter wires the existing computed chart into that shape without
 * modifying any of the validated engine files.
 */

import type { ChartResult, PlanetPosition } from "./engine";
import type { GurujiAnalysis } from "./guruji-analysis";
import type { DashaNode, DashaTimeline } from "./dasha";
import type { ChartFacts, PlanetFacts, PlanetKey, AspectFacts } from "./rule-matcher";
import { RASI_LORDS } from "./constants";

// Planet index (as used by engine.ts) → composer's PlanetKey.
// engine indexes: 0=Sun, 1=Moon, 2=Mars, 3=Mercury, 4=Jupiter, 5=Venus, 6=Saturn, 7=Rahu, 8=Ketu
const IDX_TO_KEY: Record<number, PlanetKey> = {
  0: "sun",
  1: "moon",
  2: "mars",
  3: "mercury",
  4: "jupiter",
  5: "venus",
  6: "saturn",
  7: "rahu",
  8: "ketu",
};

const KEY_TO_IDX: Record<PlanetKey, number> = Object.fromEntries(
  Object.entries(IDX_TO_KEY).map(([k, v]) => [v, Number(k)])
) as Record<PlanetKey, number>;

/**
 * Compute house number of a sign relative to the lagna (1-indexed, whole-sign).
 */
function houseOfSign(signIndex: number, lagnaIndex: number): number {
  return ((signIndex - lagnaIndex + 12) % 12) + 1;
}

/**
 * Compute Vedic whole-sign aspects thrown by each planet.
 * Every planet aspects the 7th house from itself.
 * Mars additionally aspects 4th and 8th.
 * Jupiter additionally aspects 5th and 9th.
 * Saturn additionally aspects 3rd and 10th.
 * Rahu/Ketu are treated as aspecting the 7th (some schools include 5/9);
 * we include just the 7th to stay conservative.
 */
const SPECIAL_ASPECT_HOUSES: Record<number, number[]> = {
  2: [4, 7, 8],   // Mars
  4: [5, 7, 9],   // Jupiter
  6: [3, 7, 10],  // Saturn
};

function aspectHousesFor(planetIdx: number): number[] {
  return SPECIAL_ASPECT_HOUSES[planetIdx] ?? [7];
}

function buildAspects(
  planets: PlanetPosition[],
  lagnaIndex: number,
): AspectFacts[] {
  const out: AspectFacts[] = [];
  // Map house → planets in that house
  const houseOccupants = new Map<number, PlanetKey[]>();
  for (const p of planets) {
    const key = IDX_TO_KEY[p.index];
    if (!key) continue;
    const h = houseOfSign(p.rasiIndex, lagnaIndex);
    if (!houseOccupants.has(h)) houseOccupants.set(h, []);
    houseOccupants.get(h)!.push(key);
  }

  for (const p of planets) {
    const from = IDX_TO_KEY[p.index];
    if (!from) continue;
    const fromHouse = houseOfSign(p.rasiIndex, lagnaIndex);
    for (const offset of aspectHousesFor(p.index)) {
      const targetHouse = ((fromHouse - 1 + offset - 1) % 12) + 1;
      const typeMap: Record<number, AspectFacts["type"]> = {
        3: "3rd", 4: "4th", 5: "5th", 7: "7th", 8: "8th", 9: "9th", 10: "10th",
      };
      const type = typeMap[offset];
      if (!type) continue;

      // Aspect on the house itself
      out.push({ from, to: targetHouse, type });

      // Aspect on any planet occupying that house
      const occ = houseOccupants.get(targetHouse) ?? [];
      for (const to of occ) {
        if (to === from) continue;
        out.push({ from, to, type });
      }
    }
  }
  return out;
}

/**
 * Map an engine dignity label to the composer's dignity enum.
 */
function mapDignity(
  dignityLabel: string | undefined,
  planetIdx: number,
  signIndex: number,
): PlanetFacts["dignity"] {
  const l = (dignityLabel ?? "").toLowerCase();
  if (l.includes("uccha") || l.includes("exalt")) return "exalted";
  if (l.includes("neecha") || l.includes("debilit")) return "debilitated";
  if (l.includes("moolatrikona") || l.includes("mula")) return "moolatrikona";
  if (l.includes("swakshetra") || l.includes("own")) return "own";
  if (l.includes("mitra") || l.includes("friend")) return "friend";
  if (l.includes("shatru") || l.includes("enemy")) {
    if (l.includes("great") || l.includes("adhi")) return "great_enemy";
    return "enemy";
  }
  // Fallback: compute from sign lordship
  const lord = RASI_LORDS?.[signIndex];
  if (lord === planetIdx) return "own";
  return "neutral";
}

/**
 * Extract per-planet subathuvamBand from guruji-analysis output.
 * The composer accepts an optional "subathuvam" | "papathuvam" | "neutral" band.
 * We map guruji's ValuBand (high/medium/low/afflicted) into that trichotomy.
 */
function mapGurujiBand(band: "high" | "medium" | "low" | "afflicted"): PlanetFacts["subathuvamBand"] {
  if (band === "high") return "subathuvam";
  if (band === "medium") return "subathuvam";
  if (band === "afflicted") return "papathuvam";
  return "neutral";
}

export interface AdapterOptions {
  /** Native's name — carried into the reading. */
  nativeName?: string;
  /** Reading date (defaults to now). */
  readingDate?: Date;
}

/**
 * Convert a fully-computed ChartResult (+ optional Guruji verdict) into ChartFacts.
 */
export function toChartFacts(
  chart: ChartResult,
  gurujiAnalysis?: GurujiAnalysis,
  opts: AdapterOptions = {},
): ChartFacts {
  const lagnaIndex = chart.lagna.rasiIndex;
  const gurujiBandByIdx = new Map<number, PlanetFacts["subathuvamBand"]>();
  if (gurujiAnalysis) {
    for (const p of gurujiAnalysis.planets) {
      gurujiBandByIdx.set(p.index, mapGurujiBand(p.band));
    }
  }

  const planets: Partial<Record<PlanetKey, PlanetFacts>> = {};
  for (const p of chart.planets) {
    const key = IDX_TO_KEY[p.index];
    if (!key) continue;
    const pf: PlanetFacts = {
      signIndex: p.rasiIndex,
      degree: p.siderealLon - p.rasiIndex * 30,
      house: houseOfSign(p.rasiIndex, lagnaIndex),
      nakshatra: p.nakshatraIndex,
      pada: (p.pada as 1 | 2 | 3 | 4),
      retrograde: !!p.retrograde,
      dignity: mapDignity(p.dignity?.label?.en, p.index, p.rasiIndex),
      subathuvamBand: gurujiBandByIdx.get(p.index),
    };
    planets[key] = pf;
  }

  const aspects = buildAspects(chart.planets, lagnaIndex);

  // Paksha: shukla if Moon is 0..180° ahead of Sun.
  const sun = chart.planets.find((x) => x.index === 0)!;
  const moon = chart.planets.find((x) => x.index === 1)!;
  const gap = (moon.siderealLon - sun.siderealLon + 360) % 360;
  const paksha: ChartFacts["paksha"] = gap <= 180 ? "shukla" : "krishna";
  const moonSunGap = gap <= 180 ? gap : 360 - gap;

  // Current dasha — walk the nested timeline to find the maha+bhukti
  // whose window contains readingDate.
  const readingDate = opts.readingDate ?? new Date();
  const currentDasha = findCurrentDasha(chart.dasha as DashaTimeline | undefined, readingDate);

  const facts: ChartFacts = {
    lagna: {
      signIndex: lagnaIndex,
      degree: chart.lagna.degInRasi,
      nakshatra: 0, // filled below
      pada: (chart.lagna.pada as 1 | 2 | 3 | 4),
    },
    planets: planets as Record<PlanetKey, PlanetFacts>,
    aspects,
    paksha,
    moonSunGap,
    currentDasha,
  };

  // Fill lagna nakshatra index (engine already computes it)
  const lagnaSid = chart.lagna.siderealLon;
  const NAK_SPAN = 360 / 27;
  facts.lagna.nakshatra = Math.floor(lagnaSid / NAK_SPAN) % 27;

  return facts;
}

/**
 * Walk the dasha timeline and return the currently active Maha+Bhukti window.
 */
function findCurrentDasha(
  timeline: DashaTimeline | undefined,
  now: Date,
): ChartFacts["currentDasha"] {
  const emptyDasha: ChartFacts["currentDasha"] = {
    mahadasha: "sun",
    bhukti: "sun",
    from: now.toISOString(),
    to: now.toISOString(),
  };
  if (!timeline || !timeline.periods) return emptyDasha;
  const nowMs = now.getTime();
  const maha = timeline.periods.find(
    (n) => n.start.getTime() <= nowMs && n.end.getTime() > nowMs,
  );
  if (!maha) return emptyDasha;
  const bhukti = maha.children?.find(
    (n) => n.start.getTime() <= nowMs && n.end.getTime() > nowMs,
  );
  const mahaKey = IDX_TO_KEY[maha.lordIndex];
  const bhuktiKey = bhukti ? IDX_TO_KEY[bhukti.lordIndex] : mahaKey;
  if (!mahaKey || !bhuktiKey) return emptyDasha;
  return {
    mahadasha: mahaKey,
    bhukti: bhuktiKey,
    from: (bhukti ? bhukti.start : maha.start).toISOString(),
    to: (bhukti ? bhukti.end : maha.end).toISOString(),
  };
}
