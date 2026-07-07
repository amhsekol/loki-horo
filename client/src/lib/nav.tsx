import { createContext, useContext, useState, ReactNode, useRef } from "react";
import type { Chart, ChartWithAccess } from "@shared/schema";

export type ModuleKey = "jathagam" | "kocharam" | "saved" | "members" | "settings";

// Saved passes a ChartWithAccess; Jathagam consumes the plain Chart fields
// (which ChartWithAccess is a superset of), so accept either.
type OpenSavedHandler = (c: Chart) => void;

interface NavCtx {
  active: ModuleKey;
  setActive: (m: ModuleKey) => void;
  /** Saved page calls this to open a chart in the Jathagam module. */
  openSavedChart: (c: Chart | ChartWithAccess) => void;
  /** Jathagam registers its own openSaved handler here so Saved can trigger it. */
  registerOpenSaved: (fn: OpenSavedHandler) => void;
}

const Ctx = createContext<NavCtx | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ModuleKey>("jathagam");
  const openSavedRef = useRef<OpenSavedHandler | null>(null);

  const registerOpenSaved = (fn: OpenSavedHandler) => {
    openSavedRef.current = fn;
  };

  const openSavedChart = (c: Chart | ChartWithAccess) => {
    setActive("jathagam");
    // Defer so the Jathagam pane is visible before it scrolls/populates.
    setTimeout(() => openSavedRef.current?.(c), 0);
  };

  return (
    <Ctx.Provider value={{ active, setActive, openSavedChart, registerOpenSaved }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNav() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNav must be used within NavProvider");
  return c;
}
