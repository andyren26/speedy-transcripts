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
 * webhook / 藍新 NotifyURL are the source of truth. It just shows whether the
 * credit has landed yet and refreshes until it does.
 *   Stripe: /credits/success?session_id=…   藍新: /credits/success?order=…
 */
export default async function CreditsSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; order?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { session_id: sessionId, order: orderNo } = await searchParams;
  if (orderNo) return <NewebpayResult orderNo={orderNo} userId={user.id} />;
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

/** 藍新 order status for the signed-in user (RLS: own orders only). */
async function NewebpayResult({ orderNo, userId }: { orderNo: string; userId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: order } = await supabase
    .from("newebpay_orders")
    .select("status, credits, amount_twd")
    .eq("merchant_order_no", orderNo)
    .eq("user_id", userId)
    .maybeSingle();
  if (!order || !user) redirect("/credits");
  const credits = Number(order.credits) || null;

  if (order.status === "failed") redirect("/credits?payment=failed");

  return (
    <main className="min-h-screen bg-background">
      <AppHeader user={user} />
      <section className="mx-auto max-w-xl p-5 text-center sm:p-10">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h1 className="mt-4 font-display text-3xl font-semibold">付款成功</h1>
        {order.status === "paid" ? (
          <p className="mt-3 text-muted-foreground">
            已付款 NT${Number(order.amount_twd).toLocaleString()}，{credits ? `${credits} 點` : "點數"}
            已加入你的帳戶。
          </p>
        ) : (
          <AwaitCredit credits={credits} />
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
