#!/usr/bin/env -S npx tsx
// ---------------------------------------------------------------------------
// test-composer.mts — runs the rule composer against the two known
// reference charts (Lokesh, Swetha) and prints a coverage report comparing
// fired rules against the hand-written reference analyses.
//
// Usage: tsx scripts/test-composer.mts
// ---------------------------------------------------------------------------

import { composeReading } from "../shared/astro/composer";
import { verifyAllLagnasPresent, getBundleMeta } from "../shared/astro/rule-loader";
import type { ChartFacts } from "../shared/astro/rule-matcher";

// ---- Chart fixtures --------------------------------------------------------
// Facts transcribed from:
//   /home/user/workspace/rules_ingest/out/deep_analysis/CHART_FACTS.md (Lokesh)
//   /home/user/workspace/rules_ingest/out/deep_analysis/SWETHA_CHART_FACTS.md (Swetha)

// Sign indices (RASIS order in constants.ts): 0 Mesha,1 Rishaba,2 Mithuna,
// 3 Kataka,4 Simha,5 Kanni,6 Thula,7 Viruchiga,8 Dhanusu,9 Makara,10 Kumba,11 Meena

const LOKESH: ChartFacts = {
  lagna: { signIndex: 2, degree: 18.767, nakshatra: 5 /* Ardra */, pada: 4 },
  planets: {
    // subathuvamBand values transcribed from the reference doc's stated
    // "Verdict:" line for each planet (Lokesh-Chart-Full-Analysis.md §2.1-2.9).
    // "Mixed" verdicts are mapped to "neutral" (no clean subathuvam/papathuvam
    // dominance per the reference author's own framing).
    sun: { signIndex: 0, degree: 25.50, house: 11, nakshatra: 1 /* Bharani-ish region, approx */, pada: 4, retrograde: false, dignity: "exalted", subathuvamBand: "subathuvam" },
    moon: { signIndex: 0, degree: 19.57, house: 11, nakshatra: 1 /* Bharani */, pada: 3, retrograde: false, dignity: "neutral", subathuvamBand: "neutral" },
    mars: { signIndex: 11, degree: 25.80, house: 10, nakshatra: 26 /* Revati */, pada: 4, retrograde: false, dignity: "friend", subathuvamBand: "neutral" },
    mercury: { signIndex: 1, degree: 6.81, house: 12, nakshatra: 3 /* Rohini */, pada: 2, retrograde: false, dignity: "friend", subathuvamBand: "subathuvam" },
    jupiter: { signIndex: 6, degree: 14.77, house: 5, nakshatra: 15 /* Vishakha */, pada: 2, retrograde: true, dignity: "enemy", subathuvamBand: "papathuvam" },
    venus: { signIndex: 1, degree: 23.10, house: 12, nakshatra: 4 /* Mrigashira */, pada: 3, retrograde: false, dignity: "own", subathuvamBand: "subathuvam" },
    saturn: { signIndex: 10, degree: 17.08, house: 9, nakshatra: 23 /* Shatabhisha */, pada: 2, retrograde: false, dignity: "moolatrikona", subathuvamBand: "subathuvam" },
    rahu: { signIndex: 7, degree: 0.48, house: 6, nakshatra: 16 /* Anuradha */, pada: 1, retrograde: true, dignity: "neutral", subathuvamBand: "subathuvam" },
    ketu: { signIndex: 1, degree: 0.48, house: 12, nakshatra: 3 /* Rohini */, pada: 1, retrograde: true, dignity: "neutral", subathuvamBand: "neutral" },
  },
  aspects: [
    { from: "mars", to: 1, type: "4th" }, // Mars aspects Lagna (house 1) via its 4th aspect
    { from: "jupiter", to: 1, type: "9th" }, // Jupiter aspects Lagna via 9th aspect
    { from: "saturn", to: 3, type: "7th" },
    { from: "mars", to: 4, type: "7th" },
    { from: "jupiter", to: 5, type: "5th" }, // self-occupied house counts in some rule phrasing
    { from: "mars", to: 5, type: "8th" },
    { from: "saturn", to: 6, type: "10th" },
    { from: "jupiter", to: 9, type: "5th" },
    { from: "jupiter", to: 11, type: "7th" },
    { from: "saturn", to: 11, type: "3rd" },
    { from: "rahu", to: 12, type: "7th" },
  ],
  paksha: "krishna",
  moonSunGap: 5.93,
  currentDasha: { mahadasha: "mars", bhukti: "venus", from: "2025-11-22", to: "2027-01-22" },
};

