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
  let serviceDeskHistory = [];

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

  function normalizeKey(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function machineKeys(machine, index) {
    return new Set([
      machine?.id,
      machine?.uuid,
      machine?.assetId,
      machine?.legacyKey,
      machine?.nome,
      machine?.etiqueta,
      machine?.patrimonio,
      machine?.placa,
      machine?.numeroSerie,
      machine?.serialNumber,
      machine?.serial_number,
      machine?.hostname,
      machine?.hostName,
      machineId(machine, index)
    ].map(normalizeKey).filter(Boolean));
  }

  function serviceDeskMatchesMachine(row, machine, index) {
    const keys = machineKeys(machine, index);
    if (!keys.size) return false;
    return [row?.asset_key, row?.asset_tag, row?.serial_number, row?.hostname]
      .map(normalizeKey)
      .filter(Boolean)
      .some(value => keys.has(value));
  }

  function serviceDeskPriority(value) {
    const key = String(value || '').toLowerCase();
    return ({ low:'Baixa', medium:'Média', high:'Alta', critical:'Crítica' })[key] || value || 'Baixa';
  }

  function serviceDeskTicket(row) {
    return {
      __serviceDesk: true,
      support_ticket_id: row.ticket_id,
      id: row.ticket_id,
      numero: row.ticket_number ? `#${row.ticket_number}` : 'Chamado do Portal',
      titulo: row.title,
      texto: row.description || row.title || 'Sem descrição registrada.',
      descricao: row.description || row.title || 'Sem descrição registrada.',
      prioridade: serviceDeskPriority(row.priority),
      status: row.status,
      data: row.opened_at,
      encerradoEm: row.closed_at || row.resolved_at,
      autor: row.requester_name || 'Solicitante',
      responsavel: row.assigned_name || 'Equipe de suporte',
      resolucao: row.resolution || '',
      causa: row.cause || '',
      interacoes: Array.isArray(row.interactions) ? row.interactions : parseMaybeJson(row.interactions, [])
    };
  }

  function legacyTickets(machine) {
    const list = Array.isArray(machine?.chamados)
      ? machine.chamados
      : (Array.isArray(machine?.chamado) ? machine.chamado : []);
    return list.filter(Boolean);
  }

  function tickets(machine, index) {
    const legacy = legacyTickets(machine);
    const existingServiceIds = new Set(legacy.map(ticket => String(ticket?.support_ticket_id || ticket?.ticket_id || '')).filter(Boolean));
    const fromServiceDesk = serviceDeskHistory
      .filter(row => serviceDeskMatchesMachine(row, machine, index))
      .filter(row => !existingServiceIds.has(String(row.ticket_id)))
      .map(serviceDeskTicket);
    return [...legacy, ...fromServiceDesk];
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
    serviceDeskHistory = [];
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

    const [inventoryResult, historyResult] = await Promise.all([
      client
        .from('tenant_inventory_state')
        .select('payload,updated_at')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle(),
      client.rpc('inventory_closed_ticket_history')
    ]);

    if (inventoryResult.error) throw inventoryResult.error;
    if (historyResult.error) {
      console.warn('RRN closed service desk history:', historyResult.error);
      notice('O inventário foi carregado, mas o histórico encerrado do Service Desk não pôde ser consultado.');
    } else {
      serviceDeskHistory = Array.isArray(historyResult.data) ? historyResult.data : [];
    }

    const remote = inventoryResult.data?.payload || {};
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
    const totalTickets = machines.reduce((sum, machine, index) => sum + tickets(machine, index).length, 0);
    $('sectorTitle').textContent = sector.nome || `Setor ${sectorIndex + 1}`;
    $('sectorSubtitle').textContent = 'Expanda uma máquina para visualizar o histórico local e os chamados encerrados do Portal vinculados ao equipamento.';
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

  function renderServiceDeskDetails(ticket) {
    if (!ticket?.__serviceDesk) return '';
    const status = ticket.status === 'closed' ? 'Fechado' : 'Resolvido';
    return `<div class="rrn-service-desk-history">
      <div class="rrn-service-desk-meta"><span>${esc(status)}</span><span>Solicitante: <strong>${esc(ticket.autor || 'Solicitante')}</strong></span><span>Técnico: <strong>${esc(ticket.responsavel || 'Equipe de suporte')}</strong></span></div>
      ${ticket.causa ? `<div class="rrn-service-desk-note"><strong>Causa</strong><p>${esc(ticket.causa)}</p></div>` : ''}
      ${ticket.resolucao ? `<div class="rrn-service-desk-note is-resolution"><strong>Solução aplicada</strong><p>${esc(ticket.resolucao)}</p></div>` : ''}
      <div class="rrn-service-desk-ended">Atendimento concluído em ${esc(fmt(ticket.encerradoEm))}</div>
    </div>`;
  }

  function renderTickets(list) {
    if (!list.length) return '<div class="rrn-tree-no-ticket"><strong>Nenhum chamado registrado</strong><small>Esta máquina ainda não possui chamados no histórico.</small></div>';

    const ordered = [...list].sort((a, b) => new Date(b?.encerradoEm || b?.data || b?.created_at || 0) - new Date(a?.encerradoEm || a?.data || a?.created_at || 0));
    return `<div class="rrn-ticket-branch">${ordered.map((ticket, index) => {
      const priority = String(ticket?.prioridade || 'Baixa');
      const priorityClass = priority.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/g, '');
      const ticketLabel = ticket?.numero || ticket?.id || `Chamado ${index + 1}`;
      const author = ticket?.autor || ticket?.criadoPor || ticket?.usuario || '';
      return `<section class="rrn-ticket-card${ticket?.__serviceDesk ? ' is-service-desk' : ''}">
        <span class="rrn-ticket-dot" aria-hidden="true"></span>
        <div class="rrn-ticket-card-body">
          <div class="rrn-ticket-card-head"><div><span class="rrn-ticket-label">${ticket?.__serviceDesk ? 'Chamado do Portal' : 'Chamado'}</span><strong>${esc(ticketLabel)}</strong></div><span class="rrn-priority rrn-priority-${esc(priorityClass)}">${esc(priority)}</span></div>
          ${ticket?.titulo && ticket.titulo !== ticketText(ticket) ? `<h3 class="rrn-ticket-title">${esc(ticket.titulo)}</h3>` : ''}
          <p class="rrn-ticket-description">${esc(ticketText(ticket))}</p>
          ${author && !ticket?.__serviceDesk ? `<div class="rrn-ticket-author">Registrado por <strong>${esc(author)}</strong></div>` : ''}
          <div class="rrn-ticket-date">Aberto em ${esc(fmt(ticket?.data || ticket?.created_at))}</div>
          ${renderServiceDeskDetails(ticket)}
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
      const machineTickets = tickets(machine, originalIndex);
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