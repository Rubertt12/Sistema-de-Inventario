// Utilitários globais do dashboard. Autenticação e tenant ficam em auth-v2.js / tenant-runtime.js.

function toggleMenu() {
  document.querySelector('.nav-links')?.classList.toggle('active');
}

function toggleUserMenu(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('userDropdown');
  if (!dropdown) return;
  const aberto = !dropdown.hidden && dropdown.style.display !== 'none';
  dropdown.hidden = aberto;
  dropdown.style.display = aberto ? 'none' : 'block';
}

document.addEventListener('click', event => {
  const menu = document.querySelector('.user-menu');
  const dropdown = document.getElementById('userDropdown');
  if (!menu || !dropdown || menu.contains(event.target)) return;
  dropdown.hidden = true;
  dropdown.style.display = 'none';
});

function openConfigModal() {
  const modal = document.getElementById('configModal');
  if (!modal) return;
  modal.removeAttribute('hidden');
  modal.style.display = 'flex';
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.hidden = true;
    dropdown.style.display = 'none';
  }
}

function closeConfigModal() {
  const modal = document.getElementById('configModal');
  if (!modal) return;
  modal.style.display = 'none';
}

window.addEventListener('click', event => {
  const modal = document.getElementById('configModal');
  if (event.target === modal) closeConfigModal();
});

function changeProfilePicture(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return alert('Selecione uma imagem válida.');
  if (file.size > 2 * 1024 * 1024) return alert('A imagem deve ter no máximo 2 MB.');

  const reader = new FileReader();
  reader.onload = e => {
    const value = e.target.result;
    const profile = document.getElementById('profilePic');
    const avatar = document.getElementById('userAvatar');
    if (profile) profile.src = value;
    if (avatar) avatar.src = value;
    localStorage.setItem('userProfileImage', value);
  };
  reader.readAsDataURL(file);
}

document.addEventListener('DOMContentLoaded', () => {
  const savedImage = localStorage.getItem('userProfileImage');
  if (savedImage) {
    const profile = document.getElementById('profilePic');
    const avatar = document.getElementById('userAvatar');
    if (profile) profile.src = savedImage;
    if (avatar) avatar.src = savedImage;
  }
});

function exportarBackupJSON() {
  const dados = {
    versao: 2,
    exportadoEm: new Date().toISOString(),
    tenant: window.RRN_SESSION?.tenantId || null,
    setores: typeof setores !== 'undefined' ? setores : JSON.parse(localStorage.getItem('setores') || '[]'),
    chamados: JSON.parse(localStorage.getItem('chamados') || '[]')
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `backup-inventario-${new Date().toISOString().slice(0,10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importarBackupJSON(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const dados = JSON.parse(e.target.result);
      if (!Array.isArray(dados.setores)) throw new Error('O arquivo não contém uma lista válida de setores.');
      localStorage.setItem('setores', JSON.stringify(dados.setores));
      localStorage.setItem('chamados', JSON.stringify(Array.isArray(dados.chamados) ? dados.chamados : []));
      alert('Backup restaurado com sucesso.');
      location.reload();
    } catch (error) {
      alert(`Não foi possível importar o backup: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function toggleChecklist(legendElement) {
  legendElement?.parentElement?.classList.toggle('collapsed');
}

function abrirPaginaUsuarios() {
  location.href = 'usuarios.html';
}

function salvarConfigBackground({ cor = null, imagem = null } = {}) {
  const tenant = window.RRN_SESSION?.tenantId || 'local';
  localStorage.setItem(`dashboardBgConfig_${tenant}`, JSON.stringify({ cor, imagem }));
}

// Logout de contingência. tenant-runtime.js substitui esta função quando a sessão Supabase estiver pronta.
function logout() {
  localStorage.removeItem('usuarioLogado');
  location.href = 'index.html';
}

// Compatibilidade com links externos que adicionam um equipamento via query string.
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const hostname = params.get('hostname');
  const usuario = params.get('usuario');
  const etiqueta = params.get('etiqueta');
  const setorNome = params.get('setor');
  const descricao = params.get('descricao') || '';
  if (!hostname || !setorNome || !etiqueta) return;

  const lista = JSON.parse(localStorage.getItem('setores') || '[]');
  let setor = lista.find(item => item.nome === setorNome);
  if (!setor) {
    setor = { nome: setorNome, maquinas: [] };
    lista.push(setor);
  }
  if (!Array.isArray(setor.maquinas)) setor.maquinas = [];
  if (!setor.maquinas.some(item => item.etiqueta === etiqueta)) {
    setor.maquinas.push({
      id: Date.now(),
      nome: hostname,
      etiqueta,
      modelo: descricao,
      setor: setorNome,
      usuarioResponsavel: usuario || '',
      tipo: 'PC',
      chamado: []
    });
    localStorage.setItem('setores', JSON.stringify(lista));
  }
});