const SWETHA: ChartFacts = {
  lagna: { signIndex: 8, degree: 12.383, nakshatra: 18 /* Mula */, pada: 4 },
  planets: {
    // subathuvamBand values transcribed from Swetha-Chart-Full-Analysis.md
    // §2.1-2.9 "Verdict:" lines. Jupiter's "Neecha-Bhanga-Cancelled" verdict
    // (weak-to-strong arc) is mapped to "neutral" here rather than
    // "subathuvam", since the reference doc itself frames it as starting
    // weak (-2) and only rising to strong later — the Neecha Bhanga status
    // is separately and correctly captured by checkNeechaBhangaDetailed()
    // in composer.ts rather than by this coarse band.
    sun: { signIndex: 7, degree: 2.01, house: 12, nakshatra: 15 /* Vishakha */, pada: 4, retrograde: false, dignity: "friend", subathuvamBand: "subathuvam" },
    moon: { signIndex: 2, degree: 17.95, house: 7, nakshatra: 5 /* Ardra */, pada: 4, retrograde: false, dignity: "friend", subathuvamBand: "neutral" },
    mars: { signIndex: 8, degree: 12.92, house: 1, nakshatra: 18 /* Mula */, pada: 4, retrograde: false, dignity: "friend", subathuvamBand: "subathuvam" },
    mercury: { signIndex: 7, degree: 21.14, house: 12, nakshatra: 17 /* Jyeshtha */, pada: 2, retrograde: false, dignity: "neutral", subathuvamBand: "papathuvam" },
    jupiter: { signIndex: 9, degree: 20.93, house: 2, nakshatra: 21 /* Shravana */, pada: 4, retrograde: false, dignity: "debilitated", subathuvamBand: "neutral" },
    venus: { signIndex: 8, degree: 18.47, house: 1, nakshatra: 19 /* Purva Ashadha */, pada: 2, retrograde: false, dignity: "neutral", subathuvamBand: "papathuvam" },
    saturn: { signIndex: 11, degree: 20.42, house: 4, nakshatra: 26 /* Revati */, pada: 2, retrograde: true, dignity: "neutral", subathuvamBand: "neutral" },
    rahu: { signIndex: 4, degree: 22.23, house: 9, nakshatra: 10 /* Purva Phalguni */, pada: 3, retrograde: true, dignity: "neutral", subathuvamBand: "papathuvam" },
    ketu: { signIndex: 10, degree: 22.23, house: 3, nakshatra: 24 /* Purva Bhadrapada */, pada: 1, retrograde: true, dignity: "neutral", subathuvamBand: "neutral" },
  },
  aspects: [
    { from: "moon", to: 1, type: "7th" },
    { from: "saturn", to: 1, type: "10th" },
    { from: "rahu", to: 3, type: "7th" },
    { from: "mars", to: 4, type: "4th" },
    { from: "mars", to: 6, type: "8th" }, // Mars in house1 -> 8th aspect to house 8? adjusted per house-aspect table (Sun/Mercury/Jupiter/Saturn on H6)
    { from: "jupiter", to: 6, type: "5th" },
    { from: "saturn", to: 6, type: "3rd" },
    { from: "mars", to: 7, type: "7th" },
    { from: "venus", to: 7, type: "7th" },
    { from: "mars", to: 8, type: "8th" },
    { from: "jupiter", to: 8, type: "7th" },
    { from: "ketu", to: 9, type: "7th" },
    { from: "jupiter", to: 10, type: "9th" },
    { from: "saturn", to: 10, type: "7th" },
  ],
  paksha: "krishna",
  moonSunGap: 134.06,
  currentDasha: { mahadasha: "saturn", bhukti: "venus", from: "2023-06-17", to: "2026-08-17" },
};

