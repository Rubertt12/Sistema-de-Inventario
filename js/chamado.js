// Novo sistema de chamados com edição, reinterações, exclusão, edição, busca e feedback visual + painel de manutenção recolhível

let paginaAtual = 1;
const chamadosPorPagina = 3;
let currentSetorIndex = null;
let currentMaquinaIndex = null;

function showInfo(setorIndex, maquinaIndex) {
  currentSetorIndex = setorIndex;
  currentMaquinaIndex = maquinaIndex;
  const maquina = setores[setorIndex].maquinas[maquinaIndex];

  fecharModalTodasManutencoes(); // ✅ Fecha o modal anterior
  bringModalToFront("infoModal"); // ✅ Traz o novo modal à frente

  const modal = document.getElementById("infoModal");
  modal.style.display = "flex";

  const modalText = document.getElementById("modalText");
  modalText.innerHTML = `
    <strong>Tipo de Equipamento:</strong> ${maquina.tipo || 'N/A'}<br>
    ${maquina.tipo === 'máquina' ? `<strong>Tipo da Máquina:</strong> ${maquina.tipoMaquina || 'N/A'}<br><strong>Número de Série:</strong> ${maquina.numeroSerie || 'N/A'}<br><strong>Etiqueta:</strong> ${maquina.etiqueta || 'Sem etiqueta'}<br>` : ''}
    ${maquina.tipo === 'monitor' ? `<strong>Etiqueta do Monitor:</strong> ${maquina.etiqueta || 'Sem etiqueta'}<br>` : ''}
  `;

  renderChamados(maquina);
  renderPainelManutencao();
}



function closeModal() {
  document.getElementById("infoModal").style.display = "none";
}

function renderChamados(maquina) {
  const lista = document.getElementById("observationsUl");
  const paginacao = document.getElementById("pagination");

  if (!maquina.chamados) maquina.chamados = [];

  const chamadosOrdenados = [...maquina.chamados].sort((a, b) => new Date(b.data) - new Date(a.data));
  const totalPaginas = Math.ceil(chamadosOrdenados.length / chamadosPorPagina);

  const inicio = (paginaAtual - 1) * chamadosPorPagina;
  const chamadosVisiveis = chamadosOrdenados.slice(inicio, inicio + chamadosPorPagina);

  lista.innerHTML = chamadosVisiveis.map((chamado, i) => `
    <li style="margin-bottom: 10px; border: 1px solid #ccc; padding: 10px; border-radius: 8px;">
      <strong>${chamado.data}</strong><br>
      <strong>Chamado:</strong> ${chamado.texto} - Prioridade: ${chamado.prioridade}
      ${(chamado.interacoes || []).map((i, idx) => `
        <div style="margin-top: 6px; border-left: 2px solid #aaa; padding-left: 10px;">
          <strong>Interação ${idx + 1}:</strong> ${i.texto}<br>
          <small>${i.data}</small>
        </div>
      `).join('')}
      <div style="margin-top: 8px;">
        <button onclick="abrirInteracao(${inicio + i})">➕ Interagir</button>
        <button onclick="editarChamado(${inicio + i})">✏️ Editar</button>
        <button onclick="excluirChamado(${inicio + i})">🗑️ Excluir</button>
        <div id="interacao-${inicio + i}" style="display:none; margin-top:6px;">
          <textarea id="textoInteracao-${inicio + i}" rows="3" style="width:100%;"></textarea>
          <button onclick="salvarInteracao(${inicio + i})">💾 Salvar Interação</button>
        </div>
      </div>
    </li>
  `).join('');

  renderPaginacao(totalPaginas, maquina);
}

function abrirInteracao(index) {
  document.getElementById(`interacao-${index}`).style.display = "block";
}

function salvarInteracao(index) {
  const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
  const chamadosOrdenados = [...maquina.chamados].sort((a, b) => new Date(b.data) - new Date(a.data));
  const chamado = chamadosOrdenados[index];
  const texto = document.getElementById(`textoInteracao-${index}`).value.trim();
  if (!texto) return alert("Digite a interação.");

  const dataAtual = new Date().toLocaleString('pt-BR');
  if (!chamado.interacoes) chamado.interacoes = [];
  chamado.interacoes.push({ texto, data: dataAtual });

  saveSetoresAndMachines();
  alert("Interação salva com sucesso!");
  renderChamados(maquina);
}

