(() => {
  'use strict';

  function inventory() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function history() {
    try {
      const parsed = JSON.parse(localStorage.getItem('asset_history') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function tenantName() {
    if (window.RRN_SESSION?.tenantName) return window.RRN_SESSION.tenantName;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').tenant || 'Workspace'; }
    catch { return 'Workspace'; }
  }

  function csvCell(value) {
    const text = String(value ?? '').replace(/\r?\n/g, ' ');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
    const blob = new Blob(['\ufeff', text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function status(asset) {
    if (asset.emManutencao) return 'Em manutenção';
    const value = String(asset.situacaoPatrimonial || 'ativo').toLowerCase();
    if (value.includes('estoque')) return 'Em estoque';
    if (value.includes('emprest')) return 'Emprestado';
    if (value.includes('baix')) return 'Baixado';
    return 'Ativo';
  }

  function exportInventoryCsv() {
    const header = [
      'Setor','Tipo','Número de Série / Nome','Etiqueta / Patrimônio','Usuário Responsável',
      'Fabricante','Modelo','Localização','Situação','Em Manutenção','Data da Compra','Garantia Até',
      'Quantidade de Chamados','Observações do Ativo','ID'
    ];
    const rows = [header];
    inventory().forEach(sector => {
      (sector.maquinas || []).forEach(asset => rows.push([
        sector.nome || '', asset.tipo || '', asset.nome || '', asset.etiqueta || '', asset.usuarioResponsavel || '',
        asset.fabricante || '', asset.modelo || '', asset.localizacao || '', status(asset), asset.emManutencao ? 'Sim' : 'Não',
        asset.dataCompra || '', asset.garantiaAte || '', Array.isArray(asset.chamado) ? asset.chamado.length : 0,
        asset.observacoesAtivo || '', asset.id || ''
      ]));
    });
    downloadText(`rrn-inventario-detalhado-${dateStamp()}.csv`, rows.map(row => row.map(csvCell).join(';')).join('\r\n'));
  }

  function exportAuditCsv() {
    const rows = [[
      'Data/Hora','Evento','Equipamento','Setor Origem','Setor Destino','Usuário','Perfil','Origem Técnica','Detalhes'
    ]];
    history().slice().reverse().forEach(event => rows.push([
      event.timestamp ? new Date(event.timestamp).toLocaleString('pt-BR') : '',
      event.title || event.eventType || '', event.assetLabel || event.entityId || '', event.fromSector || '', event.toSector || '',
      event.actorName || '', event.actorRole || '', event.source || '', event.details ? JSON.stringify(event.details) : ''
    ]));
    downloadText(`rrn-auditoria-${dateStamp()}.csv`, rows.map(row => row.map(csvCell).join(';')).join('\r\n'));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  }

  function printableRows() {
    return inventory().map(sector => {
      const assets = Array.isArray(sector.maquinas) ? sector.maquinas : [];
      return `<section class="sector"><h2>${escapeHtml(sector.nome || 'Setor sem nome')} <small>${assets.length} equipamento(s)</small></h2>
        ${assets.length ? `<table><thead><tr><th>Etiqueta</th><th>Série/Nome</th><th>Tipo</th><th>Usuário</th><th>Fabricante / Modelo</th><th>Status</th><th>Garantia</th></tr></thead><tbody>${assets.map(asset => `<tr><td>${escapeHtml(asset.etiqueta || '—')}</td><td>${escapeHtml(asset.nome || '—')}</td><td>${escapeHtml(asset.tipo || '—')}</td><td>${escapeHtml(asset.usuarioResponsavel || '—')}</td><td>${escapeHtml([asset.fabricante,asset.modelo].filter(Boolean).join(' ') || '—')}</td><td>${escapeHtml(status(asset))}</td><td>${escapeHtml(asset.garantiaAte || '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Setor sem equipamentos.</p>'}</section>`;
    }).join('');
  }

  function openPrintableReport() {
    const list = inventory();
    const assets = list.flatMap(sector => sector.maquinas || []);
    const maintenance = assets.filter(asset => asset.emManutencao).length;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return alert('O navegador bloqueou a janela do relatório. Permita pop-ups para o RRN Manager e tente novamente.');

    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório RRN Manager</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#26374f;background:#fff}header{padding:28px 34px;background:#295991;color:#fff}header h1{margin:0;font-size:24px}header p{margin:6px 0 0;opacity:.82}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:22px 34px}.summary div{padding:14px;border:1px solid #ded9c4;border-radius:10px}.summary strong{display:block;color:#295991;font-size:24px}.summary small{color:#6e7480}.content{padding:0 34px 34px}.sector{margin:0 0 24px}.sector h2{margin:0 0 10px;color:#295991;font-size:18px}.sector h2 small{color:#7a7f88;font-size:12px;font-weight:400}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:8px;border:1px solid #ded9c4;text-align:left;vertical-align:top}th{background:#f7f0da;color:#295991}.empty{color:#777}footer{padding:18px 34px;border-top:1px solid #ddd;color:#777;font-size:10px}@media print{header{-webkit-print-color-adjust:exact;print-color-adjust:exact}.summary div{break-inside:avoid}.sector{break-inside:avoid}}
    </style></head><body><header><h1>RRN Manager — Relatório de Inventário</h1><p>${escapeHtml(tenantName())} · gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p></header><div class="summary"><div><strong>${list.length}</strong><small>Setores</small></div><div><strong>${assets.length}</strong><small>Equipamentos</small></div><div><strong>${maintenance}</strong><small>Em manutenção</small></div></div><main class="content">${printableRows()}</main><footer>RRN Manager · relatório gerado a partir do estado atual do inventário.</footer><script>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    win.document.close();
  }

  function injectButtons() {
    const right = document.querySelector('#configModal .modal-right');
    if (!right || right.querySelector('[data-rrn-reports]')) return;
    const marker = document.createElement('div');
    marker.dataset.rrnReports = '1';
    marker.style.display = 'contents';
    const heading = document.createElement('h3');
    heading.className = 'rrn-settings-label';
    heading.textContent = 'RELATÓRIOS';
    const inventoryButton = document.createElement('button');
    inventoryButton.type = 'button';
    inventoryButton.textContent = '📊 Exportar inventário detalhado (CSV)';
    inventoryButton.addEventListener('click', exportInventoryCsv);
    const auditButton = document.createElement('button');
    auditButton.type = 'button';
    auditButton.textContent = '🧾 Exportar auditoria (CSV)';
    auditButton.addEventListener('click', exportAuditCsv);
    const printButton = document.createElement('button');
    printButton.type = 'button';
    printButton.textContent = '🖨️ Relatório para impressão / PDF';
    printButton.addEventListener('click', openPrintableReport);
    marker.append(heading, inventoryButton, auditButton, printButton);
    right.appendChild(marker);
  }

  function boot() {
    injectButtons();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      injectButtons();
      if (attempts >= 12) clearInterval(timer);
    }, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  window.addEventListener('load', () => setTimeout(boot, 70));

  window.RRN_REPORTS = Object.freeze({ exportInventoryCsv, exportAuditCsv, openPrintableReport });
})();
