// Pricing display helpers. Each credit pack has a fixed NT$ price and a US$ price;
// the Stripe price carries both (USD default + `twd` currency_option), and Checkout
// charges Taiwan customers in NT$ and everyone else in US$ based on their location.

/** Rough rate, only used as a fallback for packs that have no fixed NT$ price. */
export const TWD_PER_USD = 32;

/**
 * Cheapest per-minute NT$ price among the active packs (400 點 for NT$640 = NT$1.6/min).
 * The public landing page can't read credit_products (RLS: signed-in users only),
 * so keep this in sync when the packs change.
 */
export const LOWEST_TWD_PER_MINUTE = 1.6;

export function formatUsd(n: number, decimals = 2) {
  return `US$${n.toFixed(decimals)}`;
}

/** NT$ amount: whole dollars from NT$10 up, one decimal below that (per-minute prices). */
export function formatTwd(n: number) {
  return `NT$${n >= 10 ? Math.round(n).toLocaleString() : n.toFixed(1)}`;
}

/** NT$ price of a pack: the fixed price if set, otherwise an approximate conversion. */
export function packTwd(p: { price_twd: number | null; price_usd: number }) {
  return p.price_twd ?? p.price_usd * TWD_PER_USD;
}
