(() => {
  'use strict';

  if (window.__RRN_COMPACT_GRID_ACTIONS__) return;
  window.__RRN_COMPACT_GRID_ACTIONS__ = true;

  const ACTIONS = [
    ['.rrn-btn-history', 'clock', 'Histórico'],
    ['.rrn-btn-edit-asset', 'edit', 'Editar'],
    ['.rrn-btn-info', 'info', 'Detalhes'],
    ['.rrn-btn-danger', 'trash', 'Lixeira']
  ];

  function decorateButton(button, icon, label) {
    if (!(button instanceof Element)) return;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.dataset.rrnCompactAction = label.toLowerCase();
    window.RRN_ICONS?.decorate?.(button, icon);
  }

  function enhance(root = document) {
    ACTIONS.forEach(([selector, icon, label]) => {
      if (root instanceof Element && root.matches(selector)) decorateButton(root, icon, label);
      root.querySelectorAll?.(selector).forEach(button => decorateButton(button, icon, label));
    });
  }

  function installStyle() {
    if (document.getElementById('rrn-compact-grid-actions-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-compact-grid-actions-style';
    style.textContent = `
      /* Ações compactas somente no grid; a lista mantém rótulos de texto. */
      #setoresContainer.grid-view .rrn-machine-actions{
        display:flex!important;
        justify-content:flex-end!important;
        align-items:center!important;
        gap:7px!important;
      }
      #setoresContainer.grid-view .rrn-machine-actions .rrn-btn{
        flex:0 0 36px!important;
        display:inline-grid!important;
        width:36px!important;
        min-width:36px!important;
        height:36px!important;
        min-height:36px!important;
        place-items:center!important;
        padding:0!important;
        border-radius:9px!important;
        font-size:0!important;
        line-height:0!important;
      }
      #setoresContainer.grid-view .rrn-machine-actions .rrn-btn .rrn-icon{
        width:17px!important;
        height:17px!important;
        margin:0!important;
      }
      #setoresContainer.grid-view .rrn-machine-actions .rrn-btn-history{
        color:#295991!important;
        border:1px solid rgba(41,89,145,.20)!important;
        background:rgba(255,255,255,.50)!important;
      }
      #setoresContainer.grid-view .rrn-machine-actions .rrn-btn-edit-asset{
        color:#295991!important;
        background:rgba(237,158,245,.16)!important;
      }
      #setoresContainer.grid-view .rrn-machine-actions .rrn-btn-info{
        color:#295991!important;
        background:rgba(242,191,79,.34)!important;
      }
      #setoresContainer.grid-view .rrn-machine-actions .rrn-btn-danger{
        color:#9b2c2c!important;
        background:rgba(255,107,107,.10)!important;
      }
      #setoresContainer.grid-view .rrn-machine-actions .rrn-btn:hover{
        transform:translateY(-1px) scale(1.03)!important;
      }

      /* Desktop usa a navegação completa. O hamburger só existe em viewport móvel. */
      .navbar .menu-toggle{
        display:none!important;
      }
      @media (max-width:768px){
        .navbar .menu-toggle{
          display:inline-grid!important;
          width:42px!important;
          min-width:42px!important;
          height:42px!important;
          place-items:center!important;
          padding:0!important;
          border:1px solid rgba(41,89,145,.20)!important;
          border-radius:11px!important;
          color:#fff!important;
          background:#295991!important;
        }
        .navbar .menu-toggle .rrn-icon{
          width:20px!important;
          height:20px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    installStyle();
    enhance();

    const container = document.getElementById('setoresContainer');
    if (!container) return;

    new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node instanceof Element) enhance(node);
      }));
    }).observe(container, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.RRN_COMPACT_ACTIONS = Object.freeze({ enhance });
})();
