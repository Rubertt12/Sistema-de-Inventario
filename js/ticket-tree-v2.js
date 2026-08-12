(() => {
  'use strict';
  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const params = new URLSearchParams(location.search);
  const sectorIndex = Number(params.get('setor'));
  const targetMachine = params.get('maquina') || '';
  let sector = null;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => { if (!value) return 'Data não informada'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('pt-BR'); };
  const ticketList = machine => Array.isArray(machine?.chamados) ? machine.chamados : (Array.isArray(machine?.chamado) ? machine.chamado : []);
  const machineId = (machine, index) => String(machine?.id ?? index);

  function notice(text) { const el = $('treeNotice'); if (!el) return; el.textContent = text; el.hidden = false; }

  async function loadState() {
    if (!client) throw new Error('Supabase não configurado.');
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) { location.replace('/login.html'); return null; }
    const { data: profile, error: profileError } = await client.from('profiles').select('tenant_id,status').eq('user_id', user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.status !== 'active') throw new Error('Seu acesso está inativo.');
    const { data, error } = await client.from('tenant_inventory_state').select('payload').eq('tenant_id', profile.tenant_id).maybeSingle();
    if (error) throw error;
    return data?.payload || {};
  }

  function render(payload) {
    const sectors = Array.isArray(payload?.setores) ? payload.setores : [];
    sector = sectors[sectorIndex];
    if (!sector) {
      $('sectorTitle').textContent = 'Setor não encontrado';
      $('sectorSubtitle').textContent = 'O setor pode ter sido removido ou alterado.';
      $('ticketTree').innerHTML = '<div class="rrn-tree-empty">Não foi possível localizar este setor.</div>';
      return;
    }
    const machines = Array.isArray(sector.maquinas) ? sector.maquinas : [];
    const totalTickets = machines.reduce((sum, machine) => sum + ticketList(machine).length, 0);
    $('sectorTitle').textContent = sector.nome || `Setor ${sectorIndex + 1}`;
    $('sectorSubtitle').textContent = 'Clique em uma máquina para expandir os chamados e interações registrados.';
    $('assetCount').textContent = machines.length;
    $('ticketCount').textContent = totalTickets;
    $('maintenanceCount').textContent = machines.filter(m => m?.emManutencao).length;
    drawTree(machines);
  }

  function drawTree(machines, filter = '') {
    const tree = $('ticketTree');
    const q = String(filter || '').trim().toLowerCase();
    const filtered = machines.filter(machine => [machine?.nome,machine?.etiqueta,machine?.usuarioResponsavel,machine?.tipo,machine?.modelo].filter(Boolean).join(' ').toLowerCase().includes(q));
    if (!filtered.length) { tree.innerHTML = '<div class="rrn-tree-empty">Nenhuma máquina encontrada neste setor.</div>'; return; }
    tree.innerHTML = filtered.map((machine, index) => {
      const originalIndex = machines.indexOf(machine);
      const tickets = ticketList(machine).slice().sort((a,b) => new Date(b?.data || 0) - new Date(a?.data || 0));
      const open = targetMachine && machineId(machine, originalIndex) === targetMachine;
      return `<article class="rrn-tree-node${open ? ' is-open' : ''}" data-machine-node="${originalIndex}">
        <button class="rrn-tree-node-head" type="button" aria-expanded="${open}">
          <span class="rrn-tree-chevron">›</span><span class="rrn-tree-machine"><strong>${esc(machine?.nome || machine?.etiqueta || 'Equipamento')}</strong><small>${esc(machine?.tipo || 'Equipamento')} · ${esc(machine?.etiqueta || 'sem etiqueta')} · ${esc(machine?.usuarioResponsavel || 'sem responsável')}</small></span>
          <span class="rrn-tree-node-meta"><b>${tickets.length}</b><small>chamado${tickets.length === 1 ? '' : 's'}</small></span>
        </button>
        <div class="rrn-tree-children" ${open ? '' : 'hidden'}>${renderTickets(tickets)}</div>
      </article>`;
    }).join('');
    bindNodes();
    if (targetMachine) setTimeout(() => tree.querySelector('.is-open')?.scrollIntoView({ behavior:'smooth', block:'center' }), 50);
  }

  function renderTickets(tickets) {
    if (!tickets.length) return '<div class="rrn-tree-no-ticket">Nenhum chamado registrado para esta máquina.</div>';
    return `<div class="rrn-ticket-branch">${tickets.map((ticket, index) => {
      const interactions = Array.isArray(ticket?.interacoes) ? ticket.interacoes : [];
      return `<section class="rrn-ticket-card"><div class="rrn-ticket-line"><span class="rrn-ticket-dot"></span><div class="rrn-ticket-card-body"><div class="rrn-ticket-card-head"><strong>Chamado ${index + 1}</strong><span class="rrn-priority rrn-priority-${esc(String(ticket?.prioridade || 'baixa').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''))}">${esc(ticket?.prioridade || 'Baixa')}</span></div><p>${esc(ticket?.texto || 'Sem descrição')}</p><small>${esc(fmt(ticket?.data))}</small>${interactions.length ? `<div class="rrn-interaction-tree">${interactions.map((interaction, i) => `<div class="rrn-interaction"><span></span><div><strong>Interação ${i+1}</strong><p>${esc(interaction?.texto || '')}</p><small>${esc(fmt(interaction?.data))}</small></div></div>`).join('')}</div>` : ''}</div></div></section>`;
    }).join('')}</div>`;
  }

  function bindNodes() {
    document.querySelectorAll('.rrn-tree-node-head').forEach(button => button.onclick = () => {
      const node = button.closest('.rrn-tree-node');
      const children = node?.querySelector('.rrn-tree-children');
      if (!node || !children) return;
      const open = !node.classList.contains('is-open');
      node.classList.toggle('is-open', open);
      children.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
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
      $('ticketTree').innerHTML = '<div class="rrn-tree-empty">Falha ao carregar o histórico do setor.</div>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();