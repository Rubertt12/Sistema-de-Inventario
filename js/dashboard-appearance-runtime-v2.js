(() => {
  'use strict';
  if (window.__RRN_DASHBOARD_APPEARANCE_RUNTIME_V2__) return;
  window.__RRN_DASHBOARD_APPEARANCE_RUNTIME_V2__ = true;

  function tenantId() {
    if (window.RRN_SESSION?.tenantId) return String(window.RRN_SESSION.tenantId);
    try {
      const u = JSON.parse(localStorage.getItem('usuarioLogado') || '{}');
      return String(u.tenant_id || u.tenantId || 'local');
    } catch { return 'local'; }
  }

  const key = () => `dashboardBgConfig_${tenantId()}`;

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(key()) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch { return {}; }
  }

  function ensureStyle() {
    if (document.getElementById('rrnDashboardAppearanceRuntimeStyle')) return;
    const s = document.createElement('style');
    s.id = 'rrnDashboardAppearanceRuntimeStyle';
    s.textContent = `
      body.rrn-custom-dashboard-bg{background-color:var(--rrn-custom-dashboard-color,var(--rrn-bg,#eef2f3))!important;background-image:var(--rrn-custom-dashboard-image,none)!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;background-attachment:fixed!important}
      body.rrn-custom-dashboard-bg main,body.rrn-custom-dashboard-bg #rrnDashboardHome{background:transparent!important}
      body.rrn-custom-dashboard-bg #setoresContainer{background:transparent!important}
      html[data-theme="light"] body{color:#263238}
      html[data-theme="light"] .rrn-home-panel,html[data-theme="light"] .rrn-kpi,html[data-theme="light"] .rrn-health-item,html[data-theme="light"] .rrn-alert-item,html[data-theme="light"] .rrn-machine-item,html[data-theme="light"] .rrn-machine-detail-card{color:#263238}
      html[data-theme="light"] .rrn-home-panel p,html[data-theme="light"] .rrn-home-panel small,html[data-theme="light"] .rrn-kpi small,html[data-theme="light"] .rrn-health-copy small,html[data-theme="light"] .rrn-alert-item small,html[data-theme="light"] .rrn-machine-item small,html[data-theme="light"] .rrn-machine-detail-card small{color:#5d6c75!important}
      html[data-theme="light"] .rrn-home-panel h1,html[data-theme="light"] .rrn-home-panel h2,html[data-theme="light"] .rrn-home-panel h3,html[data-theme="light"] .rrn-home-panel h4,html[data-theme="light"] .rrn-kpi strong,html[data-theme="light"] .rrn-machine-item strong,html[data-theme="light"] .rrn-machine-detail-card strong{color:#163a4d!important}
      html[data-theme="light"] input:not([type="button"]):not([type="submit"]),html[data-theme="light"] select,html[data-theme="light"] textarea{color:#263238!important;background-color:rgba(255,255,255,.94)!important}
      html[data-theme="light"] input::placeholder,html[data-theme="light"] textarea::placeholder{color:#81909a!important}
    `;
    document.head.appendChild(s);
  }

  function safeBgImage(value) {
    if (!value) return 'none';
    return `url("${String(value).replace(/\\/g,'\\\\').replace(/"/g,'%22')}")`;
  }

  function apply() {
    ensureStyle();
    const cfg = read();
    const hasImage = Boolean(cfg.imagem);
    const hasColor = Boolean(cfg.cor);
    document.body.classList.toggle('rrn-custom-dashboard-bg', hasImage || hasColor);
    if (hasColor) document.body.style.setProperty('--rrn-custom-dashboard-color', cfg.cor);
    else document.body.style.removeProperty('--rrn-custom-dashboard-color');
    document.body.style.setProperty('--rrn-custom-dashboard-image', hasImage ? safeBgImage(cfg.imagem) : 'none');
    if (cfg.layout === 'list' || cfg.layout === 'grid') {
      try {
        if (typeof window.setLayout === 'function') window.setLayout(cfg.layout);
        else {
          const c = document.getElementById('setoresContainer');
          if (c) { c.classList.toggle('list-view', cfg.layout === 'list'); c.classList.toggle('grid-view', cfg.layout === 'grid'); }
        }
      } catch {}
    }
  }

  function removeHomeCustomizeButton(root = document) {
    root.querySelectorAll?.('[data-dashboard-customize]').forEach(el => el.remove());
  }

  function openCustomizerFromSettings() {
    const params = new URLSearchParams(location.search);
    if (params.get('customize') !== '1') return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (window.RRN_DASHBOARD_CUSTOMIZE?.open) {
        clearInterval(timer);
        history.replaceState(null, '', location.pathname + location.hash);
        window.RRN_DASHBOARD_CUSTOMIZE.open();
      } else if (tries > 120) clearInterval(timer);
    }, 50);
  }

  function boot() {
    apply();
    removeHomeCustomizeButton();
    new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(n => {
      if (n instanceof Element) removeHomeCustomizeButton(n);
    }))).observe(document.body, { childList:true, subtree:true });
    window.addEventListener('storage', e => { if (e.key === key()) apply(); });
    window.addEventListener('rrn:session-ready', apply);
    window.addEventListener('rrn:themechange', apply);
    openCustomizerFromSettings();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
