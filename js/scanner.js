(() => {
  'use strict';

  let scanner = null;
  let starting = false;
  const SCANNER_LIBRARY_URL = 'https://unpkg.com/html5-qrcode';

  function loadScannerLibrary() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (window.__RRN_SCANNER_LIBRARY_PROMISE__) return window.__RRN_SCANNER_LIBRARY_PROMISE__;

    window.__RRN_SCANNER_LIBRARY_PROMISE__ = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCANNER_LIBRARY_URL;
      script.async = true;
      script.dataset.rrnScannerLibrary = '1';
      script.onload = () => resolve();
      script.onerror = () => {
        window.__RRN_SCANNER_LIBRARY_PROMISE__ = null;
        reject(new Error('Não foi possível carregar a biblioteca do scanner.'));
      };
      document.head.appendChild(script);
    });
    return window.__RRN_SCANNER_LIBRARY_PROMISE__;
  }

  function targetInput() {
    const type = document.getElementById('tipoEquipamento')?.value;
    if (type === 'máquina') return document.getElementById('etiquetaMaquina');
    if (type === 'monitor') return document.getElementById('etiquetaMonitor');
    if (type === 'printer') return document.getElementById('etiquetaImpressora');
    return null;
  }

  function setModalVisible(visible) {
    const modal = document.getElementById('modalScanner');
    if (modal) modal.style.display = visible ? 'flex' : 'none';
  }

  async function stopScanner() {
    const current = scanner;
    scanner = null;
    starting = false;

    if (current) {
      try {
        const state = typeof current.getState === 'function' ? current.getState() : null;
        if (state == null || state === 2 || state === 3) await current.stop();
      } catch (error) {
        console.warn('RRN Manager: não foi possível parar o scanner normalmente.', error);
      }
      try { current.clear(); } catch {}
    }

    setModalVisible(false);
  }

  async function openScanner() {
    const input = targetInput();
    if (!input) {
      alert('Selecione primeiro o tipo de equipamento que deseja cadastrar.');
      return;
    }
    if (scanner || starting) return;

    starting = true;
    setModalVisible(true);

    try {
      await loadScannerLibrary();
      const cameras = await window.Html5Qrcode.getCameras();
      if (!cameras?.length) throw new Error('Nenhuma câmera encontrada.');

      const preferred = cameras.find(camera => /back|rear|traseira|environment/i.test(camera.label || '')) || cameras[0];
      scanner = new window.Html5Qrcode('reader');

      const formats = window.Html5QrcodeSupportedFormats
        ? [
            window.Html5QrcodeSupportedFormats.QR_CODE,
            window.Html5QrcodeSupportedFormats.CODE_128,
            window.Html5QrcodeSupportedFormats.CODE_39,
            window.Html5QrcodeSupportedFormats.EAN_13,
            window.Html5QrcodeSupportedFormats.EAN_8,
            window.Html5QrcodeSupportedFormats.UPC_A,
            window.Html5QrcodeSupportedFormats.UPC_E
          ].filter(value => value != null)
        : undefined;

      await scanner.start(
        { deviceId: { exact: preferred.id } },
        { fps: 10, qrbox: { width: 250, height: 180 }, formatsToSupport: formats },
        decodedText => {
          const destination = targetInput();
          if (destination) {
            destination.value = decodedText;
            destination.dispatchEvent(new Event('input', { bubbles: true }));
          }
          stopScanner();
        },
        () => undefined
      );
    } catch (error) {
      console.error('RRN Manager: falha ao abrir scanner.', error);
      alert(error?.message || 'Não foi possível acessar a câmera.');
      await stopScanner();
    } finally {
      starting = false;
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('modalScanner')?.style.display === 'flex') stopScanner();
  });

  window.abrirScanner = openScanner;
  window.fecharScanner = stopScanner;
  window.RRN_loadScannerLibrary = loadScannerLibrary;
})();
