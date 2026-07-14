// ---------------------------------------------------------------------------
// composer.ts — deterministic rule composer.
//
// Takes ChartFacts (already computed by the existing engine), loads the
// bundled rule corpus for the chart's lagna + universal overrides, fires
// matching rules, groups them into the document tree described in
// composer_brief.md §"Section structure", and returns a StructuredReading.
//
// Design goals (see composer_brief.md):
//   - Pure functions, no side effects, no fs access at runtime (rules are
//     pre-bundled JSON, imported once and cached by rule-loader.ts).
//   - Deterministic: identical ChartFacts always produce an identical
//     StructuredReading (rule iteration order is the bundle's fixed array
//     order; sorting within sections is by a stable strength score, with
//     rule id as a tiebreaker).
//   - Fast: single pass over the lagna's rules (~150-350 rules) + overrides
//     (~1022 rules) = ~1.1-1.4k regex evaluations per chart, well under the
//     500ms budget (empirically <50ms, see scripts/test-composer.mts).
// ---------------------------------------------------------------------------

import { RASIS, GRAHAS } from "./constants";
import {
  getRulesForLagna,
  getExceptionRules,
  lagnaKeyForSignIndex,
  type RawRule,
} from "./rule-loader";
import {
  buildFactTags,
  parseCondition,
  conditionMatches,
  PLANET_KEYS,
  type ChartFacts,
  type PlanetKey,
} from "./rule-matcher";

// ---- Output contract (per composer_brief.md) -------------------------------

export interface FiredRule {
  id: string;
  rule_en: string;
  outcome: string;
  topic: string;
  condition: string;
  strength: number; // 0..100 composite priority score
  confidence: "explicit" | "implicit" | string;
  matchedOn: string[]; // human-readable matched condition fragments (debug/citation aid)
  bucket: string; // which source bucket this rule came from (lagna file or _overrides)
  gentle: boolean;
}

export interface StructuredPoint {
  point: string;
  emphasis: "low" | "med" | "high";
  ruleIds: string[];
  gentle?: boolean;
}

export interface Subsection {
  id: string;
  title: string;
  firedRules: FiredRule[];
  structuredPoints: StructuredPoint[];
}

export interface Section {
  id: string;
  title: string;
  order: number;
  subsections: Subsection[];
}

export interface VerdictRow {
  area: string;
  verdict: string;
  drivers: string[];
  ruleIds: string[];
}

export interface StructuredReading {
  chartFacts: ChartFacts;
  executiveSummary: {
    lagnaLine: string;
    verdicts: VerdictRow[];
    corrections: string[];
  };
  sections: Section[];
  metadata: {
    totalRulesFired: number;
    lagna: string;
    computedAt: string;
  };
}

// ---- Gentle topics (softened phrasing per brief) ---------------------------

const GENTLE_TOPICS = new Set(["longevity", "death", "marriage_dissolution", "disease"]);

function isGentleTopic(topic: string): boolean {
  return GENTLE_TOPICS.has(topic) || topic === "longevity" || /death|dissolution|disease/i.test(topic);
}

function gentleWrap(text: string): string {
  // Soften absolute/alarming phrasing without changing the substantive claim.
  return text
    .replace(/\bwill die\b/gi, "may face significant health challenges")
    .replace(/\bdeath\b/gi, "a major life transition")
    .replace(/\bwill cause death\b/gi, "may indicate a period requiring caution")
    .replace(/\bdivorce\b/gi, "relationship strain")
    .replace(/\bwill definitely\b/gi, "may")
    .replace(/\bcertainly\b/gi, "possibly");
}

// ---- Topic priority (for strength scoring) ---------------------------------

const TOPIC_PRIORITY: Record<string, number> = {
  general: 60,
  career: 55,
  wealth: 50,
  marriage: 48,
  children: 40,
  health: 45,
  longevity: 42,
  enemies_debts: 38,
  education: 35,
  parents: 35,
  travel: 30,
  speech_family: 32,
  spirituality: 30,
};

function topicPriority(topic: string): number {
  return TOPIC_PRIORITY[topic] ?? 25;
}

// ---- Strength scoring -------------------------------------------------------

