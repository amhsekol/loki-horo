import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLang } from "@/lib/lang";
import { UI, RASIS, NAKSHATRAS, GRAHAS } from "@shared/astro/constants";
import { DIGNITY_LABEL, DIGNITY_POINTS, type Dignity } from "@shared/astro/dignity";
import type { ChartResult } from "@shared/astro/engine";
import type { Chart } from "@shared/schema";
import { Layout } from "@/components/Layout";
import { RasiGrid, buildOccupants, DIGNITY_COLOR, DIGNITY_DOT } from "@/components/RasiGrid";
import { NorthIndianChart } from "@/components/NorthIndianChart";
import type { ChartScript } from "@shared/astro/constants";
import { PlaceSearch, tzOffsetHours, type GeoResult } from "@/components/PlaceSearch";
import { DateSelect, TimeSelect } from "@/components/DateTimePicker";
import { DashaTable } from "@/components/DashaTable";
import { IncidentsTab } from "@/components/IncidentsTab";
import { LagnaDashboard } from "@/components/LagnaDashboard";
import { AshtakavargaChart } from "@/components/AshtakavargaChart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Moon, Star, Sunrise, History, Trash2, MapPin, Clock, Filter, X, CalendarRange, LayoutDashboard, Grid3x3 } from "lucide-react";

function fmtDeg(d: number) {
  const deg = Math.floor(d);
  const minFloat = (d - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);
  return `${deg}° ${String(min).padStart(2, "0")}′ ${String(sec).padStart(2, "0")}″`;
}

// Default birth place: Chennai (matches app's Tamil sidereal focus).
const CHENNAI_DEFAULT: GeoResult = {
  name: "Chennai",
  admin1: "Tamil Nadu",
  country: "India",
  latitude: 13.08784,
  longitude: 80.27847,
  timezone: "Asia/Kolkata",
};

