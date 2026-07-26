--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: plan_period; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_period AS ENUM (
    'monthly',
    'quarterly',
    'semiannual',
    'annual'
);


--
-- Name: redemption_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.redemption_status AS ENUM (
    'pending',
    'delivered',
    'canceled'
);


--
-- Name: referral_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.referral_status AS ENUM (
    'pending',
    'confirmed'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'canceled',
    'expired'
);


--
-- Name: admin_analytics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_analytics() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _plan_dist jsonb;
  _top_users jsonb;
  _referral_funnel jsonb;
  _redemption_funnel jsonb;
  _daily_signups jsonb;
  _active_30d INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO _plan_dist FROM (
    SELECT p.name, p.period, COUNT(s.id)::int AS count
    FROM public.plans p
    LEFT JOIN public.subscriptions s ON s.plan_id = p.id AND s.status = 'active'
    GROUP BY p.id, p.name, p.period, p.sort_order
    ORDER BY p.sort_order
  ) t;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.total_points DESC) INTO _top_users FROM (
    SELECT p.display_name, up.total_points,
      (SELECT COUNT(*) FROM public.referrals r WHERE r.referrer_id = p.id AND r.status='confirmed')::int AS referrals
    FROM public.profiles p
    JOIN public.user_points up ON up.user_id = p.id
    ORDER BY up.total_points DESC
    LIMIT 10
  ) t;

  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM public.referrals)::int,
    'pending', (SELECT COUNT(*) FROM public.referrals WHERE status='pending')::int,
    'confirmed', (SELECT COUNT(*) FROM public.referrals WHERE status='confirmed')::int,
    'conversion_rate', CASE
      WHEN (SELECT COUNT(*) FROM public.referrals) = 0 THEN 0
      ELSE ROUND(100.0 * (SELECT COUNT(*) FROM public.referrals WHERE status='confirmed')
        / (SELECT COUNT(*) FROM public.referrals), 1)
    END
  ) INTO _referral_funnel;

  SELECT jsonb_build_object(
    'pending', (SELECT COUNT(*) FROM public.reward_redemptions WHERE status='pending')::int,
    'fulfilled', (SELECT COUNT(*) FROM public.reward_redemptions WHERE status='delivered')::int,
    'cancelled', (SELECT COUNT(*) FROM public.reward_redemptions WHERE status='canceled')::int,
    'points_spent', (SELECT COALESCE(SUM(points_spent),0) FROM public.reward_redemptions WHERE status IN ('delivered','pending'))::int
  ) INTO _redemption_funnel;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.day) INTO _daily_signups FROM (
    SELECT to_char(gs, 'YYYY-MM-DD') AS day,
      (SELECT COUNT(*) FROM public.profiles p WHERE p.created_at::date = gs::date)::int AS signups
    FROM generate_series((now() - INTERVAL '29 days')::date, now()::date, INTERVAL '1 day') gs
  ) t;

  SELECT COUNT(DISTINCT user_id)::int INTO _active_30d
    FROM public.point_events
    WHERE created_at >= now() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'plan_distribution', COALESCE(_plan_dist,'[]'::jsonb),
    'top_users', COALESCE(_top_users,'[]'::jsonb),
    'referral_funnel', _referral_funnel,
    'redemption_funnel', _redemption_funnel,
    'daily_signups', COALESCE(_daily_signups,'[]'::jsonb),
    'active_users_30d', _active_30d
  );
END;
$$;


--
-- Name: admin_get_settings(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_settings(_key text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT value INTO _v FROM public.app_settings WHERE key = _key;
  RETURN COALESCE(_v, '{}'::jsonb);
END; $$;


--
-- Name: admin_set_settings(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_settings(_key text, _value jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.app_settings (key, value) VALUES (_key, _value)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN _value;
END; $$;


--
-- Name: admin_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_stats() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_subscriptions', (SELECT count(*) FROM public.subscriptions WHERE status = 'active'),
    'total_revenue_cents', (SELECT COALESCE(sum(p.price_cents), 0) FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.status = 'active'),
    'confirmed_referrals', (SELECT count(*) FROM public.referrals WHERE status = 'confirmed'),
    'pending_redemptions', (SELECT count(*) FROM public.reward_redemptions WHERE status = 'pending')
  ) INTO result;
  RETURN result;
END;
$$;


--
-- Name: audit_app_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_app_settings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'settings_' || lower(TG_OP), 'app_settings', COALESCE(NEW.key, OLD.key),
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END; $$;


--
-- Name: audit_point_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_point_events() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, new_data, metadata)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'points_granted', 'point_events', NEW.id::text, NEW.user_id, to_jsonb(NEW),
          jsonb_build_object('points', NEW.points, 'kind', NEW.kind));
  RETURN NEW;
END; $$;


--
-- Name: audit_profiles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_profiles() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  IF to_jsonb(OLD) = to_jsonb(NEW) THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'profile_update', 'profiles', NEW.id::text, NEW.id,
          jsonb_build_object('display_name', OLD.display_name, 'whatsapp', OLD.whatsapp, 'cpf', OLD.cpf, 'referral_code', OLD.referral_code),
          jsonb_build_object('display_name', NEW.display_name, 'whatsapp', NEW.whatsapp, 'cpf', NEW.cpf, 'referral_code', NEW.referral_code));
  RETURN NEW;
END; $$;


--
-- Name: audit_reward_redemptions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_reward_redemptions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'redemption_' || lower(TG_OP), 'reward_redemptions', NEW.id::text, NEW.user_id,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END; $$;


--
-- Name: audit_subscriptions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_subscriptions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) = to_jsonb(NEW) THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          lower(TG_OP), 'subscriptions',
          COALESCE(NEW.id, OLD.id)::text,
          COALESCE(NEW.user_id, OLD.user_id),
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;


--
-- Name: audit_user_roles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_user_roles() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'role_' || lower(TG_OP), 'user_roles', COALESCE(NEW.id, OLD.id)::text,
          COALESCE(NEW.user_id, OLD.user_id),
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;


--
-- Name: award_purchase_points(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_purchase_points() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _pts INT; _prev_count INT;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  -- Only award purchase points on the user's FIRST subscription ever.
  -- Subsequent subscriptions are handled by award_renewal_points.
  SELECT count(*) INTO _prev_count FROM public.subscriptions s
    WHERE s.user_id = NEW.user_id AND s.id <> NEW.id;
  IF _prev_count > 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(purchase_points, 0) INTO _pts FROM public.plans WHERE id = NEW.plan_id;
  IF COALESCE(_pts, 0) <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.user_points (user_id, total_points)
    VALUES (NEW.user_id, _pts)
    ON CONFLICT (user_id) DO UPDATE SET total_points = public.user_points.total_points + EXCLUDED.total_points;

  INSERT INTO public.point_events (user_id, kind, points, description, metadata, expires_at)
    VALUES (NEW.user_id, 'purchase', _pts, 'Pontos por aquisição de plano',
            jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id),
            now() + interval '12 months');
  RETURN NEW;
