/**
 * Deep Reading orchestrator.
 *
 * Given a chartId + requesting admin user, this module:
 *   1. Loads the chart record from SQLite
 *   2. Runs the existing engine (computeChart + analyzeGuruji) to get raw facts
 *   3. Adapts them into the composer's ChartFacts shape (passing Subathuvam bands)
 *   4. Runs composeReading() → StructuredReading (deterministic, offline-safe)
 *   5. If PERPLEXITY_API_KEY is set: expands each section into Guruji prose via
 *      Perplexity Sonar. Otherwise: assembles a templated Markdown fallback.
 *   6. Caches the result in the deep_readings table so repeat views are free.
 *   7. Enforces monthly budget cap.
 *
 * Admin-only enforcement lives at the route layer; this module trusts callers.
 */

import { db } from "./storage";
import { deepReadings, apiBudget, charts } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { computeChart } from "@shared/astro/engine";
import { analyzeGuruji } from "@shared/astro/guruji-analysis";
import { composeReading, type ChartFacts } from "@shared/astro/composer";
import { toChartFacts } from "@shared/astro/chart-facts-adapter";
import {
  generateSection,
  estimateSectionCost,
  PerplexityError,
  DEFAULT_MODEL,
} from "./perplexity";

const COMPOSER_VERSION = "1.0.0";
const MONTHLY_BUDGET_USD_MICROS = 5_000_000; // $5.00

// ---------------------------------------------------------------------------
// Budget helpers
// ---------------------------------------------------------------------------

function currentMonthKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getCurrentBudget() {
  const key = currentMonthKey();
  const row = db.select().from(apiBudget).where(eq(apiBudget.monthKey, key)).get();
  if (!row) {
    return {
      monthKey: key,
      spentUsd: 0,
      budgetUsd: MONTHLY_BUDGET_USD_MICROS / 1_000_000,
      remainingUsd: MONTHLY_BUDGET_USD_MICROS / 1_000_000,
    };
  }
  return {
    monthKey: row.monthKey,
    spentUsd: row.spentUsdMicros / 1_000_000,
    budgetUsd: row.budgetUsdMicros / 1_000_000,
    remainingUsd: (row.budgetUsdMicros - row.spentUsdMicros) / 1_000_000,
  };
}

function assertBudgetOK(estimatedMicros: number): void {
  const key = currentMonthKey();
  const row = db.select().from(apiBudget).where(eq(apiBudget.monthKey, key)).get();
  const spent = row?.spentUsdMicros ?? 0;
  const budget = row?.budgetUsdMicros ?? MONTHLY_BUDGET_USD_MICROS;
  if (spent + estimatedMicros > budget) {
    throw new Error(
      `Monthly Perplexity budget exceeded: $${(spent / 1_000_000).toFixed(2)} spent, ` +
      `$${(budget / 1_000_000).toFixed(2)} cap. Wait for next month or raise the cap.`
    );
  }
}

function recordSpend(micros: number): void {
  const key = currentMonthKey();
  const now = Date.now();
  const row = db.select().from(apiBudget).where(eq(apiBudget.monthKey, key)).get();
  if (row) {
    db.update(apiBudget)
      .set({ spentUsdMicros: row.spentUsdMicros + micros, updatedAt: now })
      .where(eq(apiBudget.id, row.id))
      .run();
  } else {
    db.insert(apiBudget).values({
      monthKey: key,
      spentUsdMicros: micros,
      budgetUsdMicros: MONTHLY_BUDGET_USD_MICROS,
      updatedAt: now,
    }).run();
  }
}

// ---------------------------------------------------------------------------
// Cache accessors
// ---------------------------------------------------------------------------

export async function getDeepReading(chartId: number) {
  const row = db.select().from(deepReadings)
    .where(and(
      eq(deepReadings.chartId, chartId),
      eq(deepReadings.composerVersion, COMPOSER_VERSION),
    ))
    .orderBy(desc(deepReadings.updatedAt))
    .get();
  if (!row) return null;
  return {
    id: row.id,
    chartId: row.chartId,
    status: row.status,
    model: row.model,
    composerVersion: row.composerVersion,
    proseMarkdown: row.proseMarkdown,
    structured: row.structuredJson ? JSON.parse(row.structuredJson) : null,
    sectionsCompleted: row.sectionsCompleted,
    sectionsTotal: row.sectionsTotal,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    costUsd: row.costUsdMicros / 1_000_000,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    errorMessage: row.errorMessage,
  };
}

// ---------------------------------------------------------------------------
// Core: compute structured reading from a chart record
// ---------------------------------------------------------------------------

