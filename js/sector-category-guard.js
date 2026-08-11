(() => {
  'use strict';

  if (window.__RRN_SECTOR_CATEGORY_GUARD__) return;
  window.__RRN_SECTOR_CATEGORY_GUARD__ = true;

  const activeBySector = new Map();
  const labels = {
    computers: 'Computadores',
    monitors: 'Monitores',
    printers: 'Impressoras',
    others: 'Outros',
    all: 'Todos os equipamentos'
  };

  const normalize = value => String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  function inventory() {
    try {
      if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores;
    } catch {}
    return [];
  }

  function strictCategory(asset) {
    const explicitType = normalize(asset?.tipo);

    if (explicitType) {
      if (explicitType.includes('monitor')) return 'monitors';
      if (explicitType.includes('impress') || explicitType.includes('printer')) return 'printers';
      if (
        explicitType.includes('notebook') ||
        explicitType.includes('desktop') ||
        explicitType.includes('workstation') ||
        explicitType.includes('computador') ||
        explicitType.includes('maquina') ||
        /(^|\s)pc(\s|$)/.test(explicitType)
      ) return 'computers';
    }

    const fallback = normalize([
      asset?.categoria,
      asset?.tipoMaquina,
      asset?.nome
    ].filter(Boolean).join(' '));

    if (fallback.includes('monitor')) return 'monitors';
    if (fallback.includes('impress') || fallback.includes('printer')) return 'printers';
    if (
      fallback.includes('notebook') ||
      fallback.includes('desktop') ||
      fallback.includes('workstation') ||
      fallback.includes('computador') ||
      fallback.includes('maquina') ||
      /(^|\s)pc(\s|$)/.test(fallback)
    ) return 'computers';

    return 'others';
  }

  function assetIndexFromCard(card) {
    const direct = Number(card?.dataset?.rrnAssetIndex ?? card?.dataset?.assetIndex);
    if (Number.isInteger(direct) && direct >= 0) return direct;

    const onclick = card?.querySelector('button[onclick*="showInfo("]')?.getAttribute('onclick') || '';
    const match = onclick.match(/showInfo\(\s*\d+\s*,\s*(\d+)\s*\)/);
    return match ? Number(match[1]) : null;
  }

  function ensureBackButton(sectorIndex, category) {
    const card = document.querySelector(`.rrn-setor-card[data-setor-index="${sectorIndex}"]`);
    if (!card || !category || category === 'search') return;

    let bar = card.querySelector('.rrn-category-backbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'rrn-category-backbar rrn-category-backbar-guard';
      bar.innerHTML = `
        <div class="rrn-category-current">
          <small>Visualizando</small>
          <strong>${labels[category] || 'Equipamentos'}</strong>
        </div>
        <button type="button" class="rrn-btn rrn-btn-secondary rrn-category-back-btn rrn-category-back-guard">
          <span aria-hidden="true">←</span>
          Voltar às categorias
        </button>`;

      const machines = card.querySelector(`#maquinas-${sectorIndex}`);
      if (machines) card.insertBefore(bar, machines);
      else card.appendChild(bar);
    }

    const button = bar.querySelector('.rrn-category-back-btn');
    if (button && !button.dataset.rrnGuardBound) {
      button.dataset.rrnGuardBound = '1';
      button.addEventListener('click', event => {
        if (!button.classList.contains('rrn-category-back-guard')) return;
        event.preventDefault();
        event.stopPropagation();
        activeBySector.delete(Number(sectorIndex));
        window.RRN_SECTOR_CATEGORIES?.back?.(Number(sectorIndex));
      });
    }
  }

  function enforceSector(sectorIndex) {
    const category = activeBySector.get(Number(sectorIndex));
    if (!category || category === 'search') return;

    ensureBackButton(Number(sectorIndex), category);
    if (category === 'all') return;

    const sector = inventory()[Number(sectorIndex)];
    if (!sector || !Array.isArray(sector.maquinas)) return;

    const list = document.getElementById(`maquinas-${sectorIndex}`);
    if (!list) return;

    list.querySelectorAll('.rrn-machine-item').forEach(card => {
      const assetIndex = assetIndexFromCard(card);
      const asset = Number.isInteger(assetIndex) ? sector.maquinas[assetIndex] : null;
      const shouldShow = Boolean(asset) && strictCategory(asset) === category;

      if (shouldShow) {
        if (card.dataset.rrnCategoryGuardHidden === '1') {
          card.style.removeProperty('display');
          delete card.dataset.rrnCategoryGuardHidden;
        }
      } else if (card.style.display !== 'none' || card.dataset.rrnCategoryGuardHidden !== '1') {
        card.style.display = 'none';
        card.dataset.rrnCategoryGuardHidden = '1';
      }
    });
  }

  function enforceAll() {
    activeBySector.forEach((_, sectorIndex) => enforceSector(sectorIndex));
  }

  function scheduleEnforce(sectorIndex) {
    [0, 40, 140, 300].forEach(delay => {
      setTimeout(() => enforceSector(Number(sectorIndex)), delay);
    });
  }

  document.addEventListener('click', event => {
    const categoryButton = event.target.closest?.('.rrn-sector-category[data-category]');
    if (categoryButton) {
      const shell = categoryButton.closest('[data-sector-category-shell]');
      const sectorIndex = Number(shell?.dataset?.sectorCategoryShell);
      const category = categoryButton.dataset.category;
      if (Number.isInteger(sectorIndex) && category) {
        activeBySector.set(sectorIndex, category);
        scheduleEnforce(sectorIndex);
      }
      return;
    }

    const backButton = event.target.closest?.('.rrn-category-back-btn');
    if (backButton && !backButton.classList.contains('rrn-category-back-guard')) {
      const card = backButton.closest('.rrn-setor-card');
      const sectorIndex = Number(card?.dataset?.setorIndex);
      if (Number.isInteger(sectorIndex)) activeBySector.delete(sectorIndex);
    }
  }, true);

  function installObserver() {
    const container = document.getElementById('setoresContainer');
    if (!container) return false;

    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        enforceAll();
      });
    }).observe(container, { childList: true, subtree: true });

    return true;
  }

  function injectStyles() {
    if (document.getElementById('rrn-sector-category-guard-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-sector-category-guard-style';
    style.textContent = `
      .rrn-category-backbar-guard{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 4px;padding:10px 12px;border:1px solid rgba(41,89,145,.14);border-radius:11px;background:rgba(41,89,145,.045)}
      .rrn-category-backbar-guard .rrn-category-current{display:flex;align-items:baseline;gap:7px;min-width:0}
      .rrn-category-backbar-guard .rrn-category-current small{color:#768194;font-size:.61rem;font-weight:650}
      .rrn-category-backbar-guard .rrn-category-current strong{color:var(--rrn-blue,#295991);font-size:.72rem}
      .rrn-category-back-guard{display:inline-flex!important;align-items:center;gap:6px;visibility:visible!important;opacity:1!important}
      @media(max-width:520px){.rrn-category-backbar-guard{align-items:stretch;flex-direction:column}.rrn-category-back-guard{justify-content:center;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
    if (installObserver()) return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installObserver() || attempts >= 30) clearInterval(timer);
    }, 100);
  }

  window.RRN_SECTOR_CATEGORY_GUARD = Object.freeze({ strictCategory, enforceSector, enforceAll });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
