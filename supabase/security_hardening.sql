-- RRN Manager - hardening final de segurança Supabase
-- Execute DEPOIS de schema.sql, asset_management.sql e migrate_legacy_inventory.sql.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select p.tenant_id
  from public.profiles as p
  where p.user_id=(select auth.uid())
    and p.status='active'
  limit 1;
$$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path=''
as $$
  select p.role
  from public.profiles as p
  where p.user_id=(select auth.uid())
    and p.status='active'
  limit 1;
$$;

revoke all on function private.current_tenant_id() from public, anon;
revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_tenant_id() to authenticated;
grant execute on function private.current_user_role() to authenticated;

-- Tabelas base
alter policy tenant_select_own on public.tenants using (id=(select private.current_tenant_id()));
alter policy tenant_admin_update on public.tenants using (id=(select private.current_tenant_id()) and (select private.current_user_role())='admin') with check (id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy profiles_select_same_tenant on public.profiles using (tenant_id=(select private.current_tenant_id()));
alter policy profiles_admin_update_same_tenant on public.profiles using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin') with check (tenant_id=(select private.current_tenant_id()));
alter policy invites_admin_select on public.tenant_invitations using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy invites_admin_insert on public.tenant_invitations with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin' and created_by=(select auth.uid()));
alter policy invites_admin_update on public.tenant_invitations using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin') with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy invites_admin_delete on public.tenant_invitations using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy inventory_select_same_tenant on public.tenant_inventory_state using (tenant_id=(select private.current_tenant_id()));
alter policy inventory_insert_operator_admin on public.tenant_inventory_state with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and updated_by=(select auth.uid()));
alter policy inventory_update_operator_admin on public.tenant_inventory_state using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador')) with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and updated_by=(select auth.uid()));

-- Modelo relacional
alter policy sectors_select_same_tenant on public.sectors using (tenant_id=(select private.current_tenant_id()));
alter policy sectors_insert_operator_admin on public.sectors with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and created_by=(select auth.uid()));
alter policy sectors_update_operator_admin on public.sectors using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador')) with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador'));
alter policy sectors_delete_admin on public.sectors using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy assets_select_same_tenant on public.assets using (tenant_id=(select private.current_tenant_id()));
alter policy assets_insert_operator_admin on public.assets with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and created_by=(select auth.uid()));
alter policy assets_update_operator_admin on public.assets using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador')) with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and updated_by=(select auth.uid()));
alter policy assets_delete_admin on public.assets using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role())='admin');
alter policy movements_select_same_tenant on public.asset_movements using (tenant_id=(select private.current_tenant_id()));
alter policy movements_insert_operator_admin on public.asset_movements with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and actor_id=(select auth.uid()));
alter policy maintenance_select_same_tenant on public.maintenance_records using (tenant_id=(select private.current_tenant_id()));
alter policy maintenance_insert_operator_admin on public.maintenance_records with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and opened_by=(select auth.uid()));
alter policy maintenance_update_operator_admin on public.maintenance_records using (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador')) with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador'));
alter policy audit_select_same_tenant on public.audit_events using (tenant_id=(select private.current_tenant_id()));
alter policy audit_insert_operator_admin on public.audit_events with check (tenant_id=(select private.current_tenant_id()) and (select private.current_user_role()) in ('admin','operador') and actor_id=(select auth.uid()));

-- Recria a RPC de auditoria usando os helpers privados e obedecendo RLS.
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
security invoker
set search_path=''
as $$
declare
  v_id uuid;
