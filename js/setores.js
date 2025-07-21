// ====================================================================
// START: Global Variables
// Descrição: Declaração de variáveis globais utilizadas em todo o script.
// ====================================================================
let setores = []; // Armazena todos os setores e suas máquinas.
let setoresVisiveis = []; // Controla a visibilidade das máquinas em cada setor (true/false).
let setoresFiltradosIndices = null; // Armazena os índices dos setores visíveis após uma busca (null se não houver filtro).
let maquinaAtivaSetor = null; // Índice do setor da máquina atualmente selecionada para visualização/edição.
let maquinaAtivaIndex = null; // Índice da máquina dentro do setor atualmente selecionada para visualização/edição.
let maquinaEmMovimento = null; // Objeto para armazenar informações da máquina durante o drag & drop.
let setorSelecionado = null; // Índice do setor atualmente selecionado para adicionar uma nova máquina.
let debounceTimer = null; // Timer para a função de debounce da busca.
let paginaSetoresAtual = 1; // Página atual da paginação de setores.
const setoresPorPagina = 10; // Número de setores a serem exibidos por página.
let currentMachineId = null; // ID da máquina atualmente ativa no modal de informações (utilizado para referência).
let maquinaEditandoId = null; // ID da máquina que está sendo editada no modal de edição de usuário.
let setorSelecionadoOrigem = null; // Setor de origem para transferência de máquinas.
let setorSelecionadoDestino = null; // Setor de destino para transferência de máquinas.
let maquinaSelecionada = null; // Máquina selecionada para transferência.
let paginaAtualOrigem = 1; // Página atual da lista de setores de origem na modal de transferência.
// ====================================================================
// END: Global Variables
// ====================================================================

// ---

// ====================================================================
// START: Sector Management (Modal and Actions)
// Descrição: Funções relacionadas à adição, edição e remoção de setores.
// ====================================================================

/**
 * Abre o modal para adicionar um novo setor.
 */
function addSetor() {
    document.getElementById("modalSetor").style.display = "flex";
}

/**
 * Fecha o modal de adição/edição de setor.
 */
function fecharModalSetor() {
    document.getElementById("modalSetor").style.display = "none";
}

// Fecha o modal de setor ao clicar fora dele.
window.addEventListener('click', e => {
    const modal = document.getElementById('modalSetor');
    if (e.target === modal) fecharModalSetor();
});

/**
 * Confirma a adição de um novo setor com o nome fornecido.
 */
function confirmarAddSetor() {
    const setorName = document.getElementById("inputSetorNome").value.trim();
    if (!setorName) return alert("Por favor, insira um nome para o setor.");

    setores.push({ nome: setorName, maquinas: [] });
    setoresVisiveis.push(false); // Define o setor como não visível por padrão
    saveSetoresAndMachines();
    renderSetores();
    fecharModalSetor();
    document.getElementById("inputSetorNome").value = ""; // Limpa o campo de entrada
}

/**
 * Edita o nome de um setor existente.
 * @param {number} i - O índice do setor a ser editado.
 */
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

/**
 * Remove um setor e todas as suas máquinas.
 * @param {number} i - O índice do setor a ser removido.
 */
function removeSetor(i) {
    if (confirm("Excluir este setor?")) {
        setores.splice(i, 1);
        setoresVisiveis.splice(i, 1);
        saveSetoresAndMachines();
        renderSetores();
    }
}

/**
 * Exclui todos os setores e zera o armazenamento local.
 */
function excluirTodosSetores() {
    if (confirm("Tem certeza que deseja excluir TODOS os setores? Esta ação não pode ser desfeita.")) {
        setores = [];
        setoresVisiveis = [];
        localStorage.removeItem('setores');
        renderSetores();
        alert("Todos os setores foram excluídos.");
    }
}
// ====================================================================
// END: Sector Management (Modal and Actions)
// ====================================================================

// ---

// ====================================================================
// START: Machine Management (Modal and Actions)
// Descrição: Funções para adicionar e remover máquinas, e gerenciar seus modais.
// ====================================================================

/**
 * Abre o modal para adicionar uma nova máquina a um setor específico.
 * @param {number} i - O índice do setor ao qual a máquina será adicionada.
 */
function abrirModalMaquina(i) {
    setorSelecionado = i;
    document.getElementById("modalMaquina").style.display = "flex";
    resetModalMaquina(); // Reseta os campos do formulário ao abrir o modal
}

/**
 * Fecha o modal de adição de máquina.
 */
function fecharModalMaquina() {
    document.getElementById("modalMaquina").style.display = "none";
    setorSelecionado = null;
}

// Fecha o modal de máquina ao clicar fora dele.
window.addEventListener('click', e => {
    const modal = document.getElementById('modalMaquina');
    if (e.target === modal) fecharModalMaquina();
});

