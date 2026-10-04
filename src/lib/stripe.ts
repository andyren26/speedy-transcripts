import Stripe from "stripe";

/**
 * Server-only Stripe client. STRIPE_SECRET_KEY has no NEXT_PUBLIC_ prefix, so it
 * never ships to the browser. Import this only from route handlers / server code.
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Pinned so a future SDK bump can't silently change API behaviour.
  apiVersion: "2026-03-25.dahlia",
});
