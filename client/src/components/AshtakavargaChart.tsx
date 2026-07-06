import { useLang } from "@/lib/lang";
import { UI, RASIS, GRAHAS, GRAHA_SHORT } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import { Card } from "@/components/ui/card";
import { Grid3x3, Sparkles } from "lucide-react";

interface Props {
  chart: ChartResult | null;
}

// South Indian fixed 4x4 cell layout (same as RasiGrid): signIndex -> {r,c}
const CELL: Record<number, { r: number; c: number }> = {
  11: { r: 1, c: 1 }, 0: { r: 1, c: 2 }, 1: { r: 1, c: 3 }, 2: { r: 1, c: 4 },
  10: { r: 2, c: 1 }, 3: { r: 2, c: 4 },
  9: { r: 3, c: 1 }, 4: { r: 3, c: 4 },
  8: { r: 4, c: 1 }, 7: { r: 4, c: 2 }, 6: { r: 4, c: 3 }, 5: { r: 4, c: 4 },
};

// SAV strength tone by bindu count (classical avg is 28).
function savTone(v: number): string {
  if (v >= 30) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
  if (v >= 25) return "bg-primary/10 text-foreground";
  return "bg-destructive/10 text-destructive";
}

/**
 * A compact South Indian style grid of 12 signs, each showing a number.
 * @param values bindu per sign (0..11)
 * @param highlightSign the reference planet/lagna sign to highlight
 * @param center center label (planet short / "SAV")
 * @param toneFn optional per-cell tone based on value (used for SAV)
 */
function AvGrid({
  values,
  highlightSign,
  center,
  total,
  toneFn,
  testid,
}: {
  values: number[];
  highlightSign: number;
  center: string;
  total?: number;
  toneFn?: (v: number) => string;
  testid: string;
}) {
  const { lang } = useLang();
  return (
    <div className="w-full" data-testid={testid}>
      <div
        className="grid gap-0.5 aspect-square w-full"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(4, 1fr)" }}
      >
        {Object.entries(CELL).map(([signStr, pos]) => {
          const sign = Number(signStr);
          const v = values[sign] ?? 0;
          const isHi = sign === highlightSign;
          const tone = toneFn ? toneFn(v) : "";
          return (
            <div
              key={sign}
              className={`relative rounded-[4px] border flex flex-col items-center justify-center ${
                isHi
                  ? "border-primary ring-1 ring-primary/50 bg-primary/5"
                  : "border-card-border bg-card"
              } ${tone}`}
              style={{ gridColumn: pos.c, gridRow: pos.r }}
              data-testid={`${testid}-cell-${sign}`}
            >
              <span className="absolute top-0.5 left-1 text-[7px] leading-none text-muted-foreground">
                {RASIS[sign][lang].split(" (")[0].slice(0, 3)}
              </span>
              <span className="text-sm font-semibold tabular-nums">{v}</span>
            </div>
          );
        })}
        {/* center */}
        <div
          className="flex flex-col items-center justify-center rounded-[4px] bg-secondary/40 border border-card-border"
          style={{ gridColumn: "2 / 4", gridRow: "2 / 4" }}
        >
          <span className="font-serif text-sm text-primary/80">{center}</span>
          {total !== undefined && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{total}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const AV_PLANETS = [0, 1, 2, 3, 4, 5, 6]; // Sun..Saturn

export function AshtakavargaChart({ chart }: Props) {
  const { lang, t } = useLang();

  if (!chart) {
    return (
      <Card className="p-6 text-center text-muted-foreground" data-testid="av-need-chart">
        {t(UI.dashNeedChart)}
      </Card>
    );
  }

  const av = chart.ashtakavarga;
  const planetSign = (idx: number) => chart.planets[idx].rasiIndex;
  const lagnaSign = chart.lagna.rasiIndex;

  // Strong signs (SAV >= 30) for a quick readout.
  const strong = av.sav
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v >= 30)
    .sort((a, b) => b.v - a.v);

  return (
    <div className="space-y-6" data-testid="ashtakavarga">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Grid3x3 className="h-5 w-5 text-primary" />
          {t(UI.ashtakavarga)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.ashtakavargaSubtitle)}</p>
      </div>

      {/* SAV — the headline chart */}
      <Card className="p-4" data-testid="card-sav">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> {t(UI.sav)}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{t(UI.savDesc)}</p>

        <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,320px)_1fr] items-start">
          <div className="max-w-[320px]">
            <AvGrid
              values={av.sav}
              highlightSign={lagnaSign}
              center={t(UI.sav).split(" ")[0]}
              total={av.savTotal}
              toneFn={savTone}
              testid="grid-sav"
            />
          </div>

          {/* Strong signs readout */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {t(UI.strongSigns)}
            </div>
            {strong.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1.5" data-testid="sav-strong-list">
                {strong.map((s) => (
                  <li
                    key={s.i}
                    className="flex items-center gap-2 text-sm"
                    data-testid={`sav-strong-${s.i}`}
                  >
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tabular-nums">
                      {s.v}
                    </span>
                    <span className="font-medium">{RASIS[s.i][lang].split(" (")[0]}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/40" /> 30+
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary/20" /> 25–29
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-destructive/20" /> &lt;25
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Per-planet BAV mini charts */}
      <Card className="p-4" data-testid="card-bav">
        <div className="flex items-center gap-2 font-medium mb-3">
          <Grid3x3 className="h-4 w-4 text-primary" /> {t(UI.bavPerPlanet)}
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {AV_PLANETS.map((g) => (
            <div key={g} data-testid={`bav-block-${g}`}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-medium">{t(GRAHAS[g])}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {av.bavTotals[g]} {t(UI.bindus)}
                </span>
              </div>
              <AvGrid
                values={av.bav[g]}
                highlightSign={planetSign(g)}
                center={GRAHA_SHORT[g][lang]}
                testid={`grid-bav-${g}`}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
