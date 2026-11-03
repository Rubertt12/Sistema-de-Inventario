(() => {
  'use strict';
  async function boot(attempt=0){
    const client=window.RRN_SUPABASE_CLIENT;
    if(!client){if(attempt<40)setTimeout(()=>boot(attempt+1),250);return}
    try{
      const {data:{session}}=await client.auth.getSession();
      if(!session)return;
      const {data,error}=await client.functions.invoke('billing-api',{body:{action:'status'}});
      if(error||!data?.ok)return;
      const sub=data.subscription;
      const urgent=!data.entitled || (sub?.status==='trialing' && Number(data.trial_days_remaining)<=3);
      if(!urgent)return;
      const banner=document.createElement('aside');
      banner.className='rrn-billing-banner'+(!data.entitled?' is-blocked':'');
      const copy=document.createElement('span');
      copy.textContent=!data.entitled?'O período de teste terminou. As operações de alteração estão bloqueadas até a ativação de um plano.':`Seu teste grátis termina em ${data.trial_days_remaining} dia(s). Escolha um plano para não interromper a operação.`;
      const link=document.createElement('a');link.href='/assinatura.html';link.textContent='Ver plano e cobrança';
      banner.append(copy,link);
      const nav=document.querySelector('.navbar');
      if(nav)nav.insertAdjacentElement('afterend',banner);
    }catch(error){console.warn('RRN billing status unavailable:',error)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
})();