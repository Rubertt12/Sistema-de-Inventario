// Variáveis globais
let setores = [];
let setoresVisiveis = [];
let setoresFiltradosIndices = null; // null = sem filtro
let maquinaAtivaSetor = null;
let maquinaAtivaIndex = null;
let maquinaEmMovimento = null;
let setorSelecionado = null;
let debounceTimer = null;

// ---------- MODAL SETOR ----------
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

// ---------- RENDERIZAÇÃO SETORES E MÁQUINAS ----------
function renderSetores(termoBusca = null) {
  const container = document.getElementById('setoresContainer');
  container.innerHTML = '';

  let indicesParaMostrar = setoresFiltradosIndices ?? setores.map((_, i) => i);

  if (indicesParaMostrar.length === 0) {
    container.innerHTML = '<p style="font-style: italic; color: #666;">Nenhum setor ou máquina encontrado.</p>';
    return;
  }

  indicesParaMostrar.forEach(i => {
    const setor = setores[i];
    const div = document.createElement('div');
    div.classList.add('setor');

    // Filtra máquinas se o termo não bater no setor
    let maquinasParaRenderizar = setor.maquinas;
    if (termoBusca && !setor.nome.toLowerCase().includes(termoBusca)) {
      maquinasParaRenderizar = setor.maquinas.filter(m =>
        m.nome.toLowerCase().includes(termoBusca) ||
        m.tipo.toLowerCase().includes(termoBusca) ||
        (m.etiqueta && m.etiqueta.toLowerCase().includes(termoBusca))
      );
    }

    div.ondragover = e => e.preventDefault();
    div.ondrop = e => dropMachine(e, i);

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
        ${maquinasParaRenderizar.map((m, mi) => `
          <div 
            draggable="true" 
            ondragstart="dragStart(event, ${i}, ${mi})" 
            style="background-color: ${m.emManutencao ? '#ff6b6b' : 'transparent'}; margin:5px; padding:5px; border:1px solid #ccc; border-radius:10px; cursor: grab;">
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

// ---------- TOGGLE MÁQUINAS VISÍVEIS ----------
function toggleMachines(i) {
  setoresVisiveis[i] = !setoresVisiveis[i];
  renderSetores();
}

// ---------- EDITAR SETOR ----------
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

// ---------- REMOVER SETOR ----------
function removeSetor(i) {
  if (confirm("Excluir este setor?")) {
    setores.splice(i, 1);
    setoresVisiveis.splice(i, 1);
    saveSetoresAndMachines();
    renderSetores();
  }
}

// ---------- MODAL MÁQUINA ----------
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
  document.getElementById("nomeImpressora").value = "";
document.getElementById("etiquetaImpressora").value = "";
  trocarCampos();
}
function trocarCampos() {
  const tipo = document.getElementById("tipoEquipamento").value;
  document.getElementById("camposMaquina").style.display = tipo === "máquina" ? "block" : "none";
  document.getElementById("camposMonitor").style.display = tipo === "monitor" ? "block" : "none";
document.getElementById("camposPrinter").style.display = tipo === "printer" ? "block" : "none";


}

function trocarCampos() {
  const tipo = document.getElementById("tipoEquipamento").value.toLowerCase();
  document.getElementById("camposMaquina").style.display = tipo === "máquina" ? "block" : "none";
  document.getElementById("camposMonitor").style.display = tipo === "monitor" ? "block" : "none";
  document.getElementById("camposPrinter").style.display = tipo === "printer" ? "block" : "none";
}

function confirmarAddMaquina() {
  const tipo = document.getElementById("tipoEquipamento").value.toLowerCase();
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

  } else if (tipo === 'printer') {
    const nomeImpressora = document.getElementById("nomeImpressora").value?.trim();
    const etiquetaImpressora = document.getElementById("etiquetaImpressora").value?.trim();
    // const nomeUsuario = document.getElementById("usuarioResponsavelPrinter").value?.trim();

    if (!nomeImpressora || !etiquetaImpressora) return alert("Preencha todos os campos da impressora.");

    setores[setorSelecionado].maquinas.push({
      id: idUnico,
      // usuarioResponsavel: nomeUsuario,
      nome: nomeImpressora,
      tipo: 'Impressora',
      etiqueta: etiquetaImpressora,
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


// ---------- REMOVER MÁQUINA ----------
function removeMaquina(setorI, maquinaI) {
  if (confirm("Excluir esta máquina?")) {
    setores[setorI].maquinas.splice(maquinaI, 1);
    saveSetoresAndMachines();
    renderSetores();
  }
}

// ---------- SALVAR E CARREGAR LOCALSTORAGE ----------
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

// ---------- CHAMADOS ----------
// Variável para armazenar id da máquina ativa (não usada no seu código, mas deixei)
let currentMachineId = null;

// ---------- showInfo com opção de editar nome ----------
function showInfo(setorIndex, maquinaIndex) {
  maquinaAtivaSetor = setorIndex;
  maquinaAtivaIndex = maquinaIndex;
  currentMachineId = setores[setorIndex].maquinas[maquinaIndex].id;

  const modal = document.getElementById('infoModal');
  modal.style.display = 'flex';
   modal.style.zIndex = '999';

  const maquina = setores[setorIndex].maquinas[maquinaIndex];

  document.getElementById('modalText').innerHTML = `
    <strong>Usuário:</strong> 
    <span id="usuarioInfo">${maquina.usuarioResponsavel || ''}</span>
    <button onclick="abrirModalEditarUsuario('${maquina.id}')" style="margin-left: 6px; cursor: pointer;" title="Editar usuário">✏️</button><br>
    <strong>Status:</strong> ${maquina.emManutencao ? 'Em manutenção' : 'Operando normalmente'}<br>
    <strong>Nome:</strong> ${maquina.nome}<br>
    <strong>Tipo:</strong> ${maquina.tipo}<br>
    <strong>Etiqueta:</strong> ${maquina.etiqueta}<br>
  `;

  atualizarListaChamados();

  document.getElementById('maintenanceMessage').style.display = maquina.emManutencao ? 'block' : 'none';
  document.getElementById('maintenanceBtn').style.display = maquina.emManutencao ? 'none' : 'inline-block';
  document.getElementById('releaseBtn').style.display = maquina.emManutencao ? 'inline-block' : 'none';
}
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

function clearForm() {
  document.getElementById('observacao').value = '';
  document.querySelectorAll('#maintenanceSection input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById('priority').value = 'Baixa';
}

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

// ---------- FILTRO COM DEBOUNCE ----------
function filterMachines() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
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
  }, 250);
}

// ---------- EXCLUIR TODOS SETORES ----------
function excluirTodosSetores() {
  if (confirm("Tem certeza que deseja excluir TODOS os setores? Esta ação não pode ser desfeita.")) {
    setores = [];
    setoresVisiveis = [];
    localStorage.removeItem('setores');
    renderSetores();
    alert("Todos os setores foram excluídos.");
  }
}

// ---------- LAYOUT ----------
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

// ---------- DRAG & DROP ----------
function dragStart(event, setorIndex, maquinaIndex) {
  maquinaEmMovimento = { setorIndex, maquinaIndex };
}

function dropMachine(event, novoSetorIndex) {
  if (!maquinaEmMovimento) return;

  const { setorIndex, maquinaIndex } = maquinaEmMovimento;
  if (setorIndex === novoSetorIndex) return;

  const maquina = setores[setorIndex].maquinas[maquinaIndex];
  setores[setorIndex].maquinas.splice(maquinaIndex, 1);
  setores[novoSetorIndex].maquinas.push(maquina);

  saveSetoresAndMachines();
  renderSetores();

  maquinaEmMovimento = null;
}




function abrirModalEditarUsuario(idMaquina) {
  maquinaEditandoId = idMaquina;

  const maquina = setores.flatMap(s => s.maquinas).find(m => m.id === idMaquina);
  if (!maquina) return alert("Máquina não encontrada.");

  document.getElementById("novoNomeUsuario").value = maquina.usuarioResponsavel || '';
  document.getElementById("modalEditarUsuario").style.display = "flex";
  document.getElementById("modalEditarUsuario").style.zIndex = '1001';
}

function fecharModalEditarUsuario() {
  document.getElementById("modalEditarUsuario").style.display = "none";
  maquinaEditandoId = null;
}

function salvarNovoNomeUsuario() {
  const novoNome = document.getElementById("novoNomeUsuario").value;

  for (let setor of setores) {
    const maquina = setor.maquinas.find(m => m.id === maquinaEditandoId);
    if (maquina) {
      maquina.usuarioResponsavel = novoNome.trim();
      // Atualiza o modalInfo se estiver aberto
      const usuarioSpan = document.getElementById("usuarioInfo");
      if (usuarioSpan) {
        usuarioSpan.textContent = maquina.usuarioResponsavel || '';
      }
      break;
    }
  }

  saveSetoresAndMachines();
  renderSetores();
  fecharModalEditarUsuario();
}

// ---------- MODAL HTML ----------
const modalHtml = `
  <div id="modalEditarUsuario" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:#00000080; align-items:center; justify-content:center; z-index:1001;">
    <div style="background:#fff; padding:20px; border-radius:10px; max-width:400px; width:90%; position:relative;">
      <h3>Editar Nome do Usuário</h3>
      <input type="text" id="novoNomeUsuario" placeholder="Novo nome do usuário" style="width:100%; padding:8px; margin:10px 0;" />
      <div style="text-align:right;">
        <button onclick="fecharModalEditarUsuario()">Cancelar</button>
        <button onclick="salvarNovoNomeUsuario()">Salvar</button>
      </div>
    </div>
  </div>
`;
document.body.insertAdjacentHTML('beforeend', modalHtml);





// JavaScript para Modal de Transferência com Paginação de Setores

let setorSelecionadoOrigem = null;
let setorSelecionadoDestino = null;
let maquinaSelecionada = null;
let paginaAtualOrigem = 1;
const setoresPorPagina = 5;

function abrirModalTransferencia() {
  const modal = document.getElementById('modalTransferencia');
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-transferencia-content styled-modal">
      <div style="display: flex; justify-content: flex-end;">
      <button class="btn-fechar" onclick="fecharModalTransferencia()">×</button>
      </div>
      <h2 class="modal-title">🔁 Transferência de Máquinas</h2>
      
      <div class="pesquisa-transferencia">
        <input type="text" id="buscaSetorOrigem" placeholder="🔍 Buscar Setor de Origem" oninput="buscarSetorOrigem()" />
        <input type="text" id="buscaSetorDestino" placeholder="📦 Buscar Setor de Destino" oninput="buscarSetorDestino()" />
      </div>

      <div class="caixas-transferencia">
        <div id="setorOrigemBox" class="box-setor origem">
          <h3>📤 Setor de Origem</h3>
          <div id="listaOrigem" class="lista-maquinas"></div>
          <div id="paginacaoOrigem" class="paginacao"></div>
        </div>

        <div id="setorDestinoBox" class="box-setor destino" ondragover="event.preventDefault()" ondrop="soltarMaquina(event)">
          <h3>📥 Setor de Destino</h3>
          <div id="listaDestino" class="lista-destino"></div>
        </div>
      </div>

      <div id="infoTransferencia" class="info-transferencia"></div>
      <button onclick="confirmarTransferencia()" class="btn-confirmar">✅ Confirmar Transferência</button>
    </div>
  `;

  document.getElementById('buscaSetorOrigem').value = '';
  document.getElementById('buscaSetorDestino').value = '';
  setorSelecionadoOrigem = null;
  setorSelecionadoDestino = null;
  maquinaSelecionada = null;
  paginaAtualOrigem = 1;

  renderizarSetoresOrigem();
}

function renderizarSetoresOrigem() {
  const listaOrigem = document.getElementById('listaOrigem');
  listaOrigem.innerHTML = '';

  const inicio = (paginaAtualOrigem - 1) * setoresPorPagina;
  const fim = inicio + setoresPorPagina;
  const setoresPagina = setores.slice(inicio, fim);

  setoresPagina.forEach(setor => {
    const setorDiv = document.createElement('div');
    setorDiv.className = 'setor-item styled-setor';
    setorDiv.textContent = setor.nome;
    setorDiv.onclick = () => mostrarMaquinasDoSetor(setor);
    listaOrigem.appendChild(setorDiv);
  });

  renderizarPaginacaoOrigem();
}

function renderizarPaginacaoOrigem() {
  const paginacao = document.getElementById('paginacaoOrigem');
  paginacao.innerHTML = '';
  const totalPaginas = Math.ceil(setores.length / setoresPorPagina);

  if (totalPaginas <= 1) return;

  if (paginaAtualOrigem > 1) {
    const btnAnterior = document.createElement('button');
    btnAnterior.textContent = '⬅ Anterior';
    btnAnterior.onclick = () => {
      paginaAtualOrigem--;
      renderizarSetoresOrigem();
    };
    paginacao.appendChild(btnAnterior);
  }

  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = i === paginaAtualOrigem ? 'btn-pagina ativo' : 'btn-pagina';
    btn.onclick = () => {
      paginaAtualOrigem = i;
      renderizarSetoresOrigem();
    };
    paginacao.appendChild(btn);
  }

  if (paginaAtualOrigem < totalPaginas) {
    const btnProximo = document.createElement('button');
    btnProximo.textContent = 'Próximo ➡';
    btnProximo.onclick = () => {
      paginaAtualOrigem++;
      renderizarSetoresOrigem();
    };
    paginacao.appendChild(btnProximo);
  }
}

function mostrarMaquinasDoSetor(setor) {
  setorSelecionadoOrigem = setor;
  const listaOrigem = document.getElementById('listaOrigem');
  const paginacao = document.getElementById('paginacaoOrigem');
  listaOrigem.innerHTML = '';
  paginacao.innerHTML = '';

  const voltar = document.createElement('button');
  voltar.textContent = '⬅️ Voltar aos Setores';
  voltar.className = 'btn-voltar';
  voltar.onclick = () => {
    setorSelecionadoOrigem = null;
    renderizarSetoresOrigem();
  };
  listaOrigem.appendChild(voltar);

  const titulo = document.createElement('h4');
  titulo.textContent = '💻 Máquinas de ' + setor.nome;
  listaOrigem.appendChild(titulo);

  setor.maquinas.forEach(maquina => {
    const div = document.createElement('div');
    div.className = 'maquina-item styled-maquina';
    div.draggable = true;
    div.textContent = maquina.etiqueta || maquina.nome || 'Sem nome';
    div.ondragstart = e => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ maquinaId: maquina.id }));
    };
    div.onclick = () => selecionarMaquina(maquina, div);
    listaOrigem.appendChild(div);
  });
}

