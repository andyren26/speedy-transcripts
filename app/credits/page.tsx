import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import Credits from "@/views/Credits";
import { stripeCheckoutEnabled } from "@/lib/stripe";

export const metadata = {
  title: "點數 — Video Speed Reader",
  description: "查看點數餘額、購買點數與點數紀錄。",
};

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; payment?: string; reason?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { canceled, payment, reason } = await searchParams;

  // RLS limits every query to the signed-in user's own rows (or active products).
  const [{ data: profile }, { data: products }, { data: transactions }] = await Promise.all([
    supabase.from("profiles").select("credits_balance").eq("id", user.id).maybeSingle(),
    supabase
      .from("credit_products")
      .select("id, name, credits, price_usd, price_twd")
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
      <AppHeader user={user} />

      <section className="mx-auto max-w-5xl p-5 sm:p-8 lg:p-10">
        <p className="text-sm text-secondary">Credits</p>
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">點數</h1>

        <Credits
          balance={Number(profile?.credits_balance ?? 0)}
          products={(products ?? []).map((p) => ({
            ...p,
            credits: Number(p.credits),
            price_usd: Number(p.price_usd),
            price_twd: p.price_twd === null ? null : Number(p.price_twd),
          }))}
          transactions={transactions ?? []}
          canceled={canceled === "1"}
          failedReason={payment === "failed" ? (reason ?? "").slice(0, 80) : null}
          overseasEnabled={stripeCheckoutEnabled()}
        />
      </section>
    </main>
  );
}
