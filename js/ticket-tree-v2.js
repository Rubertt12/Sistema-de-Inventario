(() => {
  'use strict';

  const cfg = window.RRN_SUPABASE || {};
  const client = window.RRN_SUPABASE_CLIENT || window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  if (client) window.RRN_SUPABASE_CLIENT = client;

  const params = new URLSearchParams(location.search);
  const requestedSectorIndex = Number(params.get('setor'));
  const targetMachine = String(params.get('maquina') || '');
  let sector = null;
  let sectorIndex = Number.isInteger(requestedSectorIndex) ? requestedSectorIndex : -1;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const fmt = value => {
    if (!value) return 'Data não informada';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
  };

  function parseMaybeJson(value, fallback) {
    if (value == null) return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function normalizedSectors(payload) {
    const raw = parseMaybeJson(payload?.setores, []);
    return Array.isArray(raw) ? raw : [];
  }

  function localPayload() {
    return { setores: parseMaybeJson(localStorage.getItem('setores'), []) };
  }

  function tickets(machine) {
    const list = Array.isArray(machine?.chamados)
      ? machine.chamados
      : (Array.isArray(machine?.chamado) ? machine.chamado : []);
    return list.filter(Boolean);
  }

  function interactions(ticket) {
    const raw = ticket?.interacoes ?? ticket?.interactions ?? ticket?.historico ?? [];
    const list = parseMaybeJson(raw, []);
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }

  function ticketText(ticket) {
    return ticket?.texto || ticket?.descricao || ticket?.observacao || ticket?.description || 'Sem descrição registrada.';
  }

  function interactionText(item) {
    return item?.texto || item?.descricao || item?.observacao || item?.description || String(item ?? '');
  }

  function machineId(machine, index) {
    return String(machine?.id ?? machine?.uuid ?? machine?.etiqueta ?? index);
  }

  function notice(text) {
    const el = $('treeNotice');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
  }

  async function loadState() {
    const local = localPayload();
    if (!client) return local;

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      if (normalizedSectors(local).length) return local;
      location.replace('/login.html');
      return null;
    }

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('tenant_id,status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.status !== 'active') throw new Error('Seu acesso está inativo.');

    const { data, error } = await client
      .from('tenant_inventory_state')
      .select('payload,updated_at')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle();
    if (error) throw error;

    const remote = data?.payload || {};
    return normalizedSectors(remote).length ? remote : local;
  }

  function resolveSector(sectors) {
    if (sectorIndex >= 0 && sectors[sectorIndex]) return sectors[sectorIndex];
    if (!targetMachine) return null;
    const found = sectors.findIndex(item => (Array.isArray(item?.maquinas) ? item.maquinas : []).some((machine, index) => machineId(machine, index) === targetMachine));
    if (found >= 0) {
      sectorIndex = found;
      return sectors[found];
    }
    return null;
  }

  function render(payload) {
    const sectors = normalizedSectors(payload);
    sector = resolveSector(sectors);

    if (!sector) {
      $('sectorTitle').textContent = 'Setor não encontrado';
      $('sectorSubtitle').textContent = 'A máquina ou o setor podem ter sido movidos. Volte para a pesquisa e tente novamente.';
      $('ticketTree').innerHTML = '<div class="rrn-tree-empty"><strong>Não foi possível localizar este setor.</strong><small>O histórico continua preservado; refaça a pesquisa para abrir a localização atual da máquina.</small></div>';
      return;
    }

    const machines = Array.isArray(sector.maquinas) ? sector.maquinas : [];
    const totalTickets = machines.reduce((sum, machine) => sum + tickets(machine).length, 0);
    $('sectorTitle').textContent = sector.nome || `Setor ${sectorIndex + 1}`;
    $('sectorSubtitle').textContent = 'Expanda uma máquina para visualizar seus chamados e todas as interações registradas.';
    $('assetCount').textContent = machines.length;
    $('ticketCount').textContent = totalTickets;
    $('maintenanceCount').textContent = machines.filter(machine => machine?.emManutencao).length;
    drawTree(machines);
  }

  function renderInteractions(ticket) {
    const list = interactions(ticket);
    if (!list.length) return '<div class="rrn-ticket-no-interactions">Nenhuma interação registrada neste chamado.</div>';
    return `<div class="rrn-interaction-tree">
      <div class="rrn-interaction-title">Interações (${list.length})</div>
      ${list.map((item, index) => `
        <div class="rrn-interaction">
          <span class="rrn-interaction-dot" aria-hidden="true"></span>
          <div class="rrn-interaction-body">
            <div class="rrn-interaction-head"><strong>Interação ${index + 1}</strong><small>${esc(fmt(item?.data || item?.created_at || item?.atualizadoEm))}</small></div>
            <p>${esc(interactionText(item))}</p>
            ${(item?.autor || item?.usuario || item?.responsavel || item?.criadoPor) ? `<em>Por ${esc(item.autor || item.usuario || item.responsavel || item.criadoPor)}</em>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
  }

  function renderTickets(list) {
    if (!list.length) return '<div class="rrn-tree-no-ticket"><strong>Nenhum chamado registrado</strong><small>Esta máquina ainda não possui chamados no histórico.</small></div>';

    const ordered = [...list].sort((a, b) => new Date(b?.data || b?.created_at || 0) - new Date(a?.data || a?.created_at || 0));
    return `<div class="rrn-ticket-branch">${ordered.map((ticket, index) => {
      const priority = String(ticket?.prioridade || 'Baixa');
      const priorityClass = priority.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/g, '');
      const ticketLabel = ticket?.numero || ticket?.id || `Chamado ${index + 1}`;
      const author = ticket?.autor || ticket?.criadoPor || ticket?.usuario || ticket?.responsavel || '';
      return `<section class="rrn-ticket-card">
        <span class="rrn-ticket-dot" aria-hidden="true"></span>
        <div class="rrn-ticket-card-body">
          <div class="rrn-ticket-card-head"><div><span class="rrn-ticket-label">Chamado</span><strong>${esc(ticketLabel)}</strong></div><span class="rrn-priority rrn-priority-${esc(priorityClass)}">${esc(priority)}</span></div>
          <p class="rrn-ticket-description">${esc(ticketText(ticket))}</p>
          ${author ? `<div class="rrn-ticket-author">Registrado por <strong>${esc(author)}</strong></div>` : ''}
          <div class="rrn-ticket-date">${esc(fmt(ticket?.data || ticket?.created_at))}</div>
          ${renderInteractions(ticket)}
        </div>
      </section>`;
    }).join('')}</div>`;
  }

  function drawTree(machines, filter = '') {
    const tree = $('ticketTree');
    const q = String(filter || '').trim().toLowerCase();
    const filtered = machines.filter(machine => [machine?.nome, machine?.etiqueta, machine?.usuarioResponsavel, machine?.tipo, machine?.modelo, machine?.fabricante]
      .filter(Boolean).join(' ').toLowerCase().includes(q));

    if (!filtered.length) {
      tree.innerHTML = '<div class="rrn-tree-empty"><strong>Nenhuma máquina encontrada</strong><small>Ajuste o filtro desta árvore.</small></div>';
      return;
    }

    tree.innerHTML = filtered.map(machine => {
      const originalIndex = machines.indexOf(machine);
      const machineTickets = tickets(machine);
      const open = Boolean(targetMachine && machineId(machine, originalIndex) === targetMachine);
      return `<article class="rrn-tree-node${open ? ' is-open' : ''}" data-machine-node="${originalIndex}">
        <button class="rrn-tree-node-head" type="button" aria-expanded="${open}">
          <span class="rrn-tree-chevron" aria-hidden="true">›</span>
          <span class="rrn-tree-machine"><strong>${esc(machine?.nome || machine?.etiqueta || 'Equipamento')}</strong><small>${esc(machine?.tipo || 'Equipamento')} · ${esc(machine?.etiqueta || 'sem etiqueta')} · ${esc(machine?.usuarioResponsavel || 'sem responsável')}</small></span>
          <span class="rrn-tree-node-meta"><b>${machineTickets.length}</b><small>chamado${machineTickets.length === 1 ? '' : 's'}</small></span>
        </button>
        <div class="rrn-tree-children" ${open ? '' : 'hidden'}>${renderTickets(machineTickets)}</div>
      </article>`;
    }).join('');

    bindNodes();
    if (targetMachine) requestAnimationFrame(() => tree.querySelector('.is-open')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  function bindNodes() {
    document.querySelectorAll('.rrn-tree-node-head').forEach(button => {
      button.onclick = () => {
        const node = button.closest('.rrn-tree-node');
        const children = node?.querySelector('.rrn-tree-children');
        if (!node || !children) return;
        const open = !node.classList.contains('is-open');
        node.classList.toggle('is-open', open);
        children.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
      };
    });
  }

  function setAll(open) {
    document.querySelectorAll('.rrn-tree-node').forEach(node => {
      node.classList.toggle('is-open', open);
      const child = node.querySelector('.rrn-tree-children');
      if (child) child.hidden = !open;
      node.querySelector('.rrn-tree-node-head')?.setAttribute('aria-expanded', String(open));
    });
  }

  async function boot() {
    try {
      const payload = await loadState();
      if (!payload) return;
      render(payload);
      $('treeFilter')?.addEventListener('input', event => drawTree(Array.isArray(sector?.maquinas) ? sector.maquinas : [], event.target.value));
      $('expandAll')?.addEventListener('click', () => setAll(true));
      $('collapseAll')?.addEventListener('click', () => setAll(false));
    } catch (error) {
      console.error(error);
      notice(error.message || 'Não foi possível carregar os chamados.');
      $('ticketTree').innerHTML = '<div class="rrn-tree-empty"><strong>Falha ao carregar o histórico</strong><small>Volte para a pesquisa e tente novamente.</small></div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();