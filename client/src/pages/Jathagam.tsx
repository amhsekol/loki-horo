import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLang } from "@/lib/lang";
import { UI, RASIS, NAKSHATRAS, GRAHAS } from "@shared/astro/constants";
import type { ChartResult } from "@shared/astro/engine";
import { Layout } from "@/components/Layout";
import { RasiGrid, buildOccupants } from "@/components/RasiGrid";
import { PlaceSearch, tzOffsetHours, type GeoResult } from "@/components/PlaceSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Moon, Star, Sunrise } from "lucide-react";

function fmtDeg(d: number) {
  const deg = Math.floor(d);
  const minFloat = (d - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);
  return `${deg}° ${String(min).padStart(2, "0")}′ ${String(sec).padStart(2, "0")}″`;
}

export default function Jathagam() {
  const { lang, t } = useLang();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState<GeoResult | null>(null);
  const [placeLabel, setPlaceLabel] = useState("");

  const mut = useMutation<ChartResult, Error, void>({
    mutationFn: async () => {
      if (!place) throw new Error("Select a place");
      const tz = tzOffsetHours(place.timezone, date);
      const res = await apiRequest("POST", "/api/chart", {
        name, date, time,
        latitude: place.latitude,
        longitude: place.longitude,
        tzOffset: tz,
      });
      return res.json();
    },
  });

  const canSubmit = date && time && place;
  const chart = mut.data;

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
            <Label htmlFor="dob" className="mb-1.5 block">{t(UI.dob)}</Label>
            <Input id="dob" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-date" />
          </div>
          <div>
            <Label htmlFor="tob" className="mb-1.5 block">{t(UI.tob)}</Label>
            <Input id="tob" type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="input-time" />
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
          {/* Summary badges */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard icon={<Sunrise className="h-4 w-4" />} label={t(UI.lagnaLabel)}
              value={RASIS[chart.lagna.rasiIndex][lang].split(" (")[0]} sub={fmtDeg(chart.lagna.degInRasi)} />
            <SummaryCard icon={<Moon className="h-4 w-4" />} label={t(UI.moonSign)}
              value={chart.janmaRasi[lang].split(" (")[0]} sub={""} />
            <SummaryCard icon={<Star className="h-4 w-4" />} label={t(UI.birthStar)}
              value={chart.janmaNakshatra[lang]} sub={`${t(UI.pada)} ${chart.janmaPada}`} />
          </div>

          {/* Charts */}
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-lg mb-3 text-center">{t(UI.rasiChart)}</h2>
              <RasiGrid
                title={lang === "ta" ? "ராசி" : "Rasi D-1"}
                occupants={buildOccupants(
                  chart.planets.map((p) => p.rasiIndex),
                  chart.planets.map((p) => p.retrograde),
                  chart.lagna.rasiIndex,
                  lang
                )}
              />
            </div>
            <div>
              <h2 className="font-serif text-lg mb-3 text-center">{t(UI.navamsaChart)}</h2>
              <RasiGrid
                title={lang === "ta" ? "நவாம்சம்" : "Navamsa D-9"}
                occupants={buildOccupants(
                  chart.navamsa.planetSigns,
                  chart.planets.map((p) => p.retrograde),
                  chart.navamsa.lagnaSign,
                  lang
                )}
              />
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-card-border">
                Ayanamsa (Lahiri): {chart.meta.ayanamsa.toFixed(4)}°
              </div>
            </Card>
          </div>
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
