import { useState } from "react";
import { useLang, type Lang, type ChartStyle } from "@/lib/lang";
import { UI } from "@shared/astro/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Languages, Grid3x3 } from "lucide-react";

function Logo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-label="Tamil Jyotish" className="text-primary">
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

// Bilingual option card used for both language and chart-style choices.
function OptionButton({
  active, onClick, testid, primary, secondary,
}: { active: boolean; onClick: () => void; testid: string; primary: string; secondary: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border px-4 py-5 text-center transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-card-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      {active && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
      <span className="font-serif text-base leading-tight">{primary}</span>
      <span className="text-xs text-muted-foreground">{secondary}</span>
    </button>
  );
}

export function SetupScreen() {
  const { t, confirmChoices } = useLang();
  const [lang, setLang] = useState<Lang>("ta");
  const [style, setStyle] = useState<ChartStyle>("south");

  return (
    <div className="min-h-screen bg-background text-foreground relative flex items-center justify-center px-4 py-10">
      {/* subtle starfield */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.5] dark:opacity-100"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, hsl(var(--foreground)/0.18) 50%, transparent), radial-gradient(1px 1px at 70% 60%, hsl(var(--foreground)/0.14) 50%, transparent), radial-gradient(1.5px 1.5px at 85% 20%, hsl(var(--primary)/0.25) 50%, transparent), radial-gradient(1px 1px at 40% 80%, hsl(var(--foreground)/0.12) 50%, transparent)",
        }}
      />
      <Card className="relative w-full max-w-md p-6 md:p-8" data-testid="setup-screen">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo />
          <h1 className="font-serif text-2xl mt-3">{t(UI.appName)}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t(UI.setupSubtitle)}</p>
        </div>

        {/* Language selection */}
        <div className="mb-6">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            <Languages className="h-3.5 w-3.5 text-primary" /> {t(UI.chooseLanguage)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <OptionButton
              active={lang === "ta"} onClick={() => setLang("ta")} testid="setup-lang-ta"
              primary="தமிழ்" secondary="Tamil"
            />
            <OptionButton
              active={lang === "en"} onClick={() => setLang("en")} testid="setup-lang-en"
              primary="English" secondary="ஆங்கிலம்"
            />
          </div>
        </div>

        {/* Chart style selection */}
        <div className="mb-6">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            <Grid3x3 className="h-3.5 w-3.5 text-primary" /> {t(UI.chooseChartStyle)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <OptionButton
              active={style === "south"} onClick={() => setStyle("south")} testid="setup-style-south"
              primary={lang === "ta" ? "தென்னிந்திய" : "South Indian"}
              secondary={lang === "ta" ? "South Indian" : "தென்னிந்திய"}
            />
            <OptionButton
              active={style === "north"} onClick={() => setStyle("north")} testid="setup-style-north"
              primary={lang === "ta" ? "வட இந்திய" : "North Indian"}
              secondary={lang === "ta" ? "North Indian" : "வட இந்திய"}
            />
          </div>
        </div>

        <Button
          className="w-full gap-1.5"
          onClick={() => confirmChoices(lang, style)}
          data-testid="setup-continue"
        >
          <Sparkles className="h-4 w-4" /> {t(UI.continueBtn)}
        </Button>
        <p className="text-[11px] text-muted-foreground text-center mt-3">{t(UI.changeLater)}</p>
      </Card>
    </div>
  );
}
