(() => {
  'use strict';
  if (window.__RRN_SECURITY_CENTER_V2__) return;
  window.__RRN_SECURITY_CENTER_V2__ = true;
  if (!/configuracoes\.html$/i.test(location.pathname)) return;

  const $ = id => document.getElementById(id);
  const state = { headersOk: false, session: null, verifiedFactors: 0, aal: 'aal1' };

  function client() { return window.RRN_SUPABASE_CLIENT || null; }
  function ctx() {
    const session = window.RRN_SESSION || {};
    let local = {};
    try { local = JSON.parse(localStorage.getItem('usuarioLogado') || '{}') || {}; } catch {}
    return {
      userId: session.userId || local.id || null,
      role: session.role || local.perfil || local.role || '',
      tenantId: session.tenantId || local.tenant_id || null,
      tenantName: session.tenantName || local.tenant || 'Workspace'
    };
  }
  function isAdmin() { return String(ctx().role).toLowerCase() === 'admin'; }
  function toast(message, error = false) {
    const el = $('settingsToast');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3000);
  }
  function icon(paths) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths.map(d => `<path d="${d}"></path>`).join('')}</svg>`;
  }
  const icons = {
    shield: icon(['M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z','m9 12 2 2 4-4']),
    lock: icon(['M6 10V8a6 6 0 0 1 12 0v2','M5 10h14v11H5z','M12 14v3']),
    globe: icon(['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M3 12h18','M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3z']),
    building: icon(['M4 21V4h10v17','M14 9h6v12','M8 8h2','M8 12h2','M8 16h2']),
    device: icon(['M4 5h16v11H4z','M8 20h8','M12 16v4']),
    clock: icon(['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M12 7v5l3 2'])
  };

  function ensureUi() {
    const securityPanel = document.querySelector('[data-settings-panel="security"]');
    if (securityPanel && !$('settingsSecurityOverview')) {
      const heading = securityPanel.querySelector('.settings-page-heading');
      const overview = document.createElement('article');
      overview.className = 'settings-card settings-security-overview';
      overview.id = 'settingsSecurityOverview';
      overview.innerHTML = `
        <div class="settings-card-head">
          <div><h2>Postura de segurança</h2><p>Resumo técnico da proteção aplicada à sua sessão e ao navegador.</p></div>
          <span class="settings-card-badge settings-card-badge-ok" id="securityPostureBadge">Verificando</span>
        </div>
        <div class="settings-security-overview-grid">
          <div class="settings-security-score">
            <div class="settings-security-score-ring" id="securityScoreRing" style="--security-score:0"><strong id="securityScoreValue">0</strong></div>
            <strong id="securityScoreLabel">Analisando</strong>
            <small>Quanto maior, melhor a proteção desta sessão.</small>
          </div>
          <div class="settings-security-checks">
            <div class="settings-security-check"><span class="settings-security-check-icon">${icons.lock}</span><div class="settings-security-check-copy"><strong>Sessão autenticada</strong><small id="securitySessionDetail">Validando sessão...</small></div><span class="settings-security-state warn" id="securitySessionState">Verificando</span></div>
            <div class="settings-security-check"><span class="settings-security-check-icon">${icons.shield}</span><div class="settings-security-check-copy"><strong>Autenticação em 2 fatores</strong><small id="securityMfaDetail">Consultando fatores...</small></div><span class="settings-security-state warn" id="securityMfaState">Verificando</span></div>
            <div class="settings-security-check"><span class="settings-security-check-icon">${icons.globe}</span><div class="settings-security-check-copy"><strong>Proteção HTTP</strong><small id="securityHeadersDetail">Validando HTTPS e headers...</small></div><span class="settings-security-state warn" id="securityHeadersState">Verificando</span></div>
            <div class="settings-security-check"><span class="settings-security-check-icon">${icons.building}</span><div class="settings-security-check-copy"><strong>Isolamento do workspace</strong><small id="securityTenantDetail">Validando tenant...</small></div><span class="settings-security-state warn" id="securityTenantState">Verificando</span></div>
          </div>
        </div>`;
      heading?.insertAdjacentElement('afterend', overview);
    }

    if (securityPanel && !$('settingsSessionSecurityCard')) {
      const currentSessionCard = $('logoutSettingsBtn')?.closest('.settings-card');
      const card = document.createElement('article');
      card.className = 'settings-card';
      card.id = 'settingsSessionSecurityCard';
      card.innerHTML = `
        <div class="settings-card-head"><div><h2>Sessões e dispositivo</h2><p>Controle acessos ativos e reduza o risco de uma sessão esquecida em outro computador.</p></div><span class="settings-card-badge">Sessão</span></div>
        <div class="settings-security-session-grid">
          <div class="settings-security-device">
            <span>Dispositivo atual</span>
            <strong id="securityDeviceName">Identificando...</strong>
            <small id="securitySessionExpires">Consultando validade da sessão...</small>
          </div>
          <div class="settings-security-controls">
            <div class="settings-security-control-row">
              <div class="settings-security-control-copy"><strong>Bloqueio por inatividade</strong><small>Encerra apenas esta sessão após o período sem interação.</small></div>
              <select id="securityIdleTimeout" aria-label="Tempo para bloqueio por inatividade">
                <option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option><option value="0">Desativado</option>
              </select>
            </div>
            <div class="settings-security-actions-row">
              <button type="button" class="settings-ghost-btn" id="securityLogoutOthers">Encerrar outras sessões</button>
              <button type="button" class="settings-danger-solid" id="securityLogoutAll">Encerrar todas as sessões</button>
            </div>
          </div>
        </div>`;
      currentSessionCard?.insertAdjacentElement('beforebegin', card);
      if ($('logoutSettingsBtn')) $('logoutSettingsBtn').textContent = 'Sair deste dispositivo';
    }

    const dataPanel = document.querySelector('[data-settings-panel="data"]');
    if (dataPanel && isAdmin() && !$('settingsVersioningCard')) {
      const info = dataPanel.querySelector('.settings-info-box');
      const card = document.createElement('article');
      card.className = 'settings-card';
      card.id = 'settingsVersioningCard';
      card.innerHTML = `
        <div class="settings-card-head"><div><h2>Versionamento automático</h2><p>Snapshots do inventário permitem voltar no tempo sem apagar o estado atual.</p></div><span class="settings-card-badge settings-card-badge-ok">Protegido</span></div>
        <div class="settings-versioning-status">
          <div><strong id="settingsSnapshotTitle">Consultando versões...</strong><small id="settingsSnapshotMeta">O histórico é isolado por workspace.</small></div>
          <div class="settings-versioning-actions"><button type="button" class="settings-ghost-btn" id="settingsCreateSnapshot">Criar snapshot</button><button type="button" class="settings-primary-btn" id="settingsOpenSnapshots">Ver versões</button></div>
        </div>
        <div class="settings-protection-note">Antes de importar JSON ou CSV, o administrador cria automaticamente um snapshot de segurança. Assim, uma importação incorreta pode ser revertida.</div>`;
      info?.insertAdjacentElement('beforebegin', card);
    }
  }

  function setState(id, ok, okText, badText = 'Atenção') {
    const el = $(id);
    if (!el) return;
    el.textContent = ok ? okText : badText;
    el.classList.remove('ok','warn','danger');
    el.classList.add(ok ? 'ok' : 'warn');
  }

  function formatDate(value) {
    if (!value) return 'não informada';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'não informada';
    return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(date);
  }

  function deviceName() {
    const ua = navigator.userAgent || '';
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS/iPadOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Dispositivo';
    const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox\//i.test(ua) ? 'Firefox' : /Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'Navegador';
    return `${browser} · ${os}`;
  }

  async function inspectHeaders() {
    const https = location.protocol === 'https:';
    let hardened = false;
    try {
      const response = await fetch(location.pathname, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
      const nosniff = String(response.headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff';
      const frame = /deny|sameorigin/i.test(response.headers.get('x-frame-options') || '');
      const csp = /frame-ancestors/i.test(response.headers.get('content-security-policy') || '');
      hardened = nosniff && frame && csp;
    } catch {}
    state.headersOk = https && hardened;
    setState('securityHeadersState', state.headersOk, 'Ativa', https ? 'Parcial' : 'Sem HTTPS');
    if ($('securityHeadersDetail')) $('securityHeadersDetail').textContent = state.headersOk
      ? 'HTTPS, anti-frame e proteção de conteúdo ativos.'
      : https ? 'HTTPS ativo; aguardando confirmação dos headers defensivos.' : 'A página não está usando HTTPS.';
  }

  async function refreshSecurity() {
    ensureUi();
    const db = client();
    const context = ctx();
    let session = null;
    let verified = 0;
    let aal = 'aal1';

    if (db) {
      try { session = (await db.auth.getSession()).data?.session || null; } catch {}
      try {
        const [factorResult, aalResult] = await Promise.all([db.auth.mfa.listFactors(), db.auth.mfa.getAuthenticatorAssuranceLevel()]);
        verified = (factorResult.data?.totp || []).filter(factor => factor?.status === 'verified').length;
        aal = aalResult.data?.currentLevel || 'aal1';
      } catch {}
    }
    state.session = session;
    state.verifiedFactors = verified;
    state.aal = aal;
    await inspectHeaders();

    const sessionOk = Boolean(session?.user);
    const mfaOk = verified > 0 && aal === 'aal2';
    const tenantOk = Boolean(context.tenantId);
    const httpsOk = location.protocol === 'https:';
    const score = (sessionOk ? 25 : 0) + (mfaOk ? 30 : verified ? 15 : 0) + (state.headersOk ? 25 : httpsOk ? 12 : 0) + (tenantOk ? 20 : 0);

    setState('securitySessionState', sessionOk, 'Ativa', 'Inválida');
    setState('securityMfaState', mfaOk, 'AAL2', verified ? 'AAL1' : 'Opcional');
    setState('securityTenantState', tenantOk, 'Isolado', 'Verificar');
    if ($('securitySessionDetail')) $('securitySessionDetail').textContent = sessionOk ? `Sessão válida para ${session.user.email || 'usuário autenticado'}.` : 'Não foi possível validar a sessão.';
    if ($('securityMfaDetail')) $('securityMfaDetail').textContent = verified ? `${verified} autenticador(es) verificado(s) · nível atual ${String(aal).toUpperCase()}.` : 'Nenhum autenticador TOTP verificado nesta conta.';
    if ($('securityTenantDetail')) $('securityTenantDetail').textContent = tenantOk ? `${context.tenantName} · dados separados por tenant.` : 'Contexto de workspace não identificado.';
    if ($('securityScoreValue')) $('securityScoreValue').textContent = String(score);
    if ($('securityScoreRing')) $('securityScoreRing').style.setProperty('--security-score', String(score));
    if ($('securityScoreLabel')) $('securityScoreLabel').textContent = score >= 90 ? 'Proteção excelente' : score >= 70 ? 'Proteção boa' : 'Proteção pode melhorar';
    if ($('securityPostureBadge')) {
      $('securityPostureBadge').textContent = score >= 90 ? 'Excelente' : score >= 70 ? 'Boa' : 'Atenção';
      $('securityPostureBadge').classList.toggle('settings-card-badge-ok', score >= 70);
    }
    if ($('securityDeviceName')) $('securityDeviceName').textContent = deviceName();
    if ($('securitySessionExpires')) $('securitySessionExpires').textContent = session?.expires_at ? `Sessão atual válida até ${formatDate(session.expires_at * 1000)}. Tokens revogados podem permanecer válidos até a expiração do access token.` : 'Validade da sessão não disponível.';

    const idle = window.RRN_SESSION_SECURITY?.getIdleMinutes?.() ?? 120;
    if ($('securityIdleTimeout')) $('securityIdleTimeout').value = String(idle);
    await refreshSnapshotStatus();
    protectImports();
  }

  async function refreshSnapshotStatus() {
    if (!isAdmin() || !$('settingsSnapshotTitle')) return;
    const db = client();
    if (!db) return;
    try {
      const { data, error } = await db.from('tenant_inventory_snapshots').select('captured_at,source').order('captured_at',{ascending:false}).limit(1).maybeSingle();
      if (error) throw error;
      $('settingsSnapshotTitle').textContent = data ? `Última versão: ${formatDate(data.captured_at)}` : 'Versionamento ativo';
      $('settingsSnapshotMeta').textContent = data ? `${data.source === 'automatic' ? 'Snapshot automático' : data.source === 'pre_restore' ? 'Snapshot de segurança' : 'Snapshot manual'} · retenção automática de 90 dias.` : 'A primeira versão será criada quando houver alteração ou snapshot manual.';
    } catch {
      $('settingsSnapshotTitle').textContent = 'Não foi possível consultar as versões agora';
      $('settingsSnapshotMeta').textContent = 'O inventário continua funcionando normalmente.';
    }
  }

  async function createSnapshot(button, note = 'Snapshot manual criado em Configurações') {
    const db = client();
    if (!db || !isAdmin()) return false;
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
    try {
      const { error } = await db.rpc('create_inventory_snapshot', { p_note: note });
      if (error) throw error;
      await refreshSnapshotStatus();
      toast('Snapshot criado com sucesso.');
      return true;
    } catch (error) {
      console.warn('RRN snapshot:', error);
      toast('Não foi possível criar o snapshot.', true);
      return false;
    } finally {
      if (button) { button.disabled = false; button.textContent = original || 'Criar snapshot'; }
    }
  }

  function protectImport(buttonId, inputId, label) {
    const button = $(buttonId);
    if (!button || button.dataset.rrnProtectedImport === '1') return;
    button.dataset.rrnProtectedImport = '1';
    if (!isAdmin()) {
      button.disabled = true;
      button.title = 'Somente administradores podem substituir o inventário por importação.';
      return;
    }
    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Protegendo dados...';
      const ok = await createSnapshot(null, `Snapshot automático antes de importar ${label}`);
      button.disabled = false;
      button.textContent = original;
      if (!ok && !confirm('Não foi possível criar o snapshot de segurança. Deseja continuar a importação mesmo assim?')) return;
      $(inputId)?.click();
    }, true);
  }

  function protectImports() {
    protectImport('importBackupBtn','jsonInput','JSON');
    protectImport('importCsvBtn','csvInputSettings','CSV');
  }

  function bind() {
    $('securityIdleTimeout')?.addEventListener('change', event => {
      const minutes = Number(event.target.value);
      try {
        window.RRN_SESSION_SECURITY?.setIdleMinutes?.(minutes);
        toast(minutes ? `Bloqueio automático ajustado para ${minutes} minutos.` : 'Bloqueio por inatividade desativado.');
      } catch { toast('Não foi possível alterar o tempo de inatividade.', true); }
    });

    $('securityLogoutOthers')?.addEventListener('click', async () => {
      if (!confirm('Encerrar as outras sessões ativas desta conta e manter somente este dispositivo?')) return;
      const button = $('securityLogoutOthers');
      const original = button.textContent;
      button.disabled = true; button.textContent = 'Encerrando...';
      try {
        await window.RRN_SESSION_SECURITY?.signOutOthers?.();
        toast('Outras sessões foram encerradas.');
      } catch (error) {
        console.warn(error); toast('Não foi possível encerrar as outras sessões.', true);
      } finally { button.disabled = false; button.textContent = original; }
    });

    $('securityLogoutAll')?.addEventListener('click', async () => {
      if (!confirm('Isso encerrará sua conta neste dispositivo e tentará revogar as demais sessões. Continuar?')) return;
      try { await window.RRN_SESSION_SECURITY?.signOutAll?.(); }
      catch (error) { console.warn(error); toast('Não foi possível encerrar todas as sessões.', true); }
    });

    $('settingsCreateSnapshot')?.addEventListener('click', event => createSnapshot(event.currentTarget));
    $('settingsOpenSnapshots')?.addEventListener('click', () => window.RRN_INVENTORY_SNAPSHOTS?.openHistory?.());
  }

  function boot() {
    ensureUi();
    bind();
    refreshSecurity().catch(console.warn);
    setTimeout(() => refreshSecurity().catch(console.warn), 900);
  }

  window.addEventListener('rrn:session-ready', () => setTimeout(() => {
    ensureUi();
    bind();
    refreshSecurity().catch(console.warn);
  }, 0));
  window.addEventListener('rrn:idle-timeout-updated', () => refreshSecurity().catch(console.warn));
  window.addEventListener('rrn:inventory-remote-update', refreshSnapshotStatus);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
