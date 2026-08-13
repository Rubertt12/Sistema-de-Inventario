(() => {
  'use strict';
  if (window.__RRN_FOOTER_V2__) return;
  window.__RRN_FOOTER_V2__ = true;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function localUser() {
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}') || {}; }
    catch { return {}; }
  }

  function tenantContext() {
    const brand = window.RRN_TENANT_BRANDING || {};
    const user = localUser();
    const session = window.RRN_SESSION || {};
    return {
      name: brand.tenant_name || session.tenantName || user.tenant || user.tenant_name || 'RRN Manager',
      logo: brand.logo_url || '/img/icon-png.png',
      role: session.role || user.perfil || user.role || '',
      protected: true
    };
  }

  function addStylesheet(href, marker) {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '1');
    document.head.appendChild(link);
  }

  function ensureDashboardPolish() {
    const isDashboard = /dashboard\.html$/i.test(location.pathname) || Boolean(document.getElementById('setoresContainer'));
    if (!isDashboard) return;
    addStylesheet('/style/dashboard-polish-v4.css', 'data-rrn-dashboard-polish-v4');
    addStylesheet('/style/footer-dashboard-v3.css', 'data-rrn-footer-dashboard-v3');
  }

  const iconGlobe = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M3 12h18M12 3c2.3 2.45 3.5 5.45 3.5 9S14.3 18.55 12 21c-2.3-2.45-3.5-5.45-3.5-9S9.7 5.45 12 3Z"></path>
    </svg>`;

  const iconSettings = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"></path>
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.05V3h4v.05a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"></path>
    </svg>`;

  function renderDashboardFooter(footer) {
    const ctx = tenantContext();
    footer.innerHTML = `
      <div class="rrn-dashboard-footer-inner">
        <div class="rrn-dashboard-footer-company">
          <span class="rrn-dashboard-footer-logo">
            <img src="${escapeHtml(ctx.logo)}" alt="Logo de ${escapeHtml(ctx.name)}">
          </span>
          <div class="rrn-dashboard-footer-company-copy">
            <strong>${escapeHtml(ctx.name)}</strong>
            <small>RRN Manager · gestão de ativos</small>
          </div>
        </div>

        <div class="rrn-dashboard-footer-meta" aria-label="Informações do ambiente">
          <span class="rrn-dashboard-footer-status"><i></i> Ambiente ativo</span>
          <span class="rrn-dashboard-footer-year">© ${new Date().getFullYear()}</span>
        </div>

        <nav class="rrn-dashboard-footer-actions" aria-label="Ações do rodapé">
          <a class="rrn-dashboard-footer-action" href="/index.html" aria-label="Abrir site institucional">
            <span class="rrn-dashboard-footer-action-icon">${iconGlobe}</span>
            <span>Site institucional</span>
          </a>
          <button class="rrn-dashboard-footer-action rrn-dashboard-footer-action--primary" type="button" data-rrn-footer-settings aria-label="Abrir configurações">
            <span class="rrn-dashboard-footer-action-icon">${iconSettings}</span>
            <span>Configurações</span>
          </button>
        </nav>
      </div>`;
  }

  function renderGenericFooter(footer, isAuth, isAdmin) {
    const tenant = tenantContext().name;
    const nav = isAuth
      ? '<a href="/index.html">Site</a>'
      : isAdmin
        ? '<a href="/dashboard.html">Painel</a><a href="/index.html">Site</a>'
        : '<a href="/index.html">Site</a>';

    footer.innerHTML = `
      <div class="rrn-footer-main">
        <div class="rrn-footer-brand">
          <img src="/img/icon-png.png" alt="" aria-hidden="true">
          <div>
            <strong>RRN Manager</strong>
            <small>${tenant && tenant !== 'RRN Manager' ? `Ambiente: ${escapeHtml(tenant)}` : 'Gestão de ativos e inventário'}</small>
          </div>
        </div>
        <nav class="rrn-footer-nav" aria-label="Links do rodapé">${nav}</nav>
      </div>
      <div class="rrn-footer-bottom">
        <span>© ${new Date().getFullYear()} RRN Manager</span>
        <span>${tenant && tenant !== 'RRN Manager' ? 'Ambiente empresarial protegido' : 'Organização e controle para sua operação'}</span>
      </div>`;
  }

  function render() {
    document.querySelector('.rrn-footer')?.remove();
    const isAuth = Boolean(document.querySelector('.auth-shell'));
    const isAdmin = /usuarios\.html$/i.test(location.pathname) || Boolean(document.querySelector('.admin-shell'));
    const isDashboard = /dashboard\.html$/i.test(location.pathname) || Boolean(document.getElementById('setoresContainer'));
    if (!isAuth && !isAdmin && !isDashboard) return;

    const footer = document.createElement('footer');
    footer.className = `rrn-footer${isAuth ? ' rrn-footer--auth' : ''}${isAdmin ? ' rrn-footer--admin' : ''}${isDashboard ? ' rrn-footer--dashboard' : ''}`;
    footer.setAttribute('aria-label', 'Rodapé do RRN Manager');

    if (isDashboard) renderDashboardFooter(footer);
    else renderGenericFooter(footer, isAuth, isAdmin);

    document.body.appendChild(footer);
    ensureDashboardPolish();

    footer.querySelector('[data-rrn-footer-settings]')?.addEventListener('click', () => {
      location.href = '/configuracoes.html';
    });
  }

  const boot = () => setTimeout(render, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('rrn:tenantbranding', render);
  window.addEventListener('rrn:session-ready', render);
})();