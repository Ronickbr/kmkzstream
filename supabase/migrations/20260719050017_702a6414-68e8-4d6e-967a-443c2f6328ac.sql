
-- Substituir catálogo de prêmios por aparelhos de streaming e meses grátis
DELETE FROM public.rewards;

INSERT INTO public.rewards (name, description, points_cost, stock, active, image_url) VALUES
  ('1 Mês Grátis', 'Estenda sua assinatura atual por mais 30 dias, sem cobrança.', 300, 999, true, null),
  ('3 Meses Grátis', 'Adicione 90 dias de acesso completo ao seu plano atual.', 800, 999, true, null),
  ('Mi TV Stick', 'Xiaomi Mi TV Stick — transforme sua TV em Smart TV com Android TV. Full HD, Chromecast integrado.', 1500, 30, true, null),
  ('Fire TV Stick Lite', 'Amazon Fire TV Stick Lite com controle remoto por voz Alexa. Full HD.', 1800, 30, true, null),
  ('Chromecast com Google TV (HD)', 'Streaming HD com controle remoto e Google TV integrado.', 2000, 25, true, null),
  ('Fire TV Stick 4K', 'Amazon Fire TV Stick 4K — streaming em Ultra HD, Dolby Vision e Wi-Fi 6.', 2800, 20, true, null),
  ('Chromecast com Google TV (4K)', 'Google Chromecast 4K com HDR, Dolby Vision e controle remoto.', 3200, 15, true, null),
  ('Apple TV 4K', 'Apple TV 4K — o topo em streaming: A15 Bionic, Dolby Atmos, Siri Remote.', 12000, 5, true, null);
