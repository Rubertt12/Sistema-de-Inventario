(() => {
  'use strict';
  if (window.__RRN_SUPPORT_COLLABORATOR_ASSETS__) return;
  window.__RRN_SUPPORT_COLLABORATOR_ASSETS__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} });
  if (!client) return;
  let assets = [];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function loadAssets() {
    const { data:{session} } = await client.auth.getSession();
    if (!session?.user) { assets = []; return; }
    const { data, error } = await client.rpc('support_my_assets');
    if (error) { console.warn('RRN meus equipamentos:', error); assets = []; return; }
    assets = data || [];
    renderSidebarSummary();
    injectWizardChoices();
  }

  function renderSidebarSummary() {
    const sidebar = document.querySelector('.support-sidebar');
    if (!sidebar) return;
    let card = document.getElementById('supportMyAssetsCard');
    if (!assets.length) { card?.remove(); return; }
    if (!card) {
      card = document.createElement('section');
      card.id = 'supportMyAssetsCard';
      card.className = 'support-my-assets-card';
      const actions = sidebar.querySelector('.support-sidebar-actions');
      sidebar.insertBefore(card, actions?.nextSibling || sidebar.querySelector('#supportTicketList'));
    }
    card.innerHTML = `<div class="support-my-assets-head"><strong>Meus equipamentos</strong><span>${assets.length}</span></div>${assets.slice(0,4).map(a => `<div class="support-my-asset-mini"><b>${esc(a.asset_label || a.equipment_type || 'Equipamento')}</b><small>${esc([a.asset_tag ? `PAT ${a.asset_tag}` : null,a.serial_number ? `SN ${a.serial_number}` : null,a.sector_name].filter(Boolean).join(' · '))}</small></div>`).join('')}${assets.length>4?`<small class="support-my-assets-more">+ ${assets.length-4} outros</small>`:''}`;
  }

  function injectWizardChoices() {
    if (!assets.length) return;
    const modal = document.getElementById('supportNewTicketModal');
    const feed = document.getElementById('supportWizardFeed');
    if (!modal || modal.hidden || !feed || feed.querySelector('[data-owned-assets-block]')) return;
    const block = document.createElement('div');
    block.className = 'support-wizard-bubble';
    block.dataset.ownedAssetsBlock = '1';
    block.innerHTML = `<strong>Seus equipamentos</strong><span class="support-owned-help">Escolha um dos ativos vinculados a você ou digite outro patrimônio/serial abaixo.</span><div class="support-owned-grid">${assets.map(a => `<button type="button" class="support-owned-asset" data-owned-asset="${esc(a.asset_key)}"><b>${esc(a.asset_label || a.equipment_type || 'Equipamento')}</b><small>${esc([a.asset_tag ? `PAT ${a.asset_tag}` : null,a.serial_number ? `SN ${a.serial_number}` : null,a.hostname ? `Host ${a.hostname}` : null,a.sector_name].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>`;
    feed.appendChild(block);
    feed.scrollTop = 0;
  }

  function chooseOwnedAsset(key) {
    const input = document.getElementById('supportWizardInput');
    const form = document.getElementById('supportWizardForm');
    if (!input || !form) return;
    input.value = key;
    form.requestSubmit();
  }

  function bind() {
    document.addEventListener('click', event => {
      const chosen = event.target.closest('[data-owned-asset]');
      if (chosen) return chooseOwnedAsset(chosen.dataset.ownedAsset);
      if (event.target.closest('#supportNewTicketBtn,[data-wizard-restart]')) setTimeout(injectWizardChoices, 40);
    });
    const modal = document.getElementById('supportNewTicketModal');
    if (modal) new MutationObserver(() => { if (!modal.hidden) setTimeout(injectWizardChoices, 20); }).observe(modal, { attributes:true, attributeFilter:['hidden'] });
    client.auth.onAuthStateChange(() => setTimeout(loadAssets, 180));
  }

  function ensureStyles() {
    if (document.getElementById('rrn-support-my-assets-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-support-my-assets-style';
    style.textContent = `.support-my-assets-card{margin:12px 0;padding:12px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:14px;background:var(--rrn-surface,#fff)}.support-my-assets-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.support-my-assets-head strong{font-size:.76rem}.support-my-assets-head span{min-width:23px;height:23px;display:grid;place-items:center;border-radius:999px;background:rgba(47,125,120,.12);color:var(--rrn-secondary,#2F7D78);font-size:.65rem;font-weight:800}.support-my-asset-mini{padding:7px 0;border-top:1px solid rgba(22,58,77,.08)}.support-my-asset-mini b,.support-my-asset-mini small{display:block}.support-my-asset-mini b{font-size:.68rem}.support-my-asset-mini small,.support-my-assets-more,.support-owned-help{margin-top:2px;color:var(--rrn-muted,#6B7780);font-size:.6rem;line-height:1.4}.support-owned-help{display:block;margin:4px 0 9px}.support-owned-grid{display:grid;gap:7px}.support-owned-asset{width:100%;padding:9px 10px;border:1px solid rgba(47,125,120,.22);border-radius:10px;text-align:left;background:rgba(47,125,120,.06);color:inherit;cursor:pointer}.support-owned-asset:hover{border-color:var(--rrn-secondary,#2F7D78);background:rgba(47,125,120,.1)}.support-owned-asset b,.support-owned-asset small{display:block}.support-owned-asset b{font-size:.7rem}.support-owned-asset small{margin-top:3px;color:var(--rrn-muted,#6B7780);font-size:.6rem}`;
    document.head.appendChild(style);
  }

  async function boot() { ensureStyles(); bind(); await loadAssets(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch(console.warn), { once:true });
  else boot().catch(console.warn);
})();
