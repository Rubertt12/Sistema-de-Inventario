(() => {
  'use strict';
  if (window.__RRN_ADMIN_COMPANY_CREATE__) return;
  window.__RRN_ADMIN_COMPANY_CREATE__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const db = window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  const digits = value => String(value || '').replace(/\D/g, '');

  function formatCnpj(value) {
    const v = digits(value).slice(0, 14);
    return v.replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function validCnpj(value) {
    const cnpj = digits(value);
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    const calc = size => {
      const nums = cnpj.slice(0, size).split('').map(Number);
      let pos = size - 7;
      let sum = 0;
      for (const n of nums) {
        sum += n * pos--;
        if (pos < 2) pos = 9;
      }
      const result = sum % 11;
      return result < 2 ? 0 : 11 - result;
    };
    return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  }

  function toast(message) {
    const t = $('toast');
    if (!t) return alert(message);
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function injectStyle() {
    if ($('rrnCompanyCreateStyle')) return;
    const style = document.createElement('style');
    style.id = 'rrnCompanyCreateStyle';
    style.textContent = `
      .rrn-company-heading-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .rrn-company-modal{position:fixed;inset:0;z-index:7000;display:grid;place-items:center;padding:18px;background:rgba(9,26,37,.58);backdrop-filter:blur(5px)}
      .rrn-company-modal[hidden]{display:none!important}
      .rrn-company-dialog{width:min(920px,96vw);max-height:92vh;overflow:auto;background:var(--rrn-surface,#fff);border:1px solid var(--rrn-border,#d8e0e3);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.25)}
      .rrn-company-dialog-head{display:flex;justify-content:space-between;gap:18px;align-items:start;padding:22px 24px;border-bottom:1px solid var(--rrn-border,#d8e0e3)}
      .rrn-company-dialog-head h2{margin:4px 0 4px}.rrn-company-dialog-head p{margin:0;color:var(--rrn-muted,#68757d)}
      .rrn-company-close{border:0;background:transparent;color:var(--rrn-muted,#68757d);font-size:1.5rem;cursor:pointer}
      .rrn-company-form{padding:22px 24px}.rrn-company-section{margin-bottom:20px}.rrn-company-section h3{margin:0 0 11px;font-size:.92rem}.rrn-company-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.rrn-company-grid.three{grid-template-columns:2fr 1fr 1fr}.rrn-company-grid .field{min-width:0}.rrn-company-grid .span-2{grid-column:1/-1}
      .rrn-company-actions{display:flex;justify-content:flex-end;gap:10px;padding-top:4px}.rrn-company-help{display:block;margin-top:5px;color:var(--rrn-muted,#68757d);font-size:.72rem}
      .rrn-company-cnpj-invalid{border-color:#be4646!important;outline-color:#be4646!important}.rrn-company-cnpj-ok{border-color:#2f7d78!important}
      @media(max-width:700px){.rrn-company-grid,.rrn-company-grid.three{grid-template-columns:1fr}.rrn-company-grid .span-2{grid-column:auto}.rrn-company-dialog{max-height:95vh}.rrn-company-actions{flex-direction:column-reverse}.rrn-company-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function modalMarkup() {
    const host = document.createElement('div');
    host.id = 'rrnCompanyModal';
    host.className = 'rrn-company-modal';
    host.hidden = true;
    host.innerHTML = `
      <div class="rrn-company-dialog" role="dialog" aria-modal="true" aria-labelledby="rrnCompanyTitle">
        <div class="rrn-company-dialog-head">
          <div><span class="eyebrow">Plataforma</span><h2 id="rrnCompanyTitle">Cadastrar nova empresa</h2><p>Cria o workspace e os dados cadastrais da organização.</p></div>
          <button type="button" class="rrn-company-close" data-company-close aria-label="Fechar">×</button>
        </div>
        <form id="rrnCompanyForm" class="rrn-company-form">
          <section class="rrn-company-section">
            <h3>Identificação</h3>
            <div class="rrn-company-grid">
              <label class="field"><span>CNPJ *</span><input id="newCompanyCnpj" inputmode="numeric" autocomplete="off" maxlength="18" placeholder="00.000.000/0000-00" required><small class="rrn-company-help" id="newCompanyCnpjHelp">O CNPJ não pode estar cadastrado em outra empresa.</small></label>
              <label class="field"><span>Nome do workspace *</span><input id="newCompanyName" maxlength="120" required placeholder="Ex.: Empresa ABC"></label>
              <label class="field"><span>Razão social</span><input id="newCompanyLegalName" maxlength="180"></label>
              <label class="field"><span>Nome fantasia</span><input id="newCompanyTradeName" maxlength="180"></label>
              <label class="field"><span>Inscrição estadual</span><input id="newCompanyStateRegistration" maxlength="40"></label>
              <label class="field"><span>Slug do acesso *</span><input id="newCompanySlug" maxlength="48" required placeholder="empresa-abc"><small class="rrn-company-help">Usado no login personalizado da empresa.</small></label>
            </div>
          </section>
          <section class="rrn-company-section">
            <h3>Contato</h3>
            <div class="rrn-company-grid">
              <label class="field"><span>E-mail</span><input id="newCompanyEmail" type="email" maxlength="180" placeholder="contato@empresa.com"></label>
              <label class="field"><span>Telefone</span><input id="newCompanyPhone" maxlength="30" placeholder="(51) 99999-9999"></label>
            </div>
          </section>
          <section class="rrn-company-section">
            <h3>Endereço</h3>
            <div class="rrn-company-grid three">
              <label class="field"><span>CEP</span><input id="newCompanyPostalCode" maxlength="10" inputmode="numeric"></label>
              <label class="field"><span>Cidade</span><input id="newCompanyCity" maxlength="100"></label>
              <label class="field"><span>UF</span><input id="newCompanyState" maxlength="2" style="text-transform:uppercase"></label>
              <label class="field span-2"><span>Logradouro</span><input id="newCompanyStreet" maxlength="180"></label>
              <label class="field"><span>Número</span><input id="newCompanyNumber" maxlength="20"></label>
              <label class="field"><span>Bairro</span><input id="newCompanyNeighborhood" maxlength="100"></label>
              <label class="field"><span>Complemento</span><input id="newCompanyComplement" maxlength="100"></label>
            </div>
          </section>
          <div class="rrn-company-actions"><button type="button" class="btn-secondary" data-company-close>Cancelar</button><button type="submit" class="btn-primary" id="createCompanyButton">Criar empresa</button></div>
        </form>
      </div>`;
    document.body.appendChild(host);
  }

  async function isPlatformAdmin() {
    if (!db) return false;
    const { data, error } = await db.rpc('is_platform_admin');
    return !error && !!data;
  }

  function openModal() {
    const modal = $('rrnCompanyModal');
    const form = $('rrnCompanyForm');
    form?.reset();
    $('newCompanyCnpj')?.classList.remove('rrn-company-cnpj-invalid', 'rrn-company-cnpj-ok');
    modal.hidden = false;
    setTimeout(() => $('newCompanyCnpj')?.focus(), 40);
  }

  function closeModal() { $('rrnCompanyModal').hidden = true; }

  function value(id) { return $(id)?.value?.trim() || ''; }

  async function createCompany(event) {
    event.preventDefault();
    const cnpj = value('newCompanyCnpj');
    if (!validCnpj(cnpj)) {
      $('newCompanyCnpj').classList.add('rrn-company-cnpj-invalid');
      $('newCompanyCnpjHelp').textContent = 'CNPJ inválido. Confira os 14 dígitos e os verificadores.';
      $('newCompanyCnpj').focus();
      return;
    }
    const name = value('newCompanyName');
    const slug = slugify(value('newCompanySlug') || name);
    if (!name || !slug) return toast('Informe o nome da empresa e o slug.');

    const button = $('createCompanyButton');
    button.disabled = true;
    button.textContent = 'Criando empresa...';
    try {
      const { data, error } = await db.rpc('create_platform_company', {
        p_name: name,
        p_slug: slug,
        p_cnpj: digits(cnpj),
        p_legal_name: value('newCompanyLegalName') || null,
        p_trade_name: value('newCompanyTradeName') || null,
        p_state_registration: value('newCompanyStateRegistration') || null,
        p_contact_email: value('newCompanyEmail') || null,
        p_contact_phone: value('newCompanyPhone') || null,
        p_postal_code: value('newCompanyPostalCode') || null,
        p_street: value('newCompanyStreet') || null,
        p_address_number: value('newCompanyNumber') || null,
        p_address_complement: value('newCompanyComplement') || null,
        p_neighborhood: value('newCompanyNeighborhood') || null,
        p_city: value('newCompanyCity') || null,
        p_state: value('newCompanyState') || null
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      closeModal();
      toast(`Empresa ${row?.name || name} criada com sucesso.`);
      setTimeout(() => location.reload(), 650);
    } catch (error) {
      const message = String(error?.message || error || 'Falha ao criar empresa.');
      if (message.includes('cnpj_already_registered') || message.includes('tenants_cnpj_unique')) toast('Este CNPJ já está cadastrado.');
      else if (message.includes('tenants_slug_key')) toast('Este slug já está sendo usado por outra empresa.');
      else toast(message);
    } finally {
      button.disabled = false;
      button.textContent = 'Criar empresa';
    }
  }

  async function enrichCompanyTable() {
    if (!db || !$('companiesBody')) return;
    const { data, error } = await db.from('tenants').select('id,slug,cnpj,legal_name,trade_name');
    if (error || !Array.isArray(data)) return;
    const bySlug = new Map(data.map(row => [row.slug, row]));
    $('companiesBody').querySelectorAll('tr').forEach(row => {
      const small = row.querySelector('.user-cell small');
      if (!small) return;
      const item = bySlug.get(small.textContent.trim());
      if (!item || row.querySelector('[data-company-cnpj]')) return;
      const detail = document.createElement('small');
      detail.dataset.companyCnpj = '1';
      detail.textContent = item.cnpj ? `CNPJ ${formatCnpj(item.cnpj)}${item.trade_name ? ` · ${item.trade_name}` : ''}` : 'CNPJ não informado';
      small.insertAdjacentElement('afterend', detail);
    });
  }

  async function install() {
    if (!await isPlatformAdmin()) return;
    injectStyle();
    modalMarkup();
    const companiesPanel = document.querySelector('[data-view-panel="companies"] .page-heading');
    const headingCopy = companiesPanel?.firstElementChild;
    if (companiesPanel && !$('newCompanyButton')) {
      const actions = document.createElement('div');
      actions.className = 'rrn-company-heading-actions';
      actions.innerHTML = '<button type="button" class="btn-primary" id="newCompanyButton">+ Nova empresa</button>';
      companiesPanel.appendChild(actions);
      $('newCompanyButton').addEventListener('click', openModal);
    }
    document.querySelectorAll('[data-company-close]').forEach(btn => btn.addEventListener('click', closeModal));
    $('rrnCompanyModal').addEventListener('click', event => { if (event.target === $('rrnCompanyModal')) closeModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('rrnCompanyModal').hidden) closeModal(); });
    $('rrnCompanyForm').addEventListener('submit', createCompany);

    const cnpj = $('newCompanyCnpj');
    cnpj.addEventListener('input', () => {
      cnpj.value = formatCnpj(cnpj.value);
      const complete = digits(cnpj.value).length === 14;
      cnpj.classList.toggle('rrn-company-cnpj-ok', complete && validCnpj(cnpj.value));
      cnpj.classList.toggle('rrn-company-cnpj-invalid', complete && !validCnpj(cnpj.value));
      $('newCompanyCnpjHelp').textContent = complete && !validCnpj(cnpj.value) ? 'CNPJ inválido.' : 'O CNPJ não pode estar cadastrado em outra empresa.';
    });
    $('newCompanyName').addEventListener('input', () => {
      const slug = $('newCompanySlug');
      if (!slug.dataset.edited) slug.value = slugify($('newCompanyName').value);
    });
    $('newCompanySlug').addEventListener('input', () => { $('newCompanySlug').dataset.edited = '1'; $('newCompanySlug').value = slugify($('newCompanySlug').value); });
    $('newCompanyState').addEventListener('input', () => { $('newCompanyState').value = $('newCompanyState').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0,2); });

    const companiesNav = $('companiesNav');
    companiesNav?.addEventListener('click', () => setTimeout(enrichCompanyTable, 100));
    setTimeout(enrichCompanyTable, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
