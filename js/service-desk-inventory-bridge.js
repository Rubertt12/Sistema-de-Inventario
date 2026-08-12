(() => {
  'use strict';
  if (window.__RRN_SERVICE_DESK_INVENTORY_BRIDGE__) return;
  window.__RRN_SERVICE_DESK_INVENTORY_BRIDGE__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.RRN_SUPABASE_CLIENT || window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  if (!client) return;

  const state = { tickets: [], loading: false, channel: null };
  const normalize = value => String(value ?? '').trim().toLowerCase();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusLabels = { new:'Novo', assigned:'Atribuído', in_progress:'Em atendimento', waiting_requester:'Aguardando colaborador', resolved:'Resolvido', closed:'Encerrado', reopened:'Reaberto' };
  const priorityLabels = { low:'Baixa', medium:'Média', high:'Alta', critical:'Crítica' };

  function inventory() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try { const parsed = JSON.parse(localStorage.getItem('setores') || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }

  function assetKey(asset) {
    const values = [asset?.id,asset?.assetId,asset?.asset_id,asset?.legacy_key,asset?.etiqueta,asset?.patrimonio,asset?.placa,asset?.numeroSerie,asset?.serialNumber,asset?.serial_number,asset?.hostname,asset?.hostName];
    return String(values.find(v => String(v ?? '').trim()) ?? '').trim();
  }

  function identifiers(asset) {
    return new Set([assetKey(asset),asset?.etiqueta,asset?.patrimonio,asset?.placa,asset?.numeroSerie,asset?.serialNumber,asset?.serial_number,asset?.hostname,asset?.hostName].map(normalize).filter(Boolean));
  }

  function matchingTickets(asset) {
    const ids = identifiers(asset);
    if (!ids.size) return [];
    return state.tickets.filter(ticket => [ticket.asset_key,ticket.asset_tag,ticket.serial_number,ticket.hostname].some(value => ids.has(normalize(value))));
  }

  function isOpen(ticket) { return !['resolved','closed'].includes(ticket?.status); }

  function pauseText(ticket) {
    if (!ticket?.sla_paused_at) return '';
    if (ticket.sla_pause_reason === 'maintenance_and_requester') return 'SLA pausado: manutenção + aguardando colaborador';
    if (ticket.sla_pause_reason === 'maintenance') return 'SLA pausado: equipamento em manutenção';
    if (ticket.sla_pause_reason === 'waiting_requester') return 'SLA pausado: aguardando colaborador';
    return 'SLA pausado';
  }

  function ensureStyles() {
    if (document.getElementById('rrn-service-inventory-bridge-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-service-inventory-bridge-style';
    style.textContent = `
      .rrn-service-ticket-pill{display:inline-flex;align-items:center;gap:5px;margin-left:3px;padding:3px 7px;border:1px solid rgba(47,125,120,.20);border-radius:999px;background:rgba(47,125,120,.08);color:var(--rrn-secondary,#2F7D78);font-size:.57rem;font-weight:800;white-space:nowrap}
      .rrn-service-ticket-pill.has-open{border-color:rgba(217,119,69,.26);background:rgba(217,119,69,.10);color:#8a4a1e}
      .rrn-portal-ticket-section{margin:14px 0;padding:13px;border:1px solid rgba(47,125,120,.18);border-radius:13px;background:rgba(47,125,120,.05)}
      .rrn-portal-ticket-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.rrn-portal-ticket-head strong{color:var(--rrn-heading,#163A4D);font-size:.78rem}.rrn-portal-ticket-head span{font-size:.62rem;color:var(--rrn-muted,#6B7780)}
      .rrn-portal-ticket-list{display:grid;gap:7px}.rrn-portal-ticket-row{padding:9px 10px;border:1px solid rgba(22,58,77,.10);border-radius:10px;background:var(--rrn-surface,#fff)}
      .rrn-portal-ticket-row>div{display:flex;align-items:center;justify-content:space-between;gap:10px}.rrn-portal-ticket-row strong{font-size:.7rem;color:var(--rrn-heading,#163A4D)}.rrn-portal-ticket-row p{margin:4px 0 0!important;font-size:.65rem;line-height:1.4;color:var(--rrn-text,#263238)}
      .rrn-portal-ticket-row small{display:block;margin-top:4px;color:var(--rrn-muted,#6B7780);font-size:.58rem}.rrn-portal-ticket-status{padding:3px 6px;border-radius:999px;background:rgba(47,125,120,.10);font-size:.57rem;font-weight:800;white-space:nowrap}.rrn-portal-ticket-status.maintenance{background:rgba(217,119,69,.12);color:#8a4a1e}
      .rrn-history-service-block{margin-bottom:14px;padding:12px;border:1px solid rgba(47,125,120,.18);border-radius:13px;background:rgba(47,125,120,.05)}.rrn-history-service-block>strong{display:block;margin-bottom:8px;color:var(--rrn-heading,#163A4D);font-size:.76rem}
      .rrn-history-service-item{padding:8px 0;border-top:1px solid rgba(22,58,77,.08)}.rrn-history-service-item:first-of-type{border-top:0}.rrn-history-service-item b,.rrn-history-service-item small{display:block}.rrn-history-service-item b{font-size:.68rem}.rrn-history-service-item small{margin-top:3px;color:var(--rrn-muted,#6B7780);font-size:.59rem;line-height:1.4}
      .rrn-bridge-toast{position:fixed;right:18px;bottom:18px;z-index:5000;max-width:min(360px,calc(100vw - 36px));padding:10px 13px;border-radius:10px;background:var(--rrn-primary,#163A4D);color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.18);font-size:.7rem;font-weight:700}
      :root[data-theme="dark"] .rrn-service-ticket-pill.has-open,:root[data-theme="dark"] .rrn-portal-ticket-status.maintenance{color:#f0b789}
    `;
    document.head.appendChild(style);
  }

  function toast(message) {
    let el = document.getElementById('rrnBridgeToast');
    if (!el) { el = document.createElement('div'); el.id='rrnBridgeToast'; el.className='rrn-bridge-toast'; el.hidden=true; document.body.appendChild(el); }
    el.textContent = message; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden=true; }, 2800);
  }

  async function refreshTickets() {
    if (state.loading) return;
    state.loading = true;
    try {
      const { data, error } = await client.rpc('inventory_support_ticket_overview');
      if (error) throw error;
      state.tickets = data || [];
      decorateCards();
      refreshOpenInfo();
    } catch (error) { console.warn('RRN Service Desk x Inventário:', error); }
    finally { state.loading = false; }
  }

  function cardIndexes(card) {
    const sectorIndex = Number(card.closest('.rrn-setor-card,[data-setor-index]')?.dataset.setorIndex);
    const assetIndex = Number(card.dataset.assetIndex ?? card.dataset.rrnAssetIndex);
    if (Number.isInteger(sectorIndex) && Number.isInteger(assetIndex)) return [sectorIndex,assetIndex];
    const info = [...card.querySelectorAll('button')].find(button => /showInfo\(/.test(button.getAttribute('onclick') || ''));
    const match = (info?.getAttribute('onclick') || '').match(/showInfo\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    return match ? [Number(match[1]),Number(match[2])] : null;
  }

  function decorateCards(root = document) {
    const cards = [];
    if (root instanceof Element && root.matches('.rrn-machine-item')) cards.push(root);
    root.querySelectorAll?.('.rrn-machine-item').forEach(card => cards.push(card));
    cards.forEach(card => {
      const indexes = cardIndexes(card); if (!indexes) return;
      const asset = inventory()[indexes[0]]?.maquinas?.[indexes[1]]; if (!asset) return;
      const tickets = matchingTickets(asset);
      card.querySelector('.rrn-service-ticket-pill')?.remove();
      if (!tickets.length) return;
      const open = tickets.filter(isOpen).length;
      const pill = document.createElement('span');
      pill.className = `rrn-service-ticket-pill${open ? ' has-open' : ''}`;
      pill.textContent = `🎫 ${tickets.length} ${tickets.length === 1 ? 'chamado' : 'chamados'}${open ? ` · ${open} aberto${open === 1 ? '' : 's'}` : ''}`;
      pill.title = tickets.slice(0,8).map(t => `#${t.ticket_number} · ${statusLabels[t.status] || t.status} · ${t.title}`).join('\n');
      card.querySelector('.rrn-machine-meta')?.appendChild(pill);
    });
  }

  function portalTicketsHtml(tickets) {
    const ordered = tickets.slice().sort((a,b) => new Date(b.opened_at)-new Date(a.opened_at));
    return `<section class="rrn-portal-ticket-section" id="rrnPortalTicketSection"><div class="rrn-portal-ticket-head"><strong>Chamados do Portal</strong><span>${ordered.length} vinculado${ordered.length===1?'':'s'} ao ativo</span></div><div class="rrn-portal-ticket-list">${ordered.map(ticket => { const maintenance=ticket.asset_in_maintenance&&isOpen(ticket); const status=maintenance?'Em manutenção':(statusLabels[ticket.status]||ticket.status); const pause=pauseText(ticket); return `<article class="rrn-portal-ticket-row"><div><strong>#${ticket.ticket_number} · ${esc(priorityLabels[ticket.priority]||ticket.priority||'')}</strong><span class="rrn-portal-ticket-status${maintenance?' maintenance':''}">${esc(status)}</span></div><p>${esc(ticket.title||'Chamado')}</p><small>Aberto em ${new Date(ticket.opened_at).toLocaleString('pt-BR')}${pause?` · ${esc(pause)}`:''}</small></article>`; }).join('')}</div></section>`;
  }

  function renderInfoTickets(sectorIndex, assetIndex) {
    const asset = inventory()[sectorIndex]?.maquinas?.[assetIndex];
    const modal = document.getElementById('infoModal');
    if (!asset || !modal || modal.style.display === 'none') return;
    modal.querySelector('#rrnPortalTicketSection')?.remove();
    const tickets = matchingTickets(asset); if (!tickets.length) return;
    const observations = modal.querySelector('#observationsList');
    const maintenance = modal.querySelector('#maintenanceSection');
    const host=document.createElement('div'); host.innerHTML=portalTicketsHtml(tickets); const section=host.firstElementChild;
    if (observations) observations.parentElement.insertBefore(section,observations); else if (maintenance) maintenance.parentElement.insertBefore(section,maintenance); else modal.querySelector('.modal-content')?.appendChild(section);
  }

  function refreshOpenInfo() {
    try { if (typeof maquinaAtivaSetor!=='undefined' && typeof maquinaAtivaIndex!=='undefined' && maquinaAtivaSetor!=null && maquinaAtivaIndex!=null) renderInfoTickets(Number(maquinaAtivaSetor),Number(maquinaAtivaIndex)); } catch {}
  }

  function wrapShowInfo() {
    const original=window.showInfo; if (typeof original!=='function' || original.__rrnServiceDeskInventoryWrapped) return;
    const wrapped=function(sectorIndex,assetIndex,...rest){ const result=original.call(this,sectorIndex,assetIndex,...rest); setTimeout(()=>renderInfoTickets(Number(sectorIndex),Number(assetIndex)),30); return result; };
    wrapped.__rrnServiceDeskInventoryWrapped=true; wrapped.__rrnOriginal=original; window.showInfo=wrapped;
  }

  function historyBlock(tickets) {
    const ordered=tickets.slice().sort((a,b)=>new Date(b.opened_at)-new Date(a.opened_at));
    return `<section class="rrn-history-service-block"><strong>🎫 Chamados do Portal vinculados a este equipamento</strong>${ordered.map(ticket=>{ const maintenance=ticket.asset_in_maintenance&&isOpen(ticket); const status=maintenance?'Em manutenção':(statusLabels[ticket.status]||ticket.status); const pause=pauseText(ticket); const finished=ticket.closed_at?` · encerrado ${new Date(ticket.closed_at).toLocaleString('pt-BR')}`:ticket.resolved_at?` · resolvido ${new Date(ticket.resolved_at).toLocaleString('pt-BR')}`:''; return `<div class="rrn-history-service-item"><b>#${ticket.ticket_number} · ${esc(status)} · ${esc(priorityLabels[ticket.priority]||ticket.priority||'')}</b><small>${esc(ticket.title||'Chamado')} · aberto ${new Date(ticket.opened_at).toLocaleString('pt-BR')}${finished}${pause?` · ${esc(pause)}`:''}</small></div>`; }).join('')}</section>`;
  }

  function injectHistoryForCard(card) {
    const indexes=cardIndexes(card); if (!indexes) return;
    const asset=inventory()[indexes[0]]?.maquinas?.[indexes[1]]; if (!asset) return;
    const tickets=matchingTickets(asset); if (!tickets.length) return;
    setTimeout(()=>{ const body=document.querySelector('#rrnHistoryModal.is-open #rrnHistoryBody'); if (!body || body.querySelector('.rrn-history-service-block')) return; body.insertAdjacentHTML('afterbegin',historyBlock(tickets)); },45);
  }

  function bindHistoryCapture() { document.addEventListener('click',event=>{ const button=event.target.closest('.rrn-btn-history'); if (!button) return; const card=button.closest('.rrn-machine-item'); if (card) injectHistoryForCard(card); },true); }

  function currentAssetForMaintenance() {
    try { if (typeof maquinaAtivaSetor==='undefined' || typeof maquinaAtivaIndex==='undefined' || maquinaAtivaSetor==null || maquinaAtivaIndex==null) return null; return inventory()[Number(maquinaAtivaSetor)]?.maquinas?.[Number(maquinaAtivaIndex)]||null; } catch { return null; }
  }

  async function syncMaintenance(key,enabled) {
    if (!key) return;
    const { data,error }=await client.rpc('support_set_asset_maintenance',{p_asset_key:key,p_in_maintenance:Boolean(enabled)});
    if (error) { console.warn('RRN manutenção x chamados:',error); toast('O equipamento foi atualizado, mas não foi possível sincronizar o status com os chamados.'); return; }
    if (Number(data)>0) toast(enabled?`${data} chamado(s) vinculado(s) agora estão com SLA pausado por manutenção.`:`Manutenção finalizada em ${data} chamado(s); o SLA foi retomado quando aplicável.`);
    setTimeout(refreshTickets,120);
  }

  function wrapMaintenance(name,enabled) {
    const original=window[name]; if (typeof original!=='function' || original.__rrnServiceDeskMaintenanceWrapped) return;
    const wrapped=function(...args){ const asset=currentAssetForMaintenance(); const key=assetKey(asset); const result=original.apply(this,args); const finish=()=>syncMaintenance(key,enabled).catch(console.warn); if (result&&typeof result.then==='function') return result.finally(finish); setTimeout(finish,0); return result; };
    wrapped.__rrnServiceDeskMaintenanceWrapped=true; wrapped.__rrnOriginal=original; window[name]=wrapped;
  }

  function installWrappers(){ wrapShowInfo(); wrapMaintenance('markForMaintenance',true); wrapMaintenance('releaseMachine',false); }

  function subscribe() {
    if (state.channel) return;
    state.channel=client.channel(`rrn-inventory-support-${Math.random().toString(36).slice(2)}`).on('postgres_changes',{event:'*',schema:'public',table:'support_tickets'},()=>setTimeout(refreshTickets,100)).subscribe();
  }

  async function boot() {
    ensureStyles(); installWrappers(); bindHistoryCapture(); await refreshTickets(); subscribe();
    const container=document.getElementById('setoresContainer');
    if (container) new MutationObserver(records=>{ records.forEach(record=>record.addedNodes.forEach(node=>{ if (node instanceof Element) decorateCards(node); })); }).observe(container,{childList:true,subtree:true});
    let attempts=0; const retry=setInterval(()=>{ installWrappers(); decorateCards(); attempts+=1; if (attempts>=15) clearInterval(retry); },400);
    setInterval(refreshTickets,12000);
    window.addEventListener('rrn:inventory-remote-update',()=>setTimeout(()=>{decorateCards();refreshOpenInfo();},80));
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>boot().catch(console.warn),{once:true}); else boot().catch(console.warn);
})();