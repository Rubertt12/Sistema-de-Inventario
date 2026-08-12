(() => {
'use strict';
if(window.__RRN_THEME_MODE__)return;window.__RRN_THEME_MODE__=true;
const KEY='rrn_theme_mode';
function ensureInventoryFix(){if(!document.getElementById('setoresContainer')&&!/dashboard\.html$/i.test(location.pathname))return;if(document.querySelector('link[data-rrn-dark-inventory-fix]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='/style/dark-inventory-fix.css';l.setAttribute('data-rrn-dark-inventory-fix','1');document.head.appendChild(l)}
function preferred(){const saved=localStorage.getItem(KEY);if(saved==='dark'||saved==='light')return saved;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function apply(mode){document.documentElement.dataset.theme=mode;localStorage.setItem(KEY,mode);document.querySelectorAll('[data-rrn-theme-toggle]').forEach(btn=>{btn.setAttribute('aria-pressed',String(mode==='dark'));btn.textContent=mode==='dark'?'Modo claro':'Modo escuro'});window.dispatchEvent(new CustomEvent('rrn:themechange',{detail:{mode}}))}
function toggle(){apply(document.documentElement.dataset.theme==='dark'?'light':'dark')}
function makeButton(extra=''){const b=document.createElement('button');b.type='button';b.className=`rrn-theme-toggle ${extra}`.trim();b.setAttribute('data-rrn-theme-toggle','1');b.setAttribute('aria-label','Alternar tema claro e escuro');b.addEventListener('click',toggle);return b}
function mount(){ensureInventoryFix();if(document.querySelector('[data-rrn-theme-toggle]'))return;const dropdown=document.getElementById('userDropdown');if(dropdown){const b=makeButton();dropdown.insertBefore(b,dropdown.firstChild);apply(document.documentElement.dataset.theme||preferred());return}const topbar=document.querySelector('.topbar');if(topbar){const b=makeButton();topbar.insertBefore(b,topbar.lastElementChild);apply(document.documentElement.dataset.theme||preferred());return}if(document.querySelector('.auth-shell')){document.body.appendChild(makeButton('rrn-theme-toggle--floating'));apply(document.documentElement.dataset.theme||preferred())}}
ensureInventoryFix();apply(preferred());if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.RRN_THEME={get:()=>document.documentElement.dataset.theme,set:apply,toggle};
})();