// ====================================================================
// Experiência visual Setor -> Equipamentos
// Mantém as funções e os dados legados, alterando somente a renderização.
// ====================================================================

function rrnEscapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function rrnEquipmentIcon(tipo) {
  const value = String(tipo || '').toLowerCase();
  if (value.includes('notebook')) return '💻';
  if (value.includes('monitor')) return '🖥️';
  if (value.includes('impress')) return '🖨️';
  if (value.includes('workstation')) return '🧰';
  return '🖥️';
}

function rrnRoleCanOperate() {
  const sessionRole = window.RRN_SESSION?.role;
  if (sessionRole) return sessionRole !== 'monitoramento';
  try {
    return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil !== 'monitoramento';
  } catch {
    return true;
  }
}

function rrnInstallSectorRenderer() {
  if (typeof setores === 'undefined' || typeof setoresVisiveis === 'undefined') return false;
  if (window.__RRN_SECTOR_RENDERER_V2__) return true;

  window.__RRN_SECTOR_RENDERER_V2__ = true;

  window.renderSetores = function renderSetoresRRN(termoBusca = null) {
    const container = document.getElementById('setoresContainer');
    if (!container) return;

    const termo = String(termoBusca || '').trim().toLowerCase();
    const listaSetores = Array.isArray(setores) ? setores : [];
    const indicesBase = setoresFiltradosIndices ?? listaSetores.map((_, index) => index);
    const indicesParaMostrar = indicesBase.filter(index => {
      const setor = listaSetores[index];
      if (!setor) return false;
      if (!termo) return true;
      if (String(setor.nome || '').toLowerCase().includes(termo)) return true;
      return (setor.maquinas || []).some(maquina => [
        maquina.nome,
        maquina.tipo,
        maquina.etiqueta,
        maquina.usuarioResponsavel
      ].some(value => String(value || '').toLowerCase().includes(termo)));
    });

    container.innerHTML = '';

    if (!indicesParaMostrar.length) {
      container.innerHTML = `
        <div class="rrn-empty-state">
          <span>🔎</span>
          <strong>Nenhum setor ou equipamento encontrado</strong>
          <small>Tente outro termo de pesquisa ou crie um novo setor.</small>
        </div>`;
      document.getElementById('setoresPaginacao')?.remove();
      return;
    }

    const porPagina = typeof setoresPorPagina === 'number' && setoresPorPagina > 0 ? setoresPorPagina : 10;
    const totalPaginas = Math.max(1, Math.ceil(indicesParaMostrar.length / porPagina));
    if (typeof paginaSetoresAtual !== 'number' || paginaSetoresAtual < 1) paginaSetoresAtual = 1;
    if (paginaSetoresAtual > totalPaginas) paginaSetoresAtual = totalPaginas;

    const inicio = (paginaSetoresAtual - 1) * porPagina;
    const indicesPaginados = indicesParaMostrar.slice(inicio, inicio + porPagina);
    const podeOperar = rrnRoleCanOperate();

    indicesPaginados.forEach(setorIndex => {
      const setor = listaSetores[setorIndex];
      if (!setor) return;
      if (!Array.isArray(setor.maquinas)) setor.maquinas = [];

      const setorMatch = termo && String(setor.nome || '').toLowerCase().includes(termo);
      const maquinasFiltradas = termo && !setorMatch
        ? setor.maquinas.filter(maquina => [
            maquina.nome,
            maquina.tipo,
            maquina.etiqueta,
            maquina.usuarioResponsavel
          ].some(value => String(value || '').toLowerCase().includes(termo)))
        : setor.maquinas;

      const emManutencao = setor.maquinas.filter(maquina => maquina.emManutencao).length;
      const aberto = Boolean(setoresVisiveis[setorIndex]) || Boolean(termo);
      const card = document.createElement('section');
      card.className = 'setor rrn-setor-card';
      card.dataset.setorIndex = String(setorIndex);
      card.ondragover = event => event.preventDefault();
      card.ondrop = event => typeof dropMachine === 'function' && dropMachine(event, setorIndex);

      const itens = maquinasFiltradas.map(maquina => {
        const maquinaIndex = setor.maquinas.indexOf(maquina);
        const statusClass = maquina.emManutencao ? 'maintenance' : 'online';
        const statusLabel = maquina.emManutencao ? 'Em manutenção' : 'Operando';
        const usuario = maquina.usuarioResponsavel
          ? `<span class="rrn-machine-user">👤 ${rrnEscapeHtml(maquina.usuarioResponsavel)}</span>`
          : '';
        const etiqueta = maquina.etiqueta
          ? `<span class="rrn-machine-tag">🏷️ ${rrnEscapeHtml(maquina.etiqueta)}</span>`
          : '';

        return `
          <article class="rrn-machine-item ${statusClass}" draggable="${podeOperar ? 'true' : 'false'}"
            ${podeOperar ? `ondragstart="dragStart(event, ${setorIndex}, ${maquinaIndex})"` : ''}>
            <div class="rrn-machine-icon" aria-hidden="true">${rrnEquipmentIcon(maquina.tipo)}</div>
            <div class="rrn-machine-main">
              <div class="rrn-machine-title-row">
                <strong>${rrnEscapeHtml(maquina.nome || 'Equipamento sem nome')}</strong>
                <span class="rrn-status ${statusClass}">${statusLabel}</span>
              </div>
              <div class="rrn-machine-meta">
                <span>${rrnEscapeHtml(maquina.tipo || 'Equipamento')}</span>
                ${etiqueta}
                ${usuario}
              </div>
            </div>
            <div class="rrn-machine-actions">
              <button type="button" class="rrn-btn rrn-btn-info" onclick="showInfo(${setorIndex}, ${maquinaIndex})">Info</button>
              ${podeOperar ? `<button type="button" class="rrn-btn rrn-btn-danger operador-only" onclick="removeMaquina(${setorIndex}, ${maquinaIndex})">Excluir</button>` : ''}
            </div>
          </article>`;
      }).join('');

      card.innerHTML = `
        <div class="setor-header rrn-setor-header">
          <div class="rrn-setor-title">
            <span class="rrn-setor-icon" aria-hidden="true">🏢</span>
            <div>
              <h2>${rrnEscapeHtml(setor.nome || 'Setor sem nome')}</h2>
              <div class="rrn-setor-summary">
                <span>${setor.maquinas.length} ${setor.maquinas.length === 1 ? 'equipamento' : 'equipamentos'}</span>
                ${emManutencao ? `<span class="rrn-maintenance-count">${emManutencao} em manutenção</span>` : '<span class="rrn-all-ok">Tudo operando</span>'}
              </div>
            </div>
          </div>
          ${podeOperar ? `
          <div class="rrn-setor-admin operador-only">
            <button type="button" class="rrn-icon-btn" onclick="editSetorName(${setorIndex})" title="Renomear setor">✏️</button>
            <button type="button" class="rrn-icon-btn danger" onclick="removeSetor(${setorIndex})" title="Excluir setor">🗑️</button>
          </div>` : ''}
        </div>

        <div class="rrn-setor-toolbar">
          ${podeOperar ? `<button type="button" class="rrn-btn rrn-btn-primary operador-only" onclick="abrirModalMaquina(${setorIndex})">＋ Adicionar equipamento</button>` : ''}
          <button type="button" class="rrn-btn rrn-btn-secondary" onclick="toggleMachines(${setorIndex})">
            ${aberto ? 'Ocultar equipamentos' : `Mostrar equipamentos (${setor.maquinas.length})`}
          </button>
        </div>

        <div id="maquinas-${setorIndex}" class="rrn-machines-list" style="display:${aberto ? 'grid' : 'none'}">
          ${itens || `
            <div class="rrn-sector-empty">
              <span>📦</span>
              <div><strong>Este setor ainda está vazio</strong><small>${podeOperar ? 'Use “Adicionar equipamento” para começar.' : 'Nenhum equipamento cadastrado neste setor.'}</small></div>
            </div>`}
        </div>`;

      container.appendChild(card);
    });

    if (typeof renderizarPaginacaoSetores === 'function') {
      renderizarPaginacaoSetores(totalPaginas);
    }
  };

  return true;
}

// Instala depois que todos os scripts legados já declararam suas funções.
window.addEventListener('load', () => {
  if (!rrnInstallSectorRenderer()) return;
  setTimeout(() => {
    if (typeof window.renderSetores === 'function') window.renderSetores();
  }, 80);
});
