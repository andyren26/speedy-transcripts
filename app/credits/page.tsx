import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import Credits from "@/views/Credits";

export const metadata = {
  title: "點數 — Video Speed Reader",
  description: "查看點數餘額、購買點數與點數紀錄。",
};

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { canceled } = await searchParams;

  // RLS limits every query to the signed-in user's own rows (or active products).
  const [{ data: profile }, { data: products }, { data: transactions }] = await Promise.all([
    supabase.from("profiles").select("credits_balance").eq("id", user.id).maybeSingle(),
    supabase
      .from("credit_products")
      .select("id, name, credits, price_usd")
      .eq("active", true)
      .order("price_usd"),
    supabase
      .from("credit_transactions")
      .select("id, amount, type, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
        <Link href="/app" className="flex items-center gap-2.5">
          <span className="brand-gradient grid size-9 place-items-center rounded-lg font-display text-sm font-bold text-primary-foreground">
            V
          </span>
          <span className="font-display font-semibold">Video Speed Reader</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/upload"
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-surface-bright hover:text-foreground"
          >
            上傳影片
          </Link>
          <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:block">
            {user.email}
          </span>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-5xl p-5 sm:p-8 lg:p-10">
        <p className="text-sm text-secondary">Credits</p>
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">點數</h1>

        <Credits
          balance={Number(profile?.credits_balance ?? 0)}
          products={(products ?? []).map((p) => ({
            ...p,
            credits: Number(p.credits),
            price_usd: Number(p.price_usd),
          }))}
          transactions={transactions ?? []}
          canceled={canceled === "1"}
        />
      </section>
    </main>
  );
}
