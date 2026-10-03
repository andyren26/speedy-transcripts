// Kept so existing imports keep working:
//   import { supabase } from "@/integrations/supabase/client";
// The client now lives in src/lib/supabase/client.ts (cookie-based, via @supabase/ssr).
export { supabase } from "@/lib/supabase/client";
