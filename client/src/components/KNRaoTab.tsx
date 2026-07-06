import { useLang } from "@/lib/lang";
import { UI } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import { Card } from "@/components/ui/card";
import { BookOpen, Crown, Timer, Target, Compass } from "lucide-react";

interface Props {
  chart: ChartResult | null;
}

function fmtDeg(d: number): string {
  const deg = Math.floor(d);
  const min = Math.round((d - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}′`;
}

export function KNRaoTab({ chart }: Props) {
  const { lang, t } = useLang();

  if (!chart) {
    return (
      <Card className="p-6 text-center text-muted-foreground" data-testid="knrao-need-chart">
        {t(UI.dashNeedChart)}
      </Card>
    );
  }

  const k = chart.knRao;

  // Determine the current Chara Dasha period by age (from birth year to now).
  const birthYear = Number(chart.meta.date.split("-")[0]);
  const nowYear = new Date().getFullYear();
  const ageNow = nowYear - birthYear;
  // Wrap age within the total cycle so a valid current period always resolves.
  const cycleYears = k.charaDasha.reduce((s, p) => s + p.years, 0);
  const ageInCycle = cycleYears > 0 ? ageNow % cycleYears : ageNow;
  let currentIdx = -1;
  for (let i = 0; i < k.charaDasha.length; i++) {
    const p = k.charaDasha[i];
    if (ageInCycle >= p.startAge && ageInCycle < p.startAge + p.years) {
      currentIdx = i;
      break;
    }
  }

  const bb = k.bhriguBindu;
  const sl = k.specialLagnas;

  const LagnaCard = ({
    icon,
    label,
    desc,
    sign,
    testid,
    extra,
  }: {
    icon: React.ReactNode;
    label: string;
    desc: string;
    sign: string;
    testid: string;
    extra?: string;
  }) => (
    <div className="rounded-lg border border-card-border bg-card p-3" data-testid={testid}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-base font-semibold">{sign}</div>
      {extra && <div className="text-xs text-primary">{extra}</div>}
      <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="knrao-tab">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <BookOpen className="h-5 w-5 text-primary" />
          {t(UI.knRaoTitle)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.knRaoSubtitle)}</p>
      </div>

      {/* Chara Karakas */}
      <Card className="p-4" data-testid="card-chara-karakas">
        <div className="flex items-center gap-2 font-medium">
          <Crown className="h-4 w-4 text-primary" /> {t(UI.charaKarakas)}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{t(UI.charaKarakasDesc)}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {k.charaKarakas.map((c) => (
                <tr
                  key={c.roleShort}
                  className="border-b border-border/40 last:border-0"
                  data-testid={`karaka-${c.roleShort}`}
                >
                  <td className="py-2 pr-2 w-14">
                    <span className="inline-flex items-center justify-center min-w-[2.4rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-semibold">
                      {c.roleShort}
                    </span>
                  </td>
                  <td className="py-2 pr-2 font-medium whitespace-nowrap">{t(c.role)}</td>
                  <td className="py-2 pr-2 whitespace-nowrap">{t(c.planet)}</td>
                  <td className="py-2 pr-2 text-muted-foreground tabular-nums whitespace-nowrap">
                    {fmtDeg(c.degInSign)} · {t(c.sign)}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground hidden sm:table-cell">
                    {t(c.meaning)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Chara Dasha */}
      <Card className="p-4" data-testid="card-chara-dasha">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 font-medium">
            <Timer className="h-4 w-4 text-primary" /> {t(UI.charaDasha)}
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {k.charaDashaDirection === "direct" ? t(UI.directSeq) : t(UI.reverseSeq)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{t(UI.charaDashaDesc)}</p>
        <div className="mt-3 space-y-1.5">
          {k.charaDasha.map((p, i) => {
            const isCurrent = i === currentIdx;
            return (
              <div
                key={i}
                data-testid={`chara-period-${p.signIndex}`}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  isCurrent
                    ? "bg-primary/10 border border-primary/40"
                    : "bg-muted/40"
                }`}
              >
                <span className="font-medium min-w-[6.5rem]">{t(p.sign)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {p.years} {t(UI.yearsShort)}
                </span>
                <span className="text-muted-foreground tabular-nums text-xs">
                  {t(UI.ageLabel)} {p.startAge}–{p.startAge + p.years}
                </span>
                <span className="text-muted-foreground tabular-nums text-xs">
                  {p.startYear}
                </span>
                {isCurrent && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                    {t(UI.currentPeriod)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Bhrigu Bindu */}
      <Card className="p-4" data-testid="card-bhrigu-bindu">
        <div className="flex items-center gap-2 font-medium">
          <Target className="h-4 w-4 text-primary" /> {t(UI.bhriguBindu)}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{t(UI.bhriguBinduDesc)}</p>
        <div className="mt-3 flex items-baseline gap-3 flex-wrap">
          <span className="text-lg font-semibold" data-testid="text-bb-sign">
            {t(bb.sign)}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">{fmtDeg(bb.degInSign)}</span>
          <span className="text-sm px-2 py-0.5 rounded-full bg-muted text-foreground">
            {t(bb.nakshatra)}
          </span>
          <span className="text-sm text-muted-foreground">
            {bb.houseFromLagna}{lang === "ta" ? "-ஆம் " : ""} {t(UI.house_)} {t(UI.fromLagna)}
          </span>
        </div>
      </Card>

      {/* Special Lagnas + Karakamsa */}
      <Card className="p-4" data-testid="card-special-lagnas">
        <div className="flex items-center gap-2 font-medium mb-3">
          <Compass className="h-4 w-4 text-primary" /> {t(UI.specialLagnas)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LagnaCard
            icon={<Compass className="h-3.5 w-3.5" />}
            label={t(UI.horaLagna)}
            desc={t(UI.horaLagnaDesc)}
            sign={t(sl.horaLagna)}
            testid="lagna-hora"
          />
          <LagnaCard
            icon={<Compass className="h-3.5 w-3.5" />}
            label={t(UI.ghatikaLagna)}
            desc={t(UI.ghatikaLagnaDesc)}
            sign={t(sl.ghatikaLagna)}
            testid="lagna-ghatika"
          />
          <LagnaCard
            icon={<Compass className="h-3.5 w-3.5" />}
            label={t(UI.arudhaLagna)}
            desc={t(UI.arudhaLagnaDesc)}
            sign={t(sl.arudhaLagna)}
            testid="lagna-arudha"
          />
          <LagnaCard
            icon={<Crown className="h-3.5 w-3.5" />}
            label={t(UI.karakamsa)}
            desc={t(UI.karakamsaDesc)}
            sign={t(sl.karakamsa)}
            extra={t(sl.karakamsaPlanet)}
            testid="lagna-karakamsa"
          />
        </div>
      </Card>
    </div>
  );
}