// ---- Coverage comparison targets (from the reference PDFs/MDs) ------------
// Hand-curated list of key claims each reference analysis makes, used to spot
// check whether the composer's fired rules substantively cover them. This is
// NOT an exhaustive text-diff — it's a sentinel list of the brief's explicit
// success criteria plus a few other headline claims from each doc.

interface CoverageTarget {
  label: string;
  check: (fired: ReturnType<typeof composeReading>) => boolean;
}

const LOKESH_TARGETS: CoverageTarget[] = [
  {
    label: "Mercury Subathuvam correction (F-CAR-068 master principle fires for Lagna Lord Mercury)",
    check: (r) => r.sections.some((s) => s.subsections.some((ss) => ss.firedRules.some((fr) => fr.id === "F-CAR-068"))),
  },
  {
    label: "Chandra Adhi Yoga NOT formed (correctly flagged)",
    check: (r) => r.executiveSummary.corrections.some((c) => c.includes("Chandra Adhi Yoga") && c.includes("NOT formed")),
  },
  {
    label: "No Sani-Sevvai (Mars-Saturn dosha correctly absent)",
    check: (r) => r.executiveSummary.corrections.some((c) => c.includes("Sani-Sevvai") && c.includes("NOT formed")),
  },
  {
    label: "40+ total rules fired",
    check: (r) => r.metadata.totalRulesFired >= 40,
  },
  {
    label: "8+ sections produced",
    check: (r) => r.sections.length >= 8,
  },
];

const SWETHA_TARGETS: CoverageTarget[] = [
  {
    label: "Jupiter Neecha Bhanga formed (debilitated Jupiter cancelled via Saturn kendra)",
    check: (r) => r.executiveSummary.corrections.some((c) => c.includes("Neecha Bhanga Raja Yoga (Guru (Jupiter))") && c.includes(": FORMED")),
  },
  {
    label: "Sani-Sevvai Yoga present (Mars 4th-aspects Saturn, Saturn 10th-aspects Mars — verified mutual aspect)",
    check: (r) => r.executiveSummary.corrections.some((c) => c.includes("Sani-Sevvai Yoga") && c.includes(": FORMED")),
  },
  {
    label: "40+ total rules fired",
    check: (r) => r.metadata.totalRulesFired >= 40,
  },
  {
    label: "8+ sections produced",
    check: (r) => r.sections.length >= 8,
  },
  {
    label: "Venus Bhukti dasha section present (current BD)",
    check: (r) => r.sections.some((s) => s.id === "current-dasha" && s.subsections.some((ss) => /Sukra \(Venus\) Bhukti/.test(ss.title))),
  },
];

// NOTE on "Sani-Sevvai present" for Swetha (brief success criterion): Mars
// (house 1) and Saturn (house 4) are 3 houses apart with no conjunction and
// no mutual aspect in the transcribed CHART_FACTS/aspect tables (Saturn
// aspects house 1 via 10th aspect = Mars+Venus's house, and Mars aspects
// house 4 via 4th aspect = Saturn's house — this IS a mutual aspect: Mars
// aspects Saturn's house and Saturn aspects Mars's house). We rely on the
// composer's derived-aspect engine (aspectFromTo) to detect this
// automatically rather than hard-coding it, and report the result below.

function pct(n: number, d: number): string {
  if (d === 0) return "n/a";
  return `${((n / d) * 100).toFixed(0)}%`;
}

