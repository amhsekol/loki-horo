import { useLang } from "@/lib/lang";
import { UI } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import type { DignityResult } from "@shared/astro/dignity";
import { Card } from "@/components/ui/card";
import { Compass, Crown, Sparkles, Eye, Link2, Gauge } from "lucide-react";

interface Props {
  chart: ChartResult | null;
}

function fmtDeg(d: number): string {
  const deg = Math.floor(d);
  const min = Math.round((d - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}′`;
}

// Dignity chip color by strength points.
function dignityTone(dig: DignityResult | null): string {
  if (!dig) return "bg-muted text-muted-foreground";
  if (dig.points >= 80) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (dig.points >= 40) return "bg-primary/15 text-primary";
  if (dig.points >= 20) return "bg-muted text-foreground";
  return "bg-destructive/15 text-destructive";
}

export function LagnaDashboard({ chart }: Props) {
  const { lang, t } = useLang();

  if (!chart) {
    return (
      <Card className="p-6 text-center text-muted-foreground" data-testid="dash-need-chart">
        {t(UI.dashNeedChart)}
      </Card>
    );
  }

  const la = chart.lagnaAnalysis;
  const sb = chart.lagnaLordShadbala;

  const DignityChip = ({ dig }: { dig: DignityResult | null }) =>
    dig ? (
      <span className={`text-xs px-2 py-0.5 rounded-full ${dignityTone(dig)}`}>
        {t(dig.label)}
      </span>
    ) : null;

  // Shadbala bar: scale each component's virupas against a nominal 150 max for the bar.
  const maxComp = sb ? Math.max(60, ...sb.components.map((c) => Math.abs(c.virupas))) : 60;

  const verdictTone =
    sb == null
      ? ""
      : sb.ratio >= 1.1
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
      : sb.ratio >= 0.9
      ? "bg-primary/15 text-primary border-primary/40"
      : "bg-destructive/15 text-destructive border-destructive/40";

  return (
    <div className="space-y-6" data-testid="lagna-dashboard">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          {t(UI.dashTitle)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.dashSubtitle)}</p>
      </div>

      {/* Lagna + Lord summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4" data-testid="card-lagna-summary">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Compass className="h-4 w-4" /> {t(UI.lagnaHeading)}
          </div>
          <div className="mt-1 text-lg font-semibold" data-testid="text-lagna-sign">
            {t(la.lagnaSign)}
          </div>
          <div className="text-sm text-muted-foreground">{fmtDeg(la.lagnaDeg)}</div>
        </Card>

        <Card className="p-4" data-testid="card-lord-summary">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4" /> {t(UI.lagnaLord)}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-lg font-semibold" data-testid="text-lord-name">
              {t(la.lord.name)}
            </span>
            {la.lord.retrograde && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {t(UI.retro)}
              </span>
            )}
            <DignityChip dig={la.lord.dignity} />
          </div>
          <div className="text-sm text-muted-foreground">
            {t(UI.inSign)} {t(la.lord.sign)} · {fmtDeg(la.lord.degInRasi)} ·{" "}
            {la.lord.houseFromLagna}{lang === "ta" ? "-ஆம் " : ""} {t(UI.house)}
          </div>
        </Card>
      </div>

      {/* Lagna lord strength (Shadbala) */}
      {sb && (
        <Card className="p-4" data-testid="card-shadbala">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 font-medium">
              <Gauge className="h-4 w-4 text-primary" /> {t(UI.lordStrength)}
            </div>
            <span
              className={`text-sm px-2.5 py-1 rounded-full border font-medium ${verdictTone}`}
              data-testid="text-verdict"
            >
              {t(sb.verdict)}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-3 flex-wrap text-sm">
            <span className="text-2xl font-semibold text-foreground" data-testid="text-total-rupas">
              {sb.totalRupas.toFixed(2)}
            </span>
            <span className="text-muted-foreground">
              {t(UI.rupas)} · {t(UI.required)} {sb.requiredRupas.toFixed(1)} ·{" "}
              {(sb.ratio * 100).toFixed(0)}%
            </span>
          </div>

          {/* Component bars */}
          <div className="mt-4 space-y-2.5">
            {sb.components.map((c) => {
              const pct = Math.max(0, Math.min(100, (c.virupas / maxComp) * 100));
              const neg = c.virupas < 0;
              return (
                <div key={c.key} data-testid={`bala-${c.key}`}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground">{t(c.label)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {c.virupas.toFixed(1)} {t(UI.virupas)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${neg ? "bg-destructive/70" : "bg-primary/70"}`}
                      style={{ width: `${neg ? 12 : pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Planets in Lagna */}
      <Card className="p-4" data-testid="card-planets-in-lagna">
        <div className="flex items-center gap-2 font-medium mb-3">
          <Sparkles className="h-4 w-4 text-primary" /> {t(UI.planetsInLagna)}
        </div>
        {la.planetsInLagna.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(UI.nonePlanetsInLagna)}</p>
        ) : (
          <ul className="space-y-2">
            {la.planetsInLagna.map((p) => (
              <li
                key={p.index}
                className="flex items-center gap-2 flex-wrap text-sm"
                data-testid={`in-lagna-${p.index}`}
              >
                <span className="font-medium">{t(p.name)}</span>
                <span className="text-muted-foreground">{fmtDeg(p.degInRasi)}</span>
                {p.retrograde && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {t(UI.retro)}
                  </span>
                )}
                <DignityChip dig={p.dignity} />
                {p.tightConjunction && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {t(UI.tightConj)} · {fmtDeg(p.gapFromAscDeg)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Aspects to Lagna */}
      <Card className="p-4" data-testid="card-aspects-lagna">
        <div className="flex items-center gap-2 font-medium mb-3">
          <Eye className="h-4 w-4 text-primary" /> {t(UI.aspectsToLagna)}
        </div>
        {la.aspectsToLagna.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(UI.noneAspects)}</p>
        ) : (
          <ul className="space-y-2">
            {la.aspectsToLagna.map((a) => (
              <li
                key={a.index}
                className="flex items-center gap-2 flex-wrap text-sm"
                data-testid={`aspect-lagna-${a.index}`}
              >
                <span className="font-medium">{t(a.name)}</span>
                <span className="text-muted-foreground">
                  {t(UI.inSign)} {t(a.fromSign)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground">
                  {t(a.aspectLabel)}
                </span>
                <DignityChip dig={a.dignity} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Lagna lord conjunctions + aspects */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4" data-testid="card-lord-conjunctions">
          <div className="flex items-center gap-2 font-medium mb-3">
            <Link2 className="h-4 w-4 text-primary" /> {t(UI.lordConjunctions)}
          </div>
          {la.lord.conjunctions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(UI.noneConjunctions)}</p>
          ) : (
            <ul className="space-y-2">
              {la.lord.conjunctions.map((c) => (
                <li
                  key={c.index}
                  className="flex items-center gap-2 flex-wrap text-sm"
                  data-testid={`lord-conj-${c.index}`}
                >
                  <span className="font-medium">{t(c.name)}</span>
                  <span className="text-muted-foreground">
                    {t(UI.degGap)} {fmtDeg(c.gapDeg)}
                  </span>
                  {c.tight && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      {t(UI.tightConj)}
                    </span>
                  )}
                  <DignityChip dig={c.dignity} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4" data-testid="card-lord-aspected">
          <div className="flex items-center gap-2 font-medium mb-3">
            <Eye className="h-4 w-4 text-primary" /> {t(UI.lordAspectedBy)}
          </div>
          {la.lord.aspectedBy.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(UI.noneAspects)}</p>
          ) : (
            <ul className="space-y-2">
              {la.lord.aspectedBy.map((a) => (
                <li
                  key={a.index}
                  className="flex items-center gap-2 flex-wrap text-sm"
                  data-testid={`lord-aspect-${a.index}`}
                >
                  <span className="font-medium">{t(a.name)}</span>
                  <span className="text-muted-foreground">
                    {t(UI.inSign)} {t(a.fromSign)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground">
                    {t(a.aspectLabel)}
                  </span>
                  <DignityChip dig={a.dignity} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