function fecharModalTransferencia() {
  document.getElementById('modalTransferencia').style.display = 'none';
}

function limparCampoOrigem() {
  const box = document.getElementById('listaOrigem');
  if (box) box.innerHTML = '';
}

function limparCampoDestino() {
  const box = document.getElementById('listaDestino');
  if (box) box.innerHTML = '';
}

function buscarSetorDestino() {
  const termo = document.getElementById('buscaSetorDestino').value.toLowerCase();
  const setor = setores.find(s => s.nome.toLowerCase().includes(termo) && s.nome !== setorSelecionadoOrigem?.nome);
  limparCampoDestino();
  if (!setor) return;
  setorSelecionadoDestino = setor;
  document.getElementById('listaDestino').innerHTML = `<p>📦 Setor selecionado: <strong>${setor.nome}</strong></p>`;
}

function selecionarMaquina(maquina, div) {
  maquinaSelecionada = maquina;
  document.querySelectorAll('#listaOrigem .maquina-item').forEach(el => el.classList.remove('selecionada'));
  div.classList.add('selecionada');
  limparCampoDestino();
  document.getElementById('buscaSetorDestino').value = '';
}

function soltarMaquina(event) {
  event.preventDefault();
  const data = JSON.parse(event.dataTransfer.getData('text/plain'));
  const maquina = setorSelecionadoOrigem?.maquinas.find(m => m.id === data.maquinaId);
  if (!maquina || !setorSelecionadoDestino || setorSelecionadoDestino.nome === setorSelecionadoOrigem.nome) return;
  setorSelecionadoOrigem.maquinas = setorSelecionadoOrigem.maquinas.filter(m => m.id !== maquina.id);
  setorSelecionadoDestino.maquinas.push(maquina);
  saveSetoresAndMachines();
  renderSetores();
  fecharModalTransferencia();
}

function confirmarTransferencia() {
  if (!setorSelecionadoOrigem || !setorSelecionadoDestino || !maquinaSelecionada) {
    alert('Selecione setor de origem, máquina e setor de destino.');
    return;
  }
  if (setorSelecionadoOrigem.nome === setorSelecionadoDestino.nome) {
    alert('Setor de destino deve ser diferente do setor de origem.');
    return;
  }
  setorSelecionadoOrigem.maquinas = setorSelecionadoOrigem.maquinas.filter(m => m.id !== maquinaSelecionada.id);
  setorSelecionadoDestino.maquinas.push(maquinaSelecionada);
  saveSetoresAndMachines();
  renderSetores();
  fecharModalTransferencia();
}
