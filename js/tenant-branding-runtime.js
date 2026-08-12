(() => {
'use strict';
if(window.__RRN_TENANT_BRANDING_RUNTIME__)return;window.__RRN_TENANT_BRANDING_RUNTIME__=true;
const cfg=window.RRN_SUPABASE||{};if(!window.supabase?.createClient||!cfg.url||!cfg.anonKey)return;
const client=window.RRN_SUPABASE_CLIENT||window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const DEFAULT_LOGO='/img/icon-png.png';
function setToken(style,name,value){if(value)style.setProperty(name,value);}
function applyBrand(b={}){
  const r=document.documentElement.style;
  setToken(r,'--primary',b.primary_color);setToken(r,'--secondary',b.secondary_color);setToken(r,'--accent',b.accent_color);setToken(r,'--surface',b.surface_color);setToken(r,'--text',b.text_color);
  setToken(r,'--blue',b.primary_color);setToken(r,'--lilac',b.secondary_color);setToken(r,'--yellow',b.accent_color);setToken(r,'--beige',b.surface_color);
  setToken(r,'--rrn-primary',b.primary_color);setToken(r,'--rrn-navbar',b.primary_color);setToken(r,'--rrn-heading',b.primary_color);
  setToken(r,'--rrn-secondary',b.secondary_color);setToken(r,'--rrn-accent',b.accent_color);
  setToken(r,'--rrn-surface',b.surface_color);setToken(r,'--rrn-bg',b.surface_color);setToken(r,'--rrn-text',b.text_color);
  document.querySelectorAll('.brand-mark img,.mobile-brand img,.navbar-icon,.brand img').forEach(img=>{img.src=b.logo_url||DEFAULT_LOGO});
  const title=document.getElementById('brandTitle');const subtitle=document.getElementById('brandSubtitle');
  if(title)title.textContent=b.login_title||'Controle patrimonial com mais organização e eficiência';
  if(subtitle)subtitle.textContent=b.login_subtitle||'Gerencie equipamentos, responsáveis, setores e movimentações com praticidade e visão centralizada.';
  const panel=document.querySelector('.brand-panel');
  if(panel){
    if(b.login_background_url){const p=b.primary_color||'#163A4D',s=b.secondary_color||'#2F7D78';panel.style.setProperty('background-image',`linear-gradient(145deg,${p}e6,${s}bd),url('${b.login_background_url}')`,'important');panel.style.backgroundSize='cover';panel.style.backgroundPosition='center'}
    else{panel.style.removeProperty('background-image');panel.style.removeProperty('background-size');panel.style.removeProperty('background-position')}
  }
  if(b.tenant_name){document.querySelectorAll('[data-tenant-brand-name]').forEach(el=>el.textContent=b.tenant_name)}
  window.RRN_TENANT_BRANDING=b;
  window.dispatchEvent(new CustomEvent('rrn:tenantbranding',{detail:b}));
}
async function fromSlug(slug){const {data,error}=await client.rpc('get_public_tenant_branding',{p_slug:slug});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(row)applyBrand(row);else applyBrand({})}
async function fromSession(){const {data:{session}}=await client.auth.getSession();if(!session?.user)return;const {data:p}=await client.from('profiles').select('tenant_id').eq('user_id',session.user.id).maybeSingle();if(!p?.tenant_id)return;const {data:b}=await client.from('tenant_branding').select('*').eq('tenant_id',p.tenant_id).maybeSingle();applyBrand(b||{})}
(async()=>{try{const slug=new URLSearchParams(location.search).get('org');if(slug)await fromSlug(slug);else await fromSession()}catch(e){console.warn('RRN branding:',e)}})();
window.RRN_APPLY_TENANT_BRANDING=applyBrand;
})();