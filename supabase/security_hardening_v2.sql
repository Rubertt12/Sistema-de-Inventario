-- RRN Manager · hardening de privilégios do Data API
-- Mantém RLS como autorização de linha e reduz os privilégios de tabela ao mínimo
-- necessário para o frontend autenticado.

revoke all privileges on table public.tenant_inventory_state from anon;
revoke all privileges on table public.tenant_inventory_snapshots from anon;
revoke all privileges on table public.dashboard_preferences from anon;

revoke all privileges on table public.tenant_inventory_state from authenticated;
grant select, insert, update on table public.tenant_inventory_state to authenticated;

revoke all privileges on table public.tenant_inventory_snapshots from authenticated;
grant select, insert on table public.tenant_inventory_snapshots to authenticated;

revoke all privileges on table public.dashboard_preferences from authenticated;
grant select, insert, update on table public.dashboard_preferences to authenticated;
