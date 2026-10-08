import { NextResponse } from "next/server";
import { handleNewebpayCallback } from "@/lib/newebpay";

/**
 * POST /api/credits/newebpay/return — the shopper's browser, posted here by
 * NewebPay after the payment page. It's a cross-site POST, so the session
 * cookie (SameSite=Lax) isn't sent: we don't need it. We verify + process the
 * payload (idempotent fallback in case NotifyURL is late), then 303-redirect to
 * a normal GET page where the cookie is sent again.
 */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.redirect(new URL("/credits", origin), 303);

  const outcome = await handleNewebpayCallback(form);
  console.log("newebpay return", outcome);

  if (outcome.kind === "paid" || outcome.kind === "already_paid") {
    return NextResponse.redirect(new URL(`/credits/success?order=${outcome.orderNo}`, origin), 303);
  }
  if (outcome.kind === "error") {
    // paid at NewebPay but we couldn't record it yet: the success page polls,
    // and NotifyURL will retry the grant
    return NextResponse.redirect(new URL(`/credits/success?order=${outcome.orderNo}`, origin), 303);
  }
  if (outcome.kind === "failed") {
    const url = new URL("/credits", origin);
    url.searchParams.set("payment", "failed");
    url.searchParams.set("reason", outcome.message.slice(0, 80));
    return NextResponse.redirect(url, 303);
  }
  return NextResponse.redirect(new URL("/credits", origin), 303);
}

export function GET(req: Request) {
  return NextResponse.redirect(new URL("/credits", new URL(req.url).origin), 303);
}
