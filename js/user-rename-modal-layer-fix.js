(() => {
  'use strict';

  if (window.__RRN_USER_RENAME_MODAL_LAYER_FIX__) return;
  window.__RRN_USER_RENAME_MODAL_LAYER_FIX__ = true;

  const TOP_LAYER_Z = '2147483646';

  function prepareModal() {
    const modal = document.getElementById('modalEditarUsuario');
    if (!modal) return null;

    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.zIndex = TOP_LAYER_Z;
    modal.style.background = 'rgba(12, 22, 30, .76)';
    modal.style.backdropFilter = 'blur(7px)';
    modal.style.webkitBackdropFilter = 'blur(7px)';
    modal.style.padding = '16px';
    modal.style.boxSizing = 'border-box';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('role', 'dialog');

    const panel = modal.firstElementChild;
    if (panel) {
      panel.style.width = 'min(440px, 100%)';
      panel.style.maxWidth = '440px';
      panel.style.padding = '22px';
      panel.style.borderRadius = '16px';
      panel.style.border = '1px solid rgba(41, 89, 145, .16)';
      panel.style.boxShadow = '0 24px 70px rgba(0,0,0,.35)';
    }

    return modal;
  }

  function patchOpenFunction() {
    const original = window.abrirModalEditarUsuario;
    if (typeof original !== 'function' || original.__rrnTopLayerWrapped) return;

    const wrapped = function(idMaquina, ...rest) {
      const result = original.call(this, idMaquina, ...rest);
      const modal = prepareModal();
      if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = TOP_LAYER_Z;
        requestAnimationFrame(() => {
          const input = document.getElementById('novoNomeUsuario');
          input?.focus();
          input?.select();
        });
      }
      return result;
    };

    wrapped.__rrnTopLayerWrapped = true;
    wrapped.__rrnOriginal = original;
    window.abrirModalEditarUsuario = wrapped;
  }

  function boot() {
    prepareModal();
    patchOpenFunction();

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const modal = document.getElementById('modalEditarUsuario');
      if (modal && getComputedStyle(modal).display !== 'none') window.fecharModalEditarUsuario?.();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
