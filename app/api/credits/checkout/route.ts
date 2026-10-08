import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, stripeCheckoutEnabled } from "@/lib/stripe";

/**
 * POST /api/credits/checkout  { product_id }
 * Creates a Stripe Checkout Session for one credit pack and returns its URL.
 * Credits are NOT granted here — only the Stripe webhook grants credits.
 */
export async function POST(req: Request) {
  // 0. US$ checkout is switched off until Stripe goes live (button hidden too).
  if (!stripeCheckoutEnabled()) {
    return NextResponse.json({ error: "海外付款暫不開放" }, { status: 403 });
  }

  // 1. Require a signed-in user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  // 2. Validate the body.
  const body = await req.json().catch(() => ({}));
  const productId = typeof body.product_id === "string" ? body.product_id : "";
  if (!productId) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }

  // 3. Look up the pack (RLS only exposes active products to signed-in users).
  const { data: product } = await supabase
    .from("credit_products")
    .select("id, credits, stripe_price_id, active")
    .eq("id", productId)
    .maybeSingle();
  if (!product || !product.active || !product.stripe_price_id) {
    return NextResponse.json({ error: "找不到這個方案" }, { status: 400 });
  }

  // 4. Build return URLs from the request origin, so the same code works on the
  //    Vercel URL today and a custom domain later.
  const origin =
    req.headers.get("origin") ?? process.env["NEXT_PUBLIC_SITE_URL"] ?? new URL(req.url).origin;

  // 5. Create the Checkout Session. Metadata values are always strings in Stripe.
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      // This Stripe account has Managed Payments on by default, which rejects
      // payment_method_types and requires a tax code on every product. M2 uses
      // plain Checkout, so turn it off per session.
      managed_payments: { enabled: false },
      payment_method_types: ["card"],
      line_items: [{ price: product.stripe_price_id, quantity: 1 }],
      success_url: `${origin}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/credits?canceled=1`,
      client_reference_id: user.id,
      ...(user.email ? { customer_email: user.email } : {}),
      metadata: {
        user_id: user.id,
        product_id: product.id,
        credits: String(product.credits),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe 沒有回傳付款網址" }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe checkout session create failed", err);
    return NextResponse.json({ error: "無法建立付款頁面，請稍後再試" }, { status: 502 });
  }
}
