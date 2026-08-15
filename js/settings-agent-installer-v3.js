(() => {
  'use strict';
  if (window.__RRN_AGENT_INSTALLER_V3__) return;
  window.__RRN_AGENT_INSTALLER_V3__ = true;

  const SETUP_URL = 'https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest/RRN.Agent.Setup.exe';
  let downloading = false;

  function db() {
    const cfg = window.RRN_SUPABASE || {};
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return window.RRN_SUPABASE_CLIENT;
  }

  async function copyCode(value) {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  function startDownload() {
    const a = document.createElement('a');
    a.href = SETUP_URL;
    a.download = 'RRN.Agent.Setup.exe';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function setInstallerStatus(message, type = '') {
    const card = document.querySelector('[data-settings-panel="agent"] .settings-agent-grid > .settings-card:first-child');
    if (!card) return;
    let node = card.querySelector('[data-agent-download-status]');
    if (!node) {
      node = document.createElement('div');
      node.dataset.agentDownloadStatus = '1';
      node.style.marginTop = '10px';
      node.style.fontSize = '.74rem';
      node.style.fontWeight = '700';
      card.querySelector('.settings-agent-actions')?.insertAdjacentElement('afterend', node);
    }
    node.textContent = message;
    node.style.color = type === 'error' ? 'var(--rrn-danger,#be4646)' : 'var(--rrn-secondary,#2f7d78)';
  }

  async function generateAndDownload(button) {
    if (downloading) return;
    downloading = true;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparando instalador...';
    setInstallerStatus('Gerando vínculo seguro para esta instalação...');

    try {
      const client = db();
      if (!client) throw new Error('Backend do RRN indisponível.');
      const { data, error } = await client.rpc('create_agent_enrollment_token', {
        p_expires_hours: 24,
        p_max_uses: 1
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const code = row?.enrollment_code;
      if (!code) throw new Error('O backend não retornou o código de instalação.');

      const copied = await copyCode(code);
      startDownload();
      setInstallerStatus(copied
        ? 'Instalador baixado. Ao abrir, o código será preenchido automaticamente.'
        : `Instalador baixado. Se o código não preencher sozinho, use: ${code}`);
    } catch (error) {
      console.error('RRN Agent installer:', error);
      setInstallerStatus(error?.message || 'Não foi possível preparar o instalador.', 'error');
      alert(error?.message || 'Não foi possível preparar o instalador do RRN Agent.');
    } finally {
      downloading = false;
      button.disabled = false;
      button.textContent = original;
    }
  }

  function enhance() {
    const panel = document.querySelector('[data-settings-panel="agent"]');
    if (!panel) return;

    const installCard = panel.querySelector('.settings-agent-grid > .settings-card:first-child');
    if (!installCard) return;

    const head = installCard.querySelector('.settings-card-head h2');
    if (head) head.textContent = 'Instalar agente Windows';
    const headText = installCard.querySelector('.settings-card-head p');
    if (headText) headText.textContent = 'Baixe o instalador. O RRN gera o código de vínculo automaticamente e o aplicativo faz o restante.';

    installCard.querySelector('.settings-agent-code')?.setAttribute('hidden', '');
    installCard.querySelector('.settings-agent-command')?.setAttribute('hidden', '');
    installCard.querySelector('[data-agent-native-hint]')?.remove();

    const actions = installCard.querySelector('.settings-agent-actions');
    if (!actions) return;

    actions.querySelector('[data-agent-generate]')?.remove();
    actions.querySelector('[data-agent-copy]')?.remove();
    actions.querySelector('[data-native-code-copy]')?.remove();

    let button = actions.querySelector('[data-agent-native-download]');
    const oldLink = Array.from(actions.querySelectorAll('a')).find(a => /pacote windows|baixar instalador|baixar/i.test(a.textContent || ''));
    if (oldLink) oldLink.remove();

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-primary-btn';
      button.dataset.agentNativeDownload = '1';
      button.textContent = 'Baixar instalador';
      button.addEventListener('click', () => generateAndDownload(button));
      actions.prepend(button);
    }

    let flow = installCard.querySelector('[data-agent-native-flow]');
    if (!flow) {
      flow = document.createElement('div');
      flow.dataset.agentNativeFlow = '1';
      flow.className = 'settings-info-box';
      flow.style.marginTop = '16px';
      installCard.appendChild(flow);
    }
    flow.innerHTML = '<strong>Instalação automática</strong><p>1. Clique em Baixar instalador. 2. O RRN cria o vínculo temporário sozinho. 3. Abra o RRN Agent Setup. 4. O código será preenchido automaticamente e você só precisa clicar em Instalar.</p>';
  }

  function retryEnhance() {
    [80, 200, 450, 900].forEach(delay => setTimeout(enhance, delay));
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-settings-nav="agent"],[data-agent-refresh]') : null;
    if (target) retryEnhance();
  }, true);

  document.addEventListener('DOMContentLoaded', retryEnhance, { once: true });
  window.addEventListener('load', retryEnhance, { once: true });
  retryEnhance();
})();
