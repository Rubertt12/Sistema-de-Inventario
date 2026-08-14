(() => {
  'use strict';
  if (window.__RRN_SUPPORT_BOT_SETTINGS__) return;
  window.__RRN_SUPPORT_BOT_SETTINGS__ = true;
  if (!/configuracoes\.html$/i.test(location.pathname)) return;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey);
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function isAdmin(){ return String(window.RRN_SESSION?.role || '').toLowerCase() === 'admin'; }

  function ensureUi(){
    if (!isAdmin() || $('settingsBotNav')) return false;
    if (!document.querySelector('link[data-bot-settings-css]')) {
      const l=document.createElement('link'); l.rel='stylesheet'; l.href='/style/support-bot-settings.css'; l.dataset.botSettingsCss='1'; document.head.appendChild(l);
    }
    const adminNav = document.querySelector('[data-settings-nav="admin"]');
    const nav = document.createElement('button');
    nav.type='button'; nav.id='settingsBotNav'; nav.dataset.settingsNav='bots'; nav.setAttribute('role','tab'); nav.setAttribute('aria-selected','false');
    nav.innerHTML='<span>06</span><div><strong>Bots do chat</strong><small>Triagem e respostas</small></div>';
    adminNav?.insertAdjacentElement('afterend',nav);

    const adminPanel = document.querySelector('[data-settings-panel="admin"]');
    const panel = document.createElement('section');
    panel.className='settings-panel'; panel.dataset.settingsPanel='bots'; panel.setAttribute('role','tabpanel'); panel.hidden=true;
    panel.innerHTML=`<div class="settings-page-heading"><span class="settings-eyebrow">Automação</span><h1>Bots do chat</h1><p>Configure a triagem automática antes do atendimento humano.</p></div>
      <div class="bot-settings-stack">
        <article class="settings-card"><div class="settings-card-head"><div><h2>Bot principal</h2><p>Ative ou desative a triagem automática deste workspace.</p></div><span class="settings-card-badge">Chat</span></div>
          <div class="bot-settings-toggle"><div><strong>Atendimento automático</strong><div class="bot-settings-status">Quando desligado, o usuário vai direto para abertura do chamado.</div></div><label><input id="botEnabled" type="checkbox" checked> Ativo</label></div>
          <div class="bot-settings-form" style="margin-top:16px">
            <label><span>Nome do bot</span><input id="botName" maxlength="80" placeholder="Assistente RRN"></label>
            <label><span>Mensagem de boas-vindas</span><textarea id="botWelcome" rows="3" maxlength="1000"></textarea></label>
            <label><span>Mensagem ao transferir para humano</span><textarea id="botHandoff" rows="3" maxlength="1000"></textarea></label>
          </div>
        </article>
        <article class="settings-card"><div class="bot-rules-head"><div><h2 style="margin:0">Regras de resposta</h2><p style="margin:4px 0 0;color:var(--rrn-muted)">Ex.: vpn, acesso remoto → passo a passo da VPN.</p></div><button type="button" class="settings-ghost-btn" id="botAddRule">+ Adicionar regra</button></div><div class="bot-rules" id="botRules"></div></article>
        <div class="bot-settings-actions"><button type="button" class="settings-primary-btn" id="botSave">Salvar bot</button></div><div class="bot-settings-status" id="botStatus"></div>
      </div>`;
    adminPanel?.insertAdjacentElement('afterend',panel);

    nav.addEventListener('click',()=>{
      document.querySelectorAll('[data-settings-nav]').forEach(b=>{const a=b===nav;b.classList.toggle('active',a);b.setAttribute('aria-selected',String(a));});
      document.querySelectorAll('[data-settings-panel]').forEach(p=>{const a=p===panel;p.classList.toggle('active',a);p.hidden=!a;});
      history.replaceState(null,'','#bots'); window.scrollTo({top:0,behavior:'smooth'});
    });
    return true;
  }

  function addRule(rule={}){
    const wrap=$('botRules'); if(!wrap) return;
    const row=document.createElement('div'); row.className='bot-rule';
    row.innerHTML=`<label><span>Palavras-chave</span><textarea class="bot-rule-keywords" placeholder="vpn, acesso remoto, forticlient">${esc(Array.isArray(rule.keywords)?rule.keywords.join(', '):(rule.keywords||''))}</textarea></label><label><span>Resposta do bot</span><textarea class="bot-rule-response" placeholder="Explique o que o usuário deve fazer...">${esc(rule.response||'')}</textarea></label><button class="bot-rule-remove" type="button" aria-label="Remover regra">×</button>`;
    row.querySelector('.bot-rule-remove').addEventListener('click',()=>row.remove()); wrap.appendChild(row);
  }

  function collectRules(){
    return [...document.querySelectorAll('.bot-rule')].map(row=>({
      keywords: row.querySelector('.bot-rule-keywords').value.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean).slice(0,20),
      response: row.querySelector('.bot-rule-response').value.trim()
    })).filter(r=>r.keywords.length && r.response).slice(0,50);
  }

  async function load(){
    if(!ensureUi()) return;
    $('botStatus').textContent='Carregando configuração...';
    const {data,error}=await client.rpc('get_support_chat_bot_config',{p_portal_slug:null});
    if(error){$('botStatus').textContent=`Erro ao carregar: ${error.message}`;return;}
    const row=Array.isArray(data)?data[0]:data;
    $('botEnabled').checked=row?.enabled!==false;
    $('botName').value=row?.bot_name||'Assistente RRN';
    $('botWelcome').value=row?.welcome_message||'Olá! Sou o assistente virtual do suporte. Me conte rapidamente o que está acontecendo.';
    $('botHandoff').value=row?.handoff_message||'Não consegui resolver por aqui. Vou preparar seu chamado para a equipe de suporte.';
    $('botRules').innerHTML=''; (Array.isArray(row?.rules)?row.rules:[]).forEach(addRule); if(!$('botRules').children.length) addRule();
    $('botStatus').textContent='Configuração carregada.';
  }

  async function save(){
    const btn=$('botSave'); btn.disabled=true; $('botStatus').textContent='Salvando...';
    const payload={p_enabled:$('botEnabled').checked,p_bot_name:$('botName').value.trim(),p_welcome_message:$('botWelcome').value.trim(),p_handoff_message:$('botHandoff').value.trim(),p_rules:collectRules()};
    const {error}=await client.rpc('save_support_chat_bot_config',payload);
    btn.disabled=false;
    $('botStatus').textContent=error?`Erro ao salvar: ${error.message}`:'Bot salvo com sucesso.';
  }

  function bind(){ $('botAddRule')?.addEventListener('click',()=>addRule()); $('botSave')?.addEventListener('click',save); }
  async function boot(){ if(!isAdmin()) return; await load(); bind(); if(location.hash==='#bots') $('settingsBotNav')?.click(); }
  if(window.RRN_SESSION?.userId) boot(); else window.addEventListener('rrn:session-ready',()=>setTimeout(boot,50),{once:true});
})();