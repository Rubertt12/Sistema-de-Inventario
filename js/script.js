// // let setores = [];
// let currentSetorIndex, currentMaquinaIndex;
// let timers = []; // Array para armazenar os temporizadores de cada máquina
// let setoresVisiveis = []; // Array para armazenar o estado de visibilidade dos setores

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
  





