"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Admin toggle: mark a support ticket 已處理 (closed) or reopen it. */
export default function TicketStatusButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const closed = status === "closed";

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: closed ? "open" : "closed" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={closed ? "outline" : "hero"}
        disabled={busy}
        onClick={toggle}
      >
        {busy ? <Loader2 className="animate-spin" /> : closed ? <RotateCcw /> : <CheckCircle2 />}
        {closed ? "重新開啟" : "標記為已處理"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
