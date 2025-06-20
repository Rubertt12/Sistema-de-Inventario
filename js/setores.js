// Modal de setores
function addSetor() {
  document.getElementById("modalSetor").style.display = "flex";
}
function fecharModalSetor() {
  document.getElementById("modalSetor").style.display = "none";
}
window.addEventListener('click', e => {
  const modal = document.getElementById('modalSetor');
  if (e.target === modal) fecharModalSetor();
});
function confirmarAddSetor() {
  const setorName = document.getElementById("inputSetorNome").value.trim();
  if (!setorName) return alert("Por favor, insira um nome para o setor.");

  setores.push({ nome: setorName, maquinas: [] });
  setoresVisiveis.push(false);
  saveSetoresAndMachines();
  renderSetores();
  fecharModalSetor();
  document.getElementById("inputSetorNome").value = "";
}

// Renderização
function renderSetores() {
  const container = document.getElementById('setoresContainer');
  container.innerHTML = '';

  setores.forEach((setor, i) => {
    const div = document.createElement('div');
    div.classList.add('setor');
    div.innerHTML = `
      <div class="setor-header">
        <h2>${setor.nome}</h2>
        <div>
          <button onclick="editSetorName(${i})">✏️</button>
          <button onclick="removeSetor(${i})">X</button>
        </div>
      </div>
      <button onclick="abrirModalMaquina(${i})">Adicionar Máquina</button>
      <button onclick="toggleMachines(${i})">${setoresVisiveis[i] ? 'Esconder Máquinas' : 'Mostrar Máquinas'}</button>
      <div id="maquinas-${i}" style="display: ${setoresVisiveis[i] ? 'block' : 'none'};">
        ${setor.maquinas.map((m, mi) => `
          <div style="background-color: ${m.emManutencao ? '#ff6b6b' : 'transparent'}; margin:5px; padding:5px; border:1px solid #ccc;border-radius:10px">
            <strong>${m.nome}</strong> (${m.tipo}) - ${m.emManutencao ? 'Em Manutenção' : 'Operando'}
            <button onclick="showInfo(${i}, ${mi})">Info</button>
            <button onclick="removeMaquina(${i}, ${mi})">Excluir</button>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(div);
  });
}

// Alterna visibilidade das máquinas
function toggleMachines(index) {
  setoresVisiveis[index] = !setoresVisiveis[index];
  renderSetores();
}

// Editar nome do setor
function editSetorName(i) {
  const novoNome = prompt("Digite o novo nome do setor:", setores[i].nome);
  if (novoNome && novoNome.trim()) {
    setores[i].nome = novoNome.trim();
    saveSetoresAndMachines();
    renderSetores();
  } else alert("Nome inválido.");
}

// Remover setor
function removeSetor(i) {
  if (confirm("Excluir este setor?")) {
    setores.splice(i, 1);
    setoresVisiveis.splice(i, 1);
    saveSetoresAndMachines();
    renderSetores();
  }
}

// Modal de máquinas
let setorSelecionado = null;
function abrirModalMaquina(i) {
  setorSelecionado = i;
  document.getElementById("modalMaquina").style.display = "flex";
  resetModalMaquina();
}
function fecharModalMaquina() {
  document.getElementById("modalMaquina").style.display = "none";
  setorSelecionado = null;
}
window.addEventListener('click', e => {
  const modal = document.getElementById('modalMaquina');
  if (e.target === modal) fecharModalMaquina();
});

function resetModalMaquina() {
  document.getElementById("tipoEquipamento").value = "";
  document.getElementById("tipoMaquina").value = "";
  document.getElementById("nomeMaquina").value = "";
  document.getElementById("etiquetaMaquina").value = "";
  document.getElementById("etiquetaMonitor").value = "";
  trocarCampos();
}
function trocarCampos() {
  const tipo = document.getElementById("tipoEquipamento").value;
  document.getElementById("camposMaquina").style.display = tipo === 'máquina' ? 'block' : 'none';
  document.getElementById("camposMonitor").style.display = tipo === 'monitor' ? 'block' : 'none';
}

