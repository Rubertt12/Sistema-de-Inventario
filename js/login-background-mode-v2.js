(() => {
  'use strict';
  if (window.__RRN_LOGIN_BACKGROUND_MODE_V2__) return;
  window.__RRN_LOGIN_BACKGROUND_MODE_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const params = new URLSearchParams(location.search);
  const requestedSlug = params.get('org');
  const panel = () => document.querySelector('.brand-panel');

  function hexToRgba(hex, alpha) {
    const raw = String(hex || '#163A4D').replace('#', '').trim();
    const normalized = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
    const value = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : '163A4D';
    const n = parseInt(value, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  function cssUrl(url) {
    return `url(${JSON.stringify(String(url || ''))})`;
  }

  function applyBrandBackground(brand = {}) {
    const el = panel();
    if (!el || !brand.login_background_url) return;
    const clean = brand.login_background_overlay === false;
    if (clean) {
      el.style.setProperty('background-image', cssUrl(brand.login_background_url), 'important');
      el.dataset.rrnBackgroundMode = 'clean';
    } else {
      const primary = hexToRgba(brand.primary_color || '#163A4D', .90);
      const secondary = hexToRgba(brand.secondary_color || '#2F7D78', .74);
      el.style.setProperty('background-image', `linear-gradient(145deg,${primary},${secondary}),${cssUrl(brand.login_background_url)}`, 'important');
      el.dataset.rrnBackgroundMode = 'overlay';
    }
    el.style.setProperty('background-size', 'cover', 'important');
    el.style.setProperty('background-position', 'center', 'important');
  }

  async function loadPublicPreference() {
    if (!requestedSlug || !window.supabase?.createClient || !cfg.url || !cfg.anonKey) return;
    const client = window.RRN_SUPABASE_CLIENT || window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.RRN_SUPABASE_CLIENT = client;
    const { data, error } = await client.rpc('get_public_tenant_branding_v2', { p_slug: requestedSlug });
    if (error) return console.warn('RRN background mode:', error.message || error);
    const brand = Array.isArray(data) ? data[0] : data;
    if (brand) applyBrandBackground(brand);
  }

  window.addEventListener('rrn:tenantbranding', event => {
    const brand = event.detail || {};
    if (Object.prototype.hasOwnProperty.call(brand, 'login_background_overlay')) {
      applyBrandBackground(brand);
    } else if (requestedSlug) {
      setTimeout(() => loadPublicPreference().catch(() => undefined), 0);
    }
  });

  if (window.RRN_TENANT_BRANDING && Object.prototype.hasOwnProperty.call(window.RRN_TENANT_BRANDING, 'login_background_overlay')) {
    applyBrandBackground(window.RRN_TENANT_BRANDING);
  }

  loadPublicPreference().catch(error => console.warn('RRN background mode:', error));
  if (requestedSlug) {
    setTimeout(() => loadPublicPreference().catch(() => undefined), 450);
    setTimeout(() => loadPublicPreference().catch(() => undefined), 1100);
  }
})();