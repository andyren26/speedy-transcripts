"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MESSAGE_MAX, SUBJECT_MAX, SUPPORT_CATEGORIES } from "@/lib/support";

/** Support request form: category, subject, description. Posts to /api/support. */
export default function SupportForm({ email }: { email: string }) {
  const router = useRouter();
  const [category, setCategory] = useState<string>("transcription");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentRef, setSentRef] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject: subject.trim(), message: message.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `送出失敗（HTTP ${res.status}）`);
        return;
      }
      setSentRef(body.ref ?? "");
      setSubject("");
      setMessage("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出失敗");
    } finally {
      setBusy(false);
    }
  }

  if (sentRef !== null) {
    return (
      <div className="glass-panel mt-8 rounded-2xl p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="mt-3 font-display text-xl font-semibold">
          已收到你的問題{sentRef && ` #${sentRef}`}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          我們會盡快回信到 <span className="font-medium text-foreground">{email}</span>
          ，也寄了一封確認信給你。
        </p>
        <Button variant="outline" className="mt-5" onClick={() => setSentRef(null)}>
          再送出一個問題
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-panel mt-8 space-y-4 rounded-2xl p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">
        我們會回信到你的帳號信箱 <span className="font-medium text-foreground">{email}</span>。
      </p>

      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <label className="block text-sm">
          問題類別
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-input bg-surface-bright px-3 text-sm"
          >
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          主旨
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={SUBJECT_MAX}
            className="mt-2 h-11 bg-surface-bright"
            placeholder="例如：上傳後一直停在排隊中"
          />
        </label>
      </div>

      <label className="block text-sm">
        問題描述
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={MESSAGE_MAX}
          rows={7}
          className="mt-2 w-full rounded-md border border-input bg-surface-bright px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="請描述發生了什麼、你預期的結果，以及相關的影片名稱或時間，方便我們幫你查。"
        />
        <span className="mt-1 block text-right text-xs text-muted-foreground tabular-nums">
          {message.length} / {MESSAGE_MAX}
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-surface-bright px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button disabled={busy} variant="hero" className="h-11 w-full sm:w-auto sm:px-8">
        {busy ? <Loader2 className="animate-spin" /> : "送出"}
      </Button>
    </form>
  );
}