function editarChamado(index) {
  const novoTexto = prompt("Editar observação do chamado:");
  if (!novoTexto) return;

  const novaPrioridade = prompt("Editar prioridade (Alta, Média, Baixa):");
  if (!novaPrioridade || !["Alta", "Média", "Baixa"].includes(novaPrioridade)) {
    alert("Prioridade inválida.");
    return;
  }

  const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
  const chamadosOrdenados = [...maquina.chamados].sort((a, b) => new Date(b.data) - new Date(a.data));
  chamadosOrdenados[index].texto = novoTexto;
  chamadosOrdenados[index].prioridade = novaPrioridade;

  saveSetoresAndMachines();
  alert("Chamado editado com sucesso!");
  renderChamados(maquina);
}

function excluirChamado(index) {
  if (!confirm("Tem certeza que deseja excluir este chamado?")) return;

  const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
  const chamadosOrdenados = [...maquina.chamados].sort((a, b) => new Date(b.data) - new Date(a.data));
  chamadosOrdenados.splice(index, 1);
  maquina.chamados = chamadosOrdenados;

  saveSetoresAndMachines();
  alert("Chamado excluído com sucesso!");
  renderChamados(maquina);
}

function saveObservation() {
  const observacao = document.getElementById("observacao").value.trim();
  const prioridade = document.getElementById("priority").value;

  if (!observacao) return alert("A observação não pode estar vazia.");

  const maquina = setores[currentSetorIndex].maquinas[currentMaquinaIndex];
  if (!maquina.chamados) maquina.chamados = [];

  maquina.chamados.push({
    texto: observacao,
    prioridade,
    data: new Date().toLocaleString('pt-BR'),
    interacoes: []
  });

  document.getElementById("observacao").value = "";
  saveSetoresAndMachines();
  alert("Chamado registrado com sucesso!");
  renderChamados(maquina);
}

function renderPaginacao(totalPaginas, maquina) {
  const paginacao = document.getElementById("pagination");
  paginacao.innerHTML = "";
  if (totalPaginas <= 1) return;

  if (paginaAtual > 1) {
    const btnAnterior = document.createElement("button");
    btnAnterior.textContent = "Anterior";
    btnAnterior.onclick = () => {
      paginaAtual--;
      renderChamados(maquina);
    };
    paginacao.appendChild(btnAnterior);
  }

  if (paginaAtual < totalPaginas) {
    const btnProximo = document.createElement("button");
    btnProximo.textContent = "Próximo";
    btnProximo.onclick = () => {
      paginaAtual++;
      renderChamados(maquina);
    };
    paginacao.appendChild(btnProximo);
  }
}
let paginaAtualPainel = 1;
const manutencoesPorPaginaPainel = 5;

function togglePainelManutencao() {
  const painel = document.getElementById("painelManutencao");
  const icone = document.getElementById("painelToggleIcon");

  painel.classList.toggle("recolhido");
  const conteudo = painel.querySelector(".painel-conteudo");
  if (conteudo) {
    conteudo.style.display = painel.classList.contains("recolhido") ? "none" : "block";
  }

  icone.textContent = painel.classList.contains("recolhido") ? "▶" : "◀";
}

