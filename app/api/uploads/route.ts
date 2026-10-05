import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUploadUrl } from "@/lib/s3";
import { MAX_UPLOAD_BYTES, formatBytes, isMediaFile } from "@/lib/upload-limits";

/**
 * Step 1 of a file upload: check the file and the user's credits, then hand back a
 * presigned S3 PUT URL. The browser uploads straight to S3 (Vercel functions can't
 * take large request bodies), then calls POST /api/jobs with the returned key.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const fileName = typeof body.filename === "string" ? body.filename.trim() : "";
  const size = Number(body.size);
  const contentType =
    typeof body.contentType === "string" && body.contentType
      ? body.contentType
      : "application/octet-stream";
  const durationSeconds = Number(body.durationSeconds);

  if (!fileName || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "請選擇要上傳的檔案。" }, { status: 400 });
  }
  if (!isMediaFile(fileName, contentType)) {
    return NextResponse.json(
      { error: "只支援影片或音檔（例如 mp4、mov、mp3、m4a、wav）。" },
      { status: 400 },
    );
  }
  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `檔案太大（${formatBytes(size)}），單一檔案上限是 ${formatBytes(MAX_UPLOAD_BYTES)}。`,
      },
      { status: 413 },
    );
  }

  // Credits: block before the upload so nobody waits on a big file that can't be transcribed.
  // The browser reports the duration when it can read it; the worker still re-checks exactly.
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_balance")
    .eq("id", user.id)
    .maybeSingle();
  const balance = Number(profile?.credits_balance ?? 0);
  if (balance < 1) {
    return NextResponse.json(
      { error: "點數不足，請先購買點數。", code: "insufficient_credits" },
      { status: 402 },
    );
  }
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    if (minutes > balance) {
      return NextResponse.json(
        {
          error: `這支影片約 ${minutes} 分鐘，需要 ${minutes} 點，你目前剩 ${Math.floor(balance)} 點。`,
          code: "insufficient_credits",
        },
        { status: 402 },
      );
    }
  }

  const { key, url } = await createUploadUrl(user.id, fileName, contentType);
  return NextResponse.json({ key, uploadUrl: url, contentType });
}
