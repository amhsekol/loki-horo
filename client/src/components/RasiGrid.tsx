import { useLang } from "@/lib/lang";
import { RASIS, GRAHA_SHORT, LAGNA_SHORT, tl } from "@shared/astro/constants";
import { computeDignity, type Dignity } from "@shared/astro/dignity";

// Color per dignity for the planet glyph in chart cells.
export const DIGNITY_COLOR: Record<Dignity, string> = {
  uccham: "text-emerald-600 dark:text-emerald-400",
  moolatrikona: "text-teal-600 dark:text-teal-400",
  aatchi: "text-green-600 dark:text-green-400",
  natpu: "text-sky-600 dark:text-sky-400",
  samam: "text-foreground",
  pagai: "text-orange-600 dark:text-orange-400",
  neecham: "text-red-600 dark:text-red-400",
};

// Explicit background dot classes (Tailwind JIT needs full literal class names).
export const DIGNITY_DOT: Record<Dignity, string> = {
  uccham: "bg-emerald-600 dark:bg-emerald-400",
  moolatrikona: "bg-teal-600 dark:bg-teal-400",
  aatchi: "bg-green-600 dark:bg-green-400",
  natpu: "bg-sky-600 dark:bg-sky-400",
  samam: "bg-muted-foreground",
  pagai: "bg-orange-600 dark:bg-orange-400",
  neecham: "bg-red-600 dark:bg-red-400",
};

// South Indian (Tamil) chart: fixed 4x4 layout, signs in fixed cells.
// Cell order maps to sign index (0=Mesha ... 11=Meena).
// Traditional South Indian positions (row-major in a 4x4 grid, center 2x2 blank):
//  Meena(11)  Mesha(0)  Rishaba(1)  Mithuna(2)
//  Kumba(10)   [        center        ]  Kataka(3)
//  Makara(9)   [        center        ]  Simha(4)
//  Dhanusu(8) Viruchiga(7) Thula(6)  Kanni(5)

interface Occupant {
  label: string;
  retro?: boolean;
  isLagna?: boolean;
  dignity?: Dignity;      // dignity key for coloring
  dignityShort?: string;  // short glyph (உ / ↑ etc.)
  points?: number;        // strength points
}

interface Props {
  title: string;
  // signIndex -> array of short-label strings to place in that sign's cell
  occupants: Record<number, Occupant[]>;
}

// grid position (row, col) for each sign index in a 4x4 layout
const CELL: Record<number, { r: number; c: number }> = {
  11: { r: 1, c: 1 }, 0: { r: 1, c: 2 }, 1: { r: 1, c: 3 }, 2: { r: 1, c: 4 },
  10: { r: 2, c: 1 }, 3: { r: 2, c: 4 },
  9: { r: 3, c: 1 }, 4: { r: 3, c: 4 },
  8: { r: 4, c: 1 }, 7: { r: 4, c: 2 }, 6: { r: 4, c: 3 }, 5: { r: 4, c: 4 },
};

export function RasiGrid({ title, occupants }: Props) {
  const { lang } = useLang();
  return (
    <div className="w-full" data-testid={`chart-${title}`}>
      <div
        className="grid gap-1 aspect-square w-full max-w-[420px] mx-auto"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(4, 1fr)" }}
      >
        {Object.entries(CELL).map(([signStr, pos]) => {
          const sign = Number(signStr);
          const items = occupants[sign] ?? [];
          return (
            <div
              key={sign}
              className="relative rounded-md border border-card-border bg-card p-1.5 flex flex-col overflow-hidden"
              style={{ gridColumn: pos.c, gridRow: pos.r }}
              data-testid={`cell-sign-${sign}`}
            >
              <span className="text-[10px] leading-tight text-muted-foreground font-medium truncate">
                {tl(RASIS[sign], lang).split(" (")[0]}
              </span>
              <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5 content-start flex-1">
                {items.map((it, i) => (
                  <span
                    key={i}
                    className={`text-xs font-semibold leading-tight ${
                      it.isLagna
                        ? "text-primary"
                        : it.dignity
                        ? DIGNITY_COLOR[it.dignity]
                        : "text-foreground"
                    }`}
                    title={it.points !== undefined ? `${it.points}` : undefined}
                  >
                    {it.label}
                    {it.retro && <sup className="text-[8px] text-destructive">R</sup>}
                    {it.dignityShort && (
                      <sub className="text-[8px] ml-0.5 opacity-80">{it.dignityShort}</sub>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {/* Center label block spanning the middle 2x2 */}
        <div
          className="flex items-center justify-center rounded-md bg-secondary/40 border border-card-border"
          style={{ gridColumn: "2 / 4", gridRow: "2 / 4" }}
        >
          <span className="font-serif text-sm md:text-base text-primary/80 text-center px-2">
            {title}
          </span>
        </div>
      </div>
    </div>
  );
}

// Helper to build occupants map from planet sign indices + lagna sign.
// showDignity: when true, compute and attach dignity glyph/color (D-1 rasi + sky chart).
export function buildOccupants(
  planetSigns: number[],
  retroFlags: boolean[],
  lagnaSign: number,
  lang: "ta" | "en",
  showDignity = false
): Record<number, Occupant[]> {
  const map: Record<number, Occupant[]> = {};
  const push = (sign: number, item: Occupant) => {
    (map[sign] ??= []).push(item);
  };
  if (lagnaSign >= 0) push(lagnaSign, { label: tl(LAGNA_SHORT, lang), isLagna: true });
  planetSigns.forEach((sign, idx) => {
    const item: Occupant = { label: tl(GRAHA_SHORT[idx], lang), retro: retroFlags[idx] };
    if (showDignity) {
      const d = computeDignity(idx, sign);
      if (d) {
        item.dignity = d.key;
        item.dignityShort = tl(d.short, lang);
        item.points = d.points;
      }
    }
    push(sign, item);
  });
  return map;
}
