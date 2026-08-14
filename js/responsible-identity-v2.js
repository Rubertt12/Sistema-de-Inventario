(() => {
  'use strict';
  if (window.__RRN_RESPONSIBLE_IDENTITY_V2__) return;
  window.__RRN_RESPONSIBLE_IDENTITY_V2__ = true;

  const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let client=null, timer=null, lastLookup=null;

  function tenantId(){
    if(window.RRN_SESSION?.tenantId)return window.RRN_SESSION.tenantId;
    try{return JSON.parse(localStorage.getItem('usuarioLogado')||'{}').tenant_id||null;}catch{return null;}
  }
  async function waitClient(){for(let i=0;i<120;i++){client=window.RRN_SUPABASE_CLIENT||window.RRN_GET_SUPABASE_CLIENT?.()||null;if(client)return client;await new Promise(r=>setTimeout(r,50));}return null;}

  function ensureStyle(){if(document.getElementById('rrnResponsibleIdentityStyle'))return;const s=document.createElement('style');s.id='rrnResponsibleIdentityStyle';s.textContent=`.rrn-responsible-identity{margin:7px 0 10px;padding:10px 12px;border:1px solid rgba(22,58,77,.14);border-radius:11px;background:rgba(47,125,120,.06);font-size:.72rem;line-height:1.4}.rrn-responsible-identity strong,.rrn-responsible-identity small{display:block}.rrn-responsible-identity strong{color:#163a4d}.rrn-responsible-identity small{margin-top:3px;color:#66757f}.rrn-responsible-identity.unknown{background:rgba(242,191,79,.10)}.rrn-responsible-extra{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.rrn-responsible-extra input{width:100%!important;box-sizing:border-box}.rrn-responsible-chip{display:inline-flex!important;width:max-content;margin-bottom:4px;padding:3px 7px;border-radius:999px;background:#e7f4f2;color:#286d69!important;font-size:.62rem!important;font-weight:800}.rrn-responsible-identity.unknown .rrn-responsible-chip{background:#fff0c8;color:#8a5d00!important}@media(max-width:560px){.rrn-responsible-extra{grid-template-columns:1fr}}`;document.head.appendChild(s);}

  function ensurePanel(){const input=document.getElementById('usuarioResponsavel');if(!input)return null;let p=document.getElementById('rrnResponsibleIdentity');if(p)return p;p=document.createElement('div');p.id='rrnResponsibleIdentity';p.className='rrn-responsible-identity';p.hidden=true;input.insertAdjacentElement('afterend',p);return p;}

  function render(result,name){const p=ensurePanel();if(!p)return;lastLookup=result;p.hidden=!name;if(!name)return;const type=result?.type||'common';const labels={support:'Suporte da plataforma',internal:'Usuário do sistema',portal:'Colaborador com acesso ao portal',collaborator:'Colaborador cadastrado',common:'Colaborador comum'};p.classList.toggle('unknown',type==='common');p.innerHTML=`<span class="rrn-responsible-chip">${labels[type]}</span><strong>${result?.name||name}</strong><small>${result?.detail|| (type==='common'?'Não encontramos esta pessoa nas contas do RRN. Você pode registrá-la junto com o equipamento.':'Pessoa localizada neste workspace.')}</small>${type==='common'?`<div class="rrn-responsible-extra"><input id="rrnResponsibleEmail" type="email" placeholder="E-mail (opcional)"><input id="rrnResponsibleEmployee" type="text" placeholder="Matrícula (opcional)"></div>`:''}`;}

  async function queryOne(table,select,term){try{const tid=tenantId();if(!client||!tid)return[];const {data,error}=await client.from(table).select(select).eq('tenant_id',tid).limit(8);if(error)return[];return (data||[]).filter(row=>[row.name,row.display_name,row.email,row.employee_number].some(v=>norm(v).includes(term)));}catch{return[];}}

  async function lookup(value){const name=clean(value);const term=norm(name);if(term.length<2){render(null,'');return;}if(!client)await waitClient();const [profiles,staff,customers,collabs]=await Promise.all([queryOne('profiles','user_id,name,email,role,status',term),queryOne('support_staff','user_id,display_name,role,status',term),queryOne('support_customers','user_id,name,email,employee_number,status',term),queryOne('collaborators','id,user_id,name,email,employee_number,status,portal_access',term)]);
    const exact=(rows,keys)=>rows.find(r=>keys.some(k=>norm(r[k])===term))||rows[0];
    const staffRow=exact(staff,['display_name']); if(staffRow){render({type:'support',name:staffRow.display_name||name,detail:`Conta de suporte · ${staffRow.role||'técnico'}`,row:staffRow},name);return;}
    const profile=exact(profiles,['name','email']); if(profile){render({type:'internal',name:profile.name||name,detail:`Usuário interno · perfil ${profile.role||'usuário'}`,row:profile},name);return;}
    const customer=exact(customers,['name','email','employee_number']); if(customer){render({type:'portal',name:customer.name||name,detail:[customer.email,customer.employee_number?`Matrícula ${customer.employee_number}`:null].filter(Boolean).join(' · '),row:customer},name);return;}
    const collab=exact(collabs,['name','email','employee_number']); if(collab){render({type:'collaborator',name:collab.name||name,detail:[collab.email,collab.employee_number?`Matrícula ${collab.employee_number}`:null].filter(Boolean).join(' · '),row:collab},name);return;}
    render({type:'common',name},name);
  }

  async function registerCommonIfNeeded(name,email,employee){if(lastLookup?.type!=='common'||!client||!tenantId()||!name)return;try{const payload={tenant_id:tenantId(),name:clean(name),email:clean(email)||null,employee_number:clean(employee)||null,status:'active',portal_access:false};const {error}=await client.from('collaborators').insert(payload);if(error&&!/duplicate/i.test(error.message||''))console.warn('RRN collaborator registration:',error);}catch(error){console.warn('RRN collaborator registration:',error);}}

  function bind(){ensureStyle();const input=document.getElementById('usuarioResponsavel');if(!input||input.dataset.rrnIdentityBound==='1')return;input.dataset.rrnIdentityBound='1';ensurePanel();input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>lookup(input.value),280);});input.addEventListener('blur',()=>lookup(input.value));
    const original=window.confirmarAddMaquina;if(typeof original==='function'&&!original.__rrnIdentityWrapped){const wrapped=function(...args){const name=input.value;const email=document.getElementById('rrnResponsibleEmail')?.value||'';const employee=document.getElementById('rrnResponsibleEmployee')?.value||'';const result=original.apply(this,args);Promise.resolve(result).finally(()=>registerCommonIfNeeded(name,email,employee));return result;};wrapped.__rrnIdentityWrapped=true;window.confirmarAddMaquina=wrapped;}}

  function boot(){waitClient();bind();new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
