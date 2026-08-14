(() => {
  'use strict';
  if (window.__RRN_SYSTEM_RESET__) return;
  window.__RRN_SYSTEM_RESET__ = true;

  const client = window.RRN_GET_SUPABASE_CLIENT?.() || window.RRN_SUPABASE_CLIENT;
  if (!client) return;

  const $ = id => document.getElementById(id);
  let profile = null;

  function toast(message, type = '') {
    const el = $('settingsToast');
    if (!el) return alert(message);
    el.textContent = message;
    el.className = `settings-toast ${type}`.trim();
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  function injectStyles() {
    if (document.getElementById('rrn-system-reset-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-system-reset-style';
    style.textContent = `
      .settings-danger-zone{margin-top:18px;border-color:color-mix(in srgb,#b64949 42%,var(--rrn-border,rgba(22,58,77,.14)))!important;background:color-mix(in srgb,#b64949 4%,var(--rrn-surface,#fff))!important}
      .settings-danger-zone .settings-card-head h2{color:#a83f3f}
      .settings-danger-zone-list{display:grid;gap:6px;margin:14px 0 0;padding-left:18px;color:var(--rrn-muted,#66757F);font-size:.75rem;line-height:1.45}
      .rrn-reset-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;background:rgba(5,12,18,.62);backdrop-filter:blur(8px)}
      .rrn-reset-modal[hidden]{display:none}
      .rrn-reset-card{width:min(560px,100%);padding:24px;border:1px solid rgba(182,73,73,.32);border-radius:18px;background:var(--rrn-surface,#fff);box-shadow:0 30px 90px rgba(0,0,0,.28)}
      .rrn-reset-card h2{margin:0;color:#a83f3f;font:800 1.3rem/1.2 Manrope,Inter,sans-serif}
      .rrn-reset-card p{margin:10px 0 0;color:var(--rrn-muted,#66757F);font-size:.8rem;line-height:1.55}
      .rrn-reset-card label{display:grid;gap:7px;margin-top:18px;font-size:.72rem;font-weight:800}
      .rrn-reset-card input{min-height:44px;padding:10px 12px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:10px;background:var(--rrn-bg,#f5f7f8);color:var(--rrn-heading,#163A4D);font-weight:800;letter-spacing:.04em}
      .rrn-reset-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    if (!profile || profile.role !== 'admin') return;
    const panel = document.querySelector('[data-settings-panel="admin"]');
    if (!panel || $('rrnSystemResetCard')) return;
    injectStyles();

    const card = document.createElement('article');
    card.id = 'rrnSystemResetCard';
    card.className = 'settings-card settings-danger-zone';
    card.innerHTML = `
      <div class="settings-card-head">
        <div><h2>Zona de perigo</h2><p>Reinicie completamente os dados deste workspace e mantenha somente sua conta de Administrador.</p></div>
        <span class="settings-card-badge">IRREVERSÍVEL</span>
      </div>
      <ul class="settings-danger-zone-list">
        <li>Apaga demais usuários e colaboradores, inclusive as contas de autenticação.</li>
        <li>Apaga chamados, mensagens, ativos, setores, movimentações, manutenções e dados operacionais.</li>
        <li>Remove personalizações operacionais, bot, SLA e identidade do tenant para voltar ao estado inicial.</li>
        <li>Preserva o workspace e a conta Admin atualmente conectada.</li>
      </ul>
      <div class="settings-action-buttons" style="margin-top:16px"><button type="button" class="settings-danger-btn" id="rrnOpenSystemReset">Resetar sistema inteiro</button></div>`;
    panel.appendChild(card);

    const modal = document.createElement('div');
    modal.className = 'rrn-reset-modal';
    modal.id = 'rrnSystemResetModal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="rrn-reset-card" role="dialog" aria-modal="true" aria-labelledby="rrnResetTitle">
        <h2 id="rrnResetTitle">Reset completo do workspace</h2>
        <p>Essa ação não pode ser desfeita. Faça um backup antes se existir qualquer informação que você queira manter.</p>
        <p>Para confirmar, digite exatamente <strong>RESETAR SISTEMA</strong>.</p>
        <label>Confirmação<input id="rrnSystemResetConfirm" autocomplete="off" placeholder="RESETAR SISTEMA"></label>
        <div class="rrn-reset-actions">
          <button type="button" class="settings-ghost-btn" id="rrnCancelSystemReset">Cancelar</button>
          <button type="button" class="settings-danger-btn" id="rrnConfirmSystemReset" disabled>Apagar tudo e preservar meu Admin</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = $('rrnSystemResetConfirm');
    const confirm = $('rrnConfirmSystemReset');
    $('rrnOpenSystemReset').onclick = () => { modal.hidden = false; input.value = ''; confirm.disabled = true; setTimeout(() => input.focus(), 0); };
    $('rrnCancelSystemReset').onclick = () => { modal.hidden = true; };
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
    input.addEventListener('input', () => { confirm.disabled = input.value !== 'RESETAR SISTEMA'; });

    confirm.onclick = async () => {
      if (input.value !== 'RESETAR SISTEMA') return;
      confirm.disabled = true;
      confirm.textContent = 'Resetando...';
      try {
        const { data, error } = await client.rpc('admin_reset_current_tenant', { p_confirmation: input.value });
        if (error) throw error;
        localStorage.removeItem('usuarioLogado');
        Object.keys(localStorage).filter(k => !k.startsWith('sb-') && !k.startsWith('rrn_mfa_trusted_')).forEach(k => localStorage.removeItem(k));
        modal.hidden = true;
        toast(`Reset concluído. ${Number(data?.deleted_auth_users || 0)} conta(s) removida(s). Recarregando o ambiente...`, 'success');
        setTimeout(() => location.href = '/dashboard.html?reset=1', 1200);
      } catch (error) {
        toast(error.message || 'Não foi possível resetar o sistema.', 'error');
        confirm.disabled = false;
        confirm.textContent = 'Apagar tudo e preservar meu Admin';
      }
    };
  }

  async function boot() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;
    const { data } = await client.from('profiles').select('user_id,tenant_id,role,status').eq('user_id', session.user.id).maybeSingle();
    profile = data || null;
    if (profile?.status === 'active' && profile.role === 'admin') mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  else setTimeout(boot, 0);
})();