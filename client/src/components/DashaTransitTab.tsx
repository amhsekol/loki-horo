import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  ProbBand,
  WealthDir,
  LifeEvent,
} from "@shared/astro/dasha-transit-analysis";
import type { PeriodOutcome } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  ChevronRight,
  History,
  Anchor,
  Gauge,
  Heart,
  Baby,
  TrendingUp,
  TrendingDown,
  Wallet,
  MessageSquarePlus,
  Check,
  CircleDot,
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
  chartId: number | null;
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

type TFn = (b: Bilingual | undefined, override?: "ta" | "en" | "hi") => string;

// Probability band → colour grammar for the confidence badge.
function probBandStyle(band: ProbBand): string {
  switch (band) {
    case "very-likely":
    case "likely":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "unlikely":
    case "very-unlikely":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  }
}

// Likelihood band → small dot colour for life events.
function likelihoodDot(band: ProbBand): string {
  switch (band) {
    case "very-likely":
    case "likely":
      return "text-emerald-500";
    case "unlikely":
    case "very-unlikely":
      return "text-destructive";
    default:
      return "text-amber-500";
  }
}

// Wealth-window direction → colour + icon.
function wealthStyle(dir: WealthDir): { chip: string; icon: JSX.Element } {
  switch (dir) {
    case "gain":
      return {
        chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        icon: <TrendingUp className="h-3.5 w-3.5" />,
      };
    case "loss":
      return {
        chip: "bg-destructive/15 text-destructive",
        icon: <TrendingDown className="h-3.5 w-3.5" />,
      };
    default:
      return {
        chip: "bg-muted text-muted-foreground",
        icon: <Wallet className="h-3.5 w-3.5" />,
      };
  }
}

// Icon per life-event key.
function eventIcon(key: string): JSX.Element {
  if (key === "marriage") return <Heart className="h-3.5 w-3.5" />;
  if (key === "childbirth") return <Baby className="h-3.5 w-3.5" />;
  return <Star className="h-3.5 w-3.5" />;
}

function ratingChip(rating: string): string {
  switch (rating) {
    case "matched":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "partial":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    default:
      return "bg-destructive/15 text-destructive";
  }
}

type Rating = "matched" | "partial" | "missed";

// The "confirm what happened" feedback form, shown only on PAST periods.
// Mirrors the IncidentsTab react-query pattern. Requires a saved chartId.
function OutcomeFeedback({
  p,
  chartId,
  t,
}: {
  p: TimelinePeriod;
  chartId: number | null;
  t: TFn;
}) {
  const periodKey = `${p.level}:${p.start}:${p.end}`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rating, setRating] = useState<Rating>("matched");

  const listQuery = useQuery<PeriodOutcome[]>({
    queryKey: ["/api/charts", chartId, "outcomes"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/charts/${chartId}/outcomes`);
      return r.json();
    },
    enabled: chartId != null,
  });

  const existing = (listQuery.data ?? []).find((o) => o.periodKey === periodKey);

  const saveMut = useMutation<PeriodOutcome, Error, void>({
    mutationFn: async () => {
      if (chartId == null) throw new Error("No chart");
      const r = await apiRequest("POST", "/api/outcomes", {
        chartId,
        periodKey,
        level: p.level,
        lordLabel: p.label.en,
        periodStart: p.start,
        periodEnd: p.end,
        predictedBand: p.probability.band,
        predictedPercent: p.probability.percent,
        rating,
        actualOutcome: text.trim(),
      });
      return r.json();
    },
    onSuccess: () => {
      setOpen(false);
      setText("");
      queryClient.invalidateQueries({ queryKey: ["/api/charts", chartId, "outcomes"] });
    },
  });

  // No saved chart — gently prompt to save first.
  if (chartId == null) {
    return (
      <div className="mt-2 text-[11px] text-muted-foreground/80 italic" data-testid={`dt-outcome-needsave-${periodKey}`}>
        {t(UI.dtNeedSaveChart)}
      </div>
    );
  }

  // Already recorded — show the logged outcome + rating.
  if (existing) {
    return (
      <div
        className="mt-2 rounded-md border border-card-border bg-background/50 px-2.5 py-2"
        data-testid={`dt-outcome-recorded-${periodKey}`}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-muted-foreground">{t(UI.dtRecorded)}</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full ${ratingChip(existing.rating)}`}>
            {t(
              existing.rating === "matched"
                ? UI.dtRatingMatched
                : existing.rating === "partial"
                  ? UI.dtRatingPartial
                  : UI.dtRatingMissed,
            )}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] text-foreground/80 leading-snug">{existing.actualOutcome}</p>
      </div>
    );
  }

  // Not yet recorded — collapsed trigger, expands to a form.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
        data-testid={`dt-outcome-open-${periodKey}`}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        {t(UI.dtRecordThis)}
      </button>
    );
  }

  const ratings: { key: Rating; label: Bilingual }[] = [
    { key: "matched", label: UI.dtRatingMatched },
    { key: "partial", label: UI.dtRatingPartial },
    { key: "missed", label: UI.dtRatingMissed },
  ];

  return (
    <div
      className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2.5"
      data-testid={`dt-outcome-form-${periodKey}`}
    >
      <div className="text-[11.5px] font-medium text-foreground">{t(UI.dtFeedbackTitle)}</div>
      <p className="mt-0.5 text-[10.5px] text-muted-foreground leading-snug">{t(UI.dtFeedbackHint)}</p>

      {/* Rating buttons */}
      <div className="mt-2 flex gap-1.5">
        {ratings.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRating(r.key)}
            className={`flex-1 text-[11px] px-2 py-1 rounded-md font-medium border transition-colors ${
              rating === r.key
                ? `${ratingChip(r.key)} border-transparent`
                : "bg-background/60 text-muted-foreground border-card-border hover:bg-muted/40"
            }`}
            data-testid={`dt-outcome-rating-${r.key}-${periodKey}`}
          >
            {t(r.label)}
          </button>
        ))}
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t(UI.dtOutcomePlaceholder)}
        className="mt-2 min-h-[60px] text-[12px]"
        maxLength={2000}
        data-testid={`dt-outcome-text-${periodKey}`}
      />

      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          disabled={text.trim() === "" || saveMut.isPending}
          onClick={() => saveMut.mutate()}
          data-testid={`dt-outcome-save-${periodKey}`}
        >
          <Check className="h-3.5 w-3.5" />
          {saveMut.isPending ? t(UI.loading) : t(UI.dtSaveOutcome)}
        </Button>
      </div>
    </div>
  );
}

