import { useLang, type Lang } from "@/lib/lang";
import { useTheme } from "@/lib/theme";
import { UI } from "@shared/astro/constants";
import { Card } from "@/components/ui/card";
import { Settings as SettingsIcon, Languages, Sun, Moon, Grid3x3, Info } from "lucide-react";

const LANGS: { key: Lang; label: string }[] = [
  { key: "ta", label: "தமிழ்" },
  { key: "en", label: "English" },
  { key: "hi", label: "हिन्दी" },
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
  testidPrefix,
}: {
  value: T;
  options: { key: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
  testidPrefix: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-card-border overflow-hidden">
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            data-testid={`${testidPrefix}-${o.key}`}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              i > 0 ? "border-l border-card-border" : ""
            } ${on ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-b border-card-border/60 last:border-0">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { lang, setLang, t, chartStyle, setChartStyle } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <>
      <div className="mb-5">
        <h1 className="font-serif text-xl text-foreground flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" />
          {t(UI.settings)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.settingsIntro)}</p>
      </div>

      <Card className="p-5 md:p-6">
        <Row icon={<Languages className="h-4 w-4" />} label={t(UI.language)}>
          <Segmented
            value={lang}
            testidPrefix="set-lang"
            options={LANGS.map((l) => ({ key: l.key, label: l.label }))}
            onChange={setLang}
          />
        </Row>

        <Row icon={theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} label={t(UI.theme)}>
          <Segmented
            value={theme}
            testidPrefix="set-theme"
            options={[
              { key: "light", label: t(UI.lightMode), icon: <Sun className="h-4 w-4" /> },
              { key: "dark", label: t(UI.darkMode), icon: <Moon className="h-4 w-4" /> },
            ]}
            onChange={(v) => { if (v !== theme) toggleTheme(); }}
          />
        </Row>

        <Row icon={<Grid3x3 className="h-4 w-4" />} label={t(UI.defaultChartStyle)}>
          <Segmented
            value={chartStyle}
            testidPrefix="set-style"
            options={[
              { key: "south", label: t(UI.southStyle) },
              { key: "north", label: t(UI.northStyle) },
            ]}
            onChange={setChartStyle}
          />
        </Row>
      </Card>

      {/* About */}
      <Card className="p-5 md:p-6 mt-6">
        <div className="flex items-center gap-2 text-sm font-medium mb-3">
          <Info className="h-4 w-4 text-primary" />
          {t(UI.aboutApp)}
        </div>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p><span className="text-foreground font-medium">{t(UI.appName)}</span></p>
          <p>
            {lang === "ta"
              ? "சிதேரியல் (நிரயன) கணக்கீடு · லாஹிரி அயனாம்சம்"
              : lang === "hi"
                ? "सायडेरियल (निरयण) गणना · लाहिरी अयनांश"
                : "Sidereal (Nirayana) calculations · Lahiri Ayanamsa"}
          </p>
          <p className="text-xs pt-2 border-t border-card-border/60 mt-2">{t(UI.disclaimer)}</p>
        </div>
      </Card>
    </>
  );
}