/**
 * Reseta os campos do formulário no modal de adição de máquina.
 */
function resetModalMaquina() {
    document.getElementById("tipoEquipamento").value = "";
    document.getElementById("tipoMaquina").value = "";
    document.getElementById("nomeMaquina").value = "";
    document.getElementById("etiquetaMaquina").value = "";
    document.getElementById("etiquetaMonitor").value = "";
    document.getElementById("usuarioResponsavel").value = "";
    document.getElementById("nomeImpressora").value = "";
    document.getElementById("etiquetaImpressora").value = "";
    trocarCampos(); // Esconde todos os campos específicos
}

/**
 * Troca a visibilidade dos campos no modal de adição de máquina com base no tipo de equipamento selecionado.
 */
function trocarCampos() {
    const tipo = document.getElementById("tipoEquipamento").value.toLowerCase();
    document.getElementById("camposMaquina").style.display = tipo === "máquina" ? "block" : "none";
    document.getElementById("camposMonitor").style.display = tipo === "monitor" ? "block" : "none";
    document.getElementById("camposPrinter").style.display = tipo === "printer" ? "block" : "none";
}

/**
 * Confirma a adição de uma nova máquina ao setor selecionado.
 */
function confirmarAddMaquina() {
    const tipo = document.getElementById("tipoEquipamento").value.toLowerCase();
    const idUnico = `maquina_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    let novaMaquina = null;

    if (tipo === 'máquina') {
        const nomeUsuario = document.getElementById("usuarioResponsavel").value.trim();
        const tipoMaquina = document.getElementById("tipoMaquina").value.trim();
        const nomeMaquina = document.getElementById("nomeMaquina").value.trim();
        const etiquetaMaquina = document.getElementById("etiquetaMaquina").value.trim();

        if (!tipoMaquina || !nomeMaquina || !etiquetaMaquina) return alert("Preencha todos os campos da máquina.");

        novaMaquina = {
            usuarioResponsavel: nomeUsuario,
            id: idUnico,
            nome: nomeMaquina,
            tipo: tipoMaquina,
            etiqueta: etiquetaMaquina,
            chamado: [],
            emManutencao: false,
            tempoManutencao: 0
        };
    } else if (tipo === 'printer') {
        const nomeImpressora = document.getElementById("nomeImpressora").value?.trim();
        const etiquetaImpressora = document.getElementById("etiquetaImpressora").value?.trim();

        if (!nomeImpressora || !etiquetaImpressora) return alert("Preencha todos os campos da impressora.");

        novaMaquina = {
            id: idUnico,
            nome: nomeImpressora,
            tipo: 'Impressora',
            etiqueta: etiquetaImpressora,
            chamado: [],
            emManutencao: false,
            tempoManutencao: 0
        };
    } else if (tipo === 'monitor') {
        const etiquetaMonitor = document.getElementById("etiquetaMonitor").value.trim();
        const nomeUsuario = document.getElementById("usuarioResponsavel").value.trim(); // Assumindo que o monitor também pode ter um usuário
        if (!etiquetaMonitor) return alert("Preencha a etiqueta do monitor.");

        novaMaquina = {
            id: idUnico,
            usuarioResponsavel: nomeUsuario,
            nome: `Monitor - ${etiquetaMonitor}`,
            tipo: 'Monitor',
            etiqueta: etiquetaMonitor,
            chamado: [],
            emManutencao: false,
            tempoManutencao: 0
        };
    } else {
        return alert("Selecione um tipo de equipamento.");
    }

    setores[setorSelecionado].maquinas.push(novaMaquina);
    saveSetoresAndMachines();
    renderSetores();
    fecharModalMaquina();
}

/**
 * Remove uma máquina de um setor específico.
 * @param {number} setorI - O índice do setor.
 * @param {number} maquinaI - O índice da máquina dentro do setor.
 */
function removeMaquina(setorI, maquinaI) {
    if (confirm("Excluir esta máquina?")) {
        setores[setorI].maquinas.splice(maquinaI, 1);
        saveSetoresAndMachines();
        renderSetores();
    }
}
// ====================================================================
// END: Machine Management (Modal and Actions)
// ====================================================================

// ---

// ====================================================================
// START: Rendering and Display
// Descrição: Funções responsáveis por renderizar a interface e controlar a visibilidade dos elementos.
// ====================================================================

/**
 * Renderiza todos os setores e suas máquinas no contêiner principal.
 * Aplica filtros de busca e paginação conforme necessário.
 * @param {string} [termoBusca=null] - O termo de busca para filtrar setores e máquinas.
 */
function renderSetores(termoBusca = null) {
    const container = document.getElementById('setoresContainer');
    container.innerHTML = '';

    let indicesParaMostrar = setoresFiltradosIndices ?? setores.map((_, i) => i);

    if (indicesParaMostrar.length === 0) {
        container.innerHTML = '<p style="font-style: italic; color: #666;">Nenhum setor ou máquina encontrado.</p>';
        document.getElementById('setoresPaginacao')?.remove(); // Remove paginação se não houver setores
        return;
    }

    const totalSetoresFiltrados = indicesParaMostrar.length;
    const totalPaginasSetores = Math.ceil(totalSetoresFiltrados / setoresPorPagina);

    // Ajusta a página atual se ela for maior que o total de páginas ou se o total de páginas for zero
    if (paginaSetoresAtual > totalPaginasSetores && totalPaginasSetores > 0) {
        paginaSetoresAtual = totalPaginasSetores;
    } else if (totalPaginasSetores === 0) {
        paginaSetoresAtual = 1;
    }

    const inicio = (paginaSetoresAtual - 1) * setoresPorPagina;
    const fim = inicio + setoresPorPagina;
    const indicesPaginados = indicesParaMostrar.slice(inicio, fim);

    indicesPaginados.forEach(i => {
        const setor = setores[i];
        const div = document.createElement('div');
        div.classList.add('setor');

        // Determina se o termo de busca corresponde diretamente ao nome do setor
        const setorCorrespondeDiretamente = setor.nome.toLowerCase().includes(termoBusca || '');

        let maquinasParaRenderizar = setor.maquinas;
        if (termoBusca && !setorCorrespondeDiretamente) {
            // Se o termo de busca existir e não corresponder ao setor, filtra as máquinas dentro dele
            maquinasParaRenderizar = setor.maquinas.filter(m =>
                m.nome.toLowerCase().includes(termoBusca) ||
                m.tipo.toLowerCase().includes(termoBusca) ||
                (m.etiqueta && m.etiqueta.toLowerCase().includes(termoBusca)) ||
                (m.usuarioResponsavel && m.usuarioResponsavel.toLowerCase().includes(termoBusca))
            );
        }

        // Se houver termo de busca, e nem o setor nem as máquinas corresponderem, não renderiza este setor
        if (termoBusca && maquinasParaRenderizar.length === 0 && !setorCorrespondeDiretamente) {
             return; // Pula para o próximo setor
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
                        ondragstart="dragStart(event, ${i}, ${setor.maquinas.indexOf(m)})"
                        style="background-color: ${m.emManutencao ? '#ff6b6b' : 'transparent'}; margin:5px; padding:5px; border:1px solid #ccc; border-radius:10px; cursor: grab;">
                        <strong>${m.nome}</strong> (${m.tipo}) - ${m.emManutencao ? 'Em Manutenção' : 'Operando'}
                        <button onclick="showInfo(${i}, ${setor.maquinas.indexOf(m)})" title="Informações">Info</button>
                        <button onclick="removeMaquina(${i}, ${setor.maquinas.indexOf(m)})" title="Excluir máquina">Excluir</button>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(div);
    });

    renderizarPaginacaoSetores(totalPaginasSetores);
}

/**
 * Alterna a visibilidade das máquinas em um setor específico.
 * @param {number} i - O índice do setor.
 */
function toggleMachines(i) {
    setoresVisiveis[i] = !setoresVisiveis[i];
    renderSetores();
}

/**
 * Renderiza os botões de paginação para os setores.
 * @param {number} totalPaginas - O número total de páginas de setores.
 */
function renderizarPaginacaoSetores(totalPaginas) {
    let paginacaoDiv = document.getElementById('setoresPaginacao');
    if (!paginacaoDiv) {
        paginacaoDiv = document.createElement('div');
        paginacaoDiv.id = 'setoresPaginacao';
        paginacaoDiv.className = 'setores-paginacao';
        document.getElementById('setoresContainer').insertAdjacentElement('afterend', paginacaoDiv);
    }
    paginacaoDiv.innerHTML = '';

    if (totalPaginas <= 1) return;

    if (paginaSetoresAtual > 1) {
        const btnAnterior = document.createElement('button');
        btnAnterior.textContent = '⬅ Anterior';
        btnAnterior.onclick = () => {
            paginaSetoresAtual--;
            renderSetores(document.getElementById('searchInput').value.toLowerCase().trim());
        };
        paginacaoDiv.appendChild(btnAnterior);
    }

    for (let i = 1; i <= totalPaginas; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = 'paginacao-btn' + (i === paginaSetoresAtual ? ' ativo' : '');
        btn.onclick = () => {
            paginaSetoresAtual = i;
            renderSetores(document.getElementById('searchInput').value.toLowerCase().trim());
        };
        paginacaoDiv.appendChild(btn);
    }

    if (paginaSetoresAtual < totalPaginas) {
        const btnProximo = document.createElement('button');
        btnProximo.textContent = 'Próximo ➡';
        btnProximo.onclick = () => {
            paginaSetoresAtual++;
            renderSetores(document.getElementById('searchInput').value.toLowerCase().trim());
        };
        paginacaoDiv.appendChild(btnProximo);
    }
}

/**
 * Alterna o layout de exibição dos setores entre lista e grade.
 */
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
// ====================================================================
// END: Rendering and Display
// ====================================================================

// ---

// ====================================================================
// START: Data Storage (Local Storage)
// Descrição: Funções para salvar e carregar dados do armazenamento local.
// ====================================================================

/**
 * Salva o array de setores e máquinas no localStorage.
 */
function saveSetoresAndMachines() {
    localStorage.setItem('setores', JSON.stringify(setores));
}

/**
 * Carrega o array de setores e máquinas do localStorage.
 * Inicializa `setoresVisiveis` e renderiza a interface.
 */
function loadSetoresAndMachines() {
    setores = JSON.parse(localStorage.getItem('setores')) || [];
    setoresVisiveis = new Array(setores.length).fill(false); // Garante que a visibilidade seja resetada ou inicializada
    renderSetores();
}

// Event listener para carregar os dados ao carregar a página.
document.addEventListener('DOMContentLoaded', () => {
    loadSetoresAndMachines();
});

// Define o layout padrão na carga da página.
window.onload = () => {
    // Carrega os setores salvos (se tiver isso em algum lugar)
    setores = JSON.parse(localStorage.getItem("setores")) || [];
    renderSetores();

    // layout padrão
    const container = document.getElementById('setoresContainer');
    const toggle = document.getElementById('layoutToggle');
    container.classList.add('grid-view');
    container.classList.remove('list-view');
    toggle.checked = false; // Garante que o toggle esteja desmarcado para o layout de grade
};
// ====================================================================
// END: Data Storage (Local Storage)
// ====================================================================

// ---

// ====================================================================
// START: Machine Information and Calls (Modal and Actions)
// Descrição: Funções para exibir informações detalhadas da máquina, gerenciar chamados e status de manutenção.
// ====================================================================

/**
 * Exibe um modal com informações detalhadas de uma máquina e suas opções de chamado.
 * @param {number} setorIndex - O índice do setor da máquina.
 * @param {number} maquinaIndex - O índice da máquina dentro do setor.
 */
function showInfo(setorIndex, maquinaIndex) {
    maquinaAtivaSetor = setorIndex;
    maquinaAtivaIndex = maquinaIndex;
    currentMachineId = setores[setorIndex].maquinas[maquinaIndex].id; // Atualiza o ID da máquina ativa

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

    paginarChamados(maquina); // Renderiza os chamados com paginação

    document.getElementById('maintenanceMessage').style.display = maquina.emManutencao ? 'block' : 'none';
    document.getElementById('maintenanceBtn').style.display = maquina.emManutencao ? 'none' : 'inline-block';
    document.getElementById('releaseBtn').style.display = maquina.emManutencao ? 'inline-block' : 'none';
}

/**
 * Fecha o modal de informações da máquina.
 */
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
    maquinaAtivaSetor = null;
    maquinaAtivaIndex = null;
    clearForm(); // Limpa o formulário de chamado
}

// Fecha o modal de informações ao clicar fora dele.
window.addEventListener('click', e => {
    const modal = document.getElementById('infoModal');
    if (e.target === modal) closeModal();
});

/**
 * Salva uma nova observação/chamado para a máquina ativa.
 */
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
    paginarChamados(setores[maquinaAtivaSetor].maquinas[maquinaAtivaIndex]); // Atualiza a lista de chamados
    clearForm();
    alert('Chamado salvo com sucesso!');
}

/**
 * Limpa o formulário de adição de chamado.
 */
function clearForm() {
    document.getElementById('observacao').value = '';
    document.querySelectorAll('#maintenanceSection input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('priority').value = 'Baixa';
}

/**
 * Marca a máquina ativa para manutenção.
 */
function markForMaintenance() {
    if (maquinaAtivaSetor === null || maquinaAtivaIndex === null) {
        alert('Nenhuma máquina selecionada para manutenção.');
        return;
    }
    const maquina = setores[maquinaAtivaSetor].maquinas[maquinaAtivaIndex];
    maquina.emManutencao = true;
    maquina.tempoManutencao = Date.now(); // Registra o tempo de início da manutenção
    saveSetoresAndMachines();
    renderSetores(); // Atualiza a renderização para mostrar o status de manutenção
    document.getElementById('maintenanceMessage').style.display = 'block';
    document.getElementById('maintenanceBtn').style.display = 'none';
    document.getElementById('releaseBtn').style.display = 'inline-block';
}

/**
 * Libera a máquina ativa da manutenção.
 */
function releaseMachine() {
    if (maquinaAtivaSetor === null || maquinaAtivaIndex === null) {
        alert('Nenhuma máquina selecionada para liberar.');
        return;
    }
    const maquina = setores[maquinaAtivaSetor].maquinas[maquinaAtivaIndex];
    maquina.emManutencao = false;
    maquina.tempoManutencao = 0; // Reseta o tempo de manutenção
    saveSetoresAndMachines();
    renderSetores(); // Atualiza a renderização para mostrar o status de operação
    document.getElementById('maintenanceMessage').style.display = 'none';
    document.getElementById('maintenanceBtn').style.display = 'inline-block';
    document.getElementById('releaseBtn').style.display = 'none';
}

/**
 * Renderiza os chamados de uma máquina com paginação.
 * @param {object} maquina - O objeto da máquina contendo os chamados.
 */
function paginarChamados(maquina) {
    const ul = document.getElementById('observationsUl');
    ul.innerHTML = '';

    const chamados = maquina.chamado || [];
    const chamadosPorPagina = 5;
    let paginaAtualChamados = 1; // Variável local para a paginação de chamados

    if (chamados.length === 0) {
        ul.innerHTML = '<li style="font-style: italic; color: #666;">Nenhum chamado registrado.</li>';
        document.getElementById('paginationChamados')?.remove();
        return;
    }

    function renderPaginaChamados(pagina) {
        ul.innerHTML = '';
        const inicio = (pagina - 1) * chamadosPorPagina;
        const fim = inicio + chamadosPorPagina;
        chamados.slice(inicio, fim).forEach(chamado => {
            const li = document.createElement('li');
            li.className = 'chamado-item';

            const dataSpan = document.createElement('span');
            dataSpan.className = 'chamado-data';
            dataSpan.textContent = new Date(chamado.data).toLocaleString();

            const prioridadeSpan = document.createElement('span');
            prioridadeSpan.className = `chamado-prioridade prioridade-${chamado.prioridade.toLowerCase()}`;
            prioridadeSpan.textContent = chamado.prioridade;

            const descPre = document.createElement('pre');
            descPre.className = 'chamado-descricao';
            descPre.textContent = chamado.descricao || chamado.observacao || '';

            li.append(dataSpan, prioridadeSpan, descPre);
            ul.appendChild(li);
        });

        // Remove a paginação anterior se existir
        document.getElementById('paginationChamados')?.remove();
        const totalPaginas = Math.ceil(chamados.length / chamadosPorPagina);
        if (totalPaginas <= 1) return;

        const paginacaoDiv = document.createElement('div');
        paginacaoDiv.id = 'paginationChamados';
        paginacaoDiv.className = 'chamado-paginacao';

        for (let i = 1; i <= totalPaginas; i++) {
            const btn = document.createElement('button');
            btn.className = 'paginacao-btn' + (i === pagina ? ' ativo' : '');
            btn.textContent = i;
            btn.onclick = () => renderPaginaChamados(i);
            paginacaoDiv.appendChild(btn);
        }

        ul.parentElement.appendChild(paginacaoDiv);
    }

    renderPaginaChamados(paginaAtualChamados);
}
// ====================================================================
// END: Machine Information and Calls (Modal and Actions)
// ====================================================================

// ---

// ====================================================================
// START: Search and Filter
// Descrição: Funções para filtrar setores e máquinas com debounce.
// ====================================================================

/**
 * Filtra as máquinas e setores com um atraso (debounce) para otimizar o desempenho.
 */
function filterMachines() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const termo = document.getElementById('searchInput').value.toLowerCase().trim();

        // Se não houver termo de busca, remove qualquer filtro existente e renderiza tudo.
        if (!termo) {
            setoresFiltradosIndices = null; // Zera o filtro de setores
            paginaSetoresAtual = 1; // Volta para a primeira página
            renderSetores(); // Renderiza sem termo de busca
            return;
        }

        // Se houver termo, encontra os setores que contêm o termo (no nome do setor ou em alguma máquina)
        setoresFiltradosIndices = setores.reduce((acc, setor, i) => {
            const setorMatch = setor.nome.toLowerCase().includes(termo);
            const maquinasMatch = setor.maquinas.some(m => {
                return (
                    m.nome.toLowerCase().includes(termo) ||
                    m.tipo.toLowerCase().includes(termo) ||
                    (m.etiqueta && m.etiqueta.toLowerCase().includes(termo)) ||
                    (m.usuarioResponsavel && m.usuarioResponsavel.toLowerCase().includes(termo)) // Adicionado busca por usuário
                );
            });

            if (setorMatch || maquinasMatch) {
                acc.push(i);
            }
            return acc;
        }, []);

        paginaSetoresAtual = 1; // Sempre volta para a primeira página ao aplicar um novo filtro
        renderSetores(termo); // Renderiza passando o termo de busca
    }, 250);
}
// ====================================================================
// END: Search and Filter
// ====================================================================

// ---

// ====================================================================
// START: Drag and Drop Functionality
// Descrição: Funções para arrastar e soltar máquinas entre setores.
// ====================================================================

/**
 * Inicia o processo de arrastar uma máquina.
 * @param {Event} event - O evento de dragstart.
 * @param {number} setorIndex - O índice do setor de origem da máquina.
 * @param {number} maquinaIndex - O índice da máquina dentro do setor de origem.
 */
function dragStart(event, setorIndex, maquinaIndex) {
    maquinaEmMovimento = { setorIndex, maquinaIndex };
    // Define os dados a serem transferidos (ID da máquina, por exemplo)
    event.dataTransfer.setData('text/plain', JSON.stringify({ maquinaId: setores[setorIndex].maquinas[maquinaIndex].id }));
}

/**
 * Manipula o evento de soltar uma máquina em um novo setor.
 * @param {Event} event - O evento de drop.
 * @param {number} novoSetorIndex - O índice do setor de destino.
 */
function dropMachine(event, novoSetorIndex) {
    event.preventDefault(); // Previne o comportamento padrão do navegador
    if (!maquinaEmMovimento) return;

    const { setorIndex, maquinaIndex } = maquinaEmMovimento;
    // Evita a transferência para o mesmo setor
    if (setorIndex === novoSetorIndex) return;

    // Recupera a máquina real, pois os índices podem mudar com a renderização
    const maquina = setores[setorIndex].maquinas[maquinaIndex];
    if (!maquina) return; // Garante que a máquina ainda existe

    setores[setorIndex].maquinas.splice(maquinaIndex, 1); // Remove do setor de origem
    setores[novoSetorIndex].maquinas.push(maquina); // Adiciona ao setor de destino

    saveSetoresAndMachines();
    renderSetores(); // Re-renderiza a interface para refletir a mudança

    maquinaEmMovimento = null; // Limpa a referência da máquina em movimento
}
// ====================================================================
// END: Drag and Drop Functionality
// ====================================================================

// ---

// ====================================================================
// START: User Responsibility Editing (Modal)
// Descrição: Funções para abrir, fechar e salvar alterações no nome do usuário responsável por uma máquina.
// ====================================================================

/**
 * Abre o modal para editar o nome do usuário responsável por uma máquina.
 * @param {string} idMaquina - O ID único da máquina a ser editada.
 */
function abrirModalEditarUsuario(idMaquina) {
    maquinaEditandoId = idMaquina;

    // Procura a máquina em todos os setores
    const maquina = setores.flatMap(s => s.maquinas).find(m => m.id === idMaquina);
    if (!maquina) return alert("Máquina não encontrada.");

    document.getElementById("novoNomeUsuario").value = maquina.usuarioResponsavel || '';
    document.getElementById("modalEditarUsuario").style.display = "flex";
    document.getElementById("modalEditarUsuario").style.zIndex = '1001'; // Garante que o modal esteja acima de outros
}

/**
 * Fecha o modal de edição de usuário.
 */
function fecharModalEditarUsuario() {
    document.getElementById("modalEditarUsuario").style.display = "none";
    maquinaEditandoId = null;
}

/**
 * Salva o novo nome do usuário responsável para a máquina selecionada.
 */
function salvarNovoNomeUsuario() {
    const novoNome = document.getElementById("novoNomeUsuario").value;

    // Percorre os setores para encontrar e atualizar a máquina
    for (let setor of setores) {
        const maquina = setor.maquinas.find(m => m.id === maquinaEditandoId);
        if (maquina) {
            maquina.usuarioResponsavel = novoNome.trim();
            // Atualiza o display no modal de informações se estiver aberto
            const usuarioSpan = document.getElementById("usuarioInfo");
            if (usuarioSpan) {
                usuarioSpan.textContent = maquina.usuarioResponsavel || '';
            }
            break; // Sai do loop após encontrar e atualizar a máquina
        }
    }

    saveSetoresAndMachines();
    renderSetores(); // Re-renderiza para refletir a mudança na interface principal
    fecharModalEditarUsuario();
}

// Injeta o HTML do modal de edição de usuário no corpo do documento
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
// ====================================================================
// END: User Responsibility Editing (Modal)
// ====================================================================

// ---

// ====================================================================
// START: Machine Transfer (Modal and Functionality)
// Descrição: Funções para transferir máquinas entre setores com uma interface de modal e paginação.
// ====================================================================



/**
 * Abre o modal de transferência de máquinas.
 */
function abrirModalTransferencia() {
    const modal = document.getElementById('modalTransferencia');
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-transferencia-content">
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
            <button class="btn-confirmar" onclick="confirmarTransferencia()">✅ Confirmar Transferência</button>
        </div>
    `;

    // Resetar campos e estados
    document.getElementById('buscaSetorOrigem').value = '';
    document.getElementById('buscaSetorDestino').value = '';
    setorSelecionadoOrigem = null;
    setorSelecionadoDestino = null;
    maquinaSelecionada = null;
    paginaAtualOrigem = 1;

    renderizarSetoresOrigem(); // Renderiza a lista inicial de setores de origem
}

