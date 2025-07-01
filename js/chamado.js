let paginaAtual = 1;
const chamadosPorPagina = 3;
let currentSetorIndex = null;
let currentMaquinaIndex = null;
let timers = [];

function showInfo(setorIndex, maquinaIndex) {
    const modal = document.getElementById('infoModal');
    const maquina = setores[setorIndex].maquinas[maquinaIndex];
    currentSetorIndex = setorIndex;
    currentMaquinaIndex = maquinaIndex;
    paginaAtual = 1;

    const modalText = document.getElementById('modalText');
    if (modalText) {
        modalText.innerHTML = `
            <strong>Tipo de Equipamento:</strong> ${maquina.tipo || 'N/A'}<br>
            ${maquina.tipo === 'máquina' ? `
                <strong>Tipo da Máquina:</strong> ${maquina.tipoMaquina || 'N/A'}<br>
                <strong>Número de Série:</strong> ${maquina.numeroSerie || 'N/A'}<br>
                <strong>Etiqueta:</strong> ${maquina.etiqueta || 'Sem etiqueta'}<br>` : ''}
            ${maquina.tipo === 'monitor' ? `
                <strong>Etiqueta do Monitor:</strong> ${maquina.etiqueta || 'Sem etiqueta'}<br>` : ''}
        `;
    }

    renderChamados(maquina);
    modal.style.display = 'flex';

    const maintenanceBtn = document.getElementById('maintenanceBtn');
    const msg = document.getElementById('maintenanceMessage');
    if (maintenanceBtn && msg) {
        maintenanceBtn.textContent = maquina.emManutencao ? "Desmarcar para Manutenção" : "Marcar para Manutenção";
        msg.style.display = maquina.emManutencao ? 'block' : 'none';
    }
}

function closeModal() {
    document.getElementById("infoModal").style.display = "none";
}

window.onclick = function (event) {
    const modal = document.getElementById("infoModal");
    if (event.target === modal) closeModal();
};

function renderChamados(maquina) {
    const lista = document.getElementById('observationsUl');
    const paginacao = document.getElementById('pagination');

    if (!maquina.chamado) maquina.chamado = [];

    const chamadosOrdenados = [...maquina.chamado].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    const totalPaginas = Math.ceil(chamadosOrdenados.length / chamadosPorPagina);

    const inicio = (paginaAtual - 1) * chamadosPorPagina;
    const chamadosVisiveis = chamadosOrdenados.slice(inicio, inicio + chamadosPorPagina);

    lista.innerHTML = chamadosVisiveis.map((c, i) => `
        <li>
            <strong>${c.dataHora}</strong><br>
            ${c.observacao} - Prioridade: ${c.prioridade}
            <button onclick="excluirChamado(${inicio + i})" class="delete-btn">🗑️</button>
        </li>
    `).join('');

    renderPaginacao(totalPaginas, maquina);
}

function renderPaginacao(totalPaginas, maquina) {
    const paginacao = document.getElementById('pagination');
    paginacao.innerHTML = '';

    if (totalPaginas <= 1) return;

    if (paginaAtual > 1) {
        const btnAnterior = criarBotaoPaginacao('Anterior', () => {
            paginaAtual--;
            renderChamados(maquina);
        });
        paginacao.appendChild(btnAnterior);
    }

    if (paginaAtual < totalPaginas) {
        const btnProximo = criarBotaoPaginacao('Próximo', () => {
            paginaAtual++;
            renderChamados(maquina);
        });
        paginacao.appendChild(btnProximo);
    }
}

function criarBotaoPaginacao(texto, callback) {
    const btn = document.createElement('button');
    btn.textContent = texto;
    btn.onclick = callback;
    return btn;
}

function excluirChamado(index) {
    const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
    const chamados = [...maquina.chamado].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    chamados.splice(index, 1);

    maquina.chamado = chamados;

    const totalPaginas = Math.ceil(chamados.length / chamadosPorPagina);
    paginaAtual = Math.min(paginaAtual, totalPaginas) || 1;

    saveSetoresAndMachines();
    renderChamados(maquina);
}

function saveObservation() {
    const observacao = document.getElementById('observacao').value.trim();
    const prioridade = document.getElementById('priority').value;

    if (!observacao) return alert("A observação não pode estar vazia.");

    const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
    if (!maquina.chamado) maquina.chamado = [];

    maquina.chamado.push({
        observacao,
        prioridade,
        dataHora: new Date().toLocaleString('pt-BR')
    });

    document.getElementById('observacao').value = '';
    saveSetoresAndMachines();
    renderSetores();
    showInfo(currentSetorIndex, currentMaquinaIndex);
}

