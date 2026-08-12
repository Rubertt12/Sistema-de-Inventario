(() => {
  'use strict';
  if (window.__RRN_ADMIN_BRANDING_V2__) return;
  window.__RRN_ADMIN_BRANDING_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const DEFAULTS = Object.freeze({
    primary_color: '#163A4D', secondary_color: '#2F7D78', accent_color: '#D97745',
    surface_color: '#F8FAFA', text_color: '#263238',
    login_title: 'Controle patrimonial com mais organização e eficiência',
    login_subtitle: 'Gerencie equipamentos, responsáveis, setores e movimentações com praticidade e visão centralizada.'
  });
  const $ = id => document.getElementById(id);
  const toast = text => {
    const el = $('toast');
    if (!el) return;
    el.textContent = text; el.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 3200);
  };

  function tenantId() {
    return $('brandingTenantSelector')?.value || $('tenantSelector')?.value || '';
  }
  function tenantName() {
    const select = $('brandingTenantSelector') || $('tenantSelector');
    return select?.selectedOptions?.[0]?.textContent?.trim() || 'RRN Manager';
  }

  function ensureControls() {
    const form = document.querySelector('[data-view-panel="branding"] .branding-form');
    if (!form || $('brandingTenantSelector')) return;
    const main = $('tenantSelector');
    const box = document.createElement('div');
    box.className = 'branding-company-control';
    box.innerHTML = `
      <label class="field grow"><span>Empresa que será personalizada</span><select id="brandingTenantSelector"></select><small>A identidade abaixo será aplicada somente à empresa selecionada.</small></label>
      <div class="branding-actions"><button type="button" class="btn-secondary" id="openBrandLoginButton">Visualizar login</button><button type="button" class="btn-secondary danger" id="resetBrandingButton">Restaurar padrão</button></div>`;
    form.prepend(box);

    const style = document.createElement('style');
    style.textContent = `.branding-company-control{display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:14px;align-items:end;padding:14px;border:1px solid var(--rrn-border);border-radius:14px;background:var(--rrn-surface-soft);margin-bottom:16px}.branding-actions{display:flex;gap:9px;flex-wrap:wrap}.branding-actions button{min-height:42px}.branding-actions .danger{color:var(--rrn-danger)!important}@media(max-width:760px){.branding-company-control{grid-template-columns:1fr}.branding-actions{display:grid;grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(style);

    const brandSelect = $('brandingTenantSelector');
    brandSelect.innerHTML = main?.innerHTML || '';
    if (main?.value) brandSelect.value = main.value;

    brandSelect.addEventListener('change', async () => {
      if (main && main.value !== brandSelect.value) {
        main.value = brandSelect.value;
        main.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await loadBranding();
    });
    main?.addEventListener('change', () => {
      brandSelect.innerHTML = main.innerHTML;
      brandSelect.value = main.value;
    });

    $('openBrandLoginButton').addEventListener('click', () => {
      const mainOption = main?.selectedOptions?.[0];
      const slug = $('tenantSlug')?.textContent?.trim();
      if (!slug || slug === '—') return toast('Não foi possível identificar o link da empresa.');
      window.open(`${location.origin}/index.html?org=${encodeURIComponent(slug)}&preview=1`, '_blank', 'noopener');
    });
    $('resetBrandingButton').addEventListener('click', resetBranding);
  }

  function renderPreview(data = {}) {
    const p = $('brandPrimary')?.value || DEFAULTS.primary_color;
    const s = $('brandSecondary')?.value || DEFAULTS.secondary_color;
    if ($('previewCompanyName')) $('previewCompanyName').textContent = tenantName();
    if ($('previewTitle')) $('previewTitle').textContent = $('brandLoginTitle')?.value.trim() || DEFAULTS.login_title;
    if ($('previewSubtitle')) $('previewSubtitle').textContent = $('brandLoginSubtitle')?.value.trim() || DEFAULTS.login_subtitle;
    if ($('previewLogo')) $('previewLogo').src = data.logo_url || '/img/icon-png.png';
    const preview = $('brandPreview');
    if (preview) {
      preview.style.backgroundImage = data.login_background_url
        ? `linear-gradient(145deg,${p}e6,${s}b8),url('${data.login_background_url}')`
        : `linear-gradient(145deg,${p},${s})`;
    }
  }

  function fill(data = {}) {
    const values = {
      brandPrimary: data.primary_color || DEFAULTS.primary_color,
      brandSecondary: data.secondary_color || DEFAULTS.secondary_color,
      brandAccent: data.accent_color || DEFAULTS.accent_color,
      brandSurface: data.surface_color || DEFAULTS.surface_color,
      brandText: data.text_color || DEFAULTS.text_color,
      brandLoginTitle: data.login_title || '', brandLoginSubtitle: data.login_subtitle || ''
    };
    Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
    renderPreview(data);
  }

  async function loadBranding() {
    const id = tenantId();
    if (!id) return;
    const { data, error } = await client.from('tenant_branding').select('*').eq('tenant_id', id).maybeSingle();
    if (error) return toast(error.message || 'Não foi possível carregar a identidade visual.');
    window.__RRN_ADMIN_BRANDING_CURRENT__ = data || {};
    fill(data || {});
  }

  async function upload(file, kind) {
    if (!file) return null;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use uma imagem PNG, JPG ou WEBP.');
    if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
    const path = `${tenantId()}/${kind}`;
    const { error } = await client.storage.from('tenant-branding').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
    if (error) throw error;
    return `${client.storage.from('tenant-branding').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  }

  async function saveBranding() {
    const button = $('saveBrandingButton');
    const id = tenantId();
    if (!id) return toast('Selecione uma empresa.');
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Salvando...';
    try {
      const current = window.__RRN_ADMIN_BRANDING_CURRENT__ || {};
      const logo = await upload($('brandLogoFile')?.files?.[0], 'logo');
      const background = await upload($('brandBackgroundFile')?.files?.[0], 'login-background');
      const payload = {
        tenant_id: id,
        primary_color: $('brandPrimary').value,
        secondary_color: $('brandSecondary').value,
        accent_color: $('brandAccent').value,
        surface_color: $('brandSurface').value,
        text_color: $('brandText').value,
        login_title: $('brandLoginTitle').value.trim() || null,
        login_subtitle: $('brandLoginSubtitle').value.trim() || null,
        logo_url: logo || current.logo_url || null,
        login_background_url: background || current.login_background_url || null,
        updated_at: new Date().toISOString()
      };
      const { data: auth } = await client.auth.getUser();
      if (auth?.user?.id) payload.updated_by = auth.user.id;
      const { error } = await client.from('tenant_branding').upsert(payload, { onConflict: 'tenant_id' });
      if (error) throw error;
      if ($('brandLogoFile')) $('brandLogoFile').value = '';
      if ($('brandBackgroundFile')) $('brandBackgroundFile').value = '';
      toast(`Identidade visual de ${tenantName()} salva.`);
      await loadBranding();
    } catch (error) {
      toast(error.message || 'Falha ao salvar a identidade visual.');
    } finally {
      button.disabled = false; button.textContent = original;
    }
  }

  async function resetBranding() {
    const id = tenantId();
    if (!id) return toast('Selecione uma empresa.');
    if (!confirm(`Restaurar a identidade padrão do RRN Manager para ${tenantName()}?`)) return;
    const button = $('resetBrandingButton');
    button.disabled = true;
    try {
      const { error } = await client.from('tenant_branding').delete().eq('tenant_id', id);
      if (error) throw error;
      const { data: files, error: listError } = await client.storage.from('tenant-branding').list(id, { limit: 100 });
      if (!listError && Array.isArray(files) && files.length) {
        const paths = files.filter(f => f.name).map(f => `${id}/${f.name}`);
        if (paths.length) await client.storage.from('tenant-branding').remove(paths);
      }
      window.__RRN_ADMIN_BRANDING_CURRENT__ = {};
      fill({});
      if ($('brandLogoFile')) $('brandLogoFile').value = '';
      if ($('brandBackgroundFile')) $('brandBackgroundFile').value = '';
      toast(`Identidade de ${tenantName()} restaurada para o padrão.`);
    } catch (error) {
      toast(error.message || 'Não foi possível restaurar o padrão.');
    } finally {
      button.disabled = false;
    }
  }

  function bindInputs() {
    ['brandPrimary','brandSecondary','brandAccent','brandSurface','brandText','brandLoginTitle','brandLoginSubtitle'].forEach(id => {
      $(id)?.addEventListener('input', () => renderPreview(window.__RRN_ADMIN_BRANDING_CURRENT__ || {}));
    });
    $('brandLogoFile')?.addEventListener('change', event => {
      const file = event.target.files?.[0]; if (!file) return;
      const current = { ...(window.__RRN_ADMIN_BRANDING_CURRENT__ || {}), logo_url: URL.createObjectURL(file) };
      renderPreview(current);
    });
    $('brandBackgroundFile')?.addEventListener('change', event => {
      const file = event.target.files?.[0]; if (!file) return;
      const current = { ...(window.__RRN_ADMIN_BRANDING_CURRENT__ || {}), login_background_url: URL.createObjectURL(file) };
      renderPreview(current);
    });
    const save = $('saveBrandingButton');
    if (save) save.onclick = saveBranding;
  }

  function boot() {
    ensureControls();
    bindInputs();
    setTimeout(loadBranding, 0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();