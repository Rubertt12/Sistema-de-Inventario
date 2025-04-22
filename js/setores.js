let setores = [];
let currentSetorIndex, currentMaquinaIndex;
let timers = []; // Array para armazenar os temporizadores de cada máquina
let setoresVisiveis = []; // Array para armazenar o estado de visibilidade dos setores

/// Função para alternar entre lista e grid
function toggleLayout() {
    const container = document.getElementById('setoresContainer');
    const toggle = document.getElementById('layoutToggle');
  
    if (toggle.checked) {
      // Lista
      container.classList.remove('grid-view');
      container.classList.add('list-view');
    } else {
      // Grid
      container.classList.remove('list-view');
      container.classList.add('grid-view');
    }
  
    container.style.transition = 'all 0.5s ease';
  }
  
  // Ao carregar a página
  window.onload = () => {
    document.activeElement.blur();
  
    const container = document.getElementById('setoresContainer');
    const toggle = document.getElementById('layoutToggle');
  
    // Força o grid como padrão
    container.classList.add('grid-view');
    container.classList.remove('list-view');
  
    // Garante que o switch comece desmarcado (grid)
    toggle.checked = false;
  };
  


// Abre o modal
function addSetor() {
    document.getElementById("modalSetor").style.display = "flex";
  }
  
  // Fecha o modal
  function fecharModalSetor() {
    document.getElementById("modalSetor").style.display = "none";
  }
  

// Fecha o modal ao clicar fora do conteúdo
window.addEventListener('click', function(event) {
  const modal = document.getElementById('modalSetor');
  if (event.target === modal) {
    fecharModalSetor();
  }
});


  // Confirma e adiciona o setor
  function confirmarAddSetor() {
    const setorName = document.getElementById("inputSetorNome").value.trim();
    if (setorName) {
      const setor = {
        nome: setorName,
        maquinas: []
      };
      setores.push(setor);
      setoresVisiveis.push(false);
      saveSetoresAndMachines();
      renderSetores();
      fecharModalSetor();
      document.getElementById("inputSetorNome").value = "";
    } else {
      alert("Por favor, insira um nome para o setor.");
    }
  }
  





// Função para renderizar setores
function renderSetores() {
    const container = document.getElementById('setoresContainer');
    container.innerHTML = ''; // Limpar o container antes de renderizar

    setores.forEach((setor, index) => {
        const setorDiv = createSetorElement(setor, index);
        container.appendChild(setorDiv);
    });
}

// Função para criar o elemento HTML de um setor
function createSetorElement(setor, index) {
    const setorDiv = document.createElement('div');
    setorDiv.classList.add('setor');
    setorDiv.innerHTML = `
    <div class="setor-header">
        <h2 class="setor-nome" title="${setor.nome}">${setor.nome}</h2>
        <div class="setor-actions">
            <button onclick="editarSetor(${index})">✏️</button>
            <button onclick="removeSetor(${index})">X</button>
        </div>
    </div>
    <div class="card-botoes">
        <button class="add-machine-btn" onclick="addMaquina(${index})">Adicionar Máquina</button>
        <button class="toggle-btn" onclick="toggleMachines(${index})">Mostrar Máquinas</button>
    </div>
    <div id="maquinas-${index}" class="machines-list" style="display: ${setoresVisiveis[index] ? 'block' : 'none'};">
        ${setor.maquinas.map((maquina, maquinaIndex) => createMachineElement(maquina, maquinaIndex, index)).join('')}
    </div>
`;
    return setorDiv;
}

// Função para criar o elemento HTML de uma máquina
function createMachineElement(maquina, maquinaIndex, setorIndex) {
    return `
        <div class="machine" id="maquina-${maquinaIndex}" style="background-color: ${maquina.emManutencao ? 'red' : ''}">
            <div class="machine-info">
                <strong>${maquina.nome}</strong> (${maquina.tipo}) - ${maquina.emManutencao ? 'Em Manutenção' : 'Operando'}
            </div>
            <button class="info-btn" onclick="showInfo(${setorIndex}, ${maquinaIndex})">Info</button>
            <button class="delete-machine-btn" onclick="removeMaquina(${setorIndex}, ${maquinaIndex})">Excluir Máquina</button>
        </div>
    `;
}


let setorSelecionado = null;

function abrirModalMaquina(index) {
  setorSelecionado = index;
  document.getElementById("modalMaquina").style.display = "flex";
}

