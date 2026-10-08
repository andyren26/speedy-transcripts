import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MPG_VERSION,
  encryptTradeInfo,
  newOrderNo,
  newebpayConfig,
  tradeSha,
} from "@/lib/newebpay";

/**
 * POST /api/credits/newebpay/checkout  { product_id }
 * Creates a pending NT$ order and returns the encrypted form the browser posts
 * to NewebPay. Credits are NOT granted here — only the verified NotifyURL /
 * ReturnURL callback grants them (see src/lib/newebpay.ts).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const productId = typeof body.product_id === "string" ? body.product_id : "";
  if (!productId) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }

  // RLS only exposes active products to signed-in users.
  const { data: product } = await supabase
    .from("credit_products")
    .select("id, name, credits, price_twd, active")
    .eq("id", productId)
    .maybeSingle();
  const amount = Number(product?.price_twd);
  if (!product || !product.active || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "這個方案目前無法用新台幣購買" }, { status: 400 });
  }

  let cfg: ReturnType<typeof newebpayConfig>;
  try {
    cfg = newebpayConfig();
  } catch (err) {
    console.error("newebpay not configured", err);
    return NextResponse.json({ error: "新台幣付款尚未開放，請稍後再試" }, { status: 503 });
  }

  const origin =
    req.headers.get("origin") ?? process.env["NEXT_PUBLIC_SITE_URL"] ?? new URL(req.url).origin;
  const orderNo = newOrderNo();
  const credits = Number(product.credits);

  const admin = createAdminClient();
  const { error: insertErr } = await admin.from("newebpay_orders").insert({
    merchant_order_no: orderNo,
    user_id: user.id,
    product_id: product.id,
    credits,
    amount_twd: amount,
  });
  if (insertErr) {
    console.error("newebpay order insert failed", insertErr);
    return NextResponse.json({ error: "無法建立訂單，請稍後再試" }, { status: 500 });
  }

  const tradeInfo = encryptTradeInfo(
    {
      MerchantID: cfg.merchantId,
      RespondType: "JSON",
      TimeStamp: Math.floor(Date.now() / 1000),
      Version: MPG_VERSION,
      LangType: "zh-tw",
      MerchantOrderNo: orderNo,
      Amt: amount,
      ItemDesc: `Video Speed Reader ${credits} 點`.slice(0, 50),
      TradeLimit: 900, // seconds the payment page stays valid
      ...(user.email ? { Email: user.email.slice(0, 50) } : {}),
      LoginType: 0,
      ReturnURL: `${origin}/api/credits/newebpay/return`,
      NotifyURL: `${origin}/api/credits/newebpay/notify`,
      ClientBackURL: `${origin}/credits?canceled=1`,
      CREDIT: 1, // credit card, one-time payment
    },
    cfg,
  );

  return NextResponse.json({
    action: cfg.gateway,
    fields: {
      MerchantID: cfg.merchantId,
      TradeInfo: tradeInfo,
      TradeSha: tradeSha(tradeInfo, cfg),
      Version: MPG_VERSION,
    },
  });
}
