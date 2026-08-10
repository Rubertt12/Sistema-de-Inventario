(() => {
  'use strict';

  let panel = null;
  let checking = false;

  function role() {
    return window.RRN_SESSION?.role || (() => {
      try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || null; }
      catch { return null; }
    })();
  }

  function ensurePanel() {
    if (panel && document.body.contains(panel)) return panel;
    const right = document.querySelector('#configModal .modal-right');
    if (!right) return null;

    panel = document.createElement('section');
    panel.className = 'rrn-backend-panel';
    panel.innerHTML = `
      <div class="rrn-backend-panel-header">
        <div>
          <strong>Backend e banco relacional</strong>
          <small>Verifica Supabase, tabelas de ativos e a disponibilidade da migração do inventário atual.</small>
        </div>
        <span class="rrn-backend-badge loading" data-status>Verificando</span>
      </div>
      <div class="rrn-backend-actions">
        <button type="button" class="rrn-backend-check" data-check>Verificar novamente</button>
        <button type="button" class="rrn-backend-migrate admin-only" data-migrate>👥 Migrar inventário legado</button>
      </div>
      <div class="rrn-backend-result" data-result>O sistema ainda está usando a camada de compatibilidade enquanto valida o backend.</div>`;

    right.appendChild(panel);
    panel.querySelector('[data-check]').addEventListener('click', check);
    panel.querySelector('[data-migrate]').addEventListener('click', migrate);
    refreshRole();
    return panel;
  }

  function refreshRole() {
    const p = ensurePanel();
    if (!p) return;
    const button = p.querySelector('[data-migrate]');
    if (button) button.style.display = role() === 'admin' ? '' : 'none';
  }

  function setState(kind, label, message) {
    const p = ensurePanel();
    if (!p) return;
    const badge = p.querySelector('[data-status]');
    badge.className = `rrn-backend-badge ${kind}`;
    badge.textContent = label;
    p.querySelector('[data-result]').textContent = message;
    const migrate = p.querySelector('[data-migrate]');
    if (migrate) migrate.disabled = kind !== 'ready' || role() !== 'admin';
  }

  async function check() {
    if (checking) return;
    checking = true;
    setState('loading', 'Verificando', 'Consultando a configuração atual do Supabase e as tabelas relacionais...');
    try {
      if (!window.RRN_DB) {
        setState('offline', 'Não configurado', 'Supabase ainda não está conectado neste ambiente. O inventário local continua funcionando normalmente.');
        return;
      }
      const status = await window.RRN_DB.readiness();
      if (!status.configured) {
        setState('offline', 'Não configurado', status.reason || 'Supabase ainda não está configurado.');
      } else if (!status.relational) {
        setState('partial', 'Parcial', status.reason || 'Supabase conectado, mas as tabelas relacionais ainda não estão instaladas.');
      } else {
        setState('ready', 'Pronto', 'Supabase conectado e modelo relacional de setores, ativos, movimentações, manutenção e auditoria disponível.');
      }
    } catch (error) {
      setState('offline', 'Falha', error.message || 'Não foi possível validar o backend.');
    } finally {
      checking = false;
    }
  }

  async function migrate() {
    if (role() !== 'admin') return;
    const ok = confirm('Migrar o inventário atual para as tabelas relacionais? A operação foi criada para evitar duplicações por legacy_key.');
    if (!ok) return;

    const button = ensurePanel()?.querySelector('[data-migrate]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Migrando...';
    }

    try {
      const result = await window.RRN_DB.migrateLegacyInventory();
      const sectors = result?.sectors_created ?? 0;
      const assets = result?.assets_created ?? 0;
      const existing = result?.assets_existing ?? 0;
      setState('ready', 'Migrado', `Migração concluída: ${sectors} setor(es) criado(s), ${assets} ativo(s) criado(s) e ${existing} ativo(s) já existentes ignorados.`);
    } catch (error) {
      setState('partial', 'Erro na migração', error.message || 'Não foi possível migrar o inventário.');
    } finally {
      if (button) button.textContent = '👥 Migrar inventário legado';
      refreshRole();
    }
  }

  function boot() {
    ensurePanel();
    refreshRole();
    setTimeout(check, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('load', () => setTimeout(boot, 120));
})();
