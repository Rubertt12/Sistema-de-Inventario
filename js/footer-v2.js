(() => {
  'use strict';
  if (window.__RRN_FOOTER_V2__) return;
  window.__RRN_FOOTER_V2__ = true;

  const path = location.pathname.toLowerCase();
  if (path === '/' || path.endsWith('/index.html')) return;

  function tenantName() {
    const brand = window.RRN_TENANT_BRANDING || {};
    const session = window.RRN_SESSION || {};
    try {
      const user = JSON.parse(localStorage.getItem('usuarioLogado') || '{}');
      return brand.tenant_name || session.tenantName || user.tenant || user.tenant_name || '';
    } catch {
      return brand.tenant_name || session.tenantName || '';
    }
  }

  function render() {
    document.querySelector('.rrn-footer')?.remove();
    const footer = document.createElement('footer');
    footer.className = 'rrn-footer rrn-footer--simple';
    footer.setAttribute('aria-label', 'Rodapé do RRN Manager');
    const tenant = tenantName();
    footer.innerHTML = `
      <div class="rrn-footer-simple-inner">
        <div class="rrn-footer-simple-brand">
          <img src="/img/icon-png.png" alt="" aria-hidden="true">
          <div><strong>RRN Manager</strong><small>${tenant && tenant !== 'RRN Manager' ? tenant : 'Gestão de ativos e suporte'}</small></div>
        </div>
        <div class="rrn-footer-simple-copy">© ${new Date().getFullYear()} · Todos os direitos reservados a <strong>Rúbertt Ramires</strong></div>
      </div>`;
    document.body.appendChild(footer);
  }

  const boot = () => setTimeout(render, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('rrn:tenantbranding', render);
  window.addEventListener('rrn:session-ready', render);
})();