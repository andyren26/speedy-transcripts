import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Mail } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/admin-auth";
import { categoryLabel } from "@/lib/support";
import TicketStatusButton from "@/views/TicketStatusButton";

export const metadata = {
  title: "客服後台 — Video Speed Reader",
  robots: { index: false, follow: false },
};

const TABS = [
  { value: "open", label: "處理中" },
  { value: "closed", label: "已處理" },
  { value: "all", label: "全部" },
] as const;

type Tab = (typeof TABS)[number]["value"];

// Admin-only support inbox. Non-admins get a 404 so the page's existence isn't revealed.
export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { user, isAdmin } = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!isAdmin) notFound();

  const { status } = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === status) ? (status as Tab) : "open";

  // Secret-key client: admins see every member's tickets (RLS would limit to their own).
  const admin = createAdminClient();
  let query = admin
    .from("support_tickets")
    .select("id, email, category, subject, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (tab !== "all") query = query.eq("status", tab);

  const [{ data: tickets, error }, { count: openCount }] = await Promise.all([
    query,
    admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <AppHeader user={user} />
      <section className="mx-auto max-w-5xl p-5 sm:p-8 lg:p-10">
        <p className="text-sm text-secondary">Admin</p>
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">客服後台</h1>
        <p className="mt-2 text-muted-foreground">
          回信請從 Gmail 回覆通知信（寄件人選
          support@mail.valuetrack66.com），回完再回到這裡標記為已處理。
        </p>

        <nav className="mt-6 inline-flex rounded-lg bg-muted p-1" aria-label="工單狀態">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={`/admin/support?status=${t.value}`}
              aria-current={tab === t.value ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.value === "open" && (openCount ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground tabular-nums">
                  {openCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-6 space-y-3">
          {error ? (
            <p className="rounded-xl border border-border bg-card/50 p-6 text-sm text-destructive">
              無法讀取工單：{error.message}
            </p>
          ) : !tickets || tickets.length === 0 ? (
            <p className="rounded-xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              {tab === "open" ? "沒有待處理的問題 🎉" : "目前沒有工單。"}
            </p>
          ) : (
            tickets.map((t) => {
              const ref = t.id.slice(0, 8).toUpperCase();
              const replySubject = encodeURIComponent(`Re: [客服 #${ref}] ${t.subject}`);
              return (
                <article
                  key={t.id}
                  className="rounded-xl border border-border bg-card/50 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            t.status === "closed"
                              ? "bg-success/15 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.status === "closed" ? "已處理" : "處理中"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          #{ref} · {categoryLabel(t.category)} ·{" "}
                          {formatDistanceToNow(new Date(t.created_at), {
                            addSuffix: true,
                            locale: zhTW,
                          })}
                        </span>
                      </div>
                      <h2 className="mt-2 font-medium">{t.subject}</h2>
                      <a
                        href={`mailto:${t.email}?subject=${replySubject}`}
                        className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Mail className="size-3.5" />
                        {t.email}
                      </a>
                    </div>
                    <TicketStatusButton id={t.id} status={t.status} />
                  </div>
                  <details className="mt-3 group">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      問題描述
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-bright p-3 text-sm">
                      {t.message}
                    </p>
                  </details>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
