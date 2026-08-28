-- RRN Manager · hardening de privilégios e superfície do Data API
-- Aplicar somente depois de security_hardening.sql e security_hardening_v2.sql.
--
-- Este arquivo não altera dados. Ele reduz grants e torna objetos futuros privados.

-- Objetos futuros criados pelo papel postgres passam a ser privados por padrão.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Os defaults do papel supabase_admin são gerenciados pela plataforma e não
-- podem ser alterados pelo papel postgres deste projeto.

-- O Data API nunca precisa permitir estas operações ao navegador.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- Acesso direto anônimo a tabelas é negado por padrão.
revoke all privileges on all tables in schema public from anon;

-- O portal público pode localizar apenas portais habilitados; a policy RLS
-- support_portals_public_read continua filtrando as linhas.
do $$
begin
  if to_regclass('public.support_portals') is not null then
    execute 'grant select on table public.support_portals to anon';
  end if;
end
$$;

-- Usuários anônimos não manipulam sequences. Usuários autenticados mantêm
-- somente USAGE/SELECT já concedidos quando necessários a identity/serial.
revoke all privileges on all sequences in schema public from anon;
revoke update on all sequences in schema public from authenticated;

-- Remove EXECUTE herdado do pseudo-papel PUBLIC e torna anon opt-in.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- Somente as RPCs pré-login realmente usadas pelo frontend permanecem públicas.
-- A versão antiga get_public_tenant_branding(text) não é reaberta.
do $$
begin
  if to_regprocedure('public.get_public_tenant_branding_v2(text)') is not null then
    execute 'grant execute on function public.get_public_tenant_branding_v2(text) to anon';
  end if;
  if to_regprocedure('public.get_support_chat_bot_config(text)') is not null then
    execute 'grant execute on function public.get_support_chat_bot_config(text) to anon';
  end if;
end
$$;

-- Funções de trigger e migrações internas não são endpoints do navegador.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.prorettype = 'trigger'::regtype or p.proname = 'migrate_legacy_inventory')
  loop
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end
$$;

-- Tabelas internas sem policies permanecem inacessíveis pelo Data API.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'public.agent_security_rate_limits',
    'public.mfa_trusted_devices'
  ]
  loop
    if to_regclass(relation_name) is not null then
      execute format('revoke all privileges on table %s from anon, authenticated',
                     to_regclass(relation_name));
    end if;
  end loop;
end
$$;
