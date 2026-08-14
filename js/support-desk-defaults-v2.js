(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_DEFAULTS_V2__) return;
  window.__RRN_SUPPORT_DESK_DEFAULTS_V2__ = true;

  function applyDefaultFilter() {
    const requested = new URLSearchParams(location.search).get('filter');
    const filter = ['all','new','mine','sla','critical'].includes(requested) ? requested : 'new';
    const button = document.querySelector(`[data-desk-filter="${filter}"]`);
    if (!button) return false;
    if (!button.classList.contains('active')) button.click();
    document.querySelectorAll('[data-desk-filter]').forEach(item => item.classList.toggle('active', item === button));
    return true;
  }

  function boot() {
    if (applyDefaultFilter()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (applyDefaultFilter() || tries > 40) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
