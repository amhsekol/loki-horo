import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/lib/lang";
import { UI, type Bilingual } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import { matchRules, type ValuBand, type MatchableRule } from "@shared/astro/guruji-analysis";
import type { Rule } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Sun, BarChart3, Sparkles, BookMarked, ChevronDown, Library } from "lucide-react";
import { toneStyle } from "./KNRaoTab";
import { RULE_CATEGORIES, categoryLabel, ruleTitle, ruleBody, planetName } from "@/lib/rules";

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
