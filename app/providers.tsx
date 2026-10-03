"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // A password-reset link that lands anywhere other than /reset-password
      // (e.g. Supabase fell back to the Site URL) still ends up on the reset form.
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
        router.replace("/reset-password");
        return;
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (session) queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient, pathname]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
