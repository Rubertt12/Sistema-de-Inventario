-- RRN Manager - migração do estado JSON legado para o modelo relacional
-- Execute DEPOIS de schema.sql e asset_management.sql.
-- A função só migra o tenant do usuário autenticado e exige perfil admin.

create or replace function public.migrate_legacy_inventory()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
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

  if public.current_role() <> 'admin' then
    raise exception 'Somente administradores podem executar a migração inicial.';
  end if;

  select payload into v_payload
  from public.tenant_inventory_state
  where tenant_id=v_tenant_id;

  if v_payload is null then
    return jsonb_build_object(
      'ok', true,
      'message', 'Nenhum estado legado encontrado para migrar.',
      'sectors_created', 0,
      'assets_created', 0,
      'assets_existing', 0
    );
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
      values(v_tenant_id,v_sector_name,auth.uid())
      returning id into v_sector_id;
      v_sector_count := v_sector_count + 1;
    end if;

    for v_asset in
      select value from jsonb_array_elements(coalesce(v_sector->'maquinas','[]'::jsonb))
    loop
      v_legacy_key := nullif(trim(coalesce(v_asset->>'id','')),'');
      if v_legacy_key is null then
        v_legacy_key := nullif(trim(coalesce(v_asset->>'etiqueta','')),'');
      end if;
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
        v_tenant_id,
        v_sector_id,
        v_legacy_key,
        coalesce(nullif(v_asset->>'tipo',''),'Equipamento'),
        nullif(v_asset->>'hostname',''),
        nullif(v_asset->>'nome',''),
        nullif(v_asset->>'etiqueta',''),
        nullif(v_asset->>'fabricante',''),
        nullif(v_asset->>'modelo',''),
        nullif(v_asset->>'usuarioResponsavel',''),
        nullif(v_asset->>'localizacao',''),
        v_status,
        case when coalesce(v_asset->>'dataCompra','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_asset->>'dataCompra')::date else null end,
        case when coalesce(v_asset->>'garantiaAte','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_asset->>'garantiaAte')::date else null end,
        nullif(v_asset->>'observacoesAtivo',''),
        v_asset,
        auth.uid(),
        auth.uid()
      ) returning id into v_asset_id;

      insert into public.asset_movements(
        tenant_id,asset_id,to_sector_id,movement_type,reason,details,actor_id
      ) values (
        v_tenant_id,v_asset_id,v_sector_id,'created','Migração do inventário legado',
        jsonb_build_object('legacy_key',v_legacy_key),auth.uid()
      );

      if v_status='maintenance' then
        insert into public.maintenance_records(
          tenant_id,asset_id,priority,status,description,opened_by
        ) values (
          v_tenant_id,v_asset_id,'medium','open','Importado como equipamento em manutenção.',auth.uid()
        );
      end if;

      insert into public.audit_events(
        tenant_id,actor_id,entity_type,entity_id,action,summary,after_data,metadata
      ) values (
        v_tenant_id,auth.uid(),'asset',v_asset_id::text,'migrated',
        'Equipamento migrado do inventário legado',v_asset,
        jsonb_build_object('legacy_key',v_legacy_key,'sector',v_sector_name)
      );

      v_asset_count := v_asset_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'sectors_created', v_sector_count,
    'assets_created', v_asset_count,
    'assets_existing', v_existing_count
  );
end;
$$;

grant execute on function public.migrate_legacy_inventory() to authenticated;
