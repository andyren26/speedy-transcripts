import Stripe from "stripe";

/**
 * Server-only Stripe client. STRIPE_SECRET_KEY has no NEXT_PUBLIC_ prefix, so it
 * never ships to the browser. Import this only from route handlers / server code.
 */
const secretKey = process.env["STRIPE_SECRET_KEY"];
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(secretKey, {
  // Pinned to the version stripe@22.6.x ships with, so a future SDK bump can't
  // silently change API behaviour.
  apiVersion: "2026-08-26.dahlia",
});
