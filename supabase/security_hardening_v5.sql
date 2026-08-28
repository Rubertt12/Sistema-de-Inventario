-- RRN Manager · security hardening v5
-- Estado validado em produção em 2026-08-28.
--
-- Objetivos:
-- 1. reduzir privilégios diretos do Data API;
-- 2. bloquear usuários Supabase Auth anônimos nas áreas de negócio;
-- 3. preservar o portal de suporte visitante;
-- 4. manter RPCs públicas compatíveis sem SECURITY DEFINER exposto em public.

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all privileges on all tables in schema public from anon;

do $$
begin
  if to_regclass('public.support_portals') is not null then
    execute 'grant select on table public.support_portals to anon';
  end if;
end
$$;

revoke all privileges on all sequences in schema public from anon;
revoke update on all sequences in schema public from authenticated;

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

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

do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (p.prorettype='trigger'::regtype or p.proname='migrate_legacy_inventory')
  loop
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end
$$;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select p.tenant_id
  from public.profiles p
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
  from public.profiles p
  where p.user_id=(select auth.uid())
    and p.status='active'
  limit 1;
$$;

revoke all on function private.current_tenant_id() from public, anon;
revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_tenant_id() to authenticated;
grant execute on function private.current_user_role() to authenticated;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security invoker
set search_path=''
as $$ select private.current_tenant_id(); $$;

create or replace function public.current_role()
returns text
language sql
stable
security invoker
set search_path=''
as $$ select private.current_user_role(); $$;

revoke all on function public.current_tenant_id() from public, anon;
revoke all on function public.current_role() from public, anon;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_role() to authenticated;

do $$
begin
  if to_regprocedure('public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb)') is not null then
    execute 'alter function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) security invoker';
    execute 'alter function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) set search_path=''''';
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.get_public_tenant_branding(text)') is not null then
    execute 'revoke execute on function public.get_public_tenant_branding(text) from public, anon, authenticated';
  end if;
end
$$;

-- Anonymous Auth users usam a role PostgreSQL authenticated. Esta policy
-- RESTRICTIVE bloqueia áreas de negócio, mas não o fluxo visitante do suporte.
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
    'public.collaborators',
    'public.collaborator_asset_links',
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
        policy_name, to_regclass(relation_name), guard, guard
      );
    end if;
  end loop;
end
$$;

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

-- Move implementações SECURITY DEFINER ainda expostas para private e recria
-- wrappers SECURITY INVOKER em public com a mesma assinatura RPC.
do $$
declare
  r record;
  call_args text;
  volatility_sql text;
  body_sql text;
  had_anon boolean;
  had_authenticated boolean;
begin
  for r in
    select
      p.oid,
      p.proname,
      p.pronargs,
      p.proargnames,
      pg_get_function_arguments(p.oid) as decl_args,
      pg_get_function_identity_arguments(p.oid) as identity_args,
      pg_get_function_result(p.oid) as result_type,
      p.proretset,
      p.provolatile
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and (
        has_function_privilege('authenticated',p.oid,'EXECUTE')
        or has_function_privilege('anon',p.oid,'EXECUTE')
      )
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    had_anon := has_function_privilege('anon',r.oid,'EXECUTE');
    had_authenticated := has_function_privilege('authenticated',r.oid,'EXECUTE');

    if r.pronargs = 0 then
      call_args := '';
    else
      select string_agg(format('%I', x.argname), ', ' order by x.ord)
        into call_args
      from unnest(r.proargnames[1:r.pronargs]) with ordinality as x(argname,ord);
    end if;

    volatility_sql := case r.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      else 'volatile'
    end;

    execute format('alter function public.%I(%s) set schema private', r.proname, r.identity_args);

    body_sql := case when r.proretset
      then format('select * from private.%I(%s)', r.proname, coalesce(call_args,''))
      else format('select private.%I(%s)', r.proname, coalesce(call_args,''))
    end;

    execute format(
      'create function public.%I(%s) returns %s language sql %s security invoker set search_path='''' as %L',
      r.proname, r.decl_args, r.result_type, volatility_sql, body_sql
    );

    execute format('revoke execute on function private.%I(%s) from public, anon, authenticated', r.proname, r.identity_args);
    if had_anon then
      execute format('grant execute on function private.%I(%s) to anon', r.proname, r.identity_args);
    end if;
    if had_authenticated then
      execute format('grant execute on function private.%I(%s) to authenticated', r.proname, r.identity_args);
    end if;
    execute format('grant execute on function private.%I(%s) to service_role', r.proname, r.identity_args);

    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', r.proname, r.identity_args);
    if had_anon then
      execute format('grant execute on function public.%I(%s) to anon', r.proname, r.identity_args);
    end if;
    if had_authenticated then
      execute format('grant execute on function public.%I(%s) to authenticated', r.proname, r.identity_args);
    end if;
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.identity_args);
  end loop;
end
$$;

notify pgrst, 'reload schema';
