import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import UploadForm from "@/views/UploadForm";
import SummaryCell from "@/views/SummaryCell";
import JobsAutoRefresh from "@/views/JobsAutoRefresh";
import { JobStatus, isJobInProgress } from "@/components/JobStatus";
import { isUploadedFile, jobTitle } from "@/lib/job-title";

export const metadata = {
  title: "上傳影片 — Video Speed Reader",
  description: "貼上影片網址，幾分鐘後拿到逐字稿。",
};

type JobRow = {
  id: string;
  created_at: string;
  video_source_url: string;
  status: string;
  progress: number;
  error_message: string | null;
  current_session_id: string | null;
};

function truncate(url: string, max = 50) {
  return url.length > max ? `${url.slice(0, max - 1)}…` : url;
}

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS ("users read own jobs") limits this to the signed-in user's rows;
  // the explicit user_id filter keeps the intent obvious.
  const { data, error } = await supabase
    .from("jobs")
    .select("id, created_at, video_source_url, status, progress, error_message, current_session_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const jobs: JobRow[] = data ?? [];

  // Cached AI summaries for those jobs (RLS: "users read own sessions").
  const sessionIds = jobs.map((j) => j.current_session_id).filter((id): id is string => !!id);
  const summaries = new Map<string, string>();
  // Sessions with per-sentence timestamps (offer .srt). `segments->0` fetches only
  // the first segment, so we learn "has timestamps" without loading them all.
  const timestamped = new Set<string>();
  if (sessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from("job_sessions")
      .select("id, summary_content, first_segment:segments->0")
      .in("id", sessionIds);
    for (const s of sessions ?? []) {
      if (s.summary_content) summaries.set(s.id, s.summary_content);
      if (s.first_segment != null) timestamped.add(s.id);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <AppHeader user={user} />
      <JobsAutoRefresh active={jobs.some((j) => isJobInProgress(j.status))} />

      <section className="mx-auto max-w-5xl p-5 sm:p-8 lg:p-10">
        <p className="text-sm text-secondary">Transcribe a video</p>
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">你的逐字稿</h1>

        {/* (a) The signed-in user's jobs */}
        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card/50">
          {error ? (
            <p className="p-6 text-sm text-destructive">無法讀取工作清單：{error.message}</p>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-display text-lg font-semibold">還沒有任何逐字稿</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No transcriptions yet. Submit your first video below.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="hidden px-3 py-3 font-semibold sm:table-cell sm:px-4">
                      Created
                    </th>
                    <th className="px-3 py-3 sm:px-4 font-semibold">URL</th>
                    <th className="px-3 py-3 sm:px-4 font-semibold">Status</th>
                    <th className="px-3 py-3 sm:px-4 font-semibold">Transcript</th>
                    <th className="px-3 py-3 sm:px-4 font-semibold">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-border last:border-0">
                      <td className="hidden whitespace-nowrap px-3 py-3 text-muted-foreground sm:table-cell sm:px-4">
                        {formatDistanceToNow(new Date(job.created_at), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </td>
                      <td
                        className="max-w-[8rem] px-3 py-3 sm:max-w-xs sm:px-4"
                        title={
                          isUploadedFile(job.video_source_url)
                            ? jobTitle(null, job.video_source_url)
                            : job.video_source_url
                        }
                      >
                        <span className="block truncate">
                          {isUploadedFile(job.video_source_url)
                            ? `📁 ${jobTitle(null, job.video_source_url)}`
                            : truncate(job.video_source_url)}
                        </span>
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <JobStatus
                          status={job.status}
                          progress={job.progress}
                          error={job.error_message}
                          showReason
                        />
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        {job.status === "done" ? (
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-3">
                            <a
                              href={`/api/jobs/${job.id}/transcript`}
                              download={`transcript-${job.id.slice(0, 8)}.txt`}
                              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                              title="逐字稿（每句附時間標記）"
                            >
                              <Download className="size-4" />
                              .txt
                            </a>
                            {job.current_session_id && timestamped.has(job.current_session_id) && (
                              <a
                                href={`/api/jobs/${job.id}/transcript?format=srt`}
                                download={`transcript-${job.id.slice(0, 8)}.srt`}
                                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                                title="字幕檔，可直接掛到影片上"
                              >
                                <Download className="size-4" />
                                .srt
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        {job.status === "done" ? (
                          <SummaryCell
                            jobId={job.id}
                            initialSummary={
                              job.current_session_id
                                ? (summaries.get(job.current_session_id) ?? null)
                                : null
                            }
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* (b) Submission form */}
        <UploadForm />
      </section>
    </main>
  );
}
