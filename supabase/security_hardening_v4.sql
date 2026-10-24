-- RRN Manager · hardening de compatibilidade para ambientes maduros
-- Aplicar DEPOIS de security_hardening_v3.sql.
--
-- Objetivos:
-- 1. preservar módulos antigos que ainda chamam public.current_tenant_id()/current_role();
-- 2. remover SECURITY DEFINER desses helpers expostos, delegando a helpers privados;
-- 3. impedir que usuários criados por signInAnonymously() herdem acesso às áreas de negócio;
-- 4. manter o fluxo anônimo legítimo do portal de suporte fora deste bloqueio.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select p.tenant_id
  from public.profiles as p
  where p.user_id=(select auth.uid())
    and p.status='active'
  limit 1;
$$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path=''
as $$
  select p.role
  from public.profiles as p
  where p.user_id=(select auth.uid())
    and p.status='active'
  limit 1;
$$;

revoke all on function private.current_tenant_id() from public, anon;
revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_tenant_id() to authenticated;
grant execute on function private.current_user_role() to authenticated;

-- Wrappers de compatibilidade. Diversas migrations posteriores ao núcleo ainda
-- os referenciam em policies e RPCs. Eles deixam de ser SECURITY DEFINER e,
-- portanto, deixam de ser endpoints privilegiados no schema public.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security invoker
set search_path=''
as $$
  select private.current_tenant_id();
$$;

create or replace function public.current_role()
returns text
language sql
stable
security invoker
set search_path=''
as $$
  select private.current_user_role();
$$;

revoke all on function public.current_tenant_id() from public, anon;
revoke all on function public.current_role() from public, anon;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_role() to authenticated;

-- A RPC de auditoria não precisa contornar RLS. Mantém o corpo existente e
-- passa a executar com os privilégios do usuário autenticado.
do $$
begin
  if to_regprocedure('public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb)') is not null then
    execute 'alter function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) security invoker';
    execute 'alter function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) set search_path=''''';
  end if;
end
$$;

-- Endpoint antigo de branding não deve continuar acessível. A versão v2 é a
-- única allowlist pública mantida por security_hardening_v3.sql.
do $$
begin
  if to_regprocedure('public.get_public_tenant_branding(text)') is not null then
    execute 'revoke execute on function public.get_public_tenant_branding(text) from public, anon, authenticated';
  end if;
end
$$;

-- Usuários anônimos do Supabase Auth assumem o papel PostgreSQL authenticated.
-- As policies abaixo são RESTRICTIVE e complementam as policies de tenant/role:
-- um usuário permanente precisa passar pelas duas camadas; um usuário anônimo é
-- bloqueado antes de alcançar inventário, administração, agente e loja.
--
-- Não aplicar este guard às tabelas do fluxo de suporte do visitante
-- (support_customers, support_tickets, support_ticket_messages,
-- support_ticket_events, support_ticket_participants e support_portals), pois o
-- portal público usa signInAnonymously() de forma intencional.
do $$
declare
  relation_name text;
  policy_name constant text := 'permanent_users_only';
  guard text := '(select coalesce((auth.jwt()->>''is_anonymous'')::boolean,false)) = false';
begin
  foreach relation_name in array array[
    'public.tenants',
    'public.profiles',
    'public.tenant_invitations',
    'public.tenant_inventory_state',
    'public.sectors',
    'public.assets',
    'public.asset_movements',
    'public.maintenance_records',
    'public.audit_events',
    'public.dashboard_preferences',
    'public.tenant_inventory_snapshots',
    'public.platform_admins',
    'public.pending_registrations',
    'public.agent_devices',
    'public.agent_enrollment_tokens',
    'public.agent_heartbeats',
    'public.store_customers',
    'public.store_products',
    'public.store_sale_items',
    'public.store_sales',
    'public.store_service_orders',
    'public.store_stock_movements',
    'public.support_staff',
    'public.support_sla_policies',
    'public.support_maintenance_queue',
    'public.support_chat_bot_settings',
    'public.tenant_branding'
  ]
  loop
    if to_regclass(relation_name) is not null then
      execute format('drop policy if exists %I on %s', policy_name, to_regclass(relation_name));
      execute format(
        'create policy %I on %s as restrictive for all to authenticated using (%s) with check (%s)',
        policy_name,
        to_regclass(relation_name),
        guard,
        guard
      );
    end if;
  end loop;
end
$$;

-- Tabelas internas continuam fora do Data API mesmo se anonymous sign-ins
-- estiverem habilitados.
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
      execute format('revoke all privileges on table %s from anon, authenticated', to_regclass(relation_name));
    end if;
  end loop;
end
$$;
