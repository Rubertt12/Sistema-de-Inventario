// RRN Manager — chamados e detalhes do equipamento.
// Mantém compatibilidade com dados antigos que usavam `chamado` e novos que usam `chamados`.

let paginaAtual = 1;
const chamadosPorPagina = 3;
let currentSetorIndex = null;
let currentMaquinaIndex = null;

function rrnChamadoEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function rrnGetMachine() {
  if (currentSetorIndex == null || currentMaquinaIndex == null) return null;
  return setores?.[currentSetorIndex]?.maquinas?.[currentMaquinaIndex] || null;
}

function rrnTickets(machine) {
  if (!machine) return [];
  let tickets = Array.isArray(machine.chamados)
    ? machine.chamados
    : (Array.isArray(machine.chamado) ? machine.chamado : []);
  machine.chamados = tickets;
  machine.chamado = tickets;
  return tickets;
}

function rrnPersistTickets(machine) {
  if (!machine) return;
  machine.chamado = machine.chamados = rrnTickets(machine);
  if (typeof saveSetoresAndMachines === 'function') saveSetoresAndMachines();
  else localStorage.setItem('setores', JSON.stringify(setores || []));
  window.RRN_UI?.updateOverview?.();
  if (typeof window.renderPainelManutencao === 'function') window.renderPainelManutencao();
}

function rrnFormatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString('pt-BR');
  return String(value);
}

function rrnMachineDetails(machine) {
  const fields = [
    ['Tipo de equipamento', machine.tipo],
    ['Número de série / nome', machine.nome],
    ['Etiqueta', machine.etiqueta],
    ['Usuário responsável', machine.usuarioResponsavel],
    ['Fabricante', machine.fabricante],
    ['Modelo', machine.modelo],
    ['Localização', machine.localizacao],
    ['Situação patrimonial', machine.situacaoPatrimonial],
    ['Data da compra', machine.dataCompra],
    ['Garantia até', machine.garantiaAte]
  ].filter(([, value]) => value != null && String(value).trim() !== '');

  const rows = fields.map(([label, value]) => `
    <div class="rrn-info-row"><strong>${rrnChamadoEscape(label)}:</strong> ${rrnChamadoEscape(value)}</div>`).join('');

  const notes = machine.observacoesAtivo
    ? `<div class="rrn-info-row"><strong>Observações do ativo:</strong><br>${rrnChamadoEscape(machine.observacoesAtivo)}</div>`
    : '';

  return `${rows || '<div class="rrn-info-row">Sem dados complementares.</div>'}${notes}`;
}

function rrnUpdateMaintenanceActions(machine) {
  const maintenance = document.getElementById('maintenanceBtn');
  const release = document.getElementById('releaseBtn');
  if (maintenance) maintenance.style.display = machine?.emManutencao ? 'none' : '';
  if (release) release.style.display = machine?.emManutencao ? '' : 'none';

  const message = document.getElementById('maintenanceMessage');
  if (message) message.style.display = machine?.emManutencao ? 'block' : 'none';
}

function showInfo(setorIndex, maquinaIndex) {
  const machine = setores?.[setorIndex]?.maquinas?.[maquinaIndex];
  if (!machine) return;

  currentSetorIndex = setorIndex;
  currentMaquinaIndex = maquinaIndex;
  paginaAtual = 1;

  // Compatibilidade com as funções de manutenção que ainda vivem em setores.js.
  try { maquinaAtivaSetor = setorIndex; } catch {}
  try { maquinaAtivaIndex = maquinaIndex; } catch {}

  if (typeof window.fecharModalTodasManutencoes === 'function') window.fecharModalTodasManutencoes();
  bringModalToFront('infoModal');

  const modal = document.getElementById('infoModal');
  const modalText = document.getElementById('modalText');
  if (!modal || !modalText) return;

  modalText.innerHTML = rrnMachineDetails(machine);
  modal.style.display = 'flex';
  modal.removeAttribute('aria-hidden');
  rrnUpdateMaintenanceActions(machine);
  renderChamados(machine);
}

