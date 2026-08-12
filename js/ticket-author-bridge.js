(() => {
  'use strict';
  if (window.__RRN_TICKET_AUTHOR_BRIDGE__) return;
  window.__RRN_TICKET_AUTHOR_BRIDGE__ = true;

  function currentUser() {
    const session = window.RRN_SESSION || {};
    if (session.name || session.userName || session.email || session.userId) {
      return {
        id: session.userId || '',
        nome: session.name || session.userName || session.email || 'Usuário',
        email: session.email || ''
      };
    }
    try {
      const legacy = JSON.parse(localStorage.getItem('usuarioLogado') || '{}');
      return {
        id: legacy.id || '',
        nome: legacy.nome || legacy.name || legacy.email || 'Usuário',
        email: legacy.email || ''
      };
    } catch {
      return { id: '', nome: 'Usuário', email: '' };
    }
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

  function ticketList(machine) {
    if (!machine) return [];
    if (Array.isArray(machine.chamados)) return machine.chamados;
    if (Array.isArray(machine.chamado)) return machine.chamado;
    return [];
  }

  function snapshot() {
    const tickets = new Set();
    const interactions = new Set();
    inventory().forEach(sector => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach(machine => {
        ticketList(machine).forEach(ticket => {
          if (ticket && typeof ticket === 'object') tickets.add(ticket);
          (Array.isArray(ticket?.interacoes) ? ticket.interacoes : []).forEach(item => {
            if (item && typeof item === 'object') interactions.add(item);
          });
        });
      });
    });
    return { tickets, interactions };
  }

  function persistIfChanged(changed) {
    if (!changed) return;
    try {
      if (typeof saveSetoresAndMachines === 'function') saveSetoresAndMachines();
      else localStorage.setItem('setores', JSON.stringify(inventory()));
    } catch (error) {
      console.warn('RRN Manager: não foi possível persistir o autor do chamado.', error);
    }
  }

  function fillNewAuthors(before) {
    const user = currentUser();
    let changed = false;

    inventory().forEach(sector => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach(machine => {
        ticketList(machine).forEach(ticket => {
          if (!ticket || typeof ticket !== 'object') return;

          if (!before.tickets.has(ticket) && !(ticket.autor || ticket.criadoPor || ticket.usuario || ticket.responsavel)) {
            ticket.autor = user.nome;
            ticket.autorId = user.id;
            ticket.autorEmail = user.email;
            changed = true;
          }

          (Array.isArray(ticket.interacoes) ? ticket.interacoes : []).forEach(item => {
            if (!item || typeof item !== 'object') return;
            if (!before.interactions.has(item) && !(item.autor || item.criadoPor || item.usuario || item.responsavel)) {
              item.autor = user.nome;
              item.autorId = user.id;
              item.autorEmail = user.email;
              changed = true;
            }
          });
        });
      });
    });

    persistIfChanged(changed);
  }

  function wrap(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__rrnAuthorWrapped) return;

    const wrapped = function(...args) {
      const before = snapshot();
      const result = original.apply(this, args);
      fillNewAuthors(before);
      return result;
    };
    wrapped.__rrnAuthorWrapped = true;
    wrapped.__rrnOriginal = original;
    window[name] = wrapped;
  }

  function install() {
    wrap('saveObservation');
    wrap('salvarInteracao');
  }

  install();
  window.addEventListener('rrn:session-ready', install);
})();
