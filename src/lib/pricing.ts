// Display-only pricing helpers. Checkout always charges the USD price stored in
// credit_products / Stripe; NT$ amounts are an approximate conversion for Taiwan users.

/** Approximate exchange rate used for the "約 NT$" hints. Update if the rate moves a lot. */
export const TWD_PER_USD = 32;

/**
 * Cheapest per-minute price among the active packs (400 點 for US$20 = US$0.05/min).
 * The public landing page can't read credit_products (RLS: signed-in users only),
 * so keep this in sync when the packs change.
 */
export const LOWEST_USD_PER_MINUTE = 0.05;

export function formatUsd(n: number, decimals = 2) {
  return `US$${n.toFixed(decimals)}`;
}

/** "約 NT$160" — whole dollars for pack prices, one decimal for small per-minute amounts. */
export function approxTwd(usd: number) {
  const twd = usd * TWD_PER_USD;
  return `約 NT$${twd >= 10 ? Math.round(twd).toLocaleString() : twd.toFixed(1)}`;
}
