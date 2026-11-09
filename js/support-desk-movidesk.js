(() => {
 'use strict';
 const toolbar=document.querySelector('.desk-toolbar');
 const list=document.getElementById('deskTicketList');
 if(!toolbar||!list||toolbar.dataset.movideskUx==='1') return;
 toolbar.dataset.movideskUx='1';
 const wrap=document.createElement('label');
 wrap.className='desk-search-wrap';
 wrap.setAttribute('aria-label','Buscar chamados');
 const input=document.createElement('input');
 input.type='search'; input.id='deskQuickSearch'; input.placeholder='Buscar por assunto, solicitante ou número...';
 input.autocomplete='off';
 wrap.appendChild(input); toolbar.appendChild(wrap);
 const count=document.getElementById('deskListCount');
 const filterCards=()=>{
   const q=input.value.trim().toLocaleLowerCase('pt-BR');
   let visible=0;
   list.querySelectorAll('[data-ticket-id]').forEach(card=>{
     const match=!q||card.innerText.toLocaleLowerCase('pt-BR').includes(q);
     card.hidden=!match;
     if(match) visible++;
   });
   if(count) count.textContent=q?visible+' de '+list.querySelectorAll('[data-ticket-id]').length+' chamados':list.querySelectorAll('[data-ticket-id]').length+' chamados';
 };
 input.addEventListener('input',filterCards);
 new MutationObserver(filterCards).observe(list,{childList:true,subtree:true,characterData:true});
})();
