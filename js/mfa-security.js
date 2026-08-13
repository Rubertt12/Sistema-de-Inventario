(() => {
  'use strict';
  if (window.__RRN_MFA_SECURITY__) return;
  window.__RRN_MFA_SECURITY__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const $ = id => document.getElementById(id);
  if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return;

  const client = window.RRN_SUPABASE_CLIENT || window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.RRN_SUPABASE_CLIENT = client;

  let profile = null;
  let factors = [];
  let pendingFactor = null;

  function msg(text = '', type = '') {
    const el = $('securityMessage');
    if (!el) return;
    el.textContent = text;
    el.className = `security-message ${type}`.trim();
  }

  function labelFactor(factor, index) {
    return factor.friendly_name || `Aplicativo autenticador ${index + 1}`;
  }

  async function load() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return location.replace('/login.html?next=%2Fseguranca.html');

    const [{ data: p, error: profileError }, { data: factorData, error: factorError }, { data: aal, error: aalError }] = await Promise.all([
      client.from('profiles').select('user_id,tenant_id,name,email,role,status,tenants(name)').eq('user_id', session.user.id).maybeSingle(),
      client.auth.mfa.listFactors(),
      client.auth.mfa.getAuthenticatorAssuranceLevel()
    ]);
    if (profileError || !p || p.status !== 'active') return location.replace('/login.html');
    if (factorError) throw factorError;
    if (aalError) throw aalError;

    profile = p;
    factors = (factorData?.totp || []).filter(f => f.status === 'verified');

    $('securityUser').textContent = profile.name || profile.email || 'Usuário';
    $('securityTenant').textContent = profile.tenants?.name || 'Workspace';
    $('securityAal').textContent = aal?.currentLevel === 'aal2' ? 'Sessão AAL2' : 'Sessão AAL1';
    $('securityStatusText').textContent = factors.length ? 'Autenticação em dois fatores ativa' : 'Autenticação em dois fatores desativada';
    $('securityStatusHint').textContent = factors.length
      ? 'Nos novos logins, depois do e-mail e senha, o RRN exigirá o código do seu autenticador.'
      : profile.role === 'admin'
        ? '2FA é opcional, mas ações administrativas críticas podem exigir uma sessão AAL2.'
        : '2FA é opcional. Você pode ativá-lo a qualquer momento para aumentar a segurança da conta.';
    $('securityStatusBadge').textContent = factors.length ? '2FA ativo' : '2FA opcional';
    $('securityStatusBadge').className = `security-badge ${factors.length ? 'on' : 'off'}`;

    renderFactors();
  }

  function renderFactors() {
    const list = $('securityFactors');
    if (!list) return;
    if (!factors.length) {
      list.innerHTML = '<div class="security-factor"><div><strong>Nenhum autenticador cadastrado</strong><small>Você pode adicionar um aplicativo autenticador quando quiser.</small></div></div>';
      return;
    }
    list.innerHTML = factors.map((factor, index) => `
      <div class="security-factor">
        <div><strong>${labelFactor(factor, index)}</strong><small>TOTP verificado · ${factor.created_at ? new Date(factor.created_at).toLocaleDateString('pt-BR') : 'ativo'}</small></div>
        <button type="button" class="security-btn danger" data-remove-factor="${factor.id}">Remover</button>
      </div>`).join('');
    list.querySelectorAll('[data-remove-factor]').forEach(button => button.addEventListener('click', () => removeFactor(button.dataset.removeFactor)));
  }

  async function ensureAal2() {
    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === 'aal2') return true;
    if (!factors.length) return false;
    const code = prompt('Digite o código de 6 dígitos do seu aplicativo autenticador para confirmar esta ação:');
    if (!/^\d{6}$/.test(String(code || '').trim())) return false;
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factors[0].id, code: String(code).trim() });
    if (error) throw error;
    return true;
  }

  async function removeFactor(factorId) {
    if (!confirm('Remover este autenticador da sua conta? O 2FA ficará desativado se este for o último fator.')) return;
    try {
      if (!await ensureAal2()) return msg('Confirmação AAL2 necessária para remover o autenticador.', 'error');
      const { error } = await client.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      msg('Autenticador removido.', 'success');
      await client.auth.refreshSession();
      await load();
    } catch (error) { msg(error.message || 'Não foi possível remover o autenticador.', 'error'); }
  }

  async function startEnroll() {
    msg();
    try {
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: factors.length ? `RRN Backup ${factors.length + 1}` : 'RRN Manager' });
      if (error) throw error;
      pendingFactor = data;
      $('securityEnrollQr').src = data.totp.qr_code;
      $('securityEnrollSecret').textContent = data.totp.secret || '';
      $('securityEnrollCode').value = '';
      $('securityEnrollModal').hidden = false;
      setTimeout(() => $('securityEnrollCode').focus(), 0);
    } catch (error) { msg(error.message || 'Não foi possível iniciar o cadastro do autenticador.', 'error'); }
  }

  async function verifyEnroll() {
    if (!pendingFactor) return;
    const code = $('securityEnrollCode').value.trim();
    if (!/^\d{6}$/.test(code)) return msg('Digite o código de 6 dígitos.', 'error');
    const button = $('securityVerifyEnroll');
    button.disabled = true;
    try {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId: pendingFactor.id, code });
      if (error) throw error;
      $('securityEnrollModal').hidden = true;
      pendingFactor = null;
      msg('2FA ativado com sucesso. A partir do próximo login, o código será obrigatório depois da senha.', 'success');
      await load();
    } catch (error) { msg('Código inválido ou expirado. Tente novamente.', 'error'); }
    finally { button.disabled = false; }
  }

  $('securityAddFactor')?.addEventListener('click', startEnroll);
  $('securityVerifyEnroll')?.addEventListener('click', verifyEnroll);
  $('securityCancelEnroll')?.addEventListener('click', async () => {
    if (pendingFactor?.id) await client.auth.mfa.unenroll({ factorId: pendingFactor.id }).catch(() => undefined);
    $('securityEnrollModal').hidden = true;
    pendingFactor = null;
  });
  $('securityBack')?.addEventListener('click', () => history.length > 1 ? history.back() : location.replace('/dashboard.html'));

  load().catch(error => msg(error.message || 'Falha ao carregar segurança da conta.', 'error'));
})();