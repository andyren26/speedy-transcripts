import { NextResponse } from "next/server";
import { handleNewebpayCallback } from "@/lib/newebpay";

/**
 * POST /api/credits/newebpay/notify — NewebPay → us (server to server), the
 * source of truth for granting credits. TradeSha is verified before anything
 * is trusted. Excluded from middleware.ts (no user session on this request).
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return new NextResponse("bad request", { status: 400 });

  const outcome = await handleNewebpayCallback(form);
  console.log("newebpay notify", outcome);

  if (outcome.kind === "invalid") return new NextResponse("invalid", { status: 400 });
  // A DB failure returns 500 so NewebPay retries; everything else is final.
  if (outcome.kind === "error" && outcome.detail !== "amount_mismatch" && outcome.detail !== "not_found") {
    return new NextResponse("retry", { status: 500 });
  }
  return new NextResponse("OK", { status: 200 });
}
