import { useState } from "react";
import { useLang } from "@/lib/lang";
import { UI } from "@shared/astro/constants";
import type { Bilingual } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import type {
  LordReading,
  Disposition,
  TimelinePeriod,
  LifetimeFoundation,
  FoundationPillar,
} from "@shared/astro/dasha-transit-analysis";
import { Card } from "@/components/ui/card";
import { toneStyle } from "./KNRaoTab";
import {
  CalendarClock,
  Clock,
  Orbit,
  Sparkles,
  Sun,
  Moon,
  Star,
  ArrowRight,
  ChevronDown,
  History,
  Anchor,
} from "lucide-react";

// Default the visible timeline to periods from 1990 onward; older periods
// (down to 1900) stay collapsed behind a toggle. A period is "earlier" when it
// finished before 1990.
const HISTORY_DEFAULT_YEAR = 1990;
function isEarlier(endIso: string): boolean {
  return endIso.slice(0, 4) < String(HISTORY_DEFAULT_YEAR);
}

interface Props {
  chart: ChartResult | null;
}

// Disposition → Tone mapping for reusing the KN Rao toneStyle palette.
function dispTone(d: Disposition): "good" | "caution" | "mixed" {
  return d === "subha" ? "good" : d === "papa" ? "caution" : "mixed";
}

// Icon per dasha level.
function levelIcon(level: LordReading["level"]) {
  switch (level) {
    case "maha":
      return <Sun className="h-4 w-4 text-primary" />;
    case "bhukti":
      return <Moon className="h-4 w-4 text-primary" />;
    default:
      return <Star className="h-4 w-4 text-primary" />;
  }
}

