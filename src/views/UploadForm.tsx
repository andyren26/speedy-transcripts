"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LANGUAGES = [
  { value: "zh", label: "中文 (zh)" },
  { value: "en", label: "English (en)" },
  { value: "ja", label: "日本語 (ja)" },
];

/** Submits a video URL to POST /api/jobs, then refreshes the server-rendered job list. */
export default function UploadForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("zh");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needCredits, setNeedCredits] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNeedCredits(false);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_source_url: url.trim(),
          topic: topic.trim() || null,
          language,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setNeedCredits(res.status === 402);
        setError(body.error ?? `送出失敗（HTTP ${res.status}）`);
        return;
      }
      setUrl("");
      setTopic("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass-panel mt-8 space-y-4 rounded-2xl p-6 sm:p-8">
      <div>
        <h2 className="font-display text-xl font-semibold">送出新影片</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          貼上影片或音檔的直接連結。M1 還不支援 YouTube（從雲端主機下載會被擋）。
        </p>
      </div>

      <label className="block text-sm">
        影片網址 Video URL
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="mt-2 h-11 bg-surface-bright"
          placeholder="Direct mp4 / mp3 URL (e.g. CloudFront, Vimeo, Internet Archive)"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <label className="block text-sm">
          主題 Topic（選填）
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-2 h-11 bg-surface-bright"
            placeholder="e.g. Tech podcast — useful context for the model"
          />
        </label>
        <label className="block text-sm">
          語言 Language
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-input bg-surface-bright px-3 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-surface-bright px-3 py-2 text-sm text-destructive">
          {error}
          {needCredits && (
            <>
              {" "}
              <Link href="/credits" className="font-medium text-primary underline">
                前往購買點數
              </Link>
            </>
          )}
        </p>
      )}

      <Button disabled={busy} variant="hero" className="h-11 w-full sm:w-auto sm:px-8">
        {busy ? <Loader2 className="animate-spin" /> : "Transcribe 開始轉錄"}
      </Button>
    </form>
  );
}
