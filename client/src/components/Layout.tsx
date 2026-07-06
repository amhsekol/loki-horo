import { ReactNode } from "react";
import { useLang } from "@/lib/lang";
import { useNav, type ModuleKey } from "@/lib/nav";
import { UI } from "@shared/astro/constants";
import { Sparkles, CalendarDays, History, Settings as SettingsIcon } from "lucide-react";

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-label="LOKI HORO" className="text-primary shrink-0">
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="1.5" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 24 + Math.cos(a) * 15;
        const y1 = 24 + Math.sin(a) * 15;
        const x2 = 24 + Math.cos(a) * 21;
        const y2 = 24 + Math.sin(a) * 21;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />;
      })}
      <circle cx="24" cy="24" r="5.5" fill="currentColor" />
    </svg>
  );
}

const NAV_ITEMS: { key: ModuleKey; label: keyof typeof UI; icon: typeof Sparkles }[] = [
  { key: "jathagam", label: "jathagam", icon: Sparkles },
  { key: "kocharam", label: "panchangam", icon: CalendarDays },
  { key: "saved", label: "savedShort", icon: History },
  { key: "settings", label: "settings", icon: SettingsIcon },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const { active, setActive } = useNav();

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* subtle starfield */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.5] dark:opacity-100"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, hsl(var(--foreground)/0.18) 50%, transparent), radial-gradient(1px 1px at 70% 60%, hsl(var(--foreground)/0.14) 50%, transparent), radial-gradient(1.5px 1.5px at 85% 20%, hsl(var(--primary)/0.25) 50%, transparent), radial-gradient(1px 1px at 40% 80%, hsl(var(--foreground)/0.12) 50%, transparent)",
          backgroundSize: "auto",
        }}
      />

      {/* Compact header — just brand identity to save vertical space */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 h-12 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActive("jathagam")}
            className="flex items-center gap-2 min-w-0"
            data-testid="link-home"
          >
            <Logo />
            <span className="font-serif text-base text-foreground truncate">{t(UI.appName)}</span>
            <span className="hidden sm:inline text-[10px] text-muted-foreground tracking-wide uppercase border border-border rounded px-1.5 py-0.5">
              Sidereal · Lahiri
            </span>
          </button>

          {/* Desktop inline nav (bottom bar remains primary on mobile) */}
          <nav className="hidden md:flex items-center gap-1 rounded-full bg-secondary/50 p-1">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
              const on = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  data-testid={`navtop-${key}`}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(UI[label])}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content — extra bottom padding so the docked nav never covers content */}
      <main className="relative mx-auto max-w-5xl px-4 py-5 md:py-8 pb-28 md:pb-10">{children}</main>

      {/* Bottom-docked navigation — primary nav on mobile, big one-handed targets */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="mx-auto max-w-5xl grid grid-cols-4">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const on = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                data-testid={`navbar-${key}`}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[60px] py-2 text-[11px] font-medium transition-colors active:bg-secondary/60 ${
                  on ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-6 w-6 ${on ? "" : "opacity-80"}`} strokeWidth={on ? 2.2 : 1.8} />
                <span className="leading-none">{t(UI[label])}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
