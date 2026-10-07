"""
M4 Lambda distributor — replaces M1's always-on distributor.py on the EC2.

Fired every minute by EventBridge. For each job with status='pending' it makes
sure the job has a linked job_sessions row, launches ONE Fargate task for it
(ecs:RunTask), and stamps the task ARN on job_sessions.fargate_task_arn. The ARN
is the idempotency key: a session that already has an ARN is never respawned,
so the stateless Lambda can run every minute without double-spawning.

Secrets are read from AWS Secrets Manager (same names as M1) and forwarded to
the Fargate task as env vars — they never live in the Lambda's own config.
Run with reserved concurrency = 1 so two ticks can never overlap.

M4 scope: spawn pass only. Stuck-job recovery and storage cleanup are v2.
"""
import os

import boto3
from supabase import create_client

ECS_CLUSTER = os.environ["ECS_CLUSTER"]
TASK_DEFINITION = os.environ["TASK_DEFINITION"]
SUBNETS = [s for s in os.environ["SUBNETS"].split(",") if s]
CONTAINER_NAME = os.environ.get("CONTAINER_NAME", "worker")

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
            session = (
                db.table("job_sessions")
                .select("fargate_task_arn")
                .eq("id", session_id)
                .single()
                .execute()
                .data
            )
            if session.get("fargate_task_arn"):
                skipped.append(job["id"])  # task already launched; it will claim the job
                continue
            arn = _run_task(job["id"], secrets)
            db.table("job_sessions").update({"fargate_task_arn": arn}).eq("id", session_id).execute()
            spawned.append({"job_id": job["id"], "task_arn": arn})
            print(f"spawned Fargate task for job {job['id']}: {arn}", flush=True)
        except Exception as e:  # one bad job must not block the rest
            errors.append({"job_id": job["id"], "error": str(e)[:300]})
            print(f"error on job {job['id']}: {e}", flush=True)

    summary = {"pending": len(pending), "spawned": spawned, "skipped": skipped, "errors": errors}
    print(summary, flush=True)
    return summary
