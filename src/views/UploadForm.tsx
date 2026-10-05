"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileVideo, Link2, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_UPLOAD_BYTES, formatBytes, isMediaFile } from "@/lib/upload-limits";

const LANGUAGES = [
  { value: "zh", label: "中文 (zh)" },
  { value: "en", label: "English (en)" },
  { value: "ja", label: "日本語 (ja)" },
];

type Mode = "file" | "url";

/** Read a media file's length in the browser (null if the browser can't decode it). */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    const src = URL.createObjectURL(file);
    let settled = false;
    const done = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(src);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 8000);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      clearTimeout(timer);
      done(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null);
    };
    el.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    el.src = src;
  });
}

/** PUT the file straight to S3 with upload progress (fetch can't report upload progress). */
function putToS3(url: string, file: File, contentType: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`上傳失敗（HTTP ${xhr.status}）`));
    xhr.onerror = () => reject(new Error("上傳失敗，請檢查網路連線後再試一次。"));
    xhr.send(file);
  });
}

async function readError(res: Response) {
  const body = await res.json().catch(() => ({}));
  return {
    message: (body.error as string) ?? `送出失敗（HTTP ${res.status}）`,
    needCredits: res.status === 402,
  };
}

/** Upload a video/audio file (default) or submit a direct link, then refresh the job list. */
export default function UploadForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("zh");
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [needCredits, setNeedCredits] = useState(false);

  function fail(message: string, credits = false) {
    setError(message);
    setNeedCredits(credits);
  }

  function pickFile(f: File | undefined | null) {
    setError("");
    setNeedCredits(false);
    if (!f) return;
    if (!isMediaFile(f.name, f.type)) {
      fail("只支援影片或音檔（例如 mp4、mov、mp3、m4a、wav）。");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      fail(`檔案太大（${formatBytes(f.size)}），單一檔案上限是 ${formatBytes(MAX_UPLOAD_BYTES)}。`);
      return;
    }
    setFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  async function createJob(payload: Record<string, unknown>) {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, topic: topic.trim() || null, language }),
    });
    if (!res.ok) {
      const { message, needCredits: credits } = await readError(res);
      fail(message, credits);
      return false;
    }
    return true;
  }

  async function submitFile() {
    if (!file) {
      fail("請先選擇要上傳的檔案。");
      return false;
    }
    const contentType = file.type || "application/octet-stream";
    const durationSeconds = await readDuration(file);

    // 1. Ask the server for a presigned upload URL (also checks size and credits).
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, size: file.size, contentType, durationSeconds }),
    });
    if (!res.ok) {
      const { message, needCredits: credits } = await readError(res);
      fail(message, credits);
      return false;
    }
    const { key, uploadUrl } = (await res.json()) as { key: string; uploadUrl: string };

    // 2. Upload straight to S3, then 3. create the transcription job for that file.
    setUploadPct(0);
    await putToS3(uploadUrl, file, contentType, setUploadPct);
    return createJob({ upload_key: key });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNeedCredits(false);
    try {
      const ok =
        mode === "file" ? await submitFile() : await createJob({ video_source_url: url.trim() });
      if (!ok) return;
      setFile(null);
      setUrl("");
      setTopic("");
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch (err) {
      fail(err instanceof Error ? err.message : "送出失敗");
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  }

  const tab = (value: Mode, label: string, Icon: typeof Link2) => (
    <button
      type="button"
      onClick={() => {
        setMode(value);
        setError("");
        setNeedCredits(false);
      }}
      disabled={busy}
      aria-pressed={mode === value}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        mode === value
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="glass-panel mt-8 space-y-4 rounded-2xl p-6 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">送出新影片</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            上傳影片或音檔，或貼上直接下載連結。目前不支援 YouTube 網址。
          </p>
        </div>
        <div className="inline-flex shrink-0 self-start rounded-lg bg-muted p-1">
          {tab("file", "上傳檔案", UploadCloud)}
          {tab("url", "貼上網址", Link2)}
        </div>
      </div>

      {mode === "file" ? (
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="video/*,audio/*"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-bright p-4">
              <FileVideo className="size-8 shrink-0 text-secondary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                {uploadPct !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">上傳中</span>
                      <span className="font-medium tabular-nums">{Math.floor(uploadPct)}%</span>
                    </div>
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.floor(uploadPct)}
                      aria-label="上傳進度"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${Math.max(uploadPct, 2)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              {!busy && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="移除檔案"
                  onClick={() => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  <X />
                </Button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface-bright hover:border-primary/50"
              }`}
            >
              <UploadCloud className="size-8 text-secondary" />
              <span className="text-sm font-medium">把影片或音檔拖到這裡，或點擊選擇檔案</span>
              <span className="text-xs text-muted-foreground">
                mp4、mov、mkv、mp3、m4a、wav 等格式，單一檔案上限 {formatBytes(MAX_UPLOAD_BYTES)}
              </span>
            </button>
          )}
        </div>
      ) : (
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
      )}

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

      <Button
        disabled={busy || (mode === "file" && !file)}
        variant="hero"
        className="h-11 w-full sm:w-auto sm:px-8"
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin" />
            {uploadPct !== null ? "上傳中…" : "處理中…"}
          </>
        ) : (
          "Transcribe 開始轉錄"
        )}
      </Button>
    </form>
  );
}
