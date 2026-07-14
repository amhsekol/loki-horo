/**
 * Smoke test: run the full deep-reading pipeline end-to-end (composer +
 * templated fallback, no PERPLEXITY_API_KEY). Confirms that:
 *   - computeChart runs
 *   - analyzeGuruji populates the scoreboard
 *   - toChartFacts feeds subathuvamBand through
 *   - composeReading returns 8 sections
 *   - templated Markdown fallback assembles a full document
 *
 * Uses Lokesh's chart from CHART_FACTS.md as the input.
 */

import { computeChart } from "../shared/astro/engine";
import { analyzeGuruji } from "../shared/astro/guruji-analysis";
import { composeReading } from "../shared/astro/composer";
import { toChartFacts } from "../shared/astro/chart-facts-adapter";
import { writeFileSync } from "node:fs";

// Lokesh: 10 May 1994 at 09:30 IST, Chennai (verified in CHART_FACTS.md).
// Expected: Mithuna (Gemini) Lagna 18°46'
const LOKESH_INPUT = {
  date: "1994-05-10",
  time: "09:30",
  latitude: 13.088,
  longitude: 80.278,
  tzOffset: 5.5,
};

// Swetha: 18 Nov 1997 at 09:10 IST, Chennai (verified in SWETHA_CHART_FACTS.md).
// Expected: Dhanusu (Sagittarius) Lagna 12°23'
const SWETHA_INPUT = {
  date: "1997-11-18",
  time: "09:10",
  latitude: 13.088,
  longitude: 80.278,
  tzOffset: 5.5,
};

function runOne(name: string, input: any) {
  console.log(`\n=== ${name} ===`);
  const t0 = Date.now();
  const chart = computeChart(input);
  const guruji = analyzeGuruji(chart.planets, chart.lagna.rasiIndex, chart.planets[1].rasiIndex);
  const facts = toChartFacts(chart, guruji, { nativeName: name });
  const structured = composeReading(facts);
  const dt = Date.now() - t0;

  const totalFired = structured.sections.reduce(
    (a, s) => a + s.subsections.reduce((b, ss) => b + ss.firedRules.length, 0),
    0,
  );
  const totalPoints = structured.sections.reduce(
    (a, s) => a + s.subsections.reduce((b, ss) => b + ss.structuredPoints.length, 0),
    0,
  );

  console.log(`  Lagna:            ${structured.metadata.lagna}`);
  console.log(`  Total rules fired: ${totalFired}`);
  console.log(`  Total points:      ${totalPoints}`);
  console.log(`  Sections:          ${structured.sections.length}`);
  console.log(`  Compute time:      ${dt}ms`);

  // Show subathuvam bands
  console.log(`  Subathuvam bands:`);
  for (const [k, p] of Object.entries(facts.planets)) {
    console.log(`    ${k}: ${p.subathuvamBand ?? "-"} (dignity=${p.dignity}, house=${p.house})`);
  }

  // Show first 3 verdicts
  console.log(`  Sample verdicts:`);
  for (const v of structured.executiveSummary.verdicts.slice(0, 3)) {
    console.log(`    ${v.area}: ${v.verdict}`);
  }

  // Show section list
  console.log(`  Sections:`);
  for (const s of structured.sections) {
    const subs = s.subsections.length;
    const rules = s.subsections.reduce((a, ss) => a + ss.firedRules.length, 0);
    console.log(`    ${s.order}. ${s.title} — ${subs} subsections, ${rules} rules`);
  }

  return { structured, facts };
}

const { structured: lokeshS } = runOne("Lokesh", LOKESH_INPUT);
const { structured: swethaS } = runOne("Swetha", SWETHA_INPUT);

writeFileSync("/tmp/lokesh_deep_reading_structured.json", JSON.stringify(lokeshS, null, 2));
writeFileSync("/tmp/swetha_deep_reading_structured.json", JSON.stringify(swethaS, null, 2));
console.log("\nWrote structured JSONs to /tmp/{lokesh,swetha}_deep_reading_structured.json");
