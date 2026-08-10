# Configuração do backend multi-tenant

Esta branch troca o cadastro e login em `localStorage` por **Supabase Auth + PostgreSQL + Row Level Security (RLS)** e prepara a migração do inventário para tabelas relacionais próprias.

## 1. Criar o projeto

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Execute, nesta ordem:
   1. `supabase/schema.sql`
   2. `supabase/asset_management.sql`
   3. `supabase/migrate_legacy_inventory.sql`
4. Em **Authentication > Providers > Email**, mantenha Email/Password habilitado.

Para testes rápidos, a confirmação obrigatória de e-mail pode ser desativada temporariamente. Em produção, mantenha a confirmação habilitada.

## 2. Configurar o frontend

Abra `js/supabase-config.js` e substitua os placeholders:

```js
window.RRN_SUPABASE = Object.freeze({
  url: 'https://SEU-PROJETO.supabase.co',
  anonKey: 'SUA_CHAVE_ANON_PUBLICA'
});
```

Use somente a **Project URL** e a **anon/public key**. Nunca coloque a `service_role` no HTML ou JavaScript público.

## 3. Como o tenant funciona

- Ao criar uma conta informando uma organização, o banco cria um tenant novo e torna o primeiro usuário `admin`.
- O administrador abre **Gestão de Usuários**, informa o e-mail, perfil e validade e gera um código temporário.
- O convidado usa **Criar conta** na tela inicial e cola o código.
- O trigger do banco associa o novo usuário ao tenant correto e aplica o perfil do convite.
- O código original aparece uma única vez para o administrador; no banco fica somente o hash SHA-256.

## 4. Perfis

- `admin`: gerencia membros e altera o inventário.
- `operador`: altera o inventário sem administrar membros.
- `monitoramento`: acesso de leitura ao inventário.

As políticas RLS usam `current_tenant_id()` e `current_role()` para impedir que um usuário leia ou altere registros de outro tenant.

## 5. Compatibilidade com o inventário atual

O código legado usa APIs síncronas do navegador. Para não reescrever todo o sistema de uma vez, `js/tenant-runtime.js` funciona como camada de compatibilidade:

- hidrata `setores`, `chamados` e `asset_history` do tenant ao abrir o dashboard;
- mantém os dados locais necessários para os módulos antigos continuarem funcionando;
- sincroniza alterações para `tenant_inventory_state`;
- remove dados locais do tenant no logout;
- mantém `usuarioLogado` somente como objeto de compatibilidade, **sem senha**.

A versão do payload de compatibilidade agora é `2`.

## 6. Modelo relacional de ativos

`supabase/asset_management.sql` cria as tabelas que serão a fonte de verdade definitiva:

- `sectors`: setores do tenant;
- `assets`: equipamentos e dados patrimoniais;
- `asset_movements`: transferências e mudanças de situação;
- `maintenance_records`: histórico de manutenção/chamados;
- `audit_events`: trilha de auditoria do workspace.

Os ativos suportam, entre outros campos:

- tipo do equipamento;
- hostname;
- número de série;
- etiqueta/patrimônio;
- fabricante e modelo;
- usuário responsável;
- localização;
- situação patrimonial;
- data de compra;
- garantia;
- observações;
- metadados adicionais.

## 7. Histórico e auditoria no frontend

`js/asset-history.js` registra automaticamente alterações do inventário comparando o estado antes/depois das operações existentes.

São registrados:

- equipamento criado;
- transferência entre setores;
- entrada e saída de manutenção;
- chamado registrado;
- edição de dados patrimoniais;
- exclusão.

O histórico é sincronizado por tenant durante a fase de compatibilidade. Cada card de equipamento recebe acesso ao **Histórico**, e a tela de Configurações recebe o **Histórico de alterações** do workspace.

## 8. Migrar os dados existentes

Depois que os três scripts SQL estiverem instalados e o primeiro administrador estiver autenticado, execute a RPC:

```sql
select public.migrate_legacy_inventory();
```

A função:

- só migra o tenant do usuário autenticado;
- exige perfil `admin`;
- lê `tenant_inventory_state`;
- cria setores relacionais;
- cria os equipamentos com `legacy_key` para evitar duplicação;
- preserva fabricante, modelo, usuário, localização, garantia e demais dados conhecidos;
- cria o evento inicial de movimentação;
- cria manutenção aberta se o equipamento já estiver em manutenção;
- registra a migração na auditoria.

A função é idempotente para os equipamentos que possuem a mesma `legacy_key`: uma nova execução não deve recadastrar o mesmo ativo.

## 9. Teste mínimo

1. Crie a primeira organização e entre como administrador.
2. Cadastre um setor e alguns equipamentos.
3. Preencha fabricante, modelo, localização e garantia em um ativo.
4. Transfira o ativo para outro setor e abra o **Histórico**.
5. Coloque o ativo em manutenção e libere-o novamente.
6. Abra **Configurações > Histórico de alterações** e valide os eventos.
7. Recarregue o navegador e confirme que os dados permanecem no mesmo tenant.
8. Gere um convite em **Gestão de Usuários**.
9. Crie outro usuário usando esse convite e confirme que ele visualiza o mesmo tenant.
10. Crie outra organização com outro e-mail e confirme que não visualiza os dados da primeira.
11. Teste o perfil `monitoramento`; o RLS deve rejeitar gravações remotas.
12. Execute `select public.migrate_legacy_inventory();` como admin e valide as tabelas relacionais.

## 10. Próxima etapa de migração

Enquanto o frontend legado ainda existir, `tenant_inventory_state` continua sendo a ponte de compatibilidade. A migração seguinte deve fazer os módulos do dashboard lerem e gravarem diretamente em `sectors`, `assets`, `asset_movements` e `maintenance_records`. Quando todos os fluxos estiverem validados, o JSONB deixa de ser necessário como fonte principal.
