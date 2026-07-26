# Schema completo — KMKZ IPTV

Exportação completa e portátil do banco (schema `public`) para migrar para
outro Postgres ou para um Supabase self-host.

## Arquivos (rode nesta ordem)

| Ordem | Arquivo | Conteúdo |
|---|---|---|
| 1 | `00_prereqs.sql` | Extensões (`pgcrypto`, `pg_trgm`), papéis `anon` / `authenticated` / `service_role` / `authenticator` e, em Postgres puro, um `auth.users` + `auth.uid()` mínimos. Idempotente. |
| 2 | `01_schema.sql` | Dump estrutural completo: tipos enum, 16 tabelas, chaves, índices, ~42 funções, gatilhos, RLS + 49 políticas e todas as GRANTs. |
| 3 | `02_seed.sql` | Dados de referência: planos, prêmios, conquistas, regras de pontos e configurações do app. |
| 4 | `03_auth_hooks.sql` | Gatilho `on_auth_user_created` em `auth.users` (fora do schema `public`, por isso separado). |

## Como restaurar

```bash
export TARGET="postgresql://usuario:senha@host:5432/postgres"

psql "$TARGET" -v ON_ERROR_STOP=1 -f 00_prereqs.sql
psql "$TARGET" -v ON_ERROR_STOP=1 -f 01_schema.sql
psql "$TARGET" -v ON_ERROR_STOP=1 -f 02_seed.sql
psql "$TARGET" -v ON_ERROR_STOP=1 -f 03_auth_hooks.sql
```

> Em Supabase self-host, suba o GoTrue **antes** de rodar os arquivos, para
> que `auth.users` já exista com a estrutura oficial.

## Conteúdo do schema

**Tabelas:** `profiles`, `user_roles`, `plans`, `subscriptions`, `referrals`,
`user_points`, `point_events`, `point_rules`, `rewards`, `reward_redemptions`,
`achievements`, `user_achievements`, `notifications`, `app_settings`,
`audit_logs`, `payment_webhook_events`.

**Tipos enum:** `app_role`, `plan_period`, `subscription_status`,
`referral_status`, `redemption_status`.

## Migrar também os dados dos usuários

Este pacote contém estrutura + dados de referência. Para levar os dados reais
(usuários, assinaturas, pontos, indicações):

```bash
# origem
pg_dump --data-only --no-owner --schema=public \
  --exclude-table=public.plans --exclude-table=public.rewards \
  --exclude-table=public.achievements --exclude-table=public.point_rules \
  --exclude-table=public.app_settings \
  "$ORIGEM" -f dados.sql

# usuários de autenticação (Supabase → Supabase self-host)
pg_dump --data-only --no-owner --schema=auth "$ORIGEM" -f auth_dados.sql
```

Importe `auth_dados.sql` **antes** de `dados.sql` (as chaves estrangeiras
apontam para `auth.users`) e, se possível, desative temporariamente os
gatilhos durante a carga:

```sql
SET session_replication_role = replica;  -- desliga triggers/FKs
-- ... importações ...
SET session_replication_role = origin;
```

## Segredos que não estão aqui

Nenhuma credencial é exportada. Ao migrar, reconfigure no destino:
`SUPABASE_URL`, chaves de API, `PAYMENT_WEBHOOK_SECRET` e as credenciais dos
gateways de pagamento.

## Regerar esta exportação

```bash
pg_dump --schema-only --no-owner --schema=public "$SUPABASE_DB_URL" -f 01_schema.sql
pg_dump --data-only --no-owner --column-inserts --schema=public \
  -t public.plans -t public.rewards -t public.achievements \
  -t public.point_rules -t public.app_settings "$SUPABASE_DB_URL" -f 02_seed.sql
```
