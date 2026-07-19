
CREATE OR REPLACE FUNCTION public.redeem_reward(_reward_id UUID, _shipping JSONB DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID := auth.uid();
  _cost INTEGER;
  _stock INTEGER;
  _active BOOLEAN;
  _kind TEXT;
  _months INTEGER;
  _balance INTEGER;
  _redemption_id UUID;
  _sub_id UUID;
  _sub_end TIMESTAMPTZ;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT points_cost, stock, active, kind, subscription_months
    INTO _cost, _stock, _active, _kind, _months
  FROM public.rewards WHERE id = _reward_id FOR UPDATE;

  IF _cost IS NULL THEN RAISE EXCEPTION 'reward_not_found'; END IF;
  IF NOT _active THEN RAISE EXCEPTION 'reward_inactive'; END IF;
  IF _stock <= 0 THEN RAISE EXCEPTION 'reward_out_of_stock'; END IF;

  IF _kind = 'device' THEN
    IF _shipping IS NULL
       OR COALESCE(_shipping->>'recipient','')=''
       OR COALESCE(_shipping->>'address','')=''
       OR COALESCE(_shipping->>'city','')=''
       OR COALESCE(_shipping->>'state','')=''
       OR COALESCE(_shipping->>'zip','')='' THEN
      RAISE EXCEPTION 'shipping_required';
    END IF;
  END IF;

  SELECT total_points INTO _balance FROM public.user_points WHERE user_id = _user FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  UPDATE public.user_points SET total_points = total_points - _cost WHERE user_id = _user;
  UPDATE public.rewards SET stock = stock - 1 WHERE id = _reward_id;

  INSERT INTO public.reward_redemptions (
    user_id, reward_id, points_spent, status,
    shipping_recipient, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_phone, shipping_notes
  ) VALUES (
    _user, _reward_id, _cost,
    CASE WHEN _kind='subscription' THEN 'fulfilled'::redemption_status ELSE 'pending'::redemption_status END,
    _shipping->>'recipient', _shipping->>'address', _shipping->>'city',
    _shipping->>'state', _shipping->>'zip', _shipping->>'phone', _shipping->>'notes'
  ) RETURNING id INTO _redemption_id;

  IF _kind = 'subscription' AND COALESCE(_months,0) > 0 THEN
    SELECT id, ends_at INTO _sub_id, _sub_end
    FROM public.subscriptions
    WHERE user_id = _user AND status = 'active'
    ORDER BY ends_at DESC NULLS LAST
    LIMIT 1;

    IF _sub_id IS NOT NULL THEN
      UPDATE public.subscriptions
      SET ends_at = GREATEST(COALESCE(_sub_end, now()), now()) + (_months || ' months')::interval
      WHERE id = _sub_id;
    END IF;
  END IF;

  RETURN _redemption_id;
END;
$$;
