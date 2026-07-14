import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/lib/lang";
import { UI, type Bilingual } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import { matchRules, type ValuBand, type MatchableRule } from "@shared/astro/guruji-analysis";
import {
  VERDICT_WORD,
  type PredictionReport,
  type TopicPrediction,
  type PredLine,
  type PredTone,
  type Confidence,
  type Verdict,
  type ScoreRow,
  type AppliedOverride,
} from "@shared/astro/guruji-predict";
import type { Rule } from "@shared/schema";
import { Card } from "@/components/ui/card";
import {
  Sun, BarChart3, Sparkles, BookMarked, ChevronDown, Library, Compass,
  Heart, Briefcase, GraduationCap, Coins, Users, HeartPulse,
  CheckCircle2, Scale, AlertTriangle, Clock, Moon, ShieldCheck, ChevronRight,
} from "lucide-react";
import { toneStyle } from "./KNRaoTab";
import { RULE_CATEGORIES, categoryLabel, ruleTitle, ruleBody, planetName } from "@/lib/rules";
import { useAuth } from "@/lib/auth";
import { DeepReadingPanel } from "./DeepReadingPanel";

interface Props {
  chart: ChartResult | null;
  chartId?: number | null;
  chartName?: string;
}

// Band → colour + label for a planet's net Sootchuma Valu.
function bandStyle(band: ValuBand): { chip: string; labelKey: Bilingual } {
  switch (band) {
    case "high":
      return { chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", labelKey: UI.bandHigh };
    case "medium":
      return { chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400", labelKey: UI.bandMedium };
    case "low":
      return { chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400", labelKey: UI.bandLow };
    default:
      return { chip: "bg-destructive/12 text-destructive", labelKey: UI.bandAfflicted };
  }
}

export function GurujiTab({ chart, chartId, chartName }: Props) {
  const { t } = useLang();
  const { isAdmin } = useAuth();

  if (!chart) {
    return (
      <Card className="p-6 text-center text-muted-foreground" data-testid="guruji-need-chart">
        {t(UI.dashNeedChart)}
      </Card>
    );
  }

  const g = chart.gurujiAnalysis;

  return (
    <div className="space-y-6" data-testid="guruji-tab">
      {isAdmin && chartId ? (
        <DeepReadingPanel chartId={chartId} chartName={chartName} />
      ) : null}

      <GurujiPredictionsSection prediction={chart.prediction} />

      <GurujiRulesSection chart={chart} />

      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Sun className="h-5 w-5 text-primary" />
          {t(UI.gurujiTitle)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.gurujiSubtitle)}</p>
      </div>

      {/* Headline */}
      <Card className="p-4 border-primary/30" data-testid="card-guruji-headline">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> {t(UI.gurujiTab)}
        </div>
        <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
          <p className="text-sm font-medium leading-snug" data-testid="text-guruji-headline">
            {t(g.headline)}
          </p>
        </div>
      </Card>

      {/* Subathuvam / Papathuvam scoreboard */}
      <Card className="p-4" data-testid="card-guruji-scoreboard">
        <div className="flex items-center gap-2 font-medium">
          <BarChart3 className="h-4 w-4 text-primary" /> {t(UI.scoreboard)}
        </div>
        <div className="mt-3 space-y-2.5">
          {/* Legend: green = Subathuvam (benefic), red = Papathuvam (malefic) */}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              {t(UI.subathuvam)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
              {t(UI.papathuvam)}
            </span>
          </div>
          {g.planets.map((p) => {
            const bs = bandStyle(p.band);
            // Split bar: green segment sized by Subathuvam, red by Papathuvam,
            // proportional to the total so you see the balance of both at once.
            const total = Math.max(1, p.subathuvam + p.papathuvam);
            const subPct = (p.subathuvam / total) * 100;
            const papaPct = (p.papathuvam / total) * 100;
            const positive = p.net >= 0;
            return (
              <div
                key={p.index}
                data-testid={`guruji-planet-${p.index}`}
                className="rounded-lg border border-card-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium text-sm">{t(p.name)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] tabular-nums">
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {t(UI.subathuvam)} {p.subathuvam}
                      </span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-destructive font-medium">
                        {t(UI.papathuvam)} {p.papathuvam}
                      </span>
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${bs.chip}`}>
                      {t(bs.labelKey)}
                    </span>
                  </div>
                </div>

                {/* Split Subathuvam (green) / Papathuvam (red) bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="flex-1 h-3 rounded-full overflow-hidden flex bg-muted/40"
                    title={`${t(UI.subathuvam)} ${p.subathuvam} / ${t(UI.papathuvam)} ${p.papathuvam}`}
                    data-testid={`guruji-bar-${p.index}`}
                  >
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${subPct}%` }}
                      data-testid={`guruji-sub-${p.index}`}
                    />
                    <div
                      className="h-full bg-destructive"
                      style={{ width: `${papaPct}%` }}
                      data-testid={`guruji-papa-${p.index}`}
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold tabular-nums w-10 text-right ${
                      positive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                    }`}
                    data-testid={`guruji-net-${p.index}`}
                  >
                    {positive ? "+" : ""}{p.net}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground/80 text-right">
                  {t(UI.sootchumaValu)}
                </div>

                {p.notes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.notes.map((n, ni) => (
                      <li key={ni} className="text-[12px] text-muted-foreground flex gap-1.5 leading-snug">
                        <span className="text-primary/60 mt-[3px]">•</span>
                        <span>{t(n)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Findings: Astamana, Bhadhaka, 6-8-12, Adhi Yoga */}
      <Card className="p-4" data-testid="card-guruji-findings">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> {t(UI.gurujiFindings)}
        </div>
        <div className="mt-3 space-y-2">
          {g.findings.map((f, fi) => {
            const ts = toneStyle(f.tone);
            return (
              <div
                key={fi}
                data-testid={`guruji-finding-${fi}`}
                className={`rounded-lg border ${ts.border} bg-card overflow-hidden`}
              >
                <div className="flex">
                  <div className={`w-1 shrink-0 ${ts.bar}`} />
                  <div className="flex-1 p-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="font-medium text-sm">{t(f.title)}</div>
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${ts.chip}`}>
                        {ts.icon} {t(ts.labelKey)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-1 leading-snug">{t(f.verdict)}</p>
                    {f.reasons.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {f.reasons.map((r, ri) => (
                          <li key={ri} className="text-[12px] text-muted-foreground flex gap-1.5 leading-snug">
                            <span className="text-primary/60 mt-[3px]">•</span>
                            <span>{t(r)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// v3 PREDICTIONS SECTION — score-based, single-conclusion-per-topic.
// Each topic card leads with ONE verdict, a plain-language reason, and the top
// deciding reasons. The full three-score math (Strength / Subathuvam /
// Papathuvam per planet), the applied override rules, timing and event detail
// live inside a collapsible panel so the card stays readable but nothing is
// hidden. Sensitive topics (longevity) carry a gentle caution and are never
// read as denial. Every number is grounded in a real placement in this chart.
// ---------------------------------------------------------------------------

// lucide icon name (from the engine's ModuleSpec) → component.
const PRED_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart, Briefcase, GraduationCap, Coins, Users, HeartPulse,
};

// Verdict → colour system + icon + label. This is the single most important
// visual signal, so each verdict gets a distinct, legible treatment.
function verdictStyle(v: Verdict): {
  badge: string; banner: string; border: string; dot: string;
  icon: React.ReactNode; label: Bilingual;
} {
  switch (v) {
    case "good":
      return {
        badge: "bg-emerald-500 text-white",
        banner: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        border: "border-emerald-500/40", dot: "bg-emerald-500",
        icon: <CheckCircle2 className="h-4 w-4" />, label: UI.verdictGood,
      };
    case "mixed-good":
      return {
        badge: "bg-teal-500 text-white",
        banner: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
        border: "border-teal-500/40", dot: "bg-teal-500",
        icon: <Scale className="h-4 w-4" />, label: UI.verdictMixedGood,
      };
    case "mixed-bad":
      return {
        badge: "bg-amber-500 text-white",
        banner: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
        border: "border-amber-500/40", dot: "bg-amber-500",
        icon: <Scale className="h-4 w-4" />, label: UI.verdictMixedBad,
      };
    case "delayed":
      return {
        badge: "bg-orange-500 text-white",
        banner: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
        border: "border-orange-500/40", dot: "bg-orange-500",
        icon: <Clock className="h-4 w-4" />, label: UI.verdictDelayed,
      };
    case "dormant":
      return {
        badge: "bg-slate-400 text-white",
        banner: "bg-slate-400/10 text-slate-600 dark:text-slate-300 border-slate-400/30",
        border: "border-slate-400/40", dot: "bg-slate-400",
        icon: <Moon className="h-4 w-4" />, label: UI.verdictDormant,
      };
    case "not-promised":
      return {
        badge: "bg-slate-500 text-white",
        banner: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
        border: "border-slate-500/40", dot: "bg-slate-500",
        icon: <AlertTriangle className="h-4 w-4" />, label: UI.verdictNotPromised,
      };
    default: // bad
      return {
        badge: "bg-destructive text-white",
        banner: "bg-destructive/10 text-destructive border-destructive/30",
        border: "border-destructive/40", dot: "bg-destructive",
        icon: <AlertTriangle className="h-4 w-4" />, label: UI.verdictBad,
      };
  }
}

// Confidence (high/medium/low) → subtle chip.
function confStyle(c: Confidence): { chip: string; labelKey: Bilingual } {
  switch (c) {
    case "high":
      return { chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", labelKey: UI.confHigh };
    case "medium":
      return { chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400", labelKey: UI.confMedium };
    default:
      return { chip: "bg-muted text-muted-foreground", labelKey: UI.confLow };
  }
}

// A single tone-coloured bullet line (used for the top reasons).
function ReasonLine({ line }: { line: PredLine }) {
  const { t } = useLang();
  const ts = toneStyle(line.tone ?? "info");
  const textColor = ts.chip.split(" ").filter((c) => c.startsWith("text-")).join(" ");
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 ${textColor}`}>{ts.icon}</span>
      <span className="text-sm leading-snug text-foreground/90 break-words min-w-0">{t(line.text)}</span>
    </li>
  );
}

// A compact bar showing subathuvam (green) vs papathuvam (red) for one planet.
function ScoreBars({ suba, papa }: { suba: number; papa: number }) {
  return (
    <div className="flex flex-col gap-0.5 w-full min-w-[52px]">
      <div className="h-1.5 rounded-full bg-emerald-500/15 overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${suba}%` }} />
      </div>
      <div className="h-1.5 rounded-full bg-destructive/15 overflow-hidden">
        <div className="h-full bg-destructive" style={{ width: `${papa}%` }} />
      </div>
    </div>
  );
}

// The collapsible full-scoring panel: per-planet score table + overrides.
function ScoreMath({ topic }: { topic: TopicPrediction }) {
  const { t } = useLang();
  return (
    <div className="mt-3 space-y-4" data-testid={`pred-math-${topic.key}`}>
      {/* Score table */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          {t(UI.predScoreTable)}
        </div>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="font-medium py-1 pr-2">{t(UI.predColPlanet)}</th>
                <th className="font-medium py-1 px-1 text-center hidden sm:table-cell">{t(UI.predColStrength)}</th>
                <th className="font-medium py-1 px-1">{t(UI.predColSuba)} / {t(UI.predColPapa)}</th>
                <th className="font-medium py-1 pl-2 text-right">{t(UI.predColNet)}</th>
              </tr>
            </thead>
            <tbody>
              {topic.scoreRows.map((r: ScoreRow) => (
                <tr key={r.index} className="border-t border-border/50 align-middle" data-testid={`row-score-${topic.key}-${r.index}`}>
                  <td className="py-1.5 pr-2">
                    <div className="font-medium leading-tight break-words">{t(r.name)}</div>
                    <div className="text-[10.5px] text-muted-foreground leading-tight break-words">{t(r.role)}{r.floored ? " ·⚑" : ""}</div>
                  </td>
                  <td className="py-1.5 px-1 text-center tabular-nums hidden sm:table-cell">{r.strength}</td>
                  <td className="py-1.5 px-1">
                    <div className="flex items-center gap-1.5">
                      <ScoreBars suba={r.subathuvam} papa={r.papathuvam} />
                      <span className="text-[10.5px] text-muted-foreground tabular-nums whitespace-nowrap">{r.subathuvam}/{r.papathuvam}</span>
                    </div>
                  </td>
                  <td className={`py-1.5 pl-2 text-right font-semibold tabular-nums whitespace-nowrap ${r.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {r.net >= 0 ? "+" : ""}{r.net}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Applied override rules */}
      {topic.overrides.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            {t(UI.predOverrides)}
          </div>
          <ul className="space-y-1.5">
            {topic.overrides.map((o: AppliedOverride, i) => {
              const ts = toneStyle(o.tone);
              const textColor = ts.chip.split(" ").filter((c) => c.startsWith("text-")).join(" ");
              return (
                <li key={i} className="flex items-start gap-2" data-testid={`override-${topic.key}-${o.code}`}>
                  <span className={`mt-0.5 shrink-0 ${textColor}`}><ShieldCheck className="h-3.5 w-3.5" /></span>
                  <span className="text-[12.5px] leading-snug text-foreground/85 break-words min-w-0">{t(o.text)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Timing + event detail */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" /> {t(UI.predTiming)}
          </div>
          <p className="text-[12.5px] leading-snug text-foreground/85 break-words" data-testid={`text-pred-timing-${topic.key}`}>{t(topic.timing)}</p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {t(UI.predEventDetail)}
          </div>
          <p className="text-[12.5px] leading-snug text-foreground/85 break-words" data-testid={`text-pred-detail-${topic.key}`}>{t(topic.eventDetail)}</p>
        </div>
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: TopicPrediction }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const Icon = PRED_ICONS[topic.icon] ?? Sparkles;
  const vs = verdictStyle(topic.verdict);
  const cs = confStyle(topic.confidence);
  return (
    <Card className={`p-4 border ${vs.border}`} data-testid={`card-pred-${topic.key}`}>
      {/* Header: topic + verdict badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4 text-primary" />
          <span data-testid={`text-pred-title-${topic.key}`}>{t(topic.title)}</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${vs.badge}`}
          data-testid={`badge-pred-verdict-${topic.key}`}
        >
          {vs.icon} {t(vs.label)}
        </span>
      </div>

      {/* Verdict reason banner (the one conclusion, in plain language) */}
      <div className={`mt-3 rounded-lg border px-3 py-2.5 ${vs.banner}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80 mb-0.5">
          {t(UI.predVerdictReason)}
        </div>
        <p className="text-sm font-medium leading-snug break-words" data-testid={`text-pred-reason-${topic.key}`}>
          {t(topic.verdictReason)}
        </p>
      </div>

      {/* Top deciding reasons — always visible */}
      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          {t(UI.predTopReasons)}
        </div>
        <ul className="space-y-1.5">
          {topic.topReasons.map((ln, i) => <ReasonLine key={i} line={ln} />)}
        </ul>
      </div>

      {/* Caution (sensitive topics) — always visible, above the fold */}
      {topic.caution && (
        <div
          className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2"
          data-testid={`text-pred-caution-${topic.key}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {t(UI.predCaution)}
          </div>
          <p className="text-xs leading-snug text-foreground/80 mt-0.5 break-words">{t(topic.caution)}</p>
        </div>
      )}

      {/* Collapsible: full scoring math + overrides + timing + detail */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-[12px] font-medium text-foreground/80 hover:bg-muted/60 transition-colors"
        data-testid={`toggle-pred-math-${topic.key}`}
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          {t(open ? UI.predHideMath : UI.predShowMath)}
        </span>
        <span className={`inline-flex items-center gap-1 text-[10.5px] rounded-full px-1.5 py-0.5 ${cs.chip}`}>
          {t(UI.predConfidence)}: {t(cs.labelKey)}
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        </span>
      </button>
      {open && <ScoreMath topic={topic} />}
    </Card>
  );
}

function GurujiPredictionsSection({ prediction }: { prediction: PredictionReport }) {
  const { t } = useLang();
  const found = prediction.foundation;
  const fts = toneStyle(found.canReceive);
  return (
    <div className="space-y-4" data-testid="guruji-predictions">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Compass className="h-5 w-5 text-primary" />
          {t(UI.predTitle)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.predSubtitle)}</p>
      </div>

      {/* Chart foundation — capacity to receive results */}
      <Card className={`p-4 border ${fts.border}`} data-testid="card-pred-foundation">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> {t(UI.predFoundation)}
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${fts.chip}`}>
            {fts.icon} {t(fts.labelKey)}
          </span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {found.lines.map((ln, i) => <ReasonLine key={i} line={ln} />)}
        </ul>
      </Card>

      {/* Per-topic prediction cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {prediction.topics.map((topic) => (
          <TopicCard key={topic.key} topic={topic} />
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground leading-snug" data-testid="text-pred-disclaimer">
        {t(prediction.disclaimer)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rules section: fetches the rule library, auto-matches it against this chart,
// and shows (1) chart-specific matched rules, then (2) the full categorised
// reference (collapsible by category). Uses the same matcher as the server.
// ---------------------------------------------------------------------------
function GurujiRulesSection({ chart }: { chart: ChartResult }) {
  const { t } = useLang();
  const { data: rules, isLoading } = useQuery<Rule[]>({ queryKey: ["/api/rules"] });

  const matches = useMemo(() => {
    if (!rules?.length) return [];
    const matchable: MatchableRule[] = rules.map((r) => ({
      ruleNo: r.ruleNo, astrologer: r.astrologer, categoryKey: r.categoryKey,
      planets: r.planets, houses: r.houses,
    }));
    return matchRules(matchable, chart.planets, chart.lagna.rasiIndex, chart.planets[1].rasiIndex);
  }, [rules, chart]);

  const byNo = useMemo(() => {
    const m = new Map<number, Rule>();
    for (const r of rules ?? []) m.set(r.ruleNo, r);
    return m;
  }, [rules]);

  const specific = matches.filter((m) => m.specific);

  if (isLoading) {
    return (
      <Card className="p-4 text-sm text-muted-foreground" data-testid="guruji-rules-loading">
        {t(UI.rulesLoading)}
      </Card>
    );
  }
  if (!rules?.length) return null;

  return (
    <>
      {/* Chart-specific matched rules */}
      <Card className="p-4 border-primary/30" data-testid="card-guruji-matched">
        <div className="flex items-center gap-2 font-medium">
          <BookMarked className="h-4 w-4 text-primary" /> {t(UI.gurujiMatchedTitle)}
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {specific.length} {t(UI.rulesCount)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t(UI.gurujiMatchedSubtitle)}</p>
        <div className="mt-3 space-y-2">
          {specific.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="guruji-matched-none">
              {t(UI.gurujiMatchedNone)}
            </p>
          )}
          {specific.map((m) => {
            const r = byNo.get(m.ruleNo);
            if (!r) return null;
            return (
              <div
                key={m.ruleNo}
                data-testid={`guruji-matched-${m.ruleNo}`}
                className="rounded-lg border border-primary/20 bg-primary/5 p-3"
              >
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">
                    #{r.ruleNo}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {t(categoryLabel(r.categoryKey))}
                  </span>
                  <span className="font-medium text-sm">{t(ruleTitle(r))}</span>
                </div>
                <p className="text-sm text-foreground/80 mt-1.5 leading-snug">{t(ruleBody(r))}</p>
                <p className="text-[11px] text-primary/70 mt-1.5 flex gap-1.5 leading-snug">
                  <Sparkles className="h-3 w-3 mt-[2px] shrink-0" />
                  <span>{t(m.reason)}</span>
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Full categorised reference (collapsible) */}
      <Card className="p-4" data-testid="card-guruji-reference">
        <div className="flex items-center gap-2 font-medium">
          <Library className="h-4 w-4 text-primary" /> {t(UI.gurujiRefTitle)}
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {rules.length} {t(UI.rulesCount)}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {RULE_CATEGORIES.map((cat) => {
            const catRules = rules.filter((r) => r.categoryKey === cat.key);
            if (!catRules.length) return null;
            return <CategoryGroup key={cat.key} catKey={cat.key} label={cat.label} rules={catRules} />;
          })}
        </div>
      </Card>
    </>
  );
}

function CategoryGroup({ catKey, label, rules }: { catKey: string; label: Bilingual; rules: Rule[] }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-card-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid={`ref-cat-${catKey}`}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
      >
        <span className="font-medium text-sm">{t(label)}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{rules.length}</span>
        <ChevronDown className={`h-4 w-4 ml-auto text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-card-border pt-2">
          {rules.map((r) => (
            <div key={r.ruleNo} data-testid={`ref-rule-${r.ruleNo}`} className="text-sm">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 mt-0.5">
                  #{r.ruleNo}
                </span>
                <div>
                  <span className="font-medium">{t(ruleTitle(r))}</span>
                  <p className="text-foreground/75 leading-snug mt-0.5">{t(ruleBody(r))}</p>
                  {(r.planets.length > 0 || r.houses.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.planets.map((p) => (
                        <span key={`p${p}`} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/12 text-sky-600 dark:text-sky-400">
                          {t(planetName(p))}
                        </span>
                      ))}
                      {r.houses.map((h) => (
                        <span key={`h${h}`} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-600 dark:text-amber-400">
                          {t(UI.rulesHouse)} {h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
