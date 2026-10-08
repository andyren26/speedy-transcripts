-- 藍新金流 (NewebPay MPG) — NT$ credit purchases for Taiwan customers.
-- Stripe stays as the US$ path for overseas customers.
--
-- Flow: /api/credits/newebpay/checkout creates a 'pending' order, the browser
-- posts to NewebPay, and NewebPay's server-to-server NotifyURL calls
-- grant_newebpay_order(), which flips the order to 'paid' AND grants the
-- credits in one transaction. The browser ReturnURL calls the same function
-- as a fallback; whichever arrives second gets 'already_paid' (idempotent).

CREATE TABLE IF NOT EXISTS public.newebpay_orders (
  -- NewebPay MerchantOrderNo: letters, digits, underscore; max 30; unique per store
  merchant_order_no text PRIMARY KEY CHECK (merchant_order_no ~ '^[A-Za-z0-9_]{1,30}$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.credit_products(id),
  credits numeric NOT NULL CHECK (credits > 0),
  amount_twd integer NOT NULL CHECK (amount_twd > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  trade_no text,          -- NewebPay's own transaction number
  payment_type text,      -- e.g. CREDIT
  message text,           -- NewebPay's message on failure
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_newebpay_orders_user
  ON public.newebpay_orders (user_id, created_at DESC);

ALTER TABLE public.newebpay_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own newebpay orders" ON public.newebpay_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- No insert/update policies: only the server (Secret key) writes orders.

-- Ledger link + idempotency guard: one purchase row per NewebPay order, ever.
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS newebpay_order_no text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_tx_newebpay_order
  ON public.credit_transactions (newebpay_order_no) WHERE newebpay_order_no IS NOT NULL;

-- Returns: 'credited' | 'already_paid' | 'not_found' | 'amount_mismatch'
CREATE OR REPLACE FUNCTION public.grant_newebpay_order(
  p_order_no text,
  p_amount integer,
  p_trade_no text,
  p_payment_type text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.newebpay_orders%ROWTYPE;
BEGIN
  -- Row lock: a concurrent Notify + Return for the same order serialize here.
  SELECT * INTO o FROM public.newebpay_orders WHERE merchant_order_no = p_order_no FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF o.status = 'paid' THEN
    RETURN 'already_paid';
  END IF;
  -- The paid amount must be exactly what we asked for.
  IF o.amount_twd <> p_amount THEN
    UPDATE public.newebpay_orders
      SET message = format('amount mismatch: paid %s, expected %s', p_amount, o.amount_twd),
          updated_at = now()
      WHERE merchant_order_no = p_order_no;
    RETURN 'amount_mismatch';
  END IF;

  UPDATE public.newebpay_orders
    SET status = 'paid', trade_no = p_trade_no, payment_type = p_payment_type,
        message = NULL, paid_at = now(), updated_at = now()
    WHERE merchant_order_no = p_order_no;

  INSERT INTO public.credit_transactions (user_id, amount, type, description, newebpay_order_no)
    VALUES (o.user_id, o.credits, 'purchase',
            format('Purchased %s credits (NT$%s via NewebPay)', o.credits, o.amount_twd),
            o.merchant_order_no);

  UPDATE public.profiles SET credits_balance = credits_balance + o.credits WHERE id = o.user_id;

  RETURN 'credited';
END;
$$;

REVOKE ALL ON FUNCTION public.grant_newebpay_order(text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_newebpay_order(text, integer, text, text) TO service_role;
