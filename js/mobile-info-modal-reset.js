(() => {
  'use strict';
  if (window.__RRN_MOBILE_INFO_MODAL_RESET__) return;
  window.__RRN_MOBILE_INFO_MODAL_RESET__ = true;

  let keepPinnedUntil = 0;
  let userInteracted = false;
  let rafId = 0;

  const mobile = () => Boolean(window.matchMedia?.('(max-width: 700px)').matches);
  const modal = () => document.getElementById('infoModal');
  const panel = () => document.querySelector('#infoModal > .modal-content');
  const open = () => modal()?.getAttribute('aria-hidden') === 'false';
  const imp = (el, prop, value) => el?.style?.setProperty(prop, value, 'important');

  function ensureMobileBody() {
    const content = panel();
    if (!content || !mobile()) return null;
    let body = content.querySelector(':scope > .rrn-mobile-info-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'rrn-mobile-info-body';
      const movable = [
        document.getElementById('modalText'),
        document.getElementById('maintenanceSection'),
        document.getElementById('observationsList'),
        document.getElementById('maintenanceMessage'),
        content.querySelector(':scope > .modal-actions')
      ].filter(Boolean);
      movable.forEach(node => body.appendChild(node));
      content.appendChild(body);
    }
    return body;
  }

  function enforceLayout() {
    if (!mobile() || !open()) return;
    const host = modal();
    const content = panel();
    const body = ensureMobileBody();
    if (!host || !content || !body) return;

    [
      ['position','fixed'], ['inset','0'], ['top','0'], ['right','0'], ['bottom','0'], ['left','0'],
      ['width','100vw'], ['height','100dvh'], ['min-height','100dvh'], ['max-height','100dvh'],
      ['margin','0'], ['padding','0'], ['overflow','hidden'], ['display','block'],
      ['transform','none'], ['contain','none'], ['clip-path','none'], ['z-index','2147483646']
    ].forEach(([p,v]) => imp(host,p,v));

    [
      ['position','fixed'], ['inset','0'], ['box-sizing','border-box'], ['width','100vw'], ['max-width','100vw'],
      ['height','100dvh'], ['min-height','100dvh'], ['max-height','100dvh'], ['margin','0'], ['padding','0'],
      ['display','grid'], ['grid-template-rows','auto minmax(0, 1fr)'], ['overflow','hidden'],
      ['transform','none'], ['contain','none'], ['clip-path','none'], ['border-radius','0'],
      ['background','var(--rrn-surface, #fff)']
    ].forEach(([p,v]) => imp(content,p,v));

    const header = content.querySelector(':scope > h2');
    if (header) {
      [['position','relative'],['top','auto'],['z-index','100'],['margin','0'],['padding','14px 58px 11px 14px'],
       ['background','var(--rrn-surface, #fff)'],['border-bottom','1px solid var(--rrn-border, #d7e0e4)']]
        .forEach(([p,v]) => imp(header,p,v));
    }

    const close = content.querySelector(':scope > .close-btn, :scope > .close');
    if (close) {
      [['position','fixed'],['top','8px'],['right','10px'],['z-index','2147483647'],['width','40px'],['height','40px'],['margin','0']]
        .forEach(([p,v]) => imp(close,p,v));
    }

    [
      ['position','relative'], ['min-height','0'], ['height','auto'], ['max-height','none'], ['width','100%'],
      ['box-sizing','border-box'], ['padding','12px 14px calc(22px + env(safe-area-inset-bottom, 0px))'],
      ['overflow-y','auto'], ['overflow-x','hidden'], ['overscroll-behavior-y','contain'],
      ['-webkit-overflow-scrolling','touch'], ['contain','none'], ['clip-path','none']
    ].forEach(([p,v]) => imp(body,p,v));

    const flowSelectors = [
      '#modalText', '.rrn-machine-detail-card', '.rrn-machine-modal-shell', '.rrn-machine-modal-columns',
      '.rrn-machine-modal-left', '.rrn-machine-modal-right', '.rrn-related-assets', '.rrn-agent-location-card',
      '.rrn-agent-location-meta', '.rrn-agent-location-actions', '.rrn-agent-history', '#maintenanceSection',
      '#observationsList', '#observationsUl', '.modal-actions', '#maintenanceMessage'
    ].join(',');

    body.querySelectorAll(flowSelectors).forEach(el => {
      [['position','relative'],['inset','auto'],['display','block'],['float','none'],['clear','both'],['width','100%'],
       ['max-width','100%'],['min-width','0'],['height','auto'],['min-height','0'],['max-height','none'],
       ['overflow','visible'],['transform','none'],['contain','none'],['clip-path','none'],['box-sizing','border-box']]
        .forEach(([p,v]) => imp(el,p,v));
    });

    body.querySelectorAll('.rrn-machine-modal-columns, .rrn-agent-location-meta').forEach(el => {
      imp(el,'display','grid'); imp(el,'grid-template-columns','1fr');
    });

    const map = body.querySelector('.rrn-agent-mini-map, #rrnAgentMiniMap');
    if (map) {
      [['position','relative'],['display','block'],['width','100%'],['height','220px'],['min-height','220px'],
       ['max-height','220px'],['overflow','hidden'],['transform','none'],['contain','none'],['clip-path','none']]
        .forEach(([p,v]) => imp(map,p,v));
    }
  }

  function forceTop() {
    if (!mobile() || !open() || userInteracted) return;
    enforceLayout();
    const body = panel()?.querySelector(':scope > .rrn-mobile-info-body');
    if (!body) return;
    body.scrollTop = 0;
    body.scrollTo?.({ top: 0, left: 0, behavior: 'instant' });
  }

  function pinLoop() {
    cancelAnimationFrame(rafId);
    const tick = () => {
      if (!open() || userInteracted || performance.now() >= keepPinnedUntil) return;
      forceTop();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function beginResetWindow() {
    if (!mobile()) return;
    userInteracted = false;
    keepPinnedUntil = performance.now() + 2500;
    enforceLayout();
    forceTop();
    pinLoop();
    [30,80,150,300,600,1000,1600,2200].forEach(ms => setTimeout(() => { enforceLayout(); forceTop(); }, ms));
  }

  function markUserInteraction(event) {
    if (!open()) return;
    if (event.type === 'keydown' && !['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) return;
    userInteracted = true;
    cancelAnimationFrame(rafId);
  }

  function boot() {
    const host = modal();
    if (!host) return;
    ensureMobileBody();

    new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'aria-hidden') && open()) beginResetWindow();
    }).observe(host, { attributes: true, attributeFilter: ['aria-hidden'] });

    new MutationObserver(() => {
      if (!open()) return;
      enforceLayout();
      if (performance.now() < keepPinnedUntil && !userInteracted) forceTop();
    }).observe(host, { childList: true, subtree: true, characterData: true });

    ['touchstart','pointerdown','wheel','keydown'].forEach(type => {
      host.addEventListener(type, markUserInteraction, { passive: type !== 'keydown', capture: true });
    });

    window.addEventListener('rrn:machine-location-rendered', () => {
      if (!open()) return;
      enforceLayout();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();