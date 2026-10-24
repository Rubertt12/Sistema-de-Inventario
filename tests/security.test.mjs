import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('o frontend usa somente uma chave publicável do Supabase', () => {
  const config = read('js/supabase-config.js');
  assert.match(config, /sb_publishable_/);
  assert.doesNotMatch(config, /service_role|sb_secret_/i);
});

test('não existe servidor legado de cadastro', () => {
  assert.equal(existsSync(new URL('server.js', root)), false);
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(pkg.dependencies, {});
});

test('o esquema principal habilita RLS e limita dados ao tenant atual', () => {
  const schema = `${read('supabase/schema.sql')}\n${read('supabase/asset_management.sql')}`;
  assert.match(schema, /enable row level security/i);
  assert.match(schema, /current_tenant_id\(\)/i);
  assert.match(schema, /auth\.uid\(\)/i);
  assert.ok((schema.match(/create policy/gi) || []).length >= 20);
});

test('o hardening revoga funções sensíveis dos papéis públicos', () => {
  const hardening = `${read('supabase/security_hardening.sql')}\n${read('supabase/security_hardening_v2.sql')}`;
  assert.match(hardening, /revoke execute[\s\S]+from anon/i);
  assert.match(hardening, /revoke all[\s\S]+from public/i);
});

test('helpers públicos maduros são wrappers invoker, não funções privilegiadas removidas', () => {
  const hardening = read('supabase/security_hardening.sql');
  assert.doesNotMatch(hardening, /drop function public\.current_(?:role|tenant_id)\s*\(/i);
  assert.match(hardening, /create or replace function public\.current_tenant_id\(\)[\s\S]+security invoker[\s\S]+private\.current_tenant_id\(\)/i);
  assert.match(hardening, /create or replace function public\.current_role\(\)[\s\S]+security invoker[\s\S]+private\.current_user_role\(\)/i);
  assert.match(hardening, /revoke all on function public\.current_tenant_id\(\) from public, anon/i);
  assert.match(hardening, /revoke all on function public\.current_role\(\) from public, anon/i);
});

test('o hardening v3 torna privilégios futuros privados e reduz a superfície anônima', () => {
  const hardening = read('supabase/security_hardening_v3.sql');
  assert.match(hardening, /alter default privileges[\s\S]+revoke all privileges on tables from anon, authenticated/i);
  assert.match(hardening, /revoke truncate, references, trigger on all tables/i);
  assert.match(hardening, /revoke execute on all functions in schema public from public/i);
  assert.match(hardening, /revoke execute on all functions in schema public from anon/i);
  assert.match(hardening, /grant execute on function public\.get_public_tenant_branding_v2\(text\) to anon/i);
  assert.match(hardening, /grant execute on function public\.get_support_chat_bot_config\(text\) to anon/i);
  assert.doesNotMatch(hardening, /grant execute on function public\.get_public_tenant_branding\(text\) to anon/i);
  assert.match(hardening, /public\.mfa_trusted_devices/i);
  assert.match(hardening, /revoke all privileges on table %s from anon, authenticated/i);
});

test('o hardening v4 bloqueia sessões anônimas nas áreas de negócio sem bloquear suporte visitante', () => {
  const hardening = read('supabase/security_hardening_v4.sql');
  assert.match(hardening, /security invoker/i);
  assert.match(hardening, /is_anonymous/i);
  assert.match(hardening, /as restrictive for all to authenticated/i);
  for (const table of ['public.assets', 'public.tenant_inventory_state', 'public.agent_devices', 'public.store_sales']) {
    assert.match(hardening, new RegExp(table.replace('.', '\\.'), 'i'));
  }
  const guardedList = hardening.match(/foreach relation_name in array array\[([\s\S]*?)\]\s*loop/i)?.[1] || '';
  for (const guestTable of ['public.support_customers', 'public.support_tickets', 'public.support_ticket_messages', 'public.support_ticket_participants', 'public.support_portals']) {
    assert.doesNotMatch(guardedList, new RegExp(guestTable.replace('.', '\\.'), 'i'));
  }
});

test('todos os assets locais referenciados nas páginas existem', () => {
  for (const page of ['index.html', 'login.html', 'dashboard.html', 'configuracoes.html', 'chamados.html', 'portal.html', 'usuarios.html']) {
    const html = read(page);
    const refs = [...html.matchAll(/(?:src|href)=["']([^"'#?]+)(?:\?[^"']*)?["']/g)]
      .map(match => match[1])
      .filter(value => !/^(?:https?:|mailto:|tel:|javascript:)/i.test(value));

    for (const ref of refs) {
      const relative = ref.replace(/^\//, '').replace(/^\.\//, '');
      assert.ok(existsSync(join(root.pathname, relative)), `${page}: asset ausente ${ref}`);
    }
  }
});

test('a hospedagem aplica cabeçalhos mínimos de segurança', () => {
  const config = JSON.parse(read('vercel.json'));
  const headers = new Map(config.headers[0].headers.map(item => [item.key.toLowerCase(), item.value]));
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(headers.get('strict-transport-security'), /max-age=/);
  assert.match(headers.get('content-security-policy'), /object-src 'none'/);
  assert.match(headers.get('content-security-policy'), /upgrade-insecure-requests/);
});
