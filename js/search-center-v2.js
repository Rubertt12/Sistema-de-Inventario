(() => {
  'use strict';
  if (window.__RRN_SEARCH_CENTER_V3__) return;
  window.__RRN_SEARCH_CENTER_V3__ = true;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value ?? '').trim().toLowerCase();
  let timer = null;

  function getSectors() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const raw = localStorage.getItem('setores');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function ticketList(machine) {
    if (Array.isArray(machine?.chamados)) return machine.chamados;
    if (Array.isArray(machine?.chamado)) return machine.chamado;
    return [];
  }

  function machineKey(machine, index) {
    return String(machine?.id ?? machine?.uuid ?? machine?.etiqueta ?? index);
  }

  function searchable(machine, sector) {
    return [
      machine?.nome, machine?.etiqueta, machine?.tipo, machine?.tipoMaquina,
      machine?.usuarioResponsavel, machine?.fabricante, machine?.modelo,
      machine?.localizacao, machine?.situacaoPatrimonial, sector?.nome
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function findMachines(query) {
    const q = norm(query);
    if (!q) return [];
    const found = [];
    getSectors().forEach((sector, sectorIndex) => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach((machine, assetIndex) => {
        if (!searchable(machine, sector).includes(q)) return;
        found.push({ sector, sectorIndex, machine, assetIndex });
      });
    });
    return found.slice(0, 8);
  }

  function ensureResultsHost(input) {
    let host = document.getElementById('rrnNavbarSearchResults');
    if (host) return host;
    const wrapper = document.createElement('div');
    wrapper.className = 'rrn-navbar-search-wrap';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    host = document.createElement('div');
    host.id = 'rrnNavbarSearchResults';
    host.className = 'rrn-navbar-search-results';
    host.hidden = true;
    wrapper.appendChild(host);
    return host;
  }

  function closeResults() {
    const host = document.getElementById('rrnNavbarSearchResults');
    if (host) host.hidden = true;
  }

  function openAsset(sectorIndex, assetIndex) {
    window.RRN_TABS?.setTab?.('inventory');
    if (typeof window.setTab === 'function') window.setTab('inventory');
    setTimeout(() => {
      if (typeof window.showInfo === 'function') window.showInfo(sectorIndex, assetIndex);
    }, 80);
  }

  function render(query) {
    const input = document.getElementById('searchInput');
    if (!input) return;
    const host = ensureResultsHost(input);
    const q = norm(query);
    if (!q) {
      host.innerHTML = '';
      host.hidden = true;
      return;
    }

    const results = findMachines(q);
    host.hidden = false;
    if (!results.length) {
      host.innerHTML = '<div class="rrn-navbar-search-empty">Nenhuma máquina encontrada.</div>';
      return;
    }

    host.innerHTML = `
      <div class="rrn-navbar-search-caption">${results.length} resultado${results.length === 1 ? '' : 's'}</div>
      ${results.map(({ sector, sectorIndex, machine, assetIndex }) => {
        const ticketCount = ticketList(machine).length;
        return `<article class="rrn-navbar-search-card">
          <button type="button" class="rrn-navbar-search-machine" data-open-machine="${sectorIndex}:${assetIndex}">
            <strong>${esc(machine?.nome || machine?.etiqueta || 'Equipamento')}</strong>
            <span>${esc(machine?.tipo || 'Equipamento')} · ${esc(machine?.etiqueta || 'sem etiqueta')}</span>
            <small>${esc(sector?.nome || 'Sem setor')} · ${esc(machine?.usuarioResponsavel || 'sem responsável')}</small>
          </button>
          <a class="rrn-navbar-ticket-link" href="/chamados-setor.html?setor=${sectorIndex}&maquina=${encodeURIComponent(machineKey(machine, assetIndex))}">
            Chamados <b>${ticketCount}</b>
          </a>
        </article>`;
      }).join('')}`;

    host.querySelectorAll('[data-open-machine]').forEach(button => {
      button.addEventListener('click', () => {
        const [sectorIndex, assetIndex] = button.dataset.openMachine.split(':').map(Number);
        closeResults();
        openAsset(sectorIndex, assetIndex);
      });
    });
  }

  function boot() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    // A busca existente vira consulta global; não cria aba nova e não altera Dashboard/Inventário.
    input.removeAttribute('onkeyup');
    input.setAttribute('placeholder', 'Pesquisar máquina...');
    input.setAttribute('autocomplete', 'off');
    ensureResultsHost(input);

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => render(input.value), 120);
    });
    input.addEventListener('focus', () => { if (input.value.trim()) render(input.value); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeResults();
        input.blur();
      }
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('.rrn-navbar-search-wrap')) closeResults();
    });

    window.addEventListener('rrn:inventory-remote-update', () => {
      if (input.value.trim()) render(input.value);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 700);
})();