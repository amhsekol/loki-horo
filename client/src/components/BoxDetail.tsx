import { useLang } from "@/lib/lang";
import {
  UI, RASIS, NAKSHATRAS, GRAHAS, RASI_LORDS, aspectFromTo, signDistance, tl,
} from "@shared/astro/constants";
import { DIGNITY_LABEL, type Dignity } from "@shared/astro/dignity";
import type { ChartResult } from "@shared/astro/engine";
import { Card } from "@/components/ui/card";
import { DIGNITY_COLOR } from "@/components/RasiGrid";
import { X, Crown, Users, Eye, Info } from "lucide-react";

// Format a fractional degree as  D° MM′ SS″
function fmtDeg(d: number): string {
  const deg = Math.floor(d);
  const minFloat = (d - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);
  return `${deg}° ${String(min).padStart(2, "0")}′ ${String(sec).padStart(2, "0")}″`;
}

interface Props {
  chart: ChartResult;
  sign: number;
  onClose: () => void;
}

// Detail panel for a tapped Rasi (D-1) box. Shows the sign + its house number,
// the sign lord and its power (placement + dignity + strength points), the
// planets occupying this box (degree, nakshatra, pada, dignity), and the
// planets aspecting this box (with the degree each aspecting planet sits at).
export function BoxDetail({ chart, sign, onClose }: Props) {
  const { lang, t } = useLang();

  const lagnaSign = chart.lagna.rasiIndex;
  const houseNum = signDistance(lagnaSign, sign); // 1..12 from lagna

  // Occupants of this sign.
  const occupants = chart.planets.filter((p) => p.rasiIndex === sign);

  // Sign lord (adhipathi) and its full position.
  const lordIndex = RASI_LORDS[sign];
  const lord = chart.planets.find((p) => p.index === lordIndex) ?? null;

  // Planets aspecting THIS sign (whole-sign drishti). Skip planets sitting in it
  // (occupancy is shown separately). Record the drishti number + aspecting
  // planet's own degree within its sign.
  const aspecting = chart.planets
    .map((p) => ({ p, drishti: aspectFromTo(p.index, p.rasiIndex, sign) }))
    .filter(({ p, drishti }) => drishti > 0 && p.rasiIndex !== sign);

  const signName = tl(RASIS[sign], lang).split(" (")[0];

  return (
    <Card className="p-4 md:p-5 border-primary/30" data-testid="box-detail">
      {/* Header: sign name + house, close */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t(UI.boxDetail)}
          </div>
          <div className="font-serif text-lg leading-tight text-foreground" data-testid="box-detail-sign">
            {signName}
            <span className="ml-2 text-sm text-muted-foreground font-sans">
              · {t(UI.houseLabel)} {houseNum}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-testid="button-close-detail"
          aria-label={t(UI.closeDetail)}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover-elevate active-elevate-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Sign lord + its power */}
      <Section icon={<Crown className="h-3.5 w-3.5" />} label={`${t(UI.signLord)} · ${t(UI.lordPower)}`}>
        {lord ? (
          <div className="rounded-md border border-card-border bg-secondary/30 px-3 py-2.5" data-testid="box-lord">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-medium text-foreground">
                {GRAHAS[lord.index][lang].split(" (")[0]}
                {lord.retrograde && <sup className="ml-0.5 text-[10px] text-destructive">{t(UI.retro)}</sup>}
              </span>
              {lord.dignity && (
                <span className={`text-xs font-medium ${DIGNITY_COLOR[lord.dignity.key as Dignity]}`}>
                  {DIGNITY_LABEL[lord.dignity.key as Dignity][lang]}
                </span>
              )}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span>
                {t(UI.placedIn)} {RASIS[lord.rasiIndex][lang].split(" (")[0]}
              </span>
              <span className="font-mono tabular-nums">{fmtDeg(lord.degInRasi)}</span>
              <span>· {NAKSHATRAS[lord.nakshatraIndex][lang]} ({t(UI.pada)} {lord.pada})</span>
            </div>
            {/* Power meter from dignity points (0..100). */}
            {lord.dignity && (
              <div className="mt-2 flex items-center gap-2" data-testid="box-lord-power">
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${lord.dignity.points}%` }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums text-foreground w-16 text-right">
                  {lord.dignity.points} / 100
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </Section>

      {/* Occupant planets */}
      <Section icon={<Users className="h-3.5 w-3.5" />} label={t(UI.occupants)}>
        {occupants.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="box-no-occupants">{t(UI.noOccupants)}</p>
        ) : (
          <ul className="space-y-1.5">
            {occupants.map((p) => (
              <li
                key={p.index}
                className="rounded-md border border-card-border bg-card px-3 py-2 text-sm"
                data-testid={`box-occupant-${p.index}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium text-foreground">
                    {GRAHAS[p.index][lang].split(" (")[0]}
                    {p.retrograde && <sup className="ml-0.5 text-[10px] text-destructive">{t(UI.retro)}</sup>}
                  </span>
                  {p.dignity && (
                    <span className={`text-xs font-medium ${DIGNITY_COLOR[p.dignity.key as Dignity]}`}>
                      {DIGNITY_LABEL[p.dignity.key as Dignity][lang]}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  <span className="font-mono tabular-nums text-foreground">{fmtDeg(p.degInRasi)}</span>
                  <span>· {NAKSHATRAS[p.nakshatraIndex][lang]}</span>
                  <span>· {t(UI.pada)} {p.pada}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Aspecting planets — "what planets seeing this box" + at what degree */}
      <Section icon={<Eye className="h-3.5 w-3.5" />} label={t(UI.aspectingThis)}>
        {aspecting.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="box-no-aspecting">{t(UI.noAspecting)}</p>
        ) : (
          <ul className="space-y-1.5">
            {aspecting.map(({ p, drishti }) => (
              <li
                key={p.index}
                className="rounded-md border border-card-border bg-card px-3 py-2 text-sm"
                data-testid={`box-aspect-${p.index}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium text-foreground">
                    {GRAHAS[p.index][lang].split(" (")[0]}
                    {p.retrograde && <sup className="ml-0.5 text-[10px] text-destructive">{t(UI.retro)}</sup>}
                  </span>
                  <span className="text-xs text-primary font-medium">
                    {drishti}{lang === "en" ? "th" : ""} {t(UI.drishti)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  <span>{RASIS[p.rasiIndex][lang].split(" (")[0]}</span>
                  <span>· {t(UI.atDeg)}</span>
                  <span className="font-mono tabular-nums text-foreground">{fmtDeg(p.degInRasi)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Card>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}

// Small inline hint shown above the chart when nothing is selected.
export function BoxTapHint() {
  const { t } = useLang();
  return (
    <div
      className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-3"
      data-testid="box-tap-hint"
    >
      <Info className="h-3.5 w-3.5" />
      {t(UI.tapHint)}
    </div>
  );
}
