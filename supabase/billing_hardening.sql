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
comment on table public.billing_webhook_events is 'Acesso restrito ao backend: RLS habilitado sem políticas para anon/authenticated.';
