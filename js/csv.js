(() => {
  'use strict';
  if (window.__RRN_CSV_LAZY_STUB__) return;
  window.__RRN_CSV_LAZY_STUB__ = true;

  const src = '/js/csv-v2.js?v=20260828-3';
  let loading = null;

  function ensureCsv() {
    if (window.__RRN_CSV_V2__) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rrn-csv-v2]');
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.rrnCsvV2 = '1';
      script.onload = () => { script.dataset.loaded = '1'; resolve(); };
      script.onerror = () => { loading = null; reject(new Error('Não foi possível carregar o módulo CSV.')); };
      document.head.appendChild(script);
    });
    return loading;
  }

  function installProxy(name) {
    const proxy = async function(...args) {
      try {
        await ensureCsv();
        const actual = window[name];
        if (typeof actual === 'function' && actual !== proxy) return actual.apply(this, args);
      } catch (error) {
        console.error('RRN CSV:', error);
        alert(error?.message || 'Não foi possível carregar a importação/exportação CSV.');
      }
    };
    window[name] = proxy;
  }

  installProxy('importFromCSVButton');
  installProxy('exportToCSV');
  installProxy('importFromCSV');
  window.RRN_CSV_LAZY = Object.freeze({ ensure: ensureCsv });
})();
