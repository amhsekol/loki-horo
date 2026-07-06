import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLang } from "@/lib/lang";
import { useNav } from "@/lib/nav";
import { UI, RASIS, NAKSHATRAS } from "@shared/astro/constants";
import type { Chart } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Trash2, Filter, X, MapPin, Clock } from "lucide-react";

// Format "HH:MM" (24h) as "h:MM AM/PM" for display.
function formatTime12(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return time;
  let h = Number(m[1]);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m[2]} ${ap}`;
}

export default function Saved() {
  const { lang, t } = useLang();
  const { openSavedChart } = useNav();

  const savedQuery = useQuery<Chart[]>({ queryKey: ["/api/charts"] });

  const [filterText, setFilterText] = useState("");
  const [filterLagna, setFilterLagna] = useState("all");
  const [filterRasi, setFilterRasi] = useState("all");
  const [filterNak, setFilterNak] = useState("all");
  const filtersActive =
    filterText.trim() !== "" || filterLagna !== "all" || filterRasi !== "all" || filterNak !== "all";

  function matchesFilters(c: Chart): boolean {
    const q = filterText.trim().toLowerCase();
    if (q) {
      const hay = `${c.name ?? ""} ${c.placeName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filterLagna !== "all" && c.lagnaIndex !== Number(filterLagna)) return false;
    if (filterRasi !== "all" && c.rasiIndex !== Number(filterRasi)) return false;
    if (filterNak !== "all" && c.nakshatraIndex !== Number(filterNak)) return false;
    return true;
  }

  function clearFilters() {
    setFilterText("");
    setFilterLagna("all");
    setFilterRasi("all");
    setFilterNak("all");
  }

  const delMut = useMutation<unknown, Error, number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/charts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/charts"] }),
  });

  const all = savedQuery.data ?? [];
  const filtered = all.filter(matchesFilters);

  return (
    <>
      <div className="mb-5">
        <h1 className="font-serif text-xl text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          {t(UI.saved)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ta"
            ? "உருவாக்கிய ஜாதகங்கள் தானாகச் சேமிக்கப்படும். திறக்க தட்டவும்."
            : lang === "hi"
              ? "बनाई गई कुंडलियाँ स्वतः सहेजी जाती हैं। खोलने के लिए टैप करें।"
              : "Charts you generate are saved automatically. Tap one to open it."}
        </p>
      </div>

      {/* Filters */}
      {all.length > 0 && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-3">
            <Filter className="h-3.5 w-3.5" /> {t(UI.filters)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={t(UI.filterName)}
              data-testid="filter-name"
            />
            <Select value={filterLagna} onValueChange={setFilterLagna}>
              <SelectTrigger data-testid="filter-lagna"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(UI.allLagna)}</SelectItem>
                {RASIS.map((r, i) => (
                  <SelectItem key={i} value={String(i)}>{r[lang].split(" (")[0]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRasi} onValueChange={setFilterRasi}>
              <SelectTrigger data-testid="filter-rasi"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(UI.allRasi)}</SelectItem>
                {RASIS.map((r, i) => (
                  <SelectItem key={i} value={String(i)}>{r[lang].split(" (")[0]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterNak} onValueChange={setFilterNak}>
              <SelectTrigger data-testid="filter-nak"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(UI.allNakshatra)}</SelectItem>
                {NAKSHATRAS.map((n, i) => (
                  <SelectItem key={i} value={String(i)}>{n[lang]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtersActive && (
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters" className="gap-1.5">
                <X className="h-3.5 w-3.5" /> {t(UI.clearFilters)}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* List */}
      {savedQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
        </div>
      ) : all.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t(UI.noCharts)}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Filter className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t(UI.noMatches)}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="p-4 hover-elevate transition-colors"
              data-testid={`card-saved-${c.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openSavedChart(c)}
                  className="min-w-0 flex-1 text-left"
                  data-testid={`button-open-${c.id}`}
                >
                  <div className="font-serif text-base leading-tight truncate">
                    {c.name?.trim() || t(UI.unnamed)}
                  </div>
                  <div className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      {c.date} · {formatTime12(c.time)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{c.placeName}</span>
                    </div>
                  </div>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => delMut.mutate(c.id)}
                  disabled={delMut.isPending}
                  data-testid={`button-delete-${c.id}`}
                  aria-label={t(UI.deleteChart)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {(c.lagnaIndex != null || c.rasiIndex != null || c.nakshatraIndex != null) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.lagnaIndex != null && (
                    <span className="inline-flex items-center rounded-full bg-secondary/60 px-2 py-0.5 text-[11px]">
                      {t(UI.lagnaLabel)}: {RASIS[c.lagnaIndex][lang].split(" (")[0]}
                    </span>
                  )}
                  {c.rasiIndex != null && (
                    <span className="inline-flex items-center rounded-full bg-secondary/60 px-2 py-0.5 text-[11px]">
                      {t(UI.moonSign).split(" (")[0]}: {RASIS[c.rasiIndex][lang].split(" (")[0]}
                    </span>
                  )}
                  {c.nakshatraIndex != null && (
                    <span className="inline-flex items-center rounded-full bg-secondary/60 px-2 py-0.5 text-[11px]">
                      {NAKSHATRAS[c.nakshatraIndex][lang]}
                    </span>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
