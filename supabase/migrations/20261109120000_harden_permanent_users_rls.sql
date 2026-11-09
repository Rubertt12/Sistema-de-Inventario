-- Security hardening: preserve the permanent-user guard as a RESTRICTIVE policy.
-- The previous PERMISSIVE policy was combined with tenant policies using OR,
-- which could bypass tenant-scoped predicates for authenticated users.
-- This migration intentionally retains the original anonymous-user condition
-- while requiring it to pass in addition to each table's specific policy.

begin;

do $$
declare
  r record;
begin
  for r in
    select distinct schemaname, tablename
    from pg_policies
    where schemaname = 'public'
      and policyname = 'permanent_users_only'
      and roles @> array['authenticated']::name[]
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      'permanent_users_only', r.schemaname, r.tablename
    );

    execute format(
      'create policy %I on %I.%I as restrictive for all to authenticated
       using (coalesce((auth.jwt() ->> ''is_anonymous'')::boolean, false) = false)
       with check (coalesce((auth.jwt() ->> ''is_anonymous'')::boolean, false) = false)',
      'permanent_users_only', r.schemaname, r.tablename
    );
  end loop;
end
$$;

commit;
