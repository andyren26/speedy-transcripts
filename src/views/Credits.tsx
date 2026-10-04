"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CreditProduct = {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
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

function usd(n: number) {
  return `$${Number(n).toFixed(2)}`;
}

/**
 * Extra credits a tier gives for the same money, compared with the baseline
 * (smallest) pack. $30 → 45 credits vs $1/credit baseline = +50%.
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
}: {
  balance: number;
  products: CreditProduct[];
  transactions: CreditTransaction[];
  canceled: boolean;
}) {
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const baseline = products.reduce<CreditProduct | null>(
    (min, p) => (min === null || p.credits < min.credits ? p : min),
    null,
  );

  async function buy(productId: string) {
    setPurchasingId(productId);
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

  return (
    <>
      {canceled && (
        <p className="mt-6 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          已取消付款，沒有任何扣款。
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
          <p className="mt-0.5 text-xs text-muted-foreground">1 點 = 1 分鐘影片（不足 1 分鐘以 1 分鐘計）</p>
        </div>
      </div>

      {/* Tiers */}
      <h2 className="mt-10 font-display text-xl font-semibold">購買點數</h2>
      {products.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">目前沒有可購買的方案。</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {products.map((p) => {
            const bonus = baseline ? bonusPercent(p, baseline) : 0;
            const busy = purchasingId === p.id;
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
                <p className="mt-3 font-display text-3xl font-semibold">{usd(p.price_usd)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  每點 {usd(p.price_usd / p.credits)}
                </p>
                <Button
                  className="mt-5"
                  onClick={() => buy(p.id)}
                  disabled={purchasingId !== null}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {busy ? "前往付款…" : "購買"}
                </Button>
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
                        {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: zhTW })}
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
