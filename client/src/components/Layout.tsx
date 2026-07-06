import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useLang } from "@/lib/lang";
import { useTheme } from "@/lib/theme";
import { UI } from "@shared/astro/constants";
import { Sun, Moon, Sparkles, CalendarDays } from "lucide-react";

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 48 48" fill="none" aria-label="Tamil Jyotish" className="text-primary">
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="1.5" />
      {/* 12-point star / sun rays */}
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

export function Layout({ children }: { children: ReactNode }) {
  const { lang, toggle: toggleLang, t } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const [location] = useLocation();

  const tabs = [
    { href: "/", label: UI.jathagam, icon: Sparkles },
    { href: "/panchangam", label: UI.panchangam, icon: CalendarDays },
  ];

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
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/">
            <a className="flex items-center gap-2.5" data-testid="link-home">
              <Logo />
              <div className="leading-tight">
                <div className="font-serif text-lg text-foreground">{t(UI.appName)}</div>
                <div className="text-[10px] text-muted-foreground tracking-wide uppercase">Sidereal · Lahiri</div>
              </div>
            </a>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 rounded-full bg-secondary/50 p-1">
            {tabs.map((tab) => {
              const active = location === tab.href;
              const Icon = tab.icon;
              return (
                <Link key={tab.href} href={tab.href}>
                  <a
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`nav-${tab.href === "/" ? "jathagam" : "panchangam"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(tab.label)}
                  </a>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleLang}
              className="rounded-md px-2.5 py-1.5 text-sm font-semibold hover-elevate active-elevate-2 border border-border"
              data-testid="button-lang"
              aria-label="Toggle language"
            >
              {lang === "ta" ? "EN" : "த"}
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-md p-2 hover-elevate active-elevate-2 border border-border"
              data-testid="button-theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {/* mobile nav */}
        <nav className="sm:hidden flex items-center gap-1 px-4 pb-2">
          {tabs.map((tab) => {
            const active = location === tab.href;
            const Icon = tab.icon;
            return (
              <Link key={tab.href} href={tab.href}>
                <a
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
                    active ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"
                  }`}
                  data-testid={`navm-${tab.href === "/" ? "jathagam" : "panchangam"}`}
                >
                  <Icon className="h-4 w-4" />
                  {t(tab.label)}
                </a>
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 py-6 md:py-10">{children}</main>

      <footer className="relative mx-auto max-w-5xl px-4 py-8 text-center text-xs text-muted-foreground">
        {t(UI.disclaimer)}
      </footer>
    </div>
  );
}
