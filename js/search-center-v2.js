(() => {
  'use strict';
  if (window.__RRN_SEARCH_CENTER_V2__) return;
  window.__RRN_SEARCH_CENTER_V2__ = true;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value ?? '').trim().toLowerCase();

  function getSectors() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try { const data = JSON.parse(localStorage.getItem('setores') || '[]'); return Array.isArray(data) ? data : []; } catch { return []; }
  }

  function tickets(machine) {
    if (Array.isArray(machine?.chamados)) return machine.chamados;
    if (Array.isArray(machine?.chamado)) return machine.chamado;
    return [];
  }

  function searchable(asset, sector) {
    return [asset?.nome, asset?.etiqueta, asset?.tipo, asset?.tipoMaquina, asset?.usuarioResponsavel, asset?.fabricante, asset?.modelo, asset?.localizacao, asset?.situacaoPatrimonial, sector?.nome]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function find(query) {
    const q = norm(query);
    if (!q) return [];
    const out = [];
    getSectors().forEach((sector, sectorIndex) => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach((asset, assetIndex) => {
        if (!searchable(asset, sector).includes(q)) return;
        out.push({ sector, sectorIndex, asset, assetIndex, ticketCount: tickets(asset).length });
      });
    });
    return out.slice(0, 50);
  }

  function ensureUi() {
    if (document.getElementById('rrnSearchCenter')) return;
    const main = document.querySelector('main');
    if (!main) return;

    const section = document.createElement('section');
    section.id = 'rrnSearchCenter';
    section.className = 'rrn-search-center';
    section.hidden = true;
    section.innerHTML = `
      <div class="rrn-search-head">
        <div><span class="rrn-search-eyebrow">Consulta de ativos</span><h2>Pesquisa de máquinas</h2><p>Localize rapidamente um equipamento e acesse o histórico de chamados do setor.</p></div>
      </div>
      <div class="rrn-search-box"><input type="search" id="rrnGlobalAssetSearch" placeholder="Pesquise por série, etiqueta, usuário, modelo, tipo ou setor" autocomplete="off"><span id="rrnSearchCount">Digite para pesquisar</span></div>
      <div id="rrnSearchResults" class="rrn-search-results"><div class="rrn-search-empty">Os resultados aparecerão aqui.</div></div>`;
    main.prepend(section);

    const input = document.getElementById('rrnGlobalAssetSearch');
    input?.addEventListener('input', () => renderResults(input.value));
    window.addEventListener('rrn:remote-sync-applied', () => input?.value && renderResults(input.value));
    installTab();
  }

  function renderResults(query) {
    const container = document.getElementById('rrnSearchResults');
    const count = document.getElementById('rrnSearchCount');
    if (!container || !count) return;
    const q = norm(query);
    if (!q) {
      count.textContent = 'Digite para pesquisar';
      container.innerHTML = '<div class="rrn-search-empty">Os resultados aparecerão aqui.</div>';
      return;
    }
    const results = find(q);
    count.textContent = `${results.length} resultado${results.length === 1 ? '' : 's'}`;
    if (!results.length) {
      container.innerHTML = '<div class="rrn-search-empty">Nenhum equipamento encontrado.</div>';
      return;
    }
    container.innerHTML = results.map(({ sector, sectorIndex, asset, assetIndex, ticketCount }) => `
      <article class="rrn-search-result">
        <div class="rrn-search-result-main">
          <div class="rrn-search-result-title"><strong>${esc(asset?.nome || asset?.etiqueta || 'Equipamento')}</strong><span>${esc(asset?.tipo || 'Equipamento')}</span></div>
          <div class="rrn-search-meta">
            <span><b>Setor</b>${esc(sector?.nome || 'Sem setor')}</span>
            <span><b>Etiqueta</b>${esc(asset?.etiqueta || '—')}</span>
            <span><b>Responsável</b>${esc(asset?.usuarioResponsavel || '—')}</span>
            <span><b>Modelo</b>${esc(asset?.modelo || asset?.fabricante || '—')}</span>
            <span><b>Status</b>${asset?.emManutencao ? 'Em manutenção' : 'Operando'}</span>
            <span><b>Chamados</b>${ticketCount}</span>
          </div>
        </div>
        <div class="rrn-search-actions">
          <button type="button" data-search-info="${sectorIndex}:${assetIndex}">Ver equipamento</button>
          <a href="/chamados-setor.html?setor=${sectorIndex}&maquina=${encodeURIComponent(asset?.id || assetIndex)}">Chamados do setor</a>
        </div>
      </article>`).join('');
    container.querySelectorAll('[data-search-info]').forEach(button => {
      button.addEventListener('click', () => {
        const [sectorIndex, assetIndex] = button.dataset.searchInfo.split(':').map(Number);
        if (typeof window.showInfo === 'function') window.showInfo(sectorIndex, assetIndex);
      });
    });
  }

  function installTab() {
    const inventory = document.getElementById('setoresContainer');
    const home = document.getElementById('rrnDashboardHome');
    const search = document.getElementById('rrnSearchCenter');
    if (!inventory || !search) return;

    const navbar = document.querySelector('.navbar .nav-links, .nav-links');
    if (!navbar || document.getElementById('rrnSearchTabButton')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'rrnSearchTabButton';
    button.className = 'rrn-search-tab-button';
    button.textContent = 'Pesquisa';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.insertAdjacentElement('beforebegin', button); else navbar.prepend(button);

    const activate = () => {
      if (home) home.hidden = true;
      inventory.style.display = 'none';
      document.getElementById('paginacaoSetores')?.style && (document.getElementById('paginacaoSetores').style.display = 'none');
      search.hidden = false;
      document.body.dataset.rrnView = 'search';
      location.hash = 'pesquisa';
      setTimeout(() => document.getElementById('rrnGlobalAssetSearch')?.focus(), 0);
    };
    button.addEventListener('click', activate);

    document.addEventListener('click', event => {
      if (!event.target.closest('[data-home-action="inventory"], [data-rrn-tab="inventory"], [href="#inventario"], [href="#dashboard"]')) return;
      search.hidden = true;
      document.getElementById('paginacaoSetores')?.style && (document.getElementById('paginacaoSetores').style.display = '');
    }, true);

    if (location.hash === '#pesquisa') activate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUi, { once: true });
  else ensureUi();
  setTimeout(ensureUi, 700);
})();