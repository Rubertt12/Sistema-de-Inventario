(() => {
  'use strict';
  if (window.__RRN_PUBLIC_REGISTRATION__) return;
  window.__RRN_PUBLIC_REGISTRATION__ = true;

  const $ = id => document.getElementById(id);
  const form = $('formRegister');
  if (!form) return;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.RRN_SUPABASE_CLIENT || window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  if (client) window.RRN_SUPABASE_CLIENT = client;

  function setMessage(text, type = '') {
    const el = $('registerMsg');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('error', 'success');
    if (type) el.classList.add(type);
  }

  function setBusy(busy) {
    const button = $('registerButton');
    if (!button) return;
    button.disabled = busy;
    button.querySelector('span')?.replaceChildren(document.createTextNode(busy ? 'Criando acesso...' : 'Criar acesso'));
    if (!button.querySelector('span')) button.textContent = busy ? 'Criando acesso...' : 'Criar acesso';
  }

  function showConfirmation(email) {
    if (window.RRN_EMAIL_CONFIRMATION?.show) {
      window.RRN_EMAIL_CONFIRMATION.show(email, 'signup');
      return;
    }
    if ($('loginEmail')) $('loginEmail').value = email;
    $('tabLogin')?.click();
    const msg = $('loginMsg');
    if (msg) {
      msg.textContent = 'Cadastro criado. Confirme seu e-mail para continuar.';
      msg.classList.remove('error');
      msg.classList.add('success');
    }
  }

  async function showPendingIfNeeded() {
    if (!client) return false;
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return false;
    const { data } = await client.from('pending_registrations')
      .select('user_id,name,email,status,requested_at')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!data || data.status !== 'pending') return false;
    await client.auth.signOut().catch(() => undefined);
    showPendingPanel(data.email || session.user.email || '');
    return true;
  }

  function ensurePendingPanel() {
    if ($('formRegistrationPending')) return;
    form.insertAdjacentHTML('afterend', `
      <section id="formRegistrationPending" class="auth-form rrn-registration-pending" hidden>
        <div class="rrn-pending-icon">⏳</div>
        <div class="rrn-pending-copy">
          <strong>Cadastro aguardando liberação</strong>
          <p>Seu e-mail já foi validado. Agora o Administrador Geral precisa definir o tipo do seu acesso antes do primeiro uso.</p>
          <span id="pendingRegistrationEmail" class="rrn-pending-email"></span>
          <small>Depois da liberação, volte e entre normalmente com seu e-mail e senha.</small>
        </div>
        <button type="button" class="btn-primary" id="pendingBackToLogin">Voltar para o login</button>
      </section>`);
    const style = document.createElement('style');
    style.textContent = `
      .rrn-registration-pending{display:none;gap:14px;text-align:center}.rrn-registration-pending.active{display:grid}.rrn-pending-icon{width:58px;height:58px;margin:0 auto;display:grid;place-items:center;border-radius:18px;background:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 10%,var(--rrn-surface,#fff));font-size:1.5rem}.rrn-pending-copy{display:grid;gap:8px}.rrn-pending-copy strong{font:800 1.04rem Manrope,Inter,sans-serif;color:var(--rrn-heading,#163A4D)}.rrn-pending-copy p,.rrn-pending-copy small{margin:0;color:var(--rrn-muted,#66757F);line-height:1.5}.rrn-pending-copy p{font-size:.83rem}.rrn-pending-copy small{font-size:.73rem}.rrn-pending-email{padding:9px 11px;border-radius:10px;background:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 7%,var(--rrn-surface,#fff));font-weight:800;color:var(--rrn-heading,#163A4D);word-break:break-word}`;
    document.head.appendChild(style);
    $('pendingBackToLogin')?.addEventListener('click', () => {
      const panel = $('formRegistrationPending');
      if (panel) { panel.classList.remove('active'); panel.hidden = true; }
      document.querySelector('.auth-tabs')?.removeAttribute('hidden');
      $('tabLogin')?.click();
    });
  }

  function showPendingPanel(email) {
    ensurePendingPanel();
    document.querySelectorAll('.auth-form').forEach(el => el.classList.remove('active'));
    const panel = $('formRegistrationPending');
    if (panel) { panel.hidden = false; panel.classList.add('active'); }
    const tabs = document.querySelector('.auth-tabs');
    if (tabs) tabs.hidden = true;
    if ($('authTitle')) $('authTitle').textContent = 'Aguardando liberação';
    if ($('authSubtitle')) $('authSubtitle').textContent = 'Seu cadastro está em análise pelo Administrador Geral.';
    if ($('pendingRegistrationEmail')) $('pendingRegistrationEmail').textContent = email;
  }

  function observePendingLogin() {
    const msg = $('loginMsg');
    if (!msg) return;
    const inspect = async () => {
      if (!/perfil ainda não disponível|não foi possível carregar seu perfil/i.test(msg.textContent || '')) return;
      await showPendingIfNeeded().catch(() => undefined);
    };
    new MutationObserver(inspect).observe(msg, { childList: true, characterData: true, subtree: true });
  }

  ensurePendingPanel();
  observePendingLogin();
  setTimeout(() => showPendingIfNeeded().catch(() => undefined), 0);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!client) return setMessage('Serviço de autenticação indisponível.', 'error');

    const name = $('registerName')?.value.trim();
    const email = $('registerEmail')?.value.trim().toLowerCase();
    const password = $('registerPassword')?.value || '';
    const inviteCode = $('registerInvite')?.value.trim() || '';

    if (!name || !email || password.length < 8) {
      return setMessage('Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.', 'error');
    }
    if (!$('acceptTerms')?.checked) {
      return setMessage('Confirme os dados para solicitar seu acesso.', 'error');
    }

    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/login.html`,
          data: {
            name,
            invite_code: inviteCode,
            account_type: 'pending',
            organization_name: '',
            store_name: ''
          }
        }
      });
      if (error) throw error;

      if (data.session) await client.auth.signOut().catch(() => undefined);
      form.reset();
      showConfirmation(email);
    } catch (error) {
      setMessage(error?.message || 'Não foi possível criar o acesso.', 'error');
    } finally {
      setBusy(false);
    }
  }, true);
})();