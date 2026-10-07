-- M4: idempotency for the Lambda distributor. The stateless Lambda only spawns a
-- Fargate task for sessions WHERE fargate_task_arn IS NULL, then writes the ARN.
ALTER TABLE job_sessions ADD COLUMN IF NOT EXISTS fargate_task_arn TEXT;
CREATE INDEX IF NOT EXISTS idx_job_sessions_unspawned
  ON job_sessions (id) WHERE fargate_task_arn IS NULL;