/**
 * Renderiza a lista de setores na caixa de origem do modal de transferência.
 * Inclui paginação.
 */
function renderizarSetoresOrigem() {
    const listaOrigem = document.getElementById('listaOrigem');
    listaOrigem.innerHTML = '';

    // A paginação deve ser baseada nos setores *globais*, não nos filtrados diretamente aqui.
    // Se a busca afetar `setores`, precisaremos de uma cópia ou outro mecanismo.
    // Por enquanto, assumimos que `setores` é a lista completa para paginação.
    const setoresDisponiveis = setores.filter(s => true); // Cópia para não modificar o array original

    const inicio = (paginaAtualOrigem - 1) * setoresPorPagina;
    const fim = inicio + setoresPorPagina;
    const setoresPagina = setoresDisponiveis.slice(inicio, fim);

    setoresPagina.forEach(setor => {
        const div = document.createElement('div');
        div.className = 'setor-item';
        div.textContent = setor.nome;
        div.onclick = () => mostrarMaquinasDoSetor(setor); // Ao clicar no setor, mostra suas máquinas
        listaOrigem.appendChild(div);
    });

    renderizarPaginacaoOrigem(setoresDisponiveis.length); // Passa o total de setores para a paginação
}

/**
 * Renderiza os botões de paginação para os setores na caixa de origem.
 * @param {number} totalItens - O número total de setores para a paginação.
 */
