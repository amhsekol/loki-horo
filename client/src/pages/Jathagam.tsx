import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLang } from "@/lib/lang";
import { useNav } from "@/lib/nav";
import { UI, RASIS, NAKSHATRAS, GRAHAS } from "@shared/astro/constants";
import { DIGNITY_LABEL, DIGNITY_POINTS, type Dignity } from "@shared/astro/dignity";
import type { ChartResult } from "@shared/astro/engine";
import type { Chart } from "@shared/schema";
import { RasiGrid, buildOccupants, DIGNITY_COLOR, DIGNITY_DOT } from "@/components/RasiGrid";
import { BoxDetail, BoxTapHint } from "@/components/BoxDetail";
import { NorthIndianChart } from "@/components/NorthIndianChart";
import type { ChartScript } from "@shared/astro/constants";
import { PlaceSearch, tzOffsetHours, type GeoResult } from "@/components/PlaceSearch";
import { DateSelect, TimeSelect } from "@/components/DateTimePicker";
import { DashaTable } from "@/components/DashaTable";
import { IncidentsTab } from "@/components/IncidentsTab";
import { LagnaDashboard } from "@/components/LagnaDashboard";
import { AshtakavargaChart } from "@/components/AshtakavargaChart";
import { KNRaoTab } from "@/components/KNRaoTab";
import { GurujiTab } from "@/components/GurujiTab";
import { RiseFallTab } from "@/components/RiseFallTab";
import { PersonaTab } from "@/components/PersonaTab";
import { DashaTransitTab } from "@/components/DashaTransitTab";
import { RulesTab } from "@/components/RulesTab";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Moon, Star, Sunrise, MapPin, Clock, CalendarRange, CalendarClock, LayoutDashboard, Grid3x3, Pencil, Check, User, BookOpen, Sun, TrendingUp, Library } from "lucide-react";

