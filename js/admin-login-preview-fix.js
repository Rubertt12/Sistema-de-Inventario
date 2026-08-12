(() => {
  'use strict';
  if (window.__RRN_ADMIN_LOGIN_PREVIEW_FIX__) return;
  window.__RRN_ADMIN_LOGIN_PREVIEW_FIX__ = true;

  function ensureStyle(href, marker) {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '1');
    document.head.appendChild(link);
  }

  function load(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-rrn-admin-src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.rrnAdminSrc = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
      document.head.appendChild(script);
    });
  }

  async function boot() {
    ensureStyle('/style/footer-v2.css', 'data-rrn-footer-v2');
    ensureStyle('/style/support-admin-permissions.css', 'data-rrn-support-admin-permissions');
    ensureStyle('/style/collaborator-management.css', 'data-rrn-collaborator-management');
    await load('/js/footer-v2.js');
    await load('/js/admin-company-ux-v2.js');
    await load('/js/support-admin-permissions.js');
    await load('/js/collaborator-management.js');
    await load('/js/collaborator-portal-access.js');
    await load('/js/admin-user-delete.js');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch(console.error), { once: true });
  else boot().catch(console.error);
})();
