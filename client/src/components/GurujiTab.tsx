import { useLang } from "@/lib/lang";
import { UI, type Bilingual } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import type { ValuBand } from "@shared/astro/guruji-analysis";
import { Card } from "@/components/ui/card";
import { Sun, BarChart3, Sparkles } from "lucide-react";
import { toneStyle } from "./KNRaoTab";

interface Props {
  chart: ChartResult | null;
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

export function GurujiTab({ chart }: Props) {
  const { t } = useLang();

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
