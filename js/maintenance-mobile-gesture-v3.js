(() => {
  'use strict';
  if (window.__RRN_MAINTENANCE_MOBILE_GESTURE_V3__) return;
  window.__RRN_MAINTENANCE_MOBILE_GESTURE_V3__ = true;

  const isMobile = () => matchMedia('(max-width:700px)').matches;
  let startX = 0;
  let startY = 0;
  let mode = null;
  let pointerId = null;

  function panel() {
    return document.getElementById('painelManutencao');
  }

  function openDrawer() {
    const host = panel();
    if (!host || host.classList.contains('rrn-maintenance-drawer--open')) return;
    window.togglePainelManutencao?.();
  }

  function closeDrawer() {
    const host = panel();
    if (!host || !host.classList.contains('rrn-maintenance-drawer--open')) return;
    window.togglePainelManutencao?.();
  }

  document.addEventListener('pointerdown', event => {
    if (!isMobile()) return;
    const handle = event.target.closest?.('.rrn-maintenance-handle');
    const sheet = event.target.closest?.('.rrn-maintenance-sheet');
    if (!handle && !sheet) return;

    startX = event.clientX;
    startY = event.clientY;
    mode = handle ? 'open' : 'close';
    pointerId = event.pointerId;
  }, { passive:true });

  document.addEventListener('pointerup', event => {
    if (!isMobile() || mode == null || pointerId !== event.pointerId) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;

    if (horizontal && mode === 'open' && dx < -28) openDrawer();
    if (horizontal && mode === 'close' && dx > 42) closeDrawer();

    mode = null;
    pointerId = null;
  }, { passive:true });

  document.addEventListener('pointercancel', () => {
    mode = null;
    pointerId = null;
  }, { passive:true });
})();
