/**
 * Display name for a job: its topic if set, otherwise the file name from the video URL
 * (for uploads that's the original file name, not the long presigned S3 URL).
 */
export function jobTitle(topic: string | null | undefined, url: string) {
  if (topic?.trim()) return topic.trim();
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    // not a parseable URL — fall through
  }
  return url;
}

/** True for jobs whose source is a file the user uploaded to our S3 bucket. */
export function isUploadedFile(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".amazonaws.com") && u.pathname.includes("/uploads/");
  } catch {
    return false;
  }
}
