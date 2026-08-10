(() => {
  'use strict';

  const host = location.hostname.toLowerCase();
  const params = new URLSearchParams(location.search);
  const isVercelPreview = host.endsWith('.vercel.app') && host.includes('sistema-de-inventario-git-agent-multi-');
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const requested = params.get('demo') === '1';
  const enabled = isVercelPreview || ((isVercelPreview || isLocal) && requested);
  if (!enabled) return;

  const DEMO_USER = {
    id: 'preview-admin',
    nome: 'Admin Preview',
    name: 'Admin Preview',
    email: 'admin@preview.rrn',
    perfil: 'admin',
    role: 'admin',
    tenant_id: 'preview-tenant',
    tenant: 'RRN Preview',
    tenantId: 'preview-tenant',
    tenantName: 'RRN Preview',
    demo: true
  };

  const DEMO_SECTORS = [
    {
      nome: 'TI / Suporte',
      maquinas: [
        {
          id: 'demo-notebook-001',
          nome: 'SN-DL3420-001',
          tipo: 'Notebook',
          etiqueta: 'TI-001',
          usuarioResponsavel: 'Ana Martins',
          fabricante: 'Dell',
          modelo: 'Latitude 3420',
          localizacao: '2º andar · Mesa 24',
          situacaoPatrimonial: 'ativo',
          dataCompra: '2025-03-12',
          garantiaAte: '2027-03-12',
          observacoesAtivo: 'Notebook de atendimento e suporte.',
          emManutencao: false,
          tempoManutencao: 0,
          chamados: [],
          chamado: []
        },
        {
          id: 'demo-monitor-001',
          nome: 'Monitor - MON-041',
          tipo: 'Monitor',
          etiqueta: 'MON-041',
          usuarioResponsavel: 'Ana Martins',
          fabricante: 'Dell',
          modelo: 'P2422H',
          localizacao: '2º andar · Mesa 24',
          situacaoPatrimonial: 'ativo',
          garantiaAte: '2026-11-30',
          emManutencao: false,
          chamados: [],
          chamado: []
        }
      ]
    },
    {
      nome: 'Recursos Humanos',
      maquinas: [
        {
          id: 'demo-desktop-002',
          nome: 'SN-OPT7090-002',
          tipo: 'Desktop',
          etiqueta: 'RH-014',
          usuarioResponsavel: 'Carlos Lima',
          fabricante: 'Dell',
          modelo: 'OptiPlex 7090',
          localizacao: '1º andar · RH',
          situacaoPatrimonial: 'ativo',
          dataCompra: '2024-08-05',
          garantiaAte: '2026-08-25',
          observacoesAtivo: 'Em diagnóstico por falha intermitente de vídeo.',
          emManutencao: true,
          tempoManutencao: 3600000,
          chamados: [
            {
              texto: 'Monitor perde sinal de vídeo de forma intermitente.',
              prioridade: 'Alta',
              data: new Date(Date.now() - 86400000).toISOString(),
              interacoes: [
                { texto: 'Cabo e dock testados; diagnóstico continua.', data: new Date(Date.now() - 43200000).toISOString() }
              ]
            }
          ]
        }
      ]
    },
    {
      nome: 'Recepção',
      maquinas: [
        {
          id: 'demo-printer-003',
          nome: 'HP LaserJet Recepção',
          tipo: 'Impressora',
          etiqueta: 'IMP-003',
          fabricante: 'HP',
          modelo: 'LaserJet Pro',
          localizacao: 'Térreo · Recepção',
          situacaoPatrimonial: 'ativo',
          garantiaAte: '2027-02-01',
          emManutencao: false,
          chamados: [],
          chamado: []
        },
        {
          id: 'demo-notebook-stock',
          nome: 'SN-LAT5420-BKP',
          tipo: 'Notebook',
          etiqueta: 'BKP-007',
          fabricante: 'Dell',
          modelo: 'Latitude 5420',
          localizacao: 'Armário TI',
          situacaoPatrimonial: 'estoque',
          garantiaAte: '2026-09-05',
          emManutencao: false,
          chamados: [],
          chamado: []
        }
      ]
    }
  ];

  const DEMO_MEMBERS = [
    { user_id: 'preview-admin', name: 'Admin Preview', email: 'admin@preview.rrn', role: 'admin', status: 'active', created_at: '2026-08-01T12:00:00Z' },
    { user_id: 'preview-operator', name: 'Operador Demo', email: 'operador@preview.rrn', role: 'operador', status: 'active', created_at: '2026-08-03T14:30:00Z' },
    { user_id: 'preview-monitor', name: 'Monitoramento Demo', email: 'monitoramento@preview.rrn', role: 'monitoramento', status: 'active', created_at: '2026-08-04T10:15:00Z' }
  ];

  const DEMO_INVITES = [
    {
      id: 'preview-invite-1',
      email: 'novo.usuario@empresa.com',
      role: 'operador',
      expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      used_at: null,
      created_at: new Date(Date.now() - 3600000).toISOString()
    }
  ];

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function seed(force = false) {
    localStorage.setItem('rrn_preview_demo', '1');
    writeJson('usuarioLogado', DEMO_USER);

    if (force || !Array.isArray(readJson('setores', null)) || readJson('setores', []).length === 0) {
      writeJson('setores', DEMO_SECTORS);
    }
    if (force || !Array.isArray(readJson('chamados', null))) writeJson('chamados', []);
    if (force || !Array.isArray(readJson('asset_history', null))) {
      writeJson('asset_history', [
        {
          id: 'preview-history-1',
          timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
          actorId: 'preview-operator',
          actorName: 'Operador Demo',
          actorRole: 'operador',
          tenantId: 'preview-tenant',
          entityType: 'asset',
          entityId: 'id:demo-desktop-002',
          eventType: 'maintenance_started',
          title: 'Enviado para manutenção',
          assetLabel: 'RH-014',
          toSector: 'Recursos Humanos'
        },
        {
          id: 'preview-history-2',
          timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
          actorId: 'preview-admin',
          actorName: 'Admin Preview',
          actorRole: 'admin',
          tenantId: 'preview-tenant',
          entityType: 'asset',
          entityId: 'id:demo-notebook-001',
          eventType: 'created',
          title: 'Equipamento adicionado',
          assetLabel: 'TI-001',
          toSector: 'TI / Suporte'
        }
      ]);
    }
    if (force || !Array.isArray(readJson('asset_trash', null))) {
      writeJson('asset_trash', [
        {
          id: 'preview-trash-1',
          type: 'asset',
          deletedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          tenantId: 'preview-tenant',
          sectorName: 'TI / Suporte',
          sectorIndex: 0,
          payload: {
            id: 'demo-old-monitor',
            nome: 'Monitor antigo',
            tipo: 'Monitor',
            etiqueta: 'MON-OLD-01',
            fabricante: 'Dell',
            modelo: 'P2219H'
          }
        }
      ]);
    }
    if (force || !Array.isArray(readJson('rrn_demo_members', null))) writeJson('rrn_demo_members', DEMO_MEMBERS);
    if (force || !Array.isArray(readJson('rrn_demo_invites', null))) writeJson('rrn_demo_invites', DEMO_INVITES);

    window.RRN_SESSION = Object.freeze({
      userId: DEMO_USER.id,
      userName: DEMO_USER.nome,
      name: DEMO_USER.nome,
      email: DEMO_USER.email,
      tenantId: DEMO_USER.tenant_id,
      tenantName: DEMO_USER.tenant,
      role: DEMO_USER.perfil,
      demo: true
    });
  }

  function reset() {
    ['setores','chamados','asset_history','asset_trash','rrn_demo_members','rrn_demo_invites']
      .forEach(key => localStorage.removeItem(key));
    seed(true);
    location.replace('dashboard.html?demo=1');
  }

  function createPreviewBar() {
    if (!document.body || document.getElementById('rrnPreviewBar') || !document.getElementById('setoresContainer')) return;
    const bar = document.createElement('aside');
    bar.id = 'rrnPreviewBar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `
      <div><strong>PREVIEW COMPLETO</strong><span>Admin de demonstração · dados ficam somente neste navegador</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" data-users>Gestão de usuários</button>
        <button type="button" data-reset>Reiniciar demonstração</button>
      </div>`;
    Object.assign(bar.style, {
      margin: '12px 18px', padding: '10px 14px', borderRadius: '12px',
      background: '#F2BF4F', color: '#17324d', display: 'flex',
      justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      boxShadow: '0 6px 18px rgba(41,89,145,.14)'
    });
    const first = bar.querySelector('div');
    if (first) Object.assign(first.style, { display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' });
    bar.querySelectorAll('button').forEach(button => Object.assign(button.style, {
      border:'0', borderRadius:'9px', padding:'8px 11px', cursor:'pointer', fontWeight:'700', background:'#295991', color:'#fff'
    }));
    bar.querySelector('[data-users]')?.addEventListener('click', () => location.href = 'usuarios.html?demo=1');
    bar.querySelector('[data-reset]')?.addEventListener('click', reset);
    const header = document.querySelector('.navbar');
    header?.after(bar);
  }

  function createLoginEntry() {
    const card = document.getElementById('authCard');
    if (!card || document.getElementById('rrnPreviewEntry')) return;

    const box = document.createElement('section');
    box.id = 'rrnPreviewEntry';
    box.innerHTML = `
      <strong>Preview completo disponível</strong>
      <small>Entre como Administrador de demonstração para testar inventário, manutenção, histórico, lixeira, relatórios, configurações e usuários.</small>
      <button type="button">Acessar preview completo</button>`;
    Object.assign(box.style, {
      marginTop:'16px', padding:'14px', borderRadius:'12px', background:'rgba(242,191,79,.18)',
      border:'1px solid rgba(242,191,79,.65)', display:'grid', gap:'8px'
    });
    const button = box.querySelector('button');
    Object.assign(button.style, {
      border:'0', borderRadius:'10px', padding:'11px 14px', cursor:'pointer',
      background:'#295991', color:'#fff', fontWeight:'700'
    });
    button.addEventListener('click', () => {
      seed(false);
      location.href = 'dashboard.html?demo=1';
    });
    const tabs = card.querySelector('.auth-tabs');
    tabs?.before(box);

    const notice = document.getElementById('backendNotice');
    if (notice) {
      notice.hidden = false;
      notice.textContent = 'Preview em modo demonstração. O acesso completo abaixo funciona localmente; Supabase ainda não está conectado.';
    }
  }

  function roleLabel(role) {
    return { admin:'Administrador', operador:'Operador', monitoramento:'Monitoramento' }[role] || role;
  }

  function dateLabel(value) {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short' }).format(new Date(value)); }
    catch { return value; }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  }

  function toast(text) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function renderDemoMembers() {
    const body = document.getElementById('membersBody');
    if (!body) return;
    const members = readJson('rrn_demo_members', DEMO_MEMBERS);
    document.getElementById('memberCount').textContent = `${members.length} ${members.length === 1 ? 'usuário' : 'usuários'}`;
    body.innerHTML = members.map(user => {
      const self = user.user_id === DEMO_USER.id;
      return `<tr>
        <td class="user-cell"><strong>${esc(user.name)}</strong><small>${esc(user.email)}${self ? ' · você' : ''}</small></td>
        <td><span class="badge badge-${esc(user.role)}">${esc(roleLabel(user.role))}</span></td>
        <td><span class="badge badge-${esc(user.status)}">${user.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
        <td>${dateLabel(user.created_at)}</td>
        <td class="align-right"><div class="actions">
          <button class="action-btn" data-demo-role="${esc(user.user_id)}" ${self ? 'disabled' : ''}>Alterar perfil</button>
          <button class="action-btn ${user.status === 'active' ? 'danger' : ''}" data-demo-status="${esc(user.user_id)}" ${self ? 'disabled' : ''}>${user.status === 'active' ? 'Desativar' : 'Ativar'}</button>
        </div></td>
      </tr>`;
    }).join('');

    body.querySelectorAll('[data-demo-role]').forEach(button => button.addEventListener('click', () => {
      const membersNow = readJson('rrn_demo_members', DEMO_MEMBERS);
      const user = membersNow.find(item => item.user_id === button.dataset.demoRole);
      if (!user) return;
      const next = prompt('Novo perfil: admin, operador ou monitoramento', user.role);
      if (!next) return;
      const normalized = next.trim().toLowerCase();
      if (!['admin','operador','monitoramento'].includes(normalized)) return toast('Perfil inválido.');
      user.role = normalized;
      writeJson('rrn_demo_members', membersNow);
      renderDemoMembers();
      toast('Perfil alterado no preview.');
    }));

    body.querySelectorAll('[data-demo-status]').forEach(button => button.addEventListener('click', () => {
      const membersNow = readJson('rrn_demo_members', DEMO_MEMBERS);
      const user = membersNow.find(item => item.user_id === button.dataset.demoStatus);
      if (!user) return;
      user.status = user.status === 'active' ? 'inactive' : 'active';
      writeJson('rrn_demo_members', membersNow);
      renderDemoMembers();
      toast('Status alterado no preview.');
    }));
  }

  function renderDemoInvites() {
    const body = document.getElementById('invitesBody');
    if (!body) return;
    const invites = readJson('rrn_demo_invites', DEMO_INVITES);
    body.innerHTML = invites.length ? invites.map(invite => {
      const expired = !invite.used_at && new Date(invite.expires_at).getTime() < Date.now();
      const status = invite.used_at ? 'used' : expired ? 'expired' : 'pending';
      const label = status === 'used' ? 'Utilizado' : status === 'expired' ? 'Expirado' : 'Pendente';
      return `<tr>
        <td>${esc(invite.email || 'Qualquer e-mail')}</td>
        <td><span class="badge badge-${esc(invite.role)}">${esc(roleLabel(invite.role))}</span></td>
        <td>${dateLabel(invite.expires_at)}</td>
        <td><span class="badge badge-${status}">${label}</span></td>
      </tr>`;
    }).join('') : '<tr><td colspan="4">Nenhum convite gerado.</td></tr>';
  }

  function setupDemoUsersPage() {
    if (!document.getElementById('membersBody')) return;
    const notice = document.getElementById('pageNotice');
    if (notice) {
      notice.hidden = false;
      notice.textContent = 'Modo Preview: gestão de usuários simulada localmente. Nenhum e-mail é enviado e nenhum usuário real é criado.';
    }
    document.getElementById('tenantName').textContent = 'RRN Preview';
    document.getElementById('currentAdmin').textContent = 'Admin Preview · administrador de demonstração';
    renderDemoMembers();
    renderDemoInvites();

    const form = document.getElementById('inviteForm');
    if (form && !form.dataset.previewBound) {
      form.dataset.previewBound = '1';
      form.addEventListener('submit', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const email = document.getElementById('inviteEmail').value.trim().toLowerCase();
        const role = document.getElementById('inviteRole').value;
        const days = Number(document.getElementById('inviteDays').value || 7);
        const code = `RRN-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase()}`;
        const invites = readJson('rrn_demo_invites', DEMO_INVITES);
        invites.unshift({
          id: `demo-${Date.now()}`, email, role,
          expires_at: new Date(Date.now() + days * 86400000).toISOString(),
          used_at: null, created_at: new Date().toISOString()
        });
        writeJson('rrn_demo_invites', invites);
        document.getElementById('inviteCode').textContent = code;
        document.getElementById('inviteResult').hidden = false;
        form.reset();
        renderDemoInvites();
        toast('Convite simulado criado.');
      }, true);
    }

    const copy = document.getElementById('copyInviteButton');
    if (copy && !copy.dataset.previewBound) {
      copy.dataset.previewBound = '1';
      copy.addEventListener('click', async event => {
        event.stopImmediatePropagation();
        const code = document.getElementById('inviteCode').textContent;
        if (code) await navigator.clipboard?.writeText(code);
        toast('Código copiado.');
      }, true);
    }

    const refresh = document.getElementById('refreshButton');
    if (refresh && !refresh.dataset.previewBound) {
      refresh.dataset.previewBound = '1';
      refresh.addEventListener('click', event => {
        event.stopImmediatePropagation();
        renderDemoMembers();
        renderDemoInvites();
        toast('Dados de demonstração atualizados.');
      }, true);
    }
  }

  window.RRN_PREVIEW_DEMO = true;
  window.RRN_PREVIEW = Object.freeze({ enabled: true, seed, reset, demoUser: DEMO_USER });
  seed(false);

  function boot() {
    createLoginEntry();
    createPreviewBar();
    setupDemoUsersPage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('load', () => setTimeout(boot, 50));
})();
