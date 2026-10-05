import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Server-only S3 helpers for user uploads. Credentials belong to the IAM user
 * `vsr-upload-presigner`, which may only Put/Get objects under `uploads/` in the
 * upload bucket. The bucket's lifecycle rule deletes uploads after 1 day.
 *
 * Env (Vercel, no NEXT_PUBLIC_ prefix so they never reach the browser):
 * S3_UPLOAD_BUCKET, S3_UPLOAD_REGION, S3_UPLOAD_ACCESS_KEY_ID, S3_UPLOAD_SECRET_ACCESS_KEY
 */

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({
    region: env("S3_UPLOAD_REGION"),
    credentials: {
      accessKeyId: env("S3_UPLOAD_ACCESS_KEY_ID"),
      secretAccessKey: env("S3_UPLOAD_SECRET_ACCESS_KEY"),
    },
    // Newer SDKs add a CRC32 checksum to presigned PutObject URLs by default, which a
    // plain browser PUT can't satisfy. Only compute checksums when S3 requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

const bucket = () => env("S3_UPLOAD_BUCKET");

/** Keep letters (any script), digits, dot, dash, underscore; everything else becomes "_". */
function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^[._]+/, "");
  return (cleaned || "upload").slice(-120);
}

/** Every key a user uploads lives under this prefix; used to check ownership. */
export function userUploadPrefix(userId: string) {
  return `uploads/${userId}/`;
}

/** A presigned PUT for one new object. The browser must send the same Content-Type. */
export async function createUploadUrl(userId: string, fileName: string, contentType: string) {
  const key = `${userUploadPrefix(userId)}${randomUUID()}/${safeFileName(fileName)}`;
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: 60 * 60 },
  );
  return { key, url };
}

/** Size of an uploaded object, or null if it doesn't exist. */
export async function uploadedSize(key: string) {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return head.ContentLength ?? 0;
  } catch {
    return null;
  }
}

/** A presigned GET the worker downloads from (yt-dlp handles it like any direct link). */
export async function createDownloadUrl(key: string) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: 24 * 60 * 60,
  });
}