function runChart(name: string, facts: ChartFacts, targets: CoverageTarget[]) {
  const t0 = performance.now();
  const reading = composeReading(facts);
  const t1 = performance.now();

  console.log(`\n==================== ${name} ====================`);
  console.log(`Lagna: ${reading.metadata.lagna} | Rules fired: ${reading.metadata.totalRulesFired} | Compute time: ${(t1 - t0).toFixed(1)}ms`);
  console.log(`Sections: ${reading.sections.map((s) => `${s.title} (${s.subsections.reduce((n, ss) => n + ss.firedRules.length, 0)} rules)`).join(" | ")}`);

  console.log(`\n-- Executive Summary --`);
  console.log(reading.executiveSummary.lagnaLine);
  for (const v of reading.executiveSummary.verdicts) {
    console.log(`  ${v.area}: ${v.verdict} (${v.ruleIds.length} rules)`);
  }

  console.log(`\n-- Critical Corrections (yoga checks) --`);
  for (const c of reading.executiveSummary.corrections) {
    console.log(`  ${c}`);
  }

  console.log(`\n-- Coverage targets --`);
  let passed = 0;
  for (const target of targets) {
    const ok = target.check(reading);
    if (ok) passed++;
    console.log(`  [${ok ? "PASS" : "GAP "}] ${target.label}`);
  }
  console.log(`Coverage: ${passed}/${targets.length} targets passed (${pct(passed, targets.length)})`);

  // Topic distribution of fired rules (for gap analysis).
  const topicCounts = new Map<string, number>();
  for (const s of reading.sections) {
    for (const ss of s.subsections) {
      for (const fr of ss.firedRules) {
        topicCounts.set(fr.topic, (topicCounts.get(fr.topic) ?? 0) + 1);
      }
    }
  }
  console.log(`\n-- Fired rule topic distribution (dedup across sections not applied; sections re-use rules) --`);
  for (const [topic, count] of Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${topic}: ${count}`);
  }

  return { reading, elapsedMs: t1 - t0 };
}

function main() {
  console.log("=== Rule Composer Test Harness ===");
  const meta = getBundleMeta();
  console.log(`Bundle generated at: ${meta.generatedAt}`);
  console.log(`Total rules in bundle: ${meta.totalRules}`);
  console.log(`Lagnas present: ${meta.lagnas.join(", ")}`);

  const lagnaCheck = verifyAllLagnasPresent();
  console.log(`\nAll 12 lagnas present: ${lagnaCheck.ok ? "YES" : "NO — missing: " + lagnaCheck.missing.join(", ")}`);

  const overallStart = performance.now();
  const lokeshResult = runChart("LOKESH (Mithuna Lagna)", LOKESH, LOKESH_TARGETS);
  const swethaResult = runChart("SWETHA (Dhanusu Lagna)", SWETHA, SWETHA_TARGETS);
  const overallElapsed = performance.now() - overallStart;

  console.log(`\n=== Summary ===`);
  console.log(`Lokesh: ${lokeshResult.reading.metadata.totalRulesFired} rules fired in ${lokeshResult.elapsedMs.toFixed(1)}ms`);
  console.log(`Swetha: ${swethaResult.reading.metadata.totalRulesFired} rules fired in ${swethaResult.elapsedMs.toFixed(1)}ms`);
  console.log(`Total harness time: ${overallElapsed.toFixed(1)}ms`);
  console.log(`Both charts <500ms each: ${lokeshResult.elapsedMs < 500 && swethaResult.elapsedMs < 500 ? "YES" : "NO"}`);
  console.log(`Full harness <2000ms: ${overallElapsed < 2000 ? "YES" : "NO"}`);

  // Dump full JSON outputs for inspection by other agents.
  return { lokesh: lokeshResult.reading, swetha: swethaResult.reading };
}

const results = main();

// Export for programmatic use / write to disk when run directly.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "..", "composer_test_output");
try {
  writeFileSync(join(__dirname, "..", "lokesh_structured_reading.json"), JSON.stringify(results.lokesh, null, 2));
  writeFileSync(join(__dirname, "..", "swetha_structured_reading.json"), JSON.stringify(results.swetha, null, 2));
  console.log(`\nFull StructuredReading JSON written to tamil-astro/lokesh_structured_reading.json and swetha_structured_reading.json`);
} catch (err) {
  console.error("Could not write output JSON:", err);
}
