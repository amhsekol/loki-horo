import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLang } from "@/lib/lang";
import { UI } from "@shared/astro/constants";
import type { Incident, Chart } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateSelect } from "@/components/DateTimePicker";
import { CalendarPlus, Trash2, ThumbsUp, ThumbsDown, CalendarRange, History } from "lucide-react";

// ---- date helpers -------------------------------------------------------
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtDate(s: string, lang: "ta" | "en"): string {
  const d = parseYMD(s);
  return d.toLocaleDateString(lang === "ta" ? "ta-IN" : "en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

// Inclusive day count between two YYYY-MM-DD dates.
function dayCount(start: string, end: string): number {
  const a = parseYMD(start).getTime();
  const b = parseYMD(end).getTime();
  return Math.floor((b - a) / (24 * 3600 * 1000)) + 1;
}

// Human-readable duration string.
function durationLabel(start: string, end: string, t: (b: any) => string): string {
  const days = dayCount(start, end);
  if (days <= 1) return t(UI.oneDay);
  if (days < 45) return `${days} ${t(UI.days)}`;
  const months = days / 30.4375;
  if (months < 24) return `${months.toFixed(1)} ${t(UI.months)}`;
  return `${(days / 365.25).toFixed(1)} ${t(UI.years)}`;
}

export function IncidentsTab({ chartId, chartLabel }: { chartId: number | null; chartLabel?: string }) {
  const { lang, t } = useLang();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"good" | "bad">("good");
  const [single, setSingle] = useState(true);
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [note, setNote] = useState("");

  const listQuery = useQuery<Incident[]>({
    queryKey: ["/api/charts", chartId, "incidents"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/charts/${chartId}/incidents`);
      return r.json();
    },
    enabled: chartId != null,
  });

  const addMut = useMutation<Incident, Error, void>({
    mutationFn: async () => {
      if (chartId == null) throw new Error("No chart");
      const effectiveEnd = single ? startDate : endDate;
      const r = await apiRequest("POST", "/api/incidents", {
        chartId,
        name: name.trim(),
        startDate,
        endDate: effectiveEnd,
        singleDay: single ? 1 : 0,
        kind,
        note: note.trim() || null,
      });
      return r.json();
    },
    onSuccess: () => {
      setName(""); setNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/charts", chartId, "incidents"] });
    },
  });

  const delMut = useMutation<unknown, Error, number>({
    mutationFn: async (id) => { await apiRequest("DELETE", `/api/incidents/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/charts", chartId, "incidents"] }),
  });

  // Guard: no chart selected.
  if (chartId == null) {
    return (
      <div className="text-center py-16 text-muted-foreground" data-testid="incidents-need-chart">
        <CalendarRange className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm max-w-md mx-auto">{t(UI.incidentsNeedChart)}</p>
      </div>
    );
  }

  const rangeInvalid = !single && parseYMD(endDate) < parseYMD(startDate);
  const canAdd = name.trim() !== "" && !rangeInvalid && !addMut.isPending;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-lg flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" />
          {t(UI.incidentsTitle)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t(UI.incidentsSubtitle)}
          {chartLabel ? ` · ${t(UI.forChart)}: ${chartLabel}` : ""}
        </p>
      </div>

      {/* Add form */}
      <Card className="p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Name */}
          <div className="md:col-span-2">
            <Label htmlFor="incident-name" className="mb-1.5 block">{t(UI.incidentName)}</Label>
            <Input
              id="incident-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-incident-name"
            />
          </div>

          {/* Good / Bad */}
          <div>
            <Label className="mb-1.5 block">{t(UI.incidentKind)}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={kind === "good" ? "default" : "outline"}
                className="flex-1 gap-1.5"
                onClick={() => setKind("good")}
                data-testid="button-kind-good"
              >
                <ThumbsUp className="h-4 w-4" /> {t(UI.good)}
              </Button>
              <Button
                type="button"
                variant={kind === "bad" ? "default" : "outline"}
                className={`flex-1 gap-1.5 ${kind === "bad" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}`}
                onClick={() => setKind("bad")}
                data-testid="button-kind-bad"
              >
                <ThumbsDown className="h-4 w-4" /> {t(UI.bad)}
              </Button>
            </div>
          </div>

          {/* Single-day toggle */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer select-none py-2" data-testid="toggle-single-day">
              <Checkbox
                checked={single}
                onCheckedChange={(v) => setSingle(Boolean(v))}
                data-testid="checkbox-single-day"
              />
              <span className="text-sm">{t(UI.singleDay)}</span>
            </label>
          </div>

          {/* Start date */}
          <div>
            <Label className="mb-1.5 block">{t(UI.startDate)}</Label>
            <DateSelect
              date={startDate}
              setDate={(d) => { setStartDate(d); if (single) setEndDate(d); }}
            />
          </div>

          {/* End date — greyed out for single-day */}
          <div className={single ? "opacity-40 pointer-events-none" : ""} aria-disabled={single} data-testid="wrap-end-date">
            <Label className="mb-1.5 block">
              {t(UI.endDate)}
              {single && <span className="ml-2 text-[11px] text-muted-foreground">({t(UI.singleDay)})</span>}
            </Label>
            <DateSelect date={single ? startDate : endDate} setDate={setEndDate} />
          </div>

          {/* Note */}
          <div className="md:col-span-2">
            <Label htmlFor="incident-note" className="mb-1.5 block">{t(UI.note)}</Label>
            <Input
              id="incident-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="input-incident-note"
            />
          </div>
        </div>

        {/* Duration readout — greyed for single day */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className={`text-sm ${single ? "opacity-40" : ""}`} data-testid="text-duration">
            <span className="text-muted-foreground">{t(UI.duration)}: </span>
            <span className="font-medium">{durationLabel(startDate, single ? startDate : endDate, t)}</span>
          </div>
          {rangeInvalid && (
            <span className="text-sm text-destructive">
              {lang === "ta" ? "முடிவு தேதி தொடக்கத்திற்குப் பிறகு இருக்க வேண்டும்." : "End date must be on or after start date."}
            </span>
          )}
        </div>

        <div className="mt-5">
          <Button onClick={() => addMut.mutate()} disabled={!canAdd} data-testid="button-add-incident" className="gap-1.5">
            <CalendarPlus className="h-4 w-4" />
            {addMut.isPending ? t(UI.loading) : t(UI.addIncident)}
          </Button>
        </div>
      </Card>

      {/* Timeline list */}
      <div>
        <h3 className="font-serif text-base mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          {t(UI.incidentsTitle)}
          {listQuery.data && listQuery.data.length > 0 && (
            <span className="text-xs text-muted-foreground font-sans">({listQuery.data.length})</span>
          )}
        </h3>
        {listQuery.data && listQuery.data.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="text-no-incidents">{t(UI.noIncidents)}</p>
        )}
        <div className="space-y-2" data-testid="incidents-list">
          {(listQuery.data ?? []).map((inc) => (
            <Card
              key={inc.id}
              className={`p-4 flex items-start gap-3 border-l-4 ${inc.kind === "good" ? "border-l-emerald-500" : "border-l-destructive"}`}
              data-testid={`incident-row-${inc.id}`}
            >
              <span className={`mt-0.5 shrink-0 ${inc.kind === "good" ? "text-emerald-500" : "text-destructive"}`}>
                {inc.kind === "good" ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium leading-tight">{inc.name}</div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="font-mono">
                    {fmtDate(inc.startDate, lang)}
                    {inc.singleDay ? "" : ` → ${fmtDate(inc.endDate, lang)}`}
                  </span>
                  <span>· {durationLabel(inc.startDate, inc.endDate, t)}</span>
                </div>
                {inc.note && <div className="text-xs text-muted-foreground mt-1 italic">{inc.note}</div>}
              </div>
              <Button
                size="sm" variant="ghost"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => delMut.mutate(inc.id)}
                disabled={delMut.isPending}
                data-testid={`button-delete-incident-${inc.id}`}
                aria-label={t(UI.deleteChart)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
