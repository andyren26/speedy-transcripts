"""
M4 Lambda distributor — replaces M1's always-on distributor.py on the EC2.

Fired every minute by EventBridge. For each job with status='pending' it makes
sure the job has a linked job_sessions row, launches ONE Fargate task for it
(ecs:RunTask), and stamps the task ARN on job_sessions.fargate_task_arn. The ARN
is the idempotency key: a session that already has an ARN is never respawned,
so the stateless Lambda can run every minute without double-spawning.

Secrets are read from AWS Secrets Manager (same names as M1) and forwarded to
the Fargate task as env vars — they never live in the Lambda's own config.
Overlapping ticks are safe: each session is claimed atomically in the DB
(NULL -> 'claiming') before RunTask, so only one invocation can launch it.

Two passes per tick: (1) spawn pending jobs, (2) sweep unfinished jobs whose
Fargate task has died and mark them 'failed' with a readable reason.
"""
import os
from datetime import datetime, timezone

import boto3
from supabase import create_client

ECS_CLUSTER = os.environ["ECS_CLUSTER"]
TASK_DEFINITION = os.environ["TASK_DEFINITION"]
SUBNETS = [s for s in os.environ["SUBNETS"].split(",") if s]
CONTAINER_NAME = os.environ.get("CONTAINER_NAME", "worker")
CLAIMING = "claiming"  # placeholder ARN while RunTask is in flight

SECRET_NAMES = {
    "OPENAI_API_KEY": os.environ.get("OPENAI_SECRET_NAME", "openai-api-key"),
    "SUPABASE_URL": os.environ.get("SUPABASE_URL_SECRET_NAME", "supabase-url"),
    "SUPABASE_SECRET_KEY": os.environ.get("SUPABASE_KEY_SECRET_NAME", "supabase-secret-key"),
}

ecs = boto3.client("ecs")
_sm = boto3.client("secretsmanager")
_secrets = None  # cached across warm invocations


def _load_secrets() -> dict:
    global _secrets
    if _secrets is None:
        _secrets = {
            k: _sm.get_secret_value(SecretId=name)["SecretString"]
            for k, name in SECRET_NAMES.items()
        }
    return _secrets


def _ensure_session(db, job: dict) -> str:
    """Return the job's current session id, creating AND linking one if missing.

    POST /api/jobs already creates + links the session, but a job inserted any
    other way (e.g. a direct-INSERT test) has current_session_id = NULL, and
    worker.py crashes at update_session(None). So after inserting we MUST point
    jobs.current_session_id at the new row — that link is the easy-to-miss part.
    """
    if job.get("current_session_id"):
        return job["current_session_id"]
    row = (
        db.table("job_sessions")
        .insert({"job_id": job["id"], "session_number": 1})
        .execute()
        .data[0]
    )
    db.table("jobs").update({"current_session_id": row["id"]}).eq("id", job["id"]).execute()
    return row["id"]


def _run_task(job_id: str, secrets: dict) -> str:
    env = [{"name": "JOB_ID", "value": job_id}] + [
        {"name": k, "value": v} for k, v in secrets.items()
    ]
    resp = ecs.run_task(
        cluster=ECS_CLUSTER,
        taskDefinition=TASK_DEFINITION,
        launchType="FARGATE",
        count=1,
        networkConfiguration={
            "awsvpcConfiguration": {"subnets": SUBNETS, "assignPublicIp": "ENABLED"}
        },
        overrides={"containerOverrides": [{"name": CONTAINER_NAME, "environment": env}]},
        startedBy=f"distributor-{job_id[:28]}",
    )
    if resp.get("failures") or not resp.get("tasks"):
        raise RuntimeError(f"RunTask failed: {resp.get('failures')}")
    return resp["tasks"][0]["taskArn"]


def handler(event, context):
    secrets = _load_secrets()
    db = create_client(secrets["SUPABASE_URL"], secrets["SUPABASE_SECRET_KEY"])

    pending = (
        db.table("jobs").select("id, current_session_id").eq("status", "pending").execute().data
    )
    spawned, skipped, errors = [], [], []

    for job in pending:
        try:
            session_id = _ensure_session(db, job)
            # Atomic claim: only one invocation can flip NULL -> CLAIMING, so even
            # overlapping ticks can never launch two tasks for the same session.
            claimed = (
                db.table("job_sessions")
                .update({"fargate_task_arn": CLAIMING})
                .eq("id", session_id)
                .is_("fargate_task_arn", "null")
                .execute()
                .data
            )
            if not claimed:
                skipped.append(job["id"])  # already launched (or being launched)
                continue
            try:
                arn = _run_task(job["id"], secrets)
            except Exception:
                # release the claim so the next tick can retry
                db.table("job_sessions").update({"fargate_task_arn": None}).eq("id", session_id).execute()
                raise
            db.table("job_sessions").update({"fargate_task_arn": arn}).eq("id", session_id).execute()
            spawned.append({"job_id": job["id"], "task_arn": arn})
            print(f"spawned Fargate task for job {job['id']}: {arn}", flush=True)
        except Exception as e:  # one bad job must not block the rest
            errors.append({"job_id": job["id"], "error": str(e)[:300]})
            print(f"error on job {job['id']}: {e}", flush=True)

    try:
        swept = _sweep(db)
    except Exception as e:  # the sweep must never block spawning
        swept = {"error": str(e)[:300]}
        print(f"sweep error: {e}", flush=True)

    summary = {"pending": len(pending), "spawned": spawned, "skipped": skipped,
               "errors": errors, "swept": swept}
    print(summary, flush=True)
    return summary


