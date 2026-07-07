import { useLang } from "@/lib/lang";
import { UI } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import { Card } from "@/components/ui/card";
import { UserCircle, Sparkles, History, HelpCircle, Info } from "lucide-react";

interface Props {
  chart: ChartResult | null;
}

// Probability → colour band for the meter.
function probStyle(p: number): { bar: string; chip: string } {
  if (p >= 70) return { bar: "bg-emerald-500", chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" };
  if (p >= 55) return { bar: "bg-sky-500", chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400" };
  if (p >= 45) return { bar: "bg-amber-500", chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400" };
  return { bar: "bg-muted-foreground/60", chip: "bg-muted text-muted-foreground" };
}

export function PersonaTab({ chart }: Props) {
  const { t } = useLang();

  if (!chart) {
    return (
      <Card className="p-6 text-center text-muted-foreground" data-testid="persona-need-chart">
        {t(UI.dashNeedChart)}
      </Card>
    );
  }

  const p = chart.personaAnalysis;

  return (
    <div className="space-y-6" data-testid="persona-tab">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <UserCircle className="h-5 w-5 text-primary" />
          {t(UI.personaTitle)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.personaSubtitle)}</p>
      </div>

      {/* Summary */}
      <Card className="p-4 border-primary/30" data-testid="card-persona-summary">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> {t(UI.personaTitle)}
        </div>
        <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
          <p className="text-sm font-medium leading-relaxed" data-testid="text-persona-summary">
            {t(p.summary)}
          </p>
        </div>
      </Card>

      {/* Character traits */}
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold mb-3">
          <UserCircle className="h-4 w-4 text-primary" />
          {t(UI.characterHeading)}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {p.characterTraits.map((tr, i) => (
            <Card key={i} className="p-4 flex flex-col gap-2" data-testid={`persona-trait-${i}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold leading-snug">{t(tr.title)}</span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {t(tr.source)}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{t(tr.detail)}</p>
              <div className="mt-1 rounded-md bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <HelpCircle className="h-3 w-3" /> {t(UI.whyLabel)}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(tr.why)}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Past events */}
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold mb-3">
          <History className="h-4 w-4 text-primary" />
          {t(UI.pastEventsHeading)}
        </h3>
        <div className="space-y-3">
          {p.pastEvents.map((ev, i) => {
            const ps = probStyle(ev.probability);
            return (
              <Card key={i} className="p-4 flex flex-col gap-2.5" data-testid={`persona-event-${i}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-snug">{t(ev.period)}</div>
                    <div className="text-xs text-muted-foreground">{ev.ageRange}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ps.chip}`}
                    data-testid={`persona-event-prob-${i}`}
                  >
                    {ev.probability}%
                  </span>
                </div>

                <p className="text-sm leading-relaxed">{t(ev.prediction)}</p>

                {/* probability meter */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    <span>{t(UI.probabilityLabel)}</span>
                    <span>{ev.probability}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${ps.bar}`}
                      style={{ width: `${ev.probability}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <HelpCircle className="h-3 w-3" /> {t(UI.whyLabel)}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(ev.why)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground" data-testid="persona-disclaimer">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{t(UI.personaDisclaimer)}</span>
      </div>
    </div>
  );
}
