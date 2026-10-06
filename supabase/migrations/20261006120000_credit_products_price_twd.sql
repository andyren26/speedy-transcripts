-- Fixed NT$ price per credit pack (display). The Stripe price for the pack carries the
-- same amount as a `twd` currency_option, so Checkout charges Taiwan customers in NT$
-- and everyone else in the default USD price.
ALTER TABLE public.credit_products ADD COLUMN IF NOT EXISTS price_twd numeric;
