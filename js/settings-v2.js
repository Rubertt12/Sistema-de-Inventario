(() => {
  'use strict';
  if (window.__RRN_SETTINGS_PAGE_LINK__) return;
  window.__RRN_SETTINGS_PAGE_LINK__ = true;

  function openSettingsPage() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
      dropdown.hidden = true;
      dropdown.style.display = 'none';
    }
    location.href = '/configuracoes.html';
  }

  function removeStandaloneSecurityShortcut() {
    document.querySelectorAll('[data-rrn-security-link]').forEach(button => button.remove());
  }

  function install() {
    window.openConfigModal = openSettingsPage;
    removeStandaloneSecurityShortcut();

    const legacyModal = document.getElementById('configModal');
    if (legacyModal) {
      legacyModal.hidden = true;
      legacyModal.style.display = 'none';
      legacyModal.setAttribute('aria-hidden', 'true');
    }
  }

  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  }
  window.addEventListener('load', install, { once: true });
  setTimeout(removeStandaloneSecurityShortcut, 500);
  setTimeout(removeStandaloneSecurityShortcut, 1400);
})();
