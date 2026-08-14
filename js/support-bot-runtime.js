(() => {
  'use strict';
  if (window.__RRN_SUPPORT_BOT_RUNTIME__) return;
  window.__RRN_SUPPORT_BOT_RUNTIME__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false, storageKey:'rrn-guest-support-auth' } });
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let config = null;
  let transcript = [];
  let observer = null;
  let armed = false;

  function ensureUi(){
    if ($('quickBot')) return;
    const ticket = $('quickOpenTicket');
    if (!ticket) return;
    const bot = document.createElement('section');
    bot.id='quickBot'; bot.className='quick-chat quick-bot'; bot.hidden=true;
    bot.innerHTML=`<header class="quick-chat-head"><div><small>Triagem automática</small><strong id="quickBotName">Assistente RRN</strong></div><span>Bot</span></header>
      <div class="quick-chat-meta">O bot tenta resolver primeiro. Você pode chamar um atendente a qualquer momento.</div>
      <div class="quick-bot-asset"><label><span>Equipamento ou usuário</span><input id="quickBotAsset" autocomplete="off" placeholder="Hostname, patrimônio, serial ou seu usuário"></label><button id="quickBotFindAsset" type="button">Identificar</button><small id="quickBotAssetStatus">Se deixar vazio, o RRN tenta localizar pelo usuário informado na identificação.</small></div>
      <div class="quick-messages" id="quickBotMessages"></div>
      <form class="quick-compose quick-bot-compose" id="quickBotForm"><input id="quickBotInput" autocomplete="off" placeholder="Conte o que está acontecendo..."><button class="quick-btn primary" type="submit">Enviar</button></form>
      <div class="quick-bot-actions"><button type="button" id="quickBotSolved">Resolvi com o bot</button><button type="button" id="quickBotHandoff">Falar com atendente</button></div>`;
    ticket.insertAdjacentElement('beforebegin',bot);
    $('quickBotForm').addEventListener('submit',onMessage);
    $('quickBotHandoff').addEventListener('click',handoff);
    $('quickBotSolved').addEventListener('click',resolved);
    $('quickBotFindAsset').addEventListener('click',resolveAsset);
  }

  async function loadConfig(){
    const org = new URLSearchParams(location.search).get('org') || null;
    const {data,error}=await client.rpc('get_support_chat_bot_config',{p_portal_slug:org});
    if(error){ console.warn('RRN bot config:',error); return null; }
    return Array.isArray(data)?data[0]:data;
  }

  function addMessage(type,text){
    const box=$('quickBotMessages'); if(!box) return;
    transcript.push({type,text});
    const item=document.createElement('article'); item.className=`quick-message ${type==='user'?'own':'bot'}`;
    item.innerHTML=`<strong>${type==='user'?'Você':esc(config?.bot_name||'Assistente RRN')}</strong><p>${esc(text)}</p>`;
    box.appendChild(item); box.scrollTop=box.scrollHeight;
  }

  function normalize(value){ return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function ruleFor(text){
    const input=normalize(text);
    const rules=Array.isArray(config?.rules)?config.rules:[];
    return rules.find(rule => (Array.isArray(rule?.keywords)?rule.keywords:[]).some(k=>input.includes(normalize(k))));
  }

  async function onMessage(event){
    event.preventDefault();
    const input=$('quickBotInput'); const text=input.value.trim(); if(!text) return;
    input.value=''; addMessage('user',text);
    const rule=ruleFor(text);
    if(rule?.response){ setTimeout(()=>addMessage('bot',rule.response),180); return; }
    setTimeout(()=>addMessage('bot',config?.handoff_message||'Não encontrei uma resposta automática para isso. Posso encaminhar você para a equipe de suporte.'),180);
  }

  async function customerId(){
    const {data:{session}}=await client.auth.getSession(); if(!session?.user?.id) return null;
    const {data}=await client.from('support_customers').select('id').eq('user_id',session.user.id).eq('status','active').maybeSingle();
    return data?.id||null;
  }

  async function resolveAsset(){
    const btn=$('quickBotFindAsset'); const status=$('quickBotAssetStatus'); if(!btn||!status) return;
    btn.disabled=true; status.textContent='Procurando equipamento...';
    try{
      const requester=await customerId(); if(!requester) throw new Error('Identificação não encontrada.');
      const query=$('quickBotAsset').value.trim();
      const {data,error}=await client.rpc('support_resolve_requester_asset',{p_requester_id:requester,p_query:query});
      if(error) throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(!row){ status.textContent='Não encontrei um equipamento único. Você ainda pode seguir para o atendente.'; return null; }
      const label=[row.asset_hostname,row.asset_tag,row.asset_serial,row.asset_display].filter(Boolean).join(' · ');
      status.textContent=`Equipamento identificado: ${label}`;
      $('quickBotAsset').dataset.resolvedKey=row.inventory_asset_key||'';
      if(!$('quickBotAsset').value.trim()) $('quickBotAsset').value=row.asset_hostname||row.asset_tag||row.asset_serial||row.inventory_asset_key||'';
      return row;
    }catch(error){ status.textContent=error?.message||'Não foi possível identificar o equipamento.'; return null; }
    finally{ btn.disabled=false; }
  }

  function handoff(){
    const machine=$('quickBotAsset')?.value.trim()||'';
    const summary=transcript.filter(x=>x.type==='user').map(x=>x.text).join('\n');
    if($('quickMachine')) $('quickMachine').value=machine;
    if($('quickProblem')) $('quickProblem').value=summary||'Solicitação encaminhada pela triagem automática.';
    $('quickBot').hidden=true;
    $('quickOpenTicket').hidden=false;
    const title=$('quickOpenTicket').querySelector('h2'); if(title) title.textContent='Confirme os dados do atendimento';
    const info=$('quickOpenTicket').querySelector('.quick-info'); if(info) info.textContent='Ao abrir o chamado, o equipamento identificado ficará como Aguardando manutenção até a equipe técnica assumir.';
  }

  async function resolved(){
    transcript=[];
    $('quickBot').hidden=true;
    $('quickStart').hidden=false;
    try{ await client.auth.signOut(); }catch{}
  }

  async function activate(){
    if(armed) return;
    config=await loadConfig();
    if(!config?.enabled) return;
    armed=true; ensureUi();
    $('quickBotName').textContent=config.bot_name||'Assistente RRN';
    observer=new MutationObserver(()=>{
      const ticket=$('quickOpenTicket'); const bot=$('quickBot');
      if(!ticket||!bot||ticket.hidden) return;
      if($('quickChat') && !$('quickChat').hidden) return;
      ticket.hidden=true; bot.hidden=false;
      if(!bot.dataset.started){ bot.dataset.started='1'; addMessage('bot',config.welcome_message||'Olá! Me conte o que está acontecendo.'); setTimeout(resolveAsset,100); }
    });
    observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['hidden']});
  }

  function boot(){ ensureUi(); activate(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();