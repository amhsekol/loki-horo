import {
  type ChartScript,
  rasiLabelForScript,
  grahaShortForScript,
  lagnaShortForScript,
} from "@shared/astro/constants";
import { computeDignity, type Dignity } from "@shared/astro/dignity";

// SVG needs fill-* utility classes (text-* only sets `color`, which SVG ignores).
const DIGNITY_FILL: Record<Dignity, string> = {
  uccham: "fill-emerald-600 dark:fill-emerald-400",
  moolatrikona: "fill-teal-600 dark:fill-teal-400",
  aatchi: "fill-green-600 dark:fill-green-400",
  natpu: "fill-sky-600 dark:fill-sky-400",
  samam: "fill-foreground",
  pagai: "fill-orange-600 dark:fill-orange-400",
  neecham: "fill-red-600 dark:fill-red-400",
};

// North Indian (diamond) chart. Houses (bhavas) are FIXED positions;
// the SIGN that falls in each house rotates with the ascendant.
// House 1 (Lagna) = top-center diamond. Houses run counter-clockwise,
// the classic North Indian arrangement.
//
// Layout on a 300x300 box. The outer square is divided by its two
// diagonals plus a central rotated square (diamond) touching the four
// midpoints. This yields 12 regions = 12 houses.

const SIZE = 300;
const M = SIZE / 2; // 150
const Q = SIZE / 4; // 75
const T3 = (SIZE * 3) / 4; // 225

// Centroid (label anchor) for each of the 12 houses, keyed by house number 1..12.
// House 1 is the top-center small diamond; numbering proceeds counter-clockwise.
const HOUSE_CENTER: Record<number, { x: number; y: number }> = {
  1: { x: M, y: Q },            // top-center diamond
  2: { x: Q, y: Q / 1.6 },      // top-left triangle
  3: { x: Q / 1.6, y: Q },      // left-top triangle
  4: { x: Q, y: M },            // left-center diamond
  5: { x: Q / 1.6, y: T3 },     // left-bottom triangle
  6: { x: Q, y: SIZE - Q / 1.6 },// bottom-left triangle
  7: { x: M, y: T3 },           // bottom-center diamond
  8: { x: T3, y: SIZE - Q / 1.6 },// bottom-right triangle
  9: { x: SIZE - Q / 1.6, y: T3 },// right-bottom triangle
  10: { x: T3, y: M },          // right-center diamond
  11: { x: SIZE - Q / 1.6, y: Q },// right-top triangle
  12: { x: T3, y: Q / 1.6 },    // top-right triangle
};

// Small offset positions for the sign number within each house (top-corner-ish).
const SIGN_CENTER: Record<number, { x: number; y: number }> = {
  1: { x: M, y: Q - 34 },
  2: { x: Q - 20, y: 16 },
  3: { x: 16, y: Q - 20 },
  4: { x: Q - 34, y: M },
  5: { x: 16, y: T3 + 20 },
  6: { x: Q - 20, y: SIZE - 16 },
  7: { x: M, y: T3 + 34 },
  8: { x: T3 + 20, y: SIZE - 16 },
  9: { x: SIZE - 16, y: T3 + 20 },
  10: { x: T3 + 34, y: M },
  11: { x: SIZE - 16, y: Q - 20 },
  12: { x: T3 + 20, y: 16 },
};

interface Props {
  title: string;
  script: ChartScript;
  lagnaSign: number;               // 0..11
  planetSigns: number[];           // per graha index 0..8 -> sign 0..11
  retroFlags: boolean[];           // per graha index
  showDignity?: boolean;           // color + compute dignity (D-1 only)
  showSignName?: boolean;          // full sign name instead of number
}

export function NorthIndianChart({
  title,
  script,
  lagnaSign,
  planetSigns,
  retroFlags,
  showDignity = false,
  showSignName = false,
}: Props) {
  // sign occupying each house: house h (1..12) holds sign (lagnaSign + h - 1) mod 12
  const signForHouse = (h: number) => ((lagnaSign + h - 1) % 12 + 12) % 12;
  // reverse: which house does a given sign fall in?
  const houseForSign = (sign: number) => (((sign - lagnaSign) % 12 + 12) % 12) + 1;

  // Group planets by house.
  const planetsByHouse: Record<number, { idx: number; retro: boolean; dignity?: Dignity }[]> = {};
  planetSigns.forEach((sign, idx) => {
    const h = houseForSign(sign);
    (planetsByHouse[h] ??= []).push({
      idx,
      retro: retroFlags[idx],
      dignity: showDignity ? computeDignity(idx, sign)?.key : undefined,
    });
  });

  return (
    <div className="w-full" data-testid={`north-chart-${title}`}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[420px] mx-auto block"
        role="img"
        aria-label={title}
      >
        {/* Outer square */}
        <rect
          x="1" y="1" width={SIZE - 2} height={SIZE - 2}
          className="fill-card stroke-card-border"
          strokeWidth="1.5"
        />
        {/* Two diagonals */}
        <line x1="0" y1="0" x2={SIZE} y2={SIZE} className="stroke-card-border" strokeWidth="1" />
        <line x1={SIZE} y1="0" x2="0" y2={SIZE} className="stroke-card-border" strokeWidth="1" />
        {/* Central diamond (connects the 4 edge midpoints) */}
        <polygon
          points={`${M},0 ${SIZE},${M} ${M},${SIZE} 0,${M}`}
          className="fill-none stroke-card-border"
          strokeWidth="1"
        />

        {/* House content */}
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
          const sign = signForHouse(h);
          const sc = SIGN_CENTER[h];
          const hc = HOUSE_CENTER[h];
          const planets = planetsByHouse[h] ?? [];
          const signText = showSignName
            ? rasiLabelForScript(sign, script)
            : String(sign + 1);

          return (
            <g key={h} data-testid={`north-house-${h}`}>
              {/* sign number/name (muted) */}
              <text
                x={sc.x}
                y={sc.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                style={{ fontSize: showSignName ? 9 : 11, fontWeight: 600 }}
              >
                {signText}
              </text>

              {/* lagna marker in house 1 */}
              {h === 1 && (
                <text
                  x={hc.x}
                  y={hc.y - 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-primary"
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  {lagnaShortForScript(script)}
                </text>
              )}

              {/* planets, laid out in a small wrapped row */}
              {planets.map((p, i) => {
                const perRow = 3;
                const col = i % perRow;
                const row = Math.floor(i / perRow);
                const spread = 18;
                const startX = hc.x - ((Math.min(planets.length, perRow) - 1) * spread) / 2;
                const px = startX + col * spread;
                const py = hc.y + row * 15 + (h === 1 ? 4 : 0);
                const colorClass = p.dignity ? DIGNITY_FILL[p.dignity] : "fill-foreground";
                return (
                  <text
                    key={p.idx}
                    x={px}
                    y={py}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fontSize: 12, fontWeight: 700 }}
                  >
                    <tspan className={colorClass}>{grahaShortForScript(p.idx, script)}</tspan>
                    {p.retro && (
                      <tspan className="fill-destructive" dy="-4" style={{ fontSize: 8 }}>
                        R
                      </tspan>
                    )}
                  </text>
                );
              })}
            </g>
          );
        })}
      </svg>
      <p className="text-center text-xs text-muted-foreground mt-2 font-serif">{title}</p>
    </div>
  );
}
