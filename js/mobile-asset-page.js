(() => {
  'use strict';
  if (window.__RRN_MOBILE_ASSET_PAGE__) return;
  window.__RRN_MOBILE_ASSET_PAGE__ = true;

  const mobile = () => Boolean(window.matchMedia?.('(max-width: 700px)').matches);
  const modal = () => document.getElementById('infoModal');
  const content = () => document.querySelector('#infoModal > .modal-content, .rrn-mobile-asset-page > .modal-content');
  let page = null;
  let originalShow = null;
  let originalClose = null;
  let installedFor = null;

  function lockPage() {
    document.documentElement.classList.add('rrn-mobile-asset-open');
    document.body.classList.add('rrn-mobile-asset-open');
  }

  function unlockPage() {
    document.documentElement.classList.remove('rrn-mobile-asset-open');
    document.body.classList.remove('rrn-mobile-asset-open');
  }

  function ensurePage() {
    if (page?.isConnected) return page;
    page = document.createElement('div');
    page.className = 'rrn-mobile-asset-page';
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-modal', 'true');
    page.setAttribute('aria-label', 'Informações da Máquina');
    document.body.appendChild(page);
    return page;
  }

  function moveToPage() {
    if (!mobile()) return;
    const host = modal();
    const panel = document.querySelector('#infoModal > .modal-content');
    if (!host || !panel) return;

    const target = ensurePage();
    target.appendChild(panel);
    host.style.setProperty('display', 'none', 'important');
    host.setAttribute('aria-hidden', 'true');
    panel.scrollTop = 0;
    lockPage();

    requestAnimationFrame(() => {
      panel.scrollTop = 0;
      window.dispatchEvent(new CustomEvent('rrn:mobile-asset-page-opened'));
    });
  }

  function restoreToModal() {
    const host = modal();
    const panel = page?.querySelector(':scope > .modal-content');
    if (host && panel) host.appendChild(panel);
    page?.remove();
    page = null;
    unlockPage();
  }

  function wrappedShow(...args) {
    if (!mobile()) return originalShow.apply(this, args);
    restoreToModal();
    const result = originalShow.apply(this, args);
    requestAnimationFrame(moveToPage);
    return result;
  }

  function wrappedClose(...args) {
    if (page?.isConnected) restoreToModal();
    return originalClose.apply(this, args);
  }

  function install() {
    if (!mobile()) return;
    if (typeof window.showInfo !== 'function' || typeof window.closeModal !== 'function') return;
    if (window.showInfo.__rrnMobileAssetPageWrapped) return;

    originalShow = window.showInfo;
    originalClose = window.closeModal;
    installedFor = originalShow;

    const show = function(...args) { return wrappedShow.apply(this, args); };
    show.__rrnMobileAssetPageWrapped = true;
    show.__rrnOriginal = originalShow;

    const close = function(...args) { return wrappedClose.apply(this, args); };
    close.__rrnMobileAssetPageWrapped = true;
    close.__rrnOriginal = originalClose;

    window.showInfo = show;
    window.closeModal = close;
  }

  function keepInstalled() {
    if (!mobile()) {
      if (page?.isConnected) restoreToModal();
      return;
    }
    if (window.showInfo !== installedFor && !window.showInfo?.__rrnMobileAssetPageWrapped) install();
  }

  window.addEventListener('resize', keepInstalled);
  window.addEventListener('pageshow', keepInstalled);
  window.addEventListener('rrn:machine-location-rendered', () => {
    const panel = content();
    if (page?.isConnected && panel) requestAnimationFrame(() => panel.scrollTop = Math.max(0, panel.scrollTop));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  [100, 300, 700, 1500, 3000].forEach(ms => setTimeout(keepInstalled, ms));
})();
