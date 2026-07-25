CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ref_code TEXT;
  referrer_uuid UUID;
  welcome_pts INTEGER;
  _cpf TEXT;
  _whats TEXT;
BEGIN
  _cpf := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf',''), '\D', '', 'g'), '');
  IF _cpf IS NOT NULL AND (length(_cpf) <> 11 OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.cpf = _cpf)) THEN
    _cpf := NULL;
  END IF;
  _whats := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'whatsapp',''), '\D', '', 'g'), '');

  INSERT INTO public.profiles (id, display_name, avatar_url, referral_code, cpf, whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    public.generate_referral_code(),
    _cpf,
    _whats
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  SELECT points INTO welcome_pts FROM public.point_rules WHERE id = 'signup_bonus' AND active;
  welcome_pts := COALESCE(welcome_pts, 0);
  INSERT INTO public.user_points (user_id, total_points) VALUES (NEW.id, welcome_pts);
  IF welcome_pts > 0 THEN
    INSERT INTO public.point_events (user_id, kind, points, description)
    VALUES (NEW.id, 'signup_bonus', welcome_pts, 'Bônus de boas-vindas');
  END IF;

  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NOT NULL AND ref_code <> '' THEN
    SELECT id INTO referrer_uuid FROM public.profiles WHERE upper(referral_code) = upper(trim(ref_code));
    IF referrer_uuid IS NOT NULL AND referrer_uuid <> NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_id, status)
      VALUES (referrer_uuid, NEW.id, 'pending')
      ON CONFLICT (referred_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;