function closeModal() {
  const modal = document.getElementById('infoModal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
  currentSetorIndex = null;
  currentMaquinaIndex = null;
}

function renderChamados(machine = rrnGetMachine()) {
  const list = document.getElementById('observationsUl');
  const pagination = document.getElementById('pagination');
  if (!list || !pagination || !machine) return;

  const tickets = rrnTickets(machine);
  const ordered = tickets
    .map((ticket, originalIndex) => ({ ticket, originalIndex }))
    .sort((a, b) => new Date(b.ticket?.data || 0) - new Date(a.ticket?.data || 0));

  const totalPages = Math.max(1, Math.ceil(ordered.length / chamadosPorPagina));
  paginaAtual = Math.min(Math.max(1, paginaAtual), totalPages);
  const start = (paginaAtual - 1) * chamadosPorPagina;
  const visible = ordered.slice(start, start + chamadosPorPagina);

  list.innerHTML = visible.length ? visible.map(({ ticket, originalIndex }) => {
    const interactions = Array.isArray(ticket?.interacoes) ? ticket.interacoes : [];
    return `
      <li class="rrn-ticket-item" style="margin-bottom:10px;border:1px solid #ccc;padding:10px;border-radius:8px;">
        <div><strong>Chamado:</strong> ${rrnChamadoEscape(ticket?.texto || '')}</div>
        <div><strong>Prioridade:</strong> ${rrnChamadoEscape(ticket?.prioridade || 'Não informada')}</div>
        <small>${rrnChamadoEscape(rrnFormatDate(ticket?.data))}</small>
        ${interactions.map((interaction, index) => `
          <div style="margin-top:6px;border-left:2px solid #aaa;padding-left:10px;">
            <strong>Interação ${index + 1}:</strong> ${rrnChamadoEscape(interaction?.texto || '')}<br>
            <small>${rrnChamadoEscape(rrnFormatDate(interaction?.data))}</small>
          </div>`).join('')}
        <div style="margin-top:8px;">
          <button type="button" onclick="abrirInteracao(${originalIndex})">➕ Interagir</button>
          <button type="button" onclick="editarChamado(${originalIndex})">✏️ Editar</button>
          <button type="button" class="excluir-chamado operador-only" onclick="excluirChamado(${originalIndex})">🗑️ Excluir</button>
          <div id="interacao-${originalIndex}" style="display:none;margin-top:6px;">
            <textarea id="textoInteracao-${originalIndex}" rows="3" style="width:100%;"></textarea>
            <button type="button" onclick="salvarInteracao(${originalIndex})">💾 Salvar Interação</button>
          </div>
        </div>
      </li>`;
  }).join('') : '<li style="padding:10px;">Nenhum chamado registrado.</li>';

  renderPaginacao(totalPages, machine);
}

function renderPaginacao(totalPages, machine = rrnGetMachine()) {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;
  pagination.innerHTML = '';
  if (totalPages <= 1) return;

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = 'Anterior';
  previous.disabled = paginaAtual <= 1;
  previous.onclick = () => {
    paginaAtual -= 1;
    renderChamados(machine);
  };

  const label = document.createElement('span');
  label.textContent = ` Página ${paginaAtual} de ${totalPages} `;

  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Próximo';
  next.disabled = paginaAtual >= totalPages;
  next.onclick = () => {
    paginaAtual += 1;
    renderChamados(machine);
  };

  pagination.append(previous, label, next);
}

function saveObservation() {
  const machine = rrnGetMachine();
  const text = document.getElementById('observacao')?.value.trim();
  const priority = document.getElementById('priority')?.value || 'Baixa';
  if (!machine) return alert('Selecione um equipamento.');
  if (!text) return alert('A observação não pode estar vazia.');

  const tickets = rrnTickets(machine);
  tickets.push({
    texto: text,
    prioridade: priority,
    data: new Date().toISOString(),
    interacoes: []
  });

  const field = document.getElementById('observacao');
  if (field) field.value = '';
  rrnPersistTickets(machine);
  paginaAtual = 1;
  renderChamados(machine);
}

function abrirInteracao(index) {
  const container = document.getElementById(`interacao-${index}`);
  if (container) container.style.display = container.style.display === 'block' ? 'none' : 'block';
}

function salvarInteracao(index) {
  const machine = rrnGetMachine();
  if (!machine) return;
  const tickets = rrnTickets(machine);
  const ticket = tickets[index];
  const input = document.getElementById(`textoInteracao-${index}`);
  const text = input?.value.trim();
  if (!ticket || !text) return alert('Digite a interação.');

  if (!Array.isArray(ticket.interacoes)) ticket.interacoes = [];
  ticket.interacoes.push({ texto: text, data: new Date().toISOString() });
  if (input) input.value = '';
  rrnPersistTickets(machine);
  renderChamados(machine);
}

function editarChamado(index) {
  const machine = rrnGetMachine();
  if (!machine) return;
  const ticket = rrnTickets(machine)[index];
  if (!ticket) return;

  const text = prompt('Editar observação do chamado:', ticket.texto || '');
  if (text == null || !text.trim()) return;
  const priority = prompt('Prioridade (Baixa, Média ou Alta):', ticket.prioridade || 'Baixa');
  if (priority == null) return;
  const normalizedPriority = ['Baixa', 'Média', 'Alta'].includes(priority.trim()) ? priority.trim() : ticket.prioridade || 'Baixa';

  ticket.texto = text.trim();
  ticket.prioridade = normalizedPriority;
  ticket.atualizadoEm = new Date().toISOString();
  rrnPersistTickets(machine);
  renderChamados(machine);
}

function excluirChamado(index) {
  const machine = rrnGetMachine();
  if (!machine) return;
  const tickets = rrnTickets(machine);
  if (!tickets[index]) return;
  if (!confirm('Tem certeza que deseja excluir este chamado?')) return;

  tickets.splice(index, 1);
  rrnPersistTickets(machine);
  renderChamados(machine);
}

function bringModalToFront(modalId) {
  ['infoModal', 'modalTodasManutencoes', 'configModal'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) modal.style.zIndex = id === modalId ? '1600' : '1500';
  });
}

function closeAllModalsExcept(modalId) {
  ['infoModal', 'modalTodasManutencoes', 'configModal'].forEach(id => {
    if (id === modalId) return;
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  });
}

window.addEventListener('click', event => {
  const modal = document.getElementById('infoModal');
  if (event.target === modal) closeModal();
});
