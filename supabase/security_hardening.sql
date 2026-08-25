-- RRN Manager - hardening final de segurança Supabase
-- Execute DEPOIS de schema.sql, asset_management.sql e migrate_legacy_inventory.sql.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
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

-- Tabelas base
alter policy tenant_select_own on public.tenants using (id=(select private.current_tenant_id()));
alter policy tenant_admin_update on public.tenants using (id=(select private.current_tenant_id()) and (select private.current_user_role())='admin') with check (id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy profiles_select_same_tenant on public.profiles using (tenant_id=(select private.current_tenant_id()));
alter policy profiles_admin_update_same_tenant on public.profiles using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin') with check (tenant_id=(select private.current_tenant_id()));
alter policy invites_admin_select on public.tenant_invitations using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy invites_admin_insert on public.tenant_invitations with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin' and created_by=(select auth.uid()));
alter policy invites_admin_update on public.tenant_invitations using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin') with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy invites_admin_delete on public.tenant_invitations using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy inventory_select_same_tenant on public.tenant_inventory_state using (tenant_id=(select private.current_tenant_id()));
alter policy inventory_insert_operator_admin on public.tenant_inventory_state with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and updated_by=(select auth.uid()));
alter policy inventory_update_operator_admin on public.tenant_inventory_state using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador')) with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and updated_by=(select auth.uid()));

-- Modelo relacional
alter policy sectors_select_same_tenant on public.sectors using (tenant_id=(select private.current_tenant_id()));
alter policy sectors_insert_operator_admin on public.sectors with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and created_by=(select auth.uid()));
alter policy sectors_update_operator_admin on public.sectors using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador')) with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador'));
alter policy sectors_delete_admin on public.sectors using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy assets_select_same_tenant on public.assets using (tenant_id=(select private.current_tenant_id()));
alter policy assets_insert_operator_admin on public.assets with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and created_by=(select auth.uid()));
alter policy assets_update_operator_admin on public.assets using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador')) with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and updated_by=(select auth.uid()));
alter policy assets_delete_admin on public.assets using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy movements_select_same_tenant on public.asset_movements using (tenant_id=(select private.current_tenant_id()));
alter policy movements_insert_operator_admin on public.asset_movements with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and actor_id=(select auth.uid()));
alter policy maintenance_select_same_tenant on public.maintenance_records using (tenant_id=(select private.current_tenant_id()));
alter policy maintenance_insert_operator_admin on public.maintenance_records with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and opened_by=(select auth.uid()));
alter policy maintenance_update_operator_admin on public.maintenance_records using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador')) with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador'));
alter policy audit_select_same_tenant on public.audit_events using (tenant_id=(select private.current_tenant_id()));
alter policy audit_insert_operator_admin on public.audit_events with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and actor_id=(select auth.uid()));

-- Trigger functions não devem ficar expostas como RPCs.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
grant execute on function public.handle_new_auth_user() to supabase_auth_admin;
alter function public.touch_updated_at() set search_path='';
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- RPCs públicas devem respeitar o RLS do chamador.
alter function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) security invoker;
alter function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) set search_path='';
revoke all on function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) to authenticated;

alter function public.migrate_legacy_inventory() security invoker;
alter function public.migrate_legacy_inventory() set search_path='';
revoke all on function public.migrate_legacy_inventory() from public, anon;
grant execute on function public.migrate_legacy_inventory() to authenticated;

-- Nenhuma tabela de negócio é acessível ao papel anon.
revoke all on public.tenants from anon;
revoke all on public.profiles from anon;
revoke all on public.tenant_invitations from anon;
revoke all on public.tenant_inventory_state from anon;
revoke all on public.sectors from anon;
revoke all on public.assets from anon;
revoke all on public.asset_movements from anon;
revoke all on public.maintenance_records from anon;
revoke all on public.audit_events from anon;

-- Remove helpers SECURITY DEFINER do schema exposto somente após migrar todas as policies.
drop function public.current_role();
drop function public.current_tenant_id();
