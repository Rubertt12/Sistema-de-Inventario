(() => {
  'use strict';

  if (window.__RRN_RESPONSIBLE_AUTOCOMPLETE__) return;
  window.__RRN_RESPONSIBLE_AUTOCOMPLETE__ = true;

  const DATALIST_ID = 'rrnResponsibleSuggestions';
  const MAX_NAMES = 300;

  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const normalize = value => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  function tenantScope() {
    const session = window.RRN_SESSION || {};
    if (session.tenantId) return String(session.tenantId);
    try {
      const compat = JSON.parse(localStorage.getItem('usuarioLogado') || '{}');
      return String(compat.tenant_id || compat.tenantId || compat.tenant || 'default');
    } catch {
      return 'default';
    }
  }

  function storageKey() {
    return `rrn_responsible_names:${tenantScope()}`;
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

  function inventoryNames() {
    const names = [];
    inventory().forEach(sector => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach(asset => {
        const name = clean(asset?.usuarioResponsavel || asset?.usuario || asset?.responsavel);
        if (name) names.push(name);
      });
    });
    return names;
  }

  function savedNames() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey()) || '[]');
      return Array.isArray(parsed) ? parsed.map(clean).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function uniqueNames(values) {
    const seen = new Set();
    const result = [];
    values.forEach(value => {
      const name = clean(value);
      const key = normalize(name);
      if (!name || !key || seen.has(key)) return;
      seen.add(key);
      result.push(name);
    });
    return result;
  }

  function allNames() {
    // Nomes digitados recentemente primeiro; os já existentes no inventário completam a lista.
    return uniqueNames([...savedNames(), ...inventoryNames()]).slice(0, MAX_NAMES);
  }

  function remember(value) {
    const name = clean(value);
    if (name.length < 2) return;

    const current = savedNames().filter(item => normalize(item) !== normalize(name));
    const next = [name, ...current].slice(0, MAX_NAMES);
    try {
      localStorage.setItem(storageKey(), JSON.stringify(next));
    } catch (error) {
      console.warn('RRN Manager: não foi possível salvar a sugestão de responsável.', error);
    }
    refreshList();
  }

  function ensureList() {
    let list = document.getElementById(DATALIST_ID);
    if (list) return list;
    list = document.createElement('datalist');
    list.id = DATALIST_ID;
    document.body.appendChild(list);
    return list;
  }

  function refreshList() {
    const list = ensureList();
    const fragment = document.createDocumentFragment();
    allNames().forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      fragment.appendChild(option);
    });
    list.replaceChildren(fragment);
  }

  function labelText(input) {
    const parts = [];
    if (input.id) {
      const explicit = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (explicit) parts.push(explicit.textContent || '');
    }
    const wrapping = input.closest('label');
    if (wrapping) parts.push(wrapping.textContent || '');
    const field = input.closest('.rrn-asset-field, .form-group, .field, .input-group, .modal-content');
    const nearby = field?.querySelector?.('label');
    if (nearby) parts.push(nearby.textContent || '');
    return parts.join(' ');
  }

  function isResponsibleField(input) {
    if (!(input instanceof HTMLInputElement)) return false;
    if (!['text', 'search', ''].includes(input.type)) return false;
    if (input.id === 'searchInput' || input.closest('.rrn-transfer-dialog')) return false;

    const direct = [
      input.id,
      input.name,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.dataset?.field
    ].filter(Boolean).join(' ');

    const context = `${direct} ${labelText(input)}`;
    const normalized = normalize(context);

    if (/responsavel|responsável/.test(context.toLowerCase())) return true;
    if (/usuario.*respons|usuário.*respons/.test(normalized)) return true;

    const known = normalize(input.id || input.name || '');
    return ['usuarioresponsavel', 'responsavel', 'usuariomaquina', 'usuarioresponsavelmaquina'].includes(known);
  }

  function attach(input) {
    if (!isResponsibleField(input) || input.dataset.rrnResponsibleAutocomplete === '1') return;
    input.dataset.rrnResponsibleAutocomplete = '1';
    input.setAttribute('list', DATALIST_ID);
    input.setAttribute('autocomplete', 'off');
    input.title ||= 'Digite para buscar responsáveis já utilizados';

    const commit = () => remember(input.value);
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    input.addEventListener('focus', refreshList);
  }

  function scan(root = document) {
    refreshList();
    if (root instanceof HTMLInputElement) attach(root);
    root.querySelectorAll?.('input').forEach(attach);
  }

  function boot() {
    scan();

    document.addEventListener('focusin', event => {
      if (event.target instanceof HTMLInputElement) attach(event.target);
    });

    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (node instanceof Element) scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('storage', event => {
      if (event.key === 'setores' || event.key === storageKey()) refreshList();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.RRN_RESPONSIBLE_AUTOCOMPLETE = Object.freeze({
    remember,
    names: allNames,
    refresh: () => scan()
  });
})();
