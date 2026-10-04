import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/stripe/webhook — Stripe → us, never a browser.
 *
 * Rules (each one has bitten someone):
 * 1. Read the RAW body with req.text(); the signature covers the exact bytes.
 * 2. Verify the signature before doing or acknowledging anything.
 * 3. Use the admin (Secret key) client: there is no user cookie on this request.
 * 4. Idempotency lives in the DB: a unique index on stripe_payment_intent_id
 *    turns a duplicate delivery into error 23505, which we answer with 200.
 * 5. This route must be excluded from middleware.ts (see its matcher).
 */
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("no signature", { status: 400 });

  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new NextResponse("webhook not configured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("webhook signature verification failed", err);
    return new NextResponse("invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, unpaid: true });
  }

  const userId = session.metadata?.["user_id"];
  const productId = session.metadata?.["product_id"];
  const credits = Number(session.metadata?.["credits"]);
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!userId || !productId || !credits || !paymentIntentId) {
    console.error("webhook missing required fields", { userId, productId, credits, paymentIntentId });
    return new NextResponse("missing metadata", { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Ledger row first — the ledger is the source of truth.
  const { error: insertErr } = await admin.from("credit_transactions").insert({
    user_id: userId,
    amount: credits,
    type: "purchase",
    description: `Purchased ${credits} credits`,
    stripe_payment_intent_id: paymentIntentId,
  });
  if (insertErr) {
    if (insertErr.code === "23505") {
      // Already processed this payment — idempotency working. 200 stops retries.
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("credit_transactions insert failed", insertErr);
    return new NextResponse("db insert failed", { status: 500 });
  }

  // 2. Derived balance. If this fails the ledger still has the purchase; the
  //    balance can be rebuilt with SUM(amount) per user.
  const { data: profile, error: readErr } = await admin
    .from("profiles")
    .select("credits_balance")
    .eq("id", userId)
    .single();
  if (readErr) {
    console.error("profile read failed", readErr);
    return new NextResponse("balance read failed", { status: 500 });
  }
  const newBalance = Number(profile.credits_balance ?? 0) + credits;
  const { error: updateErr } = await admin
    .from("profiles")
    .update({ credits_balance: newBalance })
    .eq("id", userId);
  if (updateErr) {
    console.error("balance update failed", updateErr);
    return new NextResponse("balance update failed", { status: 500 });
  }

  return NextResponse.json({ received: true, credited: credits });
}
