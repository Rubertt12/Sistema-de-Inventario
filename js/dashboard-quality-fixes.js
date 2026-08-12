(() => {
  'use strict';
  if (window.__RRN_DASHBOARD_QUALITY_FIXES__) return;
  window.__RRN_DASHBOARD_QUALITY_FIXES__ = true;

  function currentRole() {
    if (window.RRN_SESSION?.role) return window.RRN_SESSION.role;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || null; }
    catch { return null; }
  }

  function canOperate() {
    const role = currentRole();
    return role == null || role === 'admin' || role === 'operador';
  }

  function isAdmin() {
    return currentRole() === 'admin';
  }

  function refreshDashboard() {
    try { window.renderSetores?.(); } catch {}
    try { window.RRN_UI?.updateOverview?.(); } catch {}
    try { window.RRN_TABS?.renderHome?.(); } catch {}
    setTimeout(() => {
      try { window.RRN_UI?.updateOverview?.(); } catch {}
      try { window.RRN_TABS?.renderHome?.(); } catch {}
      enhanceDashboard();
    }, 80);
  }

  function forceCategoryChooser(sectorIndex) {
    const index = Number(sectorIndex);
    if (!Number.isInteger(index) || index < 0) return;

    try {
      if (typeof setoresVisiveis !== 'undefined') setoresVisiveis[index] = true;
    } catch {}

    try { window.RRN_SECTOR_CATEGORIES?.back?.(index); } catch {}

    [0, 40, 120].forEach(delay => setTimeout(() => {
      const card = document.querySelector(`.rrn-setor-card[data-setor-index="${index}"]`);
      if (!card) return;

      card.querySelector('.rrn-category-backbar')?.remove();
      const shell = card.querySelector(`[data-sector-category-shell="${index}"]`);
      if (shell) {
        shell.hidden = false;
        shell.style.removeProperty('display');
      }

      const list = card.querySelector(`#maquinas-${index}`);
      if (list) {
        list.style.display = 'grid';
        list.querySelectorAll('.rrn-machine-item').forEach(item => { item.style.display = 'none'; });
      }
    }, delay));
  }

  // Usa window/capture para interceptar antes dos handlers legados e impedir que
  // "Voltar às categorias" feche o setor por engano.
  window.addEventListener('click', event => {
    const button = event.target?.closest?.('.rrn-category-back-btn');
    if (!button) return;
    const card = button.closest('.rrn-setor-card');
    const sectorIndex = Number(card?.dataset?.setorIndex);
    if (!Number.isInteger(sectorIndex)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    forceCategoryChooser(sectorIndex);
  }, true);

  function findHomePanel(title) {
    return [...document.querySelectorAll('.rrn-home-panel')].find(panel =>
      panel.querySelector('.rrn-home-panel-head h3')?.textContent?.trim() === title
    ) || null;
  }

  function clearRecentActivity() {
    if (!canOperate()) return;
    if (!confirm('Limpar toda a atividade recente deste ambiente?\n\nSetores e equipamentos serão mantidos.')) return;
    localStorage.setItem('asset_history', '[]');
    refreshDashboard();
  }

  function enhanceActivityPanel() {
    const panel = findHomePanel('Atividade recente');
    if (!panel || !canOperate()) return;
    const head = panel.querySelector('.rrn-home-panel-head');
    if (!head || head.querySelector('[data-rrn-clear-activity]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.rrnClearActivity = '1';
    button.className = 'rrn-dashboard-mini-action';
    button.textContent = 'Limpar atividade';
    button.title = 'Apaga apenas o histórico exibido em Atividade recente';
    button.addEventListener('click', clearRecentActivity);
    head.appendChild(button);
  }

  function clarifyUnassignedIndicator() {
    document.querySelectorAll('.rrn-health-item').forEach(item => {
      const strong = item.querySelector('.rrn-health-copy strong');
      const small = item.querySelector('.rrn-health-copy small');
      if (!strong || !small) return;
      if (/sem responsável/i.test(strong.textContent || '')) {
        small.textContent = 'Ativos sem responsável vinculado';
        item.title = 'Conta equipamentos cujo campo Usuário responsável está vazio.';
      }
    });
  }

  function resetInventoryData() {
    if (!isAdmin()) return;
    const first = confirm(
      'Zerar os dados do inventário deste ambiente?\n\n' +
      'Serão apagados setores, equipamentos, chamados, atividade recente e lixeira.\n' +
      'Usuários, login, empresa, tema e configurações serão preservados.'
    );
    if (!first) return;

    const code = prompt('Para confirmar, digite ZERAR:');
    if (String(code || '').trim().toUpperCase() !== 'ZERAR') {
      alert('Operação cancelada. Nenhum dado foi apagado.');
      return;
    }

    const emptyKeys = ['setores', 'chamados', 'asset_history', 'asset_trash'];
    emptyKeys.forEach(key => localStorage.setItem(key, '[]'));

    try { if (typeof setores !== 'undefined') setores = []; } catch {}
    try { if (typeof setoresVisiveis !== 'undefined') setoresVisiveis = []; } catch {}
    try { if (typeof setoresFiltradosIndices !== 'undefined') setoresFiltradosIndices = null; } catch {}

    refreshDashboard();
    alert('Dados do inventário zerados. Usuários e configurações foram preservados.');
  }

  function enhanceSettings() {
    const modal = document.getElementById('configModal');
    if (!modal || !isAdmin()) return;
    if (modal.querySelector('[data-rrn-reset-inventory]')) return;

    const area = document.createElement('section');
    area.className = 'rrn-danger-zone admin-only';
    area.innerHTML = `
      <div>
        <strong>Zerar dados do inventário</strong>
        <small>Remove setores, equipamentos, chamados, histórico e lixeira. Usuários e configurações permanecem.</small>
      </div>
      <button type="button" class="rrn-danger-zone-btn" data-rrn-reset-inventory>Zerar inventário</button>`;

    const right = modal.querySelector('.modal-right') || modal;
    right.appendChild(area);
    area.querySelector('[data-rrn-reset-inventory]')?.addEventListener('click', resetInventoryData);
  }

  function injectStyles() {
    if (document.getElementById('rrn-dashboard-quality-fixes-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-dashboard-quality-fixes-style';
    style.textContent = `
      .rrn-dashboard-mini-action{margin-left:auto;min-height:30px;padding:6px 9px;border:1px solid var(--rrn-border,rgba(22,58,77,.16));border-radius:8px;background:var(--rrn-surface-2,#fff);color:var(--rrn-heading,#163A4D);font:700 .62rem/1 Inter,system-ui,sans-serif;cursor:pointer}
      .rrn-dashboard-mini-action:hover{background:var(--rrn-surface-soft,#EEF2F3)}
      .rrn-danger-zone{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:22px;padding:14px;border:1px solid color-mix(in srgb,var(--rrn-danger,#b94747) 30%,var(--rrn-border,transparent));border-radius:12px;background:color-mix(in srgb,var(--rrn-danger,#b94747) 6%,var(--rrn-surface,#fff))}
      .rrn-danger-zone>div{min-width:0}.rrn-danger-zone strong,.rrn-danger-zone small{display:block}.rrn-danger-zone strong{color:var(--rrn-danger,#b94747);font-size:.8rem}.rrn-danger-zone small{margin-top:4px;color:var(--rrn-muted,#66757F);font-size:.68rem;line-height:1.4}
      .rrn-danger-zone-btn{flex:0 0 auto;min-height:34px;padding:8px 11px;border:1px solid var(--rrn-danger,#b94747)!important;border-radius:9px!important;background:transparent!important;color:var(--rrn-danger,#b94747)!important;font-weight:800!important;cursor:pointer}
      .rrn-danger-zone-btn:hover{background:color-mix(in srgb,var(--rrn-danger,#b94747) 10%,transparent)!important}
      @media(max-width:620px){.rrn-danger-zone{align-items:stretch;flex-direction:column}.rrn-danger-zone-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function enhanceDashboard() {
    clarifyUnassignedIndicator();
    enhanceActivityPanel();
    enhanceSettings();
  }

  function boot() {
    injectStyles();
    enhanceDashboard();
    const root = document.body;
    if (root) {
      let scheduled = false;
      new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          enhanceDashboard();
        });
      }).observe(root, { childList: true, subtree: true });
    }
  }

  window.RRN_DASHBOARD_DATA = Object.freeze({
    clearRecentActivity,
    resetInventoryData,
    forceCategoryChooser
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
