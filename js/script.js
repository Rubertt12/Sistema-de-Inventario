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
  





let html5QrCode;

function trocarCampos() {
  const tipoEquip = document.getElementById('tipoEquipamento').value;
  const camposMaquina = document.getElementById('camposMaquina');
  const camposMonitor = document.getElementById('camposMonitor');
  const btnScanner = document.getElementById('btnAbrirScanner');

  if (tipoEquip === 'máquina') {
    camposMaquina.style.display = 'block';
    camposMonitor.style.display = 'none';
    btnScanner.style.display = 'inline-block'; // mostrar botão
  } else if (tipoEquip === 'monitor') {
    camposMaquina.style.display = 'none';
    camposMonitor.style.display = 'block';
    btnScanner.style.display = 'none'; // esconder botão
  } else {
    camposMaquina.style.display = 'none';
    camposMonitor.style.display = 'none';
    btnScanner.style.display = 'none'; // esconder botão
  }
}

const cameraId = devices[0].id;





function abrirScanner() {
  document.getElementById("modalScanner").style.display = "flex";

  html5QrCode = new Html5Qrcode("reader");

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
      const cameraId = devices[0].id;

      html5QrCode.start(
        { deviceId: cameraId },
        {
          fps: 10,
          qrbox: 250,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        },
        qrCodeMessage => {
          // Só preenche o campo etiqueta da máquina se o tipo selecionado for 'máquina'
          if (document.getElementById('tipoEquipamento').value === 'máquina') {
            document.getElementById('etiquetaMaquina').value = qrCodeMessage;
          }
          fecharScanner();
        },
        errorMessage => {
          // pode ignorar erros momentâneos
        }
      ).catch(err => {
        console.error("Erro ao iniciar câmera", err);
        alert("Erro ao acessar a câmera.");
      });
    } else {
      alert("Nenhuma câmera encontrada.");
    }
  }).catch(err => {
    console.error("Erro ao obter câmeras", err);
    alert("Erro ao acessar as câmeras do dispositivo.");
  });
}

function fecharScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      document.getElementById("modalScanner").style.display = "none";
    }).catch(err => {
      console.error("Erro ao parar scanner", err);
    });
  }
}
function abrirScanner() {
  document.getElementById("modalScanner").style.display = "flex";

  html5QrCode = new Html5Qrcode("reader");

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
      // Procurar câmera traseira pelo nome
      let cameraId = devices[0].id;
      for (let device of devices) {
        if (/back|rear|traseira|environment/i.test(device.label)) {
          cameraId = device.id;
          break;
        }
      }

      html5QrCode.start(
        { deviceId: cameraId },
        {
          fps: 10,
          qrbox: 250,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        },
        qrCodeMessage => {
          // Só preenche o campo etiqueta da máquina se o tipo selecionado for 'máquina'
          if (document.getElementById('tipoEquipamento').value === 'máquina') {
            document.getElementById('etiquetaMaquina').value = qrCodeMessage;
          }
          fecharScanner();
        },
        errorMessage => {
          // erros momentâneos de leitura podem ser ignorados
        }
      ).catch(err => {
        console.error("Erro ao iniciar câmera", err);
        alert("Erro ao acessar a câmera.");
      });
    } else {
      alert("Nenhuma câmera encontrada.");
    }
  }).catch(err => {
    console.error("Erro ao obter câmeras", err);
    alert("Erro ao acessar as câmeras do dispositivo.");
  });
}