// A single timeline period row (used for both the default 1990+ list and the
// collapsible 1900–1990 list). Now a real component so it can host the
// probabilistic layer, life events, money windows, and the feedback loop.
function TimelineRow({
  p,
  rowKey,
  chartId,
  t,
}: {
  p: TimelinePeriod;
  rowKey: string;
  chartId: number | null;
  t: TFn;
}) {
  const st = timelineStyle(p.disposition);
  const ws = wealthStyle(p.wealthTiming.direction);
  return (
    <div
      className={`rounded-lg border border-card-border bg-card p-3 ${
        p.status === "current" ? "ring-1 ring-primary/40" : ""
      }`}
      data-testid={`dt-timeline-${rowKey}`}
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

          {/* Probability / confidence badge */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full font-medium ${probBandStyle(
                p.probability.band,
              )}`}
              data-testid={`dt-prob-${rowKey}`}
            >
              <Gauge className="h-3 w-3" />
              {t(p.probability.label)}
            </span>
          </div>

          {/* Money-making vs loss window (with duration) */}
          <div
            className={`mt-1.5 rounded-md px-2 py-1.5 ${ws.chip}`}
            data-testid={`dt-wealth-${rowKey}`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {ws.icon}
              {t(p.wealthTiming.label)}
            </div>
            <p className="mt-0.5 text-[10.5px] opacity-90 leading-snug">
              {t(p.wealthTiming.note)}
            </p>
          </div>

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

          {/* Key life areas */}
          {p.lifeAreaCalls && p.lifeAreaCalls.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <CircleDot className="h-3 w-3" /> {t(UI.dtLifeAreas)}
              </div>
              <ul className="mt-1 space-y-0.5">
                {p.lifeAreaCalls.map((a, ai) => (
                  <li
                    key={ai}
                    className="text-[11.5px] text-foreground/80 flex gap-1.5 leading-snug"
                  >
                    <ChevronRight className="h-3 w-3 mt-[2px] text-primary/60 shrink-0" />
                    <span>{t(a)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Important life events — marriage / childbirth (count + gender) / etc. */}
          {p.lifeEvents && p.lifeEvents.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {t(UI.dtLifeEvents)}
              </div>
              <ul className="mt-1 space-y-1.5">
                {p.lifeEvents.map((e: LifeEvent, ei) => (
                  <li
                    key={ei}
                    className="rounded-md border border-card-border bg-background/40 px-2 py-1.5"
                    data-testid={`dt-event-${e.key}-${rowKey}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
                      <span className={likelihoodDot(e.likelihood)}>{eventIcon(e.key)}</span>
                      {t(e.label)}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                      {t(e.note)}
                    </p>
                    {e.detail && (
                      <p className="mt-0.5 text-[11px] text-foreground/80 leading-snug">
                        {t(e.detail)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* "Confirm what happened" feedback — PAST periods only */}
          {p.status === "past" && <OutcomeFeedback p={p} chartId={chartId} t={t} />}
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

export function DashaTransitTab({ chart, chartId }: Props) {
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
                {earlierPeriods.map((p, pi) => (
                  <TimelineRow key={`early-${pi}`} p={p} rowKey={`early-${pi}`} chartId={chartId} t={t} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Periods from 1990 onward — shown by default */}
        <div className="mt-3 space-y-2">
          {recentPeriods.map((p, pi) => (
            <TimelineRow key={`recent-${pi}`} p={p} rowKey={`recent-${pi}`} chartId={chartId} t={t} />
          ))}
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
