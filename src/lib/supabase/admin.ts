import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SUPABASE_URL, createSupabaseFetch } from "./fetch";

/**
 * Server-only Supabase client using the Secret key (sb_secret_*). It BYPASSES RLS,
 * so every query that reads user data must re-apply the per-user filter itself
 * (e.g. .eq("user_id", user.id)). Only import this from Route Handlers / Server
 * Components — SUPABASE_SECRET_KEY has no NEXT_PUBLIC_ prefix, so it never ships
 * to the browser.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(SUPABASE_URL, secretKey, {
    global: { fetch: createSupabaseFetch(secretKey) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
