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

function togglePainelManutencao() {
  const painel = document.getElementById("painelManutencao");
  const icone = document.getElementById("painelToggleIcon");
  painel.classList.toggle("recolhido");
  icone.textContent = painel.classList.contains("recolhido") ? "▶" : "◀";
}

function abrirModalTodasManutencoes() {
  const lista = document.getElementById("listaTodasManutencoes");
  const modal = document.getElementById("modalTodasManutencoes");
  lista.innerHTML = "";

  let maquinas = [];
  setores.forEach((setor, sIndex) => {
    setor.maquinas.forEach((m, mIndex) => {
      if (m.emManutencao) {
        maquinas.push({ ...m, setorNome: setor.nome, sIndex, mIndex });
      }
    });
  });

  if (maquinas.length === 0) {
    lista.innerHTML = "<p>Nenhuma máquina em manutenção.</p>";
  } else {
    lista.innerHTML = maquinas.map(m => `
      <div class="maquina-box">
        <strong>${m.tipo} - ${m.etiqueta || 'Sem etiqueta'}</strong><br/>
        <small>Setor: ${m.setorNome}</small><br/>
        <button onclick="showInfo(${m.sIndex}, ${m.mIndex})">🔍 Ver Detalhes</button>
      </div>
    `).join('');
  }

  modal.style.display = "flex";
}

function fecharModalTodasManutencoes() {
  const modal = document.getElementById("modalTodasManutencoes");
  if (modal) modal.style.display = "none";
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

  const maquinasVisiveis = maquinasEmManutencao.slice(0, 5);

  painel.innerHTML = `
    <div class="painel-header" onclick="togglePainelManutencao()">
      🛠️ Máquinas em Manutenção <span id="painelToggleIcon">◀</span>
    </div>
    <div class="painel-conteudo">
      ${maquinasEmManutencao.length === 0
        ? '<p style="padding: 10px;">Nenhuma máquina em manutenção.</p>'
        : maquinasVisiveis.map(m => `
            <div class="maquina-box">
              <strong>${m.tipo} - ${m.etiqueta || 'Sem etiqueta'}</strong><br/>
              <small>Setor: ${m.setorNome}</small><br/>
              <button onclick="showInfo(${m.sIndex}, ${m.mIndex})">🔍 Ver Detalhes</button>
            </div>
          `).join('') +
          (maquinasEmManutencao.length > 5
            ? `<div style="text-align:center; margin-top: 10px;">
                 <button onclick="abrirModalTodasManutencoes()">Ver todas (${maquinasEmManutencao.length})</button>
               </div>`
            : '')
      }
    </div>
  `;
}


function showInfo(setorIndex, maquinaIndex) {
  currentSetorIndex = setorIndex;
  currentMaquinaIndex = maquinaIndex;
  const maquina = setores[setorIndex].maquinas[maquinaIndex];

  const modal = document.getElementById("infoModal");

  // ✅ Garantir que fique à frente de qualquer outro modal
  modal.style.zIndex = 1600; // ou outro maior que os demais modais

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

function bringModalToFront(modalId) {
  const modais = ["infoModal", "modalTodasManutencoes", "configModal"]; // Adicione todos que existem
  modais.forEach(id => {
    const m = document.getElementById(id);
    if (m) m.style.zIndex = id === modalId ? "1600" : "1500";
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
closeAllModalsExcept("infoModal");
bringModalToFront("infoModal");
fecharModalTodasManutencoes(); // Fecha o modal de manutenção antes de abrir o infoModal
