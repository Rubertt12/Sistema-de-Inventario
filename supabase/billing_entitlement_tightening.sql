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
      when s.status='authorized' then s.current_period_end is not null and s.current_period_end >= now()
      when s.status='past_due' then s.current_period_end is not null and s.current_period_end + interval '5 days' >= now()
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
