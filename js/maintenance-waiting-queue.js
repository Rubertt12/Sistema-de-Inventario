(() => {
  'use strict';
  if (window.__RRN_MAINTENANCE_WAITING_QUEUE__) return;
  window.__RRN_MAINTENANCE_WAITING_QUEUE__ = true;
  if (!document.getElementById('setoresContainer')) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let client=null; let items=[]; let started=false;

  function getClient(){
    if(client) return client;
    const cfg=window.RRN_SUPABASE||{};
    if(!cfg.url||!cfg.anonKey||!window.supabase?.createClient) return null;
    client=window.supabase.createClient(cfg.url,cfg.anonKey); return client;
  }

  function ensureUi(){
    if (document.getElementById('rrnMaintenanceWaiting')) return;
    if (!document.querySelector('link[data-rrn-maintenance-waiting]')) { const link=document.createElement('link'); link.rel='stylesheet'; link.href='/style/maintenance-waiting-queue.css'; link.dataset.rrnMaintenanceWaiting='1'; document.head.appendChild(link); }
    const host=document.createElement('section'); host.id='rrnMaintenanceWaiting'; host.className='rrn-maint-waiting'; host.hidden=true;
    host.innerHTML=`<div class="rrn-maint-waiting-head"><div><span>Service Desk</span><h2>Aguardando manutenção</h2><p>Equipamentos identificados pelo chat e ainda não assumidos pela equipe técnica.</p></div><button type="button" id="rrnMaintWaitingRefresh">Atualizar</button></div><div class="rrn-maint-waiting-list" id="rrnMaintWaitingList"></div>`;
    document.querySelector('main')?.insertBefore(host,document.querySelector('main').firstChild);
    document.getElementById('rrnMaintWaitingRefresh')?.addEventListener('click',load);
    host.addEventListener('click',async event=>{ const button=event.target.closest('[data-maint-action]'); if(!button||!getClient()) return; button.disabled=true; const {error}=await client.rpc('support_set_maintenance_queue_status',{p_queue_id:button.dataset.queueId,p_status:button.dataset.maintAction}); if(error){alert(error.message||'Não foi possível atualizar a fila.');button.disabled=false;return;} await load(); });
  }

  function label(item){ return item.asset_hostname||item.asset_tag||item.asset_serial||item.asset_display||item.inventory_asset_key||'Equipamento'; }
  function normalize(v){ return String(v||'').toLowerCase().trim(); }
  function decorateInventory(active){
    document.querySelectorAll('[data-rrn-waiting-badge]').forEach(el=>el.remove());
    const keys=[...new Set(active.flatMap(item=>[item.inventory_asset_key,item.asset_hostname,item.asset_tag,item.asset_serial].filter(Boolean).map(normalize)))];
    if(!keys.length) return;
    document.querySelectorAll('#setoresContainer *').forEach(node=>{ if(node.children.length>12) return; const text=normalize(node.textContent); if(!text||!keys.some(key=>text.includes(key))||node.querySelector('[data-rrn-waiting-badge]')) return; const badge=document.createElement('span'); badge.dataset.rrnWaitingBadge='1'; badge.className='rrn-waiting-badge'; badge.textContent='Aguardando manutenção'; node.appendChild(badge); });
  }
  function render(){
    ensureUi(); const host=document.getElementById('rrnMaintenanceWaiting'); const list=document.getElementById('rrnMaintWaitingList'); if(!host||!list) return;
    const active=items.filter(x=>x.status==='waiting'||x.status==='in_maintenance'); host.hidden=!active.length;
    list.innerHTML=active.map(item=>`<article class="rrn-maint-waiting-card ${item.status==='in_maintenance'?'in-progress':''}"><div class="rrn-maint-waiting-main"><span class="rrn-maint-status">${item.status==='in_maintenance'?'Em manutenção':'Aguardando manutenção'}</span><strong>${esc(label(item))}</strong><small>${esc([item.requester_name?`Solicitante: ${item.requester_name}`:null,`Protocolo vinculado`].filter(Boolean).join(' · '))}</small></div><div class="rrn-maint-waiting-actions">${item.status==='waiting'?`<button type="button" data-maint-action="in_maintenance" data-queue-id="${item.id}">Iniciar manutenção</button>`:`<button type="button" data-maint-action="completed" data-queue-id="${item.id}">Concluir manutenção</button>`}<button type="button" class="ghost" data-maint-action="cancelled" data-queue-id="${item.id}">Remover da fila</button></div></article>`).join('');
    decorateInventory(active);
  }
  async function load(){ if(!getClient()) return; try{ const {data,error}=await client.rpc('support_get_maintenance_queue'); if(error) throw error; items=Array.isArray(data)?data:[]; render(); }catch(error){ console.warn('RRN fila de manutenção:',error); } }
  async function start(){ if(started||!getClient()) return false; started=true; ensureUi(); await load(); setInterval(load,30000); return true; }
  function boot(){ if(start()) return; let tries=0; const timer=setInterval(()=>{tries++; if(start()||tries>30) clearInterval(timer);},250); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('rrn:session-ready',()=>setTimeout(load,250));
})();