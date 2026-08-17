(() => {
  'use strict';
  if (window.__RRN_MOBILE_INFO_MODAL_RESET__) return;
  window.__RRN_MOBILE_INFO_MODAL_RESET__ = true;

  const mobile = () => Boolean(window.matchMedia?.('(max-width: 700px)').matches);
  const modal = () => document.getElementById('infoModal');
  const panel = () => document.querySelector('#infoModal > .modal-content');
  const isOpen = () => modal()?.getAttribute('aria-hidden') === 'false';

  function ensureBody() {
    const content = panel();
    if (!content || !mobile()) return null;

    let body = content.querySelector(':scope > .rrn-mobile-info-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'rrn-mobile-info-body';
      content.appendChild(body);
    }

    const nodes = [
      document.getElementById('modalText'),
      document.getElementById('maintenanceSection'),
      document.getElementById('observationsList'),
      document.getElementById('maintenanceMessage'),
      content.querySelector(':scope > .modal-actions')
    ].filter(Boolean);

    nodes.forEach(node => {
      if (node.parentElement !== body) body.appendChild(node);
    });
    return body;
  }

  function applyOpenState(resetScroll = false) {
    if (!mobile() || !isOpen()) return;
    const host = modal();
    const content = panel();
    const body = ensureBody();
    if (!host || !content || !body) return;

    document.documentElement.classList.add('rrn-modal-open');
    document.body.classList.add('rrn-modal-open');

    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('z-index', '2147483000', 'important');
    content.style.removeProperty('transform');

    if (resetScroll) {
      body.scrollTop = 0;
      requestAnimationFrame(() => { body.scrollTop = 0; });
      setTimeout(() => { if (isOpen()) body.scrollTop = 0; }, 80);
    }

    requestAnimationFrame(() => {
      const map = body.querySelector('#rrnAgentMiniMap');
      if (map && window.L) {
        try {
          Object.values(map._leaflet_events || {});
        } catch {}
      }
      window.dispatchEvent(new CustomEvent('rrn:mobile-info-layout-ready'));
    });
  }

  function clearOpenState() {
    document.documentElement.classList.remove('rrn-modal-open');
    document.body.classList.remove('rrn-modal-open');
  }

  function boot() {
    const host = modal();
    if (!host) return;
    ensureBody();

    new MutationObserver(records => {
      if (!records.some(record => record.attributeName === 'aria-hidden')) return;
      if (isOpen()) applyOpenState(true);
      else clearOpenState();
    }).observe(host, { attributes: true, attributeFilter: ['aria-hidden'] });

    new MutationObserver(() => {
      if (isOpen()) applyOpenState(false);
    }).observe(host, { childList: true, subtree: true });

    window.addEventListener('rrn:machine-location-rendered', () => {
      if (isOpen()) applyOpenState(false);
    });

    window.addEventListener('resize', () => {
      if (isOpen()) applyOpenState(false);
      if (!mobile()) clearOpenState();
    });

    window.visualViewport?.addEventListener('resize', () => {
      if (isOpen()) applyOpenState(false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
