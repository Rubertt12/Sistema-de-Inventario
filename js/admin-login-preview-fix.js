(() => {
  'use strict';
  if (window.__RRN_ADMIN_LOGIN_PREVIEW_FIX__) return;
  window.__RRN_ADMIN_LOGIN_PREVIEW_FIX__ = true;

  function bind() {
    const button = document.getElementById('openLoginButton');
    if (!button || button.dataset.rrnPreviewBound === '1') return;
    button.dataset.rrnPreviewBound = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const selector = document.getElementById('tenantSelector');
      const option = selector?.selectedOptions?.[0];
      const slug = document.getElementById('tenantSlug')?.textContent?.trim();
      const tenantSlug = slug && slug !== '—' ? slug : option?.dataset?.slug;
      if (!tenantSlug) return;
      window.open(`${location.origin}/index.html?org=${encodeURIComponent(tenantSlug)}&preview=1`, '_blank', 'noopener,noreferrer');
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();