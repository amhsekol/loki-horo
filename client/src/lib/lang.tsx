import { createContext, useContext, useState, ReactNode } from "react";
import type { Bilingual } from "@shared/astro/constants";

export type Lang = "ta" | "en";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (b: Bilingual) => string;
}

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ta");
  const toggle = () => setLang((l) => (l === "ta" ? "en" : "ta"));
  const t = (b: Bilingual) => (b ? b[lang] : "");
  return <Ctx.Provider value={{ lang, setLang, toggle, t }}>{children}</Ctx.Provider>;
}

export function useLang() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLang must be used within LangProvider");
  return c;
}
