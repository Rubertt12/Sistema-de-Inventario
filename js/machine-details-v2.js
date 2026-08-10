(() => {
  'use strict';

  let activeSectorIndex = null;
  let activeAssetIndex = null;
  let ticketPage = 1;
  const TICKETS_PER_PAGE = 4;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  function canOperate() {
    const role = window.RRN_SESSION?.role;
    if (role) return role === 'admin' || role === 'operador';
    try {
      const localRole = JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil;
      return !localRole || localRole === 'admin' || localRole === 'operador';
    } catch { return true; }
  }

  function inventory() {
    try { return Array.isArray(setores) ? setores : []; }
    catch { return []; }
  }

  function activeAsset() {
    if (activeSectorIndex == null || activeAssetIndex == null) return null;
    return inventory()[activeSectorIndex]?.maquinas?.[activeAssetIndex] || null;
  }

  function ticketText(ticket) {
    return String(ticket?.texto || ticket?.descricao || ticket?.observacao || '').trim();
  }

  function normalizeTicket(ticket) {
    const item = ticket && typeof ticket === 'object' ? ticket : { texto: String(ticket ?? '') };
    const text = ticketText(item);
    item.texto = text;
    item.descricao = item.descricao || text;
    item.prioridade = item.prioridade || 'Baixa';
    item.data = item.data || new Date().toISOString();
    if (!Array.isArray(item.interacoes)) item.interacoes = [];
    return item;
  }

  function tickets(machine) {
    if (!machine) return [];
    const modern = Array.isArray(machine.chamados) ? machine.chamados : [];
    const legacy = Array.isArray(machine.chamado) ? machine.chamado : [];
    const seen = new Set();
    const merged = [];

    [...modern, ...legacy].forEach(raw => {
      const item = normalizeTicket(raw);
      const key = [item.data, item.prioridade, ticketText(item)].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });

    machine.chamado = merged;
    machine.chamados = merged;
    return merged;
  }

  function persist() {
    const machine = activeAsset();
    if (machine) tickets(machine);
    try {
      if (typeof saveSetoresAndMachines === 'function') saveSetoresAndMachines();
      else localStorage.setItem('setores', JSON.stringify(inventory()));
    } catch (error) {
      console.error('RRN Manager: falha ao salvar equipamento.', error);
      alert('Não foi possível salvar a alteração. Tente novamente.');
      return false;
    }
    window.RRN_UI?.updateOverview?.();
    window.renderPainelManutencao?.();
    return true;
  }

  function renderDashboard() {
    const term = document.getElementById('searchInput')?.value?.trim().toLowerCase() || null;
    try { window.renderSetores?.(term); } catch (error) { console.warn(error); }
  }

  function statusLabel(machine) {
    if (machine?.emManutencao) return 'Em manutenção';
    const status = String(machine?.situacaoPatrimonial || 'ativo').toLowerCase();
    if (status.includes('estoque')) return 'Em estoque';
    if (status.includes('emprest')) return 'Emprestado';
    if (status.includes('baix')) return 'Baixado';
    return 'Operando normalmente';
  }

  function infoRows(machine) {
    return [
      ['Usuário responsável', machine.usuarioResponsavel],
      ['Status', statusLabel(machine)],
      ['Número de série / nome', machine.nome],
      ['Tipo', machine.tipo],
      ['Etiqueta / patrimônio', machine.etiqueta],
      ['Fabricante', machine.fabricante],
      ['Modelo', machine.modelo],
      ['Localização', machine.localizacao],
      ['Data da compra', machine.dataCompra],
      ['Garantia até', machine.garantiaAte]
    ].filter(([, value]) => value != null && String(value).trim() !== '')
      .map(([label, value]) => `<div class="rrn-info-row"><strong>${esc(label)}:</strong> <span>${esc(value)}</span></div>`)
      .join('');
  }

  function updateMaintenanceUi(machine) {
    const maintenance = document.getElementById('maintenanceBtn');
    const release = document.getElementById('releaseBtn');
    const message = document.getElementById('maintenanceMessage');
    const section = document.getElementById('maintenanceSection');
    const editable = canOperate();

    if (maintenance) maintenance.style.display = editable && !machine?.emManutencao ? '' : 'none';
    if (release) release.style.display = editable && machine?.emManutencao ? '' : 'none';
    if (message) message.style.display = machine?.emManutencao ? 'block' : 'none';
    if (section) {
      section.querySelectorAll('textarea,select,input,button').forEach(control => {
        if (control.closest('legend')) return;
        control.disabled = !editable;
      });
    }
  }

  function renderTickets() {
    const machine = activeAsset();
    const ul = document.getElementById('observationsUl');
    const pagination = document.getElementById('pagination');
    if (!machine || !ul || !pagination) return;

    const data = tickets(machine)
      .map((ticket, originalIndex) => ({ ticket, originalIndex }))
      .sort((a, b) => new Date(b.ticket.data || 0) - new Date(a.ticket.data || 0));

    const pages = Math.max(1, Math.ceil(data.length / TICKETS_PER_PAGE));
    ticketPage = Math.min(Math.max(ticketPage, 1), pages);
    const visible = data.slice((ticketPage - 1) * TICKETS_PER_PAGE, ticketPage * TICKETS_PER_PAGE);

    if (!visible.length) {
      ul.innerHTML = '<li class="rrn-ticket-empty">Nenhum chamado registrado.</li>';
    } else {
      ul.innerHTML = visible.map(({ ticket, originalIndex }) => `
        <li class="rrn-ticket-item" data-ticket-index="${originalIndex}">
          <div class="rrn-ticket-top"><strong>${esc(ticket.prioridade || 'Baixa')}</strong><small>${esc(new Date(ticket.data).toLocaleString('pt-BR'))}</small></div>
          <div class="rrn-ticket-text">${esc(ticketText(ticket)).replace(/\n/g, '<br>')}</div>
          ${(ticket.interacoes || []).length ? `<div class="rrn-ticket-interactions">${ticket.interacoes.map((interaction, i) => `<div><strong>Interação ${i + 1}</strong><span>${esc(interaction?.texto || '')}</span><small>${interaction?.data ? esc(new Date(interaction.data).toLocaleString('pt-BR')) : ''}</small></div>`).join('')}</div>` : ''}
          ${canOperate() ? `<div class="rrn-ticket-actions"><button type="button" onclick="abrirInteracao(${originalIndex})">Interagir</button><button type="button" onclick="editarChamado(${originalIndex})">Editar</button><button type="button" onclick="excluirChamado(${originalIndex})">Excluir</button></div><div id="interacao-${originalIndex}" class="rrn-ticket-reply" hidden><textarea id="textoInteracao-${originalIndex}" rows="2" placeholder="Nova interação"></textarea><button type="button" onclick="salvarInteracao(${originalIndex})">Salvar interação</button></div>` : ''}
        </li>`).join('');
    }

    pagination.replaceChildren();
    if (pages > 1) {
      const prev = document.createElement('button');
      prev.type = 'button';
      prev.textContent = 'Anterior';
      prev.disabled = ticketPage === 1;
      prev.onclick = () => { ticketPage -= 1; renderTickets(); };
      const label = document.createElement('span');
      label.textContent = ` Página ${ticketPage} de ${pages} `;
      const next = document.createElement('button');
      next.type = 'button';
      next.textContent = 'Próximo';
      next.disabled = ticketPage === pages;
      next.onclick = () => { ticketPage += 1; renderTickets(); };
      pagination.append(prev, label, next);
    }
  }

  function showInfoV2(sectorIndex, assetIndex) {
    const machine = inventory()[sectorIndex]?.maquinas?.[assetIndex];
    if (!machine) return;
    activeSectorIndex = sectorIndex;
    activeAssetIndex = assetIndex;
    ticketPage = 1;

    try {
      maquinaAtivaSetor = sectorIndex;
      maquinaAtivaIndex = assetIndex;
      currentMachineId = machine.id;
    } catch {}

    const modal = document.getElementById('infoModal');
    const text = document.getElementById('modalText');
    if (!modal || !text) return;

    const userEdit = canOperate() ? `<button type="button" class="rrn-inline-edit" onclick="abrirModalEditarUsuario('${esc(machine.id)}')" title="Editar usuário">✏️</button>` : '';
    text.innerHTML = `<div class="rrn-machine-detail-card">${infoRows(machine)}${userEdit}${machine.observacoesAtivo ? `<div class="rrn-info-note"><strong>Observações do ativo</strong><p>${esc(machine.observacoesAtivo).replace(/\n/g, '<br>')}</p></div>` : ''}</div>`;
    modal.style.display = 'flex';
    modal.style.zIndex = '1600';
    modal.setAttribute('aria-hidden', 'false');

    const before = JSON.stringify({ chamado: machine.chamado, chamados: machine.chamados });
    tickets(machine);
    if (before !== JSON.stringify({ chamado: machine.chamado, chamados: machine.chamados })) persist();
    updateMaintenanceUi(machine);
    renderTickets();
  }

  function closeModalV2() {
    const modal = document.getElementById('infoModal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    activeSectorIndex = null;
    activeAssetIndex = null;
    try { maquinaAtivaSetor = null; maquinaAtivaIndex = null; } catch {}
    clearFormV2();
  }

  function clearFormV2() {
    const observation = document.getElementById('observacao');
    if (observation) observation.value = '';
    document.querySelectorAll('#maintenanceSection input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    const priority = document.getElementById('priority');
    if (priority) priority.value = 'Baixa';
  }

  function saveObservationV2() {
    if (!canOperate()) return;
    const machine = activeAsset();
    if (!machine) return alert('Selecione um equipamento.');

    const observation = document.getElementById('observacao')?.value?.trim() || '';
    const priority = document.getElementById('priority')?.value || 'Baixa';
    const checked = [...document.querySelectorAll('#maintenanceSection input[type="checkbox"]:checked')];
    if (!observation && !checked.length) return alert('Informe uma observação ou marque ao menos um item do checklist.');

    const checklist = checked.map(cb => cb.parentElement?.textContent?.trim()).filter(Boolean);
    const parts = [];
    if (observation) parts.push(observation);
    if (checklist.length) parts.push(`Checklist:\n- ${checklist.join('\n- ')}`);
    const text = parts.join('\n\n');

    tickets(machine).push({
      texto: text,
      descricao: text,
      prioridade: priority,
      data: new Date().toISOString(),
      checklist,
      interacoes: []
    });
    if (!persist()) return;
    clearFormV2();
    ticketPage = 1;
    renderTickets();
  }

  function markForMaintenanceV2() {
    if (!canOperate()) return;
    const machine = activeAsset();
    if (!machine) return alert('Selecione um equipamento.');
    machine.emManutencao = true;
    machine.tempoManutencao = Date.now();
    machine.atualizadoEm = new Date().toISOString();
    if (!persist()) return;
    renderDashboard();
    updateMaintenanceUi(machine);
  }

  function releaseMachineV2() {
    if (!canOperate()) return;
    const machine = activeAsset();
    if (!machine) return alert('Selecione um equipamento.');
    machine.emManutencao = false;
    machine.tempoManutencao = 0;
    machine.atualizadoEm = new Date().toISOString();
    if (!persist()) return;
    renderDashboard();
    updateMaintenanceUi(machine);
  }

  function openInteraction(index) {
    if (!canOperate()) return;
    const host = document.getElementById(`interacao-${index}`);
    if (host) host.hidden = !host.hidden;
  }

  function saveInteraction(index) {
    if (!canOperate()) return;
    const machine = activeAsset();
    const ticket = tickets(machine)[index];
    const input = document.getElementById(`textoInteracao-${index}`);
    const text = input?.value?.trim();
    if (!ticket || !text) return alert('Digite a interação.');
    ticket.interacoes.push({ texto: text, data: new Date().toISOString() });
    if (!persist()) return;
    renderTickets();
  }

  function editTicket(index) {
    if (!canOperate()) return;
    const machine = activeAsset();
    const ticket = tickets(machine)[index];
    if (!ticket) return;
    const next = prompt('Editar chamado:', ticketText(ticket));
    if (next == null || !next.trim()) return;
    ticket.texto = next.trim();
    ticket.descricao = next.trim();
    ticket.atualizadoEm = new Date().toISOString();
    if (!persist()) return;
    renderTickets();
  }

  function deleteTicket(index) {
    if (!canOperate()) return;
    const machine = activeAsset();
    const data = tickets(machine);
    if (!data[index] || !confirm('Excluir este chamado?')) return;
    data.splice(index, 1);
    machine.chamado = data;
    machine.chamados = data;
    if (!persist()) return;
    renderTickets();
  }

  function installStyles() {
    if (document.getElementById('rrn-machine-details-v2-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-machine-details-v2-style';
    style.textContent = `
      .rrn-machine-detail-card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 14px;padding:12px;border:1px solid rgba(41,89,145,.18);border-radius:12px;background:rgba(255,255,255,.45)}.rrn-info-row{min-width:0;font-size:.78rem;color:#36465d}.rrn-info-row strong{color:#295991}.rrn-info-note{grid-column:1/-1;margin-top:4px;padding-top:8px;border-top:1px solid rgba(41,89,145,.14)}.rrn-info-note p{margin:4px 0 0;font-size:.76rem}.rrn-inline-edit{grid-column:1/-1;justify-self:start;margin:2px 0 0!important;padding:5px 8px!important}
      .rrn-ticket-item{margin:0 0 9px!important;padding:11px!important;border:1px solid rgba(41,89,145,.18)!important;border-radius:10px!important;background:rgba(255,255,255,.45)}.rrn-ticket-top{display:flex;justify-content:space-between;gap:10px}.rrn-ticket-top strong{color:#295991;font-size:.72rem}.rrn-ticket-top small{color:#737b89;font-size:.65rem}.rrn-ticket-text{margin-top:6px;color:#35445a;font-size:.76rem}.rrn-ticket-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.rrn-ticket-actions button,.rrn-ticket-reply button{width:auto!important;margin:0!important;padding:6px 9px!important;font-size:.68rem!important}.rrn-ticket-reply{margin-top:8px}.rrn-ticket-reply textarea{width:100%;margin-bottom:6px}.rrn-ticket-interactions{display:grid;gap:5px;margin-top:8px}.rrn-ticket-interactions>div{padding:7px;border-left:3px solid #f2bf4f;background:rgba(242,191,79,.12)}.rrn-ticket-interactions strong,.rrn-ticket-interactions span,.rrn-ticket-interactions small{display:block;font-size:.68rem}.rrn-ticket-empty{padding:12px;color:#737b89;font-size:.76rem;text-align:center}
      @media(max-width:600px){.rrn-machine-detail-card{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    installStyles();
    window.showInfo = showInfoV2;
    window.closeModal = closeModalV2;
    window.saveObservation = saveObservationV2;
    window.markForMaintenance = markForMaintenanceV2;
    window.releaseMachine = releaseMachineV2;
    window.abrirInteracao = openInteraction;
    window.salvarInteracao = saveInteraction;
    window.editarChamado = editTicket;
    window.excluirChamado = deleteTicket;
    window.renderChamados = renderTickets;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
