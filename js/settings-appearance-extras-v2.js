(() => {
  'use strict';
  if (window.__RRN_SETTINGS_APPEARANCE_EXTRAS_V2__) return;
  window.__RRN_SETTINGS_APPEARANCE_EXTRAS_V2__ = true;

  const PRESETS = [
    ['/img/avatars/robot.svg','Robô'],
    ['/img/avatars/flower.svg','Flor'],
    ['/img/avatars/guitar.svg','Violão'],
    ['/img/avatars/planet.svg','Planeta'],
    ['/img/avatars/cat.svg','Gato'],
    ['/img/avatars/mountain.svg','Paisagem']
  ];

  function currentUserId() {
    if (window.RRN_SESSION?.userId) return window.RRN_SESSION.userId;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').id || null; }
    catch { return null; }
  }

  function profileKey() {
    const id = currentUserId();
    return id ? `userProfileImage_${id}` : 'userProfileImage';
  }

  function ensureStyle() {
    if (document.getElementById('rrnSettingsAppearanceExtrasStyle')) return;
    const s = document.createElement('style');
    s.id = 'rrnSettingsAppearanceExtrasStyle';
    s.textContent = `
      .rrn-avatar-presets{margin-top:18px;padding-top:16px;border-top:1px solid var(--rrn-border,rgba(22,58,77,.13))}
      .rrn-avatar-presets>strong{display:block;margin-bottom:5px;color:var(--rrn-heading,#163a4d);font-size:.82rem}
      .rrn-avatar-presets>small{display:block;margin-bottom:12px;color:var(--rrn-muted,#66757f);font-size:.7rem;line-height:1.4}
      .rrn-avatar-preset-grid{display:grid;grid-template-columns:repeat(6,minmax(52px,1fr));gap:10px}
      .rrn-avatar-preset{position:relative;display:grid;place-items:center;aspect-ratio:1;border:2px solid transparent;border-radius:16px;background:var(--rrn-surface,#fff);padding:4px;cursor:pointer;transition:.16s ease}
      .rrn-avatar-preset:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--rrn-secondary,#2f7d78) 45%,transparent)}
      .rrn-avatar-preset.active{border-color:var(--rrn-secondary,#2f7d78);box-shadow:0 0 0 3px color-mix(in srgb,var(--rrn-secondary,#2f7d78) 13%,transparent)}
      .rrn-avatar-preset img{width:100%;height:100%;object-fit:cover;border-radius:11px}
      .rrn-panel-customize-card{margin-top:18px}
      .rrn-panel-customize-action{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px;border:1px solid var(--rrn-border,rgba(22,58,77,.13));border-radius:14px;background:color-mix(in srgb,var(--rrn-surface,#fff) 94%,var(--rrn-secondary,#2f7d78) 6%)}
      .rrn-panel-customize-action strong,.rrn-panel-customize-action small{display:block}.rrn-panel-customize-action strong{color:var(--rrn-heading,#163a4d);font-size:.82rem}.rrn-panel-customize-action small{margin-top:4px;color:var(--rrn-muted,#66757f);font-size:.68rem;line-height:1.45}
      html[data-theme="light"] .settings-card,html[data-theme="light"] .settings-page-heading,html[data-theme="light"] .settings-sidebar,html[data-theme="light"] .settings-user-card{color:#263238}
      html[data-theme="light"] .settings-card p,html[data-theme="light"] .settings-card small,html[data-theme="light"] .settings-page-heading p,html[data-theme="light"] .settings-sidebar small{color:#687780!important}
      html[data-theme="light"] .settings-card h2,html[data-theme="light"] .settings-card strong,html[data-theme="light"] .settings-page-heading h1{color:#163a4d!important}
      @media(max-width:700px){.rrn-avatar-preset-grid{grid-template-columns:repeat(3,1fr)}.rrn-panel-customize-action{align-items:stretch;flex-direction:column}.rrn-panel-customize-action .settings-primary-btn{width:100%}}
    `;
    document.head.appendChild(s);
  }

  function applyAvatar(src) {
    localStorage.setItem(profileKey(), src);
    const profile = document.getElementById('profilePic');
    const sidebar = document.getElementById('userAvatar');
    if (profile) profile.src = src;
    if (sidebar) sidebar.src = src;
    document.querySelectorAll('.rrn-avatar-preset').forEach(btn => btn.classList.toggle('active', btn.dataset.src === src));
    window.dispatchEvent(new CustomEvent('rrn:profile-image-change', { detail:{ src } }));
  }

  function installAvatarPresets() {
    const profile = document.querySelector('.profile-settings');
    if (!profile || document.getElementById('rrnAvatarPresets')) return;
    const box = document.createElement('div');
    box.id = 'rrnAvatarPresets';
    box.className = 'rrn-avatar-presets';
    box.innerHTML = `<strong>Escolher uma imagem pronta</strong><small>Uma seleção rápida no estilo das imagens de conta clássicas do Windows.</small><div class="rrn-avatar-preset-grid">${PRESETS.map(([src,label]) => `<button type="button" class="rrn-avatar-preset" data-src="${src}" title="${label}" aria-label="Usar avatar ${label}"><img src="${src}" alt="${label}"></button>`).join('')}</div>`;
    profile.parentElement?.appendChild(box);
    box.querySelectorAll('.rrn-avatar-preset').forEach(btn => btn.addEventListener('click', () => applyAvatar(btn.dataset.src)));
    const saved = localStorage.getItem(profileKey());
    if (saved) box.querySelector(`[data-src="${CSS.escape(saved)}"]`)?.classList.add('active');
  }

  function installPanelCustomizeEntry() {
    const panel = document.querySelector('[data-settings-panel="appearance"]');
    if (!panel || document.getElementById('rrnPanelCustomizeCard')) return;
    const card = document.createElement('article');
    card.id = 'rrnPanelCustomizeCard';
    card.className = 'settings-card rrn-panel-customize-card';
    card.innerHTML = `<div class="settings-card-head"><div><h2>Personalizar painel</h2><p>Escolha quais indicadores aparecem na visão geral e em que ordem.</p></div><span class="settings-card-badge">Dashboard</span></div><div class="rrn-panel-customize-action"><div><strong>Indicadores da visão geral</strong><small>O editor abre sobre a dashboard para você visualizar as alterações enquanto organiza os cards.</small></div><a class="settings-primary-btn" href="/dashboard.html?customize=1">Personalizar indicadores</a></div>`;
    const bgCard = [...panel.querySelectorAll('.settings-card')].find(el => el.textContent.includes('Fundo da dashboard'));
    if (bgCard) bgCard.insertAdjacentElement('beforebegin', card); else panel.appendChild(card);
  }

  function boot() {
    ensureStyle();
    installAvatarPresets();
    installPanelCustomizeEntry();
    window.addEventListener('rrn:session-ready', () => { installAvatarPresets(); installPanelCustomizeEntry(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
