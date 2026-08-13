(() => {
  'use strict';
  if (window.__RRN_FOOTER_V2__) return;
  window.__RRN_FOOTER_V2__ = true;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
  }

  function tenantLabel() {
    const fromBrand = window.RRN_TENANT_BRANDING?.tenant_name;
    if (fromBrand) return fromBrand;
    try {
      const user = JSON.parse(localStorage.getItem('usuarioLogado') || '{}');
      return user.tenant || user.tenant_name || '';
    } catch { return ''; }
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

  function render() {
    document.querySelector('.rrn-footer')?.remove();
    const isAuth = Boolean(document.querySelector('.auth-shell'));
    const isAdmin = /usuarios\.html$/i.test(location.pathname) || Boolean(document.querySelector('.admin-shell'));
    const isDashboard = /dashboard\.html$/i.test(location.pathname) || Boolean(document.getElementById('setoresContainer'));
    if (!isAuth && !isAdmin && !isDashboard) return;

    const tenant = tenantLabel();
    const footer = document.createElement('footer');
    footer.className = `rrn-footer${isAuth ? ' rrn-footer--auth' : ''}${isAdmin ? ' rrn-footer--admin' : ''}${isDashboard ? ' rrn-footer--dashboard' : ''}`;
    footer.setAttribute('aria-label', 'Rodapé do RRN Manager');

    const nav = isAuth
      ? '<a href="/index.html">Site</a>'
      : isAdmin
        ? '<a href="/dashboard.html">Painel</a><a href="/index.html">Site</a>'
        : '<a href="/index.html">Site</a><button type="button" data-rrn-footer-settings>Configurações</button>';

    footer.innerHTML = `
      <div class="rrn-footer-main">
        <div class="rrn-footer-brand">
          <img src="/img/icon-png.png" alt="" aria-hidden="true">
          <div>
            <strong>RRN Manager</strong>
            <small>${tenant ? `Ambiente: ${escapeHtml(tenant)}` : 'Gestão de ativos e inventário'}</small>
          </div>
        </div>
        <nav class="rrn-footer-nav" aria-label="Links do rodapé">${nav}</nav>
      </div>
      <div class="rrn-footer-bottom">
        <span>© ${new Date().getFullYear()} RRN Manager</span>
        <span>${tenant ? 'Ambiente empresarial protegido' : 'Organização e controle para sua operação'}</span>
      </div>`;
    document.body.appendChild(footer);
    ensureDashboardPolish();

    footer.querySelector('[data-rrn-footer-settings]')?.addEventListener('click', () => {
      if (typeof window.openConfigModal === 'function') window.openConfigModal();
      else location.href = '/configuracoes.html';
    });
  }

  const boot = () => setTimeout(render, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('rrn:tenantbranding', render);
  window.addEventListener('rrn:session-ready', render);
})();