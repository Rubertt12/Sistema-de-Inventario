(() => {
  'use strict';

  function getClient() {
    return window.RRN_SUPABASE_CLIENT || null;
  }

  function requireClient() {
    const client = getClient();
    if (!client) throw new Error('Backend Supabase ainda não está disponível.');
    return client;
  }

  function currentUserId() {
    return window.RRN_SESSION?.userId || null;
  }

  function normalizeError(error, fallback) {
    if (!error) return null;
    const message = error.message || fallback || 'Falha ao acessar o banco de dados.';
    const wrapped = new Error(message);
    wrapped.code = error.code;
    wrapped.details = error.details;
    wrapped.hint = error.hint;
    return wrapped;
  }

  function clean(value) {
    return typeof value === 'string' ? value.trim() : value;
  }

  async function readiness() {
    const client = getClient();
    if (!client) return { configured: false, relational: false, reason: 'Supabase não configurado.' };

    const { error } = await client.from('sectors').select('id', { head: true, count: 'exact' });
    if (error) {
      return {
        configured: true,
        relational: false,
        reason: error.code === '42P01'
          ? 'Execute supabase/asset_management.sql para habilitar o modelo relacional.'
          : error.message
      };
    }
    return { configured: true, relational: true, reason: null };
  }

  async function listSectors({ includeInactive = false } = {}) {
    const client = requireClient();
    let query = client.from('sectors').select('id,name,description,is_active,created_at,updated_at').order('name');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw normalizeError(error);
    return data || [];
  }

  async function createSector({ name, description = '' }) {
    const client = requireClient();
    const actor = currentUserId();
    const payload = { name: clean(name), description: clean(description) || null, created_by: actor };
    if (!payload.name) throw new Error('Informe o nome do setor.');

    const { data, error } = await client.from('sectors').insert(payload).select().single();
    if (error) throw normalizeError(error);
    await logAudit('sector', data.id, 'created', `Setor ${data.name} criado`, null, data);
    return data;
  }

  async function updateSector(id, changes = {}) {
    const client = requireClient();
    const allowed = ['name', 'description', 'is_active'];
    const payload = Object.fromEntries(Object.entries(changes).filter(([key]) => allowed.includes(key)));
    if ('name' in payload) payload.name = clean(payload.name);
    const before = await getSector(id);
    const { data, error } = await client.from('sectors').update(payload).eq('id', id).select().single();
    if (error) throw normalizeError(error);
    await logAudit('sector', id, 'updated', `Setor ${data.name} atualizado`, before, data);
    return data;
  }

  async function getSector(id) {
    const client = requireClient();
    const { data, error } = await client.from('sectors').select('*').eq('id', id).single();
    if (error) throw normalizeError(error);
    return data;
  }

  async function listAssets({ sectorId = null, status = null, search = '' } = {}) {
    const client = requireClient();
    let query = client
      .from('assets')
      .select('*,sectors(id,name)')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (sectorId) query = query.eq('sector_id', sectorId);
    if (status) query = query.eq('lifecycle_status', status);
    if (search) {
      const term = clean(search).replace(/[%(),]/g, ' ');
      query = query.or(`asset_tag.ilike.%${term}%,serial_number.ilike.%${term}%,hostname.ilike.%${term}%,assigned_to.ilike.%${term}%,manufacturer.ilike.%${term}%,model.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) throw normalizeError(error);
    return data || [];
  }

  async function getAsset(id) {
    const client = requireClient();
    const { data, error } = await client.from('assets').select('*,sectors(id,name)').eq('id', id).single();
    if (error) throw normalizeError(error);
    return data;
  }

  async function createAsset(input = {}) {
    const client = requireClient();
    const actor = currentUserId();
    const payload = {
      sector_id: input.sectorId || null,
      equipment_type: clean(input.equipmentType) || 'Equipamento',
      hostname: clean(input.hostname) || null,
      serial_number: clean(input.serialNumber) || null,
      asset_tag: clean(input.assetTag) || null,
      manufacturer: clean(input.manufacturer) || null,
      model: clean(input.model) || null,
      assigned_to: clean(input.assignedTo) || null,
      location: clean(input.location) || null,
      lifecycle_status: input.lifecycleStatus || 'active',
      purchased_at: input.purchasedAt || null,
      warranty_until: input.warrantyUntil || null,
      notes: clean(input.notes) || null,
      photo_url: clean(input.photoUrl) || null,
      metadata: input.metadata || {},
      created_by: actor,
      updated_by: actor
    };

    const { data, error } = await client.from('assets').insert(payload).select('*,sectors(id,name)').single();
    if (error) throw normalizeError(error);

    await client.from('asset_movements').insert({
      asset_id: data.id,
      to_sector_id: data.sector_id,
      movement_type: 'created',
      reason: 'Cadastro do ativo',
      actor_id: actor,
      details: { asset_tag: data.asset_tag, serial_number: data.serial_number }
    });
    await logAudit('asset', data.id, 'created', `Equipamento ${data.asset_tag || data.serial_number || data.id} criado`, null, data);
    return data;
  }

  async function updateAsset(id, changes = {}) {
    const client = requireClient();
    const actor = currentUserId();
    const before = await getAsset(id);
    const map = {
      equipmentType: 'equipment_type', hostname: 'hostname', serialNumber: 'serial_number', assetTag: 'asset_tag',
      manufacturer: 'manufacturer', model: 'model', assignedTo: 'assigned_to', location: 'location',
      lifecycleStatus: 'lifecycle_status', purchasedAt: 'purchased_at', warrantyUntil: 'warranty_until',
      notes: 'notes', photoUrl: 'photo_url', metadata: 'metadata'
    };
    const payload = {};
    Object.entries(map).forEach(([inputKey, dbKey]) => {
      if (inputKey in changes) payload[dbKey] = typeof changes[inputKey] === 'string' ? clean(changes[inputKey]) || null : changes[inputKey];
    });
    payload.updated_by = actor;

    const { data, error } = await client.from('assets').update(payload).eq('id', id).select('*,sectors(id,name)').single();
    if (error) throw normalizeError(error);
    await logAudit('asset', id, 'updated', `Cadastro do equipamento ${data.asset_tag || data.serial_number || id} atualizado`, before, data);
    return data;
  }

  async function moveAsset(id, toSectorId, reason = '') {
    const client = requireClient();
    const actor = currentUserId();
    const before = await getAsset(id);
    if (before.sector_id === toSectorId) return before;

    const { data, error } = await client
      .from('assets')
      .update({ sector_id: toSectorId, updated_by: actor })
      .eq('id', id)
      .select('*,sectors(id,name)')
      .single();
    if (error) throw normalizeError(error);

    const { error: movementError } = await client.from('asset_movements').insert({
      asset_id: id,
      from_sector_id: before.sector_id,
      to_sector_id: toSectorId,
      movement_type: 'transfer',
      reason: clean(reason) || 'Transferência entre setores',
      actor_id: actor,
      details: { from: before.sectors?.name || null, to: data.sectors?.name || null }
    });
    if (movementError) throw normalizeError(movementError);

    await logAudit('asset', id, 'moved', `Equipamento transferido para ${data.sectors?.name || 'outro setor'}`, before, data, { reason });
    return data;
  }

  async function retireAsset(id, reason = '') {
    const before = await getAsset(id);
    const data = await updateAsset(id, { lifecycleStatus: 'retired', notes: [before.notes, reason].filter(Boolean).join('\n') });
    const client = requireClient();
    await client.from('asset_movements').insert({
      asset_id: id,
      from_sector_id: before.sector_id,
      to_sector_id: before.sector_id,
      movement_type: 'retired',
      reason: clean(reason) || 'Baixa patrimonial',
      actor_id: currentUserId()
    });
    return data;
  }

  async function openMaintenance(assetId, { ticket = '', priority = 'medium', description = '', checklist = {} } = {}) {
    const client = requireClient();
    const actor = currentUserId();
    const before = await getAsset(assetId);

    const { data: record, error } = await client.from('maintenance_records').insert({
      asset_id: assetId,
      ticket: clean(ticket) || null,
      priority,
      status: 'open',
      description: clean(description) || null,
      checklist,
      opened_by: actor
    }).select().single();
    if (error) throw normalizeError(error);

    const { data: asset, error: assetError } = await client.from('assets')
      .update({ lifecycle_status: 'maintenance', updated_by: actor })
      .eq('id', assetId)
      .select('*,sectors(id,name)')
      .single();
    if (assetError) throw normalizeError(assetError);

    await client.from('asset_movements').insert({
      asset_id: assetId,
      from_sector_id: before.sector_id,
      to_sector_id: before.sector_id,
      movement_type: 'maintenance',
      reason: clean(description) || 'Entrada em manutenção',
      actor_id: actor,
      details: { maintenance_id: record.id, ticket: record.ticket, priority: record.priority }
    });
    await logAudit('asset', assetId, 'maintenance_started', 'Equipamento enviado para manutenção', before, asset, { maintenanceId: record.id });
    return { asset, record };
  }

  async function resolveMaintenance(recordId, resolution = '') {
    const client = requireClient();
    const actor = currentUserId();
    const { data: recordBefore, error: readError } = await client.from('maintenance_records').select('*').eq('id', recordId).single();
    if (readError) throw normalizeError(readError);
    const assetBefore = await getAsset(recordBefore.asset_id);

    const { data: record, error } = await client.from('maintenance_records').update({
      status: 'resolved',
      resolved_by: actor,
      resolved_at: new Date().toISOString(),
      description: [recordBefore.description, clean(resolution)].filter(Boolean).join('\n')
    }).eq('id', recordId).select().single();
    if (error) throw normalizeError(error);

    const { data: asset, error: assetError } = await client.from('assets')
      .update({ lifecycle_status: 'active', updated_by: actor })
      .eq('id', record.asset_id)
      .select('*,sectors(id,name)')
      .single();
    if (assetError) throw normalizeError(assetError);

    await client.from('asset_movements').insert({
      asset_id: record.asset_id,
      from_sector_id: assetBefore.sector_id,
      to_sector_id: assetBefore.sector_id,
      movement_type: 'return',
      reason: clean(resolution) || 'Liberado da manutenção',
      actor_id: actor,
      details: { maintenance_id: record.id }
    });
    await logAudit('asset', record.asset_id, 'maintenance_finished', 'Equipamento liberado da manutenção', assetBefore, asset, { maintenanceId: record.id });
    return { asset, record };
  }

  async function listAssetMovements(assetId) {
    const client = requireClient();
    const { data, error } = await client
      .from('asset_movements')
      .select('*,from_sector:from_sector_id(id,name),to_sector:to_sector_id(id,name)')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });
    if (error) throw normalizeError(error);
    return data || [];
  }

  async function listMaintenance(assetId) {
    const client = requireClient();
    const { data, error } = await client.from('maintenance_records').select('*').eq('asset_id', assetId).order('opened_at', { ascending: false });
    if (error) throw normalizeError(error);
    return data || [];
  }

  async function listAudit({ limit = 200, entityType = null, entityId = null } = {}) {
    const client = requireClient();
    let query = client.from('audit_events').select('*').order('created_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 500));
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', String(entityId));
    const { data, error } = await query;
    if (error) throw normalizeError(error);
    return data || [];
  }

  async function logAudit(entityType, entityId, action, summary, beforeData = null, afterData = null, metadata = {}) {
    const client = requireClient();
    const { data, error } = await client.rpc('log_audit_event', {
      p_entity_type: entityType,
      p_entity_id: entityId == null ? null : String(entityId),
      p_action: action,
      p_summary: summary,
      p_before_data: beforeData,
      p_after_data: afterData,
      p_metadata: metadata || {}
    });
    if (error) throw normalizeError(error);
    return data;
  }

  async function migrateLegacyInventory() {
    const client = requireClient();
    const { data, error } = await client.rpc('migrate_legacy_inventory');
    if (error) throw normalizeError(error);
    return data;
  }

  async function dashboardStats() {
    const assets = await listAssets();
    const sectors = await listSectors();
    const maintenance = assets.filter(asset => asset.lifecycle_status === 'maintenance').length;
    const stock = assets.filter(asset => asset.lifecycle_status === 'stock').length;
    const retired = assets.filter(asset => asset.lifecycle_status === 'retired').length;
    return { sectors: sectors.length, assets: assets.length, maintenance, stock, retired };
  }

  window.RRN_DB = Object.freeze({
    readiness,
    listSectors,
    getSector,
    createSector,
    updateSector,
    listAssets,
    getAsset,
    createAsset,
    updateAsset,
    moveAsset,
    retireAsset,
    openMaintenance,
    resolveMaintenance,
    listAssetMovements,
    listMaintenance,
    listAudit,
    logAudit,
    migrateLegacyInventory,
    dashboardStats
  });
})();
