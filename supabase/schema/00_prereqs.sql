-- =====================================================================
-- KMKZ IPTV — 00_prereqs.sql
-- Pré-requisitos para restaurar o schema em um Postgres novo.
--
-- Em Supabase self-host / Supabase Cloud: rode este arquivo mesmo assim
-- (tudo é idempotente e não altera nada que já exista).
--
-- Em Postgres "puro" (sem GoTrue): este arquivo cria um substituto
-- mínimo do schema `auth` (tabela auth.users + auth.uid()/auth.role())
-- para que as chaves estrangeiras, funções e políticas RLS funcionem.
-- =====================================================================

-- 1) Extensões usadas pelo schema -------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- buscas por similaridade (opcional)

-- 2) Papéis esperados pelas GRANTs / políticas ------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 3) Schema `auth` mínimo (SOMENTE para Postgres sem GoTrue) ----------
-- Se você está migrando para Supabase self-host, o GoTrue já cria
-- auth.users e as funções auth.uid()/auth.role() — os blocos abaixo
-- são ignorados automaticamente porque usam IF NOT EXISTS / OR REPLACE
-- apenas quando ausentes.
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE,
  encrypted_password text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- auth.uid(): lê o claim `sub` do JWT que o PostgREST injeta em
-- request.jwt.claims. Só é criada se ainda não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $body$
        SELECT NULLIF(
          COALESCE(
            current_setting('request.jwt.claim.sub', true),
            (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
          ), ''
        )::uuid
      $body$;
    $fn$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'role'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION auth.role() RETURNS text
      LANGUAGE sql STABLE AS $body$
        SELECT COALESCE(
          current_setting('request.jwt.claim.role', true),
          (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
        )
      $body$;
    $fn$;
  END IF;
END $$;
