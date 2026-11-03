create or replace function public.billing_touch_updated_at()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;
revoke all on function public.billing_touch_updated_at() from public,anon,authenticated;
grant execute on function public.billing_is_entitled(uuid) to service_role;
grant select on public.billing_plans to service_role;
grant all on public.tenant_subscriptions to service_role;
grant all on public.billing_webhook_events to service_role;
comment on table public.billing_webhook_events is 'Acesso restrito ao backend: RLS habilitado sem políticas para anon/authenticated.';
