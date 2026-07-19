ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS purchase_points INTEGER NOT NULL DEFAULT 0;

UPDATE public.plans SET purchase_points = CASE period
  WHEN 'monthly' THEN 20
  WHEN 'quarterly' THEN 70
  WHEN 'semiannual' THEN 150
  WHEN 'annual' THEN 350
  ELSE 0
END WHERE purchase_points = 0;