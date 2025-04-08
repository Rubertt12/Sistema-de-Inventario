// Variáveis globais
let paginaAtual = 1;
const chamadosPorPagina = 3;

function showInfo(setorIndex, maquinaIndex) {
    const modal = document.getElementById('infoModal');
    const maquina = setores[setorIndex].maquinas[maquinaIndex];

    document.getElementById('modalText').innerHTML = `
        <strong>Máquina:</strong> ${maquina.nome}<br>
        <strong>Tipo:</strong> ${maquina.tipo}<br>
        <strong>Etiqueta:</strong> ${maquina.etiqueta || 'Sem etiqueta'}
    `;

    currentSetorIndex = setorIndex;
    currentMaquinaIndex = maquinaIndex;
    paginaAtual = 1;

    renderChamados(maquina);
    modal.style.display = 'flex';

    const maintenanceBtn = document.getElementById('maintenanceBtn');
    maintenanceBtn.textContent = maquina.emManutencao ? "Desmarcar para Manutenção" : "Marcar para Manutenção";

    document.getElementById('maintenanceMessage').style.display = maquina.emManutencao ? 'block' : 'none';
}

function closeModal() {
    const modal = document.getElementById("infoModal");
    modal.style.display = "none";
}

// Fecha o modal se clicar fora do conteúdo
window.onclick = function(event) {
    const modal = document.getElementById("infoModal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
};
function closeModal() {
    const modal = document.getElementById("infoModal");
    modal.style.display = "none";
}

window.onclick = function(event) {
    const modal = document.getElementById("infoModal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
};



function renderChamados(maquina) {
    const lista = document.getElementById('observationsUl');
    const paginacao = document.getElementById('pagination');

    // Ordena do mais recente para o mais antigo
    const chamadosOrdenados = [...maquina.chamado].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    const totalChamados = chamadosOrdenados.length;
    const totalPaginas = Math.ceil(totalChamados / chamadosPorPagina);

    const inicio = (paginaAtual - 1) * chamadosPorPagina;
    const fim = inicio + chamadosPorPagina;
    const chamadosVisiveis = chamadosOrdenados.slice(inicio, fim);

    lista.innerHTML = chamadosVisiveis.map((chamado, index) => `
        <li>
            <strong>${chamado.dataHora}</strong><br>
            ${chamado.observacao} - Prioridade: ${chamado.prioridade}
            <button onclick="excluirChamado(${inicio + index})" class="delete-btn">🗑️</button>
        </li>
    `).join('');

    // Botões de paginação
    paginacao.innerHTML = '';
    if (totalPaginas > 1) {
        if (paginaAtual > 1) {
            const btnAnterior = document.createElement('button');
            btnAnterior.textContent = 'Anterior';
            btnAnterior.onclick = () => {
                paginaAtual--;
                renderChamados(maquina);
            };
            paginacao.appendChild(btnAnterior);
        }

        if (paginaAtual < totalPaginas) {
            const btnProximo = document.createElement('button');
            btnProximo.textContent = 'Próximo';
            btnProximo.onclick = () => {
                paginaAtual++;
                renderChamados(maquina);
            };
            paginacao.appendChild(btnProximo);
        }
    }
}

function excluirChamado(index) {
    const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
    
    // Ordena os chamados mais recentes primeiro
    const chamadosOrdenados = [...maquina.chamado].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    chamadosOrdenados.splice(index, 1);

    // Atualiza a lista original
    setores[currentSetorIndex].maquinas[currentMaquinaIndex].chamado = chamadosOrdenados;

    // Recalcula o número total de páginas
    const totalPaginas = Math.ceil(chamadosOrdenados.length / chamadosPorPagina);

    // Se a página atual estiver além do total de páginas, volta uma
    if (paginaAtual > totalPaginas) {
        paginaAtual = totalPaginas;
    }

    saveSetoresAndMachines();
    renderChamados(maquina);
}


function saveObservation() {
    const observacao = document.getElementById('observacao').value;
    const prioridade = document.getElementById('priority').value;

    if (observacao) {
        const dataHoraAtual = new Date().toLocaleString('pt-BR');
        setores[currentSetorIndex].maquinas[currentMaquinaIndex].chamado.push({ observacao, prioridade, dataHora: dataHoraAtual });
        document.getElementById('observacao').value = '';
        saveSetoresAndMachines();
        renderSetores();
        showInfo(currentSetorIndex, currentMaquinaIndex);
    } else {
        alert("A observação não pode estar vazia.");
    }
}

// Função para marcar a máquina para manutenção
function markForMaintenance() {
    const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
    const maquinaElement = document.getElementById(`maquina-${currentMaquinaIndex}`);

    maquina.emManutencao = !maquina.emManutencao;
    maquinaElement.style.backgroundColor = maquina.emManutencao ? "red" : "";

    if (maquina.emManutencao) {
        maquina.tempoManutencao = 0;
        startMaintenanceTimer(currentSetorIndex, currentMaquinaIndex);
    } else {
        stopMaintenanceTimer(currentSetorIndex, currentMaquinaIndex);
    }

    const maintenanceBtn = document.getElementById('maintenanceBtn');
    maintenanceBtn.textContent = maquina.emManutencao ? "Desmarcar para Manutenção" : "Marcar para Manutenção";

    document.getElementById('maintenanceMessage').style.display = maquina.emManutencao ? 'block' : 'none';

    saveSetoresAndMachines();
}


// Função para iniciar o temporizador de manutenção
function startMaintenanceTimer(setorIndex, maquinaIndex) {
    const maquina = setores[setorIndex].maquinas[maquinaIndex];
    if (timers[maquinaIndex]) clearInterval(timers[maquinaIndex]);

    timers[maquinaIndex] = setInterval(() => {
        if (maquina.emManutencao && maquina.tempoManutencao < 100) {
            maquina.tempoManutencao += 1;
            saveSetoresAndMachines();
            renderSetores();
        }
    }, 1000);
}

// Função para parar o temporizador de manutenção
function stopMaintenanceTimer(setorIndex, maquinaIndex) {
    if (timers[maquinaIndex]) {
        clearInterval(timers[maquinaIndex]);
        timers[maquinaIndex] = null;
    }
}

// Função para filtrar máquinas
function filterMachines() {
    const input = document.getElementById("searchInput").value.toUpperCase();
    const setoresContainer = document.getElementById('setoresContainer');
    setoresContainer.innerHTML = '';

    setores.forEach((setor, setorIndex) => {
        const setorMatches = setor.nome.toUpperCase().includes(input);
        const maquinasMatches = setor.maquinas.some(maquina =>
            maquina.nome.toUpperCase().includes(input) || maquina.tipo.toUpperCase().includes(input)
        );

        if (setorMatches || maquinasMatches) {
            const setorDiv = createSetorElement(setor, setorIndex);
            setoresContainer.appendChild(setorDiv);
        }
    });
}


let chamadoEditIndex = null;

function abrirEditChamadoModal(index) {
    const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
    const chamadosOrdenados = [...maquina.chamado].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    const chamado = chamadosOrdenados[index];

    chamadoEditIndex = index;

    document.getElementById("editObservacao").value = chamado.observacao;
    document.getElementById("editPrioridade").value = chamado.prioridade;

    document.getElementById("editChamadoModal").style.display = "flex";
}

function fecharEditChamadoModal() {
    document.getElementById("editChamadoModal").style.display = "none";
    chamadoEditIndex = null;
}

function salvarEdicaoChamado() {
    const novaObs = document.getElementById("editObservacao").value.trim();
    const novaPrioridade = document.getElementById("editPrioridade").value;

    if (novaObs === "") {
        alert("A observação não pode estar vazia.");
        return;
    }

    const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
    const chamadosOrdenados = [...maquina.chamado].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    
    chamadosOrdenados[chamadoEditIndex].observacao = novaObs;
    chamadosOrdenados[chamadoEditIndex].prioridade = novaPrioridade;

    setores[currentSetorIndex].maquinas[currentMaquinaIndex].chamado = chamadosOrdenados;

    saveSetoresAndMachines();
    renderChamados(maquina);
    fecharEditChamadoModal();
}
