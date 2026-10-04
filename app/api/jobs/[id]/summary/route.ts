import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Summarizing a long transcript can take a while; give the function headroom.
export const maxDuration = 60;

const DEFAULT_MODEL = "gpt-5-mini";
// Keep requests well inside the model's context window. ~200k characters is
// several hours of speech; longer transcripts are summarized from the start.
const MAX_TRANSCRIPT_CHARS = 200_000;

const LANGUAGE_NAME: Record<string, string> = {
  zh: "繁體中文（台灣用語）",
  en: "English",
  ja: "日本語",
};

type Owned = { sessionId: string; language: string };

/** Auth + ownership: returns the job's session if it belongs to the caller and is done. */
async function loadOwnedJob(id: string): Promise<{ owned?: Owned; error?: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "請先登入" }, { status: 401 }) };

  // Secret-key client bypasses RLS, so ownership is re-imposed with user_id.
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("id, status, language, current_session_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) return { error: NextResponse.json({ error: "找不到這個工作" }, { status: 404 }) };
  if (job.status !== "done" || !job.current_session_id) {
    return { error: NextResponse.json({ error: "逐字稿還沒完成" }, { status: 409 }) };
  }
  return { owned: { sessionId: job.current_session_id, language: job.language } };
}

/** GET: return the cached summary, if any. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { owned, error } = await loadOwnedJob(id);
  if (error) return error;

  const { data: session } = await createAdminClient()
    .from("job_sessions")
    .select("summary_content")
    .eq("id", owned!.sessionId)
    .single();
  return NextResponse.json({ summary: session?.summary_content ?? null });
}

/** POST: generate the summary once with OpenAI, cache it, and return it. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { owned, error } = await loadOwnedJob(id);
  if (error) return error;

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("job_sessions")
    .select("subtitle_txt_content, summary_content")
    .eq("id", owned!.sessionId)
    .single();

  // Already summarized: never pay for the same summary twice.
  if (session?.summary_content) {
    return NextResponse.json({ summary: session.summary_content, cached: true });
  }

  const transcript = session?.subtitle_txt_content?.trim();
  if (!transcript) {
    return NextResponse.json({ error: "找不到逐字稿內容" }, { status: 500 });
  }

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set");
    return NextResponse.json({ error: "摘要功能尚未設定" }, { status: 503 });
  }

  const truncated = transcript.length > MAX_TRANSCRIPT_CHARS;
  const input = truncated ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) : transcript;
  const outLang = LANGUAGE_NAME[owned!.language] ?? "the same language as the transcript";

  const systemPrompt = [
    "You summarize video transcripts so a busy reader can grasp the video in under a minute.",
    `Write the summary in ${outLang}.`,
    "Format, in plain text (no Markdown headings, no tables):",
    "1. One short paragraph (2–3 sentences) saying what the video is about.",
    "2. A blank line, then 3–6 key points, each on its own line starting with \"• \".",
    "Only use information that appears in the transcript. The transcript comes from speech",
    "recognition and may contain recognition errors; infer the intended words sensibly.",
    truncated ? "The transcript was cut off for length; summarize the part provided." : "",
  ]
    .filter(Boolean)
    .join("\n");

  let summary: string | undefined;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env["OPENAI_SUMMARY_MODEL"] || DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcript:\n\n${input}` },
        ],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("openai summary failed", res.status, body?.error);
      const status = res.status === 429 ? 429 : 502;
      return NextResponse.json(
        { error: status === 429 ? "摘要服務忙碌中，請稍後再試" : "無法產生摘要，請稍後再試" },
        { status },
      );
    }
    summary = body?.choices?.[0]?.message?.content?.trim();
  } catch (err) {
    console.error("openai summary request error", err);
    return NextResponse.json({ error: "無法連線到摘要服務，請稍後再試" }, { status: 502 });
  }

  if (!summary) {
    return NextResponse.json({ error: "摘要是空的，請再試一次" }, { status: 502 });
  }

  const { error: saveErr } = await admin
    .from("job_sessions")
    .update({ summary_content: summary, summary_created_at: new Date().toISOString() })
    .eq("id", owned!.sessionId);
  if (saveErr) {
    // Still return the summary; it just won't be cached this time.
    console.error("summary save failed", saveErr);
  }

  return NextResponse.json({ summary, cached: false });
}
