"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTwd, formatUsd, packTwd } from "@/lib/pricing";

export type CreditProduct = {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  price_twd: number | null;
};

export type CreditTransaction = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
};

const TX_STYLE: Record<string, string> = {
  purchase: "bg-success/15 text-success",
  signup_bonus: "bg-amber-500/15 text-amber-700",
  deduction: "bg-muted text-muted-foreground",
  admin_grant: "bg-sky-500/15 text-sky-700",
};

const TX_LABEL: Record<string, string> = {
  purchase: "購買",
  signup_bonus: "註冊贈點",
  deduction: "扣點",
  admin_grant: "手動加點",
};

/**
 * Extra credits a tier gives for the same money, compared with the baseline
 * (smallest) pack. $10 → 150 credits vs $5 → 60 (12 credits/$) = +25%.
 */
function bonusPercent(tier: CreditProduct, baseline: CreditProduct) {
  const tierCreditsPerUsd = tier.credits / tier.price_usd;
  const baseCreditsPerUsd = baseline.credits / baseline.price_usd;
  return Math.round((tierCreditsPerUsd / baseCreditsPerUsd - 1) * 100);
}

export default function Credits({
  balance,
  products,
  transactions,
  canceled,
  failedReason,
  overseasEnabled,
}: {
  balance: number;
  products: CreditProduct[];
  transactions: CreditTransaction[];
  canceled: boolean;
  /** set when 藍新 returned an unsuccessful payment */
  failedReason: string | null;
  /** US$ Stripe checkout for overseas customers — off until Stripe goes live
   *  (STRIPE_CHECKOUT_ENABLED=true on Vercel turns it back on). */
  overseasEnabled: boolean;
}) {
  // "<productId>:twd" (藍新) or "<productId>:usd" (Stripe) while redirecting
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const baseline = products.reduce<CreditProduct | null>(
    (min, p) => (min === null || p.credits < min.credits ? p : min),
    null,
  );

  /** US$ — Stripe Checkout (overseas customers). */
  async function buyUsd(productId: string) {
    setPurchasingId(`${productId}:usd`);
    setError("");
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        setError(body.error ?? `無法建立付款頁面（HTTP ${res.status}）`);
        setPurchasingId(null);
        return;
      }
      // Keep buttons disabled while the browser navigates to Stripe Checkout.
      window.location.href = body.url;
    } catch {
      setError("網路錯誤，請再試一次。");
      setPurchasingId(null);
    }
  }

  /** NT$ — 藍新金流 NewebPay MPG (Taiwan customers). The server returns an
   *  encrypted form; the browser POSTs it to NewebPay's payment page. */
  async function buyTwd(productId: string) {
    setPurchasingId(`${productId}:twd`);
    setError("");
    try {
      const res = await fetch("/api/credits/newebpay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.action || !body.fields) {
        setError(body.error ?? `無法建立付款頁面（HTTP ${res.status}）`);
        setPurchasingId(null);
        return;
      }
      const form = document.createElement("form");
      form.method = "POST";
      form.action = body.action;
      for (const [name, value] of Object.entries(body.fields as Record<string, string>)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit(); // buttons stay disabled while the browser leaves
    } catch {
      setError("網路錯誤，請再試一次。");
      setPurchasingId(null);
    }
  }

  return (
    <>
      {canceled && (
        <p className="mt-6 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          已取消付款，沒有任何扣款。
        </p>
      )}
      {failedReason !== null && (
        <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          付款沒有成功{failedReason ? `（${failedReason}）` : ""}，沒有任何扣款，也沒有加點。請再試一次或換一張卡。
        </p>
      )}

      {/* Balance */}
      <div className="mt-8 flex items-center gap-4 rounded-xl border border-border bg-card/50 p-6">
        <span className="brand-gradient grid size-12 place-items-center rounded-xl text-primary-foreground">
          <Coins className="size-6" />
        </span>
        <div>
          <p className="text-sm text-muted-foreground">目前餘額</p>
          <p className="font-display text-3xl font-semibold">
            {Number(balance).toLocaleString()} <span className="text-lg">點</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            1 點 = 1 分鐘影片（不足 1 分鐘以 1 分鐘計）
          </p>
        </div>
      </div>

      {/* Tiers */}
      <h2 className="mt-10 font-display text-xl font-semibold">購買點數</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        用多少買多少，不用訂閱，點數不會過期。
        {overseasEnabled
          ? "台灣用戶以新台幣刷卡（藍新金流），海外用戶以美元付款（Stripe）。"
          : "以新台幣信用卡付款（藍新金流）。"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        購買後 7 天內未使用的點數可申請退款。購買即表示你同意
        <Link href="/terms" className="mx-0.5 text-primary hover:underline">
          服務條款
        </Link>
        與
        <Link href="/refund" className="mx-0.5 text-primary hover:underline">
          退款政策
        </Link>
        。
      </p>
      {products.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">目前沒有可購買的方案。</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {products.map((p) => {
            const bonus = baseline ? bonusPercent(p, baseline) : 0;
            const busyTwd = purchasingId === `${p.id}:twd`;
            const busyUsd = purchasingId === `${p.id}:usd`;
            const canTwd = p.price_twd !== null && Number.isInteger(p.price_twd);
            return (
              <div
                key={p.id}
                className="flex flex-col rounded-xl border border-border bg-card/50 p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-lg font-semibold">{p.name}</p>
                  {bonus > 0 && (
                    <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                      +{bonus}% 加成
                    </span>
                  )}
                </div>
                <p className="mt-3 font-display text-3xl font-semibold">{formatTwd(packTwd(p))}</p>
                {overseasEnabled && (
                  <p className="text-sm text-muted-foreground">海外付款 {formatUsd(p.price_usd)}</p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  可轉錄 {p.credits.toLocaleString()} 分鐘・每分鐘{" "}
                  {formatTwd(packTwd(p) / p.credits)}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {canTwd && (
                    <Button onClick={() => buyTwd(p.id)} disabled={purchasingId !== null}>
                      {busyTwd ? <Loader2 className="size-4 animate-spin" /> : null}
                      {busyTwd ? "前往付款…" : `台灣付款 ${formatTwd(packTwd(p))}`}
                    </Button>
                  )}
                  {overseasEnabled && (
                    <Button
                      variant={canTwd ? "outline" : "default"}
                      onClick={() => buyUsd(p.id)}
                      disabled={purchasingId !== null}
                    >
                      {busyUsd ? <Loader2 className="size-4 animate-spin" /> : null}
                      {busyUsd ? "前往付款…" : `海外付款 ${formatUsd(p.price_usd)}`}
                    </Button>
                  )}
                  {!canTwd && !overseasEnabled && (
                    <Button disabled>暫不開放購買</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* History */}
      <h2 className="mt-10 font-display text-xl font-semibold">點數紀錄</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card/50">
        {transactions.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">還沒有任何紀錄。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-semibold sm:px-4">時間</th>
                  <th className="px-3 py-3 font-semibold sm:px-4">類型</th>
                  <th className="hidden px-3 py-3 font-semibold sm:table-cell sm:px-4">說明</th>
                  <th className="px-3 py-3 text-right font-semibold sm:px-4">點數</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const amount = Number(tx.amount);
                  return (
                    <tr key={tx.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground sm:px-4">
                        {formatDistanceToNow(new Date(tx.created_at), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                            TX_STYLE[tx.type] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {TX_LABEL[tx.type] ?? tx.type}
                        </span>
                      </td>
                      <td className="hidden px-3 py-3 text-muted-foreground sm:table-cell sm:px-4">
                        {tx.description ?? "—"}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums sm:px-4 ${
                          amount > 0 ? "text-success" : "text-muted-foreground"
                        }`}
                      >
                        {amount > 0 ? `+${amount}` : amount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