// Format "HH:MM" (24h) as "h:MM AM/PM" for display.
function formatTime12(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return time;
  let h = Number(m[1]);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m[2]} ${ap}`;
}

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
  const { lang, t, chartStyle: preferredStyle } = useLang();
  const { registerOpenSaved } = useNav();
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
  // When a saved chart is opened, the form is locked. Only after clicking the
  // edit pen do date & time become editable.
  const [openedFromSaved, setOpenedFromSaved] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // Snapshot of date/time when entering edit mode, so Cancel can restore.
  const [editSnapshot, setEditSnapshot] = useState<{ date: string; time: string } | null>(null);
  // The exact tz offset of the currently opened saved chart (avoids re-derivation).
  const [activeTz, setActiveTz] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"chart" | "dashboard" | "ashtakavarga" | "knrao" | "guruji" | "rules" | "risefall" | "dashatransit" | "persona" | "incidents">("chart");
  // Seed from the startup-chosen preference; still toggleable inline per-chart.
  const [chartStyle, setChartStyle] = useState<"south" | "north">(preferredStyle);
  const [chartScript, setChartScript] = useState<ChartScript>("en");
  // Selected D-1 Rasi box for the tap-detail panel. -1 = none selected.
  const [selectedSign, setSelectedSign] = useState<number>(-1);

  const mut = useMutation<ChartResult, Error, void>({
    mutationFn: async () => {
      setReopenedChart(null);
      setActiveChartId(null);
      setSelectedSign(-1);
      setActiveTab("chart");
      setOpenedFromSaved(false);
      setEditMode(false);
      setEditSnapshot(null);
      setActiveTz(null);
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

  // Re-open a saved chart: repopulate the form (LOCKED) and regenerate.
  function openSaved(c: Chart) {
    setActiveChartId(c.id);
    setSelectedSign(-1);
    setActiveTab("chart");
    setOpenedFromSaved(true);
    setEditMode(false);
    setEditSnapshot(null);
    setName(c.name);
    setDate(c.date);
    setTime(c.time);
    const tz = parseFloat(c.tzOffset);
    setActiveTz(tz);
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

  // Expose openSaved to the Saved module (via nav context) so tapping a saved
  // chart there switches to Jathagam and loads it here.
  useEffect(() => {
    registerOpenSaved(openSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset to a blank fresh-entry form (unlocks it, clears the opened chart).
  function resetForm() {
    setOpenedFromSaved(false);
    setEditMode(false);
    setEditSnapshot(null);
    setActiveChartId(null);
    setReopenedChart(null);
    setActiveTz(null);
    mut.reset();
    setName("");
    setDate("");
    setTime("");
    setPlace(CHENNAI_DEFAULT);
    setPlaceLabel(`${CHENNAI_DEFAULT.name}, ${CHENNAI_DEFAULT.admin1}, ${CHENNAI_DEFAULT.country}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Enter edit mode on an opened saved chart (only date & time editable).
  function startEdit() {
    setEditSnapshot({ date, time });
    setEditMode(true);
  }

  // Cancel edits: restore the snapshot and leave edit mode.
  function cancelEdit() {
    if (editSnapshot) {
      setDate(editSnapshot.date);
      setTime(editSnapshot.time);
    }
    setEditSnapshot(null);
    setEditMode(false);
  }

  // Save edits: recompute the chart with the new date/time (same place),
  // update the saved record, then re-lock the form.
  async function saveEdit() {
    if (!place || !date || !time) return;
    // Reuse the opened chart's exact tz offset; fall back to place-derived tz.
    const tz = activeTz != null ? activeTz : tzOffsetHours(place.timezone, date);
    const res = await apiRequest("POST", "/api/chart", {
      name, date, time,
      latitude: place.latitude, longitude: place.longitude, tzOffset: tz,
    });
    const result: ChartResult = await res.json();
    setReopenedChart(result);
    // Persist the new date/time back to the saved record.
    if (activeChartId != null) {
      try {
        const moon = result.planets[1];
        await apiRequest("PATCH", `/api/charts/${activeChartId}`, {
          date, time,
          lagnaIndex: result.lagna.rasiIndex,
          rasiIndex: moon.rasiIndex,
          nakshatraIndex: moon.nakshatraIndex,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/charts"] });
      } catch { /* best-effort persistence */ }
    }
    setEditSnapshot(null);
    setEditMode(false);
  }

  const savedEditMut = useMutation<void, Error, void>({ mutationFn: saveEdit });

  // The saved-chart form is locked whenever a saved chart is open and we're not editing.
  const formLocked = openedFromSaved && !editMode;

  const canSubmit = date && time && place;
  const chart = mut.data ?? reopenedChart;

  return (
    <>
      <div className="mb-5">
        <h1 className="font-serif text-xl text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t(UI.birthChart)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.disclaimer)}</p>
      </div>

      {/* Input form */}
      <Card className="p-5 md:p-6 mb-8">
        {formLocked ? (
          /* -------- Locked read-only view of an opened saved chart -------- */
          <div data-testid="locked-form">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-serif text-lg leading-tight truncate" data-testid="locked-name">
                  {name.trim() || t(UI.unnamed)}
                </div>
                <div className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5" data-testid="locked-datetime">
                    <Clock className="h-3.5 w-3.5 text-primary" /> {date} · {formatTime12(time)}
                  </div>
                  <div className="flex items-center gap-1.5" data-testid="locked-place">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> <span className="truncate">{placeLabel}</span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 shrink-0"
                onClick={startEdit}
                data-testid="button-edit"
                aria-label={t(UI.editDetails)}
              >
                <Pencil className="h-3.5 w-3.5" /> {t(UI.editDetails)}
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={resetForm} data-testid="button-new-chart" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> {t(UI.generate)}
              </Button>
            </div>
          </div>
        ) : editMode ? (
          /* -------- Edit mode: only date & time editable -------- */
          <div data-testid="edit-form">
            <div className="mb-3 text-xs text-muted-foreground flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5 text-primary" /> {t(UI.editHint)}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="mb-1.5 block">{t(UI.name)}</Label>
                <div className="flex items-center gap-1.5 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground" data-testid="edit-name-readonly">
                  <User className="h-3.5 w-3.5" /> {name.trim() || t(UI.unnamed)}
                </div>
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
                <div className="flex items-center gap-1.5 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground" data-testid="edit-place-readonly">
                  <MapPin className="h-3.5 w-3.5" /> {placeLabel}
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <Button
                onClick={() => savedEditMut.mutate()}
                disabled={!canSubmit || savedEditMut.isPending}
                data-testid="button-save-edit"
                className="gap-1.5"
              >
                <Check className="h-4 w-4" /> {savedEditMut.isPending ? t(UI.loading) : t(UI.saveChanges)}
              </Button>
              <Button variant="ghost" onClick={cancelEdit} disabled={savedEditMut.isPending} data-testid="button-cancel-edit">
                {t(UI.cancelEdit)}
              </Button>
            </div>
          </div>
        ) : (
          /* -------- Normal fresh entry (fully editable) -------- */
          <>
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
          </>
        )}
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
          <div className="flex items-center gap-1 border-b border-card-border overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => setActiveTab("chart")}
              data-testid="tab-chart"
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
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
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
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
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "ashtakavarga"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid3x3 className="h-4 w-4" /> {t(UI.ashtavargaTab)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("knrao")}
              data-testid="tab-knrao"
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "knrao"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="h-4 w-4" /> {t(UI.knRaoTab)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("guruji")}
              data-testid="tab-guruji"
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "guruji"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="h-4 w-4" /> {t(UI.gurujiTab)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("risefall")}
              data-testid="tab-risefall"
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "risefall"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="h-4 w-4" /> {t(UI.riseFallTab)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dashatransit")}
              data-testid="tab-dashatransit"
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "dashatransit"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarClock className="h-4 w-4" /> {t(UI.dashaTransitTab)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("persona")}
              data-testid="tab-persona"
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "persona"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-4 w-4" /> {t(UI.personaTab)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rules")}
              data-testid="tab-rules"
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "rules"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Library className="h-4 w-4" /> {t(UI.rulesTab)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("incidents")}
              data-testid="tab-incidents"
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
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
          ) : activeTab === "knrao" ? (
            <KNRaoTab chart={chart} />
          ) : activeTab === "guruji" ? (
            <GurujiTab chart={chart} chartId={activeChartId} chartName={name.trim() || undefined} />
          ) : activeTab === "risefall" ? (
            <RiseFallTab chart={chart} />
          ) : activeTab === "dashatransit" ? (
            <DashaTransitTab chart={chart} chartId={activeChartId} />
          ) : activeTab === "persona" ? (
            <PersonaTab chart={chart} />
          ) : activeTab === "rules" ? (
            <RulesTab />
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
                <>
                  <RasiGrid
                    title={lang === "ta" ? "ராசி" : "Rasi D-1"}
                    occupants={buildOccupants(
                      chart.planets.map((p) => p.rasiIndex),
                      chart.planets.map((p) => p.retrograde),
                      chart.lagna.rasiIndex,
                      lang,
                      true
                    )}
                    onSelect={(s) => setSelectedSign((cur) => (cur === s ? -1 : s))}
                    selectedSign={selectedSign}
                  />
                  {selectedSign >= 0 ? (
                    <div className="mt-4">
                      <BoxDetail chart={chart} sign={selectedSign} onClose={() => setSelectedSign(-1)} />
                    </div>
                  ) : (
                    <BoxTapHint />
                  )}
                </>
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

    </>
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
