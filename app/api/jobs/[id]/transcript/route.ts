import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseSegments,
  toMarkdown,
  toSrt,
  toTimestampedTxt,
  toVtt,
} from "@/lib/transcript-format";
import { toDocx, toPdf } from "@/lib/transcript-export";

const FORMATS = ["txt", "srt", "vtt", "md", "docx", "pdf"] as const;
type Format = (typeof FORMATS)[number];

const CONTENT_TYPES: Record<Format, string> = {
  txt: "text/plain; charset=utf-8",
  srt: "application/x-subrip; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/**
 * GET /api/jobs/:id/transcript            → .txt, one line per sentence with [HH:MM:SS]
 * GET /api/jobs/:id/transcript?format=srt → .srt subtitle file
 * GET /api/jobs/:id/transcript?format=vtt → .vtt (WebVTT) subtitle file
 * GET /api/jobs/:id/transcript?format=md  → Markdown with **[mm:ss]** per sentence
 * GET /api/jobs/:id/transcript?format=docx → Word document
 * GET /api/jobs/:id/transcript?format=pdf  → PDF
 *
 * Jobs transcribed before timestamps existed (no segments) download as the plain
 * text they always had; every other format isn't available for them (404).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requested = new URL(req.url).searchParams.get("format");
  const format: Format = FORMATS.includes(requested as Format) ? (requested as Format) : "txt";

  // 1. Auth — same pattern as POST /api/jobs.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Look up the job + verify ownership in one query.
  //    The Secret-key client bypasses RLS; we re-impose ownership via the WHERE,
  //    so nobody can download someone else's transcript by guessing a UUID.
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("id, user_id, status, current_session_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (job.status !== "done" || !job.current_session_id) {
    return NextResponse.json({ error: "not ready" }, { status: 409 });
  }

  // 3. Pull the transcript (and its timestamps, if any) from the current session.
  const { data: session } = await admin
    .from("job_sessions")
    .select("subtitle_txt_content, segments")
    .eq("id", job.current_session_id)
    .single();
  const segments = parseSegments(session?.segments);
  const plain = session?.subtitle_txt_content;

  let body: string | Uint8Array;
  if (format === "txt") {
    if (segments) body = toTimestampedTxt(segments);
    else if (plain) body = plain;
    else return NextResponse.json({ error: "transcript missing" }, { status: 500 });
  } else {
    if (!segments) {
      return NextResponse.json(
        { error: `這支影片是在支援時間標記之前轉錄的，沒有 .${format} 檔。` },
        { status: 404 },
      );
    }
    if (format === "srt") body = toSrt(segments);
    else if (format === "vtt") body = toVtt(segments);
    else if (format === "md") body = toMarkdown(segments);
    else if (format === "docx") body = await toDocx(segments);
    else body = await toPdf(segments);
  }

  // 4. Stream it back as a file download.
  const filename = `transcript-${id.slice(0, 8)}.${format}`;
  return new NextResponse(body as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