END; $$;


--
-- Name: award_referral_signup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_referral_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _pts INT;
BEGIN
  SELECT points INTO _pts FROM public.point_rules WHERE id = 'referral_signup' AND active;
  IF COALESCE(_pts, 0) = 0 THEN RETURN NEW; END IF;
  UPDATE public.user_points SET total_points = total_points + _pts WHERE user_id = NEW.referrer_id;
  INSERT INTO public.point_events (user_id, kind, points, description, metadata)
    VALUES (NEW.referrer_id, 'referral_signup', _pts, 'Indicação cadastrada',
            jsonb_build_object('referral_id', NEW.id, 'referred_id', NEW.referred_id));
  RETURN NEW;
END; $$;


--
-- Name: award_renewal_points(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_renewal_points() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _period TEXT; _pts INT; _prev_count INT; _rule_id TEXT;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT period::text INTO _period FROM public.plans WHERE id = NEW.plan_id;
  IF _period = 'monthly' THEN _rule_id := 'renewal_monthly';
  ELSIF _period = 'annual' THEN _rule_id := 'renewal_annual';
  ELSE RETURN NEW; END IF;

  SELECT count(*) INTO _prev_count FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = NEW.user_id AND s.id <> NEW.id AND p.period::text = _period;
  IF _prev_count = 0 THEN RETURN NEW; END IF;

  SELECT points INTO _pts FROM public.point_rules WHERE id = _rule_id AND active;
  IF COALESCE(_pts, 0) = 0 THEN RETURN NEW; END IF;

  UPDATE public.user_points SET total_points = total_points + _pts WHERE user_id = NEW.user_id;
  INSERT INTO public.point_events (user_id, kind, points, description, metadata)
    VALUES (NEW.user_id, _rule_id, _pts, 'Bônus de renovação',
            jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id));
  RETURN NEW;
END; $$;


--
-- Name: check_and_award_achievements(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_award_achievements() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user UUID := auth.uid();
  _ach RECORD; _type TEXT; _val INT; _current INT;
  _inserted UUID;
  _newly JSONB := '[]'::jsonb;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR _ach IN
    SELECT a.* FROM public.achievements a
    WHERE a.active AND NOT EXISTS (
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id=_user AND ua.achievement_id=a.id
    )
    ORDER BY sort_order
  LOOP
    _type := _ach.criteria->>'type';
    _val := COALESCE((_ach.criteria->>'value')::int,1);
    _current := 0;

    IF _type = 'referrals_confirmed' THEN
      SELECT count(*) INTO _current FROM public.referrals WHERE referrer_id=_user AND status='confirmed';
    ELSIF _type = 'points_total' THEN
      SELECT COALESCE(total_points,0) INTO _current FROM public.user_points WHERE user_id=_user;
    ELSIF _type = 'share_count' THEN
      SELECT count(*) INTO _current FROM public.point_events WHERE user_id=_user AND kind='referral_signup';
    ELSIF _type = 'login_count' THEN
      SELECT 1 INTO _current;
    ELSIF _type = 'redemptions_count' THEN
      SELECT count(*) INTO _current FROM public.reward_redemptions WHERE user_id=_user;
    ELSIF _type = 'active_subscription' THEN
      SELECT CASE WHEN EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id=_user AND status='active') THEN 1 ELSE 0 END INTO _current;
    END IF;

    IF _current >= _val THEN
      -- Only proceed if we actually inserted (no prior award)
      INSERT INTO public.user_achievements (user_id, achievement_id)
        VALUES (_user, _ach.id)
        ON CONFLICT DO NOTHING
        RETURNING user_id INTO _inserted;

      IF _inserted IS NOT NULL THEN
        IF _ach.points_reward > 0 THEN
          -- Guarded by unique index on (user_id, achievement_id) where kind='achievement'
          INSERT INTO public.point_events (user_id, kind, points, description, metadata)
            VALUES (_user,'achievement', _ach.points_reward, 'Conquista: ' || _ach.name,
                    jsonb_build_object('achievement_id', _ach.id))
            ON CONFLICT DO NOTHING;
          UPDATE public.user_points SET total_points = total_points + _ach.points_reward WHERE user_id=_user;
        END IF;
        _newly := _newly || jsonb_build_object('id',_ach.id,'name',_ach.name,'icon',_ach.icon,'points',_ach.points_reward);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('unlocked', _newly);
END; $$;