function confirmarAddMaquina() {
  const tipo = document.getElementById("tipoEquipamento").value;
  const idUnico = `maquina_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  if (tipo === 'máquina') {
    const tipoMaquina = document.getElementById("tipoMaquina").value.trim();
    const nomeMaquina = document.getElementById("nomeMaquina").value.trim();
    const etiquetaMaquina = document.getElementById("etiquetaMaquina").value.trim();

    if (!tipoMaquina || !nomeMaquina || !etiquetaMaquina) return alert("Preencha todos os campos da máquina.");

    setores[setorSelecionado].maquinas.push({
      id: idUnico,
      nome: nomeMaquina,
      tipo: tipoMaquina,
      etiqueta: etiquetaMaquina,
      chamado: [],
      emManutencao: false,
      tempoManutencao: 0
    });

  } else if (tipo === 'monitor') {
    const etiquetaMonitor = document.getElementById("etiquetaMonitor").value.trim();
    if (!etiquetaMonitor) return alert("Preencha a etiqueta do monitor.");

    setores[setorSelecionado].maquinas.push({
      id: idUnico,
      nome: `Monitor - ${etiquetaMonitor}`,
      tipo: 'Monitor',
      etiqueta: etiquetaMonitor,
      chamado: [],
      emManutencao: false,
      tempoManutencao: 0
    });
  } else {
    return alert("Selecione um tipo de equipamento.");
  }

  saveSetoresAndMachines();
  renderSetores();
  fecharModalMaquina();
}

// Remover máquina
function removeMaquina(setorI, maquinaI) {
  if (confirm("Excluir esta máquina?")) {
    setores[setorI].maquinas.splice(maquinaI, 1);
    saveSetoresAndMachines();
    renderSetores();
  }
}

// Salvar e carregar localStorage
function saveSetoresAndMachines() {
  localStorage.setItem('setores', JSON.stringify(setores));
}
function loadSetoresAndMachines() {
  setores = JSON.parse(localStorage.getItem('setores')) || [];
  setoresVisiveis = new Array(setores.length).fill(false);
  renderSetores(); // <-- garante que a renderização sempre ocorra após carregar
}
// Carrega dados do localStorage e renderiza setores quando a página abrir
document.addEventListener('DOMContentLoaded', () => {
  loadSetoresAndMachines();
  renderSetores();
});

// ----- Chamados ----- //

function toggleChecklist(legendElement) {
  const content = legendElement.nextElementSibling; // pega o div com checklist
  const arrow = legendElement.querySelector('.arrow');
  
  if (content.style.display === "none") {
    content.style.display = "block";
    arrow.textContent = "▼"; // seta para baixo (expandido)
  } else {
    content.style.display = "none";
    arrow.textContent = "►"; // seta para direita (recolhido)
  }
}



// Mostrar informações da máquina e seus chamados
function showInfo(setorIndex, maquinaIndex) {
  maquinaAtivaSetor = setorIndex;
  maquinaAtivaIndex = maquinaIndex;
  currentMachineId = setores[setorIndex].maquinas[maquinaIndex].id;

  // Exibir modal info
  const modal = document.getElementById('infoModal');
  modal.style.display = 'flex';

  atualizarListaChamados(currentMachineId);

  // Ajusta visibilidade dos botões e mensagem conforme estado da máquina
  const maquina = setores[setorIndex].maquinas[maquinaIndex];
  if (maquina.emManutencao) {
    document.getElementById('maintenanceMessage').style.display = 'block';
    document.getElementById('maintenanceBtn').style.display = 'none';
    document.getElementById('releaseBtn').style.display = 'inline-block';
  } else {
    document.getElementById('maintenanceMessage').style.display = 'none';
    document.getElementById('maintenanceBtn').style.display = 'inline-block';
    document.getElementById('releaseBtn').style.display = 'none';
  }
}




// Fecha modal info
function closeModal() {
  document.getElementById('infoModal').style.display = 'none';
  currentMachineId = null;
  maquinaAtivaSetor = null;
  maquinaAtivaIndex = null;

  clearForm();
}
window.addEventListener('click', e => {
  const modal = document.getElementById('infoModal');
  if (e.target === modal) closeModal();
});

// Salvar chamado
function saveObservation() {
  const observacao = document.getElementById('observacao').value.trim();
  const prioridade = document.getElementById('priority').value;
  const checkboxes = document.querySelectorAll('#maintenanceSection input[type="checkbox"]:checked');

  if (!currentMachineId) {
    alert('Nenhuma máquina selecionada para salvar o chamado.');
    return;
  }

  let checklistDescr = '';
  if (checkboxes.length > 0) {
    checklistDescr = 'Checklist:\n';
    checkboxes.forEach(cb => {
      checklistDescr += '- ' + cb.parentElement.textContent.trim() + '\n';
    });
  }

  let descricaoCompleta = '';
  if (observacao) descricaoCompleta += `Observação:\n${observacao}\n\n`;
  if (checklistDescr) descricaoCompleta += checklistDescr;

  if (!descricaoCompleta) {
    alert('Informe uma observação ou marque ao menos uma opção do checklist.');
    return;
  }

  const chamado = {
    maquinaId: currentMachineId,
    descricao: descricaoCompleta,
    prioridade,
    data: new Date().toISOString()
  };

  salvarChamado(chamado);
  alert('Chamado salvo com sucesso!');
  clearForm();
  atualizarListaChamados(currentMachineId);
}

// Limpa form chamados
function clearForm() {
  document.getElementById('observacao').value = '';
  document.querySelectorAll('#maintenanceSection input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById('priority').value = 'Baixa';
}

// Salvar chamado no localStorage
function salvarChamado(chamado) {
  let chamados = JSON.parse(localStorage.getItem('chamados')) || [];

  // Evita duplicata id + descrição exata
  const existe = chamados.some(c => c.maquinaId === chamado.maquinaId && c.descricao === chamado.descricao && c.data === chamado.data);
  if (!existe) {
    chamados.push(chamado);
    localStorage.setItem('chamados', JSON.stringify(chamados));
  }
}

// Atualizar lista de chamados do modal
function atualizarListaChamados(maquinaId) {
  const ul = document.getElementById('observationsUl');
  ul.innerHTML = '';

  const chamados = JSON.parse(localStorage.getItem('chamados')) || [];
  const chamadosDaMaquina = chamados.filter(c => c.maquinaId === maquinaId);

  if (chamadosDaMaquina.length === 0) {
    ul.innerHTML = '<li style="font-style: italic; color: #666;">Nenhum chamado registrado.</li>';
    return;
  }

  chamadosDaMaquina.forEach(chamado => {
    const li = document.createElement('li');
    li.style.marginBottom = '1rem';
    li.style.padding = '0.5rem';
    li.style.borderBottom = '1px solid #ccc';

    const dataSpan = document.createElement('span');
    dataSpan.style.fontWeight = 'bold';
    dataSpan.textContent = new Date(chamado.data).toLocaleString();

    const prioridadeSpan = document.createElement('span');
    prioridadeSpan.style.marginLeft = '10px';
    prioridadeSpan.style.padding = '2px 6px';
    prioridadeSpan.style.borderRadius = '4px';
    prioridadeSpan.style.color = 'white';

    switch(chamado.prioridade) {
      case 'Alta': prioridadeSpan.style.backgroundColor = '#e74c3c'; break;
      case 'Média': prioridadeSpan.style.backgroundColor = '#f39c12'; break;
      default: prioridadeSpan.style.backgroundColor = '#27ae60';
    }
    prioridadeSpan.textContent = chamado.prioridade;

    const descPre = document.createElement('pre');
    descPre.style.whiteSpace = 'pre-wrap';
    descPre.style.marginTop = '0.5rem';
    descPre.textContent = chamado.descricao;

    li.appendChild(dataSpan);
    li.appendChild(prioridadeSpan);
    li.appendChild(descPre);

    ul.appendChild(li);
  });
}

// Funções para marcar e liberar manutenção da máquina

function markForMaintenance() {
  if (maquinaAtivaSetor === null || maquinaAtivaIndex === null) {
    alert('Nenhuma máquina selecionada para manutenção.');
    return;
  }

  const maquina = setores[maquinaAtivaSetor].maquinas[maquinaAtivaIndex];
  maquina.emManutencao = true;
  maquina.tempoManutencao = Date.now();

  saveSetoresAndMachines();
  renderSetores();

  document.getElementById('maintenanceMessage').style.display = 'block';
  document.getElementById('maintenanceBtn').style.display = 'none';
  document.getElementById('releaseBtn').style.display = 'inline-block';
}

function releaseMachine() {
  if (maquinaAtivaSetor === null || maquinaAtivaIndex === null) {
    alert('Nenhuma máquina selecionada para liberar.');
    return;
  }

  const maquina = setores[maquinaAtivaSetor].maquinas[maquinaAtivaIndex];
  maquina.emManutencao = false;
  maquina.tempoManutencao = 0;

  saveSetoresAndMachines();
  renderSetores();

  document.getElementById('maintenanceMessage').style.display = 'none';
  document.getElementById('maintenanceBtn').style.display = 'inline-block';
  document.getElementById('releaseBtn').style.display = 'none';
}