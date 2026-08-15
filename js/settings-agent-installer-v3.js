(() => {
  'use strict';
  if (window.__RRN_AGENT_INSTALLER_V3__) return;
  window.__RRN_AGENT_INSTALLER_V3__ = true;

  const SETUP_URL = 'https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest/RRN.Agent.Setup.exe';

  function copy(value) {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => prompt('Copie o código:', value));
  }

  function enhance() {
    const panel = document.querySelector('[data-settings-panel="agent"]');
    if (!panel) return;

    const installCard = panel.querySelector('.settings-agent-grid > .settings-card:first-child');
    if (!installCard) return;

    const headText = installCard.querySelector('.settings-card-head p');
    if (headText) headText.textContent = 'Gere o código, baixe o instalador do Windows e faça o cadastro diretamente pelo aplicativo.';

    const command = installCard.querySelector('.settings-agent-command');
    if (command) command.hidden = true;

    const code = installCard.querySelector('.settings-agent-code');
    if (code) {
      let hint = installCard.querySelector('[data-agent-native-hint]');
      if (!hint) {
        hint = document.createElement('div');
        hint.dataset.agentNativeHint = '1';
        hint.style.margin = '8px 0 2px';
        hint.style.color = 'var(--rrn-muted)';
        hint.style.fontSize = '.72rem';
        hint.textContent = 'Copie este código e cole no RRN Agent Setup. O instalador fará o vínculo e a configuração automaticamente.';
        code.insertAdjacentElement('afterend', hint);
      }
    }

    const actions = installCard.querySelector('.settings-agent-actions');
    if (!actions) return;

    const packageLink = Array.from(actions.querySelectorAll('a')).find(a => /pacote windows|baixar/i.test(a.textContent || ''));
    if (packageLink) {
      packageLink.href = SETUP_URL;
      packageLink.removeAttribute('target');
      packageLink.textContent = 'Baixar instalador (.exe)';
      packageLink.setAttribute('download', 'RRN.Agent.Setup.exe');
    } else if (!actions.querySelector('[data-agent-setup-download]')) {
      const link = document.createElement('a');
      link.className = 'settings-ghost-btn';
      link.dataset.agentSetupDownload = '1';
      link.href = SETUP_URL;
      link.download = 'RRN.Agent.Setup.exe';
      link.textContent = 'Baixar instalador (.exe)';
      actions.appendChild(link);
    }

    const oldCopy = actions.querySelector('[data-agent-copy]');
    if (oldCopy && !oldCopy.dataset.nativeCodeCopy) {
      const replacement = oldCopy.cloneNode(true);
      replacement.dataset.nativeCodeCopy = '1';
      replacement.textContent = 'Copiar código';
      replacement.removeAttribute('data-agent-copy');
      replacement.addEventListener('click', () => copy(installCard.querySelector('.settings-agent-code')?.textContent?.trim()));
      oldCopy.replaceWith(replacement);
    }

    let flow = installCard.querySelector('[data-agent-native-flow]');
    if (!flow) {
      flow = document.createElement('div');
      flow.dataset.agentNativeFlow = '1';
      flow.className = 'settings-info-box';
      flow.style.marginTop = '16px';
      flow.innerHTML = '<strong>Instalação sem PowerShell</strong><p>1. Gere um código. 2. Baixe e abra o RRN Agent Setup. 3. Cole o código. 4. Clique em Instalar. O aplicativo registra o agente no Windows, vincula a máquina, configura 08:00/18:00 e inicia o ícone perto do relógio.</p>';
      installCard.appendChild(flow);
    }
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-settings-nav="agent"],[data-agent-generate],[data-agent-refresh]') : null;
    if (target) setTimeout(enhance, 80);
  }, true);

  document.addEventListener('DOMContentLoaded', () => setTimeout(enhance, 150), { once: true });
  window.addEventListener('load', () => setTimeout(enhance, 100), { once: true });
  setTimeout(enhance, 300);
})();
