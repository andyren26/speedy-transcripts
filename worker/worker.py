"""
M1 worker: handles ONE job — downloads the video, runs Whisper, writes the TXT
back to job_sessions.subtitle_txt_content.

Started by distributor.py (one process per pending job). Reads JOB_ID from env.
Reads OPENAI_API_KEY / SUPABASE_URL / SUPABASE_SECRET_KEY from AWS Secrets
Manager — the EC2's IAM instance profile grants `secretsmanager:GetSecretValue`
on exactly those secret names, so no credentials ever live on disk.
"""
import math
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import boto3
import openai
from openai import OpenAI
from supabase import create_client


def _get_secret(client, name: str) -> str:
    """Fetch one Secrets Manager secret by name (returns the SecretString)."""
    return client.get_secret_value(SecretId=name)["SecretString"]


def _load_secrets() -> dict[str, str]:
    """Pull the three M1 secrets from AWS Secrets Manager (region from AWS_DEFAULT_REGION)."""
    sm = boto3.client("secretsmanager")
    return {
        "OPENAI_API_KEY": _get_secret(sm, "openai-api-key"),
        "SUPABASE_URL": _get_secret(sm, "supabase-url"),
        "SUPABASE_SECRET_KEY": _get_secret(sm, "supabase-secret-key"),
    }


# Clients are built only after the secrets are fetched (never from os.environ at import).
_secrets = _load_secrets()
db = create_client(_secrets["SUPABASE_URL"], _secrets["SUPABASE_SECRET_KEY"])
openai_client = OpenAI(api_key=_secrets["OPENAI_API_KEY"])

# OpenAI Whisper has a 25 MB file-size limit. 10 minutes of 64 kbps mono mp3 ~= 4.8 MB,
# safely under the limit. Long videos get split into 600-second chunks.
CHUNK_SECONDS = 600

# Per-job working directory. Kept after the job (success or failure) so a re-run
# doesn't have to re-download; /tmp is cleaned by the OS (whisper-best-practice Rule 7).
WORK_ROOT = Path("/tmp/m1-jobs")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_job(job_id: str) -> dict:
    return db.table("jobs").select("*").eq("id", job_id).single().execute().data


def update_job(job_id: str, **fields) -> None:
    db.table("jobs").update({**fields, "updated_at": now_iso()}).eq("id", job_id).execute()


def update_session(session_id: str, **fields) -> None:
    db.table("job_sessions").update(fields).eq("id", session_id).execute()


def download_video(url: str, dest_dir: Path) -> Path:
    """yt-dlp for URLs (its generic extractor handles direct .mp3/.mp4 links)."""
    existing = sorted(dest_dir.glob("video.*"))
    if existing:
        return existing[0]  # re-run of the same job: reuse the earlier download
    out_template = str(dest_dir / "video.%(ext)s")
    subprocess.run(["yt-dlp", "--no-playlist", "-o", out_template, url], check=True)
    return next(dest_dir.glob("video.*"))


def to_mp3(video_path: Path, dest_dir: Path) -> Path:
    """Convert any video/audio container to 64 kbps mono 16 kHz mp3 (Whisper-friendly)."""
    mp3 = dest_dir / "audio.mp3"
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(video_path),
            "-vn", "-ac", "1",
            "-ar", "16000", "-ab", "64k",
            "-acodec", "libmp3lame",
            str(mp3),
        ],
        check=True,
        capture_output=True,
    )
    return mp3


def probe_duration_minutes_cheap(video_url: str) -> Optional[int]:
    """Ask yt-dlp for the duration WITHOUT downloading. Returns ceil(seconds/60),
    min 1, or None when the source has no manifest duration (yt-dlp prints "NA"
    for e.g. direct CloudFront .mp4 links). None means "check after download"."""
    try:
        out = subprocess.run(
            ["yt-dlp", "--no-playlist", "--no-warnings", "--print", "duration", video_url],
            check=True, capture_output=True, text=True, timeout=30,
        ).stdout.strip()
    except (subprocess.SubprocessError, OSError):
        return None
    if not out or out.upper() == "NA":
        return None
    try:
        seconds = float(out.splitlines()[0])
    except ValueError:
        return None
    return max(1, math.ceil(seconds / 60))


def get_balance(user_id: str) -> float:
    rows = db.table("profiles").select("credits_balance").eq("id", user_id).execute().data
    return float(rows[0]["credits_balance"]) if rows else 0.0


