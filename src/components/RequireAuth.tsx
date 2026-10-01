import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState =
  { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; user: User };

/** Guards child routes: redirects to /sign-in when there is no Supabase user. */
export function RequireAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setState(
        error || !data.user ? { status: "signed-out" } : { status: "signed-in", user: data.user },
      );
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setState(
        session?.user ? { status: "signed-in", user: session.user } : { status: "signed-out" },
      );
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (state.status === "loading") return <div className="min-h-screen bg-background" />;
  if (state.status === "signed-out") return <Navigate to="/sign-in" replace />;
  return <Outlet context={{ user: state.user }} />;
}
