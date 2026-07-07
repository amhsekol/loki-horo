import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLang } from "@/lib/lang";
import { UI } from "@shared/astro/constants";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserRound, ShieldCheck, FileText, CalendarDays } from "lucide-react";

type Member = {
  id: number;
  email: string;
  displayName: string;
  role: string;
  provider: string;
  createdAt: number;
  chartCount: number;
};

function formatJoined(epoch: number, locale: string): string {
  const ms = epoch < 1e12 ? epoch * 1000 : epoch; // tolerate seconds or ms
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

export default function Members() {
  const { lang, t } = useLang();
  const locale = lang === "ta" ? "ta-IN" : lang === "hi" ? "hi-IN" : "en-US";

  const membersQuery = useQuery<Member[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      return res.json();
    },
  });

  const members = membersQuery.data ?? [];

  return (
    <>
      <div className="mb-5">
        <h1 className="font-serif text-xl text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {t(UI.membersTitle)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t(UI.membersSubtitle)}</p>
      </div>

      {membersQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">—</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {members.map((m) => {
            const admin = m.role === "admin";
            return (
              <Card key={m.id} className="p-4" data-testid={`card-member-${m.id}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${admin ? "bg-primary/15 text-primary" : "bg-secondary/70 text-muted-foreground"}`}>
                    {admin ? <ShieldCheck className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-base leading-tight truncate" data-testid={`text-member-name-${m.id}`}>
                        {m.displayName}
                      </span>
                      {admin && (
                        <span className="inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[11px] font-medium">
                          {t(UI.adminBadge)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5" data-testid={`text-member-email-${m.id}`}>
                      {m.email}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5" data-testid={`text-member-charts-${m.id}`}>
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        {m.chartCount} {t(UI.chartCountLabel)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        {t(UI.joinedLabel)} {formatJoined(m.createdAt, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
