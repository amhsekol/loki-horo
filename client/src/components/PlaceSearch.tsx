import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { useLang } from "@/lib/lang";
import { UI } from "@shared/astro/constants";

export interface GeoResult {
  name: string;
  admin1: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface Props {
  value: string;
  onSelect: (place: GeoResult) => void;
}

// tz name -> offset hours (approx, standard offset). Uses Intl for accuracy.
function tzOffsetHours(tz: string, dateStr?: string): number {
  try {
    const d = dateStr ? new Date(dateStr + "T12:00:00Z") : new Date();
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false, timeZoneName: "shortOffset",
    });
    const parts = dtf.formatToParts(d);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    const sign = m[1] === "-" ? -1 : 1;
    const h = parseInt(m[2], 10);
    const min = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (h + min / 60);
  } catch {
    return 0;
  }
}

export function PlaceSearch({ value, onSelect }: Props) {
  const { t } = useLang();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const { data, isFetching } = useQuery<{ results: GeoResult[] }>({
    queryKey: ["/api/geocode", debounced],
    queryFn: async () => {
      if (debounced.trim().length < 2) return { results: [] };
      const res = await apiRequest("GET", `/api/geocode?q=${encodeURIComponent(debounced)}`);
      return res.json();
    },
    enabled: debounced.trim().length >= 2,
  });

  const results = data?.results ?? [];

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t(UI.searchPlace)}
          className="pl-9"
          data-testid="input-place"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-md border border-popover-border bg-popover shadow-lg max-h-64 overflow-auto"
          data-testid="list-places"
        >
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover-elevate active-elevate-2 flex flex-col"
                onClick={() => {
                  onSelect(r);
                  setQuery(`${r.name}${r.admin1 ? ", " + r.admin1 : ""}, ${r.country}`);
                  setOpen(false);
                }}
                data-testid={`option-place-${i}`}
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[r.admin1, r.country].filter(Boolean).join(", ")} · {r.latitude.toFixed(2)}, {r.longitude.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { tzOffsetHours };