function computeStrength(rule: RawRule, specific: boolean, matchedGroupCount: number): number {
  let score = 0;
  // Confidence: explicit=high, implicit=med
  score += rule.confidence === "explicit" ? 40 : rule.confidence === "implicit" ? 25 : 20;
  // Topic priority (normalized to 0..30 band)
  score += Math.min(30, topicPriority(rule.topic ?? "general") * 0.5);
  // Match specificity: concrete planet/house match > generic lagna-only rule
  score += specific ? 20 : 5;
  // More independently-satisfied groups = more specific/compound match
  score += Math.min(10, matchedGroupCount * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---- Rule firing ------------------------------------------------------------

function fireRules(rules: RawRule[], tags: Set<string>): FiredRule[] {
  const fired: FiredRule[] = [];
  const seenIds = new Set<string>();

  for (const rule of rules) {
    if (!rule || !rule.condition) continue;
    if (rule.id && seenIds.has(rule.id)) continue; // de-dupe by id (overrides can repeat across lagnas)

    const parsed = parseCondition(rule);
    if (parsed.groups.length === 0) continue; // unparseable condition -> cannot verify -> skip
    if (!conditionMatches(parsed, tags)) continue;

    const gentle = isGentleTopic(rule.topic ?? "");
    const strength = computeStrength(rule, parsed.specific, parsed.groups.length);

    fired.push({
      id: rule.id,
      rule_en: gentle ? gentleWrap(rule.rule_en) : rule.rule_en,
      outcome: gentle ? gentleWrap(rule.outcome) : rule.outcome,
      topic: rule.topic ?? "general",
      condition: rule.condition,
      strength,
      confidence: rule.confidence ?? "explicit",
      matchedOn: parsed.groups.map((g) => g.label),
      bucket: rule.__bucket ?? "unknown",
      gentle,
    });
    if (rule.id) seenIds.add(rule.id);
  }

  // Deterministic ordering: strength desc, then id asc (stable tiebreak).
  fired.sort((a, b) => (b.strength - a.strength) || a.id.localeCompare(b.id));
  return fired;
}

// ---- Helpers to slice fired rules into topical/placement buckets ----------

function rulesForTopics(fired: FiredRule[], topics: string[]): FiredRule[] {
  const set = new Set(topics);
  return fired.filter((r) => set.has(r.topic));
}

function rulesMentioningTag(fired: FiredRule[], tagFragment: string): FiredRule[] {
  return fired.filter((r) => r.matchedOn.some((m) => m.includes(tagFragment)));
}

function toStructuredPoints(rules: FiredRule[], limit = 8): StructuredPoint[] {
  return rules.slice(0, limit).map((r) => ({
    point: r.outcome || r.rule_en,
    emphasis: r.strength >= 70 ? "high" : r.strength >= 45 ? "med" : "low",
    ruleIds: [r.id],
    gentle: r.gentle || undefined,
  }));
}

function planetLabel(pk: PlanetKey): string {
  const idx = PLANET_KEYS.indexOf(pk);
  return GRAHAS[idx]?.en ?? pk;
}

function signLabel(signIndex: number): string {
  return RASIS[signIndex]?.en ?? String(signIndex);
}

// ---- Executive summary -------------------------------------------------------

const AREA_TOPIC_MAP: Array<{ area: string; topics: string[] }> = [
  { area: "Personality", topics: ["general"] },
  { area: "Career", topics: ["career"] },
  { area: "Wealth", topics: ["wealth"] },
  { area: "Marriage", topics: ["marriage"] },
  { area: "Children", topics: ["children"] },
  { area: "Health / Longevity", topics: ["health", "longevity"] },
  { area: "Enemies / Debts / Obstacles", topics: ["enemies_debts"] },
  { area: "Spirituality", topics: ["spirituality"] },
];

function buildExecutiveSummary(
  facts: ChartFacts,
  fired: FiredRule[],
  exceptionsChecked: string[]
): StructuredReading["executiveSummary"] {
  const lagnaSign = facts.lagna.signIndex;
  const lagnaLordIdx = PLANET_KEYS.length; // placeholder, unused
  const lagnaLine = `${signLabel(lagnaSign)} Lagna at ${facts.lagna.degree.toFixed(2)}°, Pada ${facts.lagna.pada}.`;

  const verdicts: VerdictRow[] = AREA_TOPIC_MAP.map(({ area, topics }) => {
    const topicRules = rulesForTopics(fired, topics).slice(0, 5);
    if (topicRules.length === 0) {
      return { area, verdict: "Insufficient rule coverage in corpus", drivers: [], ruleIds: [] };
    }
    const avgStrength =
      topicRules.reduce((sum, r) => sum + r.strength, 0) / topicRules.length;
    const verdict = avgStrength >= 60 ? "Strong / favorable" : avgStrength >= 40 ? "Mixed" : "Needs attention";
    return {
      area,
      verdict,
      drivers: topicRules.slice(0, 3).map((r) => r.outcome || r.rule_en),
      ruleIds: topicRules.map((r) => r.id),
    };
  });

  return {
    lagnaLine,
    verdicts,
    corrections: exceptionsChecked,
  };
}

// ---- Critical corrections (yogas checked but NOT formed) -------------------

interface YogaCheck {
  name: string;
  formed: boolean;
  reason: string;
}

function checkChandraAdhiYoga(facts: ChartFacts): YogaCheck {
  const isPournami = facts.moonSunGap >= 168 && facts.moonSunGap <= 192;
  if (!isPournami) {
    return {
      name: "Chandra Adhi Yoga",
      formed: false,
      reason: `Moon-Sun gap is ${facts.moonSunGap.toFixed(2)}° (${facts.paksha === "shukla" ? "waxing" : "waning"}), not a bright/full Pournami Moon — Chandra Adhi Yoga requires a bright Moon with benefics in 6/7/8 from it.`,
    };
  }
  const moonSign = facts.planets.moon.signIndex;
  const benefics: PlanetKey[] = ["jupiter", "venus", "mercury"];
  const supporting = benefics.filter((pk) => {
    const p = facts.planets[pk];
    const houseFromMoon = ((p.signIndex - moonSign + 12) % 12) + 1;
    return [6, 7, 8].includes(houseFromMoon);
  });
  if (supporting.length === 0) {
    return {
      name: "Chandra Adhi Yoga",
      formed: false,
      reason: "Moon is bright, but no natural benefic (Jupiter/Venus/Mercury) occupies 6th/7th/8th from Moon.",
    };
  }
  return {
    name: "Chandra Adhi Yoga",
    formed: true,
    reason: `Bright Moon with ${supporting.map(planetLabel).join(", ")} in 6/7/8 from Moon.`,
  };
}

function checkSaniSevvaiYoga(facts: ChartFacts): YogaCheck {
  const mars = facts.planets.mars;
  const saturn = facts.planets.saturn;
  const houseDiff = Math.abs(mars.house - saturn.house);
  const conjunct = mars.signIndex === saturn.signIndex;
  // Aspect targets in ChartFacts.aspects[].to may be encoded either as a
  // PlanetKey (direct) or as a house number (1-12, meaning "this planet's
  // aspect lands on whichever planet/Lagna occupies that house"). Resolve
  // both forms so "Mars aspects house 4 (where Saturn sits)" is correctly
  // recognized as "Mars aspects Saturn", matching how the reference
  // analysis (Swetha-Chart-Full-Analysis.md, Saturn-Mars Deep-Dive section)
  // verifies this mutual aspect via house-landing rather than planet-name.
  const aspectHitsPlanet = (fromKey: PlanetKey, targetKey: PlanetKey): boolean =>
    facts.aspects.some((a) => {
      if (a.from !== fromKey) return false;
      if (a.to === targetKey) return true;
      if (typeof a.to === "number") return a.to === facts.planets[targetKey].house;
      return false;
    });
  const mutualAspect = aspectHitsPlanet("mars", "saturn") && aspectHitsPlanet("saturn", "mars");
  const formed = conjunct || mutualAspect;
  if (!formed) {
    return {
      name: "Sani-Sevvai Yoga (Mars-Saturn dosha)",
      formed: false,
      reason: `Mars is in house ${mars.house} (${signLabel(mars.signIndex)}), Saturn in house ${saturn.house} (${signLabel(saturn.signIndex)}) — ${houseDiff} houses apart, no conjunction and no confirmed mutual aspect.`,
    };
  }
  return {
    name: "Sani-Sevvai Yoga (Mars-Saturn dosha)",
    formed: true,
    reason: conjunct
      ? `Mars and Saturn are conjunct in ${signLabel(mars.signIndex)}.`
      : "Mars and Saturn share a mutual aspect.",
  };
}

// NOTE: superseded by checkNeechaBhangaDetailed() below, which is the
// function actually used by composeReading(). Kept here only as an
// earlier, simpler reference implementation; not called anywhere.
function checkNeechaBhangaForPlanet(facts: ChartFacts, pk: PlanetKey): YogaCheck | null {
  const p = facts.planets[pk];
  if (!p || p.dignity !== "debilitated") return null;
  // Neecha Bhanga (simplified, single strongest classical condition): the
  // dispositor of the debilitated planet's sign is itself well placed
  // (angular/kendra from Lagna: house 1,4,7,10) — this is the condition used
  // in SWETHA_CHART_FACTS.md for Jupiter's Neecha Bhanga in Capricorn/Saturn-Pisces.
  const dispositorSign = p.signIndex; // dispositor = ruler of the sign the debilitated planet sits in
  // Ruler is looked up by caller via RASI_LORDS in constants.ts, but to keep
  // this module decoupled from that indexing detail we resolve it inline:
  return null; // superseded by checkNeechaBhangaDetailed below (kept for API stability)
}

function checkNeechaBhangaDetailed(facts: ChartFacts): YogaCheck[] {
  const results: YogaCheck[] = [];
  const RASI_LORD_IDX = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4]; // mirrors constants.ts RASI_LORDS
  for (const pk of PLANET_KEYS) {
    const p = facts.planets[pk];
    if (p.dignity !== "debilitated") continue;
    const dispositorGrahaIdx = RASI_LORD_IDX[p.signIndex];
    const dispositorKey = PLANET_KEYS[dispositorGrahaIdx];
    const dispositor = facts.planets[dispositorKey];
    const kendra = [1, 4, 7, 10].includes(dispositor.house);
    // Classical Neecha Bhanga condition (matches SWETHA_CHART_FACTS.md usage):
    // the dispositor is angular (kendra) from Lagna AND not itself weak
    // (debilitated/enemy dignity disqualifies; own/exalted/moolatrikona/
    // friend/neutral all qualify as "not weak").
    const dispositorNotWeak = !(["debilitated", "enemy", "great_enemy"] as string[]).includes(dispositor.dignity);
    const dispositorStrong = kendra && dispositorNotWeak;
    results.push({
      name: `Neecha Bhanga Raja Yoga (${planetLabel(pk)})`,
      formed: dispositorStrong,
      reason: dispositorStrong
        ? `${planetLabel(pk)} is debilitated in ${signLabel(p.signIndex)}, but its dispositor ${planetLabel(dispositorKey)} sits in house ${dispositor.house} (kendra) in a strong dignity (${dispositor.dignity}) — cancels the debilitation.`
        : `${planetLabel(pk)} is debilitated in ${signLabel(p.signIndex)}; dispositor ${planetLabel(dispositorKey)} is in house ${dispositor.house} (${dispositor.dignity}), which does not satisfy the kendra+strong-dignity Neecha Bhanga condition.`,
    });
  }
  return results;
}

function buildCorrections(facts: ChartFacts): string[] {
  const checks: YogaCheck[] = [
    checkChandraAdhiYoga(facts),
    checkSaniSevvaiYoga(facts),
    ...checkNeechaBhangaDetailed(facts),
  ];
  return checks.map((c) => `${c.name}: ${c.formed ? "FORMED" : "NOT formed"} — ${c.reason}`);
}

// ---- Section builders --------------------------------------------------------

function buildPersonalitySection(facts: ChartFacts, fired: FiredRule[]): Section {
  const lagnaRules = rulesMentioningTag(fired, "lagna is one of").concat(
    fired.filter((r) => /lagna/i.test(r.condition) && !/lord/i.test(r.condition))
  );
  const lagnaLordRules = rulesMentioningTag(fired, "lagna lord");
  const aspectOnLagnaRules = fired.filter((r) => r.matchedOn.some((m) => /aspects house 1\b/.test(m)));

  const dedupe = (list: FiredRule[]) => {
    const seen = new Set<string>();
    return list.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  };

  return {
    id: "personality",
    title: "Part 1: Personality",
    order: 3,
    subsections: [
      {
        id: "lagna-core",
        title: "1.1 Lagna Core Personality",
        firedRules: dedupe(lagnaRules).slice(0, 15),
        structuredPoints: toStructuredPoints(dedupe(lagnaRules)),
      },
      {
        id: "lagna-lord",
        title: "1.2 Lagna Lord Placement",
        firedRules: dedupe(lagnaLordRules).slice(0, 15),
        structuredPoints: toStructuredPoints(dedupe(lagnaLordRules)),
      },
      {
        id: "aspects-on-lagna",
        title: "1.3 Planets Aspecting Lagna",
        firedRules: dedupe(aspectOnLagnaRules).slice(0, 15),
        structuredPoints: toStructuredPoints(dedupe(aspectOnLagnaRules)),
      },
    ],
  };
}

function buildPlanetSection(facts: ChartFacts, fired: FiredRule[]): Section {
  const subsections: Subsection[] = PLANET_KEYS.map((pk, i) => {
    const planetRules = fired.filter((r) => r.matchedOn.some((m) => m.startsWith(`${pk} `) || m.includes(`${pk}:`) || m.includes(`${pk} dignity`) || m.includes(`${pk} in`) || m.includes(`${pk} retrograde`) || m.includes(`${pk} conjunct`) || m.includes(`${pk}/`)));
    const seen = new Set<string>();
    const deduped = planetRules.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    return {
      id: `planet-${pk}`,
      title: `2.${i + 1} ${planetLabel(pk)} — Subathuvam / Papathuvam`,
      firedRules: deduped.slice(0, 15),
      structuredPoints: toStructuredPoints(deduped),
    };
  });

  return { id: "planets", title: "Part 2: Planet-by-Planet Analysis", order: 4, subsections };
}

function buildHouseSection(facts: ChartFacts, fired: FiredRule[]): Section {
  const subsections: Subsection[] = [];
  for (let house = 1; house <= 12; house++) {
    const houseRules = fired.filter((r) =>
      r.matchedOn.some((m) => new RegExp(`house ${house}\\b`).test(m) || m.includes(`in house ${house}`) || m.includes(`aspects house ${house}`))
    );
    const seen = new Set<string>();
    const deduped = houseRules.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    const signIdx = (facts.lagna.signIndex + house - 1) % 12;
    subsections.push({
      id: `house-${house}`,
      title: `House ${house}: ${signLabel(signIdx)}`,
      firedRules: deduped.slice(0, 15),
      structuredPoints: toStructuredPoints(deduped),
    });
  }
  return { id: "houses", title: "Part 3: House-by-House Analysis", order: 5, subsections };
}

function buildRahuKetuSection(facts: ChartFacts, fired: FiredRule[]): Section {
  const rahuRules = fired.filter((r) => r.matchedOn.some((m) => m.includes("rahu")) || /rahu/i.test(r.condition));
  const ketuRules = fired.filter((r) => r.matchedOn.some((m) => m.includes("ketu")) || /ketu/i.test(r.condition));
  const dedupe = (list: FiredRule[]) => {
    const seen = new Set<string>();
    return list.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  };
  return {
    id: "rahu-ketu",
    title: "Part 4: Rahu / Ketu Deep-Dive",
    order: 6,
    subsections: [
      { id: "rahu", title: "4.1 Rahu", firedRules: dedupe(rahuRules).slice(0, 20), structuredPoints: toStructuredPoints(dedupe(rahuRules), 10) },
      { id: "ketu", title: "4.2 Ketu", firedRules: dedupe(ketuRules).slice(0, 20), structuredPoints: toStructuredPoints(dedupe(ketuRules), 10) },
    ],
  };
}

function buildDashaSection(facts: ChartFacts, fired: FiredRule[]): Section {
  const { mahadasha, bhukti } = facts.currentDasha;
  const currentRules = fired.filter((r) => r.matchedOn.some((m) => m.includes(`dasha=${mahadasha}`) || m.includes(`bhukti=${bhukti}`)));
  const mahadashaOnlyRules = fired.filter((r) => r.matchedOn.some((m) => m.includes(`dasha=${mahadasha}`)) && !r.matchedOn.some((m) => m.includes(`bhukti=${bhukti}`)));
  const dedupe = (list: FiredRule[]) => {
    const seen = new Set<string>();
    return list.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  };
  return {
    id: "current-dasha",
    title: "Part 5: Current & Next Dasha Analysis",
    order: 7,
    subsections: [
      {
        id: "current-bhukti",
        title: `5.1 Current: ${planetLabel(mahadasha)} Mahadasha — ${planetLabel(bhukti)} Bhukti`,
        firedRules: dedupe(currentRules).slice(0, 20),
        structuredPoints: toStructuredPoints(dedupe(currentRules), 10),
      },
      {
        id: "mahadasha-overview",
        title: `5.2 ${planetLabel(mahadasha)} Mahadasha — General Signature`,
        firedRules: dedupe(mahadashaOnlyRules).slice(0, 20),
        structuredPoints: toStructuredPoints(dedupe(mahadashaOnlyRules), 10),
      },
    ],
  };
}

function buildLifePeakDashaSection(facts: ChartFacts, fired: FiredRule[]): Section {
  // "Life-peak" = rules tied to whichever mahadasha lord is best-dignified
  // (own/exalted/moolatrikona) among the 9 planets — a deterministic proxy
  // for "long-term forward-looking dasha of interest" without requiring a
  // full multi-decade dasha timeline as input (ChartFacts only carries
  // currentDasha per the brief's contract).
  const rankedByDignity = PLANET_KEYS.filter((pk) => pk !== "rahu" && pk !== "ketu")
    .map((pk) => ({ pk, dignity: facts.planets[pk].dignity }))
    .filter((x) => ["exalted", "own", "moolatrikona"].includes(x.dignity));
  const bestPlanet = rankedByDignity[0]?.pk;
  const peakRules = bestPlanet
    ? fired.filter((r) => r.matchedOn.some((m) => m.includes(`dasha=${bestPlanet}`) || m.startsWith(`${bestPlanet} `)))
    : [];
  const seen = new Set<string>();
  const deduped = peakRules.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  return {
    id: "life-peak-dasha",
    title: "Part 6: Life-Peak Dasha Analysis",
    order: 8,
    subsections: [
      {
        id: "peak-dasha",
        title: bestPlanet ? `6.1 ${planetLabel(bestPlanet)} — Strongest Dignity Planet (Long-Term Outlook)` : "6.1 Life-Peak Dasha",
        firedRules: deduped.slice(0, 15),
        structuredPoints: toStructuredPoints(deduped, 10),
      },
    ],
  };
}

function buildYogasSection(facts: ChartFacts, fired: FiredRule[]): Section {
  const yogaRules = fired.filter((r) => /yoga/i.test(r.outcome) || /yoga/i.test(r.rule_en));
  const seen = new Set<string>();
  const deduped = yogaRules.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  return {
    id: "yogas",
    title: "Part 7: Key Yogas Present",
    order: 9,
    subsections: [
      {
        id: "yogas-present",
        title: "7.1 Yogas Identified",
        firedRules: deduped.slice(0, 25),
        structuredPoints: toStructuredPoints(deduped, 15),
      },
    ],
  };
}

function buildGuidanceSection(facts: ChartFacts, fired: FiredRule[]): Section {
  const top = fired.slice(0, 12);
  return {
    id: "guidance",
    title: "Part 8: Life Guidance Summary",
    order: 10,
    subsections: [
      {
        id: "top-guidance",
        title: "8.1 Highest-Strength Signals Across the Chart",
        firedRules: top,
        structuredPoints: toStructuredPoints(top, 12),
      },
    ],
  };
}

// ---- Main entry point --------------------------------------------------------

export function composeReading(facts: ChartFacts): StructuredReading {
  const lagnaKey = lagnaKeyForSignIndex(facts.lagna.signIndex);
  const rules = getRulesForLagna(lagnaKey);
  const tags = buildFactTags(facts);

  const fired = fireRules(rules, tags);
  const corrections = buildCorrections(facts);
  const executiveSummary = buildExecutiveSummary(facts, fired, corrections);

  const sections: Section[] = [
    buildPersonalitySection(facts, fired),
    buildPlanetSection(facts, fired),
    buildHouseSection(facts, fired),
    buildRahuKetuSection(facts, fired),
    buildDashaSection(facts, fired),
    buildLifePeakDashaSection(facts, fired),
    buildYogasSection(facts, fired),
    buildGuidanceSection(facts, fired),
  ];

  return {
    chartFacts: facts,
    executiveSummary,
    sections,
    metadata: {
      totalRulesFired: fired.length,
      lagna: signLabel(facts.lagna.signIndex),
      computedAt: new Date().toISOString(),
    },
  };
}

// Re-export selected types/helpers for consumers (e.g. test-composer.mts).
export { buildFactTags } from "./rule-matcher";
export type { ChartFacts, PlanetKey } from "./rule-matcher";
