(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.RRN_SUPABASE || {};
  const client = window.RRN_SUPABASE_CLIENT || window.supabase?.createClient?.(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  if (!client) { showNotice('Não foi possível conectar ao serviço de autenticação. Recarregue a página.',true); return; }
  window.RRN_SUPABASE_CLIENT = client;
  const money = value => Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const date = value => value ? new Date(value).toLocaleDateString('pt-BR') : '—';
  function showNotice(message,error=false){const el=$('billingNotice');el.textContent=message;el.className='bill-notice'+(error?' error':'');el.hidden=false}
  function hideNotice(){$('billingNotice').hidden=true}
  function statusLabel(status){return({trialing:'Teste grátis',pending:'Aguardando pagamento',authorized:'Assinatura ativa',paused:'Assinatura pausada',past_due:'Pagamento pendente',cancelled:'Cancelada',expired:'Período encerrado',grandfathered:'Acesso legado'})[status]||'Status indisponível'}
  function statusClass(status){return ['trialing','authorized','grandfathered'].includes(status)?'':(['pending','past_due'].includes(status)?'warn':'off')}
  async function invoke(action,extra={}){const {data,error}=await client.functions.invoke('billing-api',{body:{action,...extra}});if(error)throw error;if(data?.error)throw new Error(data.error);return data}
  function renderPlanCard(plan,current){
    const lines=[
      `Até ${plan.max_users.toLocaleString('pt-BR')} usuários`,
      `Até ${plan.max_assets.toLocaleString('pt-BR')} equipamentos`,
      'Cadastro e consulta de ativos',
      'Setores e movimentações',
      'Perfis e permissões por usuário'
    ];
    const card=document.createElement('article');card.className='bill-plan'+(plan.id==='professional'?' featured':'');
    const title=document.createElement('h3');title.textContent=plan.name;
    const desc=document.createElement('p');desc.textContent=plan.description||'Plano mensal para sua equipe.';
    const price=document.createElement('div');price.className='bill-plan-price';price.textContent=money(plan.monthly_price);const per=document.createElement('small');per.textContent=' / mês';price.append(per);
    const list=document.createElement('ul');lines.forEach(line=>{const li=document.createElement('li');li.textContent=line;list.append(li)});
    const button=document.createElement('button');button.type='button';button.textContent=current?.plan_id===plan.id?'Plano atual':'Escolher plano';button.disabled=!state.can_manage||current?.plan_id===plan.id;
    button.addEventListener('click',async()=>{button.disabled=true;button.textContent='Preparando checkout...';try{hideNotice();const result=await invoke('checkout',{plan_id:plan.id});if(result.init_point){location.assign(result.init_point);return}if(result.changed){showNotice(result.message||'Plano atualizado.');await load();return}throw new Error('O Mercado Pago não retornou o endereço do checkout.')}catch(error){showNotice(error.message||'Não foi possível iniciar a assinatura.',true);button.disabled=false;button.textContent='Tentar novamente'}});
    card.append(title,desc,price,list,button);return card;
  }
  let state={can_manage:false};
  function render(data){
    state=data;
    const sub=data.subscription;
    const plan=sub?.billing_plans;
    $('currentPlanTitle').textContent=plan?.name||'Nenhum plano';
    $('currentPlanDescription').textContent=plan?.description||'Selecione um plano para continuar.';
    $('currentPlanPrice').textContent=money(plan?.monthly_price);
    $('subscriptionStatus').textContent=statusLabel(sub?.status);
    $('subscriptionStatus').className='bill-status '+statusClass(sub?.status);
    $('subscriptionDate').textContent=sub?.status==='trialing'?`Teste grátis até ${date(sub.trial_ends_at)} · ${data.trial_days_remaining??0} dia(s) restante(s)`:sub?.current_period_end?`Próxima referência: ${date(sub.current_period_end)}`:'';
    $('usagePlanName').textContent=plan?.name||'—';
    const users=data.usage?.users||0,assets=data.usage?.assets||0;
    const userLimit=plan?.max_users||0,assetLimit=plan?.max_assets||0;
    $('usersCount').textContent=users.toLocaleString('pt-BR');$('assetsCount').textContent=assets.toLocaleString('pt-BR');
    $('usersLimit').textContent=`${users} de ${userLimit.toLocaleString('pt-BR')} usuários`;
    $('assetsLimit').textContent=`${assets} de ${assetLimit.toLocaleString('pt-BR')} equipamentos`;
    $('usersProgress').style.width=`${Math.min(100,userLimit?users/userLimit*100:0)}%`;
    $('assetsProgress').style.width=`${Math.min(100,assetLimit?assets/assetLimit*100:0)}%`;
    $('cancelSubscription').hidden=!(data.can_manage&&sub?.mp_status==='authorized'&&sub?.status==='authorized');
    $('cancelSubscription').onclick=async()=>{if(!confirm('Deseja realmente cancelar a renovação da assinatura?'))return;try{$('cancelSubscription').disabled=true;const result=await invoke('cancel');showNotice(result.message||'Cancelamento solicitado.');await load()}catch(error){showNotice(error.message||'Não foi possível cancelar.',true)}finally{$('cancelSubscription').disabled=false}};
    const grid=$('plansGrid');grid.replaceChildren();
    (data.plans||[]).forEach(plan=>grid.append(renderPlanCard(plan,sub)));
    if(!data.can_manage)showNotice('Você está em modo de consulta. Somente o administrador da empresa pode alterar o plano ou cancelar a assinatura.');
    else if(sub?.mp_status==='pending')showNotice('Checkout iniciado. Estamos aguardando a autorização do Mercado Pago; o plano será ativado automaticamente após a confirmação.');
    else if(sub?.mp_status==='checkout_error')showNotice('Não foi possível concluir o checkout. Você pode tentar novamente sem gerar uma nova assinatura.');
    else if(!data.entitled&&sub?.status!=='pending')showNotice('O período de teste ou a assinatura terminou. Escolha um plano para reativar as operações.',true);
    else if(sub?.status==='trialing')showNotice(`Você está no teste grátis. Restam ${data.trial_days_remaining??0} dia(s) para escolher um plano.`);
  }
  async function load(){hideNotice();try{const data=await invoke('status');render(data)}catch(error){showNotice(error.message||'Não foi possível carregar sua assinatura.',true);$('currentPlanTitle').textContent='Indisponível';$('plansGrid').innerHTML='<div class="bill-loading">Não foi possível carregar os planos. Tente novamente mais tarde.</div>'}}
  async function boot(){const {data,error}=await client.auth.getSession();if(error||!data.session){location.replace('/login.html');return}await load();const params=new URLSearchParams(location.search);if(params.get('checkout')==='return'){showNotice('Retorno do Mercado Pago recebido. Estamos aguardando a confirmação segura da assinatura; atualize a página em instantes.');history.replaceState({},'',location.pathname)}}
  boot();
})();