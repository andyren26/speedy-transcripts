import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MESSAGE_MAX, SUBJECT_MAX, SUPPORT_CATEGORIES, categoryLabel } from "@/lib/support";

/**
 * POST /api/support — a signed-in member submits a support request.
 * Saves it to support_tickets, emails the owner (Reply-To = the member, so replying
 * from Gmail goes straight to them) and sends the member a receipt.
 *
 * Env: RESEND_API_KEY (required for email), SUPPORT_INBOX (where notifications go),
 * SUPPORT_FROM (sender on the verified Resend domain mail.valuetrack66.com).
 */

const DEFAULT_FROM = "Video Speed Reader 客服 <support@mail.valuetrack66.com>";
const RATE_LIMIT = { max: 5, minutes: 10 };

async function sendEmail(email: { to: string; subject: string; text: string; replyTo?: string }) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.warn("[support] RESEND_API_KEY is not set — email skipped");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env["SUPPORT_FROM"] || DEFAULT_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    console.error("[support] Resend error", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const category = SUPPORT_CATEGORIES.some((c) => c.value === body.category)
    ? (body.category as string)
    : "other";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!subject || !message) {
    return NextResponse.json({ error: "請填寫主旨和問題描述。" }, { status: 400 });
  }
  if (subject.length > SUBJECT_MAX || message.length > MESSAGE_MAX) {
    return NextResponse.json(
      { error: `主旨最多 ${SUBJECT_MAX} 字，描述最多 ${MESSAGE_MAX} 字。` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Simple abuse guard: at most 5 requests per member per 10 minutes.
  const since = new Date(Date.now() - RATE_LIMIT.minutes * 60_000).toISOString();
  const { count } = await admin
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT.max) {
    return NextResponse.json({ error: "送出太頻繁了，請稍等幾分鐘再試。" }, { status: 429 });
  }

  const { data: ticket, error } = await admin
    .from("support_tickets")
    .insert({ user_id: user.id, email: user.email, category, subject, message })
    .select("id, created_at")
    .single();
  if (error || !ticket) {
    console.error("[support] insert failed", error);
    return NextResponse.json({ error: "目前無法送出，請稍後再試。" }, { status: 500 });
  }

  const ref = ticket.id.slice(0, 8).toUpperCase();
  const label = categoryLabel(category);
  const inbox = process.env["SUPPORT_INBOX"];

  await Promise.all([
    inbox
      ? sendEmail({
          to: inbox,
          replyTo: user.email,
          subject: `[客服 #${ref}][${label}] ${subject}`,
          text: [
            `會員：${user.email}`,
            `類別：${label}`,
            `工單：#${ref}（${ticket.id}）`,
            `時間：${new Date(ticket.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
            "",
            message,
            "",
            "— 直接回覆這封信即可回信給會員。",
          ].join("\n"),
        })
      : Promise.resolve(false),
    sendEmail({
      to: user.email,
      subject: `我們已收到你的問題 #${ref}：${subject}`,
      text: [
        "你好，",
        "",
        "我們已經收到你的客服需求，會盡快以 Email 回覆你。",
        "",
        `工單編號：#${ref}`,
        `類別：${label}`,
        `主旨：${subject}`,
        "",
        "你的描述：",
        message,
        "",
        "Video Speed Reader 客服",
      ].join("\n"),
    }),
  ]);

  return NextResponse.json({ ok: true, ref });
}
