import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/lib/lang";
import { UI } from "@shared/astro/constants";
import type { Rule } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Library, Search, X } from "lucide-react";
import {
  RULE_CATEGORIES, categoryLabel, astrologerLabel, ruleTitle, ruleBody, planetName,
} from "@/lib/rules";

// Planets 0..8 and houses 1..12 for the tag filters.
const PLANET_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const HOUSE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function RulesTab() {
  const { t } = useLang();
  const { data: rules, isLoading } = useQuery<Rule[]>({ queryKey: ["/api/rules"] });

  const [q, setQ] = useState("");
  const [astrologer, setAstrologer] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [planet, setPlanet] = useState<number | null>(null);
  const [house, setHouse] = useState<number | null>(null);

  const astrologers = useMemo(
    () => Array.from(new Set((rules ?? []).map((r) => r.astrologer))),
    [rules],
  );

  const filtered = useMemo(() => {
    let list = rules ?? [];
    if (astrologer) list = list.filter((r) => r.astrologer === astrologer);
    if (category) list = list.filter((r) => r.categoryKey === category);
    if (planet !== null) list = list.filter((r) => r.planets.includes(planet));
    if (house !== null) list = list.filter((r) => r.houses.includes(house));
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      list = list.filter((r) =>
        [r.titleEn, r.titleTa, r.titleHi, r.bodyEn, r.bodyTa, r.bodyHi]
          .some((f) => (f || "").toLowerCase().includes(n)));
    }
    return list;
  }, [rules, astrologer, category, planet, house, q]);

  const hasFilters = q || astrologer || category || planet !== null || house !== null;
  const clear = () => { setQ(""); setAstrologer(""); setCategory(""); setPlanet(null); setHouse(null); };

  // Group the filtered results by category for readable display.
  const grouped = useMemo(() => {
    return RULE_CATEGORIES
      .map((c) => ({ ...c, items: filtered.filter((r) => r.categoryKey === c.key) }))
      .filter((c) => c.items.length > 0);
  }, [filtered]);

  return (
    <div className="space-y-6" data-testid="rules-tab">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Library className="h-5 w-5 text-primary" />
          {t(UI.rulesTitle)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.rulesSubtitle)}</p>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4" data-testid="rules-filters">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(UI.rulesSearch)}
            className="pl-9"
            data-testid="input-rules-search"
          />
        </div>

        {/* Astrologer */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">{t(UI.rulesAstrologer)}</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!astrologer} onClick={() => setAstrologer("")} testId="filter-astro-all">
              {t(UI.rulesAll)}
            </Chip>
            {astrologers.map((a) => (
              <Chip key={a} active={astrologer === a} onClick={() => setAstrologer(a)} testId={`filter-astro-${a}`}>
                {t(astrologerLabel(a))}
              </Chip>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">{t(UI.rulesCategory)}</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!category} onClick={() => setCategory("")} testId="filter-cat-all">
              {t(UI.rulesAll)}
            </Chip>
            {RULE_CATEGORIES.map((c) => (
              <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)} testId={`filter-cat-${c.key}`}>
                {t(c.label)}
              </Chip>
            ))}
          </div>
        </div>

        {/* Planet */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">{t(UI.rulesPlanet)}</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={planet === null} onClick={() => setPlanet(null)} testId="filter-planet-all">
              {t(UI.rulesAll)}
            </Chip>
            {PLANET_IDS.map((p) => (
              <Chip key={p} active={planet === p} onClick={() => setPlanet(p)} testId={`filter-planet-${p}`}>
                {t(planetName(p))}
              </Chip>
            ))}
          </div>
        </div>

        {/* House */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">{t(UI.rulesHouse)}</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={house === null} onClick={() => setHouse(null)} testId="filter-house-all">
              {t(UI.rulesAll)}
            </Chip>
            {HOUSE_IDS.map((h) => (
              <Chip key={h} active={house === h} onClick={() => setHouse(h)} testId={`filter-house-${h}`}>
                {h}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted-foreground tabular-nums" data-testid="rules-result-count">
            {filtered.length} {t(UI.rulesCount)}
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={clear}
              data-testid="button-rules-clear"
              className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> {t(UI.rulesClear)}
            </button>
          )}
        </div>
      </Card>

      {/* Results */}
      {isLoading ? (
        <Card className="p-6 text-center text-muted-foreground" data-testid="rules-loading">
          {t(UI.rulesLoading)}
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground" data-testid="rules-empty">
          {t(UI.rulesNone)}
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((cat) => (
            <div key={cat.key} data-testid={`rules-group-${cat.key}`}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-sm">{t(cat.label)}</h3>
                <span className="text-[11px] text-muted-foreground tabular-nums">{cat.items.length}</span>
              </div>
              <div className="space-y-2">
                {cat.items.map((r) => (
                  <Card key={r.ruleNo} className="p-3" data-testid={`rule-card-${r.ruleNo}`}>
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        #{r.ruleNo}
                      </span>
                      <span className="font-medium text-sm">{t(ruleTitle(r))}</span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-1.5 leading-snug">{t(ruleBody(r))}</p>
                    {(r.planets.length > 0 || r.houses.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.planets.map((p) => (
                          <span key={`p${p}`} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/12 text-sky-600 dark:text-sky-400">
                            {t(planetName(p))}
                          </span>
                        ))}
                        {r.houses.map((h) => (
                          <span key={`h${h}`} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-600 dark:text-amber-400">
                            {t(UI.rulesHouse)} {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, testId, children }: {
  active: boolean; onClick: () => void; testId: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground/80 border-card-border hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}
