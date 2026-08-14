(() => {
  'use strict';
  if (window.__RRN_SUPPORT_PROFILE_UI__) return;
  window.__RRN_SUPPORT_PROFILE_UI__ = true;

  const isDesk = Boolean(document.querySelector('.desk-body,#deskTicketList'));
  const isPortal = Boolean(document.querySelector('.support-portal-body,#supportApp'));
  const isQuick = Boolean(document.querySelector('.quick-body,#quickMessages'));
  if (!isDesk && !isPortal && !isQuick) return;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const userSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>';
  let client=null, session=null, supportRow=null, customerRow=null, participantCache=new Map();

  async function waitClient(){for(let i=0;i<120;i++){client=window.RRN_SUPABASE_CLIENT||window.RRN_GET_SUPABASE_CLIENT?.()||null;if(client)return client;await new Promise(r=>setTimeout(r,50));}return null;}
  function initials(name){const p=String(name||'').trim().split(/\s+/).filter(Boolean);return (p[0]?.[0]||'S')+(p.length>1?(p[p.length-1][0]||''):'');}
  function avatar(url,name,support=false){return url?`<span class="rrn-chat-avatar${support?' support':''}"><img src="${esc(url)}" alt=""></span>`:`<span class="rrn-chat-avatar${support?' support':''}">${support?esc(initials(name)):userSvg}</span>`;}

  async function resolveTicketId(){
    const active=document.querySelector('.desk-ticket-card.active[data-ticket-id],.support-ticket-item.active[data-ticket-id]');
    if(active?.dataset.ticketId)return active.dataset.ticketId;
    const numberText=$('quickTicketNumber')?.textContent||'';
    const number=(numberText.match(/#(\d+)/)||[])[1];
    if(number){const{data}=await client.from('support_tickets').select('id').eq('ticket_number',Number(number)).maybeSingle();return data?.id||null;}
    return null;
  }

  async function loadParticipants(ticketId){
    if(!ticketId)return new Map();
    if(participantCache.has(ticketId))return participantCache.get(ticketId);
    const {data,error}=await client.rpc('support_chat_participant_profiles',{p_ticket_id:ticketId});
    const map=new Map();
    if(!error)(data||[]).forEach(row=>map.set(row.sender_id,row));
    participantCache.set(ticketId,map);
    return map;
  }

  async function decorateMessages(){
    const ticketId=await resolveTicketId(); if(!ticketId)return;
    const profiles=await loadParticipants(ticketId);
    const selectors=['#deskMessages .desk-message','#supportMessages .support-message','#quickMessages .quick-message'];
    document.querySelectorAll(selectors.join(',')).forEach(article=>{
      if(article.dataset.rrnIdentity==='1')return;
      const strong=article.querySelector(':scope > strong'); if(!strong)return;
      const support=/^suporte$/i.test(strong.textContent.trim())||article.classList.contains('support');
      let name=strong.textContent.trim(); let url=null;
      if(support){
        const text=article.textContent;
        const candidate=[...profiles.values()].find(p=>p.sender_type==='support'&&text.includes(strong.textContent));
        const any=[...profiles.values()].find(p=>p.sender_type==='support');
        const row=candidate||any; name=row?.display_name||'Suporte'; url=row?.avatar_url||null;
      } else {
        name=isDesk ? (strong.textContent.trim()||'Usuário') : 'Você';
      }
      const head=document.createElement('div'); head.className='rrn-chat-head';
      head.innerHTML=`${avatar(url,name,support)}<div class="rrn-chat-author"><strong>${support?'Suporte':'Usuário'}</strong><span>${support?'– '+esc(name):esc(name)}</span></div>`;
      strong.replaceWith(head); article.dataset.rrnIdentity='1';
    });
  }

  async function uploadAvatar(file,folder){
    if(!file)return null; if(!file.type.startsWith('image/'))throw new Error('Selecione uma imagem válida.'); if(file.size>2*1024*1024)throw new Error('A imagem deve ter no máximo 2 MB.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path=`${session.user.id}/${folder}.${ext||'jpg'}`;
    const{error}=await client.storage.from('support-avatars').upload(path,file,{upsert:true,contentType:file.type}); if(error)throw error;
    return client.storage.from('support-avatars').getPublicUrl(path).data.publicUrl+`?v=${Date.now()}`;
  }

  function ensureModal(mode){
    if($('rrnProfileModal'))return;
    const modal=document.createElement('div'); modal.id='rrnProfileModal'; modal.className='rrn-profile-modal'; modal.hidden=true;
    modal.innerHTML=`<section class="rrn-profile-card"><div class="rrn-profile-head"><h2>${mode==='support'?'Perfil do suporte':'Meu perfil'}</h2><button class="rrn-profile-close" id="rrnProfileClose" type="button">×</button></div><div class="rrn-profile-preview" id="rrnProfilePreview"></div><form class="rrn-profile-form" id="rrnProfileForm"><label>Nome de exibição<input id="rrnProfileName" type="text" maxlength="80" required></label><label>Foto de perfil<input id="rrnProfileFile" type="file" accept="image/png,image/jpeg,image/webp"></label><small>PNG, JPG ou WebP · máximo 2 MB.</small><div class="rrn-profile-actions"><button class="support-btn desk-btn" type="button" id="rrnProfileCancel">Cancelar</button><button class="support-btn desk-btn primary" type="submit" id="rrnProfileSave">Salvar</button></div></form></section>`;
    document.body.appendChild(modal);
    const close=()=>modal.hidden=true; $('rrnProfileClose').onclick=close; $('rrnProfileCancel').onclick=close; modal.addEventListener('click',e=>{if(e.target===modal)close();});
    $('rrnProfileFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=()=>{$('rrnProfilePreview').innerHTML=`<img src="${r.result}" alt="">`;};r.readAsDataURL(f);}});
    $('rrnProfileForm').onsubmit=async e=>{e.preventDefault();const btn=$('rrnProfileSave');btn.disabled=true;try{const name=$('rrnProfileName').value.trim();const file=$('rrnProfileFile').files?.[0];if(mode==='support'){let url=supportRow?.avatar_url||null;if(file)url=await uploadAvatar(file,'support');const{data,error}=await client.from('support_staff').update({display_name:name,avatar_url:url}).eq('user_id',session.user.id).select('*').single();if(error)throw error;supportRow=data;}else{let url=customerRow?.avatar_url||null;if(file)url=await uploadAvatar(file,'customer');const{data,error}=await client.from('support_customers').update({name,avatar_url:url}).eq('user_id',session.user.id).select('*').single();if(error)throw error;customerRow=data;}
      participantCache.clear(); paintProfile(); close(); setTimeout(decorateMessages,50);
    }catch(err){alert(err.message||'Não foi possível salvar o perfil.');}finally{btn.disabled=false;}};
  }

  function openProfile(mode){ensureModal(mode);const row=mode==='support'?supportRow:customerRow;const name=row?.display_name||row?.name||session?.user?.email||'Usuário';$('rrnProfileName').value=name;$('rrnProfileFile').value='';$('rrnProfilePreview').innerHTML=row?.avatar_url?`<img src="${esc(row.avatar_url)}" alt="">`:avatar(null,name,mode==='support');$('rrnProfileModal').hidden=false;}

  function paintProfile(){
    if(isPortal&&customerRow){
      const card=document.querySelector('.support-user-card'); if(card&&!card.dataset.rrnProfile){card.dataset.rrnProfile='1';card.innerHTML=`<div class="support-user-profile-row"><div class="support-user-avatar" id="rrnPortalAvatar"></div><div class="support-user-profile-copy"><small id="supportCompanyName">Portal de suporte</small><strong id="supportCustomerName"></strong><span id="supportCustomerMeta"></span></div><button type="button" class="support-btn ghost support-profile-edit-btn" id="rrnEditCustomerProfile" title="Editar perfil">✎</button></div>`;$('rrnEditCustomerProfile').onclick=()=>openProfile('customer');}
      const av=$('rrnPortalAvatar'); if(av)av.innerHTML=customerRow.avatar_url?`<img src="${esc(customerRow.avatar_url)}" alt="">`:userSvg;
      if($('supportCustomerName'))$('supportCustomerName').textContent=customerRow.name||session.user.email||'Usuário';
      if($('supportCustomerMeta'))$('supportCustomerMeta').textContent=[customerRow.employee_number?`Matrícula ${customerRow.employee_number}`:null,customerRow.email||session.user.email].filter(Boolean).join(' · ');
    }
    if(isDesk&&supportRow){
      let btn=$('rrnSupportProfileBtn'); if(!btn){btn=document.createElement('button');btn.id='rrnSupportProfileBtn';btn.type='button';btn.className='desk-btn';btn.textContent='Meu perfil';btn.onclick=()=>openProfile('support');document.querySelector('.desk-top-actions')?.prepend(btn);}
    }
  }

  async function boot(){
    if(!await waitClient())return; const{data:{session:s}}=await client.auth.getSession();session=s;if(!session?.user){setInterval(decorateMessages,900);return;}
    if(isDesk){const{data}=await client.from('support_staff').select('*').eq('user_id',session.user.id).maybeSingle();supportRow=data||null;}
    if(isPortal){const{data}=await client.from('support_customers').select('*').eq('user_id',session.user.id).maybeSingle();customerRow=data||null;}
    paintProfile(); decorateMessages();
    new MutationObserver(()=>{clearTimeout(boot.t);boot.t=setTimeout(decorateMessages,60);}).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot().catch(console.warn),{once:true});else boot().catch(console.warn);
})();