def block_insufficient(job: dict, minutes: int, balance: float) -> None:
    """Mark the job insufficient_credits and leave a zero-amount ledger note.
    No Whisper call happens, so the platform pays nothing for this job."""
    update_job(job["id"], status="insufficient_credits")
    db.table("credit_transactions").insert({
        "user_id": job["user_id"],
        "amount": 0,
        "type": "deduction",
        "description": f"Insufficient credits: video is {minutes} min, you have {int(balance)}",
        "job_id": job["id"],
    }).execute()
    print(f"[{job['id']}] insufficient credits: {minutes} min > {balance} cr", flush=True)


def deduct_credits(job: dict, minutes: int) -> None:
    """Ledger row first (source of truth), then the derived balance.
    Read-then-write is fine for v1: the distributor runs one worker per job and
    users don't run concurrent jobs at scale yet."""
    db.table("credit_transactions").insert({
        "user_id": job["user_id"],
        "amount": -minutes,
        "type": "deduction",
        "description": f"Transcribed {minutes} min video",
        "job_id": job["id"],
    }).execute()
    new_balance = max(0.0, get_balance(job["user_id"]) - minutes)
    db.table("profiles").update({"credits_balance": new_balance}).eq("id", job["user_id"]).execute()


def get_duration_seconds(audio_path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(out.stdout.strip())


def split_chunks(mp3_path: Path, dest_dir: Path) -> list[Path]:
    """Split into CHUNK_SECONDS-second chunks (re-encode to keep sizes predictable)."""
    duration = get_duration_seconds(mp3_path)
    n_chunks = max(1, math.ceil(duration / CHUNK_SECONDS))
    chunks = []
    for i in range(n_chunks):
        chunk = dest_dir / f"chunk_{i:03d}.mp3"
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(mp3_path),
                "-ss", str(i * CHUNK_SECONDS),
                "-t", str(CHUNK_SECONDS),
                "-acodec", "libmp3lame",
                "-ab", "64k",
                str(chunk),
            ],
            check=True,
            capture_output=True,
        )
        chunks.append(chunk)
    return chunks


def transcribe_chunk(chunk_path: Path, language: str, max_retries: int = 4) -> str:
    """Whisper with retry-with-backoff for 429 / 5xx only; 4xx errors are raised at once."""
    for attempt in range(max_retries):
        try:
            with open(chunk_path, "rb") as f:
                return openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    response_format="text",
                    language=language,
                )
        except openai.RateLimitError:
            time.sleep(2 ** attempt)
        except openai.APIStatusError as e:
            if 500 <= e.status_code < 600:
                time.sleep(2 ** attempt)
            else:
                raise  # 400/401/413/415 need a fix, not a retry
    raise RuntimeError(f"Whisper failed after {max_retries} retries: {chunk_path.name}")


def main() -> None:
    job_id = os.environ["JOB_ID"]
    job = get_job(job_id)
    session_id = job["current_session_id"]

    # Claim the job FIRST, before any external call, so a crash below can't leave
    # it 'pending' and make the distributor respawn it in a loop.
    update_job(job_id, status="downloading")

    # M2 gate 1 (cheap): duration from the manifest, no download.
    balance = get_balance(job["user_id"])
    quick_minutes = probe_duration_minutes_cheap(job["video_source_url"])
    if quick_minutes is not None and quick_minutes > balance:
        block_insufficient(job, quick_minutes, balance)
        return

    print(f"[{job_id}] downloading {job['video_source_url']}", flush=True)
    work = WORK_ROOT / job_id
    work.mkdir(parents=True, exist_ok=True)
    video = download_video(job["video_source_url"], work)
    mp3 = to_mp3(video, work)

    # M2 gate 2 (precise): exact length of the downloaded audio. This is also the
    # number we charge. 61 s = 2 credits (always round up, minimum 1).
    minutes = max(1, math.ceil(get_duration_seconds(mp3) / 60))
    balance = get_balance(job["user_id"])
    if minutes > balance:
        block_insufficient(job, minutes, balance)
        return

    update_job(job_id, status="transcribe")
    chunks = split_chunks(mp3, work)
    print(f"[{job_id}] transcribing {len(chunks)} chunk(s), {minutes} min", flush=True)

    full_text = "\n\n".join(transcribe_chunk(c, job["language"]).strip() for c in chunks)

    update_session(session_id, subtitle_txt_content=full_text)
    # M2: charge only on success — failed jobs never reach this line.
    deduct_credits(job, minutes)
    update_job(job_id, status="done")

    print(f"[{job_id}] done — {len(full_text)} chars, charged {minutes} cr", flush=True)


if __name__ == "__main__":
    main()
