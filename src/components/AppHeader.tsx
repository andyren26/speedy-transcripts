import Link from "next/link";
import { Coins, Inbox, LifeBuoy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * Shared header for signed-in pages. Server component: reads the user's credit
 * balance on every server render, so the badge is fresh after each navigation.
 */
export async function AppHeader({ user }: { user: { id: string; email?: string | null } }) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_balance, role")
    .eq("id", user.id)
    .maybeSingle();
  const balance = Number(profile?.credits_balance ?? 0);
  const isAdmin = profile?.role === "admin";

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
      <Link href="/app" className="flex items-center gap-2.5">
        <span className="brand-gradient grid size-9 place-items-center rounded-lg font-display text-sm font-bold text-primary-foreground">
          V
        </span>
        <span className="hidden font-display font-semibold sm:inline">Video Speed Reader</span>
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/upload"
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-surface-bright hover:text-foreground"
        >
          上傳影片
        </Link>
        <Link
          href={isAdmin ? "/admin/support" : "/support"}
          title={isAdmin ? "客服後台" : "聯絡客服"}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-surface-bright hover:text-foreground sm:px-3"
        >
          {isAdmin ? <Inbox className="size-4" /> : <LifeBuoy className="size-4" />}
          <span className="hidden sm:inline">{isAdmin ? "客服後台" : "聯絡客服"}</span>
        </Link>
        <Link
          href="/credits"
          title="查看點數與購買"
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-surface-bright ${
            balance < 1 ? "border-destructive/40 text-destructive" : "border-border"
          }`}
        >
          <Coins className="size-4" />
          <span className="tabular-nums">{balance.toLocaleString()}</span>
          <span className="text-muted-foreground">點</span>
          <span className="hidden text-primary sm:inline">· 購買</span>
        </Link>
        <span className="hidden max-w-56 truncate text-sm text-muted-foreground lg:block">
          {user.email}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
