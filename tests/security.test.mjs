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
