import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import AwaitCredit from "@/views/AwaitCredit";

export const metadata = {
  title: "付款成功 — Video Speed Reader",
};

/**
 * Post-checkout landing page. UX only: it NEVER grants credits — the Stripe
 * webhook is the single source of truth. It just shows whether the webhook has
 * landed yet and refreshes until it does.
 */
export default async function CreditsSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/credits");

  // Look up the Checkout Session so we can show what was bought, and only for
  // the signed-in user's own session.
  let credits: number | null = null;
  let paymentIntentId: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id === user.id) {
      credits = Number(session.metadata?.["credits"]) || null;
      paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
    }
  } catch (err) {
    console.error("success page: checkout session lookup failed", err);
  }

  let credited = false;
  if (paymentIntentId) {
    const { data } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .limit(1);
    credited = (data?.length ?? 0) > 0;
  }

  return (
    <main className="min-h-screen bg-background">
      <AppHeader user={user} />

      <section className="mx-auto max-w-xl p-5 text-center sm:p-10">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h1 className="mt-4 font-display text-3xl font-semibold">付款成功</h1>

        {credited ? (
          <p className="mt-3 text-muted-foreground">
            {credits ? `${credits} 點` : "點數"}已加入你的帳戶。
          </p>
        ) : paymentIntentId ? (
          <AwaitCredit credits={credits} />
        ) : (
          <p className="mt-3 text-muted-foreground">
            點數通常會在幾秒內入帳，請到點數頁查看最新餘額。
          </p>
        )}

        <div className="mt-8 flex justify-center gap-3">
          <Button asChild variant="hero">
            <Link href="/upload">上傳影片</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/credits">查看點數</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