# ---------------------------------------------------------------------------
# Sweep pass: unfinished jobs whose worker can no longer finish them.
#
# worker.py marks its own failures (bad link, unreadable file, Whisper error).
# This catches what it can't report: the container was killed, ran out of
# memory, or never started. Every write is conditional on the job still being
# unfinished, so a job that just reached 'done' is never overwritten.
# Failed jobs are never charged — the worker only deducts credits on success.
# ---------------------------------------------------------------------------
UNFINISHED = ["pending", "downloading", "transcribe"]
MAX_RUNTIME_S = int(os.environ.get("MAX_TASK_RUNTIME_SECONDS", str(3 * 3600)))
STALE_CLAIM_S = 5 * 60
LEGACY_STUCK_S = 60 * 60
MSG_INTERRUPTED = "處理中斷，請重新送出。這次不會扣點。"
MSG_OOM = "檔案太大，處理時記憶體不足。請改用較短的影片，或分段上傳。這次不會扣點。"
MSG_TIMEOUT = "處理時間過長已停止，請改用較短的影片。這次不會扣點。"


def _age_s(ts: str) -> float:
    return (datetime.now(timezone.utc) - datetime.fromisoformat(ts.replace("Z", "+00:00"))).total_seconds()


def _fail(db, job_id: str, message: str) -> bool:
    rows = (
        db.table("jobs")
        .update({"status": "failed", "error_message": message,
                 "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", job_id)
        .in_("status", UNFINISHED)
        .execute()
        .data
    )
    if rows:
        print(f"marked job {job_id} failed: {message}", flush=True)
    return bool(rows)


def _stop_message(task: dict) -> str:
    reasons = " ".join(
        [task.get("stoppedReason") or ""]
        + [c.get("reason") or "" for c in task.get("containers", [])]
    )
    return MSG_OOM if "OutOfMemory" in reasons else MSG_INTERRUPTED


def _sweep(db) -> dict:
    jobs = (
        db.table("jobs").select("id, status, created_at, current_session_id")
        .in_("status", UNFINISHED).execute().data
    )
    if not jobs:
        return {"checked": 0}
    session_ids = [j["current_session_id"] for j in jobs if j.get("current_session_id")]
    arns = {}
    if session_ids:
        rows = (
            db.table("job_sessions").select("id, fargate_task_arn")
            .in_("id", session_ids).execute().data
        )
        arns = {r["id"]: r["fargate_task_arn"] for r in rows}

    failed, released, by_arn = [], [], {}
    for job in jobs:
        arn = arns.get(job.get("current_session_id"))
        if arn and arn.startswith("arn:"):
            by_arn[arn] = job
        elif arn == CLAIMING and _age_s(job["created_at"]) > STALE_CLAIM_S:
            # a distributor run died between claiming and RunTask: let the next tick retry
            db.table("job_sessions").update({"fargate_task_arn": None}).eq(
                "id", job["current_session_id"]).eq("fargate_task_arn", CLAIMING).execute()
            released.append(job["id"])
        elif not arn and job["status"] != "pending" and _age_s(job["created_at"]) > LEGACY_STUCK_S:
            # in progress with no task at all (e.g. left over from the old EC2 worker)
            if _fail(db, job["id"], MSG_INTERRUPTED):
                failed.append(job["id"])

    arn_list = list(by_arn)
    for i in range(0, len(arn_list), 100):  # DescribeTasks takes up to 100 ARNs
        batch = arn_list[i:i + 100]
        resp = ecs.describe_tasks(cluster=ECS_CLUSTER, tasks=batch)
        for miss in resp.get("failures", []):
            # ECS forgets stopped tasks after a while; gone + still unfinished = dead
            job = by_arn.get(miss.get("arn"))
            # (age guard: a task launched seconds ago may not be visible to DescribeTasks yet)
            if (job and miss.get("reason") == "MISSING" and _age_s(job["created_at"]) > STALE_CLAIM_S
                    and _fail(db, job["id"], MSG_INTERRUPTED)):
                failed.append(job["id"])
        for task in resp.get("tasks", []):
            job = by_arn.get(task["taskArn"])
            if not job:
                continue
            if task.get("lastStatus") == "STOPPED":
                if _fail(db, job["id"], _stop_message(task)):
                    failed.append(job["id"])
            elif task.get("startedAt") and (
                datetime.now(timezone.utc) - task["startedAt"]
            ).total_seconds() > MAX_RUNTIME_S:
                ecs.stop_task(cluster=ECS_CLUSTER, task=task["taskArn"], reason="exceeded max runtime")
                if _fail(db, job["id"], MSG_TIMEOUT):
                    failed.append(job["id"])

    return {"checked": len(jobs), "failed": failed, "released_claims": released}
