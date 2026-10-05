// Shared by the upload form (browser) and the upload API routes (server).

/** Largest file a user can upload: 2 GB (a single S3 PUT allows up to 5 GB). */
export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;

/** File extensions we accept when the browser doesn't report a video/ or audio/ MIME type. */
export const MEDIA_EXTENSIONS = [
  "mp4",
  "mov",
  "m4v",
  "mkv",
  "webm",
  "avi",
  "wmv",
  "flv",
  "mpeg",
  "mpg",
  "3gp",
  "mp3",
  "m4a",
  "wav",
  "aac",
  "ogg",
  "oga",
  "opus",
  "flac",
  "wma",
];

export function isMediaFile(name: string, type: string) {
  if (type.startsWith("video/") || type.startsWith("audio/")) return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_EXTENSIONS.includes(ext);
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