function renderPainelManutencao() {
  const painel = document.getElementById("painelManutencao");
  if (!painel) return;

  let maquinasEmManutencao = [];
  setores.forEach((setor, sIndex) => {
    setor.maquinas.forEach((m, mIndex) => {
      if (m.emManutencao) {
        maquinasEmManutencao.push({ ...m, setorNome: setor.nome, sIndex, mIndex });
      }
    });
  });

  if (maquinasEmManutencao.length === 0) {
    painel.style.display = "none";
    return;
  }

  painel.style.display = "block";
  const estaRecolhido = painel.classList.contains("recolhido");

  const totalPaginas = Math.ceil(maquinasEmManutencao.length / manutencoesPorPaginaPainel);
  if (paginaAtualPainel > totalPaginas) paginaAtualPainel = totalPaginas;
  if (paginaAtualPainel < 1) paginaAtualPainel = 1;

  const inicio = (paginaAtualPainel - 1) * manutencoesPorPaginaPainel;
  const fim = inicio + manutencoesPorPaginaPainel;
  const maquinasVisiveis = maquinasEmManutencao.slice(inicio, fim);

  painel.innerHTML = `
    <div class="painel-header" onclick="togglePainelManutencao()">
      🛠️ Máquinas em Manutenção <span id="painelToggleIcon">${estaRecolhido ? "▶" : "◀"}</span>
    </div>
    <div class="painel-conteudo" style="display: ${estaRecolhido ? "none" : "block"};">
      ${maquinasVisiveis.map(m => `
        <div class="maquina-box">
          <strong>${m.tipo} - ${m.etiqueta || 'Sem etiqueta'}</strong><br/>
          <small>Setor: ${m.setorNome}</small><br/>
          <button onclick="showInfo(${m.sIndex}, ${m.mIndex})">🔍 Ver Detalhes</button>
        </div>
      `).join('')}
      ${totalPaginas > 1 ? `
  <div style="text-align:center; margin-top: 10px; font-size: 0.75rem; color: #ccc;">
    <button onclick="trocarPaginaPainel(-1)" ${paginaAtualPainel === 1 ? 'disabled' : ''}
      style="padding: 3px 8px; font-size: 0.7rem; background: #0d2b45; color: #fff; border: 1px solid #1f3a56; border-radius: 4px; cursor: pointer; margin-right: 6px;"
    >&lt;</button>
    <span style="margin: 0 6px;">Página ${paginaAtualPainel} de ${totalPaginas}</span>
    <button onclick="trocarPaginaPainel(1)" ${paginaAtualPainel === totalPaginas ? 'disabled' : ''}
      style="padding: 3px 8px; font-size: 0.7rem; background: #0d2b45; color: #fff; border: 1px solid #1f3a56; border-radius: 4px; cursor: pointer; margin-left: 6px;"
    >&gt;</button>
  </div>` : ''}
    </div>
  `;
}

function trocarPaginaPainel(direcao) {
  paginaAtualPainel += direcao;
  renderPainelManutencao();
}

function showInfo(setorIndex, maquinaIndex) {
  currentSetorIndex = setorIndex;
  currentMaquinaIndex = maquinaIndex;
  const maquina = setores[setorIndex].maquinas[maquinaIndex];

  const modal = document.getElementById("infoModal");
  modal.style.display = "flex";
  modal.style.zIndex = "1600";
  bringModalToFront("infoModal");

  const modalText = document.getElementById("modalText");
  modalText.innerHTML = `
    <strong>Tipo de Equipamento:</strong> ${maquina.tipo || 'N/A'}<br>
    ${maquina.tipo === 'máquina' ? `<strong>Tipo da Máquina:</strong> ${maquina.tipoMaquina || 'N/A'}<br><strong>Número de Série:</strong> ${maquina.numeroSerie || 'N/A'}<br><strong>Etiqueta:</strong> ${maquina.etiqueta || 'Sem etiqueta'}<br>` : ''}
    ${maquina.tipo === 'monitor' ? `<strong>Etiqueta do Monitor:</strong> ${maquina.etiqueta || 'Sem etiqueta'}<br>` : ''}
  `;

  renderChamados(maquina);
  renderPainelManutencao();
}

function bringModalToFront(modalId) {
  const modais = ["infoModal", "modalTodasManutencoes", "configModal"];
  modais.forEach(id => {
    const m = document.getElementById(id);
    if (m) {
      m.style.zIndex = id === modalId ? "1600" : "1500";
    }
  });
}

function closeAllModalsExcept(modalId) {
  const modais = ["infoModal", "modalTodasManutencoes", "configModal"];
  modais.forEach(id => {
    if (id !== modalId) {
      const modal = document.getElementById(id);
      if (modal) modal.style.display = "none";
    }
  });
}

// Fechamento inicial
closeAllModalsExcept("infoModal");
bringModalToFront("infoModal");

// Atualização em tempo real
setInterval(renderPainelManutencao, 900);
