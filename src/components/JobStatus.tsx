const IN_PROGRESS: Record<string, string> = {
  pending: "排隊中",
  downloading: "下載中",
  transcribe: "轉錄中",
};

const FINAL_STYLE: Record<string, string> = {
  done: "bg-success/15 text-success",
  insufficient_credits: "bg-destructive/15 text-destructive",
};

const FINAL_LABEL: Record<string, string> = {
  insufficient_credits: "點數不足",
};

export function isJobInProgress(status: string) {
  return status in IN_PROGRESS;
}

/** Status cell: a progress bar with % while processing, a badge once finished. */
export function JobStatus({ status, progress }: { status: string; progress: number }) {
  const stage = IN_PROGRESS[status];
  if (stage) {
    const pct = Math.max(0, Math.min(99, Math.round(progress)));
    return (
      <div className="w-28 sm:w-36" title={`${stage} ${pct}%`}>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">{stage}</span>
          <span className="font-medium tabular-nums">{pct}%</span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={stage}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
        FINAL_STYLE[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {FINAL_LABEL[status] ?? status}
    </span>
  );
}
