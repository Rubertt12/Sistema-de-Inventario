(() => {
  'use strict';
  if (window.__RRN_SUPPORT_APPROVAL_MESSAGE__) return;
  window.__RRN_SUPPORT_APPROVAL_MESSAGE__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, { auth:{persistSession:true,autoRefreshToken:true} });
  if (!client) return;

  function ensureScript(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  function ensurePortalExtensions() {
    ensureScript('/js/support-collaborator-assets.js', 'data-rrn-support-collaborator-assets');
    ensureScript('/js/service-desk-sla-ui.js', 'data-rrn-service-desk-sla-ui');
  }

  function ensurePasswordGate() {
    if (document.getElementById('rrnFirstAccessPasswordGate')) return;
    const style = document.createElement('style');
    style.textContent = `
      .rrn-first-password{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:linear-gradient(145deg,rgba(8,25,34,.92),rgba(22,58,77,.94));backdrop-filter:blur(12px)}
      .rrn-first-password[hidden]{display:none!important}
      .rrn-first-password-card{width:min(520px,100%);padding:26px;border-radius:20px;background:#fff;color:#173547;box-shadow:0 30px 90px rgba(0,0,0,.35)}
      .rrn-first-password-card small{color:#2f7d78;font-size:.7rem;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.rrn-first-password-card h2{margin:6px 0 8px;font-size:1.45rem}.rrn-first-password-card p{margin:0 0 18px;color:#60727d;font-size:.86rem;line-height:1.55}
      .rrn-first-password-card label{display:block;margin:12px 0 6px;font-size:.72rem;font-weight:800;color:#38515e}.rrn-first-password-card input{width:100%;height:46px;padding:0 13px;border:1px solid #d8e3e7;border-radius:11px;background:#f8fafb;color:#173547;font:650 .86rem Inter,system-ui,sans-serif;box-sizing:border-box}.rrn-first-password-card input:focus{outline:0;border-color:#2f7d78;box-shadow:0 0 0 3px rgba(47,125,120,.14)}
      .rrn-first-password-rules{margin:13px 0;padding:11px 12px;border-radius:10px;background:#eef6f5;color:#43615f;font-size:.74rem;line-height:1.45}.rrn-first-password-error{margin:10px 0 0;padding:9px 11px;border-radius:9px;background:#fff0ee;color:#9f352d;font-size:.76rem;font-weight:700}.rrn-first-password-error[hidden]{display:none!important}
      .rrn-first-password-actions{display:flex;justify-content:flex-end;margin-top:18px}.rrn-first-password-actions button{min-height:44px;padding:0 17px;border:0;border-radius:11px;background:#2f7d78;color:#fff;font-weight:850;cursor:pointer}.rrn-first-password-actions button:disabled{opacity:.58;cursor:wait}
    `;
    document.head.appendChild(style);

    const gate = document.createElement('div');
    gate.id = 'rrnFirstAccessPasswordGate';
    gate.className = 'rrn-first-password';
    gate.hidden = true;
    gate.innerHTML = `<div class="rrn-first-password-card" role="dialog" aria-modal="true" aria-labelledby="rrnFirstPasswordTitle">
      <small>Primeiro acesso</small>
      <h2 id="rrnFirstPasswordTitle">Crie sua nova senha</h2>
      <p>A senha usada para entrar é temporária. Antes de acessar seus equipamentos e chamados, defina uma senha pessoal.</p>
      <form data-first-password-form>
        <label for="rrnNewPortalPassword">Nova senha</label>
        <input id="rrnNewPortalPassword" type="password" autocomplete="new-password" minlength="10" required>
        <label for="rrnConfirmPortalPassword">Confirmar nova senha</label>
        <input id="rrnConfirmPortalPassword" type="password" autocomplete="new-password" minlength="10" required>
        <div class="rrn-first-password-rules">Use pelo menos 10 caracteres, incluindo letra maiúscula, letra minúscula e número.</div>
        <div class="rrn-first-password-error" data-first-password-error hidden></div>
        <div class="rrn-first-password-actions"><button type="submit">Salvar nova senha</button></div>
      </form>
    </div>`;
    document.body.appendChild(gate);

    gate.querySelector('[data-first-password-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const password = document.getElementById('rrnNewPortalPassword')?.value || '';
      const confirm = document.getElementById('rrnConfirmPortalPassword')?.value || '';
      const errorBox = gate.querySelector('[data-first-password-error]');
      const button = gate.querySelector('button[type="submit"]');
      const showError = message => { errorBox.textContent = message; errorBox.hidden = !message; };

      if (password !== confirm) return showError('As duas senhas precisam ser iguais.');
      if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return showError('A senha precisa seguir os requisitos informados.');
      }

      showError('');
      button.disabled = true;
      button.textContent = 'Salvando...';
      const { data, error } = await client.functions.invoke('portal-user-access', {
        body: { action: 'change_password', password }
      });
      if (error || data?.error) {
        button.disabled = false;
        button.textContent = 'Salvar nova senha';
        return showError(data?.error || error?.message || 'Não foi possível trocar a senha.');
      }
      button.textContent = 'Senha alterada';
      setTimeout(() => location.reload(), 250);
    });
  }

  function showPasswordGate() {
    ensurePasswordGate();
    const gate = document.getElementById('rrnFirstAccessPasswordGate');
    gate.hidden = false;
    const auth = document.getElementById('supportAuthView');
    const app = document.getElementById('supportApp');
    if (auth) auth.hidden = true;
    if (app) app.hidden = true;
    setTimeout(() => document.getElementById('rrnNewPortalPassword')?.focus(), 50);
  }

  function hidePasswordGate() {
    const gate = document.getElementById('rrnFirstAccessPasswordGate');
    if (gate) gate.hidden = true;
  }

  async function sync() {
    try {
      const { data:{session} } = await client.auth.getSession();
      if (!session?.user) { hidePasswordGate(); return; }
      const { data:customer, error } = await client.from('support_customers')
        .select('status,must_change_password')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;

      if (customer?.must_change_password) {
        showPasswordGate();
        return;
      }
      hidePasswordGate();

      if (customer?.status !== 'pending') return;
      const alert = document.getElementById('supportAuthAlert');
      if (!alert) return;
      alert.hidden = false;
      alert.className = 'support-alert';
      alert.textContent = 'Seu cadastro foi recebido e está aguardando aprovação do administrador da empresa. Assim que for liberado, você poderá abrir chamados.';
    } catch (error) {
      console.warn('RRN support approval/password gate:', error);
    }
  }

  function boot() {
    ensurePortalExtensions();
    ensurePasswordGate();
    setTimeout(sync, 120);
    setTimeout(sync, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  client.auth.onAuthStateChange(() => {
    ensurePortalExtensions();
    setTimeout(sync, 120);
  });
})();