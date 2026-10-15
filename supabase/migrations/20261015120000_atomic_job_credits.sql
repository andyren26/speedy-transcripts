-- Atomic, race-free credit handling for transcription jobs.
--
-- Problem this fixes: the worker used to check the balance when a job STARTED and
-- deduct (read balance, then write balance) only when it FINISHED. Jobs run in
-- parallel (one Fargate task each), so a user with 30 credits could start many
-- 30-minute jobs at once, all pass the check, all get transcribed (we pay OpenAI +
-- Fargate for each), and the balance just clamped at 0.
--
-- New model:
--   1. claim_job_credits(): once the exact length is known, the worker RESERVES the
--      minutes on the job (jobs.reserved_minutes). The check and the reservation
--      happen under a row lock on the user's profile, and a user's available credits
--      are  balance - (minutes reserved by their other in-progress jobs).
--      Two jobs can therefore never both claim the same credits.
--   2. charge_job_credits(): on success, writes the ledger row and lowers the balance
--      in ONE transaction under the same lock, and releases the reservation.
--      It is idempotent (one charge per job).
-- A job that fails or is killed simply stops counting as "in progress", so its
-- reservation disappears on its own: nothing to refund.
--
-- RUN THIS BEFORE deploying the new worker image (the worker calls these functions).
-- Safe to re-run.

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS reserved_minutes integer;

-- At most one real (negative) deduction per job, ever.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_tx_job_charge
  ON public.credit_transactions (job_id)
  WHERE type = 'deduction' AND amount < 0;

-- Returns: 'ok' | 'insufficient' | 'not_found'
CREATE OR REPLACE FUNCTION public.claim_job_credits(p_job_id uuid, p_minutes integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_balance numeric;
  v_reserved numeric;
BEGIN
  IF p_minutes IS NULL OR p_minutes < 1 THEN
    RETURN 'insufficient';
  END IF;

  SELECT user_id INTO v_user FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Serialize every claim/charge for this user.
  SELECT credits_balance INTO v_balance FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'insufficient';
  END IF;

  SELECT COALESCE(SUM(reserved_minutes), 0) INTO v_reserved
    FROM public.jobs
    WHERE user_id = v_user
      AND id <> p_job_id
      AND status IN ('downloading', 'transcribe')
      AND reserved_minutes IS NOT NULL;

  IF v_balance - v_reserved < p_minutes THEN
    RETURN 'insufficient';
  END IF;

  UPDATE public.jobs SET reserved_minutes = p_minutes WHERE id = p_job_id;
  RETURN 'ok';
END;
$$;

-- Returns: 'charged' | 'already_charged' | 'not_found'
CREATE OR REPLACE FUNCTION public.charge_job_credits(p_job_id uuid, p_minutes integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_user FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE job_id = p_job_id AND type = 'deduction' AND amount < 0
  ) THEN
    RETURN 'already_charged';
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, description, job_id)
    VALUES (v_user, -p_minutes, 'deduction', format('Transcribed %s min video', p_minutes), p_job_id);

  UPDATE public.profiles
    SET credits_balance = GREATEST(0, credits_balance - p_minutes)
    WHERE id = v_user;

  UPDATE public.jobs SET reserved_minutes = NULL WHERE id = p_job_id;
  RETURN 'charged';
END;
$$;

-- Only the server (Secret key = service_role) may call these.
REVOKE ALL ON FUNCTION public.claim_job_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.charge_job_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_job_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.charge_job_credits(uuid, integer) TO service_role;
