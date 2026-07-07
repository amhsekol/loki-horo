import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/lib/auth";
import { useNav } from "@/lib/nav";
import { UI, RASIS, NAKSHATRAS } from "@shared/astro/constants";
import type { ChartWithAccess, ShareRecipient } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { History, Trash2, Filter, X, MapPin, Clock, Share2, UserRound, Users } from "lucide-react";

// Format "HH:MM" (24h) as "h:MM AM/PM" for display.
function formatTime12(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return time;
  let h = Number(m[1]);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m[2]} ${ap}`;
}

// Parse the "STATUS: {json}" error thrown by apiRequest into a human message.
function parseApiError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const m = /^\d+:\s*(\{.*\})$/s.exec(raw);
  if (m) {
    try {
      const body = JSON.parse(m[1]) as { message?: string; error?: string };
      return body.message || body.error || fallback;
    } catch {
      /* fall through */
    }
  }
  return raw || fallback;
}

// ---- Share dialog ---------------------------------------------------------
function ShareDialog({
  chart,
  onClose,
}: {
  chart: ChartWithAccess;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const recipientsQuery = useQuery<ShareRecipient[]>({
    queryKey: ["/api/charts", chart.id, "shares"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/charts/${chart.id}/shares`);
      return res.json();
    },
  });

  const addMut = useMutation<unknown, Error, string>({
    mutationFn: async (e) => {
      await apiRequest("POST", `/api/charts/${chart.id}/shares`, { email: e });
    },
    onSuccess: () => {
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/charts", chart.id, "shares"] });
      toast({ description: t(UI.shareAdded) });
    },
    onError: (err) => {
      toast({ variant: "destructive", description: parseApiError(err, t(UI.authError)) });
    },
  });

  const removeMut = useMutation<unknown, Error, number>({
    mutationFn: async (userId) => {
      await apiRequest("DELETE", `/api/charts/${chart.id}/shares/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charts", chart.id, "shares"] });
    },
  });

  const recipients = recipientsQuery.data ?? [];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-share">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            {t(UI.shareChartTitle)}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground -mt-1">
          {chart.name?.trim() || t(UI.unnamed)}
        </div>

        <form
          className="flex items-end gap-2 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = email.trim();
            if (v) addMut.mutate(v);
          }}
        >
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">{t(UI.shareByEmail)}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              data-testid="input-share-email"
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={addMut.isPending || !email.trim()} data-testid="button-share-add">
            {t(UI.share)}
          </Button>
        </form>

        <div className="mt-3">
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {t(UI.sharedWith)}
          </div>
          {recipientsQuery.isLoading ? (
            <Skeleton className="h-10 rounded-md" />
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2" data-testid="text-no-shares">{t(UI.noShares)}</p>
          ) : (
            <ul className="space-y-1.5">
              {recipients.map((r) => (
                <li
                  key={r.userId}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  data-testid={`row-share-${r.userId}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMut.mutate(r.userId)}
                    disabled={removeMut.isPending}
                    data-testid={`button-remove-share-${r.userId}`}
                  >
                    {t(UI.removeShare)}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-share-close">
            {t(UI.close)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Saved() {
  const { lang, t } = useLang();
  const { isAdmin } = useAuth();
  const { openSavedChart } = useNav();

  const savedQuery = useQuery<ChartWithAccess[]>({ queryKey: ["/api/charts"] });

  const [filterText, setFilterText] = useState("");
  const [filterLagna, setFilterLagna] = useState("all");
  const [filterRasi, setFilterRasi] = useState("all");
  const [filterNak, setFilterNak] = useState("all");
  const [shareChart, setShareChart] = useState<ChartWithAccess | null>(null);
  const filtersActive =
    filterText.trim() !== "" || filterLagna !== "all" || filterRasi !== "all" || filterNak !== "all";

  function matchesFilters(c: ChartWithAccess): boolean {
    const q = filterText.trim().toLowerCase();
    if (q) {
      const hay = `${c.name ?? ""} ${c.placeName ?? ""} ${c.ownerName ?? ""} ${c.ownerEmail ?? ""}`.toLowerCase();
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
          {isAdmin
            ? (lang === "ta"
                ? "நிர்வாகி என்ற முறையில் அனைத்து உறுப்பினர்களின் ஜாதகங்களையும் நீங்கள் காணலாம்."
                : lang === "hi"
                  ? "व्यवस्थापक के रूप में आप सभी सदस्यों की कुंडलियाँ देख सकते हैं।"
                  : "As admin, you can see every member's saved charts.")
            : (lang === "ta"
                ? "உங்கள் ஜாதகங்கள் மட்டுமே உங்களுக்குத் தெரியும். திறக்க தட்டவும்."
                : lang === "hi"
                  ? "केवल आपकी कुंडलियाँ आपको दिखती हैं। खोलने के लिए टैप करें।"
                  : "Only your charts are visible to you. Tap one to open it.")}
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
          {filtered.map((c) => {
            // Owners (and admins on their own charts) may manage sharing.
            const canShare = c.access === "own" || c.access === "admin";
            return (
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
                <div className="flex items-center gap-0.5 shrink-0">
                  {canShare && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => setShareChart(c)}
                      data-testid={`button-share-${c.id}`}
                      aria-label={t(UI.share)}
                      title={t(UI.share)}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => delMut.mutate(c.id)}
                    disabled={delMut.isPending || c.access === "shared"}
                    data-testid={`button-delete-${c.id}`}
                    aria-label={t(UI.deleteChart)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Access + astro badges */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {/* Shared-with-me badge for the current user */}
                {c.access === "shared" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[11px] font-medium" data-testid={`badge-shared-${c.id}`}>
                    <Share2 className="h-3 w-3" /> {t(UI.sharedBadge)}
                  </span>
                )}
                {/* Admin view: whose chart is this */}
                {isAdmin && (c.ownerName || c.ownerEmail) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[11px]" data-testid={`badge-owner-${c.id}`}>
                    <UserRound className="h-3 w-3" /> {t(UI.ownedBy)}: {c.ownerName || c.ownerEmail}
                  </span>
                )}
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
            </Card>
            );
          })}
        </div>
      )}

      {shareChart && <ShareDialog chart={shareChart} onClose={() => setShareChart(null)} />}
    </>
  );
}
