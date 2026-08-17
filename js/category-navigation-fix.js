(() => {
  'use strict';

  if (window.__RRN_CATEGORY_NAVIGATION_V2_LOADER__) return;
  window.__RRN_CATEGORY_NAVIGATION_V2_LOADER__ = true;

  // Compatibility loader only. The authoritative category state, filtering
  // and "Voltar para categorias" behavior live in equipment-list-performance.js.
  // A versioned URL guarantees that clients do not keep the older cached
  // category controller after a deploy.
  const src = '/js/equipment-list-performance.js?v=20260817-4';
  if (document.querySelector(`script[data-rrn-category-v2="1"]`)) return;

  const script = document.createElement('script');
  script.src = src;
  script.async = false;
  script.dataset.rrnCategoryV2 = '1';
  script.onerror = () => console.error('RRN Manager: não foi possível carregar o controlador de categorias v2.');
  document.head.appendChild(script);
})();
