(() => {
  'use strict';

  const HEADER = [
    'Setor',
    'Tipo',
    'Número de Série / Nome',
    'Etiqueta',
    'Em Manutenção',
    'Início da Manutenção',
    'Usuário',
    'Chamados JSON',
    'ID',
    'Fabricante',
    'Modelo',
    'Localização',
    'Situação Patrimonial',
    'Data da Compra',
    'Garantia Até',
    'Observações do Ativo'
  ];

  function csvEscape(value) {
    const text = value == null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function parseCsvLine(line) {
    const cells = [];
    let value = '';
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === ';' && !quoted) {
        cells.push(value);
        value = '';
      } else {
        value += char;
      }
    }
    cells.push(value);
    return cells;
  }

  function normalizeTickets(machine) {
    const source = Array.isArray(machine?.chamados)
      ? machine.chamados
      : (Array.isArray(machine?.chamado) ? machine.chamado : []);

    return source.map(ticket => ({
      texto: ticket?.texto ?? ticket?.observacao ?? '',
      prioridade: ticket?.prioridade ?? 'Baixa',
      data: ticket?.data ?? null,
      atualizadoEm: ticket?.atualizadoEm ?? null,
      interacoes: Array.isArray(ticket?.interacoes) ? ticket.interacoes : []
    }));
  }

  function maintenanceValue(machine) {
    if (!machine?.tempoManutencao) return '';
    const date = new Date(machine.tempoManutencao);
    return Number.isNaN(date.getTime()) ? String(machine.tempoManutencao) : date.toISOString();
  }

  function inventory() {
    try {
      if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores;
    } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function importFromCSVButton() {
    document.getElementById('csvInput')?.click();
  }

  function exportToCSV() {
    const rows = [HEADER.map(csvEscape).join(';')];

    inventory().forEach(sector => {
      const machines = Array.isArray(sector?.maquinas) ? sector.maquinas : [];
      machines.forEach(machine => {
        rows.push([
          sector?.nome || '',
          machine?.tipo || '',
          machine?.numeroSerie || machine?.nome || '',
          machine?.etiqueta || '',
          Boolean(machine?.emManutencao),
          maintenanceValue(machine),
          machine?.usuarioResponsavel || '',
          JSON.stringify(normalizeTickets(machine)),
          machine?.id || '',
          machine?.fabricante || '',
          machine?.modelo || '',
          machine?.localizacao || '',
          machine?.situacaoPatrimonial || 'ativo',
          machine?.dataCompra || '',
          machine?.garantiaAte || '',
          machine?.observacoesAtivo || ''
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

  function parseMaintenance(raw, enabled) {
    if (!enabled || !raw) return 0;
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const timestamp = Date.parse(raw);
    return Number.isNaN(timestamp) ? Date.now() : timestamp;
  }

  function parseTickets(raw) {
    const text = String(raw || '').trim();
    if (!text || text === 'Nenhuma Observação') return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map(ticket => ({
          texto: ticket?.texto ?? ticket?.observacao ?? '',
          prioridade: ticket?.prioridade ?? 'Baixa',
          data: ticket?.data ?? new Date().toISOString(),
          atualizadoEm: ticket?.atualizadoEm ?? null,
          interacoes: Array.isArray(ticket?.interacoes) ? ticket.interacoes : []
        }));
      }
    } catch {}

    return text.split(' | ').map(entry => {
      const parts = entry.split(' - Prioridade: ');
      return {
        texto: parts[0]?.trim() || '',
        prioridade: parts[1]?.trim() || 'Baixa',
        data: new Date().toISOString(),
        interacoes: []
      };
    }).filter(ticket => ticket.texto);
  }

  function safeId(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) return trimmed;
    return crypto?.randomUUID?.() || `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function importFromCSV(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = String(reader.result || '').replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) throw new Error('O CSV não contém registros para importar.');

        const header = parseCsvLine(lines[0]).map(value => value.trim());
        const modern = header.includes('Chamados JSON') || header.includes('Fabricante');
        const nextSectors = [];
        const nextVisibility = [];

        lines.slice(1).forEach(line => {
          const cells = parseCsvLine(line);
          if (cells.length < 4) return;

          const sectorName = String(cells[0] || '').trim();
          if (!sectorName) return;

          const type = String(cells[1] || '').trim() || 'Equipamento';
          const name = String(cells[2] || '').trim() || 'Sem nome';
          const tag = String(cells[3] || '').trim();
          const maintenance = String(cells[4] || '').trim().toLowerCase() === 'true';
          const maintenanceStart = parseMaintenance(cells[5], maintenance);
          const user = String(cells[6] || '').trim();

          let tickets = [];
          let id = '';
          let manufacturer = '';
          let model = '';
          let location = '';
          let status = 'ativo';
          let purchaseDate = '';
          let warranty = '';
          let notes = '';

          if (modern) {
            tickets = parseTickets(cells[7]);
            id = cells[8];
            manufacturer = cells[9] || '';
            model = cells[10] || '';
            location = cells[11] || '';
            status = cells[12] || 'ativo';
            purchaseDate = cells[13] || '';
            warranty = cells[14] || '';
            notes = cells[15] || '';
          } else {
            // Compatibilidade com os CSVs antigos de 9 colunas.
            const legacyObservations = cells.length > 8 ? cells.slice(7, -1).join(';') : cells[7];
            tickets = parseTickets(legacyObservations);
            id = cells[8] || '';
          }

          let sector = nextSectors.find(item => item.nome === sectorName);
          if (!sector) {
            sector = { nome: sectorName, maquinas: [] };
            nextSectors.push(sector);
            nextVisibility.push(false);
          }

          const machine = {
            id: safeId(id),
            nome: name,
            tipo: type,
            etiqueta: tag,
            chamado: tickets,
            chamados: tickets,
            emManutencao: maintenance,
            tempoManutencao: maintenanceStart,
            usuarioResponsavel: user,
            fabricante: String(manufacturer).trim(),
            modelo: String(model).trim(),
            localizacao: String(location).trim(),
            situacaoPatrimonial: String(status).trim() || 'ativo',
            dataCompra: String(purchaseDate).trim(),
            garantiaAte: String(warranty).trim(),
            observacoesAtivo: String(notes).trim(),
            atualizadoEm: new Date().toISOString()
          };

          sector.maquinas.push(machine);
        });

        if (!nextSectors.length) throw new Error('Nenhum setor válido foi encontrado no CSV.');

        setores = nextSectors;
        setoresVisiveis = nextVisibility;
        setoresFiltradosIndices = null;
        paginaSetoresAtual = 1;
        saveSetoresAndMachines();
        renderSetores();
        window.RRN_UI?.updateOverview?.();
        alert(`Importação concluída: ${nextSectors.length} setor(es) carregado(s).`);
      } catch (error) {
        alert(`Não foi possível importar o CSV: ${error.message}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  window.importFromCSVButton = importFromCSVButton;
  window.exportToCSV = exportToCSV;
  window.importFromCSV = importFromCSV;
})();