-- Customer support tickets submitted from /support (signed-in members only).
-- Rows are inserted by POST /api/support with the Secret key; members can read their own.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  category text NOT NULL CHECK (category IN ('account', 'credits', 'transcription', 'other')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_created_idx
  ON public.support_tickets (user_id, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own support tickets" ON public.support_tickets;
CREATE POLICY "users read own support tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