export default function Jathagam() {
  const { lang, t } = useLang();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState<GeoResult | null>(CHENNAI_DEFAULT);
  const [placeLabel, setPlaceLabel] = useState(
    `${CHENNAI_DEFAULT.name}, ${CHENNAI_DEFAULT.admin1}, ${CHENNAI_DEFAULT.country}`,
  );
  const [reopenedChart, setReopenedChart] = useState<ChartResult | null>(null);
  // Saved-chart id of the currently displayed chart (for attaching incidents).
  const [activeChartId, setActiveChartId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"chart" | "dashboard" | "ashtakavarga" | "incidents">("chart");
  const [chartStyle, setChartStyle] = useState<"south" | "north">("south");
  const [chartScript, setChartScript] = useState<ChartScript>("en");

  // Saved charts history
  const savedQuery = useQuery<Chart[]>({ queryKey: ["/api/charts"] });

  // Filters for saved charts
  const [filterText, setFilterText] = useState("");
  const [filterLagna, setFilterLagna] = useState("all");
  const [filterRasi, setFilterRasi] = useState("all");
  const [filterNak, setFilterNak] = useState("all");
  const filtersActive = filterText.trim() !== "" || filterLagna !== "all" || filterRasi !== "all" || filterNak !== "all";

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

  const mut = useMutation<ChartResult, Error, void>({
    mutationFn: async () => {
      setReopenedChart(null);
      setActiveChartId(null);
      setActiveTab("chart");
      if (!place) throw new Error("Select a place");
      const tz = tzOffsetHours(place.timezone, date);
      const res = await apiRequest("POST", "/api/chart", {
        name, date, time,
        latitude: place.latitude,
        longitude: place.longitude,
        tzOffset: tz,
      });
      const result: ChartResult = await res.json();
      // Auto-save every generated jathagam to history (with computed values for filtering).
      try {
        const moon = result.planets[1]; // Chandra -> Janma Rasi / Nakshatra
        const saveRes = await apiRequest("POST", "/api/charts", {
          name: name.trim() || "",
          date, time,
          placeName: place.name,
          latitude: String(place.latitude),
          longitude: String(place.longitude),
          tzOffset: String(tz),
          lagnaIndex: result.lagna.rasiIndex,
          rasiIndex: moon.rasiIndex,
          nakshatraIndex: moon.nakshatraIndex,
        });
        const saved: Chart = await saveRes.json();
        setActiveChartId(saved.id);
        queryClient.invalidateQueries({ queryKey: ["/api/charts"] });
      } catch { /* saving is best-effort; don't block the chart */ }
      return result;
    },
  });

  const delMut = useMutation<unknown, Error, number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/charts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/charts"] }),
  });

  // Re-open a saved chart: repopulate the form and regenerate.
  function openSaved(c: Chart) {
    setActiveChartId(c.id);
    setActiveTab("chart");
    setName(c.name);
    setDate(c.date);
    setTime(c.time);
    const tz = parseFloat(c.tzOffset);
    const geo: GeoResult = {
      name: c.placeName, admin1: "", country: "",
      latitude: parseFloat(c.latitude), longitude: parseFloat(c.longitude),
      timezone: `UTC${tz >= 0 ? "+" : ""}${tz}`,
    };
    setPlace(geo);
    setPlaceLabel(c.placeName);
    // Compute directly from the saved coordinates (avoid tz re-derivation).
    mut.reset();
    apiRequest("POST", "/api/chart", {
      name: c.name, date: c.date, time: c.time,
      latitude: parseFloat(c.latitude), longitude: parseFloat(c.longitude), tzOffset: tz,
    })
      .then((r) => r.json())
      .then((data) => { setReopenedChart(data); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const canSubmit = date && time && place;
  const chart = mut.data ?? reopenedChart;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-[2rem] text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          {t(UI.birthChart)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.disclaimer)}</p>
      </div>

      {/* Input form */}
      <Card className="p-5 md:p-6 mb-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name" className="mb-1.5 block">{t(UI.name)}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
          </div>
          <div>
            <Label className="mb-1.5 block">{t(UI.dob)}</Label>
            <DateSelect date={date} setDate={setDate} />
          </div>
          <div>
            <Label className="mb-1.5 block">{t(UI.tob)}</Label>
            <TimeSelect time={time} setTime={setTime} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block">{t(UI.pob)}</Label>
            <PlaceSearch value={placeLabel} onSelect={(p) => { setPlace(p); setPlaceLabel(p.name); }} />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button
            onClick={() => mut.mutate()}
            disabled={!canSubmit || mut.isPending}
            data-testid="button-generate"
          >
            {mut.isPending ? t(UI.loading) : t(UI.generate)}
          </Button>
          {mut.isError && <span className="text-sm text-destructive">{mut.error.message}</span>}
        </div>
      </Card>

      {mut.isPending && (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="aspect-square w-full max-w-[420px] mx-auto rounded-md" />
          <Skeleton className="aspect-square w-full max-w-[420px] mx-auto rounded-md" />
        </div>
      )}

      {chart && !mut.isPending && (
        <div className="space-y-8">
          {/* Tab switcher: Chart vs Incidents */}
          <div className="flex items-center gap-1 border-b border-card-border">
            <button
              type="button"
              onClick={() => setActiveTab("chart")}
              data-testid="tab-chart"
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "chart"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-4 w-4" /> {t(UI.tabChart)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dashboard")}
              data-testid="tab-dashboard"
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "dashboard"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" /> {t(UI.tabDashboard)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ashtakavarga")}
              data-testid="tab-ashtakavarga"
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "ashtakavarga"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid3x3 className="h-4 w-4" /> {t(UI.ashtavargaTab)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("incidents")}
              data-testid="tab-incidents"
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "incidents"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarRange className="h-4 w-4" /> {t(UI.tabIncidents)}
            </button>
          </div>

          {activeTab === "incidents" ? (
            <IncidentsTab chartId={activeChartId} chartLabel={name.trim() || undefined} />
          ) : activeTab === "dashboard" ? (
            <LagnaDashboard chart={chart} />
          ) : activeTab === "ashtakavarga" ? (
            <AshtakavargaChart chart={chart} />
          ) : (
          <div className="space-y-8">
          {/* Summary badges */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard icon={<Sunrise className="h-4 w-4" />} label={t(UI.lagnaLabel)}
              value={RASIS[chart.lagna.rasiIndex][lang].split(" (")[0]} sub={fmtDeg(chart.lagna.degInRasi)} />
            <SummaryCard icon={<Moon className="h-4 w-4" />} label={t(UI.moonSign)}
              value={chart.janmaRasi[lang].split(" (")[0]} sub={""} />
            <SummaryCard icon={<Star className="h-4 w-4" />} label={t(UI.birthStar)}
              value={chart.janmaNakshatra[lang]} sub={`${t(UI.pada)} ${chart.janmaPada}`} />
          </div>

          {/* Chart style + script controls */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t(UI.chartStyle)}:</span>
              <div className="inline-flex rounded-md border border-card-border overflow-hidden">
                <button
                  type="button"
                  data-testid="style-south"
                  onClick={() => setChartStyle("south")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    chartStyle === "south" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(UI.southStyle)}
                </button>
                <button
                  type="button"
                  data-testid="style-north"
                  onClick={() => setChartStyle("north")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-card-border ${
                    chartStyle === "north" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(UI.northStyle)}
                </button>
              </div>
            </div>
            {chartStyle === "north" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t(UI.scriptLabel)}:</span>
                <div className="inline-flex rounded-md border border-card-border overflow-hidden">
                  <button
                    type="button"
                    data-testid="script-en"
                    onClick={() => setChartScript("en")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      chartScript === "en" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(UI.scriptEn)}
                  </button>
                  <button
                    type="button"
                    data-testid="script-hi"
                    onClick={() => setChartScript("hi")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-card-border ${
                      chartScript === "hi" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(UI.scriptHi)}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-lg mb-3 text-center">{t(UI.rasiChart)}</h2>
              {chartStyle === "south" ? (
                <RasiGrid
                  title={lang === "ta" ? "ராசி" : "Rasi D-1"}
                  occupants={buildOccupants(
                    chart.planets.map((p) => p.rasiIndex),
                    chart.planets.map((p) => p.retrograde),
                    chart.lagna.rasiIndex,
                    lang,
                    true
                  )}
                />
              ) : (
                <NorthIndianChart
                  title={chartScript === "hi" ? "राशि D-1" : "Rasi D-1"}
                  script={chartScript}
                  lagnaSign={chart.lagna.rasiIndex}
                  planetSigns={chart.planets.map((p) => p.rasiIndex)}
                  retroFlags={chart.planets.map((p) => p.retrograde)}
                  showDignity
                />
              )}
            </div>
            <div>
              <h2 className="font-serif text-lg mb-3 text-center">{t(UI.navamsaChart)}</h2>
              {chartStyle === "south" ? (
                <RasiGrid
                  title={lang === "ta" ? "நவாம்சம்" : "Navamsa D-9"}
                  occupants={buildOccupants(
                    chart.navamsa.planetSigns,
                    chart.planets.map((p) => p.retrograde),
                    chart.navamsa.lagnaSign,
                    lang
                  )}
                />
              ) : (
                <NorthIndianChart
                  title={chartScript === "hi" ? "नवांश D-9" : "Navamsa D-9"}
                  script={chartScript}
                  lagnaSign={chart.navamsa.lagnaSign}
                  planetSigns={chart.navamsa.planetSigns}
                  retroFlags={chart.planets.map((p) => p.retrograde)}
                />
              )}
            </div>
          </div>

          {/* Planet table */}
          <div>
            <h2 className="font-serif text-lg mb-3">{t(UI.planetPositions)}</h2>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border bg-secondary/40 text-left">
                      <th className="px-3 py-2.5 font-medium">{t(UI.graha)}</th>
                      <th className="px-3 py-2.5 font-medium">{t(UI.rasi)}</th>
                      <th className="px-3 py-2.5 font-medium text-right">{t(UI.degree)}</th>
                      <th className="px-3 py-2.5 font-medium">{t(UI.nakshatra)}</th>
                      <th className="px-3 py-2.5 font-medium text-center">{t(UI.pada)}</th>
                      <th className="px-3 py-2.5 font-medium">{t(UI.dignity)}</th>
                      <th className="px-3 py-2.5 font-medium text-right">{t(UI.strength)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.planets.map((p) => (
                      <tr key={p.index} className="border-b border-card-border/60 last:border-0" data-testid={`row-planet-${p.index}`}>
                        <td className="px-3 py-2.5 font-medium">
                          {GRAHAS[p.index][lang].split(" (")[0]}
                          {p.retrograde && <sup className="ml-0.5 text-[10px] text-destructive">{t(UI.retro)}</sup>}
                        </td>
                        <td className="px-3 py-2.5">{RASIS[p.rasiIndex][lang].split(" (")[0]}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{fmtDeg(p.degInRasi)}</td>
                        <td className="px-3 py-2.5">{NAKSHATRAS[p.nakshatraIndex][lang]}</td>
                        <td className="px-3 py-2.5 text-center">{p.pada}</td>
                        <td className="px-3 py-2.5">
                          {p.dignity ? (
                            <span className={`font-medium ${DIGNITY_COLOR[p.dignity.key as Dignity]}`}>
                              {p.dignity.label[lang]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                          {p.dignity ? p.dignity.points : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-card-border">
                Ayanamsa (Lahiri): {chart.meta.ayanamsa.toFixed(4)}°
              </div>
            </Card>

            {/* Dignity / strength legend */}
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-1.5">{t(UI.dignityLegend)}</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {(Object.keys(DIGNITY_POINTS) as Dignity[]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 text-xs" data-testid={`legend-${k}`}>
                    <span className={`h-2 w-2 rounded-full ${DIGNITY_DOT[k]}`} />
                    <span className={DIGNITY_COLOR[k]}>{DIGNITY_LABEL[k][lang]}</span>
                    <span className="text-muted-foreground font-mono">{DIGNITY_POINTS[k]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Vimshottari Dasha timeline (birth → 120 yrs), nested & expandable */}
          {chart.dasha && (
            <div className="mt-10">
              <DashaTable dasha={chart.dasha} />
            </div>
          )}
          </div>
          )}
        </div>
      )}

      {!chart && !mut.isPending && (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {lang === "ta"
              ? "பிறந்த விவரங்களை உள்ளிட்டு ஜாதகம் உருவாக்குங்கள்."
              : "Enter birth details to generate the chart."}
          </p>
        </div>
      )}

      {/* Saved charts history */}
      <div className="mt-12">
        <h2 className="font-serif text-lg mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          {t(UI.saved)}
          {savedQuery.data && savedQuery.data.length > 0 && (
            <span className="text-xs text-muted-foreground font-sans">({savedQuery.data.length})</span>
          )}
        </h2>
        {savedQuery.isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
          </div>
        )}
        {savedQuery.data && savedQuery.data.length === 0 && (
          <p className="text-sm text-muted-foreground">{t(UI.noCharts)}</p>
        )}
        {savedQuery.data && savedQuery.data.length > 0 && (() => {
          const filtered = savedQuery.data!.filter(matchesFilters);
          return (
          <>
            {/* Filter controls */}
            <Card className="p-4 mb-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                <Filter className="h-3.5 w-3.5 text-primary" />
                {t(UI.filters)}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  placeholder={t(UI.filterName)}
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  data-testid="input-filter-name"
                />
                <Select value={filterLagna} onValueChange={setFilterLagna}>
                  <SelectTrigger data-testid="select-filter-lagna"><SelectValue placeholder={t(UI.allLagna)} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t(UI.allLagna)}</SelectItem>
                    {RASIS.map((r, i) => (
                      <SelectItem key={i} value={String(i)}>{r[lang].split(" (")[0]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterRasi} onValueChange={setFilterRasi}>
                  <SelectTrigger data-testid="select-filter-rasi"><SelectValue placeholder={t(UI.allRasi)} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t(UI.allRasi)}</SelectItem>
                    {RASIS.map((r, i) => (
                      <SelectItem key={i} value={String(i)}>{r[lang].split(" (")[0]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterNak} onValueChange={setFilterNak}>
                  <SelectTrigger data-testid="select-filter-nakshatra"><SelectValue placeholder={t(UI.allNakshatra)} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t(UI.allNakshatra)}</SelectItem>
                    {NAKSHATRAS.map((n, i) => (
                      <SelectItem key={i} value={String(i)}>{n[lang]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {filtersActive && (
                <div className="mt-3 flex items-center gap-3">
                  <Button size="sm" variant="ghost" onClick={clearFilters} data-testid="button-clear-filters" className="gap-1.5">
                    <X className="h-3.5 w-3.5" /> {t(UI.clearFilters)}
                  </Button>
                  <span className="text-xs text-muted-foreground" data-testid="text-filter-count">
                    {filtered.length} / {savedQuery.data!.length}
                  </span>
                </div>
              )}
            </Card>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-matches">{t(UI.noMatches)}</p>
            ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <Card key={c.id} className="p-4 flex flex-col gap-2" data-testid={`card-saved-${c.id}`}>
                <div className="font-medium text-base leading-tight truncate">
                  {c.name?.trim() || t(UI.unnamed)}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> {c.date} · {c.time}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> <span className="truncate">{c.placeName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openSaved(c)} data-testid={`button-open-${c.id}`}>
                    {t(UI.loadChart)}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => delMut.mutate(c.id)} disabled={delMut.isPending} data-testid={`button-delete-${c.id}`} aria-label={t(UI.deleteChart)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
            )}
          </>
          );
        })()}
      </div>
    </Layout>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="font-serif text-lg leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 font-mono">{sub}</div>}
    </Card>
  );
}
