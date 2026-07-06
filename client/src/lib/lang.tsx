import { createContext, useContext, useState, ReactNode } from "react";
import type { Bilingual } from "@shared/astro/constants";

export type Lang = "ta" | "en" | "hi";
export type ChartStyle = "south" | "north";

// Ordered cycle for the 3-way toggle.
const LANG_CYCLE: Lang[] = ["ta", "en", "hi"];

// Safe accessor: prefers the requested language, then English, then Tamil.
// This lets the app work even before every string has a Hindi translation.
export function pick(b: Bilingual | undefined, lang: Lang): string {
  if (!b) return "";
  return (b as Record<string, string | undefined>)[lang] ?? b.en ?? b.ta ?? "";
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  // t(b) uses the current global language. t(b, "en") forces a specific language
  // (used by the setup screen so the preview updates live as the user selects).
  t: (b: Bilingual | undefined, override?: Lang) => string;
  // Preferred chart style, chosen once at startup (toggleable later per-chart).
  chartStyle: ChartStyle;
  setChartStyle: (s: ChartStyle) => void;
  // Whether the user has completed the one-time startup selection.
  chosen: boolean;
  confirmChoices: (lang: Lang, style: ChartStyle) => void;
}

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ta");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("south");
  const [chosen, setChosen] = useState(false);

  const toggle = () =>
    setLang((l) => LANG_CYCLE[(LANG_CYCLE.indexOf(l) + 1) % LANG_CYCLE.length]);

  const t = (b: Bilingual | undefined, override?: Lang) => pick(b, override ?? lang);

  const confirmChoices = (l: Lang, style: ChartStyle) => {
    setLang(l);
    setChartStyle(style);
    setChosen(true);
  };

  return (
    <Ctx.Provider value={{ lang, setLang, toggle, t, chartStyle, setChartStyle, chosen, confirmChoices }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLang() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLang must be used within LangProvider");
  return c;
}
