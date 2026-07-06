import { useState } from "react";
import { useLang } from "@/lib/lang";
import { UI } from "@shared/astro/constants";
import type { DashaTimeline, DashaNode } from "@shared/astro/dasha";
import { Card } from "@/components/ui/card";
import { ChevronRight, Layers } from "lucide-react";

// Traditional graha colours (by GRAHAS index) for quick visual scanning.
const GRAHA_COLOR: Record<number, string> = {
  0: "text-orange-600 dark:text-orange-400",   // Sun
  1: "text-slate-500 dark:text-slate-300",     // Moon
  2: "text-red-600 dark:text-red-400",         // Mars
  3: "text-green-600 dark:text-green-400",     // Mercury
  4: "text-yellow-600 dark:text-yellow-400",   // Jupiter
  5: "text-pink-600 dark:text-pink-400",       // Venus
  6: "text-blue-700 dark:text-blue-400",       // Saturn
  7: "text-purple-600 dark:text-purple-400",   // Rahu
  8: "text-amber-700 dark:text-amber-500",     // Ketu
};

// Level labels (0 = Maha, 1 = Bhukti, 2 = Antharam, 3 = Sookshma).
const LEVEL_LABEL = [UI.mahaDasha, UI.bhukti, UI.antharam, UI.sookshma];

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function fmtDate(v: Date | string): string {
  const d = toDate(v);
  // dd MMM yyyy — locale-neutral, compact
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${day} ${mon} ${d.getUTCFullYear()}`;
}

function fmtDuration(node: DashaNode, monthsLabel: string, yearsLabel: string): string {
  const days = node.durationDays;
  const months = days / 30.4375;
  if (months >= 24) {
    const yrs = days / 365.25;
    return `${yrs.toFixed(1)} ${yearsLabel}`;
  }
  return `${months.toFixed(1)} ${monthsLabel}`;
}

function isNow(node: DashaNode): boolean {
  const now = Date.now();
  return toDate(node.start).getTime() <= now && now < toDate(node.end).getTime();
}

interface RowProps {
  node: DashaNode;
  level: number;
  lang: "ta" | "en";
  monthsLabel: string;
  yearsLabel: string;
  nowLabel: string;
}

function DashaRow({ node, level, lang, monthsLabel, yearsLabel, nowLabel }: RowProps) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!node.children && node.children.length > 0;
  const active = isNow(node);
  const indentPx = level * 16;

  return (
    <>
      <div
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onClick={hasChildren ? () => setOpen((o) => !o) : undefined}
        onKeyDown={hasChildren ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } } : undefined}
        data-testid={`dasha-row-l${level}-${node.lordIndex}`}
        className={[
          "grid grid-cols-[minmax(140px,1.4fr)_1fr_1fr_0.9fr] items-center gap-2 px-3 py-2 text-sm border-b border-border/60 transition-colors",
          hasChildren ? "cursor-pointer hover:bg-muted/60" : "",
          active ? "bg-primary/10" : "",
          level > 0 ? "bg-muted/20" : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-1.5" style={{ paddingLeft: indentPx }}>
          {hasChildren ? (
            <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className={`font-medium ${GRAHA_COLOR[node.lordIndex] ?? ""}`}>{node.lord[lang]}</span>
          {active && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {nowLabel}
            </span>
          )}
        </div>
        <div className="tabular-nums text-muted-foreground">{fmtDate(node.start)}</div>
        <div className="tabular-nums text-muted-foreground">{fmtDate(node.end)}</div>
        <div className="tabular-nums text-right">{fmtDuration(node, monthsLabel, yearsLabel)}</div>
      </div>

      {open && hasChildren && (
        <div className="border-l-2 border-primary/30 ml-3">
          {/* Sub-level header */}
          <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40" style={{ paddingLeft: indentPx + 24 }}>
            {LEVEL_LABEL[level + 1]?.[lang]}
          </div>
          {node.children!.map((child, i) => (
            <DashaRow
              key={`${child.lordIndex}-${i}`}
              node={child}
              level={level + 1}
              lang={lang}
              monthsLabel={monthsLabel}
              yearsLabel={yearsLabel}
              nowLabel={nowLabel}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function DashaTable({ dasha }: { dasha: DashaTimeline }) {
  const { lang, t } = useLang();
  if (!dasha || !dasha.periods?.length) return null;

  const monthsLabel = t(UI.months);
  const yearsLabel = t(UI.years);
  const nowLabel = t(UI.current);

  return (
    <div className="mb-8">
      <h2 className="font-serif text-xl md:text-2xl text-foreground flex items-center gap-2 mb-1">
        <Layers className="h-5 w-5 text-primary" />
        {t(UI.dashaTitle)}
      </h2>
      <p className="text-sm text-muted-foreground mb-1">{t(UI.dashaSubtitle)}</p>
      <p className="text-sm text-muted-foreground mb-3">
        {t(UI.balanceAtBirth)}: <span className="font-semibold text-foreground">{dasha.periods[0].lord[lang]}</span>{" "}
        · {dasha.balanceYears.toFixed(2)} {yearsLabel}
      </p>

      <Card className="overflow-hidden">
        {/* Column header */}
        <div className="grid grid-cols-[minmax(140px,1.4fr)_1fr_1fr_0.9fr] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">
          <div>{t(UI.planet)}</div>
          <div>{t(UI.startDate)}</div>
          <div>{t(UI.endDate)}</div>
          <div className="text-right">{t(UI.duration)}</div>
        </div>
        <div data-testid="dasha-table-body">
          {dasha.periods.map((node, i) => (
            <DashaRow
              key={`${node.lordIndex}-${i}`}
              node={node}
              level={0}
              lang={lang}
              monthsLabel={monthsLabel}
              yearsLabel={yearsLabel}
              nowLabel={nowLabel}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
