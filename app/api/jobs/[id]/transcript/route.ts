import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSegments, toSrt, toTimestampedTxt } from "@/lib/transcript-format";

/**
 * GET /api/jobs/:id/transcript            → .txt, one line per sentence with [HH:MM:SS]
 * GET /api/jobs/:id/transcript?format=srt → .srt subtitle file
 *
 * Jobs transcribed before timestamps existed (no segments) download as the plain
 * text they always had; .srt isn't available for them (404).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "srt" ? "srt" : "txt";

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

  let body: string;
  if (format === "srt") {
    if (!segments) {
      return NextResponse.json(
        { error: "這支影片是在支援時間標記之前轉錄的，沒有 .srt 字幕檔。" },
        { status: 404 },
      );
    }
    body = toSrt(segments);
  } else if (segments) {
    body = toTimestampedTxt(segments);
  } else if (plain) {
    body = plain;
  } else {
    return NextResponse.json({ error: "transcript missing" }, { status: 500 });
  }

  // 4. Stream it back as a file download.
  const filename = `transcript-${id.slice(0, 8)}.${format}`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":
        format === "srt" ? "application/x-subrip; charset=utf-8" : "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
