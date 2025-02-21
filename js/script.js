let setores = [];
let currentSetorIndex, currentMaquinaIndex;
let timers = []; // Array para armazenar os temporizadores de cada máquina
let setoresVisiveis = []; // Array para armazenar o estado de visibilidade dos setores

// Função para alternar entre lista e grid
function toggleLayout() {
    const container = document.getElementById('setoresContainer');
    container.classList.toggle('list-view');
    container.classList.toggle('grid-view');
    container.style.transition = 'all 0.5s ease';
}

// Função para adicionar um setor
function addSetor() {
    const setorName = prompt("Digite o nome do setor:");
    if (setorName) {
        const setor = {
            nome: setorName,
            maquinas: []
        };
        setores.push(setor);
        setoresVisiveis.push(false); // Inicialmente os setores estarão fechados
        saveSetoresAndMachines();
        renderSetores();
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
        <h2>${setor.nome} 
            <button class="delete-btn" onclick="removeSetor(${index})">X</button>
        </h2>
        <button class="add-machine-btn" onclick="addMaquina(${index})">Adicionar Máquina</button>
        <button class="toggle-btn" onclick="toggleMachines(${index})">Mostrar Máquinas</button>
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
// Função para adicionar uma máquina ou monitor
function addMaquina(setorIndex) {
    const tipo = prompt("É uma máquina ou um monitor? (Digite 'máquina' ou 'monitor')").toLowerCase();
    
    if (tipo === 'máquina') {
        const maquinaTipo = prompt("Digite o tipo da máquina (Desktop, Notebook ou Workstation):");
        const maquinaName = prompt("Digite o número de série da máquina:");
        const etiqueta = prompt("Digite a etiqueta da máquina:");
        
        if (maquinaTipo && maquinaName && etiqueta) {
            setores[setorIndex].maquinas.push({
                nome: maquinaName,
                tipo: maquinaTipo,
                etiqueta: etiqueta,
                chamado: [],
                emManutencao: false,
                tempoManutencao: 0
            });
            saveSetoresAndMachines();
            renderSetores();
        } else {
            alert("Todos os campos são obrigatórios para adicionar uma máquina.");
        }
    } else if (tipo === 'monitor') {
        const etiquetaMonitor = prompt("Digite a etiqueta do monitor:");
        
        if (etiquetaMonitor) {
            setores[setorIndex].maquinas.push({
                nome: `Monitor - ${etiquetaMonitor}`,
                tipo: 'Monitor',
                etiqueta: etiquetaMonitor,
                chamado: [],
                emManutencao: false,
                tempoManutencao: 0
            });
            saveSetoresAndMachines();
            renderSetores();
        } else {
            alert("A etiqueta do monitor é obrigatória.");
        }
    } else {
        alert("Opção inválida. Digite 'máquina' ou 'monitor'.");
    }
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

// Função para mostrar informações da máquina
function showInfo(setorIndex, maquinaIndex) {
    const modal = document.getElementById('infoModal');
    const maquina = setores[setorIndex].maquinas[maquinaIndex];

    document.getElementById('modalText').textContent = `Máquina: ${maquina.nome} (${maquina.tipo})`;
    document.getElementById('observationsUl').innerHTML = maquina.chamado.map(chamado => `
        <li>${chamado.observacao} - Prioridade: ${chamado.prioridade}</li>
    `).join('');

    modal.style.display = 'flex';
    currentSetorIndex = setorIndex;
    currentMaquinaIndex = maquinaIndex;

    const maintenanceBtn = document.getElementById('maintenanceBtn');
    maintenanceBtn.textContent = maquina.emManutencao ? "Desmarcar para Manutenção" : "Marcar para Manutenção";

    document.getElementById('maintenanceMessage').style.display = maquina.emManutencao ? 'block' : 'none';
}

// Função para fechar o modal
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Função para salvar uma observação
function saveObservation() {
    const observacao = document.getElementById('observacao').value;
    const prioridade = document.getElementById('priority').value;

    if (observacao) {
        setores[currentSetorIndex].maquinas[currentMaquinaIndex].chamado.push({ observacao, prioridade });
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
        <button class="add-machine-btn" onclick="addMaquina(${index})">Adicionar Máquina</button>
        <button class="toggle-btn" onclick="toggleMachines(${index})">Mostrar Máquinas</button>
        <div id="maquinas-${index}" class="machines-list" style="display: ${setoresVisiveis[index] ? 'block' : 'none'};">
            ${setor.maquinas.map((maquina, maquinaIndex) => createMachineElement(maquina, maquinaIndex, index)).join('')}
        </div>
    `;
    return setorDiv;
}






//


function toggleMenu() {
    document.querySelector('.nav-links').classList.toggle('active');
}
function toggleUserMenu() {
    let menu = document.getElementById("userDropdown");
    menu.style.display = menu.style.display === "block" ? "none" : "block";
}






// Fechar menu ao clicar fora
document.addEventListener("click", function(event) {
    let menu = document.getElementById("userDropdown");
    let avatar = document.querySelector(".user-avatar");
    if (menu.style.display === "block" && !menu.contains(event.target) && !avatar.contains(event.target)) {
        menu.style.display = "none";
    }
});

function logout() {
    sessionStorage.removeItem("loggedUser");
    window.location.href = "index.html"; // Redireciona para a tela de login
}

// Exibir nome do usuário no menu
document.addEventListener("DOMContentLoaded", function() {
    let user = sessionStorage.getItem("loggedUser") || "Usuário";
    document.getElementById("userName").textContent = user;
});

// Alternar Menu de Usuário
function toggleUserMenu() {
    const dropdown = document.getElementById("userDropdown");
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
}

// Fechar menu ao clicar fora
document.addEventListener("click", function (event) {
    const userMenu = document.querySelector(".user-menu");
    const dropdown = document.getElementById("userDropdown");
    if (!userMenu.contains(event.target)) {
        dropdown.style.display = "none";
    }
});

// Abrir Modal de Configurações
function openConfigModal() {
    document.getElementById("configModal").style.display = "block";
}

// Fechar Modal de Configurações
function closeConfigModal() {
    document.getElementById("configModal").style.display = "none";
}

// Alterar Foto de Perfil
function changeProfilePicture(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById("profilePic").src = e.target.result;
            document.getElementById("userAvatar").src = e.target.result; // Atualiza no menu também
        };
        reader.readAsDataURL(file);
    }
}



let darkMode = localStorage.getItem("darkMode") === "enabled";

    // Função para alternar entre Dark Mode e Light Mode
    function toggleDarkMode() {
        darkMode = !darkMode;
        document.body.classList.toggle("dark-mode", darkMode);
        localStorage.setItem("darkMode", darkMode ? "enabled" : "disabled");
    }

    // Aplica o Dark Mode ao carregar a página se estiver ativado
    document.addEventListener("DOMContentLoaded", () => {
        if (darkMode) {
            document.body.classList.add("dark-mode");
            document.getElementById("darkModeToggle").checked = true;
        }

        // Adiciona evento ao botão de alternância dentro do modal
        document.getElementById("darkModeToggle").addEventListener("change", toggleDarkMode);
    });

    // Função para fechar o modal
    function closeConfigModal() {
        document.getElementById("configModal").style.display = "none";
    }


    // Função para alternar a visibilidade do menu de configurações
function toggleUserMenu() {
    const userDropdown = document.getElementById('userDropdown');
    userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
}

// Função para abrir o modal de configurações
function openConfigModal() {
    const modal = document.getElementById('configModal');
    modal.style.display = 'block';
    toggleUserMenu(); // Fecha o menu dropdown após abrir o modal
}

// Função para fechar o modal de configurações
function closeConfigModal() {
    const modal = document.getElementById('configModal');
    modal.style.display = 'none';
}

// Função para abrir o seletor de arquivos para importação
function importFromCSVButton() {
    document.getElementById('csvInput').click();
}

// Função para exportar setores e máquinas para CSV
function exportToCSV() {
    let csvContent = "Setor;Nome da Máquina;Tipo;Em Manutenção;Tempo de Manutenção;Observações;Prioridade\n";

    setores.forEach(setor => {
        setor.maquinas.forEach(maquina => {
            const observacoes = maquina.chamado.map(chamado => `"${chamado.observacao} - Prioridade: ${chamado.prioridade}"`).join(" | ") || "Nenhuma Observação";
            const row = `"${setor.nome}";"${maquina.nome}";"${maquina.tipo}";${maquina.emManutencao};${maquina.tempoManutencao};"${observacoes}"\n`;
            csvContent += row;
        });
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'setores_maquinas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Função para importar o CSV e adicionar setores e máquinas
function importFromCSV(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const content = e.target.result;
        const rows = content.split("\n");

        setores = [];
        setoresVisiveis = [];

        rows.forEach((row, index) => {
            if (index === 0 || !row.trim()) return;

            const cols = row.split(";");

            const setorNome = cols[0].replace(/"/g, '').trim();
            const maquinaNome = cols[1].replace(/"/g, '').trim();
            const maquinaTipo = cols[2].replace(/"/g, '').trim(); // Tipo da máquina
            const emManutencao = cols[3].trim() === 'true';
            const tempoManutencao = parseInt(cols[4].trim()) || 0;
            const observacoes = cols[5].replace(/"/g, '').trim();
            
            let setor = setores.find(s => s.nome === setorNome);
            if (!setor) {
                setor = { nome: setorNome, maquinas: [] };
                setores.push(setor);
                setoresVisiveis.push(false);
            }

            const maquina = {
                nome: maquinaNome,
                tipo: maquinaTipo,
                etiqueta: cols[1].trim(),
                chamado: observacoes ? [{ observacao: observacoes, prioridade: 'Normal' }] : [],
                emManutencao,
                tempoManutencao,
            };

            setor.maquinas.push(maquina);
        });

        saveSetoresAndMachines();
        renderSetores();
    };

    reader.readAsText(file);
}
