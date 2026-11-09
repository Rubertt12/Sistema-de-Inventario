(() => {
'use strict';
if (window.__RRN_SUPPORT_V4__) return; window.__RRN_SUPPORT_V4__=true;
const cfg=window.RRN_SUPABASE||{};
if(!cfg.url||!cfg.anonKey||!window.supabase?.createClient) return;
const client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'rrn-guest-support-auth'}});
const $=id=>document.getElementById(id);
const views=['quickStart','quickLogin','quickIdentify','quickHome','quickOpenTicket','quickChat','quickFinished'];
const state={user:null,customer:null,ticket:null,channels:[],busy:false,tickets:[],ticketFilter:'all',ticketSearch:''};
const labels={new:'Novo',assigned:'Atribuído',in_progress:'Em atendimento',waiting_requester:'Aguardando você',resolved:'Resolvido',closed:'Encerrado',reopened:'Reaberto'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(s)):'';
function view(id){views.forEach(k=>{if($(k))$(k).hidden=k!==id;});window.dispatchEvent(new CustomEvent('rrn:support-view',{detail:{id}}));}
function alert(id,msg=''){const el=$(id);if(!el)return;el.hidden=!msg;el.textContent=msg;}
function slug(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,'-');}
function friendly(e){const m=String(e?.message||'');if(/anonymous.*(disabled|not enabled)/i.test(m))return 'O acesso sem senha está temporariamente indisponível. Tente entrar com sua conta ou avise a equipe.';if(/rate limit/i.test(m))return 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.';if(/empresa|portal/i.test(m))return 'Não conseguimos identificar a empresa. Confira o nome/código do portal ou contate o suporte.';return m||'Não foi possível concluir. Tente novamente.';}
function busyButton(btn,on,label){if(!btn)return;btn.disabled=on;if(on){btn.dataset.old=btn.textContent;btn.textContent=label||'Aguarde...';}else{btn.textContent=btn.dataset.old||btn.textContent;delete btn.dataset.old;}}
async function sessionUser(){const {data,error}=await client.auth.getSession();if(error)throw error;return data.session?.user||null;}
async function loginAccount(e){
 e.preventDefault();if(state.busy)return;alert('quickLoginAlert');
 const email=$('quickLoginEmail').value.trim(),password=$('quickLoginPassword').value;
 if(!email||!password)return alert('quickLoginAlert','Informe seu e-mail e sua senha.');
 const btn=$('quickLoginForm').querySelector('[type=submit]');state.busy=true;busyButton(btn,true,'Validando acesso...');
 try{
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error)throw error;
  const user=data.user;if(!user||user.is_anonymous)throw new Error('Não foi possível validar esta conta.');
  const {data:customer,error:customerError}=await client.from('support_customers').select('id,user_id,tenant_id,name,email,phone,employee_number,status').eq('user_id',user.id).maybeSingle();
  if(customerError)throw customerError;
  if(!customer){await client.auth.signOut();throw new Error('Esta conta ainda não está vinculada ao Portal de Suporte. Confira o e-mail ou solicite o vínculo à empresa.');}
  if(customer.status!=='active'){await client.auth.signOut();throw new Error('Seu acesso ao suporte está bloqueado. Procure a equipe responsável.');}
  state.user=user;state.customer=customer;state.ticket=null;state.ticketFilter='all';state.ticketSearch='';
  $('quickLoginForm').reset();await showHome();
 }catch(err){console.error('[RRN chat] account login',err);alert('quickLoginAlert',friendly(err));}
 finally{state.busy=false;busyButton(btn,false);}
}
async function recoverPassword(){
 alert('quickLoginAlert');
 const email=$('quickLoginEmail').value.trim();
 if(!email)return alert('quickLoginAlert','Informe seu e-mail no campo acima para receber o link de recuperação.');
 const btn=$('quickForgotPassword');btn.disabled=true;
 try{
  const {error}=await client.auth.resetPasswordForEmail(email);
  if(error)throw error;
  alert('quickLoginAlert','Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.');
 }catch(err){console.error('[RRN chat] password recovery',err);alert('quickLoginAlert',friendly(err));}
 finally{btn.disabled=false;}
}
async function identify(e){
 e.preventDefault();if(state.busy)return;alert('quickIdentifyAlert');
 const name=$('quickName').value.trim(),email=$('quickEmail').value.trim(),phone=$('quickPhone').value.trim(),org=slug($('quickOrg').value),employee=$('quickEmployee').value.trim();
 if(!name)return alert('quickIdentifyAlert','Informe seu nome completo.');
 if(!email&&!phone)return alert('quickIdentifyAlert','Informe seu e-mail ou telefone para podermos retornar.');
 const btn=$('quickIdentifyForm').querySelector('[type=submit]');state.busy=true;busyButton(btn,true,'Identificando...');
 try{
  let user=await sessionUser();if(user&&!user.is_anonymous){await client.auth.signOut();user=null;}
  if(!user){const {data,error}=await client.auth.signInAnonymously({options:{data:{name,rrn_support_portal:true,rrn_support_tenant_slug:org||null}}});if(error)throw error;user=data.user;}
  if(!user?.is_anonymous)throw new Error('A sessão temporária não foi criada.');
  state.user=user;
  const {data,error}=await client.rpc('support_guest_bootstrap',{p_portal_slug:org||'',p_name:name,p_email:email||null,p_phone:phone||null,p_employee_number:employee||null});
  if(error)throw error;state.customer=Array.isArray(data)?data[0]:data;
  if(!state.customer?.id)throw new Error('Não foi possível concluir sua identificação.');
  await showHome();
 }catch(err){console.error('[RRN chat] identify',err);alert('quickIdentifyAlert',friendly(err));}
 finally{state.busy=false;busyButton(btn,false);}
}
async function restore(){
 const user=await sessionUser();if(!user)return false;
 const {data,error}=await client.from('support_customers').select('id,user_id,tenant_id,name,email,phone,employee_number,status').eq('user_id',user.id).maybeSingle();
 if(error)throw error;if(!data||data.status!=='active')return false;
 state.user=user;state.customer=data;return true;
}
async function showHome(){
 if(!state.customer)return; $('quickUserName').textContent=state.customer.name||'Usuário';$('quickAvatar').textContent=(state.customer.name||'U').trim().charAt(0).toUpperCase();
 view('quickHome');await loadTickets();
}
async function loadTickets(){
 const box=$('quickTicketList');box.innerHTML='<div class="quick-empty">Atualizando seus atendimentos...</div>';
 const {data,error}=await client.from('support_tickets').select('id,ticket_number,title,description,status,priority,opened_at,last_message_at,closed_at').eq('requester_id',state.customer.id).order('last_message_at',{ascending:false}).limit(30);
 if(error){box.innerHTML='<div class="quick-empty">Não foi possível carregar o histórico.</div>';alert('quickHomeAlert',friendly(error));return;}
 state.tickets=data||[];alert('quickHomeAlert');renderTicketList();
}
function renderTicketList(){
 const box=$('quickTicketList'),all=state.tickets||[];
 const open=all.filter(t=>!['closed','resolved'].includes(t.status)).length;
 const done=all.length-open;
 const summary=$('quickTicketSummary');if(summary)summary.innerHTML='<span><b>'+all.length+'</b><small>Total</small></span><span><b>'+open+'</b><small>Em andamento</small></span><span><b>'+done+'</b><small>Finalizados</small></span>';
 const q=state.ticketSearch.toLowerCase();
 const filtered=all.filter(t=>{
  const matchesFilter=state.ticketFilter==='all'||(state.ticketFilter==='open'?!['closed','resolved'].includes(t.status):['closed','resolved'].includes(t.status));
  const matchesSearch=!q||String(t.ticket_number||'').toLowerCase().includes(q)||String(t.title||'').toLowerCase().includes(q)||String(t.description||'').toLowerCase().includes(q);
  return matchesFilter&&matchesSearch;
 });
 if(!all.length){box.innerHTML='<div class="quick-empty quick-empty-card"><span>☏</span><b>Você ainda não tem chamados.</b><small>Abra seu primeiro chamado. O protocolo e todas as respostas ficarão organizados aqui.</small></div>';return;}
 if(!filtered.length){box.innerHTML='<div class="quick-empty">Nenhum chamado encontrado com esse filtro.</div>';return;}
 box.innerHTML=filtered.map(t=>'<button class="quick-ticket-row" type="button" data-ticket="'+esc(t.id)+'"><span class="quick-ticket-symbol">#</span><span class="quick-ticket-copy"><b>Protocolo #'+esc(t.ticket_number)+'</b><small>'+esc(t.title||'Solicitação')+' · '+esc(date(t.last_message_at||t.opened_at))+'</small></span><span class="quick-status '+esc(t.status)+'">'+esc(labels[t.status]||t.status)+'</span><span class="quick-arrow">›</span></button>').join('');
 box.querySelectorAll('[data-ticket]').forEach(b=>b.addEventListener('click',()=>openTicket(b.dataset.ticket).catch(err=>alert('quickHomeAlert',friendly(err)))));
}
async function createTicket(e){
 e.preventDefault();if(state.busy)return;alert('quickTicketAlert');
 const problem=$('quickProblem').value.trim(),machine=$('quickMachine').value.trim();if(problem.length<8)return alert('quickTicketAlert','Descreva o problema com pelo menos 8 caracteres.');
 const btn=$('quickTicketForm').querySelector('[type=submit]');state.busy=true;busyButton(btn,true,'Abrindo chamado...');
 try{
  const title=problem.length>80?problem.slice(0,77)+'...':problem;
  const {data,error}=await client.from('support_tickets').insert({requester_id:state.customer.id,machine_query:machine||null,title,description:problem,priority:'medium'}).select('*').single();
  if(error)throw error;state.ticket=data;$('quickTicketForm').reset();await openTicket(data.id);
 }catch(err){console.error('[RRN chat] create ticket',err);alert('quickTicketAlert',friendly(err));}
 finally{state.busy=false;busyButton(btn,false);}
}
async function openTicket(id){
 alert('quickChatAlert');
 const {data,error}=await client.from('support_tickets').select('*').eq('id',id).eq('requester_id',state.customer.id).single();
 if(error)throw error;state.ticket=data;view('quickChat');renderTicket();await loadMessages();subscribe();
}
function renderTicket(){
 const t=state.ticket;if(!t)return;
 $('quickTicketNumber').textContent='PROTOCOLO #'+t.ticket_number;$('quickTicketTitle').textContent=t.title||'Atendimento';
 $('quickTicketStatus').textContent=labels[t.status]||t.status;$('quickTicketStatus').className='quick-status '+t.status;
 $('quickContextStatus').textContent=t.status==='closed'?'Atendimento encerrado':t.assigned_to?'Atendimento com a equipe':'Solicitação registrada';
 $('quickTicketMeta').textContent='Aberto em '+date(t.opened_at)+(t.machine_query?' · '+t.machine_query:'');
 const closed=t.status==='closed';$('quickMessageInput').disabled=closed;$('quickSendButton').disabled=closed;$('quickClosedNote').hidden=!closed;$('quickMessageInput').placeholder=closed?'Este chamado foi encerrado.':'Escreva sua mensagem...';
}
async function loadMessages(){
 if(!state.ticket)return;const box=$('quickMessages');
 const {data,error}=await client.from('support_ticket_messages').select('id,sender_id,sender_type,message,created_at').eq('ticket_id',state.ticket.id).order('created_at',{ascending:true});
 if(error){console.error('[RRN chat] messages',error);box.innerHTML='<div class="quick-empty">Não foi possível carregar as mensagens. Tente atualizar.</div>';return;}
 if(!data?.length){box.innerHTML='<div class="quick-first-message"><span>✦</span><b>Conversa iniciada</b><p>Sua solicitação foi registrada. Nossa equipe poderá responder por aqui. Você pode enviar novas informações a qualquer momento.</p></div>';return;}
 box.innerHTML=data.map(m=>{const own=m.sender_id===state.user?.id;const sender=m.sender_type==='support'?'Equipe de suporte':own?'Você':'Atendimento';return '<article class="quick-message '+(own?'own':'')+'"><strong>'+esc(sender)+'</strong><p>'+esc(m.message)+'</p><small>'+esc(date(m.created_at))+'</small></article>';}).join('');
 box.scrollTop=box.scrollHeight;
}
async function sendMessage(e){
 e.preventDefault();const input=$('quickMessageInput'),message=input.value.trim();if(!message||!state.ticket||state.ticket.status==='closed'||state.busy)return;
 const btn=$('quickSendButton');state.busy=true;btn.disabled=true;
 try{const {error}=await client.from('support_ticket_messages').insert({ticket_id:state.ticket.id,message});if(error)throw error;input.value='';await loadMessages();}
 catch(err){console.error('[RRN chat] send',err);alert('quickChatAlert',friendly(err));}
 finally{state.busy=false;btn.disabled=false;input.focus();}
}
function subscribe(){
 state.channels.forEach(c=>client.removeChannel(c));state.channels=[];
 if(!state.ticket)return;
 const msg=client.channel('rrn-chat-msg-'+state.ticket.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'support_ticket_messages',filter:'ticket_id=eq.'+state.ticket.id},()=>loadMessages()).subscribe();
 const ticket=client.channel('rrn-chat-ticket-'+state.ticket.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'support_tickets',filter:'id=eq.'+state.ticket.id},p=>{state.ticket=p.new;renderTicket();}).subscribe();
 state.channels=[msg,ticket];
}
async function changeIdentity(){if(!confirm('Deseja sair desta sessão de atendimento neste dispositivo?'))return;state.channels.forEach(c=>client.removeChannel(c));state.channels=[];await client.auth.signOut();state.user=state.customer=state.ticket=null;state.tickets=[];state.ticketFilter='all';state.ticketSearch='';$('quickIdentifyForm').reset();$('quickLoginForm')?.reset();view('quickStart');}
async function endTicket(){
 if(!state.ticket||state.ticket.status==='closed')return;if(!confirm('Deseja encerrar este atendimento?'))return;
 try{const {data,error}=await client.rpc('support_guest_close_ticket',{p_ticket_id:state.ticket.id});if(error)throw error;state.ticket=Array.isArray(data)?data[0]:data;renderTicket();await showHome();}
 catch(err){alert('quickHomeAlert',friendly(err));}
}
function bind(){
 $('quickGuestBtn')?.addEventListener('click',()=>{view('quickIdentify');$('quickName')?.focus();});
 $('quickAccountBtn')?.addEventListener('click',()=>{view('quickLogin');$('quickLoginEmail')?.focus();});
 $('quickLoginForm')?.addEventListener('submit',loginAccount);
 $('quickForgotPassword')?.addEventListener('click',recoverPassword);
 document.querySelectorAll('[data-quick-start]').forEach(b=>b.addEventListener('click',()=>view('quickStart')));
 $('quickIdentifyForm')?.addEventListener('submit',identify);$('quickTicketForm')?.addEventListener('submit',createTicket);$('quickMessageForm')?.addEventListener('submit',sendMessage);
 $('quickNewTicket')?.addEventListener('click',()=>{alert('quickTicketAlert');$('quickTicketForm').reset();view('quickOpenTicket');});
 $('quickChangeIdentity')?.addEventListener('click',changeIdentity);
 document.querySelectorAll('[data-quick-back]').forEach(b=>b.addEventListener('click',()=>view('quickStart')));
 document.querySelectorAll('[data-quick-home]').forEach(b=>b.addEventListener('click',showHome));
 $('quickNewAttendance')?.addEventListener('click',showHome);
 $('quickTicketSearch')?.addEventListener('input',e=>{state.ticketSearch=e.target.value||'';renderTicketList();});
 document.querySelectorAll('[data-ticket-filter]').forEach(b=>b.addEventListener('click',()=>{state.ticketFilter=b.dataset.ticketFilter;document.querySelectorAll('[data-ticket-filter]').forEach(x=>x.classList.toggle('active',x===b));renderTicketList();}));
 $('quickChatMenu')?.addEventListener('click',()=>{if(state.ticket?.status==='closed')return;const choice=confirm('Deseja encerrar este atendimento?\n\nOK = Encerrar · Cancelar = Continuar conversando');if(choice)endTicket();});
 $('quickMessageInput')?.addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,110)+'px';});
 const org=new URLSearchParams(location.search).get('org');if(org&&$('quickOrg'))$('quickOrg').value=org;
}
async function boot(){bind();try{if(await restore())await showHome();}catch(e){console.error('[RRN chat] restore',e);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.RRNSupportQuick={showOnly:view,refresh:showHome};
})();