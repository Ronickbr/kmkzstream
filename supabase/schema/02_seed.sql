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
-- Data for Name: achievements; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('first_login', 'Primeiro Acesso', 'Entrou no KMKZ pela primeira vez', 'sparkles', 'onboarding', 10, '{"type": "login_count", "value": 1}', 1, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('first_share', 'Divulgador', 'Compartilhou seu link de indicação', 'share', 'referral', 15, '{"type": "share_count", "value": 1}', 2, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('first_referral', 'Padrinho', 'Confirmou sua primeira indicação', 'users', 'referral', 50, '{"type": "referrals_confirmed", "value": 1}', 3, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('referrer_5', 'Influenciador', '5 indicações confirmadas', 'users', 'referral', 150, '{"type": "referrals_confirmed", "value": 5}', 4, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('referrer_10', 'Embaixador KMKZ', '10 indicações confirmadas', 'crown', 'referral', 300, '{"type": "referrals_confirmed", "value": 10}', 5, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('referrer_25', 'Lenda das Indicações', '25 indicações confirmadas', 'crown', 'referral', 800, '{"type": "referrals_confirmed", "value": 25}', 6, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('points_500', 'Colecionador', 'Acumulou 500 pontos', 'gem', 'points', 20, '{"type": "points_total", "value": 500}', 20, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('points_2000', 'Elite', 'Acumulou 2000 pontos', 'gem', 'points', 100, '{"type": "points_total", "value": 2000}', 21, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('points_10000', 'Master', 'Acumulou 10.000 pontos', 'gem', 'points', 500, '{"type": "points_total", "value": 10000}', 22, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('first_redemption', 'Recompensado', 'Resgatou seu primeiro prêmio', 'gift', 'reward', 25, '{"type": "redemptions_count", "value": 1}', 30, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('redemption_5', 'Colecionador de Prêmios', '5 prêmios resgatados', 'gift', 'reward', 150, '{"type": "redemptions_count", "value": 5}', 31, true, '2026-07-19 18:56:03.011124+00');
INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order, active, created_at) VALUES ('subscriber', 'Assinante KMKZ', 'Ativou uma assinatura', 'crown', 'subscription', 75, '{"type": "active_subscription", "value": 1}', 40, true, '2026-07-19 18:56:03.011124+00');


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_settings (key, value, updated_at) VALUES ('payments', '{"stripe": {"enabled": true, "payment_links": {}}, "br_provider": "infinitepay", "infinitepay": {"handle": "", "enabled": true, "redirect_url": ""}, "intl_provider": "stripe"}', '2026-07-25 22:49:53.627614+00');
INSERT INTO public.app_settings (key, value, updated_at) VALUES ('whatsapp_reminders', '{"enabled": true, "template": "Olá {nome}! Sua assinatura KMKZ ({plano}) vence em {dias} dia(s), no dia {data}. Renove agora e não fique fora do ar: {link}", "days_before": 7, "support_number": ""}', '2026-07-25 22:49:53.627614+00');


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.plans (id, name, period, price_cents, duration_days, referral_points, features, active, sort_order, created_at, updated_at, screen_limit, quality, is_popular, purchase_points) VALUES ('6b1e92cb-ddf1-4c7a-821a-f1ef7340425c', 'Mensal', 'monthly', 3500, 30, 100, '["Acesso completo à plataforma", "Bônus de indicação padrão"]', true, 1, '2026-07-19 04:26:04.817039+00', '2026-07-19 21:25:08.330103+00', 1, 'HD', false, 20);
INSERT INTO public.plans (id, name, period, price_cents, duration_days, referral_points, features, active, sort_order, created_at, updated_at, screen_limit, quality, is_popular, purchase_points) VALUES ('c30001ca-430d-4218-bd16-835a89b032c7', 'Trimestral', 'quarterly', 9900, 90, 250, '["Acesso completo à plataforma"]', true, 2, '2026-07-19 04:26:04.817039+00', '2026-07-20 16:07:46.60793+00', 1, 'HD', false, 70);
INSERT INTO public.plans (id, name, period, price_cents, duration_days, referral_points, features, active, sort_order, created_at, updated_at, screen_limit, quality, is_popular, purchase_points) VALUES ('a6ff3fe5-be71-45b3-a54c-00f8a9a34c22', 'Semestral', 'semiannual', 18000, 180, 500, '["Acesso completo à plataforma", "Suporte prioritário 24/7"]', true, 3, '2026-07-19 04:26:04.817039+00', '2026-07-20 16:07:46.60793+00', 1, 'HD', false, 150);
INSERT INTO public.plans (id, name, period, price_cents, duration_days, referral_points, features, active, sort_order, created_at, updated_at, screen_limit, quality, is_popular, purchase_points) VALUES ('c4c45da9-3888-4fd0-bedc-d3943c83d3dc', 'Anual', 'annual', 30000, 365, 900, '["Acesso completo à plataforma", "Suporte prioritário 24/7", "Acesso a prêmios VIP"]', true, 4, '2026-07-19 04:26:04.817039+00', '2026-07-20 16:07:46.60793+00', 4, '4K', false, 350);


--
-- Data for Name: point_rules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.point_rules (id, name, points, daily_limit, active, updated_at) VALUES ('referral_confirmed', 'Indicação confirmada (plano)', 0, NULL, true, '2026-07-19 05:56:30.175602+00');
INSERT INTO public.point_rules (id, name, points, daily_limit, active, updated_at) VALUES ('reward_redeemed', 'Resgate de prêmio', 0, NULL, true, '2026-07-19 05:56:30.175602+00');
INSERT INTO public.point_rules (id, name, points, daily_limit, active, updated_at) VALUES ('signup_bonus', 'Bônus de boas-vindas', 10, NULL, true, '2026-07-19 20:19:40.289482+00');
INSERT INTO public.point_rules (id, name, points, daily_limit, active, updated_at) VALUES ('renewal_monthly', 'Renovação mensal', 20, NULL, true, '2026-07-19 20:19:40.289482+00');
INSERT INTO public.point_rules (id, name, points, daily_limit, active, updated_at) VALUES ('renewal_annual', 'Renovação anual', 100, NULL, true, '2026-07-19 20:19:40.289482+00');
INSERT INTO public.point_rules (id, name, points, daily_limit, active, updated_at) VALUES ('share', 'Compartilhar link de indicação', 5, 5, false, '2026-07-19 21:15:51.26469+00');
INSERT INTO public.point_rules (id, name, points, daily_limit, active, updated_at) VALUES ('referral_signup', 'Indicação cadastrada', 5, NULL, true, '2026-07-19 21:15:51.26469+00');


--
-- Data for Name: rewards; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.rewards (id, name, description, image_url, points_cost, stock, active, sort_order, created_at, updated_at, kind, subscription_months) VALUES ('8f942907-6e82-45ef-ad5b-06da65e1e477', 'Fire TV Stick Lite', 'Amazon Fire TV Stick Lite com controle remoto por voz Alexa. Full HD.', NULL, 1800, 30, false, 0, '2026-07-19 05:00:19.254567+00', '2026-07-19 20:19:40.289482+00', 'device', NULL);
INSERT INTO public.rewards (id, name, description, image_url, points_cost, stock, active, sort_order, created_at, updated_at, kind, subscription_months) VALUES ('1a8a42e7-e8a1-4f68-b8ac-73246aa3c421', 'Chromecast com Google TV (HD)', 'Streaming HD com controle remoto e Google TV integrado.', NULL, 2000, 25, false, 0, '2026-07-19 05:00:19.254567+00', '2026-07-19 20:19:40.289482+00', 'device', NULL);
INSERT INTO public.rewards (id, name, description, image_url, points_cost, stock, active, sort_order, created_at, updated_at, kind, subscription_months) VALUES ('002b31a9-a763-49bc-b2ff-496baeaa197f', 'Fire TV Stick 4K', 'Amazon Fire TV Stick 4K — streaming em Ultra HD, Dolby Vision e Wi-Fi 6.', NULL, 2800, 20, false, 0, '2026-07-19 05:00:19.254567+00', '2026-07-19 20:19:40.289482+00', 'device', NULL);
INSERT INTO public.rewards (id, name, description, image_url, points_cost, stock, active, sort_order, created_at, updated_at, kind, subscription_months) VALUES ('5b5f96c9-5c9b-49a9-b389-d5d21717fcd6', '1 Mês Grátis', 'Estenda sua assinatura atual por mais 30 dias, sem cobrança.', NULL, 100, 999, true, 1, '2026-07-19 05:00:19.254567+00', '2026-07-19 20:19:40.289482+00', 'subscription', 1);
INSERT INTO public.rewards (id, name, description, image_url, points_cost, stock, active, sort_order, created_at, updated_at, kind, subscription_months) VALUES ('e314cfe4-653e-4728-8387-5be961861b98', '3 Meses Grátis', 'Adicione 90 dias de acesso completo ao seu plano atual.', NULL, 250, 999, true, 2, '2026-07-19 05:00:19.254567+00', '2026-07-19 20:19:40.289482+00', 'subscription', 3);
INSERT INTO public.rewards (id, name, description, image_url, points_cost, stock, active, sort_order, created_at, updated_at, kind, subscription_months) VALUES ('87c04c2a-4fcd-40ce-9668-c88d92435a25', '6 Meses Grátis', 'Ganhe 6 meses adicionados à sua assinatura ativa.', NULL, 500, 999, true, 3, '2026-07-19 20:19:40.289482+00', '2026-07-19 20:19:40.289482+00', 'subscription', 6);
INSERT INTO public.rewards (id, name, description, image_url, points_cost, stock, active, sort_order, created_at, updated_at, kind, subscription_months) VALUES ('801b1554-8418-442c-8258-0f00e185c602', '1 Ano Grátis', 'Ganhe 12 meses adicionados à sua assinatura ativa.', NULL, 900, 999, true, 4, '2026-07-19 20:19:40.289482+00', '2026-07-19 20:19:40.289482+00', 'subscription', 12);
INSERT INTO public.rewards (id, name, description, image_url, points_cost, stock, active, sort_order, created_at, updated_at, kind, subscription_months) VALUES ('307e22e6-7197-439a-bae7-b168d2c11c02', 'Mi TV Stick', 'Xiaomi Mi TV Stick — transforme sua TV em Smart TV com Android TV. Full HD, Chromecast integrado.', NULL, 1500, 30, true, 5, '2026-07-19 05:00:19.254567+00', '2026-07-19 20:19:40.289482+00', 'device', NULL);


--
-- PostgreSQL database dump complete
--


