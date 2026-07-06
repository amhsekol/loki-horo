import { createContext, useContext, useState, ReactNode } from "react";
import type { Bilingual } from "@shared/astro/constants";

export type Lang = "ta" | "en";
export type ChartStyle = "south" | "north";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (b: Bilingual) => string;
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

  const toggle = () => setLang((l) => (l === "ta" ? "en" : "ta"));
  const t = (b: Bilingual) => (b ? b[lang] : "");

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
