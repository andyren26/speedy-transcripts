// Server-only. Caps how many videos one person can have in progress at once, so a single
// account can't start a flood of paid transcription jobs. (The credit RESERVATION in the
// database is what stops over-spending; this limit stops cost abuse and queue hogging.)

import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_ACTIVE_JOBS_PER_USER = 3;
export const ACTIVE_JOB_STATUSES = ["pending", "downloading", "transcribe"];

/** Returns an error message when the user is at the limit, otherwise null. */
export async function activeJobLimitError(admin: SupabaseClient, userId: string) {
  const { count } = await admin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ACTIVE_JOB_STATUSES);
  if ((count ?? 0) >= MAX_ACTIVE_JOBS_PER_USER) {
    return `你同時處理中的影片已達上限（${MAX_ACTIVE_JOBS_PER_USER} 支），請等其中一支完成後再送出。`;
  }
  return null;
}
