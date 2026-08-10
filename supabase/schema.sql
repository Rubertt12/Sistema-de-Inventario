create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'operador' check (role in ('admin','operador','monitoramento')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_tenant_id_idx on public.profiles(tenant_id);

create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text,
  token_hash text not null unique,
  role text not null default 'operador' check (role in ('admin','operador','monitoramento')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tenant_invitations_tenant_idx on public.tenant_invitations(tenant_id);

create table if not exists public.tenant_inventory_state (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  payload jsonb not null default '{"version":1,"setores":[],"chamados":[]}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path=public as $$
  select tenant_id from public.profiles where user_id=auth.uid() and status='active' limit 1;
$$;

create or replace function public.current_role()
returns text language sql stable security definer set search_path=public as $$
  select role from public.profiles where user_id=auth.uid() and status='active' limit 1;
$$;

grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_role() to authenticated;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.tenant_inventory_state enable row level security;

drop policy if exists tenant_select_own on public.tenants;
create policy tenant_select_own on public.tenants for select to authenticated
using (id=public.current_tenant_id());

drop policy if exists tenant_admin_update on public.tenants;
create policy tenant_admin_update on public.tenants for update to authenticated
using (id=public.current_tenant_id() and public.current_role()='admin')
with check (id=public.current_tenant_id() and public.current_role()='admin');

drop policy if exists profiles_select_same_tenant on public.profiles;
create policy profiles_select_same_tenant on public.profiles for select to authenticated
using (tenant_id=public.current_tenant_id());

drop policy if exists profiles_admin_update_same_tenant on public.profiles;
create policy profiles_admin_update_same_tenant on public.profiles for update to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role()='admin')
with check (tenant_id=public.current_tenant_id());

drop policy if exists invites_admin_select on public.tenant_invitations;
create policy invites_admin_select on public.tenant_invitations for select to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role()='admin');

drop policy if exists invites_admin_insert on public.tenant_invitations;
create policy invites_admin_insert on public.tenant_invitations for insert to authenticated
with check (tenant_id=public.current_tenant_id() and public.current_role()='admin' and created_by=auth.uid());

drop policy if exists invites_admin_update on public.tenant_invitations;
create policy invites_admin_update on public.tenant_invitations for update to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role()='admin')
with check (tenant_id=public.current_tenant_id() and public.current_role()='admin');

drop policy if exists invites_admin_delete on public.tenant_invitations;
create policy invites_admin_delete on public.tenant_invitations for delete to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role()='admin');

drop policy if exists inventory_select_same_tenant on public.tenant_inventory_state;
create policy inventory_select_same_tenant on public.tenant_inventory_state for select to authenticated
using (tenant_id=public.current_tenant_id());

drop policy if exists inventory_insert_operator_admin on public.tenant_inventory_state;
create policy inventory_insert_operator_admin on public.tenant_inventory_state for insert to authenticated
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador') and updated_by=auth.uid());

drop policy if exists inventory_update_operator_admin on public.tenant_inventory_state;
create policy inventory_update_operator_admin on public.tenant_inventory_state for update to authenticated
using (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador'))
with check (tenant_id=public.current_tenant_id() and public.current_role() in ('admin','operador') and updated_by=auth.uid());

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;
$$;
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare
  v_name text := trim(coalesce(new.raw_user_meta_data->>'name',''));
  v_org_name text := trim(coalesce(new.raw_user_meta_data->>'organization_name',''));
  v_invite_code text := trim(coalesce(new.raw_user_meta_data->>'invite_code',''));
  v_invite public.tenant_invitations%rowtype;
  v_tenant_id uuid;
  v_slug_base text;
  v_slug text;
begin
  if v_name='' then v_name := split_part(coalesce(new.email,'usuario'),'@',1); end if;

  if v_invite_code<>'' then
    select * into v_invite from public.tenant_invitations
      where token_hash=encode(digest(v_invite_code,'sha256'),'hex')
        and used_at is null and expires_at>now()
        and (email is null or lower(email)=lower(new.email))
      for update;
    if not found then raise exception 'Convite inválido, expirado ou destinado a outro e-mail.'; end if;

    insert into public.profiles(user_id,tenant_id,name,email,role,status)
    values(new.id,v_invite.tenant_id,v_name,new.email,v_invite.role,'active');
    update public.tenant_invitations set used_at=now() where id=v_invite.id;
    return new;
  end if;

  if v_org_name='' then raise exception 'Informe a organização ou utilize um convite.'; end if;
  v_slug_base := trim(both '-' from regexp_replace(lower(v_org_name),'[^a-z0-9]+','-','g'));
  if v_slug_base='' then v_slug_base:='workspace'; end if;
  v_slug := v_slug_base||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);

  insert into public.tenants(name,slug) values(v_org_name,v_slug) returning id into v_tenant_id;
  insert into public.profiles(user_id,tenant_id,name,email,role,status)
  values(new.id,v_tenant_id,v_name,new.email,'admin','active');
  insert into public.tenant_inventory_state(tenant_id,payload,updated_by)
  values(v_tenant_id,'{"version":1,"setores":[],"chamados":[]}'::jsonb,new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();
