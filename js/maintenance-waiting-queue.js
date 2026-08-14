(() => {
  'use strict';
  if (window.__RRN_MAINTENANCE_WAITING_QUEUE__) return;
  window.__RRN_MAINTENANCE_WAITING_QUEUE__ = true;
  if (!document.getElementById('setoresContainer')) return;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let items = [];

  function ensureUi(){
    if (document.getElementById('rrnMaintenanceWaiting')) return;
    if (!document.querySelector('link[data-rrn-maintenance-waiting]')) {
      const link=document.createElement('link'); link.rel='stylesheet'; link.href='/style/maintenance-waiting-queue.css'; link.dataset.rrnMaintenanceWaiting='1'; document.head.appendChild(link);
    }
    const host=document.createElement('section'); host.id='rrnMaintenanceWaiting'; host.className='rrn-maint-waiting'; host.hidden=true;
    host.innerHTML=`<div class="rrn-maint-waiting-head"><div><span>Service Desk</span><h2>Aguardando manutenção</h2><p>Equipamentos identificados pelo chat e ainda não assumidos pela equipe técnica.</p></div><button type="button" id="rrnMaintWaitingRefresh">Atualizar</button></div><div class="rrn-maint-waiting-list" id="rrnMaintWaitingList"></div>`;
    const main=document.querySelector('main'); main?.insertBefore(host,main.firstChild);
    document.getElementById('rrnMaintWaitingRefresh')?.addEventListener('click',load);
    host.addEventListener('click',async event=>{
      const button=event.target.closest('[data-maint-action]'); if(!button) return;
      const id=button.dataset.queueId; const status=button.dataset.maintAction; button.disabled=true;
      const {error}=await client.rpc('support_set_maintenance_queue_status',{p_queue_id:id,p_status:status});
      if(error){ alert(error.message||'Não foi possível atualizar a fila.'); button.disabled=false; return; }
      await load();
    });
  }

  function label(item){ return item.asset_hostname||item.asset_tag||item.asset_serial||item.asset_display||item.inventory_asset_key||'Equipamento'; }
  function render(){
    ensureUi();
    const host=document.getElementById('rrnMaintenanceWaiting'); const list=document.getElementById('rrnMaintWaitingList'); if(!host||!list) return;
    const active=items.filter(x=>x.status==='waiting'||x.status==='in_maintenance'); host.hidden=!active.length;
    list.innerHTML=active.map(item=>`<article class="rrn-maint-waiting-card ${item.status==='in_maintenance'?'in-progress':''}"><div class="rrn-maint-waiting-main"><span class="rrn-maint-status">${item.status==='in_maintenance'?'Em manutenção':'Aguardando manutenção'}</span><strong>${esc(label(item))}</strong><small>${esc([item.requester_name?`Solicitante: ${item.requester_name}`:null,item.ticket_id?`Chamado vinculado`:null].filter(Boolean).join(' · '))}</small></div><div class="rrn-maint-waiting-actions">${item.status==='waiting'?`<button type="button" data-maint-action="in_maintenance" data-queue-id="${item.id}">Iniciar manutenção</button>`:`<button type="button" data-maint-action="completed" data-queue-id="${item.id}">Concluir manutenção</button>`}<button type="button" class="ghost" data-maint-action="cancelled" data-queue-id="${item.id}">Remover da fila</button></div></article>`).join('');
    decorateInventory(active);
  }

  function normalize(v){ return String(v||'').toLowerCase().trim(); }
  function decorateInventory(active){
    document.querySelectorAll('[data-rrn-waiting-badge]').forEach(el=>el.remove());
    const keys=new Set(active.flatMap(item=>[item.inventory_asset_key,item.asset_hostname,item.asset_tag,item.asset_serial].filter(Boolean).map(normalize)));
    if(!keys.size) return;
    document.querySelectorAll('#setoresContainer *').forEach(node=>{
      if(node.children.length>12) return;
      const text=normalize(node.textContent);
      if(!text) return;
      const hit=[...keys].some(key=>key && text.includes(key));
      if(!hit || node.querySelector('[data-rrn-waiting-badge]')) return;
      const badge=document.createElement('span'); badge.dataset.rrnWaitingBadge='1'; badge.className='rrn-waiting-badge'; badge.textContent='Aguardando manutenção'; node.appendChild(badge);
    });
  }

  async function load(){
    try{
      const {data,error}=await client.rpc('support_get_maintenance_queue');
      if(error) throw error;
      items=Array.isArray(data)?data:[]; render();
    }catch(error){ console.warn('RRN fila de manutenção:',error); }
  }

  async function boot(){ ensureUi(); await load(); setInterval(load,30000); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('rrn:session-ready',()=>setTimeout(load,250));
})();