-- RRN Manager billing: plans, 7-day trials, Mercado Pago subscriptions and database-enforced quotas.
-- Existing workspaces are grandfathered to avoid interrupting current customers.
create table if not exists public.billing_plans (
  id text primary key,
  name text not null,
  description text not null default '',
  monthly_price numeric(10,2) not null check (monthly_price >= 0),
  max_users integer not null check (max_users > 0),
  max_assets integer not null check (max_assets > 0),
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.billing_plans(id,name,description,monthly_price,max_users,max_assets,features,active,sort_order)
values
 ('starter','Starter','Para equipes pequenas que precisam organizar o inventário.',39.90,2,100,'{"asset_inventory":true,"sectors":true,"movements":true,"maintenance":false,"advanced_reports":false,"audit":false}'::jsonb,true,1),
 ('professional','Professional','Mais capacidade e recursos para equipes em crescimento.',89.90,10,1000,'{"asset_inventory":true,"sectors":true,"movements":true,"maintenance":true,"advanced_reports":true,"audit":false}'::jsonb,true,2),
 ('enterprise','Enterprise','Gestão ampliada para operações maiores.',199.90,30,5000,'{"asset_inventory":true,"sectors":true,"movements":true,"maintenance":true,"advanced_reports":true,"audit":true}'::jsonb,true,3),
 ('legacy','Acesso legado','Plano de transição para workspaces existentes.',0,999999,999999,'{"asset_inventory":true,"sectors":true,"movements":true,"maintenance":true,"advanced_reports":true,"audit":true}'::jsonb,false,99)
on conflict (id) do update set
 name=excluded.name, description=excluded.description, monthly_price=excluded.monthly_price,
 max_users=excluded.max_users, max_assets=excluded.max_assets, features=excluded.features,
 active=excluded.active, sort_order=excluded.sort_order;

create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  plan_id text not null references public.billing_plans(id),
  status text not null check (status in ('trialing','pending','authorized','paused','past_due','cancelled','expired','grandfathered')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  external_reference text not null unique default gen_random_uuid()::text,
  mp_preapproval_id text unique,
  pending_plan_id text references public.billing_plans(id),
  mp_status text,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tenant_subscriptions_status_idx on public.tenant_subscriptions(status,trial_ends_at);
create index if not exists tenant_subscriptions_provider_idx on public.tenant_subscriptions(mp_preapproval_id) where mp_preapproval_id is not null;

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  resource_id text,
  processing_status text not null default 'received' check (processing_status in ('received','processed','failed','ignored')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.billing_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists billing_plans_public_read on public.billing_plans;
create policy billing_plans_public_read on public.billing_plans for select to anon, authenticated using (active=true);
drop policy if exists billing_subscription_admin_read on public.tenant_subscriptions;
create policy billing_subscription_admin_read on public.tenant_subscriptions for select to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role()='admin');

grant select on public.billing_plans to anon, authenticated, service_role;
grant all on public.tenant_subscriptions to service_role;
grant all on public.billing_webhook_events to service_role;
grant select on public.tenant_subscriptions to authenticated;
revoke all on public.billing_webhook_events from anon, authenticated;
revoke insert, update, delete on public.billing_plans from anon, authenticated;
revoke insert, update, delete on public.tenant_subscriptions from anon, authenticated;

create or replace function public.billing_is_entitled(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select coalesce((
    select case
      when s.status='grandfathered' then true
      when s.status='trialing' then s.trial_ends_at > now()
      when s.status='authorized' then s.current_period_end is null or s.current_period_end >= now()
      when s.status='past_due' then coalesce(s.current_period_end,now()) + interval '5 days' >= now()
      when s.status='cancelled' then s.current_period_end is not null and s.current_period_end >= now()
      else false
    end
    from public.tenant_subscriptions s
    join public.tenants t on t.id=s.tenant_id
    where s.tenant_id=p_tenant_id and t.status='active'
    limit 1
  ),false);
$$;
revoke all on function public.billing_is_entitled(uuid) from public,anon,authenticated;
grant execute on function public.billing_is_entitled(uuid) to service_role;

create or replace function public.billing_new_tenant_trial()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  insert into public.tenant_subscriptions(tenant_id,plan_id,status,trial_started_at,trial_ends_at)
  values(new.id,'starter','trialing',now(),now()+interval '7 days')
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;
revoke all on function public.billing_new_tenant_trial() from public,anon,authenticated;
drop trigger if exists tenants_create_billing_trial on public.tenants;
create trigger tenants_create_billing_trial after insert on public.tenants
for each row execute function public.billing_new_tenant_trial();

-- Existing organizations retain access and data; they can voluntarily choose a paid plan.
insert into public.tenant_subscriptions(tenant_id,plan_id,status)
select t.id,'legacy','grandfathered' from public.tenants t
on conflict (tenant_id) do nothing;

create or replace function public.billing_require_current_subscription()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_tenant_id uuid;
begin
  if tg_op='DELETE' then v_tenant_id := (to_jsonb(old)->>'tenant_id')::uuid;
  else v_tenant_id := (to_jsonb(new)->>'tenant_id')::uuid;
  end if;
  if v_tenant_id is null or not public.billing_is_entitled(v_tenant_id) then
    raise exception 'BILLING_REQUIRED: período de teste encerrado ou assinatura inativa. Acesse Plano e cobrança para continuar.'
      using errcode='P0001';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.billing_require_current_subscription() from public,anon,authenticated;

drop trigger if exists billing_guard_assets on public.assets;
create trigger billing_guard_assets before insert or update or delete on public.assets
for each row execute function public.billing_require_current_subscription();
drop trigger if exists billing_guard_sectors on public.sectors;
create trigger billing_guard_sectors before insert or update or delete on public.sectors
for each row execute function public.billing_require_current_subscription();
drop trigger if exists billing_guard_inventory_state on public.tenant_inventory_state;
create trigger billing_guard_inventory_state before insert or update or delete on public.tenant_inventory_state
for each row execute function public.billing_require_current_subscription();
drop trigger if exists billing_guard_movements on public.asset_movements;
create trigger billing_guard_movements before insert or update or delete on public.asset_movements
for each row execute function public.billing_require_current_subscription();
drop trigger if exists billing_guard_maintenance on public.maintenance_records;
create trigger billing_guard_maintenance before insert or update or delete on public.maintenance_records
for each row execute function public.billing_require_current_subscription();

create or replace function public.billing_enforce_asset_limit()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_limit integer; v_count integer;
begin
  if new.deleted_at is not null then return new; end if;
  if tg_op='UPDATE' then
    if old.deleted_at is null and old.tenant_id=new.tenant_id then return new; end if;
  end if;
  select p.max_assets into v_limit
  from public.tenant_subscriptions s join public.billing_plans p on p.id=s.plan_id
  where s.tenant_id=new.tenant_id;
  if v_limit is null then raise exception 'BILLING_REQUIRED: plano não encontrado.' using errcode='P0001'; end if;
  select count(*) into v_count from public.assets a
  where a.tenant_id=new.tenant_id and a.deleted_at is null
    and (tg_op='INSERT' or a.id<>new.id);
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_ASSETS: seu plano permite até % equipamentos. Faça upgrade para continuar.',v_limit
      using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.billing_enforce_asset_limit() from public,anon,authenticated;
drop trigger if exists billing_asset_quota on public.assets;
create trigger billing_asset_quota before insert or update of deleted_at,tenant_id on public.assets
for each row execute function public.billing_enforce_asset_limit();

create or replace function public.billing_enforce_user_limit()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_limit integer; v_count integer;
begin
  if new.status<>'active' then return new; end if;
  if tg_op='UPDATE' and old.status='active' and old.tenant_id=new.tenant_id then return new; end if;
  select p.max_users into v_limit
  from public.tenant_subscriptions s join public.billing_plans p on p.id=s.plan_id
  where s.tenant_id=new.tenant_id;
  if v_limit is null then raise exception 'BILLING_REQUIRED: plano não encontrado.' using errcode='P0001'; end if;
  select count(*) into v_count from public.profiles p
  where p.tenant_id=new.tenant_id and p.status='active'
    and (tg_op='INSERT' or p.user_id<>new.user_id);
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_USERS: seu plano permite até % usuários. Faça upgrade para continuar.',v_limit
      using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.billing_enforce_user_limit() from public,anon,authenticated;
drop trigger if exists billing_user_quota on public.profiles;
create trigger billing_user_quota before insert or update of status,tenant_id on public.profiles
for each row execute function public.billing_enforce_user_limit();

create or replace function public.billing_touch_updated_at()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $
begin new.updated_at=now(); return new; end;
$;
drop trigger if exists tenant_subscriptions_touch_updated_at on public.tenant_subscriptions;
create trigger tenant_subscriptions_touch_updated_at before update on public.tenant_subscriptions
for each row execute function public.billing_touch_updated_at();

comment on table public.tenant_subscriptions is 'Estado comercial por workspace; escrita somente por Edge Functions com credencial server-side.';
comment on table public.billing_webhook_events is 'Registro idempotente de notificações verificadas do Mercado Pago.';
