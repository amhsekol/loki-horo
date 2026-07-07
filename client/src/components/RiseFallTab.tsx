import { useLang } from "@/lib/lang";
import { UI, type Bilingual } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import type {
  OutcomeClass,
  YogaStrength,
  TransitPattern,
} from "@shared/astro/rise-fall-analysis";
import { Card } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Crown,
  Compass,
  Timer,
  Sparkles,
  Home,
} from "lucide-react";
import { toneStyle } from "./KNRaoTab";

interface Props {
  chart: ChartResult | null;
}

// Outcome → colour grammar + icon + label. Rise = green, Surprise = amber,
// Fall = red. Kept visually consistent with the toneStyle palette.
function outcomeStyle(outcome: OutcomeClass): {
  icon: JSX.Element;
  chip: string;
  ring: string;
  labelKey: Bilingual;
} {
  switch (outcome) {
    case "rise":
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
        ring: "border-emerald-500/40",
        labelKey: UI.outcomeRise,
      };
    case "surprise":
      return {
        icon: <Zap className="h-4 w-4" />,
        chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
        ring: "border-amber-500/40",
        labelKey: UI.outcomeSurprise,
      };
    default:
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        chip: "bg-destructive/12 text-destructive",
        ring: "border-destructive/40",
        labelKey: UI.outcomeFall,
      };
  }
}

function yogaStrengthLabel(s: YogaStrength): Bilingual {
  switch (s) {
    case "strong":
      return UI.yogaStrong;
    case "moderate":
      return UI.yogaModerate;
    default:
      return UI.yogaOrdinary;
  }
}

function transitLabel(p: TransitPattern): Bilingual {
  switch (p) {
    case "bless-give":
      return UI.patternBlessGive;
    case "torment-protect":
      return UI.patternTormentProtect;
    case "torment-withdraw":
      return UI.patternTormentWithdraw;
    case "combine-destroy":
      return UI.patternCombineDestroy;
    default:
      return UI.patternNeutral;
  }
}

// Icons for the four analysis stages, keyed by stage.key.
function stageIcon(key: string): JSX.Element {
  switch (key) {
    case "yogas":
      return <Crown className="h-4 w-4 text-primary" />;
    case "transit":
      return <Compass className="h-4 w-4 text-primary" />;
    case "dasha":
      return <Timer className="h-4 w-4 text-primary" />;
    default:
      return <Sparkles className="h-4 w-4 text-primary" />;
  }
}

export function RiseFallTab({ chart }: Props) {
  const { t } = useLang();

  if (!chart) {
    return (
      <Card
        className="p-6 text-center text-muted-foreground"
        data-testid="risefall-need-chart"
      >
        {t(UI.dashNeedChart)}
      </Card>
    );
  }

  const rf = chart.riseFall;
  const os = outcomeStyle(rf.outcome);

  return (
    <div className="space-y-6" data-testid="risefall-tab">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <TrendingUp className="h-5 w-5 text-primary" />
          {t(UI.riseFallTitle)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 leading-snug">
          {t(UI.riseFallSubtitle)}
        </p>
      </div>

      {/* Headline + outcome verdict */}
      <Card className={`p-4 border ${os.ring}`} data-testid="card-risefall-headline">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> {t(UI.riseFallHeadline)}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${os.chip}`}
            data-testid="badge-risefall-outcome"
          >
            {os.icon} {t(os.labelKey)}
          </span>
        </div>
        <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
          <p
            className="text-sm font-medium leading-snug text-foreground"
            data-testid="text-risefall-headline"
          >
            {t(rf.headline)}
          </p>
        </div>

        {/* Confidence meter */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-muted-foreground">{t(UI.riseFallConfidence)}</span>
            <span
              className="font-semibold tabular-nums text-foreground"
              data-testid="text-risefall-confidence"
            >
              {rf.confidence}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${rf.confidence}%` }}
              data-testid="bar-risefall-confidence"
            />
          </div>
        </div>
      </Card>

      {/* Key signals grid */}
      <Card className="p-4" data-testid="card-risefall-signals">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className="rounded-lg border border-card-border bg-card p-3"
            data-testid="signal-yoga"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
              <Crown className="h-3.5 w-3.5" /> {t(UI.riseFallYogaStrength)}
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {t(yogaStrengthLabel(rf.yogaStrength))}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {t(UI.riseFallYogaCount)}: {rf.yogaCount}
            </div>
          </div>

          <div
            className="rounded-lg border border-card-border bg-card p-3"
            data-testid="signal-transit"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
              <Compass className="h-3.5 w-3.5" /> {t(UI.riseFallTransit)}
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground leading-snug">
              {t(transitLabel(rf.transitPattern))}
            </div>
          </div>

          <div
            className="rounded-lg border border-card-border bg-card p-3 sm:col-span-2"
            data-testid="signal-housefocus"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
              <Home className="h-3.5 w-3.5" /> {t(UI.riseFallHouseFocus)}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rf.houseFocus.map((h) => (
                <span
                  key={h}
                  className="text-[12px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary"
                  data-testid={`chip-house-${h}`}
                >
                  {t(UI.riseFallHouseLabel)} {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Four analysis stages: Yogas, Double-transit, Dasha, Synthesis */}
      {rf.stages.map((stage, si) => (
        <Card key={stage.key} className="p-4" data-testid={`card-stage-${stage.key}`}>
          <div className="flex items-center gap-2 font-medium">
            {stageIcon(stage.key)} {t(stage.title)}
          </div>
          <div className="mt-3 space-y-2">
            {stage.findings.map((f, fi) => {
              const ts = toneStyle(f.tone);
              return (
                <div
                  key={fi}
                  data-testid={`stage-${stage.key}-finding-${fi}`}
                  className={`rounded-lg border ${ts.border} bg-card overflow-hidden`}
                >
                  <div className="flex">
                    <div className={`w-1 shrink-0 ${ts.bar}`} />
                    <div className="flex-1 p-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="font-medium text-sm">{t(f.title)}</div>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${ts.chip}`}
                        >
                          {ts.icon} {t(ts.labelKey)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 mt-1 leading-snug">
                        {t(f.verdict)}
                      </p>
                      {f.reasons.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {f.reasons.map((r, ri) => (
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
            })}
          </div>
          {/* Suppress unused-var lint on si */}
          <span className="hidden">{si}</span>
        </Card>
      ))}

      {/* Disclaimer */}
      <Card className="p-4 bg-muted/30" data-testid="card-risefall-disclaimer">
        <p className="text-[12px] text-muted-foreground leading-snug">
          {t(rf.disclaimer)}
        </p>
      </Card>
    </div>
  );
}
