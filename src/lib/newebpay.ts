import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 藍新金流 NewebPay MPG (幕前支付) — server-only helpers.
 *
 * Protocol (MPG Version 2.0):
 *   TradeInfo = hex( AES-256-CBC( URL-encoded params, key=HashKey, iv=HashIV, PKCS7 ) )
 *   TradeSha  = UPPER( SHA256( "HashKey=<key>&<TradeInfo>&HashIV=<iv>" ) )
 * The browser POSTs MerchantID / TradeInfo / TradeSha / Version to the gateway.
 * NewebPay answers with the same envelope on NotifyURL (server → server) and
 * ReturnURL (browser POST); we verify TradeSha before trusting anything.
 *
 * Env (Vercel, server-only): NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY,
 * NEWEBPAY_HASH_IV, NEWEBPAY_ENV ("sandbox" → ccore test gateway, "production" → core).
 */

export const MPG_VERSION = "2.0";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function newebpayConfig() {
  const production = process.env["NEWEBPAY_ENV"] === "production";
  return {
    merchantId: env("NEWEBPAY_MERCHANT_ID"),
    hashKey: env("NEWEBPAY_HASH_KEY"),
    hashIV: env("NEWEBPAY_HASH_IV"),
    gateway: production
      ? "https://core.newebpay.com/MPG/mpg_gateway"
      : "https://ccore.newebpay.com/MPG/mpg_gateway",
  };
}
type Config = ReturnType<typeof newebpayConfig>;

export function encryptTradeInfo(params: Record<string, string | number>, cfg: Config) {
  const plain = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const cipher = crypto.createCipheriv("aes-256-cbc", cfg.hashKey, cfg.hashIV);
  return cipher.update(plain, "utf8", "hex") + cipher.final("hex");
}

export function tradeSha(tradeInfoHex: string, cfg: Config) {
  return crypto
    .createHash("sha256")
    .update(`HashKey=${cfg.hashKey}&${tradeInfoHex}&HashIV=${cfg.hashIV}`)
    .digest("hex")
    .toUpperCase();
}

function decryptTradeInfo(tradeInfoHex: string, cfg: Config) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", cfg.hashKey, cfg.hashIV);
  // NewebPay's own samples pad to 32-byte blocks, which Node's strict PKCS7
  // check (16-byte blocks) can reject — so strip the padding ourselves.
  decipher.setAutoPadding(false);
  const buf = Buffer.concat([decipher.update(Buffer.from(tradeInfoHex, "hex")), decipher.final()]);
  const pad = buf[buf.length - 1] ?? 0;
  const padded =
    pad > 0 && pad <= 32 && pad <= buf.length && buf.subarray(buf.length - pad).every((b) => b === pad);
  return buf.subarray(0, padded ? buf.length - pad : buf.length).toString("utf8").trim();
}

export type NewebpayResult = {
  MerchantID?: string;
  Amt?: number | string;
  TradeNo?: string;
  MerchantOrderNo?: string;
  PaymentType?: string;
  PayTime?: string;
};
export type NewebpayPayload = { Status: string; Message: string; Result: NewebpayResult };

/**
 * Verify TradeSha (constant-time) and decrypt. Returns null when the envelope
 * isn't genuinely from NewebPay for our store.
 */
export function verifyAndDecrypt(
  form: { MerchantID?: string | null; TradeInfo?: string | null; TradeSha?: string | null },
  cfg: Config,
): NewebpayPayload | null {
  const info = form.TradeInfo ?? "";
  const sha = (form.TradeSha ?? "").toUpperCase();
  if (!info || !/^[0-9a-fA-F]+$/.test(info) || info.length % 32 !== 0) return null;
  if (form.MerchantID && form.MerchantID !== cfg.merchantId) return null;
  const expected = tradeSha(info, cfg);
  if (sha.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sha), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(decryptTradeInfo(info, cfg));
    let result = data.Result;
    if (typeof result === "string") result = result ? JSON.parse(result) : {};
    return { Status: String(data.Status ?? ""), Message: String(data.Message ?? ""), Result: result ?? {} };
  } catch {
    return null;
  }
}

/** 'VSR' + time + random: unique, ≤30 chars, letters/digits only (NewebPay rule). */
export function newOrderNo() {
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `VSR${Date.now().toString(36).toUpperCase()}${rand}`;
}

export type PaymentOutcome =
  | { kind: "invalid" }
  | { kind: "paid" | "already_paid"; orderNo: string }
  | { kind: "failed"; orderNo: string | null; message: string }
  | { kind: "error"; orderNo: string; detail: string };

/**
 * Shared by NotifyURL and ReturnURL. Idempotent: the DB function flips the
 * order pending→paid and grants credits in one transaction, so whichever
 * callback arrives second is a no-op.
 */
export async function handleNewebpayCallback(formData: FormData): Promise<PaymentOutcome> {
  const cfg = newebpayConfig();
  const payload = verifyAndDecrypt(
    {
      MerchantID: formData.get("MerchantID") as string | null,
      TradeInfo: formData.get("TradeInfo") as string | null,
      TradeSha: formData.get("TradeSha") as string | null,
    },
    cfg,
  );
  if (!payload) return { kind: "invalid" };

  const r = payload.Result;
  const orderNo = typeof r.MerchantOrderNo === "string" ? r.MerchantOrderNo : null;
  if (r.MerchantID && r.MerchantID !== cfg.merchantId) return { kind: "invalid" };
  const admin = createAdminClient();

  if (payload.Status !== "SUCCESS") {
    if (orderNo) {
      await admin
        .from("newebpay_orders")
        .update({ status: "failed", message: `${payload.Status}: ${payload.Message}`.slice(0, 300), updated_at: new Date().toISOString() })
        .eq("merchant_order_no", orderNo)
        .eq("status", "pending");
    }
    return { kind: "failed", orderNo, message: payload.Message || payload.Status };
  }

  const amount = Number(r.Amt);
  if (!orderNo || !Number.isInteger(amount)) return { kind: "invalid" };

  const { data, error } = await admin.rpc("grant_newebpay_order", {
    p_order_no: orderNo,
    p_amount: amount,
    p_trade_no: String(r.TradeNo ?? ""),
    p_payment_type: String(r.PaymentType ?? ""),
  });
  if (error) {
    console.error("grant_newebpay_order failed", orderNo, error);
    return { kind: "error", orderNo, detail: error.message };
  }
  if (data === "credited") return { kind: "paid", orderNo };
  if (data === "already_paid") return { kind: "already_paid", orderNo };
  console.error("grant_newebpay_order refused", orderNo, data);
  return { kind: "error", orderNo, detail: String(data) };
}
