import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import UploadForm from "@/views/UploadForm";

export const metadata = {
  title: "上傳影片 — Video Speed Reader",
  description: "貼上影片網址，幾分鐘後拿到逐字稿。",
};

type JobRow = {
  id: string;
  created_at: string;
  video_source_url: string;
  status: string;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  downloading: "bg-muted text-muted-foreground",
  transcribe: "bg-sky-500/15 text-sky-700",
  done: "bg-success/15 text-success",
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
    .select("id, created_at, video_source_url, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const jobs: JobRow[] = data ?? [];

  return (
    <main className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
        <Link href="/app" className="flex items-center gap-2.5">
          <span className="brand-gradient grid size-9 place-items-center rounded-lg font-display text-sm font-bold text-primary-foreground">
            V
          </span>
          <span className="font-display font-semibold">Video Speed Reader</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/app"
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-surface-bright hover:text-foreground"
          >
            工作區
          </Link>
          <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:block">
            {user.email}
          </span>
          <SignOutButton />
        </div>
      </header>

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
                    <th className="hidden px-3 py-3 font-semibold sm:table-cell sm:px-4">Created</th>
                    <th className="px-3 py-3 sm:px-4 font-semibold">URL</th>
                    <th className="px-3 py-3 sm:px-4 font-semibold">Status</th>
                    <th className="px-3 py-3 sm:px-4 font-semibold">Transcript</th>
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
                      <td className="max-w-[8rem] px-3 py-3 sm:max-w-xs sm:px-4" title={job.video_source_url}>
                        <span className="block truncate">{truncate(job.video_source_url)}</span>
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_STYLE[job.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        {job.status === "done" ? (
                          <a
                            href={`/api/jobs/${job.id}/transcript`}
                            download={`transcript-${job.id.slice(0, 8)}.txt`}
                            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                          >
                            <Download className="size-4" />
                            .txt
                          </a>
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
