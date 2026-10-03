import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/integrations/supabase/types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, createSupabaseFetch } from "./fetch";

/**
 * Browser-side Supabase client. The session lives in cookies (not localStorage),
 * so server components, route handlers and middleware can read the same session.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
  });
}

let _supabase: ReturnType<typeof createClient> | undefined;

/**
 * Lazily-created singleton for client components. Only touch it in event handlers
 * and effects (never during render), so server prerendering never creates it.
 */
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