--
-- Name: confirm_referral_on_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_referral_on_subscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE pts INTEGER; _referrer UUID;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT referral_points INTO pts FROM public.plans WHERE id = NEW.plan_id;
    pts := COALESCE(pts, 0);
    SELECT r.referrer_id INTO _referrer FROM public.referrals r
      WHERE r.referred_id = NEW.user_id AND r.status = 'pending' LIMIT 1;
    UPDATE public.referrals r
    SET status = 'confirmed', points_awarded = pts, confirmed_at = now()
    WHERE r.referred_id = NEW.user_id AND r.status = 'pending';
    IF _referrer IS NOT NULL AND pts > 0 THEN
      UPDATE public.user_points SET total_points = total_points + pts WHERE user_id = _referrer;
      INSERT INTO public.point_events (user_id, kind, points, description, metadata)
      VALUES (_referrer, 'referral_confirmed', pts, 'Indicação confirmada',
              jsonb_build_object('referred_id', NEW.user_id, 'plan_id', NEW.plan_id));
    END IF;
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: expire_old_points(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_old_points() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r RECORD; _total INT := 0; _cur INT;
BEGIN
  FOR r IN
    SELECT user_id, SUM(points)::int AS pts
    FROM public.point_events
    WHERE points > 0 AND expired = false AND expires_at <= now()
    GROUP BY user_id
  LOOP
    SELECT total_points INTO _cur FROM public.user_points WHERE user_id = r.user_id FOR UPDATE;
    IF _cur IS NULL THEN CONTINUE; END IF;
    UPDATE public.user_points SET total_points = GREATEST(0, _cur - r.pts) WHERE user_id = r.user_id;
    INSERT INTO public.point_events (user_id, kind, points, description, metadata, expires_at, expired)
      VALUES (r.user_id, 'expired', -r.pts, 'Pontos expirados (12 meses)',
              jsonb_build_object('expired_count', r.pts), NULL, true);
    _total := _total + r.pts;
  END LOOP;
  UPDATE public.point_events SET expired = true
    WHERE points > 0 AND expired = false AND expires_at <= now();
  RETURN _total;
END; $$;


--
-- Name: expiring_subscriptions(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expiring_subscriptions(_days integer DEFAULT NULL::integer) RETURNS TABLE(subscription_id uuid, user_id uuid, display_name text, whatsapp text, plan_name text, ends_at timestamp with time zone, days_left integer, reminder_sent_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _d INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(_days, (value->>'days_before')::int, 7) INTO _d
    FROM public.app_settings WHERE key = 'whatsapp_reminders';
  _d := COALESCE(_d, 7);
  RETURN QUERY
    SELECT s.id, s.user_id, p.display_name, COALESCE(p.whatsapp, p.phone),
           pl.name, s.ends_at,
           GREATEST(0, EXTRACT(DAY FROM (s.ends_at - now()))::int),
           s.reminder_sent_at
    FROM public.subscriptions s
    JOIN public.profiles p ON p.id = s.user_id
    JOIN public.plans pl ON pl.id = s.plan_id
    WHERE s.status = 'active'
      AND s.ends_at > now()
      AND s.ends_at <= now() + (_d || ' days')::interval
    ORDER BY s.ends_at ASC;
END; $$;


--
-- Name: generate_referral_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_referral_code() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'REF-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;


--
-- Name: get_checkout_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_checkout_settings() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'br_provider', COALESCE(value->>'br_provider','infinitepay'),
    'intl_provider', COALESCE(value->>'intl_provider','stripe'),
    'infinitepay', jsonb_build_object(
      'enabled', COALESCE((value->'infinitepay'->>'enabled')::boolean, false),
      'handle', COALESCE(value->'infinitepay'->>'handle',''),
      'redirect_url', COALESCE(value->'infinitepay'->>'redirect_url','')
    ),
    'stripe', jsonb_build_object(
      'enabled', COALESCE((value->'stripe'->>'enabled')::boolean, false),
      'payment_links', COALESCE(value->'stripe'->'payment_links', '{}'::jsonb)
    )
  )
  FROM public.app_settings WHERE key = 'payments'
$$;


--
-- Name: get_my_referrals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_referrals() RETURNS TABLE(id uuid, status public.referral_status, points_awarded integer, confirmed_at timestamp with time zone, created_at timestamp with time zone, referred_display_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT r.id, r.status, r.points_awarded, r.confirmed_at, r.created_at,
         p.display_name AS referred_display_name
  FROM public.referrals r
  LEFT JOIN public.profiles p ON p.id = r.referred_id
  WHERE r.referrer_id = auth.uid()
  ORDER BY r.created_at DESC
$$;


--
-- Name: growth_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.growth_metrics() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _months jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.month) INTO _months FROM (
    SELECT
      to_char(gs, 'YYYY-MM') AS month,
      (SELECT COUNT(*) FROM public.profiles p
        WHERE date_trunc('month', p.created_at) = gs) AS new_users,
      (SELECT COUNT(*) FROM public.subscriptions s
        WHERE date_trunc('month', s.starts_at) = gs) AS new_subscriptions,
      (SELECT COALESCE(SUM(pl.price_cents),0) FROM public.subscriptions s
        JOIN public.plans pl ON pl.id = s.plan_id
        WHERE date_trunc('month', s.starts_at) = gs) AS revenue_cents
    FROM generate_series(
      date_trunc('month', now()) - INTERVAL '5 months',
      date_trunc('month', now()),
      INTERVAL '1 month'
    ) gs
  ) t;
  RETURN jsonb_build_object(
    'months', COALESCE(_months, '[]'::jsonb),
    'mrr_cents', (SELECT COALESCE(SUM(pl.price_cents),0)
                    FROM public.subscriptions s JOIN public.plans pl ON pl.id = s.plan_id
                    WHERE s.status = 'active'),
    'total_points_outstanding', (SELECT COALESCE(SUM(total_points),0) FROM public.user_points),
    'total_points_awarded', (SELECT COALESCE(SUM(points),0) FROM public.point_events WHERE points > 0)
  );
END; $$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: leaderboard(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leaderboard(_period text DEFAULT 'month'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _since TIMESTAMPTZ;
  _rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _period = 'week' THEN
    _since := date_trunc('week', now());
  ELSIF _period = 'all' THEN
    _since := 'epoch'::timestamptz;
  ELSE
    _since := date_trunc('month', now());
  END IF;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.points DESC) INTO _rows
  FROM (
    SELECT
      pe.user_id,
      p.display_name,
      SUM(pe.points)::int AS points
    FROM public.point_events pe
    JOIN public.profiles p ON p.id = pe.user_id
    WHERE pe.created_at >= _since AND pe.points > 0
    GROUP BY pe.user_id, p.display_name
    ORDER BY points DESC
    LIMIT 20
  ) t;

  RETURN COALESCE(_rows, '[]'::jsonb);
END;
$$;


--
-- Name: mark_all_notifications_read(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_all_notifications_read() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user UUID := auth.uid();
  _count INTEGER;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.notifications SET read_at = now()
    WHERE user_id = _user AND read_at IS NULL;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END; $$;


--
-- Name: mark_reminder_sent(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_reminder_sent(_subscription_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.subscriptions SET reminder_sent_at = now() WHERE id = _subscription_id;
  RETURN FOUND;
END; $$;


--
-- Name: notify_achievement_unlocked(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_achievement_unlocked() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _name TEXT; _pts INTEGER; _icon TEXT;
BEGIN
  SELECT name, points_reward, icon INTO _name, _pts, _icon
  FROM public.achievements WHERE id = NEW.achievement_id;
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.user_id,
    'achievement',
    '🏆 Nova conquista: ' || COALESCE(_name, 'desbloqueada'),
    CASE WHEN COALESCE(_pts,0) > 0
      THEN 'Você ganhou ' || _pts || ' pontos!'
      ELSE 'Continue assim para desbloquear mais recompensas.'
    END,
    '/conquistas',
    jsonb_build_object('achievement_id', NEW.achievement_id, 'icon', _icon, 'points', _pts)
  );
  RETURN NEW;
END; $$;


--
-- Name: notify_redemption_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_redemption_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _reward_name TEXT;
BEGIN
  SELECT name INTO _reward_name FROM public.rewards WHERE id = NEW.reward_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id, 'reward',
      'Resgate solicitado 🎁',
      COALESCE(_reward_name,'Prêmio') || ' — seu resgate foi registrado.',
      '/premios',
      jsonb_build_object('redemption_id', NEW.id, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id, 'reward',
      CASE NEW.status::text
        WHEN 'fulfilled' THEN 'Prêmio entregue ✅'
        WHEN 'cancelled' THEN 'Resgate cancelado'
        ELSE 'Atualização de resgate'
      END,
      COALESCE(_reward_name,'Prêmio') || ' — status: ' || NEW.status::text,
      '/premios',
      jsonb_build_object('redemption_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: notify_referral_confirmed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_referral_confirmed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.referrer_id,
      'referral',
      'Indicação confirmada! 🎉',
      'Você ganhou ' || COALESCE(NEW.points_awarded, 0) || ' pontos por uma nova indicação.',
      '/indicacoes',
      jsonb_build_object('referral_id', NEW.id, 'points', NEW.points_awarded)
    );
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: notify_subscription_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_subscription_active() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _plan TEXT;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT name INTO _plan FROM public.plans WHERE id = NEW.plan_id;
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id, 'success',
      'Assinatura ativa! 🚀',
      'Seu plano ' || COALESCE(_plan,'') || ' está ativo. Aproveite!',
      '/dashboard',
      jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id)
    );
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: notify_welcome(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_welcome() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.id, 'info',
    'Bem-vindo à KMKZ IPTV! 👋',
    'Explore seu painel, compartilhe seu link de indicação e comece a acumular pontos.',
    '/dashboard'
  );
  RETURN NEW;
END; $$;


--
-- Name: prevent_subscription_farming(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_subscription_farming() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _existing INT;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT count(*) INTO _existing
    FROM public.subscriptions
    WHERE user_id = NEW.user_id
      AND id <> NEW.id
      AND ends_at IS NOT NULL
      AND ends_at > now();
    IF _existing > 0 THEN
      RAISE EXCEPTION 'active_period_not_ended'
        USING HINT = 'Você já possui um período pago em vigor. Aguarde o término antes de contratar novamente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_notification_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_notification_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.id := OLD.id;
    NEW.user_id := OLD.user_id;
    NEW.type := OLD.type;
    NEW.title := OLD.title;
    NEW.body := OLD.body;
    NEW.link := OLD.link;
    NEW.metadata := OLD.metadata;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: protect_profile_immutable_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_profile_immutable_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- service_role / postgres (servidor) podem ajustar; usuários autenticados não.
  IF current_setting('role', true) = 'authenticated' OR auth.uid() IS NOT NULL THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.id := OLD.id;
      NEW.referral_code := OLD.referral_code;
      IF OLD.cpf IS NOT NULL THEN
        NEW.cpf := OLD.cpf;
      END IF;
      NEW.created_at := OLD.created_at;
    END IF;
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: redeem_reward(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_reward(_reward_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user UUID := auth.uid();
  _cost INTEGER;
  _stock INTEGER;
  _active BOOLEAN;
  _balance INTEGER;
  _redemption_id UUID;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT points_cost, stock, active INTO _cost, _stock, _active
  FROM public.rewards WHERE id = _reward_id FOR UPDATE;

  IF _cost IS NULL THEN RAISE EXCEPTION 'reward_not_found'; END IF;
  IF NOT _active THEN RAISE EXCEPTION 'reward_inactive'; END IF;
  IF _stock <= 0 THEN RAISE EXCEPTION 'reward_out_of_stock'; END IF;

  SELECT total_points INTO _balance FROM public.user_points WHERE user_id = _user FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  UPDATE public.user_points SET total_points = total_points - _cost WHERE user_id = _user;
  UPDATE public.rewards SET stock = stock - 1 WHERE id = _reward_id;

  INSERT INTO public.reward_redemptions (user_id, reward_id, points_spent, status)
  VALUES (_user, _reward_id, _cost, 'pending')
  RETURNING id INTO _redemption_id;

  RETURN _redemption_id;
END;
$$;


--
-- Name: redeem_reward(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_reward(_reward_id uuid, _shipping jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user UUID := auth.uid();
  _cost INTEGER; _stock INTEGER; _active BOOLEAN;
  _kind TEXT; _months INTEGER; _balance INTEGER; _name TEXT;
  _redemption_id UUID; _sub_id UUID; _sub_end TIMESTAMPTZ;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT points_cost, stock, active, kind, subscription_months, name
    INTO _cost, _stock, _active, _kind, _months, _name
  FROM public.rewards WHERE id = _reward_id FOR UPDATE;
  IF _cost IS NULL THEN RAISE EXCEPTION 'reward_not_found'; END IF;
  IF NOT _active THEN RAISE EXCEPTION 'reward_inactive'; END IF;
  IF _stock <= 0 THEN RAISE EXCEPTION 'reward_out_of_stock'; END IF;
  IF _kind = 'device' THEN
    IF _shipping IS NULL OR COALESCE(_shipping->>'recipient','')=''
       OR COALESCE(_shipping->>'address','')='' OR COALESCE(_shipping->>'city','')=''
       OR COALESCE(_shipping->>'state','')='' OR COALESCE(_shipping->>'zip','')='' THEN
      RAISE EXCEPTION 'shipping_required';
    END IF;
  END IF;
  SELECT total_points INTO _balance FROM public.user_points WHERE user_id = _user FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN RAISE EXCEPTION 'insufficient_points'; END IF;
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
  INSERT INTO public.point_events (user_id, kind, points, description, metadata)
  VALUES (_user, 'reward_redeemed', -_cost, 'Resgate: ' || _name,
          jsonb_build_object('reward_id', _reward_id, 'redemption_id', _redemption_id));
  IF _kind = 'subscription' AND COALESCE(_months,0) > 0 THEN
    SELECT id, ends_at INTO _sub_id, _sub_end
    FROM public.subscriptions WHERE user_id = _user AND status = 'active'
    ORDER BY ends_at DESC NULLS LAST LIMIT 1;
    IF _sub_id IS NOT NULL THEN
      UPDATE public.subscriptions
      SET ends_at = GREATEST(COALESCE(_sub_end, now()), now()) + (_months || ' months')::interval
      WHERE id = _sub_id;
    END IF;
  END IF;
  RETURN _redemption_id;
END; $$;


--
-- Name: referral_code_exists(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.referral_code_exists(_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE upper(referral_code) = upper(trim(_code))
  );
$$;


--
-- Name: reverse_referral_on_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverse_referral_on_subscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _ref RECORD;
BEGIN
  IF NEW.status IN ('cancelled','refunded') AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO _ref FROM public.referrals
      WHERE referred_id = NEW.user_id AND status = 'confirmed' LIMIT 1;
    IF FOUND AND COALESCE(_ref.points_awarded, 0) > 0 THEN
      UPDATE public.user_points
        SET total_points = GREATEST(0, total_points - _ref.points_awarded)
        WHERE user_id = _ref.referrer_id;
      INSERT INTO public.point_events (user_id, kind, points, description, metadata)
        VALUES (_ref.referrer_id, 'refund_reversal', -_ref.points_awarded,
                'Estorno de indicação (assinatura cancelada)',
                jsonb_build_object('referral_id', _ref.id, 'subscription_id', NEW.id));
      UPDATE public.referrals SET status = 'cancelled' WHERE id = _ref.id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: run_expiry_reminders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_expiry_reminders() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _cfg jsonb; _d INT; _r RECORD; _count INT := 0;
BEGIN
  SELECT value INTO _cfg FROM public.app_settings WHERE key = 'whatsapp_reminders';
  IF COALESCE((_cfg->>'enabled')::boolean, false) IS NOT TRUE THEN RETURN 0; END IF;
  _d := COALESCE((_cfg->>'days_before')::int, 7);

  FOR _r IN
    SELECT s.id, s.user_id, s.ends_at, pl.name AS plan_name,
           GREATEST(0, EXTRACT(DAY FROM (s.ends_at - now()))::int) AS days_left
    FROM public.subscriptions s
    JOIN public.plans pl ON pl.id = s.plan_id
    WHERE s.status = 'active'
      AND s.ends_at > now()
      AND s.ends_at <= now() + (_d || ' days')::interval
      AND (s.reminder_sent_at IS NULL OR s.reminder_sent_at < now() - INTERVAL '3 days')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (_r.user_id, 'warning',
      'Sua assinatura está vencendo ⏳',
      'O plano ' || _r.plan_name || ' vence em ' || _r.days_left || ' dia(s). Renove para continuar no ar.',
      '/planos',
      jsonb_build_object('subscription_id', _r.id, 'ends_at', _r.ends_at));
    UPDATE public.subscriptions SET reminder_sent_at = now() WHERE id = _r.id;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END; $$;


--
-- Name: set_point_event_expiry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_point_event_expiry() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.points > 0 AND NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.created_at, now()) + INTERVAL '12 months';
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: write_audit_log(text, text, text, uuid, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.write_audit_log(_action text, _entity text, _entity_id text, _target_user_id uuid, _old jsonb, _new jsonb, _metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _id UUID; _actor UUID := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id,
                                 target_user_id, old_data, new_data, metadata)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor, 'admin') END,
          _action, _entity, _entity_id, _target_user_id, _old, _new, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    icon text DEFAULT 'trophy'::text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    points_reward integer DEFAULT 0 NOT NULL,
    criteria jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_is_admin boolean DEFAULT false NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id text,
    target_user_id uuid,
    old_data jsonb,
    new_data jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    metadata jsonb DEFAULT '{}'::jsonb,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_key text NOT NULL,
    event_id text,
    payment_ref text NOT NULL,
    provider text,
    status text NOT NULL,
    body_hash text NOT NULL,
    result text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    period public.plan_period NOT NULL,
    price_cents integer NOT NULL,
    duration_days integer NOT NULL,
    referral_points integer DEFAULT 0 NOT NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    screen_limit integer DEFAULT 1 NOT NULL,
    quality text DEFAULT 'HD'::text NOT NULL,
    is_popular boolean DEFAULT false NOT NULL,
    purchase_points integer DEFAULT 0 NOT NULL
);


--
-- Name: point_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    points integer NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    expired boolean DEFAULT false NOT NULL
);


--
-- Name: point_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_rules (
    id text NOT NULL,
    name text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    daily_limit integer,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name text,
    avatar_url text,
    referral_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    whatsapp text,
    phone text,
    bio text,
    city text,
    state text,
    onboarded_at timestamp with time zone,
    cpf text
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    referred_id uuid NOT NULL,
    status public.referral_status DEFAULT 'pending'::public.referral_status NOT NULL,
    points_awarded integer DEFAULT 0 NOT NULL,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referrals_check CHECK ((referrer_id <> referred_id)),
    CONSTRAINT referrals_no_self CHECK ((referrer_id <> referred_id))
);


--
-- Name: reward_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reward_id uuid NOT NULL,
    points_spent integer NOT NULL,
    status public.redemption_status DEFAULT 'pending'::public.redemption_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shipping_recipient text,
    shipping_address text,
    shipping_city text,
    shipping_state text,
    shipping_zip text,
    shipping_phone text,
    shipping_notes text,
    tracking_code text
);


--
-- Name: rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    points_cost integer NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'device'::text NOT NULL,
    subscription_months integer,
    CONSTRAINT rewards_kind_check CHECK ((kind = ANY (ARRAY['subscription'::text, 'device'::text]))),
    CONSTRAINT rewards_points_cost_check CHECK ((points_cost > 0)),
    CONSTRAINT rewards_stock_check CHECK ((stock >= 0))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_provider text,
    payment_ref text,
    reminder_sent_at timestamp with time zone,
    payment_confirmed_at timestamp with time zone,
    payment_status text DEFAULT 'confirmed'::text NOT NULL
);

ALTER TABLE ONLY public.subscriptions REPLICA IDENTITY FULL;


--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    achievement_id text NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_points (
    user_id uuid NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    last_login_date date,
    CONSTRAINT user_points_total_points_check CHECK ((total_points >= 0))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_event_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_event_key_key UNIQUE (event_key);


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: plans plans_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_period_key UNIQUE (period);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: point_events point_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_events
    ADD CONSTRAINT point_events_pkey PRIMARY KEY (id);


--
-- Name: point_rules point_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_rules
    ADD CONSTRAINT point_rules_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referred_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_key UNIQUE (referred_id);


--
-- Name: reward_redemptions reward_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_pkey PRIMARY KEY (id);


--
-- Name: rewards rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards
    ADD CONSTRAINT rewards_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_user_id_achievement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id);


--
-- Name: user_points user_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_pkey PRIMARY KEY (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_audit_logs_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_id, created_at DESC);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity, entity_id);


--
-- Name: idx_audit_logs_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_target ON public.audit_logs USING btree (target_user_id, created_at DESC);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id) WHERE (read_at IS NULL);


--
-- Name: idx_payment_webhook_events_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_webhook_events_ref ON public.payment_webhook_events USING btree (payment_ref, created_at DESC);


--
-- Name: idx_point_events_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_point_events_expiry ON public.point_events USING btree (expires_at) WHERE ((points > 0) AND (expired = false));


--
-- Name: notifications_user_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);


--
-- Name: point_events_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_events_expiry_idx ON public.point_events USING btree (expires_at) WHERE (expired = false);


--
-- Name: point_events_unique_achievement; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX point_events_unique_achievement ON public.point_events USING btree (user_id, ((metadata ->> 'achievement_id'::text))) WHERE (kind = 'achievement'::text);


--
-- Name: point_events_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_events_user_created ON public.point_events USING btree (user_id, created_at DESC);


--
-- Name: point_events_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_events_user_created_idx ON public.point_events USING btree (user_id, created_at DESC);


--
-- Name: point_events_user_kind_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_events_user_kind_created ON public.point_events USING btree (user_id, kind, created_at DESC);


--
-- Name: profiles_cpf_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_cpf_unique ON public.profiles USING btree (cpf) WHERE (cpf IS NOT NULL);


--
-- Name: referrals_referred_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referrals_referred_id_idx ON public.referrals USING btree (referred_id);


--
-- Name: referrals_referrer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referrals_referrer_id_idx ON public.referrals USING btree (referrer_id);


--
-- Name: referrals_referrer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referrals_referrer_idx ON public.referrals USING btree (referrer_id);


--
-- Name: reward_redemptions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reward_redemptions_status_idx ON public.reward_redemptions USING btree (status);


--
-- Name: reward_redemptions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reward_redemptions_user_idx ON public.reward_redemptions USING btree (user_id);


--
-- Name: subscriptions_payment_ref_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscriptions_payment_ref_key ON public.subscriptions USING btree (payment_ref) WHERE (payment_ref IS NOT NULL);


--
-- Name: subscriptions_status_ends_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_status_ends_idx ON public.subscriptions USING btree (status, ends_at);


--
-- Name: subscriptions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_user_id_idx ON public.subscriptions USING btree (user_id);


--
-- Name: user_achievements_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_achievements_user_idx ON public.user_achievements USING btree (user_id);


--
-- Name: user_roles_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_roles_user_idx ON public.user_roles USING btree (user_id);


--
-- Name: app_settings app_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions on_subscription_created_confirm_referral; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_subscription_created_confirm_referral AFTER INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.confirm_referral_on_subscription();


--
-- Name: plans plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: point_rules point_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER point_rules_updated_at BEFORE UPDATE ON public.point_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: referrals referrals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER referrals_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reward_redemptions reward_redemptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reward_redemptions_updated_at BEFORE UPDATE ON public.reward_redemptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: rewards rewards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rewards_updated_at BEFORE UPDATE ON public.rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: app_settings trg_audit_app_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_app_settings AFTER INSERT OR UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.audit_app_settings();


--
-- Name: point_events trg_audit_point_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_point_events AFTER INSERT ON public.point_events FOR EACH ROW EXECUTE FUNCTION public.audit_point_events();


--
-- Name: profiles trg_audit_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_profiles AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_profiles();


--
-- Name: reward_redemptions trg_audit_reward_redemptions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_reward_redemptions AFTER INSERT OR UPDATE ON public.reward_redemptions FOR EACH ROW EXECUTE FUNCTION public.audit_reward_redemptions();


--
-- Name: subscriptions trg_audit_subscriptions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_subscriptions AFTER INSERT OR DELETE OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.audit_subscriptions();


--
-- Name: user_roles trg_audit_user_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles();


--
-- Name: subscriptions trg_award_purchase_points; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_purchase_points AFTER INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.award_purchase_points();


--
-- Name: referrals trg_award_referral_signup; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_referral_signup AFTER INSERT ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.award_referral_signup();


--
-- Name: subscriptions trg_award_renewal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_renewal AFTER INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.award_renewal_points();


--
-- Name: user_achievements trg_notify_achievement_unlocked; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_achievement_unlocked AFTER INSERT ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.notify_achievement_unlocked();


--
-- Name: reward_redemptions trg_notify_redemption_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_redemption_insert AFTER INSERT ON public.reward_redemptions FOR EACH ROW EXECUTE FUNCTION public.notify_redemption_status();


--
-- Name: reward_redemptions trg_notify_redemption_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_redemption_update AFTER UPDATE ON public.reward_redemptions FOR EACH ROW EXECUTE FUNCTION public.notify_redemption_status();


--
-- Name: referrals trg_notify_referral_confirmed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_referral_confirmed AFTER UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.notify_referral_confirmed();


--
-- Name: subscriptions trg_notify_subscription_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_subscription_insert AFTER INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_active();


--
-- Name: subscriptions trg_notify_subscription_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_subscription_update AFTER UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_active();


--
-- Name: profiles trg_notify_welcome; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_welcome AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_welcome();


--
-- Name: point_events trg_point_event_expiry; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_point_event_expiry BEFORE INSERT ON public.point_events FOR EACH ROW EXECUTE FUNCTION public.set_point_event_expiry();


--
-- Name: subscriptions trg_prevent_subscription_farming; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_subscription_farming BEFORE INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.prevent_subscription_farming();


--
-- Name: notifications trg_protect_notification_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_notification_fields BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.protect_notification_fields();


--
-- Name: profiles trg_protect_profile_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_profile_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_immutable_fields();


--
-- Name: subscriptions trg_reverse_referral; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reverse_referral AFTER UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.reverse_referral_on_subscription();


--
-- Name: user_points user_points_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_points_updated_at BEFORE UPDATE ON public.user_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: point_events point_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_events
    ADD CONSTRAINT point_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referred_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reward_redemptions reward_redemptions_reward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.rewards(id);


--
-- Name: reward_redemptions reward_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_redemptions
    ADD CONSTRAINT reward_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_points user_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs Admins can read audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: payment_webhook_events Admins can read webhook events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read webhook events" ON public.payment_webhook_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plans Admins can view all plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all plans" ON public.plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: rewards Admins can view all rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all rewards" ON public.rewards FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plans Admins manage plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage plans" ON public.plans TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: rewards Admins manage rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage rewards" ON public.rewards TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage subscriptions" ON public.subscriptions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: app_settings Admins read settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read settings" ON public.app_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reward_redemptions Admins update redemptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update redemptions" ON public.reward_redemptions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: app_settings Admins write settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins write settings" ON public.app_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: notifications Deny direct notification inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny direct notification inserts" ON public.notifications FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: point_events No direct deletes on point_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct deletes on point_events" ON public.point_events FOR DELETE TO authenticated, anon USING (false);


--
-- Name: reward_redemptions No direct deletes on reward_redemptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct deletes on reward_redemptions" ON public.reward_redemptions FOR DELETE TO authenticated, anon USING (false);


--
-- Name: user_achievements No direct deletes on user_achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct deletes on user_achievements" ON public.user_achievements FOR DELETE TO authenticated, anon USING (false);


--
-- Name: user_points No direct deletes on user_points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct deletes on user_points" ON public.user_points FOR DELETE TO authenticated, anon USING (false);


--
-- Name: point_events No direct inserts on point_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct inserts on point_events" ON public.point_events FOR INSERT TO authenticated, anon WITH CHECK (false);


--
-- Name: reward_redemptions No direct inserts on reward_redemptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct inserts on reward_redemptions" ON public.reward_redemptions FOR INSERT TO authenticated, anon WITH CHECK (false);


--
-- Name: user_achievements No direct inserts on user_achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct inserts on user_achievements" ON public.user_achievements FOR INSERT TO authenticated, anon WITH CHECK (false);


--
-- Name: user_points No direct inserts on user_points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct inserts on user_points" ON public.user_points FOR INSERT TO authenticated, anon WITH CHECK (false);


--
-- Name: subscriptions No direct subscription deletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct subscription deletes" ON public.subscriptions FOR DELETE TO authenticated, anon USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions No direct subscription inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct subscription inserts" ON public.subscriptions FOR INSERT TO authenticated, anon WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: point_events No direct updates on point_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct updates on point_events" ON public.point_events FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: reward_redemptions No direct updates on reward_redemptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct updates on reward_redemptions" ON public.reward_redemptions FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: user_achievements No direct updates on user_achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct updates on user_achievements" ON public.user_achievements FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: user_points No direct updates on user_points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct updates on user_points" ON public.user_points FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: plans Public can view active plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active plans" ON public.plans FOR SELECT TO authenticated, anon USING ((active = true));


--
-- Name: rewards Public can view active rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active rewards" ON public.rewards FOR SELECT TO authenticated, anon USING ((active = true));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: notifications Users delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: notifications Users read own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users see own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: notifications Users update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: user_points Users view own points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own points" ON public.user_points FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: reward_redemptions Users view own redemptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own redemptions" ON public.reward_redemptions FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: referrals Users view own referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT TO authenticated USING (((auth.uid() = referrer_id) OR (auth.uid() = referred_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: subscriptions Users view own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: achievements achievements_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY achievements_admin ON public.achievements TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: achievements achievements_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY achievements_read ON public.achievements FOR SELECT TO authenticated USING (active);


--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: point_events events_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_admin_read ON public.point_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: point_events events_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_own_read ON public.point_events FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: user_achievements own_achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_achievements ON public.user_achievements FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: payment_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: point_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;

--
-- Name: point_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: point_rules rules_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rules_admin_write ON public.point_rules TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: point_rules rules_read_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rules_read_admin ON public.point_rules FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO sandbox_exec;


--
-- Name: FUNCTION admin_analytics(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_analytics() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_analytics() TO service_role;
GRANT ALL ON FUNCTION public.admin_analytics() TO sandbox_exec;
GRANT ALL ON FUNCTION public.admin_analytics() TO authenticated;


--
-- Name: FUNCTION admin_get_settings(_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_get_settings(_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_get_settings(_key text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_get_settings(_key text) TO service_role;
GRANT ALL ON FUNCTION public.admin_get_settings(_key text) TO sandbox_exec;


--
-- Name: FUNCTION admin_set_settings(_key text, _value jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_settings(_key text, _value jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_settings(_key text, _value jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_settings(_key text, _value jsonb) TO service_role;
GRANT ALL ON FUNCTION public.admin_set_settings(_key text, _value jsonb) TO sandbox_exec;


--
-- Name: FUNCTION admin_stats(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_stats() TO service_role;
GRANT ALL ON FUNCTION public.admin_stats() TO sandbox_exec;
GRANT ALL ON FUNCTION public.admin_stats() TO authenticated;


--
-- Name: FUNCTION audit_app_settings(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_app_settings() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_app_settings() TO service_role;
GRANT ALL ON FUNCTION public.audit_app_settings() TO sandbox_exec;


--
-- Name: FUNCTION audit_point_events(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_point_events() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_point_events() TO service_role;
GRANT ALL ON FUNCTION public.audit_point_events() TO sandbox_exec;


--
-- Name: FUNCTION audit_profiles(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_profiles() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_profiles() TO service_role;
GRANT ALL ON FUNCTION public.audit_profiles() TO sandbox_exec;


--
-- Name: FUNCTION audit_reward_redemptions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_reward_redemptions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_reward_redemptions() TO service_role;
GRANT ALL ON FUNCTION public.audit_reward_redemptions() TO sandbox_exec;


--
-- Name: FUNCTION audit_subscriptions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_subscriptions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_subscriptions() TO service_role;
GRANT ALL ON FUNCTION public.audit_subscriptions() TO sandbox_exec;


--
-- Name: FUNCTION audit_user_roles(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_user_roles() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_user_roles() TO service_role;
GRANT ALL ON FUNCTION public.audit_user_roles() TO sandbox_exec;


--
-- Name: FUNCTION award_purchase_points(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.award_purchase_points() FROM PUBLIC;
GRANT ALL ON FUNCTION public.award_purchase_points() TO service_role;
GRANT ALL ON FUNCTION public.award_purchase_points() TO sandbox_exec;


--
-- Name: FUNCTION award_referral_signup(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.award_referral_signup() FROM PUBLIC;
GRANT ALL ON FUNCTION public.award_referral_signup() TO service_role;
GRANT ALL ON FUNCTION public.award_referral_signup() TO sandbox_exec;


--
-- Name: FUNCTION award_renewal_points(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.award_renewal_points() FROM PUBLIC;
GRANT ALL ON FUNCTION public.award_renewal_points() TO service_role;
GRANT ALL ON FUNCTION public.award_renewal_points() TO sandbox_exec;


--
-- Name: FUNCTION check_and_award_achievements(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_and_award_achievements() FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_and_award_achievements() TO authenticated;
GRANT ALL ON FUNCTION public.check_and_award_achievements() TO service_role;
GRANT ALL ON FUNCTION public.check_and_award_achievements() TO sandbox_exec;


--
-- Name: FUNCTION confirm_referral_on_subscription(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirm_referral_on_subscription() FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_referral_on_subscription() TO service_role;
GRANT ALL ON FUNCTION public.confirm_referral_on_subscription() TO sandbox_exec;


--
-- Name: FUNCTION expire_old_points(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expire_old_points() FROM PUBLIC;
GRANT ALL ON FUNCTION public.expire_old_points() TO service_role;
GRANT ALL ON FUNCTION public.expire_old_points() TO sandbox_exec;


--
-- Name: FUNCTION expiring_subscriptions(_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expiring_subscriptions(_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.expiring_subscriptions(_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.expiring_subscriptions(_days integer) TO service_role;
GRANT ALL ON FUNCTION public.expiring_subscriptions(_days integer) TO sandbox_exec;


--
-- Name: FUNCTION generate_referral_code(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_referral_code() TO service_role;
GRANT ALL ON FUNCTION public.generate_referral_code() TO sandbox_exec;


--
-- Name: FUNCTION get_checkout_settings(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_checkout_settings() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_checkout_settings() TO authenticated;
GRANT ALL ON FUNCTION public.get_checkout_settings() TO service_role;
GRANT ALL ON FUNCTION public.get_checkout_settings() TO sandbox_exec;


--
-- Name: FUNCTION get_my_referrals(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_referrals() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_referrals() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_referrals() TO service_role;
GRANT ALL ON FUNCTION public.get_my_referrals() TO sandbox_exec;


--
-- Name: FUNCTION growth_metrics(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.growth_metrics() FROM PUBLIC;
GRANT ALL ON FUNCTION public.growth_metrics() TO service_role;
GRANT ALL ON FUNCTION public.growth_metrics() TO sandbox_exec;
GRANT ALL ON FUNCTION public.growth_metrics() TO authenticated;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;
GRANT ALL ON FUNCTION public.handle_new_user() TO sandbox_exec;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO sandbox_exec;


--
-- Name: FUNCTION leaderboard(_period text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.leaderboard(_period text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.leaderboard(_period text) TO authenticated;
GRANT ALL ON FUNCTION public.leaderboard(_period text) TO service_role;
GRANT ALL ON FUNCTION public.leaderboard(_period text) TO sandbox_exec;


--
-- Name: FUNCTION mark_all_notifications_read(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT ALL ON FUNCTION public.mark_all_notifications_read() TO service_role;
GRANT ALL ON FUNCTION public.mark_all_notifications_read() TO sandbox_exec;


--
-- Name: FUNCTION mark_reminder_sent(_subscription_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_reminder_sent(_subscription_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_reminder_sent(_subscription_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_reminder_sent(_subscription_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.mark_reminder_sent(_subscription_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION notify_achievement_unlocked(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_achievement_unlocked() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_achievement_unlocked() TO service_role;
GRANT ALL ON FUNCTION public.notify_achievement_unlocked() TO sandbox_exec;


--
-- Name: FUNCTION notify_redemption_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_redemption_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_redemption_status() TO service_role;
GRANT ALL ON FUNCTION public.notify_redemption_status() TO sandbox_exec;


--
-- Name: FUNCTION notify_referral_confirmed(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_referral_confirmed() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_referral_confirmed() TO service_role;
GRANT ALL ON FUNCTION public.notify_referral_confirmed() TO sandbox_exec;


--
-- Name: FUNCTION notify_subscription_active(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_subscription_active() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_subscription_active() TO service_role;
GRANT ALL ON FUNCTION public.notify_subscription_active() TO sandbox_exec;


--
-- Name: FUNCTION notify_welcome(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_welcome() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_welcome() TO service_role;
GRANT ALL ON FUNCTION public.notify_welcome() TO sandbox_exec;


--
-- Name: FUNCTION prevent_subscription_farming(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_subscription_farming() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_subscription_farming() TO service_role;
GRANT ALL ON FUNCTION public.prevent_subscription_farming() TO sandbox_exec;


--
-- Name: FUNCTION protect_notification_fields(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_notification_fields() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_notification_fields() TO service_role;
GRANT ALL ON FUNCTION public.protect_notification_fields() TO sandbox_exec;


--
-- Name: FUNCTION protect_profile_immutable_fields(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_profile_immutable_fields() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_profile_immutable_fields() TO service_role;
GRANT ALL ON FUNCTION public.protect_profile_immutable_fields() TO sandbox_exec;


--
-- Name: FUNCTION redeem_reward(_reward_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.redeem_reward(_reward_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.redeem_reward(_reward_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_reward(_reward_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.redeem_reward(_reward_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION redeem_reward(_reward_id uuid, _shipping jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.redeem_reward(_reward_id uuid, _shipping jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.redeem_reward(_reward_id uuid, _shipping jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_reward(_reward_id uuid, _shipping jsonb) TO service_role;
GRANT ALL ON FUNCTION public.redeem_reward(_reward_id uuid, _shipping jsonb) TO sandbox_exec;


--
-- Name: FUNCTION referral_code_exists(_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.referral_code_exists(_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.referral_code_exists(_code text) TO anon;
GRANT ALL ON FUNCTION public.referral_code_exists(_code text) TO authenticated;
GRANT ALL ON FUNCTION public.referral_code_exists(_code text) TO service_role;
GRANT ALL ON FUNCTION public.referral_code_exists(_code text) TO sandbox_exec;


--
-- Name: FUNCTION reverse_referral_on_subscription(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reverse_referral_on_subscription() FROM PUBLIC;
GRANT ALL ON FUNCTION public.reverse_referral_on_subscription() TO service_role;
GRANT ALL ON FUNCTION public.reverse_referral_on_subscription() TO sandbox_exec;


--
-- Name: FUNCTION run_expiry_reminders(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.run_expiry_reminders() FROM PUBLIC;
GRANT ALL ON FUNCTION public.run_expiry_reminders() TO service_role;
GRANT ALL ON FUNCTION public.run_expiry_reminders() TO sandbox_exec;


--
-- Name: FUNCTION set_point_event_expiry(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_point_event_expiry() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_point_event_expiry() TO service_role;
GRANT ALL ON FUNCTION public.set_point_event_expiry() TO sandbox_exec;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO sandbox_exec;


--
-- Name: FUNCTION write_audit_log(_action text, _entity text, _entity_id text, _target_user_id uuid, _old jsonb, _new jsonb, _metadata jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.write_audit_log(_action text, _entity text, _entity_id text, _target_user_id uuid, _old jsonb, _new jsonb, _metadata jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.write_audit_log(_action text, _entity text, _entity_id text, _target_user_id uuid, _old jsonb, _new jsonb, _metadata jsonb) TO service_role;
GRANT ALL ON FUNCTION public.write_audit_log(_action text, _entity text, _entity_id text, _target_user_id uuid, _old jsonb, _new jsonb, _metadata jsonb) TO sandbox_exec;


--
-- Name: TABLE achievements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.achievements TO anon;
GRANT ALL ON TABLE public.achievements TO authenticated;
GRANT ALL ON TABLE public.achievements TO service_role;
GRANT SELECT,INSERT ON TABLE public.achievements TO sandbox_exec;


--
-- Name: TABLE app_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_settings TO anon;
GRANT ALL ON TABLE public.app_settings TO authenticated;
GRANT ALL ON TABLE public.app_settings TO service_role;
GRANT SELECT,INSERT ON TABLE public.app_settings TO sandbox_exec;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.audit_logs TO sandbox_exec;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;
GRANT SELECT,INSERT ON TABLE public.notifications TO sandbox_exec;


--
-- Name: TABLE payment_webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_webhook_events TO anon;
GRANT ALL ON TABLE public.payment_webhook_events TO authenticated;
GRANT ALL ON TABLE public.payment_webhook_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.payment_webhook_events TO sandbox_exec;


--
-- Name: TABLE plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plans TO anon;
GRANT ALL ON TABLE public.plans TO authenticated;
GRANT ALL ON TABLE public.plans TO service_role;
GRANT SELECT,INSERT ON TABLE public.plans TO sandbox_exec;


--
-- Name: TABLE point_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.point_events TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.point_events TO authenticated;
GRANT ALL ON TABLE public.point_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.point_events TO sandbox_exec;


--
-- Name: TABLE point_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.point_rules TO anon;
GRANT ALL ON TABLE public.point_rules TO authenticated;
GRANT ALL ON TABLE public.point_rules TO service_role;
GRANT SELECT,INSERT ON TABLE public.point_rules TO sandbox_exec;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec;


--
-- Name: TABLE referrals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.referrals TO anon;
GRANT ALL ON TABLE public.referrals TO authenticated;
GRANT ALL ON TABLE public.referrals TO service_role;
GRANT SELECT,INSERT ON TABLE public.referrals TO sandbox_exec;


--
-- Name: TABLE reward_redemptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reward_redemptions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reward_redemptions TO authenticated;
GRANT ALL ON TABLE public.reward_redemptions TO service_role;
GRANT SELECT,INSERT ON TABLE public.reward_redemptions TO sandbox_exec;


--
-- Name: TABLE rewards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rewards TO anon;
GRANT ALL ON TABLE public.rewards TO authenticated;
GRANT ALL ON TABLE public.rewards TO service_role;
GRANT SELECT,INSERT ON TABLE public.rewards TO sandbox_exec;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;
GRANT SELECT,INSERT ON TABLE public.subscriptions TO sandbox_exec;


--
-- Name: TABLE user_achievements; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_achievements TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_achievements TO authenticated;
GRANT ALL ON TABLE public.user_achievements TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_achievements TO sandbox_exec;


--
-- Name: TABLE user_points; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_points TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_points TO authenticated;
GRANT ALL ON TABLE public.user_points TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_points TO sandbox_exec;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


