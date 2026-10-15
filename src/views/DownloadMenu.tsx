"use client";

import { ChevronDown, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FORMATS = [
  { ext: "txt", label: "文字檔 .txt", hint: "每句附時間標記" },
  { ext: "srt", label: "字幕檔 .srt", hint: "可直接掛到影片上", needsTimestamps: true },
  { ext: "vtt", label: "網頁字幕 .vtt", hint: "HTML5 播放器用", needsTimestamps: true },
  { ext: "md", label: "Markdown .md", hint: "筆記軟體用", needsTimestamps: true },
  { ext: "docx", label: "Word .docx", hint: "可編輯文件", needsTimestamps: true },
  { ext: "pdf", label: "PDF .pdf", hint: "方便分享與列印", needsTimestamps: true },
] as const;

/** Download dropdown for one finished job. Old jobs without timestamps only get .txt. */
export default function DownloadMenu({
  jobId,
  hasTimestamps,
}: {
  jobId: string;
  hasTimestamps: boolean;
}) {
  const items = FORMATS.filter((f) => hasTimestamps || !("needsTimestamps" in f));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline focus-visible:outline-none">
        <Download className="size-4" />
        下載
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((f) => (
          <DropdownMenuItem key={f.ext} asChild>
            <a
              href={`/api/jobs/${jobId}/transcript?format=${f.ext}`}
              download={`transcript-${jobId.slice(0, 8)}.${f.ext}`}
              className="flex cursor-pointer flex-col items-start gap-0"
            >
              <span>{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.hint}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
