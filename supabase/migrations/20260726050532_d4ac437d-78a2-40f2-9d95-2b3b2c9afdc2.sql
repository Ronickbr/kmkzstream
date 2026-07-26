ALTER TYPE public.referral_status ADD VALUE IF NOT EXISTS 'canceled';

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS payment_id TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

DROP TRIGGER IF EXISTS trg_award_referral_signup ON public.referrals;
DROP FUNCTION IF EXISTS public.award_referral_signup();
UPDATE public.point_rules SET active = false, points = 0 WHERE id = 'referral_signup';