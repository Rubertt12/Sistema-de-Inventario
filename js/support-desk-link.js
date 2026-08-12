(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_LINK__) return;
  window.__RRN_SUPPORT_DESK_LINK__ = true;
  function mount(){
    const actions=document.querySelector('.dashboard-actions');
    if(actions&&!actions.querySelector('[data-support-desk-link]')){
      const button=document.createElement('button');button.type='button';button.dataset.supportDeskLink='1';button.textContent='🎫 Central de Chamados';button.addEventListener('click',()=>location.href='/chamados.html');actions.appendChild(button);
    }
    const dropdown=document.getElementById('userDropdown');
    if(dropdown&&!dropdown.querySelector('[data-support-desk-link]')){
      const button=document.createElement('button');button.type='button';button.dataset.supportDeskLink='1';button.textContent='🎫 Central de Chamados';button.addEventListener('click',event=>{event.stopPropagation();location.href='/chamados.html';});const config=dropdown.querySelector('button[onclick*="openConfigModal"]');dropdown.insertBefore(button,config||dropdown.firstChild);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
})();
