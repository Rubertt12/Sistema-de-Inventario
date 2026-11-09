(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_LINK__) return;
  window.__RRN_SUPPORT_DESK_LINK__ = true;

  const SUPPORT_URL = 'https://support-platform-ten.vercel.app';

  function addStyles() {
    if (document.getElementById('rrn-support-platform-link-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-support-platform-link-style';
    style.textContent = `
      .rrn-support-platform-entry{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:9px 15px;border:1px solid rgba(47,125,120,.24);border-radius:11px;background:rgba(47,125,120,.09);color:var(--rrn-heading,#163a4d);font-family:inherit;font-size:.82rem;font-weight:700;line-height:1.2;text-decoration:none;cursor:pointer;transition:background .18s ease,transform .18s ease}
      .rrn-support-platform-entry:hover{background:rgba(47,125,120,.16);transform:translateY(-1px)}
      .rrn-support-platform-entry .rrn-support-platform-icon{display:grid;place-items:center;width:23px;height:23px;border-radius:7px;background:rgba(47,125,120,.14);font-size:.9rem}
      #userDropdown .rrn-support-platform-entry{display:flex;width:100%;justify-content:flex-start;margin:5px 0;padding:10px 12px;background:transparent;border:0;box-shadow:none;transform:none}
      #userDropdown .rrn-support-platform-entry:hover{background:var(--rrn-hover,rgba(47,125,120,.1))}
      :root[data-theme="dark"] .rrn-support-platform-entry{color:var(--rrn-text,#edf3fb);background:rgba(112,190,180,.12);border-color:rgba(112,190,180,.22)}
    `;
    document.head.appendChild(style);
  }

  function makeLink(className = 'rrn-support-platform-entry') {
    const link = document.createElement('a');
    link.className = className;
    link.href = SUPPORT_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.supportPlatformLink = '1';
    link.innerHTML = '<span class="rrn-support-platform-icon" aria-hidden="true">🎫</span><span>Central de Chamados</span><span aria-hidden="true">↗</span>';
    return link;
  }

  function mount() {
    if (!/dashboard\.html$/i.test(location.pathname) && !document.getElementById('setoresContainer')) return;
    addStyles();
    const actions = document.querySelector('.dashboard-actions');
    if (actions && !actions.querySelector('[data-support-platform-link]')) {
      actions.appendChild(makeLink());
    }
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !dropdown.querySelector('[data-support-platform-link]')) {
      const link = makeLink();
      link.addEventListener('click', event => event.stopPropagation());
      const config = dropdown.querySelector('button[onclick*="openConfigModal"]');
      dropdown.insertBefore(link, config || dropdown.firstChild);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
  else mount();
  new MutationObserver(mount).observe(document.documentElement, { childList:true, subtree:true });
})();
