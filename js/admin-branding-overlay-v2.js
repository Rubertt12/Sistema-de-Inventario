(() => {
  'use strict';
  if (window.__RRN_ADMIN_BRANDING_OVERLAY_V2__) return;
  window.__RRN_ADMIN_BRANDING_OVERLAY_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return;
  const client = window.RRN_SUPABASE_CLIENT || window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.RRN_SUPABASE_CLIENT = client;

  const $ = id => document.getElementById(id);
  let currentOverlay = true;
  let selectedBackgroundUrl = '';
  let localPreviewUrl = '';

  function tenantId() {
    return $('brandingTenantSelector')?.value || $('tenantSelector')?.value || '';
  }

  function showToast(text) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function previewBackgroundUrl() {
    return localPreviewUrl || selectedBackgroundUrl || window.__RRN_ADMIN_BRANDING_CURRENT__?.login_background_url || '';
  }

  function applyPreview() {
    const preview = $('brandPreview');
    if (!preview) return;
    const bg = previewBackgroundUrl();
    const primary = $('brandPrimary')?.value || '#163A4D';
    const secondary = $('brandSecondary')?.value || '#2F7D78';
    if (!bg) {
      preview.style.backgroundImage = `linear-gradient(145deg,${primary},${secondary})`;
      return;
    }
    preview.style.backgroundImage = currentOverlay
      ? `linear-gradient(145deg,${primary}e6,${secondary}b8),url(${JSON.stringify(bg)})`
      : `url(${JSON.stringify(bg)})`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
  }

  async function saveOverlayPreference(value) {
    const id = tenantId();
    if (!id) return;
    const { data, error } = await client.from('tenant_branding')
      .update({ login_background_overlay: value, updated_at: new Date().toISOString() })
      .eq('tenant_id', id)
      .select('tenant_id')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const { error: insertError } = await client.from('tenant_branding')
        .upsert({ tenant_id: id, login_background_overlay: value }, { onConflict: 'tenant_id' });
      if (insertError) throw insertError;
    }
  }

  function ensureControl() {
    if ($('brandLoginOverlay')) return;
    const backgroundInput = $('brandBackgroundFile');
    const uploadBox = backgroundInput?.closest('.upload-box');
    const form = document.querySelector('[data-view-panel="branding"] .branding-form');
    if (!form) return;

    const control = document.createElement('label');
    control.className = 'branding-overlay-control';
    control.innerHTML = `
      <div class="branding-overlay-copy">
        <strong>Camada de cor sobre o fundo do login</strong>
        <small>Desative para mostrar a imagem original, sem filtro ou gradiente por cima.</small>
      </div>
      <span class="branding-switch">
        <input type="checkbox" id="brandLoginOverlay" checked>
        <span aria-hidden="true"></span>
      </span>`;
    if (uploadBox?.parentElement) uploadBox.parentElement.insertAdjacentElement('afterend', control);
    else form.insertBefore(control, $('saveBrandingButton'));

    const style = document.createElement('style');
    style.textContent = `.branding-overlay-control{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:14px 0;padding:14px 15px;border:1px solid var(--rrn-border);border-radius:13px;background:var(--rrn-surface-soft);cursor:pointer}.branding-overlay-copy strong,.branding-overlay-copy small{display:block}.branding-overlay-copy strong{color:var(--rrn-heading);font-size:.75rem}.branding-overlay-copy small{margin-top:4px;color:var(--rrn-muted);font-size:.65rem;line-height:1.45}.branding-switch{position:relative;flex:0 0 auto;width:44px;height:24px}.branding-switch input{position:absolute;opacity:0;pointer-events:none}.branding-switch>span{position:absolute;inset:0;border:1px solid var(--rrn-border);border-radius:999px;background:var(--rrn-surface-2);transition:.18s}.branding-switch>span:before{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--rrn-muted);transition:.18s}.branding-switch input:checked+span{background:var(--rrn-secondary);border-color:var(--rrn-secondary)}.branding-switch input:checked+span:before{transform:translateX(20px);background:#fff}@media(max-width:600px){.branding-overlay-control{align-items:flex-start}}`;
    document.head.appendChild(style);

    $('brandLoginOverlay').addEventListener('change', async event => {
      currentOverlay = event.target.checked;
      applyPreview();
      try {
        await saveOverlayPreference(currentOverlay);
        if (window.__RRN_ADMIN_BRANDING_CURRENT__) window.__RRN_ADMIN_BRANDING_CURRENT__.login_background_overlay = currentOverlay;
        showToast(currentOverlay ? 'Camada de cor ativada no login.' : 'Fundo do login configurado sem camada de cor.');
      } catch (error) {
        event.target.checked = !currentOverlay;
        currentOverlay = event.target.checked;
        applyPreview();
        showToast(error.message || 'Não foi possível salvar essa opção.');
      }
    });
  }

  async function loadPreference() {
    ensureControl();
    const id = tenantId();
    if (!id || !$('brandLoginOverlay')) return;
    const { data, error } = await client.from('tenant_branding')
      .select('login_background_overlay,login_background_url')
      .eq('tenant_id', id)
      .maybeSingle();
    if (error) return console.warn('RRN branding overlay:', error);
    currentOverlay = data?.login_background_overlay !== false;
    selectedBackgroundUrl = data?.login_background_url || '';
    localPreviewUrl = '';
    $('brandLoginOverlay').checked = currentOverlay;
    applyPreview();
  }

  function bindPreviewEvents() {
    ['brandPrimary','brandSecondary'].forEach(id => $(id)?.addEventListener('input', () => setTimeout(applyPreview, 0)));
    $('brandBackgroundFile')?.addEventListener('change', event => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      const file = event.target.files?.[0];
      localPreviewUrl = file ? URL.createObjectURL(file) : '';
      setTimeout(applyPreview, 0);
    });
    $('brandingTenantSelector')?.addEventListener('change', () => setTimeout(loadPreference, 80));
    $('tenantSelector')?.addEventListener('change', () => setTimeout(loadPreference, 120));
    $('openBrandLoginButton')?.addEventListener('click', event => {
      const slug = $('tenantSlug')?.textContent?.trim();
      if (!slug || slug === '—') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.open(`${location.origin}/login.html?org=${encodeURIComponent(slug)}&preview=1`, '_blank', 'noopener');
    }, true);
  }

  function boot() {
    ensureControl();
    bindPreviewEvents();
    setTimeout(loadPreference, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();