import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLang } from "@/lib/lang";
import { UI, GRAHAS, RASIS, NAKSHATRAS } from "@shared/astro/constants";
import type { PanchangamResult } from "@shared/astro/engine";
import { Layout } from "@/components/Layout";
import { PlaceSearch, tzOffsetHours, type GeoResult } from "@/components/PlaceSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Sunrise, Sunset, Clock, Moon, Star, Sparkles, CircleDot, Orbit } from "lucide-react";

function fmtDeg(d: number) {
  const deg = Math.floor(d);
  const minFloat = (d - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);
  return `${deg}° ${String(min).padStart(2, "0")}′ ${String(sec).padStart(2, "0")}″`;
}

const CHENNAI: GeoResult = {
  name: "Chennai", admin1: "Tamil Nadu", country: "India",
  latitude: 13.0827, longitude: 80.2707, timezone: "Asia/Kolkata",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Panchangam() {
  const { lang, t } = useLang();
  const [date, setDate] = useState(todayStr());
  const [place, setPlace] = useState<GeoResult>(CHENNAI);
  const [placeLabel, setPlaceLabel] = useState("Chennai");

  const mut = useMutation<PanchangamResult, Error, void>({
    mutationFn: async () => {
      const tz = tzOffsetHours(place.timezone, date);
      const res = await apiRequest("POST", "/api/panchangam", {
        date, latitude: place.latitude, longitude: place.longitude, tzOffset: tz,
      });
      return res.json();
    },
  });

  // auto-calc on first load
  useEffect(() => { mut.mutate(); /* eslint-disable-next-line */ }, []);

  const p = mut.data;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-[2rem] text-foreground flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          {t(UI.dailyAlmanac)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.disclaimer)}</p>
      </div>

      <Card className="p-5 md:p-6 mb-8">
        <div className="grid gap-4 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
          <div>
            <Label htmlFor="pdate" className="mb-1.5 block">{t(UI.date)}</Label>
            <div className="flex gap-2">
              <Input id="pdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-pdate" />
              <Button variant="outline" onClick={() => setDate(todayStr())} data-testid="button-today">{t(UI.useNow)}</Button>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">{t(UI.place)}</Label>
            <PlaceSearch value={placeLabel} onSelect={(pl) => { setPlace(pl); setPlaceLabel(pl.name); }} />
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} data-testid="button-calc">
            {mut.isPending ? t(UI.loading) : t(UI.calculate)}
          </Button>
        </div>
      </Card>

      {mut.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      )}

      {p && !mut.isPending && (
        <div className="space-y-8">
          {/* Header strip */}
          <Card className="p-5 bg-gradient-to-br from-primary/10 to-accent/20 border-primary/20">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="font-serif text-xl">{t(p.vara)}</div>
                <div className="text-sm text-muted-foreground">{p.date}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{t(UI.tamilMonth)}</div>
                <div className="font-serif text-lg">{t(p.tamilMonth)} {p.tamilDay}</div>
              </div>
            </div>
          </Card>

          {/* Panchangam five limbs */}
          <div>
            <h2 className="font-serif text-lg mb-3">
              {lang === "ta" ? "பஞ்சாங்கம் (ஐந்து அங்கம்)" : "Panchangam (Five Limbs)"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard icon={<Moon className="h-4 w-4" />} label={t(UI.tithi)} value={t(p.tithi.name)} />
              <InfoCard icon={<Star className="h-4 w-4" />} label={t(UI.nakshatra)} value={t(p.nakshatra.name)} />
              <InfoCard icon={<Sparkles className="h-4 w-4" />} label={t(UI.yoga)} value={t(p.yoga.name)} />
              <InfoCard icon={<CircleDot className="h-4 w-4" />} label={t(UI.karana)} value={t(p.karana.name)} />
              <InfoCard icon={<Sunrise className="h-4 w-4" />} label={t(UI.sunrise)} value={p.sunrise ?? "--:--"} mono />
              <InfoCard icon={<Sunset className="h-4 w-4" />} label={t(UI.sunset)} value={p.sunset ?? "--:--"} mono />
            </div>
          </div>

          {/* Inauspicious timings */}
          <div>
            <h2 className="font-serif text-lg mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-destructive" />
              {t(UI.inauspicious)}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <TimeCard label={t(UI.rahuKalam)} window={p.rahuKalam} tone="destructive" />
              <TimeCard label={t(UI.yamagandam)} window={p.yamagandam} tone="destructive" />
              <TimeCard label={t(UI.kuligai)} window={p.kuligai} tone="warning" />
            </div>
          </div>

          {/* Planetary positions today */}
          {p.planets && p.planets.length > 0 && (
            <div>
              <h2 className="font-serif text-lg mb-3 flex items-center gap-2">
                <Orbit className="h-4 w-4 text-primary" />
                {lang === "ta" ? "இன்றைய கிரக நிலைகள் (உதயத்தில்)" : "Today's Planetary Positions (at sunrise)"}
              </h2>
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
                      </tr>
                    </thead>
                    <tbody>
                      {p.planets.map((pl) => (
                        <tr key={pl.index} className="border-b border-card-border/60 last:border-0" data-testid={`row-panchang-planet-${pl.index}`}>
                          <td className="px-3 py-2.5 font-medium">
                            {GRAHAS[pl.index][lang].split(" (")[0]}
                            {pl.retrograde && <sup className="ml-0.5 text-[10px] text-destructive">{t(UI.retro)}</sup>}
                          </td>
                          <td className="px-3 py-2.5">{RASIS[pl.rasiIndex][lang].split(" (")[0]}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{fmtDeg(pl.degInRasi)}</td>
                          <td className="px-3 py-2.5">{NAKSHATRAS[pl.nakshatraIndex][lang]}</td>
                          <td className="px-3 py-2.5 text-center">{pl.pada}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground">
            Ayanamsa (Lahiri): {p.ayanamsa.toFixed(4)}° · {place.name}, {place.country}
          </div>
        </div>
      )}
    </Layout>
  );
}

function InfoCard({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <Card className="p-4" data-testid={`info-${label}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className={`text-base font-medium leading-snug ${mono ? "font-mono tabular-nums" : ""}`}>{value}</div>
    </Card>
  );
}

function TimeCard({ label, window, tone }: { label: string; window: { start: string; end: string }; tone: "destructive" | "warning" }) {
  const color = tone === "destructive" ? "text-destructive" : "text-chart-4";
  return (
    <Card className="p-4" data-testid={`time-${label}`}>
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      <div className={`font-mono tabular-nums text-base font-semibold ${color}`}>
        {window.start} – {window.end}
      </div>
    </Card>
  );
}