function fecharModalMaquina() {
  document.getElementById("modalMaquina").style.display = "none";
  setorSelecionado = null;

  // Limpa os campos
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

  if (tipo === 'máquina') {
    const tipoMaquina = document.getElementById("tipoMaquina").value.trim();
    const nomeMaquina = document.getElementById("nomeMaquina").value.trim();
    const etiquetaMaquina = document.getElementById("etiquetaMaquina").value.trim();

    if (tipoMaquina && nomeMaquina && etiquetaMaquina) {
      setores[setorSelecionado].maquinas.push({
        nome: nomeMaquina,
        tipo: tipoMaquina,
        etiqueta: etiquetaMaquina,
        chamado: [],
        emManutencao: false,
        tempoManutencao: 0
      });
    } else {
      alert("Preencha todos os campos da máquina.");
      return;
    }

  } else if (tipo === 'monitor') {
    const etiquetaMonitor = document.getElementById("etiquetaMonitor").value.trim();

    if (etiquetaMonitor) {
      setores[setorSelecionado].maquinas.push({
        nome: `Monitor - ${etiquetaMonitor}`,
        tipo: 'Monitor',
        etiqueta: etiquetaMonitor,
        chamado: [],
        emManutencao: false,
        tempoManutencao: 0
      });
    } else {
      alert("Preencha a etiqueta do monitor.");
      return;
    }

  } else {
    alert("Selecione um tipo de equipamento.");
    return;
  }

  saveSetoresAndMachines();
  renderSetores();
  fecharModalMaquina();
}



// Função para alternar visibilidade das máquinas
function toggleMachines(setorIndex) {
    setoresVisiveis[setorIndex] = !setoresVisiveis[setorIndex];
    renderSetores();
}

// Função para salvar setores e máquinas no localStorage
function saveSetoresAndMachines() {
    localStorage.setItem('setores', JSON.stringify(setores));
}

// Função para carregar setores e máquinas do localStorage
function loadSetoresAndMachines() {
    const savedSetores = JSON.parse(localStorage.getItem('setores')) || [];
    setores = savedSetores;
    setoresVisiveis = new Array(setores.length).fill(false);
    renderSetores();
}

// Carregar os dados após o carregamento da página
document.addEventListener('DOMContentLoaded', loadSetoresAndMachines);


// Carregar os dados após o carregamento da página
document.addEventListener('DOMContentLoaded', loadSetoresAndMachines);
// Função para editar o nome do setor
function editSetorName(setorIndex) {
    const newName = prompt("Digite o novo nome do setor:", setores[setorIndex].nome);
    if (newName && newName.trim() !== "") {
        setores[setorIndex].nome = newName.trim();
        saveSetoresAndMachines();
        renderSetores();
    } else {
        alert("O nome do setor não pode ser vazio.");
    }
}


// Função para criar o elemento HTML de um setor
function createSetorElement(setor, index) {
    const setorDiv = document.createElement('div');
    setorDiv.classList.add('setor');
    setorDiv.innerHTML = `
        <h2>
            <span>${setor.nome}</span>
            <button class="edit-btn" onclick="editSetorName(${index})">✎</button>
            <button class="delete-btn" onclick="removeSetor(${index})">X</button>
        </h2>
       <button class="add-machine-btn" onclick="abrirModalMaquina(${index})">Adicionar Máquina</button>

        <button class="toggle-btn" onclick="toggleMachines(${index})">Mostrar Máquinas</button>
        <div id="maquinas-${index}" class="machines-list" style="display: ${setoresVisiveis[index] ? 'block' : 'none'};">
            ${setor.maquinas.map((maquina, maquinaIndex) => createMachineElement(maquina, maquinaIndex, index)).join('')}
        </div>
    `;
    return setorDiv;
}


// Função para remover setor
function removeSetor(setorIndex) {
    if (confirm("Tem certeza que deseja excluir este setor?")) {
        setores.splice(setorIndex, 1);
        setoresVisiveis.splice(setorIndex, 1); // Remover o estado de visibilidade do setor
        saveSetoresAndMachines();
        renderSetores();
    }
}

// Função para remover máquina
function removeMaquina(setorIndex, maquinaIndex) {
    if (confirm("Tem certeza que deseja excluir esta máquina?")) {
        stopMaintenanceTimer(setorIndex, maquinaIndex);
        setores[setorIndex].maquinas.splice(maquinaIndex, 1);
        saveSetoresAndMachines();
        renderSetores();
    }
}


function excluirTodosSetores() {
  if (confirm("Tem certeza que deseja excluir todos os setores?")) {
    const container = document.getElementById("setoresContainer");
    container.innerHTML = "";

    // Limpa o localStorage com a chave correta usada no sistema
    localStorage.setItem("setores", JSON.stringify([]));

    // Limpa também os arrays em memória
    setores = [];
    setoresVisiveis = [];

    renderSetores();

    alert("Todos os setores foram removidos com sucesso!");
  }
}
