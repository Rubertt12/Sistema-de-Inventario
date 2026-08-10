(() => {
  'use strict';

  let root = null;
  let observer = null;

  function inventory() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function allAssets() {
    return inventory().flatMap((sector, sectorIndex) =>
      (Array.isArray(sector.maquinas) ? sector.maquinas : []).map((asset, assetIndex) => ({
        ...asset,
        __sectorName: sector.nome || `Setor ${sectorIndex + 1}`,
        __sectorIndex: sectorIndex,
        __assetIndex: assetIndex
      }))
    );
  }

  function lifecycle(asset) {
    if (asset.emManutencao) return 'maintenance';
    const value = String(asset.situacaoPatrimonial || 'ativo').toLowerCase();
    if (value.includes('estoque')) return 'stock';
    if (value.includes('emprest')) return 'loaned';
    if (value.includes('baix')) return 'retired';
    return 'active';
  }

  function dateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  function daysUntil(date) {
    if (!date) return null;
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.ceil((date.getTime() - today) / 86400000);
  }

  function metrics() {
    const assets = allAssets();
    const status = { active: 0, maintenance: 0, stock: 0, loaned: 0, retired: 0 };
    assets.forEach(asset => { status[lifecycle(asset)] = (status[lifecycle(asset)] || 0) + 1; });

    const warranties = assets
      .map(asset => ({ asset, days: daysUntil(dateOnly(asset.garantiaAte)) }))
      .filter(item => item.days != null)
      .sort((a, b) => a.days - b.days);

    return {
      assets,
      status,
      warranties,
      warrantySoon: warranties.filter(item => item.days >= 0 && item.days <= 60).length,
      warrantyExpired: warranties.filter(item => item.days < 0).length
    };
  }

  function barsBySector(assets) {
    const counts = new Map();
    assets.forEach(asset => counts.set(asset.__sectorName, (counts.get(asset.__sectorName) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  }

  function barHtml(entries) {
    if (!entries.length) return '<div class="rrn-no-alerts">Ainda não há equipamentos suficientes para gerar a distribuição.</div>';
    const max = Math.max(...entries.map(([, count]) => count), 1);
    return `<div class="rrn-bar-list">${entries.map(([label, count]) => `
      <div class="rrn-bar-row">
        <span title="${escapeHtml(label)}">${escapeHtml(label)}</span>
        <div class="rrn-bar-track"><div class="rrn-bar-fill" style="width:${Math.max(5, (count / max) * 100)}%"></div></div>
        <span class="rrn-bar-value">${count}</span>
      </div>`).join('')}</div>`;
  }

  function warrantyHtml(warranties) {
    const relevant = warranties.filter(item => item.days <= 90).slice(0, 6);
    if (!relevant.length) return '<div class="rrn-no-alerts">Nenhuma garantia vencida ou próxima do vencimento nos próximos 90 dias.</div>';
    return `<div class="rrn-alert-list">${relevant.map(({ asset, days }) => {
      const label = asset.etiqueta || asset.nome || 'Equipamento';
      const text = days < 0 ? `Venceu há ${Math.abs(days)} dia(s)` : days === 0 ? 'Vence hoje' : `Vence em ${days} dia(s)`;
      return `<div class="rrn-alert-item"><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(asset.__sectorName)}${asset.modelo ? ` · ${escapeHtml(asset.modelo)}` : ''}</small></div><span class="days">${escapeHtml(text)}</span></div>`;
    }).join('')}</div>`;
  }

  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    const overview = document.querySelector('.rrn-dashboard-overview');
    const container = document.getElementById('setoresContainer');
    if (!container) return null;

    root = document.createElement('section');
    root.className = 'rrn-insights';
    root.innerHTML = `
      <button type="button" class="rrn-insights-toggle" aria-expanded="false">
        <div><span>📊 Indicadores do inventário</span><small>Status patrimonial, ocupação por setor e garantias.</small></div>
        <span class="arrow">⌄</span>
      </button>
      <div class="rrn-insights-content"></div>`;

    const anchor = overview || container;
    anchor.parentNode.insertBefore(root, anchor.nextSibling);
    root.querySelector('.rrn-insights-toggle').addEventListener('click', () => {
      root.classList.toggle('is-open');
      root.querySelector('.rrn-insights-toggle').setAttribute('aria-expanded', root.classList.contains('is-open') ? 'true' : 'false');
      if (root.classList.contains('is-open')) render();
    });
    return root;
  }

  function render() {
    const host = ensureRoot();
    if (!host) return;
    const { assets, status, warranties, warrantySoon, warrantyExpired } = metrics();
    const content = host.querySelector('.rrn-insights-content');
    content.innerHTML = `
      <div class="rrn-insight-grid">
        <div class="rrn-insight-card"><span>Operando</span><strong>${status.active || 0}</strong><small>Ativos em uso normal</small></div>
        <div class="rrn-insight-card"><span>Manutenção</span><strong>${status.maintenance || 0}</strong><small>Equipamentos indisponíveis</small></div>
        <div class="rrn-insight-card"><span>Estoque / empréstimo</span><strong>${(status.stock || 0) + (status.loaned || 0)}</strong><small>${status.stock || 0} estoque · ${status.loaned || 0} emprestado(s)</small></div>
        <div class="rrn-insight-card"><span>Garantias</span><strong>${warrantySoon}</strong><small>${warrantyExpired} vencida(s) · próximas em 60 dias</small></div>
      </div>
      <div class="rrn-insight-columns">
        <div class="rrn-insight-panel"><h4>Equipamentos por setor</h4>${barHtml(barsBySector(assets))}</div>
        <div class="rrn-insight-panel"><h4>Atenção às garantias</h4>${warrantyHtml(warranties)}</div>
      </div>`;
  }

  function boot() {
    ensureRoot();
    render();
    const container = document.getElementById('setoresContainer');
    if (container && !observer) {
      observer = new MutationObserver(() => render());
      observer.observe(container, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('load', () => setTimeout(boot, 80));
  window.addEventListener('storage', event => { if (event.key === 'setores') render(); });

  window.RRN_INSIGHTS = Object.freeze({ refresh: render, metrics });
})();
