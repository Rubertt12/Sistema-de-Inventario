-- RRN Manager · security hardening v6
-- Fecha autoedicao de campos estruturais no Service Desk e reforca a fila de manutencao.
-- Aplicado e validado em producao em 2026-08-28.

create or replace function public.guard_support_customer_update()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') or public.is_platform_admin() then
    return new;
  end if;

  if old.tenant_id = public.current_tenant_id() and public.current_role() = 'admin' then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.tenant_id is distinct from old.tenant_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Campos estruturais do solicitante nao podem ser alterados.';
    end if;
    return new;
  end if;

  if old.user_id = auth.uid() then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.tenant_id is distinct from old.tenant_id
       or new.status is distinct from old.status
       or new.must_change_password is distinct from old.must_change_password
       or new.temporary_password_issued_at is distinct from old.temporary_password_issued_at
       or new.password_changed_at is distinct from old.password_changed_at
       or new.created_at is distinct from old.created_at then
      raise exception 'Campos estruturais do perfil nao podem ser alterados.';
    end if;
    return new;
  end if;

  raise exception 'Sem permissao para alterar este solicitante.';
end;
$$;

revoke all on function public.guard_support_customer_update() from public, anon, authenticated;

drop trigger if exists support_customers_guard_structural_update on public.support_customers;
create trigger support_customers_guard_structural_update
before update on public.support_customers
for each row execute function public.guard_support_customer_update();

create or replace function public.guard_support_staff_update()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') or public.is_platform_admin() then
    return new;
  end if;

  if old.tenant_id = public.current_tenant_id() and public.current_role() = 'admin' then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.tenant_id is distinct from old.tenant_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Campos estruturais da equipe de suporte nao podem ser alterados.';
    end if;
    return new;
  end if;

  if old.user_id = auth.uid() then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.tenant_id is distinct from old.tenant_id
       or new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.last_seen_at is distinct from old.last_seen_at then
      raise exception 'Campos estruturais do perfil de suporte nao podem ser alterados.';
    end if;
    return new;
  end if;

  raise exception 'Sem permissao para alterar este membro da equipe de suporte.';
end;
$$;

revoke all on function public.guard_support_staff_update() from public, anon, authenticated;

drop trigger if exists support_staff_guard_structural_update on public.support_staff;
create trigger support_staff_guard_structural_update
before update on public.support_staff
for each row execute function public.guard_support_staff_update();

drop policy if exists support_maintenance_queue_staff_update on public.support_maintenance_queue;
create policy support_maintenance_queue_staff_update
on public.support_maintenance_queue
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = support_maintenance_queue.tenant_id
      and p.status='active'
      and p.role = any(array['admin'::text,'operador'::text,'monitoramento'::text])
  )
  or exists (
    select 1 from public.support_staff s
    where s.user_id = auth.uid()
      and s.tenant_id = support_maintenance_queue.tenant_id
      and s.status='active'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = support_maintenance_queue.tenant_id
      and p.status='active'
      and p.role = any(array['admin'::text,'operador'::text,'monitoramento'::text])
  )
  or exists (
    select 1 from public.support_staff s
    where s.user_id = auth.uid()
      and s.tenant_id = support_maintenance_queue.tenant_id
      and s.status='active'
  )
);
