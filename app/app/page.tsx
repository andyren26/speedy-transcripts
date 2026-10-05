import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import Workspace, { type RecentJob } from "@/views/Workspace";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { isUploadedFile, jobTitle } from "@/lib/job-title";

const LANGUAGE_LABEL: Record<string, string> = { zh: "中文", en: "English", ja: "日本語" };

// Post-login dashboard. Auth is checked on the server from the session cookie.
export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data: jobRows, count }] = await Promise.all([
    supabase.from("profiles").select("credits_balance").eq("id", user.id).maybeSingle(),
    // RLS limits jobs to the signed-in user's rows; the user_id filter keeps the intent obvious.
    supabase
      .from("jobs")
      .select("id, created_at, video_source_url, topic, language, status, progress", {
        count: "exact",
      })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const balance = Number(profile?.credits_balance ?? 0);
  const rows = jobRows ?? [];

  // Minutes charged per job (credit deductions are negative amounts, 1 credit = 1 minute).
  const minutes = new Map<string, number>();
  if (rows.length > 0) {
    const { data: deductions } = await supabase
      .from("credit_transactions")
      .select("job_id, amount")
      .in(
        "job_id",
        rows.map((j) => j.id),
      )
      .lt("amount", 0);
    for (const d of deductions ?? []) {
      if (d.job_id) minutes.set(d.job_id, (minutes.get(d.job_id) ?? 0) - Number(d.amount));
    }
  }

  const jobs: RecentJob[] = rows.map((j) => {
    const used = minutes.get(j.id);
    return {
      id: j.id,
      title: jobTitle(j.topic, j.video_source_url),
      url: isUploadedFile(j.video_source_url)
        ? jobTitle(null, j.video_source_url)
        : j.video_source_url,
      detail: [
        formatDistanceToNow(new Date(j.created_at), { addSuffix: true, locale: zhTW }),
        j.language ? (LANGUAGE_LABEL[j.language] ?? j.language) : null,
        used ? `${used} 分鐘` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      status: j.status,
      progress: j.progress ?? 0,
    };
  });

  return (
    <Workspace
      header={<AppHeader user={user} />}
      balance={balance}
      jobs={jobs}
      totalJobs={count ?? jobs.length}
    />
  );
}