function markForMaintenance() {
    const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
    const maquinaElement = document.getElementById(`maquina-${currentMaquinaIndex}`);

    maquina.emManutencao = !maquina.emManutencao;
    if (maquinaElement) maquinaElement.style.backgroundColor = maquina.emManutencao ? "red" : "";

    if (maquina.emManutencao) {
        maquina.tempoManutencao = 0;
        startMaintenanceTimer(currentSetorIndex, currentMaquinaIndex);
    } else {
        stopMaintenanceTimer(currentSetorIndex, currentMaquinaIndex);
    }

    saveSetoresAndMachines();
    showInfo(currentSetorIndex, currentMaquinaIndex);
}

function startMaintenanceTimer(setorIndex, maquinaIndex) {
    const maquina = setores[setorIndex].maquinas[maquinaIndex];
    clearInterval(timers[maquinaIndex]);

    timers[maquinaIndex] = setInterval(() => {
        if (maquina.emManutencao && maquina.tempoManutencao < 100) {
            maquina.tempoManutencao++;
            saveSetoresAndMachines();
            renderSetores();
        }
    }, 1000);
}

function stopMaintenanceTimer(setorIndex, maquinaIndex) {
    clearInterval(timers[maquinaIndex]);
    timers[maquinaIndex] = null;
}

function filterMachines() {
    const input = document.getElementById("searchInput").value.toUpperCase();
    const setoresContainer = document.getElementById('setoresContainer');
    setoresContainer.innerHTML = '';

    setores.forEach((setor, setorIndex) => {
        const setorMatches = setor.nome.toUpperCase().includes(input);
        const maquinasMatches = setor.maquinas.some(maquina =>
            (maquina.numeroSerie?.toUpperCase().includes(input)) ||
            (maquina.tipo?.toUpperCase().includes(input))
        );

        if (setorMatches || maquinasMatches) {
            const setorDiv = createSetorElement(setor, setorIndex);
            setoresContainer.appendChild(setorDiv);
        }
    });
}

function confirmarAddMaquina() {
    const tipoEquip = document.getElementById('tipoEquipamento').value;
    if (!tipoEquip) return alert("Selecione o tipo de equipamento!");

    const novaMaquina = {
        tipo: tipoEquip,
        chamado: [],
        emManutencao: false,
        tempoManutencao: 0
    };

    if (tipoEquip === 'máquina') {
        novaMaquina.tipoMaquina = document.getElementById('tipoMaquina').value;
        novaMaquina.numeroSerie = document.getElementById('nomeMaquina').value;
        novaMaquina.etiqueta = document.getElementById('etiquetaMaquina').value;
    } else if (tipoEquip === 'monitor') {
        novaMaquina.etiqueta = document.getElementById('etiquetaMonitor').value;
    }

    setores[currentSetorIndex].maquinas.push(novaMaquina);

    saveSetoresAndMachines();
    renderSetores();
    fecharModalMaquina();
    showInfo(currentSetorIndex, setores[currentSetorIndex].maquinas.length - 1);
}
function toggleChecklist(legendElement) {
  const fieldset = legendElement.parentElement;
  fieldset.classList.toggle('collapsed');
}


let html5QrcodeScanner;

async function abrirScanner() {
  document.getElementById('modalScanner').style.display = 'flex';

  if (html5QrcodeScanner) return;

  html5QrcodeScanner = new Html5Qrcode("reader");

  try {
    // Força câmera traseira com facingMode
    const config = {
      fps: 25,
      qrbox: { width: 150, height: 150 },
      aspectRatio: 1.3333
    };

    await html5QrcodeScanner.start(
      { facingMode: { exact: "environment" } },
      config,
      (decodedText) => {
        const tipo = document.getElementById('tipoEquipamento').value;
        const campo = tipo === 'monitor' ? 'etiquetaMonitor' : 'etiquetaMaquina';
        document.getElementById(campo).value = decodedText;
        fecharScanner();
      },
      (errorMessage) => {
        // Pode ignorar leitura falha
      }
    );

    // Tenta aplicar zoom (experimental)
    await tentarAplicarZoom();

  } catch (err) {
    alert("Erro ao iniciar scanner ou acessar a câmera traseira: " + err);
    fecharScanner();
  }
}

async function tentarAplicarZoom() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: "environment" } }
    });

    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    if (capabilities.zoom) {
      const idealZoom = Math.min(2, capabilities.zoom.max);
      await track.applyConstraints({
        advanced: [{ zoom: idealZoom }]
      });
      console.log("Zoom aplicado:", idealZoom);
    }

    // Fecha o stream extra criado só pro zoom
    stream.getTracks().forEach(t => t.stop());
  } catch (err) {
    console.warn("Zoom não suportado ou falhou:", err);
  }
}

function fecharScanner() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner.clear();
      html5QrcodeScanner = null;
      document.getElementById('modalScanner').style.display = 'none';
    }).catch(err => {
      alert("Erro ao parar scanner: " + err);
    });
  } else {
    document.getElementById('modalScanner').style.display = 'none';
  }
}
