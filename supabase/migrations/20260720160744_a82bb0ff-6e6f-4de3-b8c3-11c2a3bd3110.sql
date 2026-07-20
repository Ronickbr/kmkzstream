UPDATE public.plans SET features = '["Acesso completo à plataforma"]'::jsonb WHERE name = 'Trimestral';
UPDATE public.plans SET features = '["Acesso completo à plataforma","Suporte prioritário 24/7"]'::jsonb WHERE name = 'Semestral';
UPDATE public.plans SET features = '["Acesso completo à plataforma","Suporte prioritário 24/7","Acesso a prêmios VIP"]'::jsonb WHERE name = 'Anual';