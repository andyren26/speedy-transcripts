"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Summary column for one job. "Summarize" asks the server to generate (once)
 * an AI summary of the transcript; "View" opens the cached summary.
 */
export default function SummaryCell({
  jobId,
  initialSummary,
}: {
  jobId: string;
  initialSummary: string | null;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function summarize() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/summary`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.summary) {
        setError(body.error ?? `摘要失敗（HTTP ${res.status}）`);
        return;
      }
      setSummary(body.summary);
      setOpen(true);
      router.refresh();
    } catch {
      setError("網路錯誤，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {summary ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <FileText className="size-4" />
          View
        </button>
      ) : (
        <button
          type="button"
          onClick={summarize}
          disabled={busy}
          title="用 AI 快速總結這支影片"
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline disabled:cursor-wait disabled:opacity-70 disabled:no-underline"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? "摘要中…" : "Summarize"}
        </button>
      )}
      {error && <p className="mt-1 max-w-[12rem] text-xs text-destructive">{error}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">影片摘要 Summary</DialogTitle>
            <DialogDescription>由 AI 根據逐字稿自動產生，可能有少量誤差。</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm leading-7">{summary}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
