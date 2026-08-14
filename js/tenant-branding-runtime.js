(() => {
  'use strict';

  if (window.__RRN_TENANT_BRANDING_RUNTIME__) return;
  window.__RRN_TENANT_BRANDING_RUNTIME__ = true;

  if (/\/configuracoes\.html$/i.test(location.pathname) && !document.querySelector('script[data-rrn-settings-agent]')) {
    const script = document.createElement('script');
    script.src = '/js/settings-agent.js?v=20260814-1';
    script.async = true;
    script.dataset.rrnSettingsAgent = '1';
    document.head.appendChild(script);
  }

  const cfg = window.RRN_SUPABASE || {};
  if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return;

  const client = window.RRN_SUPABASE_CLIENT || window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const DEFAULT_LOGO = '/img/icon-png.png';
  const DEFAULT_BRAND = {
    primary_color: '#163A4D',
    secondary_color: '#2F7D78',
    accent_color: '#D97745',
    surface_color: '#F8FAFA',
    text_color: '#263238'
  };

  const DARK = {
    bg: '#10191D',
    surface: '#162328',
    surface2: '#1B2A30',
    surfaceSoft: '#1D3036',
    input: '#142228',
    text: '#E7EEF0',
    heading: '#D8F0EE',
    muted: '#A7B5BA',
    border: 'rgba(171,201,207,.18)',
    overlay: 'rgba(3,10,13,.78)',
    success: '#69C2A3',
    warning: '#E3A172',
    danger: '#F18D82'
  };

  function normalizeHex(value, fallback) {
    const raw = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      return `#${raw.slice(1).split('').map(char => char + char).join('')}`.toUpperCase();
    }
    return fallback;
  }

  function mixHex(source, target, amount) {
    const a = normalizeHex(source, '#000000').slice(1);
    const b = normalizeHex(target, '#FFFFFF').slice(1);
    const ratio = Math.max(0, Math.min(1, Number(amount) || 0));
    const parts = [0, 2, 4].map(index => {
      const av = parseInt(a.slice(index, index + 2), 16);
      const bv = parseInt(b.slice(index, index + 2), 16);
      return Math.round(av + (bv - av) * ratio).toString(16).padStart(2, '0');
    });
    return `#${parts.join('')}`.toUpperCase();
  }

  function rgba(hex, alpha) {
    const value = normalizeHex(hex, '#163A4D').slice(1);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function setToken(style, name, value) {
    if (value != null && value !== '') style.setProperty(name, value);
  }

  function applyThemeTokens(brand) {
    const root = document.documentElement.style;
    const dark = document.documentElement.dataset.theme === 'dark';
    const primaryBase = normalizeHex(brand.primary_color, DEFAULT_BRAND.primary_color);
    const secondaryBase = normalizeHex(brand.secondary_color, DEFAULT_BRAND.secondary_color);
    const accentBase = normalizeHex(brand.accent_color, DEFAULT_BRAND.accent_color);
    const surfaceBase = normalizeHex(brand.surface_color, DEFAULT_BRAND.surface_color);
    const textBase = normalizeHex(brand.text_color, DEFAULT_BRAND.text_color);

    if (dark) {
      const primary = mixHex(primaryBase, '#FFFFFF', 0.46);
      const secondary = mixHex(secondaryBase, '#FFFFFF', 0.30);
      const accent = mixHex(accentBase, '#FFFFFF', 0.18);
      const navbar = mixHex(primaryBase, '#071217', 0.72);
      const navbar2 = mixHex(secondaryBase, '#0B1A1F', 0.70);

      setToken(root, '--primary', primary);
      setToken(root, '--secondary', secondary);
      setToken(root, '--accent', accent);
      setToken(root, '--surface', DARK.surface);
      setToken(root, '--text', DARK.text);

      setToken(root, '--blue', primary);
      setToken(root, '--lilac', secondary);
      setToken(root, '--yellow', accent);
      setToken(root, '--beige', DARK.bg);

      setToken(root, '--rrn-primary', primary);
      setToken(root, '--rrn-primary-hover', mixHex(primary, '#FFFFFF', 0.14));
      setToken(root, '--rrn-secondary', secondary);
      setToken(root, '--rrn-secondary-hover', mixHex(secondary, '#FFFFFF', 0.12));
      setToken(root, '--rrn-accent', accent);
      setToken(root, '--rrn-bg', DARK.bg);
      setToken(root, '--rrn-surface', DARK.surface);
      setToken(root, '--rrn-surface-2', DARK.surface2);
      setToken(root, '--rrn-surface-soft', DARK.surfaceSoft);
      setToken(root, '--rrn-input', DARK.input);
      setToken(root, '--rrn-text', DARK.text);
      setToken(root, '--rrn-heading', DARK.heading);
      setToken(root, '--rrn-muted', DARK.muted);
      setToken(root, '--rrn-border', DARK.border);
      setToken(root, '--rrn-navbar', navbar);
      setToken(root, '--rrn-navbar-2', navbar2);
      setToken(root, '--rrn-overlay', DARK.overlay);
      setToken(root, '--rrn-success', DARK.success);
      setToken(root, '--rrn-warning', DARK.warning);
      setToken(root, '--rrn-danger', DARK.danger);
      return;
    }

    setToken(root, '--primary', primaryBase);
    setToken(root, '--secondary', secondaryBase);
    setToken(root, '--accent', accentBase);
    setToken(root, '--surface', surfaceBase);
    setToken(root, '--text', textBase);

    setToken(root, '--blue', primaryBase);
    setToken(root, '--lilac', secondaryBase);
    setToken(root, '--yellow', accentBase);
    setToken(root, '--beige', surfaceBase);

    setToken(root, '--rrn-primary', primaryBase);
    setToken(root, '--rrn-primary-hover', mixHex(primaryBase, '#000000', 0.16));
    setToken(root, '--rrn-secondary', secondaryBase);
    setToken(root, '--rrn-secondary-hover', mixHex(secondaryBase, '#000000', 0.14));
    setToken(root, '--rrn-accent', accentBase);
    setToken(root, '--rrn-bg', mixHex(surfaceBase, '#E8EEF0', 0.34));
    setToken(root, '--rrn-surface', surfaceBase);
    setToken(root, '--rrn-surface-2', mixHex(surfaceBase, '#FFFFFF', 0.78));
    setToken(root, '--rrn-surface-soft', mixHex(surfaceBase, '#EEF2F3', 0.54));
    setToken(root, '--rrn-input', '#FFFFFF');
    setToken(root, '--rrn-text', textBase);
    setToken(root, '--rrn-heading', primaryBase);
    setToken(root, '--rrn-muted', mixHex(textBase, '#FFFFFF', 0.34));
    setToken(root, '--rrn-border', rgba(primaryBase, 0.18));
    setToken(root, '--rrn-navbar', primaryBase);
    setToken(root, '--rrn-navbar-2', mixHex(primaryBase, secondaryBase, 0.28));
    setToken(root, '--rrn-overlay', rgba(primaryBase, 0.68));
  }

  function applyBrand(rawBrand = {}) {
    const brand = { ...DEFAULT_BRAND, ...rawBrand };
    applyThemeTokens(brand);

    document.querySelectorAll('.brand-mark img,.mobile-brand img,.navbar-icon,.brand img,.settings-brand img')
      .forEach(img => { img.src = brand.logo_url || DEFAULT_LOGO; });

    const title = document.getElementById('brandTitle');
    const subtitle = document.getElementById('brandSubtitle');
    if (title) title.textContent = brand.login_title || 'Controle patrimonial com mais organização e eficiência';
    if (subtitle) subtitle.textContent = brand.login_subtitle || 'Gerencie equipamentos, responsáveis, setores e movimentações com praticidade e visão centralizada.';

    const panel = document.querySelector('.brand-panel');
    if (panel) {
      if (brand.login_background_url) {
        const primary = normalizeHex(brand.primary_color, DEFAULT_BRAND.primary_color);
        const secondary = normalizeHex(brand.secondary_color, DEFAULT_BRAND.secondary_color);
        panel.style.setProperty(
          'background-image',
          `linear-gradient(145deg,${rgba(primary, 0.90)},${rgba(secondary, 0.74)}),url('${brand.login_background_url}')`,
          'important'
        );
        panel.style.backgroundSize = 'cover';
        panel.style.backgroundPosition = 'center';
      } else {
        panel.style.removeProperty('background-image');
        panel.style.removeProperty('background-size');
        panel.style.removeProperty('background-position');
      }
    }

    if (brand.tenant_name) {
      document.querySelectorAll('[data-tenant-brand-name]').forEach(el => { el.textContent = brand.tenant_name; });
    }

    window.RRN_TENANT_BRANDING = brand;
    window.dispatchEvent(new CustomEvent('rrn:tenantbranding', { detail: brand }));
  }

  async function fromSlug(slug) {
    const { data, error } = await client.rpc('get_public_tenant_branding', { p_slug: slug });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    applyBrand(row || {});
  }

  async function fromSession() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
      applyBrand(window.RRN_TENANT_BRANDING || {});
      return;
    }
    const { data: profile } = await client.from('profiles').select('tenant_id').eq('user_id', session.user.id).maybeSingle();
    if (!profile?.tenant_id) return applyBrand({});
    const { data: brand } = await client.from('tenant_branding').select('*').eq('tenant_id', profile.tenant_id).maybeSingle();
    applyBrand(brand || {});
  }

  window.addEventListener('rrn:themechange', () => {
    applyBrand(window.RRN_TENANT_BRANDING || {});
  });

  (async () => {
    try {
      const slug = new URLSearchParams(location.search).get('org');
      if (slug) await fromSlug(slug);
      else await fromSession();
    } catch (error) {
      console.warn('RRN branding:', error);
      applyBrand(window.RRN_TENANT_BRANDING || {});
    }
  })();

  window.RRN_APPLY_TENANT_BRANDING = applyBrand;
})();