begin
  if (select private.current_user_role()) not in ('admin','operador') then
    raise exception 'Sem permissão para registrar alterações.';
  end if;

  insert into public.audit_events(
    tenant_id,actor_id,entity_type,entity_id,action,summary,before_data,after_data,metadata
  ) values (
    (select private.current_tenant_id()),(select auth.uid()),p_entity_type,p_entity_id,p_action,p_summary,
    p_before_data,p_after_data,coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.log_audit_event(text,text,text,text,jsonb,jsonb,jsonb) to authenticated;

-- Recria a migração legado usando os helpers privados e obedecendo RLS.
create or replace function public.migrate_legacy_inventory()
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_tenant_id uuid := (select private.current_tenant_id());
  v_payload jsonb;
  v_sector jsonb;
  v_asset jsonb;
  v_sector_id uuid;
  v_asset_id uuid;
  v_sector_name text;
  v_legacy_key text;
  v_status text;
  v_sector_count integer := 0;
  v_asset_count integer := 0;
  v_existing_count integer := 0;
begin
  if v_tenant_id is null then
    raise exception 'Tenant não encontrado para o usuário atual.';
  end if;
  if (select private.current_user_role()) <> 'admin' then
    raise exception 'Somente administradores podem executar a migração inicial.';
  end if;

  select payload into v_payload
  from public.tenant_inventory_state
  where tenant_id=v_tenant_id;

  if v_payload is null then
    return jsonb_build_object('ok',true,'message','Nenhum estado legado encontrado para migrar.','sectors_created',0,'assets_created',0,'assets_existing',0);
  end if;

  for v_sector in
    select value from jsonb_array_elements(coalesce(v_payload->'setores','[]'::jsonb))
  loop
    v_sector_name := trim(coalesce(v_sector->>'nome',''));
    if v_sector_name='' then v_sector_name := 'Setor sem nome'; end if;

    select id into v_sector_id
    from public.sectors
    where tenant_id=v_tenant_id and name=v_sector_name
    limit 1;

    if v_sector_id is null then
      insert into public.sectors(tenant_id,name,created_by)
      values(v_tenant_id,v_sector_name,(select auth.uid()))
      returning id into v_sector_id;
      v_sector_count := v_sector_count + 1;
    end if;

    for v_asset in
      select value from jsonb_array_elements(coalesce(v_sector->'maquinas','[]'::jsonb))
    loop
      v_legacy_key := nullif(trim(coalesce(v_asset->>'id','')),'');
      if v_legacy_key is null then v_legacy_key := nullif(trim(coalesce(v_asset->>'etiqueta','')),''); end if;
      if v_legacy_key is null then
        v_legacy_key := encode(digest(v_sector_name||'|'||coalesce(v_asset->>'nome','')||'|'||coalesce(v_asset->>'tipo','')||'|'||v_asset::text,'sha256'),'hex');
      end if;
      v_legacy_key := 'legacy:'||v_legacy_key;

      select id into v_asset_id
      from public.assets
      where tenant_id=v_tenant_id and legacy_key=v_legacy_key
      limit 1;

      if v_asset_id is not null then
        v_existing_count := v_existing_count + 1;
        continue;
      end if;

      v_status := case
        when coalesce((v_asset->>'emManutencao')::boolean,false) then 'maintenance'
        when lower(coalesce(v_asset->>'situacaoPatrimonial','')) in ('estoque','em estoque') then 'stock'
        when lower(coalesce(v_asset->>'situacaoPatrimonial',''))='emprestado' then 'loaned'
        when lower(coalesce(v_asset->>'situacaoPatrimonial',''))='baixado' then 'retired'
        else 'active'
      end;

      insert into public.assets(
        tenant_id,sector_id,legacy_key,equipment_type,hostname,serial_number,asset_tag,
        manufacturer,model,assigned_to,location,lifecycle_status,purchased_at,warranty_until,
        notes,metadata,created_by,updated_by
      ) values (
        v_tenant_id,v_sector_id,v_legacy_key,
        coalesce(nullif(v_asset->>'tipo',''),'Equipamento'),
        nullif(v_asset->>'hostname',''),nullif(v_asset->>'nome',''),nullif(v_asset->>'etiqueta',''),
        nullif(v_asset->>'fabricante',''),nullif(v_asset->>'modelo',''),nullif(v_asset->>'usuarioResponsavel',''),
        nullif(v_asset->>'localizacao',''),v_status,
        case when coalesce(v_asset->>'dataCompra','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_asset->>'dataCompra')::date else null end,
        case when coalesce(v_asset->>'garantiaAte','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_asset->>'garantiaAte')::date else null end,
        nullif(v_asset->>'observacoesAtivo',''),v_asset,(select auth.uid()),(select auth.uid())
      ) returning id into v_asset_id;

      insert into public.asset_movements(tenant_id,asset_id,to_sector_id,movement_type,reason,details,actor_id)
      values(v_tenant_id,v_asset_id,v_sector_id,'created','Migração do inventário legado',jsonb_build_object('legacy_key',v_legacy_key),(select auth.uid()));

      if v_status='maintenance' then
        insert into public.maintenance_records(tenant_id,asset_id,priority,status,description,opened_by)
        values(v_tenant_id,v_asset_id,'medium','open','Importado como equipamento em manutenção.',(select auth.uid()));
      end if;

      insert into public.audit_events(tenant_id,actor_id,entity_type,entity_id,action,summary,after_data,metadata)
      values(v_tenant_id,(select auth.uid()),'asset',v_asset_id::text,'migrated','Equipamento migrado do inventário legado',v_asset,jsonb_build_object('legacy_key',v_legacy_key,'sector',v_sector_name));

      v_asset_count := v_asset_count + 1;
    end loop;
  end loop;

  return jsonb_build_object('ok',true,'sectors_created',v_sector_count,'assets_created',v_asset_count,'assets_existing',v_existing_count);
end;
$$;
revoke all on function public.migrate_legacy_inventory() from public, anon;
grant execute on function public.migrate_legacy_inventory() to authenticated;

-- Trigger functions não devem ficar expostas como RPCs.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
grant execute on function public.handle_new_auth_user() to supabase_auth_admin;
alter function public.touch_updated_at() set search_path='';
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Nenhuma tabela de negócio é acessível ao papel anon.
revoke all on public.tenants from anon;
revoke all on public.profiles from anon;
revoke all on public.tenant_invitations from anon;
revoke all on public.tenant_inventory_state from anon;
revoke all on public.sectors from anon;
revoke all on public.assets from anon;
revoke all on public.asset_movements from anon;
revoke all on public.maintenance_records from anon;
revoke all on public.audit_events from anon;

-- Remove helpers SECURITY DEFINER do schema exposto somente após migrar policies e RPCs.
drop function public.current_role();
drop function public.current_tenant_id();
