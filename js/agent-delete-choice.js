(() => {
  'use strict';

  if (window.__RRN_AGENT_DELETE_CHOICE__) return;
  window.__RRN_AGENT_DELETE_CHOICE__ = true;

  function inventory() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function assetAt(sectorIndex, assetIndex) {
    return inventory()?.[Number(sectorIndex)]?.maquinas?.[Number(assetIndex)] || null;
  }

  function deviceId(asset) {
    return String(asset?.agentDeviceId || '').trim();
  }

  function assetLabel(asset) {
    return String(asset?.etiqueta || asset?.patrimonio || asset?.serial || asset?.numeroSerie || asset?.nome || 'Equipamento').trim();
  }

  function client() {
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    const cfg = window.RRN_SUPABASE || {};
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    return window.RRN_SUPABASE_CLIENT;
  }

  function ensureStyles() {
    if (document.getElementById('rrnAgentDeleteChoiceStyle')) return;
    const style = document.createElement('style');
    style.id = 'rrnAgentDeleteChoiceStyle';
    style.textContent = `
      .rrn-agent-delete-choice{position:fixed;inset:0;z-index:60000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,18,27,.68);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .rrn-agent-delete-dialog{width:min(620px,100%);padding:22px;border:1px solid var(--rrn-border,rgba(22,58,77,.16));border-radius:20px;background:var(--rrn-surface,#fff);color:var(--rrn-text,#263238);box-shadow:0 28px 80px rgba(0,12,20,.34)}
      .rrn-agent-delete-dialog h2{margin:0;color:var(--rrn-heading,#163A4D);font:800 1.2rem/1.2 Manrope,Inter,sans-serif;text-align:left}
      .rrn-agent-delete-dialog>p{margin:8px 0 18px;color:var(--rrn-muted,#66757F);font-size:.78rem;line-height:1.5}
      .rrn-agent-delete-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .rrn-agent-delete-option{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-height:132px;padding:16px;border:1px solid var(--rrn-border,rgba(22,58,77,.15));border-radius:14px;background:var(--rrn-surface-2,#f6f8f9);color:var(--rrn-text,#263238);text-align:left;cursor:pointer}
      .rrn-agent-delete-option:hover{border-color:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 45%,var(--rrn-border));background:var(--rrn-surface-soft,#eef3f3)}
      .rrn-agent-delete-option strong{color:var(--rrn-heading,#163A4D);font-size:.8rem}
      .rrn-agent-delete-option small{color:var(--rrn-muted,#66757F);font-size:.68rem;line-height:1.45}
      .rrn-agent-delete-option.keep strong{color:var(--rrn-secondary,#2F7D78)}
      .rrn-agent-delete-option.unlink{border-color:color-mix(in srgb,var(--rrn-danger,#B9473A) 30%,var(--rrn-border))}
      .rrn-agent-delete-option.unlink strong{color:var(--rrn-danger,#B9473A)}
      .rrn-agent-delete-cancel{display:flex;justify-content:flex-end;margin-top:15px}
      .rrn-agent-delete-cancel button{min-height:38px;padding:0 14px;border:1px solid var(--rrn-border,rgba(22,58,77,.15));border-radius:10px;background:var(--rrn-surface,#fff);color:var(--rrn-heading,#163A4D);font-weight:800;cursor:pointer}
      .rrn-agent-delete-choice[aria-busy="true"] button{pointer-events:none;opacity:.58}
      @media(max-width:620px){.rrn-agent-delete-options{grid-template-columns:1fr}.rrn-agent-delete-option{min-height:auto}.rrn-agent-delete-dialog{padding:18px}}
    `;
    document.head.appendChild(style);
  }

  function choose(asset) {
    ensureStyles();
    document.getElementById('rrnAgentDeleteChoice')?.remove();
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.id = 'rrnAgentDeleteChoice';
      overlay.className = 'rrn-agent-delete-choice';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = `
        <div class="rrn-agent-delete-dialog">
          <h2>Remover equipamento com RRN Agent</h2>
          <p><strong>${assetLabel(asset).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong> possui um agente vinculado. Escolha o que deve acontecer:</p>
          <div class="rrn-agent-delete-options">
            <button type="button" class="rrn-agent-delete-option keep" data-choice="stock">
              <strong>↩ Mover para Máquinas em estoque</strong>
              <small>Remove do setor, mantém o RRN Agent ativo e continua recebendo sincronizações. Você poderá alocar a máquina novamente sem reinstalar o Agent.</small>
            </button>
            <button type="button" class="rrn-agent-delete-option unlink" data-choice="unlink">
              <strong>🗑 Excluir e desvincular RRN Agent</strong>
              <small>Remove o equipamento e revoga o vínculo do Agent. Para cadastrar esta máquina novamente será necessário gerar um novo código de instalação.</small>
            </button>
          </div>
          <div class="rrn-agent-delete-cancel"><button type="button" data-choice="cancel">Cancelar</button></div>
        </div>`;

      const finish = value => { overlay.remove(); resolve(value); };
      overlay.addEventListener('click', event => {
        if (event.target === overlay) finish('cancel');
        const button = event.target.closest?.('[data-choice]');
        if (button) finish(button.dataset.choice);
      });
      document.addEventListener('keydown', function onKey(event) {
        if (event.key !== 'Escape' || !document.body.contains(overlay)) return;
        document.removeEventListener('keydown', onKey);
        finish('cancel');
      });
      document.body.appendChild(overlay);
    });
  }

  function toast(message, danger = false) {
    document.getElementById('rrnAgentChoiceToast')?.remove();
    const node = document.createElement('div');
    node.id = 'rrnAgentChoiceToast';
    node.textContent = message;
    Object.assign(node.style, {
      position:'fixed', right:'18px', bottom:'18px', zIndex:'61000', maxWidth:'420px', padding:'12px 15px',
      borderRadius:'11px', background: danger ? 'var(--rrn-danger,#B9473A)' : 'var(--rrn-primary,#163A4D)',
      color:'#fff', font:'700 .75rem/1.4 Inter,system-ui,sans-serif', boxShadow:'0 15px 40px rgba(0,0,0,.25)'
    });
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  async function moveToStock(id) {
    const db = client();
    if (!db) throw new Error('Backend do RRN Manager indisponível.');
    const { data, error } = await db.rpc('move_agent_device_to_stock', { p_device_id:id });
    if (error) throw error;
    if (data !== true) throw new Error('O dispositivo não foi encontrado neste workspace.');
    try { await window.RRN_REMOTE_SYNC?.refresh?.(); } catch {}
    try { window.loadSetoresAndMachines?.(); } catch {}
    try { window.renderSetores?.(); } catch {}
    try { window.RRN_STOCK?.render?.(); } catch {}
    try { window.RRN_UI?.updateOverview?.(); } catch {}
    try { window.RRN_TABS?.renderHome?.(); } catch {}
  }

  function install() {
    const current = window.removeMaquina;
    if (typeof current !== 'function' || current.__rrnAgentDeleteChoice) return false;

    const wrapped = async function(...args) {
      const sectorIndex = Number(args[0]);
      const assetIndex = Number(args[1]);
      const asset = assetAt(sectorIndex, assetIndex);
      const id = deviceId(asset);
      if (!asset || !id) return current.apply(this, args);

      const action = await choose(asset);
      if (action === 'cancel') return false;
      if (action === 'unlink') return current.apply(this, args);

      try {
        const overlay = document.getElementById('rrnAgentDeleteChoice');
        overlay?.setAttribute('aria-busy', 'true');
        await moveToStock(id);
        toast('Equipamento movido para Máquinas em estoque. O RRN Agent continua vinculado.');
        return true;
      } catch (error) {
        console.error('RRN Agent: falha ao mover equipamento para estoque.', error);
        toast(error?.message || 'Não foi possível mover o equipamento para o estoque.', true);
        return false;
      }
    };

    wrapped.__rrnAgentDeleteChoice = true;
    wrapped.__rrnOriginal = current;
    window.removeMaquina = wrapped;
    return true;
  }

  install();
  window.addEventListener('load', install);
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts > 80) clearInterval(timer);
  }, 125);
})();