import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LANGUAGES = new Set(["zh", "en", "ja"]);

export async function POST(req: Request) {
  // 1. Authenticate the caller via the cookie session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const url = typeof body.video_source_url === "string" ? body.video_source_url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "video_source_url required" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "video_source_url must start with http(s)://" }, { status: 400 });
  }
  const language = LANGUAGES.has(body.language) ? body.language : "zh";
  const topic = typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : null;

  // M2 fast pre-check: block the obvious "no credits at all" case at the form.
  // The precise per-video check (duration vs balance) happens on the worker.
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_balance")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || Number(profile.credits_balance) < 1) {
    return NextResponse.json(
      { error: "點數不足，請先購買點數。", code: "insufficient_credits" },
      { status: 402 },
    );
  }

  // 2. Use the Supabase Secret key to insert the job + session rows.
  // The user has already been authenticated above; the Secret key bypasses RLS
  // so we can insert in one round-trip without policy ping-pong.
  const admin = createAdminClient();

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .insert({ user_id: user.id, video_source_url: url, topic, language, status: "pending" })
    .select()
    .single();
  if (jobErr || !job) {
    return NextResponse.json({ error: jobErr?.message ?? "insert failed" }, { status: 500 });
  }

  const { data: session, error: sessErr } = await admin
    .from("job_sessions")
    .insert({ job_id: job.id, session_number: 1 })
    .select()
    .single();
  if (sessErr || !session) {
    return NextResponse.json({ error: sessErr?.message ?? "insert failed" }, { status: 500 });
  }

  const { error: linkErr } = await admin
    .from("jobs")
    .update({ current_session_id: session.id })
    .eq("id", job.id);
  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  return NextResponse.json({ job_id: job.id });
}
