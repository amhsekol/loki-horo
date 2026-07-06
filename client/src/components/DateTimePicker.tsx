import { useEffect, useRef, useCallback } from "react";
import { useLang } from "@/lib/lang";
import { UI, GREGORIAN_MONTHS } from "@shared/astro/constants";
import { Label } from "@/components/ui/label";

const pad2 = (n: number) => String(n).padStart(2, "0");

// ---- helpers to parse the string state --------------------------------
function parseDate(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (m) return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
  return { y: NaN, mo: NaN, d: NaN };
}
function parseTime(time: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return { h12: NaN, min: NaN, ap: "" as "" | "AM" | "PM" };
  let h = Number(m[1]);
  const ap: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return { h12: h, min: Number(m[2]), ap };
}
function daysInMonth(year: number, month1: number) {
  return new Date(year, month1, 0).getDate();
}

// ---- WheelColumn: a scroll-snap column of options ---------------------
const ITEM_H = 36; // px per row (must match CSS)

interface WheelOption { value: string; label: string; }

interface WheelColumnProps {
  options: WheelOption[];
  value: string | null;          // currently selected value (null = none yet)
  defaultValue: string;          // where to start when nothing selected
  onChange: (v: string) => void;
  testid: string;
  ariaLabel: string;
}

function WheelColumn({ options, value, defaultValue, onChange, testid, ariaLabel }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settled = useRef(false);

  const indexOf = useCallback(
    (v: string | null) => {
      const target = v ?? defaultValue;
      const i = options.findIndex((o) => o.value === target);
      return i < 0 ? 0 : i;
    },
    [options, defaultValue],
  );

  // Scroll the selected item into the centered highlight band.
  const scrollToIndex = useCallback((i: number, smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: i * ITEM_H, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Position on mount + when the external value changes.
  useEffect(() => {
    scrollToIndex(indexOf(value), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  // On scroll end, snap to nearest and emit.
  const handleScroll = () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      let i = Math.round(el.scrollTop / ITEM_H);
      i = Math.max(0, Math.min(options.length - 1, i));
      const opt = options[i];
      if (opt && opt.value !== value) onChange(opt.value);
      settled.current = true;
      // ensure exact alignment
      if (Math.abs(el.scrollTop - i * ITEM_H) > 1) scrollToIndex(i, true);
    }, 90);
  };

  const selIndex = indexOf(value);

  return (
    <div className="relative flex-1" data-testid={testid} aria-label={ariaLabel}>
      {/* highlight band */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-md bg-primary/10 border border-primary/30"
        style={{ height: ITEM_H }}
      />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-[108px] overflow-y-auto no-scrollbar snap-y snap-mandatory relative"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {/* top spacer so first item can center */}
        <div style={{ height: ITEM_H }} />
        {options.map((o, i) => {
          const active = i === selIndex;
          return (
            <div
              key={o.value}
              onClick={() => { scrollToIndex(i, true); onChange(o.value); }}
              data-testid={`${testid}-opt-${o.value}`}
              className={[
                "flex items-center justify-center snap-center cursor-pointer select-none tabular-nums transition-colors",
                active ? "text-foreground font-semibold" : "text-muted-foreground/70",
              ].join(" ")}
              style={{ height: ITEM_H }}
            >
              {o.label}
            </div>
          );
        })}
        {/* bottom spacer */}
        <div style={{ height: ITEM_H }} />
      </div>
    </div>
  );
}

// ---- Date wheel picker: Year -> Month -> Day -------------------------
interface DateFields { date: string; setDate: (v: string) => void; }

export function DateSelect({ date, setDate }: DateFields) {
  const { lang, t } = useLang();
  const { y, mo, d } = parseDate(date);
  const nowYear = new Date().getFullYear();

  // Years ascending starting at 1990 (so the wheel "starts from 1990"),
  // then later years, then earlier years below for full range access.
  const years: WheelOption[] = [];
  for (let yr = 1990; yr <= nowYear; yr++) years.push({ value: String(yr), label: String(yr) });
  for (let yr = 1989; yr >= 1900; yr--) years.push({ value: String(yr), label: String(yr) });

  const months: WheelOption[] = GREGORIAN_MONTHS.map((m, i) => ({ value: pad2(i + 1), label: m[lang] }));

  const curY = isNaN(y) ? 1990 : y;
  const curMo = isNaN(mo) ? 1 : mo;
  const maxDay = daysInMonth(curY, curMo);
  const days: WheelOption[] = [];
  for (let dd = 1; dd <= maxDay; dd++) days.push({ value: pad2(dd), label: String(dd) });

  function emit(ny: number, nmo: number, nd: number) {
    const md = daysInMonth(ny, nmo);
    const dd = Math.min(nd, md);
    setDate(`${ny}-${pad2(nmo)}-${pad2(dd)}`);
  }

  return (
    <div>
      {/* column headers */}
      <div className="grid grid-cols-3 gap-2 mb-1 text-[11px] font-medium text-muted-foreground text-center">
        <span>{t(UI.year)}</span>
        <span>{t(UI.month)}</span>
        <span>{t(UI.day)}</span>
      </div>
      <div className="flex gap-2 rounded-md border border-input bg-background p-1">
        <WheelColumn
          testid="wheel-year" ariaLabel={t(UI.year)}
          options={years}
          value={isNaN(y) ? null : String(y)}
          defaultValue="1990"
          onChange={(v) => emit(Number(v), curMo, isNaN(d) ? 1 : d)}
        />
        <WheelColumn
          testid="wheel-month" ariaLabel={t(UI.month)}
          options={months}
          value={isNaN(mo) ? null : pad2(mo)}
          defaultValue="01"
          onChange={(v) => emit(curY, Number(v), isNaN(d) ? 1 : d)}
        />
        <WheelColumn
          testid="wheel-day" ariaLabel={t(UI.day)}
          options={days}
          value={isNaN(d) ? null : pad2(d)}
          defaultValue="01"
          onChange={(v) => emit(curY, curMo, Number(v))}
        />
      </div>
    </div>
  );
}

// ---- Time wheel picker: Hour -> Minute -> AM/PM ---------------------
interface TimeFields { time: string; setTime: (v: string) => void; }

export function TimeSelect({ time, setTime }: TimeFields) {
  const { t } = useLang();
  const { h12, min, ap } = parseTime(time);

  const hours: WheelOption[] = [];
  for (let h = 1; h <= 12; h++) hours.push({ value: pad2(h), label: pad2(h) });
  const minutes: WheelOption[] = [];
  for (let m = 0; m < 60; m++) minutes.push({ value: pad2(m), label: pad2(m) });
  const aps: WheelOption[] = [{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }];

  const curH = isNaN(h12) ? 6 : h12;    // default 6 (common birth hour), harmless default
  const curMin = isNaN(min) ? 0 : min;
  const curAp = ap || "AM";

  function emit(nh12: number, nmin: number, nap: "AM" | "PM") {
    let h = nh12 % 12;
    if (nap === "PM") h += 12;
    setTime(`${pad2(h)}:${pad2(nmin)}`);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-1 text-[11px] font-medium text-muted-foreground text-center">
        <span>{t(UI.hour)}</span>
        <span>{t(UI.minute)}</span>
        <span>{t(UI.ampm)}</span>
      </div>
      <div className="flex gap-2 rounded-md border border-input bg-background p-1">
        <WheelColumn
          testid="wheel-hour" ariaLabel={t(UI.hour)}
          options={hours}
          value={isNaN(h12) ? null : pad2(h12)}
          defaultValue="06"
          onChange={(v) => emit(Number(v), curMin, curAp)}
        />
        <WheelColumn
          testid="wheel-minute" ariaLabel={t(UI.minute)}
          options={minutes}
          value={isNaN(min) ? null : pad2(min)}
          defaultValue="00"
          onChange={(v) => emit(curH, Number(v), curAp)}
        />
        <WheelColumn
          testid="wheel-ampm" ariaLabel={t(UI.ampm)}
          options={aps}
          value={ap || null}
          defaultValue="AM"
          onChange={(v) => emit(curH, curMin, v as "AM" | "PM")}
        />
      </div>
    </div>
  );
}

export { Label };
