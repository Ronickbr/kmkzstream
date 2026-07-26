-- =====================================================================
-- KMKZ IPTV — 03_auth_hooks.sql
-- Gatilhos que vivem FORA do schema `public` e por isso não entram no
-- dump de 01_schema.sql. Rode DEPOIS de 01_schema.sql.
--
-- Cria o perfil, o saldo de pontos e a indicação pendente sempre que um
-- novo usuário é criado pelo sistema de autenticação.
-- A função public.handle_new_user() já vem definida em 01_schema.sql.
-- =====================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
