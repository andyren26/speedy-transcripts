import Stripe from "stripe";

/**
 * Server-only Stripe client. STRIPE_SECRET_KEY has no NEXT_PUBLIC_ prefix, so it
 * never ships to the browser. Import this only from route handlers / server code.
 *
 * Created lazily on first use: `next build` loads route modules to collect
 * config, so throwing at import time would fail the whole deploy whenever the
 * key is missing. This way only the Stripe routes fail, with a clear error.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  client = new Stripe(secretKey, {
    // Pinned to the version stripe@22.6.x ships with, so a future SDK bump can't
    // silently change API behaviour.
    apiVersion: "2026-08-26.dahlia",
  });
  return client;
}
