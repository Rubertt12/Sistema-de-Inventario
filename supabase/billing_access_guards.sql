update public.billing_plans
set features='{"asset_inventory":true,"sectors":true,"movements":true,"maintenance":true,"advanced_reports":true,"audit":true}'::jsonb
where id in ('starter','professional','enterprise');

create or replace function public.billing_enforce_user_limit()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_limit integer; v_count integer;
begin
  if new.status<>'active' then return new; end if;
  if not public.billing_is_entitled(new.tenant_id) then
    raise exception 'BILLING_REQUIRED: assinatura inativa. Acesse Plano e cobrança para continuar.'
      using errcode='P0001';
  end if;
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

drop trigger if exists billing_guard_invitations on public.tenant_invitations;
create trigger billing_guard_invitations before insert or update or delete on public.tenant_invitations
for each row execute function public.billing_require_current_subscription();
