let setores = [];
let currentSetorIndex, currentMaquinaIndex;
let timers = [];
let setoresVisiveis = [];

/// ==========================
/// Alternância entre List/Grid
/// ==========================
function toggleLayout() {
  const container = document.getElementById('setoresContainer');
  const toggle = document.getElementById('layoutToggle');

  if (toggle.checked) {
    container.classList.remove('grid-view');
    container.classList.add('list-view');
  } else {
    container.classList.remove('list-view');
    container.classList.add('grid-view');
  }

  container.style.transition = 'all 0.5s ease';
}

// Define layout padrão ao carregar
window.onload = () => {
  document.activeElement.blur();
  const container = document.getElementById('setoresContainer');
  const toggle = document.getElementById('layoutToggle');

  container.classList.add('grid-view');
  container.classList.remove('list-view');
  toggle.checked = false;
};


function realizarLogin() {
  const nome = document.getElementById("nome").value;
  const senha = document.getElementById("senha").value;

  const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  const user = usuarios.find(u => u.nome === nome && u.senha === senha);

  if (user) {
    localStorage.setItem("usuarioLogado", JSON.stringify(user));
    window.location.href = "dashboard.html"; // ou onde estiver seu painel
  } else {
    alert("Usuário ou senha inválidos");
  }
}
window.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (user && user.nome) {
    document.getElementById("userName").textContent = user.nome;
  }
});
/// ==========================
/// Modal de Setor
/// ==========================
function addSetor() {
  document.getElementById("modalSetor").style.display = "flex";
}

function fecharModalSetor() {
  document.getElementById("modalSetor").style.display = "none";
}

function confirmarAddSetor() {
  const setorName = document.getElementById("inputSetorNome").value.trim();
  if (setorName) {
    const setor = { nome: setorName, maquinas: [] };
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

/// ==========================
/// Exibição de campos por tipo de equipamento
/// ==========================
function trocarCampos() {
  const tipoEquip = document.getElementById('tipoEquipamento').value;
  const camposMaquina = document.getElementById('camposMaquina');
  const camposMonitor = document.getElementById('camposMonitor');
  const btnScanner = document.getElementById('btnAbrirScanner');

  if (tipoEquip === 'máquina') {
    camposMaquina.style.display = 'block';
    camposMonitor.style.display = 'none';
    btnScanner.style.display = 'inline-block';
  } else if (tipoEquip === 'monitor') {
    camposMaquina.style.display = 'none';
    camposMonitor.style.display = 'block';
    btnScanner.style.display = 'inline-block';
  } else {
    camposMaquina.style.display = 'none';
    camposMonitor.style.display = 'none';
    btnScanner.style.display = 'none';
  }
}

/// ==========================
/// Scanner QR Code
/// ==========================
let html5QrCode;

function abrirScanner() {
  document.getElementById("modalScanner").style.display = "flex";
  html5QrCode = new Html5Qrcode("reader");

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
      // Tenta pegar câmera traseira
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
          const tipo = document.getElementById('tipoEquipamento').value;
          if (tipo === 'máquina') {
            document.getElementById('etiquetaMaquina').value = qrCodeMessage;
          } else if (tipo === 'monitor') {
            document.getElementById('etiquetaMonitor').value = qrCodeMessage;
          }
          fecharScanner();
        },
        errorMessage => {
          // Ignora erros momentâneos
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



let html5QrcodeScanner;

function abrirScanner() {
  document.getElementById('modalScanner').style.display = 'flex';

  if (html5QrcodeScanner) return; // Já iniciado

  html5QrcodeScanner = new Html5Qrcode("reader");

  html5QrcodeScanner.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: 250
    },
    (decodedText, decodedResult) => {
      // Preenche o campo correto conforme o tipo selecionado
      const tipoEquip = document.getElementById('tipoEquipamento').value;

      if (tipoEquip === 'máquina') {
        document.getElementById('nomeMaquina').value = decodedText;
      } else if (tipoEquip === 'monitor') {
        document.getElementById('etiquetaMonitor').value = decodedText;
      }

      fecharScanner(); // Fecha modal e para câmera após leitura
    },
    (errorMessage) => {
      // Pode ignorar erros de leitura aqui
      // console.log("Erro leitura QR:", errorMessage);
    }
  ).catch(err => {
    alert("Erro ao acessar a câmera: " + err);
    fecharScanner();
  });
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


function logout() {
  localStorage.removeItem('usuarioLogado');
  window.location.href = 'index.html'; // vai pro login de novo
}



// const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
// const nomeUsuario = usuario ? usuario.nome : "guest";

// // Função para salvar configuração do usuário
// function salvarConfigBackground({ cor, imagem }) {
//   const config = {
//     cor: cor || null,
//     imagem: imagem || null
//   };
//   localStorage.setItem(`dashboardBgConfig_${nomeUsuario}`, JSON.stringify(config));
// }

// // Função para carregar configuração do usuário
// function carregarConfigBackground() {
//   const configStr = localStorage.getItem(`dashboardBgConfig_${nomeUsuario}`);
//   if (!configStr) return;

//   const config = JSON.parse(configStr);

//   if (config.imagem) {
//     document.body.style.backgroundImage = `url('${config.imagem}')`;
//     document.body.style.backgroundSize = "cover";
//     document.body.style.backgroundRepeat = "no-repeat";
//     document.body.style.backgroundPosition = "center center";

//     // Limpar input URL e color picker
//     document.getElementById("bgImageUrl").value = "";
//   } else if (config.cor) {
//     document.body.style.backgroundColor = config.cor;
//     document.body.style.backgroundImage = "none";

//     document.getElementById("bgColorPicker").value = config.cor;
//   }
// }

// // Modificações nos event listeners para salvar usando a função por usuário

// bgColorPicker.addEventListener("input", (e) => {
//   const corEscolhida = e.target.value;
//   document.body.style.backgroundColor = corEscolhida;
//   document.body.style.backgroundImage = "none";
//   salvarConfigBackground({ cor: corEscolhida, imagem: null });
// });

// applyBgImageUrlBtn.addEventListener("click", () => {
//   const url = bgImageUrlInput.value.trim();
//   if (!url) {
//     alert("Digite a URL da imagem!");
//     return;
//   }
//   document.body.style.backgroundImage = `url('${url}')`;
//   document.body.style.backgroundSize = "cover";
//   document.body.style.backgroundRepeat = "no-repeat";
//   document.body.style.backgroundPosition = "center center";

//   salvarConfigBackground({ cor: null, imagem: url });
// });

// applyBgUploadBtn.addEventListener("click", () => {
//   const file = bgImageUploadInput.files[0];
//   if (!file) {
//     alert("Selecione uma imagem para upload!");
//     return;
//   }
//   const reader = new FileReader();
//   reader.onload = function (e) {
//     document.body.style.backgroundImage = `url('${e.target.result}')`;
//     document.body.style.backgroundSize = "cover";
//     document.body.style.backgroundRepeat = "no-repeat";
//     document.body.style.backgroundPosition = "center center";

//     salvarConfigBackground({ cor: null, imagem: e.target.result });
//     bgImageUrlInput.value = "";
//   };
//   reader.readAsDataURL(file);
// });

// // Carregar configuração do usuário no carregamento da página
// window.addEventListener("DOMContentLoaded", () => {
//   carregarConfigBackground();
// });
