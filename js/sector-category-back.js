(() => {
  'use strict';

  if (window.__RRN_SECTOR_CATEGORY_BACK__) return;
  window.__RRN_SECTOR_CATEGORY_BACK__ = true;

  const labels = {
    computers: 'Computadores',
    monitors: 'Monitores',
    printers: 'Impressoras',
    others: 'Outros',
    all: 'Todos os equipamentos'
  };

  function showBackButton(sectorIndex, category) {
    const card = document.querySelector(`.rrn-setor-card[data-setor-index="${sectorIndex}"]`);
    if (!card) return;

    card.querySelector('.rrn-category-backbar')?.remove();

    const backbar = document.createElement('div');
    backbar.className = 'rrn-category-backbar';
    backbar.innerHTML = `
      <div class="rrn-category-current">
        <small>Visualizando</small>
        <strong>${labels[category] || 'Equipamentos'}</strong>
      </div>
      <button type="button" class="rrn-btn rrn-btn-secondary rrn-category-back-btn">
        <span aria-hidden="true">←</span>
        Voltar às categorias
      </button>`;

    backbar.querySelector('.rrn-category-back-btn')?.addEventListener('click', () => {
      window.RRN_SECTOR_CATEGORIES?.back?.(sectorIndex);
    });

    const machines = card.querySelector(`#maquinas-${sectorIndex}`);
    if (machines) card.insertBefore(backbar, machines);
  }

  function install() {
    const api = window.RRN_SECTOR_CATEGORIES;
    if (!api || api.__backEnhanced || typeof api.select !== 'function') return false;

    const originalSelect = api.select.bind(api);

    window.RRN_SECTOR_CATEGORIES = {
      ...api,
      select(sectorIndex, category) {
        originalSelect(sectorIndex, category);
        requestAnimationFrame(() => showBackButton(Number(sectorIndex), category));
      },
      back(sectorIndex) {
        const index = Number(sectorIndex);
        // Fecha e reabre imediatamente. O renderer original limpa a categoria ao reabrir.
        window.toggleMachines?.(index);
        window.toggleMachines?.(index);
      },
      __backEnhanced: true
    };

    return true;
  }

  function injectStyles() {
    if (document.getElementById('rrn-sector-category-back-style')) return;

    const style = document.createElement('style');
    style.id = 'rrn-sector-category-back-style';
    style.textContent = `
      .rrn-category-backbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 4px;padding:10px 12px;border:1px solid rgba(41,89,145,.14);border-radius:11px;background:rgba(41,89,145,.045)}
      .rrn-category-current{display:flex;align-items:baseline;gap:7px;min-width:0}
      .rrn-category-current small{color:#768194;font-size:.61rem;font-weight:650}
      .rrn-category-current strong{color:var(--rrn-blue,#295991);font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rrn-category-back-btn{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}
      @media(max-width:520px){.rrn-category-backbar{align-items:stretch;flex-direction:column}.rrn-category-back-btn{justify-content:center;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();

    if (install()) return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts >= 30) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
