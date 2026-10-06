import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user, plus whether they are a site admin (profiles.role = 'admin').
 * Users can't change their own role: profiles has no UPDATE policy, so the role is
 * only settable with the Secret key or in the Supabase dashboard.
 */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, isAdmin: profile?.role === "admin" } as const;
}
