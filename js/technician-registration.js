(() => {
  'use strict';
  if (window.__RRN_TECHNICIAN_REGISTRATION__) return;
  window.__RRN_TECHNICIAN_REGISTRATION__ = true;

  const $ = id => document.getElementById(id);
  const form = $('formRegister');
  if (!form) return;

  const style = document.createElement('style');
  style.textContent = `
    .rrn-account-type{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:2px 0 12px}.rrn-account-option{position:relative;display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--rrn-border,rgba(22,58,77,.18));border-radius:13px;background:var(--rrn-surface,#fff);cursor:pointer;transition:.18s ease}.rrn-account-option:hover{border-color:var(--rrn-secondary,#2F7D78)}.rrn-account-option input{margin-top:3px}.rrn-account-option strong{display:block;color:var(--rrn-heading,#163A4D);font-size:.86rem}.rrn-account-option small{display:block;margin-top:3px;color:var(--rrn-muted,#66757F);font-size:.72rem;line-height:1.35}.rrn-account-option:has(input:checked){border-color:var(--rrn-secondary,#2F7D78);box-shadow:0 0 0 2px color-mix(in srgb,var(--rrn-secondary,#2F7D78) 12%,transparent);background:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 5%,var(--rrn-surface,#fff))}.rrn-registration-fields[hidden]{display:none!important}.rrn-tech-note{padding:10px 12px;border-radius:11px;background:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 8%,var(--rrn-surface,#fff));color:var(--rrn-muted,#66757F);font-size:.75rem;line-height:1.45}.rrn-tech-note strong{color:var(--rrn-heading,#163A4D)}@media(max-width:620px){.rrn-account-type{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const accountRadios = [...document.querySelectorAll('input[name="registerAccountType"]')];
  const companyFields = $('companyRegistrationFields');
  const technicianFields = $('technicianRegistrationFields');

  function selectedType() {
    return accountRadios.find(r => r.checked)?.value || 'company';
  }

  function syncMode() {
    const technician = selectedType() === 'technician_store';
    if (companyFields) companyFields.hidden = technician;
    if (technicianFields) technicianFields.hidden = !technician;
    const org = $('registerOrganization');
    const invite = $('registerInvite');
    if (technician) {
      if (org) org.value = '';
      if (invite) invite.value = '';
    }
  }

  accountRadios.forEach(r => r.addEventListener('change', syncMode));
  syncMode();

  const cfg = window.RRN_SUPABASE || {};
  const client = window.RRN_SUPABASE_CLIENT || window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });
  if (client) window.RRN_SUPABASE_CLIENT = client;

  function setRegisterMessage(text, type='') {
    const el = $('registerMsg');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('error','success');
    if (type) el.classList.add(type);
  }

  async function waitProfile(userId) {
    let last = null;
    for (let i=0;i<8;i++) {
      const { data, error } = await client.from('profiles')
        .select('user_id,tenant_id,name,email,role,status,tenants(name,workspace_type)')
        .eq('user_id',userId).maybeSingle();
      if (!error && data) return data;
      last = error;
      await new Promise(r => setTimeout(r,200*(i+1)));
    }
    throw last || new Error('Perfil ainda não disponível.');
  }

  form.addEventListener('submit', async event => {
    if (selectedType() !== 'technician_store') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!client) return setRegisterMessage('Serviço de autenticação indisponível.','error');

    const name = $('registerName')?.value.trim();
    const email = $('registerEmail')?.value.trim().toLowerCase();
    const password = $('registerPassword')?.value || '';
    const storeName = $('registerStoreName')?.value.trim() || '';
    if (!name || !email || password.length < 8) return setRegisterMessage('Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.','error');
    if (!$('acceptTerms')?.checked) return setRegisterMessage('Confirme que você está autorizado a criar este ambiente.','error');

    const button = $('registerButton');
    const original = button?.textContent || 'Criar acesso';
    if (button) { button.disabled = true; button.textContent = 'Criando sua loja...'; }
    setRegisterMessage('');

    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/login.html`,
          data: {
            name,
            account_type: 'technician_store',
            store_name: storeName,
            organization_name: '',
            invite_code: ''
          }
        }
      });
      if (error) throw error;

      if (data.session?.user) {
        const profile = await waitProfile(data.session.user.id);
        localStorage.setItem('usuarioLogado', JSON.stringify({
          id: profile.user_id,
          nome: profile.name || email,
          email: profile.email || email,
          perfil: profile.role,
          tenant_id: profile.tenant_id,
          tenant: profile.tenants?.name || storeName || 'Minha loja'
        }));
        location.replace('/loja.html');
        return;
      }

      form.reset();
      syncMode();
      if ($('loginEmail')) $('loginEmail').value = email;
      $('tabLogin')?.click();
      const loginMsg = $('loginMsg');
      if (loginMsg) {
        loginMsg.textContent = 'Conta de Técnico/Vendedor criada. Confirme seu e-mail e depois entre normalmente.';
        loginMsg.classList.remove('error');
        loginMsg.classList.add('success');
      }
    } catch (error) {
      setRegisterMessage(error?.message || 'Não foi possível criar o perfil Técnico/Vendedor.','error');
    } finally {
      if (button) { button.disabled = false; button.textContent = original; }
    }
  }, true);
})();