function renderizarPaginacaoOrigem(totalItens) {
    const paginacao = document.getElementById('paginacaoOrigem');
    paginacao.innerHTML = '';
    const totalPaginas = Math.ceil(totalItens / setoresPorPagina);

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

/**
 * Exibe as máquinas de um setor selecionado na caixa de origem.
 * @param {object} setor - O objeto do setor cujas máquinas serão exibidas.
 */
function mostrarMaquinasDoSetor(setor) {
    setorSelecionadoOrigem = setor; // Define o setor de origem

    const listaOrigem = document.getElementById('listaOrigem');
    const paginacao = document.getElementById('paginacaoOrigem');
    listaOrigem.innerHTML = ''; // Limpa a lista de setores
    paginacao.innerHTML = '';   // Limpa a paginação

    const btnVoltar = document.createElement('button');
    btnVoltar.textContent = '⬅️ Voltar aos Setores';
    btnVoltar.className = 'btn-voltar';
    btnVoltar.onclick = () => {
        setorSelecionadoOrigem = null; // Reseta o setor de origem
        renderizarSetoresOrigem(); // Volta a renderizar a lista de setores
    };
    listaOrigem.appendChild(btnVoltar);

    const titulo = document.createElement('h4');
    titulo.textContent = `💻 Máquinas de ${setor.nome}`;
    listaOrigem.appendChild(titulo);

    // Renderiza as máquinas do setor selecionado
    setor.maquinas.forEach(maquina => {
        const div = document.createElement('div');
        div.className = 'maquina-item';
        div.draggable = true; // Permite que a máquina seja arrastável
        div.textContent = maquina.etiqueta || maquina.nome || 'Sem nome';
        div.ondragstart = e => {
            // Define o ID da máquina a ser transferido no evento dragstart
            e.dataTransfer.setData('text/plain', JSON.stringify({ maquinaId: maquina.id }));
        };
        div.onclick = () => selecionarMaquina(maquina, div); // Permite selecionar a máquina clicando
        listaOrigem.appendChild(div);
    });
}

/**
 * Fecha o modal de transferência de máquinas.
 */
function fecharModalTransferencia() {
    document.getElementById('modalTransferencia').style.display = 'none';
}

/**
 * Limpa o conteúdo da caixa de lista de origem.
 */
function limparCampoOrigem() {
    const box = document.getElementById('listaOrigem');
    if (box) box.innerHTML = '';
}

/**
 * Limpa o conteúdo da caixa de lista de destino.
 */
function limparCampoDestino() {
    const box = document.getElementById('listaDestino');
    if (box) box.innerHTML = '';
}

/**
 * Busca setores para a caixa de origem no modal de transferência.
 * Filtra a lista de setores exibida.
 */
function buscarSetorOrigem() {
    const termo = document.getElementById('buscaSetorOrigem').value.toLowerCase();
    // Filtra os setores baseados no termo de busca para renderização imediata
    const setoresFiltrados = setores.filter(s => s.nome.toLowerCase().includes(termo));
    // Precisa de um mecanismo para exibir APENAS os filtrados ou usar uma cópia para paginação
    // O código atual sobrescreve 'setores' globalmente, o que não é ideal para paginação.
    // Para um filtro temporário sem alterar a paginação global, seria necessário
    // uma nova variável ou modificação na `renderizarSetoresOrigem` para aceitar um array filtrado.
    // Por simplicidade atual, renderiza novamente os setores, o que pode afetar a paginação se `setores` for modificado.
    paginaAtualOrigem = 1; // Reseta a página ao buscar
    // A função renderizarSetoresOrigem precisaria aceitar um array filtrado
    // Por enquanto, ela usa a variável global 'setores'.
    // Se a busca for para filtrar a lista de *setores para seleção*, o `renderizarSetoresOrigem` precisa ser adaptado.
    renderizarSetoresOrigem(); // Chamar sem argumentos para que ele use a lista global ou adaptada
}

/**
 * Busca e seleciona um setor de destino no modal de transferência.
 */
function buscarSetorDestino() {
    const termo = document.getElementById('buscaSetorDestino').value.toLowerCase();
    // Encontra o setor de destino, garantindo que não seja o mesmo que o de origem
    const setor = setores.find(s =>
        s.nome.toLowerCase().includes(termo) &&
        s.nome !== setorSelecionadoOrigem?.nome
    );

    limparCampoDestino(); // Limpa o display anterior

    if (!setor) return; // Se nenhum setor for encontrado, não faz nada

    setorSelecionadoDestino = setor; // Define o setor de destino
    document.getElementById('listaDestino').innerHTML = `
        <p>📦 Setor selecionado: <strong>${setor.nome}</strong></p>
    `;
}

/**
 * Seleciona uma máquina para transferência.
 * @param {object} maquina - O objeto da máquina selecionada.
 * @param {HTMLElement} div - O elemento DIV HTML da máquina.
 */
function selecionarMaquina(maquina, div) {
    maquinaSelecionada = maquina;

    // Remove a classe 'selecionada' de todas as máquinas e adiciona à máquina clicada
    document.querySelectorAll('#listaOrigem .maquina-item').forEach(el =>
        el.classList.remove('selecionada')
    );
    div.classList.add('selecionada');

    // Reseta o campo de busca de destino e o display da lista de destino
    limparCampoDestino();
    document.getElementById('buscaSetorDestino').value = '';
}

/**
 * Manipula o evento de soltar uma máquina na caixa de destino do modal de transferência.
 * (Alternativa ao `confirmarTransferencia` para drag & drop)
 * @param {Event} event - O evento de drop.
 */
function soltarMaquina(event) {
    event.preventDefault(); // Previne o comportamento padrão

    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    // Encontra a máquina e o setor de origem usando o ID
    const maquina = setorSelecionadoOrigem?.maquinas.find(m => m.id === data.maquinaId);

    // Validações antes da transferência
    if (!maquina || !setorSelecionadoDestino || setorSelecionadoDestino.nome === setorSelecionadoOrigem.nome) {
        alert('Não foi possível transferir. Verifique se a máquina e os setores foram selecionados corretamente.');
        return;
    }

    // Remove a máquina do setor de origem
    setorSelecionadoOrigem.maquinas = setorSelecionadoOrigem.maquinas.filter(m => m.id !== maquina.id);
    // Adiciona a máquina ao setor de destino
    setorSelecionadoDestino.maquinas.push(maquina);

    saveSetoresAndMachines(); // Salva as alterações
    renderSetores(); // Re-renderiza a interface principal
    fecharModalTransferencia(); // Fecha o modal de transferência
}

/**
 * Confirma a transferência da máquina selecionada para o setor de destino.
 */
function confirmarTransferencia() {
    // Validações antes da transferência
    if (!setorSelecionadoOrigem || !setorSelecionadoDestino || !maquinaSelecionada) {
        alert('⚠️ Selecione setor de origem, máquina e setor de destino.');
        return;
    }

    if (setorSelecionadoOrigem.nome === setorSelecionadoDestino.nome) {
        alert('⚠️ Setor de destino deve ser diferente do setor de origem.');
        return;
    }

    // Remove a máquina do setor de origem
    setorSelecionadoOrigem.maquinas = setorSelecionadoOrigem.maquinas.filter(m => m.id !== maquinaSelecionada.id);
    // Adiciona a máquina ao setor de destino
    setorSelecionadoDestino.maquinas.push(maquinaSelecionada);

    saveSetoresAndMachines(); // Salva as alterações
    renderSetores(); // Re-renderiza a interface principal
    fecharModalTransferencia(); // Fecha o modal de transferência
}
// ====================================================================
// END: Machine Transfer (Modal and Functionality)
// ====================================================================