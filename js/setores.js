// Variáveis globais para máquina ativa no modal info
let maquinaAtivaSetor = null;
let maquinaAtivaIndex = null;

// Modal de Setores
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

// Renderização de setores e máquinas
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
          <button onclick="editSetorName(${i})" title="Editar nome">✏️</button>
          <button onclick="removeSetor(${i})" title="Excluir setor">X</button>
        </div>
      </div>
      <button onclick="abrirModalMaquina(${i})">Adicionar Máquina</button>
      <button onclick="toggleMachines(${i})">${setoresVisiveis[i] ? 'Esconder Máquinas' : 'Mostrar Máquinas'}</button>
      <div id="maquinas-${i}" style="display: ${setoresVisiveis[i] ? 'block' : 'none'};">
        ${setor.maquinas.map((m, mi) => `
          <div style="background-color: ${m.emManutencao ? '#ff6b6b' : 'transparent'}; margin:5px; padding:5px; border:1px solid #ccc; border-radius:10px;">
            <strong>${m.nome}</strong> (${m.tipo}) - ${m.emManutencao ? 'Em Manutenção' : 'Operando'}
            <button onclick="showInfo(${i}, ${mi})" title="Informações">Info</button>
            <button onclick="removeMaquina(${i}, ${mi})" title="Excluir máquina">Excluir</button>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(div);
  });
}

// Alterna visibilidade das máquinas no setor
function toggleMachines(i) {
  setoresVisiveis[i] = !setoresVisiveis[i];
  renderSetores();
}

// Editar nome do setor
function editSetorName(i) {
  const novoNome = prompt("Digite o novo nome do setor:", setores[i].nome);
  if (novoNome && novoNome.trim()) {
    setores[i].nome = novoNome.trim();
    saveSetoresAndMachines();
    renderSetores();
  } else {
    alert("Nome inválido.");
  }
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
  document.getElementById("usuarioResponsavel").value = "";
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
    const nomeUsuario = document.getElementById("usuarioResponsavel").value.trim();
    const tipoMaquina = document.getElementById("tipoMaquina").value.trim();
    const nomeMaquina = document.getElementById("nomeMaquina").value.trim();
    const etiquetaMaquina = document.getElementById("etiquetaMaquina").value.trim();

    if (!tipoMaquina || !nomeMaquina || !etiquetaMaquina) return alert("Preencha todos os campos da máquina.");

    setores[setorSelecionado].maquinas.push({
      usuarioResponsavel: nomeUsuario,
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
    const nomeUsuario = document.getElementById("usuarioResponsavel").value.trim();
    if (!etiquetaMonitor) return alert("Preencha a etiqueta do monitor.");


    setores[setorSelecionado].maquinas.push({
      id: idUnico,
      usuarioResponsavel: nomeUsuario,
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
  renderSetores();
}
document.addEventListener('DOMContentLoaded', () => {
  loadSetoresAndMachines();
});

// ----- Chamados ----- //

// Mostrar modal info e listar chamados da máquina
function showInfo(setorIndex, maquinaIndex) {
  maquinaAtivaSetor = setorIndex;
  maquinaAtivaIndex = maquinaIndex;

  const modal = document.getElementById('infoModal');
  modal.style.display = 'flex';

  atualizarListaChamados();

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
  maquinaAtivaSetor = null;
  maquinaAtivaIndex = null;
  clearForm();
}
window.addEventListener('click', e => {
  const modal = document.getElementById('infoModal');
  if (e.target === modal) closeModal();
});

// Atualiza lista de chamados da máquina ativa
function atualizarListaChamados() {
  const ul = document.getElementById('observationsUl');
  ul.innerHTML = '';

  if (maquinaAtivaSetor === null || maquinaAtivaIndex === null) return;

  const maquina = setores[maquinaAtivaSetor].maquinas[maquinaAtivaIndex];
  const chamados = maquina.chamado || [];

  if (chamados.length === 0) {
    ul.innerHTML = '<li style="font-style: italic; color: #666;">Nenhum chamado registrado.</li>';
    return;
  }

  chamados.forEach(chamado => {
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
    descPre.textContent = chamado.descricao || chamado.observacao || '';

    li.appendChild(dataSpan);
    li.appendChild(prioridadeSpan);
    li.appendChild(descPre);

    ul.appendChild(li);
  });
}

// Salvar novo chamado na máquina ativa
function saveObservation() {
  if (maquinaAtivaSetor === null || maquinaAtivaIndex === null) {
    alert('Nenhuma máquina selecionada para salvar o chamado.');
    return;
  }

  const observacao = document.getElementById('observacao').value.trim();
  const prioridade = document.getElementById('priority').value;
  const checkboxes = document.querySelectorAll('#maintenanceSection input[type="checkbox"]:checked');

  if (!observacao && checkboxes.length === 0) {
    alert('Informe uma observação ou marque ao menos uma opção do checklist.');
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

  const chamado = {
    data: new Date().toISOString(),
    prioridade,
    descricao: descricaoCompleta
  };

  setores[maquinaAtivaSetor].maquinas[maquinaAtivaIndex].chamado.push(chamado);
  saveSetoresAndMachines();
  atualizarListaChamados();
  clearForm();
  alert('Chamado salvo com sucesso!');
}

// Limpa form do chamado
function clearForm() {
  document.getElementById('observacao').value = '';
  document.querySelectorAll('#maintenanceSection input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById('priority').value = 'Baixa';
}

// Marcar máquina para manutenção
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

// Liberar máquina da manutenção
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


let setoresFiltradosIndices = null; // null = sem filtro

function filterMachines() {
  const termo = document.getElementById('searchInput').value.toLowerCase().trim();
  if (!termo) {
    setoresFiltradosIndices = null;
    renderSetores();
    return;
  }

  setoresFiltradosIndices = setores.reduce((acc, setor, i) => {
    const setorMatch = setor.nome.toLowerCase().includes(termo);
    const maquinasMatch = setor.maquinas.some(m => {
      return (
        m.nome.toLowerCase().includes(termo) ||
        m.tipo.toLowerCase().includes(termo) ||
        (m.etiqueta && m.etiqueta.toLowerCase().includes(termo))
      );
    });

    if (setorMatch || maquinasMatch) acc.push(i);
    return acc;
  }, []);

  renderSetores(termo);
}

// Agora ajusta o renderSetores para aceitar o termo (string) ou null
function renderSetores(termoBusca = null) {
  const container = document.getElementById('setoresContainer');
  container.innerHTML = '';

  let indicesParaMostrar = setoresFiltradosIndices;
  if (!indicesParaMostrar) {
    // Sem filtro: mostra todos
    indicesParaMostrar = setores.map((_, i) => i);
  }

  if (indicesParaMostrar.length === 0) {
    container.innerHTML = '<p style="font-style: italic; color: #666;">Nenhum setor ou máquina encontrado.</p>';
    return;
  }

  indicesParaMostrar.forEach(i => {
    const setor = setores[i];
    const div = document.createElement('div');
    div.classList.add('setor');

    // Se tiver termo e o termo bater no setor (busca por setor), mostramos todas máquinas
    // Senão, filtramos as máquinas que batem no termo
    let maquinasParaRenderizar = setor.maquinas;

    if (termoBusca && !setor.nome.toLowerCase().includes(termoBusca)) {
      maquinasParaRenderizar = setor.maquinas.filter(m => {
        return (
          m.nome.toLowerCase().includes(termoBusca) ||
          m.tipo.toLowerCase().includes(termoBusca) ||
          (m.etiqueta && m.etiqueta.toLowerCase().includes(termoBusca))
        );
      });
    }

    // Render com botões e funcionalidades intactas
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
        ${maquinasParaRenderizar.map((m, mi) => `
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




function excluirTodosSetores() {
  if (confirm("Tem certeza que deseja excluir TODOS os setores? Esta ação não pode ser desfeita.")) {
    setores = [];
    setoresVisiveis = [];
    localStorage.removeItem('setores');  // limpa do localStorage
    localStorage.removeItem('chamados'); // se quiser apagar também os chamados (opcional)

    renderSetores();
    alert("Todos os setores foram excluídos.");
  }
}




function toggleLayout() {
  const container = document.getElementById('setoresContainer');
  const toggle = document.getElementById('layoutToggle');

  if (toggle.checked) {
    container.classList.remove('list-view');
    container.classList.add('grid-view');
  } else {
    container.classList.remove('grid-view');
    container.classList.add('list-view');
  }
}




let maquinaEmMovimento = null;

function renderSetores() {
  const container = document.getElementById('setoresContainer');
  container.innerHTML = '';

  setores.forEach((setor, i) => {
    // Cria div do setor com ondrop e ondragover
    const divSetor = document.createElement('div');
    divSetor.classList.add('setor');
    divSetor.ondragover = e => e.preventDefault();
    divSetor.ondrop = e => dropMachine(e, i);

    divSetor.innerHTML = `
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
          <div 
            draggable="true" 
            ondragstart="dragStart(event, ${i}, ${mi})" 
            style="background-color: ${m.emManutencao ? '#ff6b6b' : 'transparent'}; margin:5px; padding:5px; border:1px solid #ccc; border-radius:10px; cursor: grab;">
            <strong>${m.nome}</strong> (${m.tipo}) - ${m.emManutencao ? 'Em Manutenção' : 'Operando'}
            <button onclick="showInfo(${i}, ${mi})">Info</button>
            <button onclick="removeMaquina(${i}, ${mi})">Excluir</button>
          </div>
        `).join('')}
      </div>
    `;

    container.appendChild(divSetor);
  });
}

function dragStart(event, setorIndex, maquinaIndex) {
  maquinaEmMovimento = { setorIndex, maquinaIndex };
}

function dropMachine(event, novoSetorIndex) {
  if (!maquinaEmMovimento) return;

  const { setorIndex, maquinaIndex } = maquinaEmMovimento;
  if (setorIndex === novoSetorIndex) return; // evita soltar no mesmo setor

  const maquina = setores[setorIndex].maquinas[maquinaIndex];
  setores[setorIndex].maquinas.splice(maquinaIndex, 1);
  setores[novoSetorIndex].maquinas.push(maquina);

  saveSetoresAndMachines();
  renderSetores();

  maquinaEmMovimento = null;
}





function showInfo(setorIndex, maquinaIndex) {
  maquinaAtivaSetor = setorIndex;
  maquinaAtivaIndex = maquinaIndex;
  currentMachineId = setores[setorIndex].maquinas[maquinaIndex].id;

  const modal = document.getElementById('infoModal');
  modal.style.display = 'flex';

  const maquina = setores[setorIndex].maquinas[maquinaIndex];

  // ⬇️ Aqui preenche o texto com as informações
  
  document.getElementById('modalText').innerHTML = `
  <strong>Usuário:</strong> ${maquina.usuarioResponsavel || 'Não informado'}<br>
  <strong>Status:</strong> ${maquina.emManutencao ? 'Em manutenção' : 'Operando normalmente'}<br>
  <strong>Nome:</strong> ${maquina.nome}<br>
  <strong>Tipo:</strong> ${maquina.tipo}<br>
  <strong>Etiqueta:</strong> ${maquina.etiqueta}<br>

  

  `;

  atualizarListaChamados(currentMachineId);

  // Botões manutenção
  document.getElementById('maintenanceMessage').style.display = maquina.emManutencao ? 'block' : 'none';
  document.getElementById('maintenanceBtn').style.display = maquina.emManutencao ? 'none' : 'inline-block';
  document.getElementById('releaseBtn').style.display = maquina.emManutencao ? 'inline-block' : 'none';
}