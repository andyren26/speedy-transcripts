import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import SupportForm from "@/views/SupportForm";
import { categoryLabel } from "@/lib/support";

export const metadata = {
  title: "聯絡客服 — Video Speed Reader",
  description: "遇到問題嗎？告訴我們，我們會以 Email 回覆你。",
};

// Contact support. Members only: the reply goes to the account's email address.
export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS ("users read own support tickets") limits this to the member's own requests.
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, category, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="min-h-screen bg-background">
      <AppHeader user={user} />
      <section className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10">
        <p className="text-sm text-secondary">Contact support</p>
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">聯絡客服</h1>
        <p className="mt-2 text-muted-foreground">
          遇到問題或有建議嗎？填寫下面的表單，我們會盡快以 Email 回覆你。
        </p>

        <SupportForm email={user.email ?? ""} />

        {tickets && tickets.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-lg font-semibold">你最近送出的問題</h2>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/50">
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      #{t.id.slice(0, 8).toUpperCase()} · {categoryLabel(t.category)} ·{" "}
                      {formatDistanceToNow(new Date(t.created_at), {
                        addSuffix: true,
                        locale: zhTW,
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      t.status === "closed"
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.status === "closed" ? "已處理" : "處理中"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