// A single running-lord reading card (Maha / Bhukti / Antara).
function LordCard({ reading }: { reading: LordReading }) {
  const { t } = useLang();
  const ts = toneStyle(dispTone(reading.combined));
  const natalTs = toneStyle(dispTone(reading.natalDisp));
  const transitTs = toneStyle(dispTone(reading.transitDisp));

  return (
    <div
      className={`rounded-lg border ${ts.border} bg-card overflow-hidden`}
      data-testid={`dt-lord-${reading.level}`}
    >
      <div className="flex">
        <div className={`w-1 shrink-0 ${ts.bar}`} />
        <div className="flex-1 p-3">
          {/* Header: level + lord name + combined verdict badge */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium">
              {levelIcon(reading.level)}
              <span className="text-muted-foreground">{t(reading.levelLabel)}</span>
              <span className="text-foreground">{t(reading.lord)}</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${ts.chip}`}
              data-testid={`dt-lord-${reading.level}-badge`}
            >
              {ts.icon} {t(ts.labelKey)}
            </span>
          </div>

          {/* Duration */}
          <div className="mt-1 text-[12px] text-muted-foreground tabular-nums">
            {reading.start} — {reading.end}
          </div>

          {/* Natal / Transit / Combined mini-grid */}
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-md border border-card-border bg-background/40 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t(UI.dtNatal)}
              </div>
              <div className="text-[12px] font-medium text-foreground leading-snug mt-0.5">
                {t(reading.natalSignName)}
              </div>
              <span
                className={`mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${natalTs.chip}`}
              >
                {t(natalTs.labelKey)}
              </span>
            </div>
            <div className="rounded-md border border-card-border bg-background/40 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t(UI.dtTransit)}
              </div>
              <div className="text-[12px] font-medium text-foreground leading-snug mt-0.5">
                {t(reading.transitSignName)}
                {reading.transitRetro ? " ℞" : ""}
              </div>
              <span
                className={`mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${transitTs.chip}`}
              >
                {t(transitTs.labelKey)}
              </span>
            </div>
            <div className="rounded-md border border-card-border bg-background/40 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t(UI.dtCombined)}
              </div>
              <div className="text-[12px] font-medium text-foreground leading-snug mt-0.5">
                {t(ts.labelKey)}
              </div>
            </div>
          </div>

          {/* Verdict */}
          <p className="text-sm text-foreground/80 mt-2 leading-snug">
            {t(reading.verdict)}
          </p>

          {/* Reasons */}
          {reading.reasons.length > 0 && (
            <ul className="mt-2 space-y-1">
              {reading.reasons.map((r, ri) => (
                <li
                  key={ri}
                  className="text-[12px] text-muted-foreground flex gap-1.5 leading-snug"
                >
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
}

// Disposition → color grammar for the timeline rows.
function timelineStyle(disp: Disposition): { dot: string; text: string } {
  switch (disp) {
    case "subha":
      return { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
    case "papa":
      return { dot: "bg-destructive", text: "text-destructive" };
    default:
      return { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  }
}

function statusLabel(status: "past" | "current" | "future") {
  switch (status) {
    case "past":
      return UI.dtStatusPast;
    case "current":
      return UI.dtStatusCurrent;
    default:
      return UI.dtStatusFuture;
  }
}

function statusChip(status: "past" | "current" | "future"): string {
  switch (status) {
    case "current":
      return "bg-primary/15 text-primary";
    case "future":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted/60 text-muted-foreground/80";
  }
}

// Shared renderer for a single timeline period row (used for both the default
// 1990+ list and the collapsible 1900–1990 list).
type TFn = (b: Bilingual | undefined, override?: "ta" | "en" | "hi") => string;
function renderTimelineRow(p: TimelinePeriod, key: string, t: TFn) {
  const st = timelineStyle(p.disposition);
  return (
    <div
      key={key}
      className={`rounded-lg border border-card-border bg-card p-3 ${
        p.status === "current" ? "ring-1 ring-primary/40" : ""
      }`}
      data-testid={`dt-timeline-${key}`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {t(p.label)}
            </div>
            <span
              className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium ${statusChip(
                p.status,
              )}`}
            >
              {t(statusLabel(p.status))}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
            {p.start} <ArrowRight className="inline h-3 w-3 -mt-0.5" /> {p.end}
          </div>
          <p className={`text-[13px] font-medium mt-1 leading-snug ${st.text}`}>
            {t(p.headline)}
          </p>
          {/* Per-lord classical breakdown — owns / placed / transits */}
          {p.clauses && p.clauses.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {p.clauses.map((c, ci) => (
                <li
                  key={ci}
                  className="text-[11.5px] text-muted-foreground flex gap-1.5 leading-snug"
                >
                  <span className="text-primary/50 mt-[3px]">◦</span>
                  <span>{t(c)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// One pillar row inside the Lifetime Foundation card (Lagna, Lagna lord, Sani,
// 8th lord). Shows the classical sentence plus a strength meter.
function PillarRow({ pillar, t }: { pillar: FoundationPillar; t: TFn }) {
  const st = timelineStyle(pillar.disposition);
  const isSign = pillar.planetIndex === null;
  return (
    <li
      className="rounded-lg border border-card-border bg-background/40 p-2.5"
      data-testid={`dt-pillar-${pillar.planetIndex ?? "lagna"}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] text-foreground leading-snug">{t(pillar.note)}</p>
          {!isSign && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${st.dot}`}
                  style={{ width: `${Math.max(4, Math.min(100, pillar.strengthPoints))}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                {pillar.strengthPoints}/100
              </span>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function DashaTransitTab({ chart }: Props) {
  const { t } = useLang();
  const [showEarlier, setShowEarlier] = useState(false);

  if (!chart) {
    return (
      <Card
        className="p-6 text-center text-muted-foreground"
        data-testid="dashatransit-need-chart"
      >
        {t(UI.dashNeedChart)}
      </Card>
    );
  }

  // Computed server-side and attached to the chart (same pattern as riseFall).
  const result = chart.dashaTransit;

  const overallTs = toneStyle(dispTone(result.overall));
  const running = [result.running.maha, result.running.bhukti, result.running.antara].filter(
    (r): r is LordReading => !!r,
  );
  const dt = result.doubleTransit;
  const dtTs = toneStyle(dt.finding.tone);

  // Split the timeline: periods from 1990 onward show by default; the older
  // 1900–1990 stretch stays collapsed behind a toggle.
  const earlierPeriods = result.timeline.filter((p) => isEarlier(p.end));
  const recentPeriods = result.timeline.filter((p) => !isEarlier(p.end));

  return (
    <div className="space-y-6" data-testid="dashatransit-tab">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <CalendarClock className="h-5 w-5 text-primary" />
          {t(UI.dashaTransitTitle)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 leading-snug">
          {t(UI.dashaTransitSubtitle)}
        </p>
      </div>

      {/* Overall headline */}
      <Card className={`p-4 border ${overallTs.border}`} data-testid="card-dt-overall">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> {t(UI.dtOverall)}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${overallTs.chip}`}
            data-testid="badge-dt-overall"
          >
            {overallTs.icon} {t(overallTs.labelKey)}
          </span>
        </div>
        <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
          <p
            className="text-sm font-medium leading-snug text-foreground"
            data-testid="text-dt-overall-headline"
          >
            {t(result.overallHeadline)}
          </p>
        </div>
      </Card>

      {/* Lifetime foundation — Lagna, Lagna lord, Sani, 8th lord */}
      <Card className="p-4" data-testid="card-dt-lifetime">
        <div className="flex items-center gap-2 font-medium">
          <Anchor className="h-4 w-4 text-primary" /> {t(UI.dtLifetimeTitle)}
        </div>
        <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
          <p
            className="text-[13px] font-medium leading-snug text-foreground"
            data-testid="text-dt-lifetime-headline"
          >
            {t(result.lifetime.headline)}
          </p>
        </div>
        <ul className="mt-3 space-y-2" data-testid="dt-lifetime-pillars">
          {result.lifetime.pillars.map((p, pi) => (
            <PillarRow key={pi} pillar={p} t={t} />
          ))}
        </ul>
      </Card>

      {/* Running dasha lords */}
      <Card className="p-4" data-testid="card-dt-running">
        <div className="flex items-center gap-2 font-medium">
          <Clock className="h-4 w-4 text-primary" /> {t(UI.dtRunningTitle)}
        </div>
        <div className="mt-3 space-y-2">
          {running.map((r) => (
            <LordCard key={r.level} reading={r} />
          ))}
        </div>
      </Card>

      {/* Jupiter–Saturn double transit */}
      <Card className={`p-4 border ${dtTs.border}`} data-testid="card-dt-double">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-medium">
            <Orbit className="h-4 w-4 text-primary" /> {t(UI.dtDoubleTransit)}
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${dtTs.chip}`}
            data-testid="badge-dt-double"
          >
            {dtTs.icon} {t(dtTs.labelKey)}
          </span>
        </div>
        <p className="text-sm text-foreground/80 mt-2 leading-snug">
          {t(dt.finding.verdict)}
        </p>
        {dt.finding.reasons.length > 0 && (
          <ul className="mt-2 space-y-1">
            {dt.finding.reasons.map((r, ri) => (
              <li
                key={ri}
                className="text-[12px] text-muted-foreground flex gap-1.5 leading-snug"
              >
                <span className="text-primary/60 mt-[3px]">•</span>
                <span>{t(r)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Timeline — from 1990 (older periods back to 1900 on demand) & next 5 years */}
      <Card className="p-4" data-testid="card-dt-timeline">
        <div className="flex items-center gap-2 font-medium">
          <CalendarClock className="h-4 w-4 text-primary" /> {t(UI.dtTimelineTitle)}
        </div>

        {/* Earlier periods (1900–1990) — collapsed by default */}
        {earlierPeriods.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowEarlier((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-card-border bg-muted/30 px-3 py-2 text-[12px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
              data-testid="button-dt-toggle-earlier"
            >
              <span className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                {t(showEarlier ? UI.dtHideEarlier : UI.dtShowEarlier)} ({earlierPeriods.length})
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showEarlier ? "rotate-180" : ""}`}
              />
            </button>
            {showEarlier && (
              <div className="mt-2 space-y-2" data-testid="dt-earlier-list">
                {earlierPeriods.map((p, pi) => renderTimelineRow(p, `early-${pi}`, t))}
              </div>
            )}
          </div>
        )}

        {/* Periods from 1990 onward — shown by default */}
        <div className="mt-3 space-y-2">
          {recentPeriods.map((p, pi) => renderTimelineRow(p, `recent-${pi}`, t))}
        </div>
      </Card>

      {/* Disclaimer */}
      <Card className="p-4 bg-muted/30" data-testid="card-dt-disclaimer">
        <p className="text-[12px] text-muted-foreground leading-snug">
          {t(result.disclaimer)}
        </p>
      </Card>
    </div>
  );
}
