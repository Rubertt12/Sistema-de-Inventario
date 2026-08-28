(() => {
  'use strict';

  if (window.__RRN_CSV_V2__) return;
  window.__RRN_CSV_V2__ = true;

  const HEADER = [
    'Setor','Tipo','Número de Série / Nome','Etiqueta','Em Manutenção','Início da Manutenção','Usuário',
    'Chamados JSON','ID','Fabricante','Modelo','Localização','Situação Patrimonial','Data da Compra','Garantia Até','Observações do Ativo'
  ];

  const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

  function parseCsvLine(line) {
    const cells = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === ';' && !quoted) {
        cells.push(value); value = '';
      } else value += char;
    }
    cells.push(value);
    return cells;
  }

  function inventory() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function normalizeTickets(machine) {
    const source = Array.isArray(machine?.chamados) ? machine.chamados : (Array.isArray(machine?.chamado) ? machine.chamado : []);
    return source.map(ticket => ({
      texto: ticket?.texto ?? ticket?.descricao ?? ticket?.observacao ?? '',
      prioridade: ticket?.prioridade ?? 'Baixa',
      data: ticket?.data ?? null,
      atualizadoEm: ticket?.atualizadoEm ?? null,
      autor: ticket?.autor ?? ticket?.criadoPor ?? ticket?.usuario ?? '',
      interacoes: Array.isArray(ticket?.interacoes) ? ticket.interacoes : []
    }));
  }

  function exportToCSV() {
    const rows = [HEADER.map(csvEscape).join(';')];
    inventory().forEach(sector => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach(machine => {
        rows.push([
          sector?.nome || '', machine?.tipo || '', machine?.numeroSerie || machine?.nome || '', machine?.etiqueta || '',
          Boolean(machine?.emManutencao), machine?.tempoManutencao || '', machine?.usuarioResponsavel || '',
          JSON.stringify(normalizeTickets(machine)), machine?.id || '', machine?.fabricante || '', machine?.modelo || '',
          machine?.localizacao || '', machine?.situacaoPatrimonial || 'ativo', machine?.dataCompra || '',
          machine?.garantiaAte || '', machine?.observacoesAtivo || ''
        ].map(csvEscape).join(';'));
      });
    });

    const blob = new Blob(['\uFEFF', rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rrn-manager-inventario-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function parseTickets(raw) {
    const text = String(raw || '').trim();
    if (!text || text === 'Nenhuma Observação') return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(ticket => ({
        ...ticket,
        texto: ticket?.texto ?? ticket?.descricao ?? ticket?.observacao ?? '',
        prioridade: ticket?.prioridade ?? 'Baixa',
        data: ticket?.data ?? new Date().toISOString(),
        interacoes: Array.isArray(ticket?.interacoes) ? ticket.interacoes : []
      }));
    } catch {}
    return text.split(' | ').map(entry => {
      const [texto, prioridade] = entry.split(' - Prioridade: ');
      return { texto: texto?.trim() || '', prioridade: prioridade?.trim() || 'Baixa', data: new Date().toISOString(), interacoes: [] };
    }).filter(ticket => ticket.texto);
  }

  function safeId(value) {
    const id = String(value || '').trim();
    return id || crypto?.randomUUID?.() || `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function maintenanceTimestamp(raw, enabled) {
    if (!enabled || !raw) return 0;
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }

  function importFromCSV(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) throw new Error('O CSV não contém registros para importar.');
        const header = parseCsvLine(lines[0]).map(value => value.trim());
        const modern = header.includes('Chamados JSON') || header.includes('Fabricante');
        const nextSectors = [];

        lines.slice(1).forEach(line => {
          const cells = parseCsvLine(line);
          if (cells.length < 4) return;
          const sectorName = String(cells[0] || '').trim();
          if (!sectorName) return;

          let sector = nextSectors.find(item => item.nome === sectorName);
          if (!sector) { sector = { nome: sectorName, maquinas: [] }; nextSectors.push(sector); }

          const maintenance = String(cells[4] || '').trim().toLowerCase() === 'true';
          const legacyTickets = cells.length > 8 ? cells.slice(7, -1).join(';') : cells[7];
          const tickets = parseTickets(modern ? cells[7] : legacyTickets);
          const machine = {
            id: safeId(cells[8]),
            nome: String(cells[2] || '').trim() || 'Sem nome',
            tipo: String(cells[1] || '').trim() || 'Equipamento',
            etiqueta: String(cells[3] || '').trim(),
            chamado: tickets,
            chamados: tickets,
            emManutencao: maintenance,
            tempoManutencao: maintenanceTimestamp(cells[5], maintenance),
            usuarioResponsavel: String(cells[6] || '').trim(),
            fabricante: modern ? String(cells[9] || '').trim() : '',
            modelo: modern ? String(cells[10] || '').trim() : '',
            localizacao: modern ? String(cells[11] || '').trim() : '',
            situacaoPatrimonial: modern ? String(cells[12] || 'ativo').trim() || 'ativo' : 'ativo',
            dataCompra: modern ? String(cells[13] || '').trim() : '',
            garantiaAte: modern ? String(cells[14] || '').trim() : '',
            observacoesAtivo: modern ? String(cells[15] || '').trim() : '',
            atualizadoEm: new Date().toISOString()
          };
          sector.maquinas.push(machine);
        });

        if (!nextSectors.length) throw new Error('Nenhum setor válido foi encontrado no CSV.');
        if (!confirm(`Importar ${nextSectors.length} setor(es) do CSV e substituir o inventário atual?`)) return;

        try {
          setores = nextSectors;
          setoresVisiveis = new Array(nextSectors.length).fill(false);
          setoresFiltradosIndices = null;
          paginaSetoresAtual = 1;
        } catch {}
        localStorage.setItem('setores', JSON.stringify(nextSectors));
        window.saveSetoresAndMachines?.();
        window.renderSetores?.();
        window.RRN_UI?.updateOverview?.();
        window.RRN_TABS?.renderHome?.();
        alert(`Importação concluída: ${nextSectors.length} setor(es) carregado(s).`);
      } catch (error) {
        alert(`Não foi possível importar o CSV: ${error.message || 'erro inesperado'}`);
      } finally {
        if (event?.target) event.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function importFromCSVButton() {
    document.getElementById('csvInput')?.click();
  }

  window.importFromCSVButton = importFromCSVButton;
  window.exportToCSV = exportToCSV;
  window.importFromCSV = importFromCSV;
})();
