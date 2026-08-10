-- RRN Manager - módulo relacional de gestão de ativos
-- Execute DEPOIS de supabase/schema.sql.

create table if not exists public.sectors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 1),
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create index if not exists sectors_tenant_idx on public.sectors(tenant_id);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sector_id uuid references public.sectors(id) on delete set null,
  legacy_key text,
  equipment_type text not null default 'Equipamento',
  hostname text,
  serial_number text,
  asset_tag text,
  manufacturer text,
  model text,
  assigned_to text,
  location text,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active','stock','loaned','maintenance','retired','lost')),
  purchased_at date,
  warranty_until date,
  notes text,
  photo_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists assets_tenant_idx on public.assets(tenant_id);
create index if not exists assets_sector_idx on public.assets(sector_id);
create index if not exists assets_status_idx on public.assets(tenant_id,lifecycle_status);
create unique index if not exists assets_tenant_tag_unique
  on public.assets(tenant_id,asset_tag)
  where asset_tag is not null and deleted_at is null;
create unique index if not exists assets_tenant_legacy_unique
  on public.assets(tenant_id,legacy_key)
  where legacy_key is not null;

create table if not exists public.asset_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  from_sector_id uuid references public.sectors(id) on delete set null,
  to_sector_id uuid references public.sectors(id) on delete set null,
  movement_type text not null default 'transfer'
    check (movement_type in ('created','transfer','stock','assignment','maintenance','return','retired','restored','updated')),
  reason text,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists asset_movements_tenant_idx on public.asset_movements(tenant_id);
create index if not exists asset_movements_asset_idx on public.asset_movements(asset_id,created_at desc);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  ticket text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','cancelled')),
  description text,
  checklist jsonb not null default '{}'::jsonb,
  opened_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists maintenance_tenant_idx on public.maintenance_records(tenant_id);
create index if not exists maintenance_asset_idx on public.maintenance_records(asset_id,opened_at desc);
create index if not exists maintenance_open_idx on public.maintenance_records(tenant_id,status);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  summary text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_tenant_idx on public.audit_events(tenant_id,created_at desc);
create index if not exists audit_events_entity_idx on public.audit_events(tenant_id,entity_type,entity_id);

-- updated_at

drop trigger if exists sectors_touch_updated_at on public.sectors;
create trigger sectors_touch_updated_at before update on public.sectors
for each row execute function public.touch_updated_at();

drop trigger if exists assets_touch_updated_at on public.assets;
create trigger assets_touch_updated_at before update on public.assets
for each row execute function public.touch_updated_at();

drop trigger if exists maintenance_touch_updated_at on public.maintenance_records;
create trigger maintenance_touch_updated_at before update on public.maintenance_records
for each row execute function public.touch_updated_at();

-- Grants. RLS continua sendo a barreira real de autorização.
grant select, insert, update, delete on public.sectors to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant select, insert on public.asset_movements to authenticated;
grant select, insert, update on public.maintenance_records to authenticated;
grant select, insert on public.audit_events to authenticated;

alter table public.sectors enable row level security;
alter table public.assets enable row level security;
alter table public.asset_movements enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.audit_events enable row level security;

-- Setores

drop policy if exists sectors_select_same_tenant on public.sectors;
create policy sectors_select_same_tenant on public.sectors for select to authenticated
using (tenant_id=public.current_tenant_id());

drop policy if exists sectors_insert_operator_admin on public.sectors;
create policy sectors_insert_operator_admin on public.sectors for insert to authenticated
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador') and created_by=auth.uid());

drop policy if exists sectors_update_operator_admin on public.sectors;
create policy sectors_update_operator_admin on public.sectors for update to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador'))
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador'));

drop policy if exists sectors_delete_admin on public.sectors;
create policy sectors_delete_admin on public.sectors for delete to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role()='admin');

-- Ativos

drop policy if exists assets_select_same_tenant on public.assets;
create policy assets_select_same_tenant on public.assets for select to authenticated
using (tenant_id=public.current_tenant_id());

drop policy if exists assets_insert_operator_admin on public.assets;
create policy assets_insert_operator_admin on public.assets for insert to authenticated
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador') and created_by=auth.uid());

drop policy if exists assets_update_operator_admin on public.assets;
create policy assets_update_operator_admin on public.assets for update to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador'))
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador') and updated_by=auth.uid());

drop policy if exists assets_delete_admin on public.assets;
create policy assets_delete_admin on public.assets for delete to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role()='admin');

-- Movimentações: histórico é append-only no frontend.

drop policy if exists movements_select_same_tenant on public.asset_movements;
create policy movements_select_same_tenant on public.asset_movements for select to authenticated
using (tenant_id=public.current_tenant_id());

drop policy if exists movements_insert_operator_admin on public.asset_movements;
create policy movements_insert_operator_admin on public.asset_movements for insert to authenticated
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador') and actor_id=auth.uid());

-- Manutenção

drop policy if exists maintenance_select_same_tenant on public.maintenance_records;
create policy maintenance_select_same_tenant on public.maintenance_records for select to authenticated
using (tenant_id=public.current_tenant_id());

drop policy if exists maintenance_insert_operator_admin on public.maintenance_records;
create policy maintenance_insert_operator_admin on public.maintenance_records for insert to authenticated
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador') and opened_by=auth.uid());

drop policy if exists maintenance_update_operator_admin on public.maintenance_records;
create policy maintenance_update_operator_admin on public.maintenance_records for update to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador'))
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador'));

-- Auditoria

drop policy if exists audit_select_same_tenant on public.audit_events;
create policy audit_select_same_tenant on public.audit_events for select to authenticated
using (tenant_id=public.current_tenant_id());

drop policy if exists audit_insert_operator_admin on public.audit_events;
create policy audit_insert_operator_admin on public.audit_events for insert to authenticated
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador') and actor_id=auth.uid());

-- RPC opcional para registrar eventos de auditoria sem permitir que o cliente
-- escolha outro tenant.
create or replace function public.log_audit_event(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_summary text,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if public.current_role() not in ('admin','operador') then
    raise exception 'Sem permissão para registrar alterações.';
  end if;

  insert into public.audit_events(
    tenant_id,actor_id,entity_type,entity_id,action,summary,before_data,after_data,metadata
  ) values (
    public.current_tenant_id(),auth.uid(),p_entity_type,p_entity_id,p_action,p_summary,
    p_before_data,p_after_data,coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) to authenticated;
