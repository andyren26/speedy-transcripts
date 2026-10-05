import { redirect } from "next/navigation";
import Workspace from "@/views/Workspace";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";

// Post-login dashboard. Auth is checked on the server from the session cookie.
export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_balance")
    .eq("id", user.id)
    .maybeSingle();
  const balance = Number(profile?.credits_balance ?? 0);

  return <Workspace header={<AppHeader user={user} />} balance={balance} />;
}
