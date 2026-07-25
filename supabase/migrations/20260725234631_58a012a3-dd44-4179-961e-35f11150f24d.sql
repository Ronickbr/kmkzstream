ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'confirmed';

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_ref_key
  ON public.subscriptions (payment_ref) WHERE payment_ref IS NOT NULL;

UPDATE public.subscriptions SET payment_confirmed_at = COALESCE(payment_confirmed_at, created_at)
  WHERE payment_confirmed_at IS NULL;