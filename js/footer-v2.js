(() => {
  'use strict';
  if (window.__RRN_FOOTER_V2__) return;
  window.__RRN_FOOTER_V2__ = true;

  function tenantLabel() {
    const fromBrand = window.RRN_TENANT_BRANDING?.tenant_name;
    if (fromBrand) return fromBrand;
    try {
      const user = JSON.parse(localStorage.getItem('usuarioLogado') || '{}');
      return user.tenant || user.tenant_name || '';
    } catch { return ''; }
  }

  function render() {
    if (document.querySelector('.rrn-footer')) return;
    const isAuth = Boolean(document.querySelector('.auth-shell'));
    const isAdmin = /usuarios\.html$/i.test(location.pathname) || Boolean(document.querySelector('.admin-shell'));
    const footer = document.createElement('footer');
    footer.className = `rrn-footer${isAuth ? ' rrn-footer--auth' : ''}${isAdmin ? ' rrn-footer--admin' : ''}`;
    footer.setAttribute('aria-label', 'Rodapé do RRN Manager');
    const tenant = tenantLabel();
    footer.innerHTML = `
      <div class="rrn-footer-inner">
        <div class="rrn-footer-brand">
          <img src="/img/icon-png.png" alt="" aria-hidden="true">
          <div><strong>RRN Manager</strong><small>${tenant ? `Ambiente ${escapeHtml(tenant)}` : 'Gestão de ativos e inventário'}</small></div>
        </div>
        <div class="rrn-footer-meta">© ${new Date().getFullYear()} RRN Manager · Todos os direitos reservados</div>
      </div>`;
    document.body.appendChild(footer);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();

  window.addEventListener('rrn:tenantbranding', () => {
    const footer = document.querySelector('.rrn-footer');
    if (footer) footer.remove();
    render();
  });
})();