(() => {
  'use strict';
  if (window.__RRN_MOBILE_INFO_MODAL_RESET__) return;
  window.__RRN_MOBILE_INFO_MODAL_RESET__ = true;

  const mobile = () => Boolean(window.matchMedia?.('(max-width: 700px)').matches);
  const modal = () => document.getElementById('infoModal');
  const panel = () => document.querySelector('#infoModal > .modal-content');
  const isOpen = () => modal()?.getAttribute('aria-hidden') === 'false';

  function unwrapBody() {
    const content = panel();
    const body = content?.querySelector(':scope > .rrn-mobile-info-body');
    if (!content || !body) return;

    const nodes = [...body.children];
    nodes.forEach(node => content.insertBefore(node, body));
    body.remove();
  }

  function buildBody() {
    const content = panel();
    if (!content || !mobile()) return null;

    unwrapBody();

    const body = document.createElement('div');
    body.className = 'rrn-mobile-info-body';
    const nodes = [
      document.getElementById('modalText'),
      document.getElementById('maintenanceSection'),
      document.getElementById('observationsList'),
      document.getElementById('maintenanceMessage'),
      content.querySelector(':scope > .modal-actions')
    ].filter(Boolean);

    nodes.forEach(node => body.appendChild(node));
    content.appendChild(body);
    return body;
  }

  function applyOpenState(resetScroll = false) {
    if (!mobile() || !isOpen()) return;
    const host = modal();
    const content = panel();
    let body = content?.querySelector(':scope > .rrn-mobile-info-body');
    if (!host || !content) return;
    if (!body) body = buildBody();
    if (!body) return;

    document.documentElement.classList.add('rrn-modal-open');
    document.body.classList.add('rrn-modal-open');

    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('z-index', '2147483000', 'important');
    content.style.removeProperty('transform');

    if (resetScroll) {
      body.scrollTop = 0;
      requestAnimationFrame(() => { if (isOpen()) body.scrollTop = 0; });
      setTimeout(() => { if (isOpen()) body.scrollTop = 0; }, 60);
    }

    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('rrn:mobile-info-layout-ready'));
    });
  }

  function openFresh() {
    if (!mobile() || !isOpen()) return;
    buildBody();
    applyOpenState(true);
  }

  function clearOpenState() {
    document.documentElement.classList.remove('rrn-modal-open');
    document.body.classList.remove('rrn-modal-open');
    unwrapBody();
  }

  function boot() {
    const host = modal();
    if (!host) return;

    new MutationObserver(records => {
      if (!records.some(record => record.attributeName === 'aria-hidden')) return;
      if (isOpen()) openFresh();
      else clearOpenState();
    }).observe(host, { attributes: true, attributeFilter: ['aria-hidden'] });

    new MutationObserver(() => {
      if (isOpen()) applyOpenState(false);
    }).observe(host, { childList: true, subtree: true });

    window.addEventListener('rrn:machine-location-rendered', () => {
      if (isOpen()) applyOpenState(false);
    });

    window.addEventListener('resize', () => {
      if (isOpen() && mobile()) applyOpenState(false);
      if (!mobile()) clearOpenState();
    });

    window.visualViewport?.addEventListener('resize', () => {
      if (isOpen()) applyOpenState(false);
    });

    if (isOpen()) openFresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();