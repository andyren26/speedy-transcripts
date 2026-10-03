import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/integrations/supabase/types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, createSupabaseFetch } from "./fetch";

/**
 * Server-side Supabase client for Server Components and Route Handlers.
 * Reads the signed-in user's session from the request cookies.
 * cookies() is async since Next.js 15, so it must be awaited.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // middleware.ts refreshes the session cookie, so this is safe to ignore.
        }
      },
    },
  });
}
