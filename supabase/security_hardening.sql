-- RRN Manager - hardening adicional de produção
-- Execute DEPOIS de schema.sql, asset_management.sql e migrate_legacy_inventory.sql.

-- Corrige search_path de funções sensíveis/trigger.
alter function public.touch_updated_at() set search_path = public;
alter function public.migrate_legacy_inventory() set search_path = public, extensions;

-- Remove execução anônima e pública das funções privilegiadas.
revoke all on function public.current_tenant_id() from public;
revoke all on function public.current_role() from public;
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) from public;
revoke all on function public.migrate_legacy_inventory() from public;
revoke all on function public.touch_updated_at() from public;

revoke execute on function public.current_tenant_id() from anon;
revoke execute on function public.current_role() from anon;
revoke execute on function public.handle_new_auth_user() from anon, authenticated;
revoke execute on function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) from anon;
revoke execute on function public.migrate_legacy_inventory() from anon;
revoke execute on function public.touch_updated_at() from anon, authenticated;

-- Apenas funções necessárias ao frontend autenticado permanecem executáveis.
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) to authenticated;
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