function buildStructuredReadingForChart(chartId: number) {
  const chart = db.select().from(charts).where(eq(charts.id, chartId)).get();
  if (!chart) throw new Error(`Chart ${chartId} not found`);

  const result = computeChart({
    date: chart.date,
    time: chart.time,
    latitude: Number(chart.latitude),
    longitude: Number(chart.longitude),
    tzOffset: Number(chart.tzOffset),
  });

  const guruji = analyzeGuruji(result.planets, result.lagna.rasiIndex, result.planets[1].rasiIndex);
  const facts = toChartFacts(result, guruji, { nativeName: chart.name });
  const structured = composeReading(facts);
  return { chart, structured, facts };
}

// ---------------------------------------------------------------------------
// Templated fallback (used when PERPLEXITY_API_KEY is missing)
// ---------------------------------------------------------------------------

function templatedProse(nativeName: string, structured: ReturnType<typeof composeReading>): string {
  const lines: string[] = [];
  lines.push(`# Guruji Reading — ${nativeName}`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(structured.executiveSummary.lagnaLine);
  lines.push("");
  for (const v of structured.executiveSummary.verdicts) {
    const drivers = v.drivers?.length ? ` — _${v.drivers.join("; ")}_` : "";
    lines.push(`- **${v.area}** — ${v.verdict}${drivers}`);
  }
  if (structured.executiveSummary.corrections?.length) {
    lines.push("");
    lines.push("### Critical Corrections");
    for (const c of structured.executiveSummary.corrections) lines.push(`- ${c}`);
  }
  lines.push("");
  for (const s of structured.sections) {
    lines.push(`## ${s.title}`);
    lines.push("");
    for (const sub of s.subsections ?? []) {
      lines.push(`### ${sub.title}`);
      for (const p of sub.structuredPoints ?? []) {
        const rules = p.ruleIds?.length ? ` _(${p.ruleIds.join(", ")})_` : "";
        lines.push(`- ${p.point}${rules}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Perplexity-powered prose generation (per-section chunking)
// ---------------------------------------------------------------------------

async function generateProseWithPerplexity(
  nativeName: string,
  structured: ReturnType<typeof composeReading>,
  facts: ChartFacts,
  onProgress: (completed: number, total: number, spentMicros: number) => void,
): Promise<{ markdown: string; inputTokens: number; outputTokens: number; costMicros: number }> {
  const sections = structured.sections;
  const totalSections = sections.length + 1; // +1 for exec summary
  let inputTokens = 0;
  let outputTokens = 0;
  let costMicros = 0;

  // Pre-flight budget check based on rough estimate
  const roughEstimate = sections.reduce((sum, s) => {
    const firedCount = (s.subsections ?? []).reduce((acc, ss) => acc + (ss.firedRules?.length ?? 0), 0);
    return sum + estimateSectionCost(800, firedCount);
  }, 0);
  const estMicros = Math.ceil(roughEstimate * 1_000_000);
  assertBudgetOK(estMicros);

  const factsBrief = {
    lagna: facts.lagna,
    paksha: facts.paksha,
    moonSunGap: facts.moonSunGap,
    currentDasha: facts.currentDasha,
    planets: Object.fromEntries(
      Object.entries(facts.planets).map(([k, p]) => [k, {
        house: p.house,
        signIndex: p.signIndex,
        dignity: p.dignity,
        retrograde: p.retrograde,
        subathuvamBand: p.subathuvamBand,
      }]),
    ),
  };

  // 1. Executive summary
  const execSummaryPrompt = [
    `Native: ${nativeName}.`,
    `Lagna line: ${structured.executiveSummary.lagnaLine}`,
    ``,
    `Life-area verdicts:`,
    ...structured.executiveSummary.verdicts.map(v => {
      const drivers = v.drivers?.length ? ` [drivers: ${v.drivers.join("; ")}]` : "";
      return `- ${v.area}: ${v.verdict}${drivers}`;
    }),
    structured.executiveSummary.corrections?.length
      ? `\nCritical corrections:\n${structured.executiveSummary.corrections.map(c => `- ${c}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");

  const execResult = await generateSection({
    sectionTitle: "Executive Summary",
    chartFacts: factsBrief,
    firedRules: [],
    targetWordCount: 400,
    extraContext: execSummaryPrompt,
  });
  inputTokens += execResult.usage.inputTokens;
  outputTokens += execResult.usage.outputTokens;
  costMicros += Math.ceil(execResult.usage.estimatedCostUsd * 1_000_000);
  const parts: string[] = [
    `# Guruji Reading — ${nativeName}`,
    "",
    "## Executive Summary",
    "",
    execResult.text,
    "",
  ];
  onProgress(1, totalSections, costMicros);

  // 2. Each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    // Flatten all fired rules from subsections
    const allFired = (section.subsections ?? []).flatMap(ss => ss.firedRules ?? []);
    const structuredPoints = (section.subsections ?? []).flatMap(ss => ss.structuredPoints ?? []);

    const wordTarget = Math.max(500, Math.min(2000, structuredPoints.length * 40));
    const result = await generateSection({
      sectionTitle: section.title,
      chartFacts: factsBrief,
      firedRules: allFired.map(r => ({
        id: r.id,
        condition: r.condition,
        outcome: r.outcome,
        rule_en: r.rule_en,
        topic: r.topic,
        gentle: r.gentle,
      })),
      targetWordCount: wordTarget,
      extraContext: section.subsections?.length
        ? `Section has ${section.subsections.length} subsections: ${section.subsections.map(ss => ss.title).join(", ")}. Weave them into flowing prose without literal subheadings unless natural.`
        : undefined,
    });

    inputTokens += result.usage.inputTokens;
    outputTokens += result.usage.outputTokens;
    costMicros += Math.ceil(result.usage.estimatedCostUsd * 1_000_000);

    parts.push(`## ${section.title}`);
    parts.push("");
    parts.push(result.text);
    parts.push("");

    onProgress(i + 2, totalSections, costMicros);
  }

  return { markdown: parts.join("\n"), inputTokens, outputTokens, costMicros };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface RunDeepReadingInput {
  chartId: number;
  requestedBy: number;
  force?: boolean; // regenerate even if cached
}

export async function runDeepReading(input: RunDeepReadingInput) {
  const { chartId, requestedBy, force } = input;

  // Serve from cache unless force
  if (!force) {
    const cached = await getDeepReading(chartId);
    if (cached && cached.status === "complete" && cached.proseMarkdown) {
      return { ...cached, cached: true };
    }
  }

  const { chart, structured, facts } = buildStructuredReadingForChart(chartId);
  const nativeName = chart.name || "Native";
  const now = Date.now();
  const totalSections = structured.sections.length + 1;

  // Insert a "pending" row we'll update as we go
  const inserted = db.insert(deepReadings).values({
    chartId,
    requestedBy,
    composerVersion: COMPOSER_VERSION,
    model: process.env.PERPLEXITY_API_KEY ? DEFAULT_MODEL : "templated",
    status: "streaming",
    structuredJson: JSON.stringify(structured),
    sectionsCompleted: 0,
    sectionsTotal: totalSections,
    inputTokens: 0,
    outputTokens: 0,
    costUsdMicros: 0,
    createdAt: now,
    updatedAt: now,
  }).returning().get();

  const rowId = inserted.id;

  try {
    let markdown: string;
    let inputTokens = 0;
    let outputTokens = 0;
    let costMicros = 0;

    if (process.env.PERPLEXITY_API_KEY) {
      const result = await generateProseWithPerplexity(nativeName, structured, facts, (done, total, spent) => {
        db.update(deepReadings)
          .set({
            sectionsCompleted: done,
            costUsdMicros: spent,
            updatedAt: Date.now(),
          })
          .where(eq(deepReadings.id, rowId))
          .run();
      });
      markdown = result.markdown;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      costMicros = result.costMicros;
      recordSpend(costMicros);
    } else {
      // Fallback: templated Markdown, no LLM
      markdown = templatedProse(nativeName, structured);
    }

    db.update(deepReadings)
      .set({
        status: "complete",
        proseMarkdown: markdown,
        sectionsCompleted: totalSections,
        inputTokens,
        outputTokens,
        costUsdMicros: costMicros,
        updatedAt: Date.now(),
      })
      .where(eq(deepReadings.id, rowId))
      .run();

    return {
      id: rowId,
      chartId,
      status: "complete",
      model: process.env.PERPLEXITY_API_KEY ? DEFAULT_MODEL : "templated",
      proseMarkdown: markdown,
      structured,
      sectionsCompleted: totalSections,
      sectionsTotal: totalSections,
      inputTokens,
      outputTokens,
      costUsd: costMicros / 1_000_000,
      cached: false,
    };
  } catch (err: any) {
    const msg = err instanceof PerplexityError
      ? `Perplexity API error (${err.status}): ${err.message}`
      : (err?.message ?? String(err));
    db.update(deepReadings)
      .set({
        status: "failed",
        errorMessage: msg,
        updatedAt: Date.now(),
      })
      .where(eq(deepReadings.id, rowId))
      .run();
    throw err;
  }
}
