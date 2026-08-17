(() => {
  'use strict';

  if (window.__RRN_CATEGORY_NAVIGATION_FIX__) return;
  window.__RRN_CATEGORY_NAVIGATION_FIX__ = true;

  const selectedBySector = new Map();

  const sectorIndexFromCard = card => {
    const value = Number(card?.dataset?.setorIndex);
    return Number.isInteger(value) && value >= 0 ? value : null;
  };

  function keepOpen(index) {
    try {
      if (typeof setoresVisiveis !== 'undefined' && Array.isArray(setoresVisiveis)) {
        setoresVisiveis[index] = true;
      }
    } catch {}
  }

  function ensureBackButton(card) {
    const index = sectorIndexFromCard(card);
    if (index == null || !selectedBySector.has(index)) return;
    if (card.querySelector('.rrn-category-back-btn')) return;

    const list = card.querySelector(`#maquinas-${index}`);
    if (!list) return;

    const bar = document.createElement('div');
    bar.className = 'rrn-category-backbar rrn-category-backbar-navfix';
    bar.innerHTML = `
      <div class="rrn-category-current">
        <small>Visualizando categoria</small>
        <strong>${selectedBySector.get(index) || 'Equipamentos'}</strong>
      </div>
      <button type="button" class="rrn-btn rrn-btn-secondary rrn-category-back-btn rrn-category-back-btn-navfix">
        <span aria-hidden="true">←</span>
        Voltar para categorias
      </button>`;

    bar.querySelector('button')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      keepOpen(index);
      selectedBySector.delete(index);
      window.RRN_SECTOR_CATEGORIES?.back?.(index);
      requestAnimationFrame(() => {
        keepOpen(index);
        window.renderSetores?.();
      });
    });

    list.before(bar);
  }

  function ensureAll() {
    document.querySelectorAll('.rrn-setor-card').forEach(ensureBackButton);
  }

  document.addEventListener('click', event => {
    const categoryButton = event.target.closest?.('.rrn-sector-category[data-category]');
    if (categoryButton) {
      const card = categoryButton.closest('.rrn-setor-card');
      const index = sectorIndexFromCard(card);
      if (index != null) {
        keepOpen(index);
        const label = categoryButton.querySelector('span')?.textContent?.trim() || 'Equipamentos';
        selectedBySector.set(index, label);
        setTimeout(ensureAll, 0);
      }
      return;
    }

    const backButton = event.target.closest?.('.rrn-category-back-btn');
    if (backButton) {
      const card = backButton.closest('.rrn-setor-card');
      const index = sectorIndexFromCard(card);
      if (index != null) {
        keepOpen(index);
        selectedBySector.delete(index);
        setTimeout(() => {
          keepOpen(index);
          window.renderSetores?.();
        }, 0);
      }
      return;
    }

    const toggleButton = event.target.closest?.('.rrn-setor-toolbar button[onclick*="toggleMachines"]');
    if (toggleButton) {
      const card = toggleButton.closest('.rrn-setor-card');
      const index = sectorIndexFromCard(card);
      if (index != null && /ocultar/i.test(toggleButton.textContent || '')) {
        selectedBySector.delete(index);
      }
    }
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .rrn-category-backbar-navfix{display:flex!important;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 4px;padding:10px 12px;border:1px solid rgba(41,89,145,.16);border-radius:11px;background:rgba(41,89,145,.05)}
    .rrn-category-back-btn-navfix{display:inline-flex!important;align-items:center;gap:6px;visibility:visible!important;opacity:1!important}
    @media(max-width:620px){.rrn-category-backbar-navfix{align-items:stretch;flex-direction:column}.rrn-category-back-btn-navfix{justify-content:center;width:100%}}
  `;
  document.head.appendChild(style);

  const bootObserver = () => {
    const container = document.getElementById('setoresContainer');
    if (!container) return false;
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ensureAll();
      });
    }).observe(container, { childList: true, subtree: true });
    ensureAll();
    return true;
  };

  if (!bootObserver()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (bootObserver() || attempts >= 30) clearInterval(timer);
    }, 100);
  }
})();
