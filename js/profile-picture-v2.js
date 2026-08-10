(() => {
  'use strict';

  const LEGACY_KEY = 'userProfileImage';

  function currentUserId() {
    if (window.RRN_SESSION?.userId) return window.RRN_SESSION.userId;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').id || null; }
    catch { return null; }
  }

  function storageKey() {
    const id = currentUserId();
    return id ? `userProfileImage_${id}` : LEGACY_KEY;
  }

  function apply(value) {
    if (!value) return;
    const profile = document.getElementById('profilePic');
    const avatar = document.getElementById('userAvatar');
    if (profile) profile.src = value;
    if (avatar) avatar.src = value;
  }

  function load() {
    const scoped = localStorage.getItem(storageKey());
    if (scoped) {
      apply(scoped);
      return;
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    const id = currentUserId();
    if (legacy && id) {
      localStorage.setItem(`userProfileImage_${id}`, legacy);
      localStorage.removeItem(LEGACY_KEY);
      apply(legacy);
    }
  }

  function changeProfilePictureV2(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Selecione uma imagem válida.');
    if (file.size > 2 * 1024 * 1024) return alert('A imagem deve ter no máximo 2 MB.');

    const reader = new FileReader();
    reader.onload = e => {
      const value = e.target?.result;
      if (!value) return;
      apply(value);
      localStorage.setItem(storageKey(), value);
    };
    reader.readAsDataURL(file);
  }

  function install() {
    window.changeProfilePicture = changeProfilePictureV2;
    load();
  }

  window.addEventListener('rrn:session-ready', load);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', load);
})();
