(() => {
 'use strict';
 const toolbar=document.querySelector('.desk-toolbar');
 const list=document.getElementById('deskTicketList');
 if(!toolbar||!list||toolbar.dataset.movideskUx==='2') return;
 toolbar.dataset.movideskUx='2';
 const makeSelect=(id,label,options)=>{
  const wrap=document.createElement('label');wrap.className='desk-quick-filter';wrap.setAttribute('aria-label',label);
  const select=document.createElement('select');select.id=id;select.setAttribute('aria-label',label);
  options.forEach(([value,text])=>{const o=document.createElement('option');o.value=value;o.textContent=text;select.appendChild(o);});
  wrap.appendChild(select);return {wrap,select};
 };
 const searchWrap=document.createElement('label');searchWrap.className='desk-search-wrap';searchWrap.setAttribute('aria-label','Buscar chamados');
 const search=document.createElement('input');search.type='search';search.id='deskQuickSearch';search.placeholder='Buscar protocolo, assunto ou solicitante...';search.autocomplete='off';searchWrap.appendChild(search);
 const priority=makeSelect('deskPriorityFilter','Filtrar por prioridade',[['all','Todas prioridades'],['critical','Crítica'],['high','Alta'],['medium','Média'],['low','Baixa']]);
 const sort=makeSelect('deskSortOrder','Ordenar chamados',[['newest','Mais recentes'],['oldest','Mais antigos'],['priority','Maior prioridade']]);
 toolbar.append(priority.wrap,sort.wrap,searchWrap);
 const count=document.getElementById('deskListCount');
 const apply=()=>{
  const q=search.value.trim().toLocaleLowerCase('pt-BR'),p=priority.select.value;
  let visible=0;
  list.querySelectorAll('[data-ticket-id]').forEach(card=>{
   const okText=!q||card.innerText.toLocaleLowerCase('pt-BR').includes(q);
   const okPriority=p==='all'||card.dataset.priority===p;
   card.hidden=!(okText&&okPriority);if(!card.hidden)visible++;
  });
  const total=list.querySelectorAll('[data-ticket-id]').length;
  if(count)count.textContent=(q||p!=='all')?visible+' de '+total+' chamados':total+' chamados';
 };
 const sortCards=()=>{
  const cards=[...list.querySelectorAll('[data-ticket-id]')];
  cards.sort((a,b)=>{
   if(sort.select.value==='priority'){
    const rank={critical:0,high:1,medium:2,low:3};
    return (rank[a.dataset.priority]??4)-(rank[b.dataset.priority]??4);
   }
   const delta=new Date(a.dataset.opened||0)-new Date(b.dataset.opened||0);
   return sort.select.value==='oldest'?delta:-delta;
  });
  cards.forEach(card=>list.appendChild(card));apply();
 };
 search.addEventListener('input',apply);priority.select.addEventListener('change',apply);sort.select.addEventListener('change',sortCards);
 list.addEventListener('click',()=>requestAnimationFrame(apply));
 new MutationObserver(()=>requestAnimationFrame(apply)).observe(list,{childList:true,subtree:true});
 window.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();search.focus();}if(e.key==='Escape'&&document.activeElement===search){search.value='';apply();search.blur();}});
})();