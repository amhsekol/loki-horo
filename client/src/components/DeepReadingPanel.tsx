/**
 * Admin-only panel that triggers Perplexity Sonar to generate a full
 * Guruji-style prose reading for the current chart.
 *
 * - Gated behind `useAuth().isAdmin` — the button and the endpoint are both
 *   admin-restricted. Non-admin users don't see this component (parent hides).
 * - Shows current monthly budget usage
 * - On click, POSTs to /api/deep-reading/:chartId, polls until complete
 * - Renders the returned Markdown with a "Download Markdown" action
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Download, AlertCircle, RefreshCw } from "lucide-react";

interface DeepReading {
  id: number;
  chartId: number;
  status: "streaming" | "complete" | "failed";
  model: string;
  proseMarkdown: string | null;
  sectionsCompleted: number;
  sectionsTotal: number;
  costUsd: number;
  errorMessage: string | null;
  updatedAt: number;
}

interface BudgetInfo {
  monthKey: string;
  spentUsd: number;
  budgetUsd: number;
  remainingUsd: number;
}

interface Props {
  chartId: number | null;
  chartName?: string;
}

export function DeepReadingPanel({ chartId, chartName }: Props) {
  const qc = useQueryClient();
  const [polling, setPolling] = useState(false);

  // Load cached reading (if any) for this chart. Use raw fetch so 404
  // (no reading yet) returns null instead of throwing.
  const readingQ = useQuery<DeepReading | null>({
    queryKey: ["/api/deep-reading", chartId],
    queryFn: async () => {
      const res = await fetch(`/api/deep-reading/${chartId}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!chartId,
    retry: false,
    refetchInterval: polling ? 2000 : false,
  });

  // Budget info
  const budgetQ = useQuery<BudgetInfo>({
    queryKey: ["/api/admin/budget"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/budget")).json(),
  });

  // Generate a fresh reading
  const generateMut = useMutation({
    mutationFn: async (force: boolean) => {
      if (!chartId) throw new Error("No chart selected");
      const res = await apiRequest("POST", `/api/deep-reading/${chartId}`, { force });
      return res.json();
    },
    onSuccess: () => {
      setPolling(false);
      qc.invalidateQueries({ queryKey: ["/api/deep-reading", chartId] });
      qc.invalidateQueries({ queryKey: ["/api/admin/budget"] });
    },
    onError: () => {
      setPolling(false);
    },
  });

  // Poll while streaming
  useEffect(() => {
    if (readingQ.data?.status === "streaming") {
      setPolling(true);
    } else if (readingQ.data?.status === "complete" || readingQ.data?.status === "failed") {
      setPolling(false);
    }
  }, [readingQ.data?.status]);

  const reading = readingQ.data;
  const budget = budgetQ.data;
  const isBusy = generateMut.isPending || reading?.status === "streaming";

  function downloadMarkdown() {
    if (!reading?.proseMarkdown) return;
    const blob = new Blob([reading.proseMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chartName ?? "reading"}-guruji.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!chartId) return null;

  return (
    <Card className="p-4 sm:p-6 border-primary/30 bg-primary/5" data-testid="panel-deep-reading">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div>
            <h3 className="text-base font-semibold" data-testid="text-deep-reading-title">
              Full Guruji Reading (Admin)
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Generate a complete Nadi-style prose reading using Perplexity Sonar,
              grounded in every rule that fires for this chart. About 2-3 minutes
              per full reading.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {reading?.status === "complete" && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadMarkdown}
              data-testid="button-download-reading"
            >
              <Download className="h-4 w-4 mr-1.5" /> Download
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => generateMut.mutate(reading?.status === "complete")}
            disabled={isBusy}
            data-testid="button-generate-reading"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                {reading?.status === "streaming" ? "Streaming…" : "Starting…"}
              </>
            ) : reading?.status === "complete" ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Regenerate
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" /> Generate
              </>
            )}
          </Button>
        </div>
      </div>

      {budget && (
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-3">
          <span data-testid="text-budget">
            Budget · ${budget.spentUsd.toFixed(2)} / ${budget.budgetUsd.toFixed(2)} used ·
            ${budget.remainingUsd.toFixed(2)} remaining
          </span>
        </div>
      )}

      {reading?.status === "streaming" && (
        <div className="mt-4 space-y-2">
          <div className="text-sm text-muted-foreground">
            Generating section {reading.sectionsCompleted} / {reading.sectionsTotal}…
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{
                width: `${
                  reading.sectionsTotal > 0
                    ? (reading.sectionsCompleted / reading.sectionsTotal) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {reading?.status === "failed" && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-start gap-2" data-testid="text-reading-error">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Generation failed.</strong> {reading.errorMessage}
          </div>
        </div>
      )}

      {generateMut.error && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>{(generateMut.error as Error).message}</div>
        </div>
      )}

      {reading?.status === "complete" && reading.proseMarkdown && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-sm font-medium text-primary hover:underline" data-testid="button-toggle-reading">
            View reading ({reading.model} · ${reading.costUsd.toFixed(3)})
          </summary>
          <div className="mt-3 max-h-[600px] overflow-y-auto p-4 bg-background border rounded-md">
            <pre className="whitespace-pre-wrap text-sm font-sans" data-testid="text-reading-content">
              {reading.proseMarkdown}
            </pre>
          </div>
        </details>
      )}
    </Card>
  );
}
