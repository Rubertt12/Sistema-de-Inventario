# Configuração do backend multi-tenant

Esta branch usa **Supabase Auth + PostgreSQL + Row Level Security (RLS)** para separar os dados de cada organização.

## 1. Instalação nova do banco

Para um projeto Supabase vazio, execute no **SQL Editor** nesta ordem:

1. `supabase/schema.sql`
2. `supabase/asset_management.sql`
3. `supabase/migrate_legacy_inventory.sql`
4. `supabase/security_hardening.sql`
5. Se houver dados JSON legados para importar, autentique um administrador do tenant e execute `select public.migrate_legacy_inventory();` **neste ponto**.
6. `supabase/security_hardening_v2.sql`
7. `supabase/security_hardening_v3.sql`
8. `supabase/security_hardening_v4.sql`

O `security_hardening.sql` é obrigatório. Ele move os helpers privilegiados de tenant/perfil para um schema privado, remove execução anônima, recria as RPCs de auditoria e migração como `SECURITY INVOKER` e reduz a superfície exposta pelo Data API.

Os nomes públicos `public.current_tenant_id()` e `public.current_role()` são preservados como wrappers **SECURITY INVOKER**, sem privilégio próprio, porque módulos posteriores ainda podem referenciá-los. Eles delegam aos helpers privados e não devem voltar a ser `SECURITY DEFINER`.

`security_hardening_v2.sql` bloqueia a RPC de migração para usuários comuns depois que a migração inicial estiver concluída. Por isso, se a importação do legado for necessária, faça-a entre as etapas 4 e 6.

`security_hardening_v3.sql` reduz grants e a superfície do Data API. `security_hardening_v4.sql` complementa ambientes maduros: preserva a compatibilidade com módulos de suporte/agente/loja/colaboradores e adiciona uma policy restritiva que impede sessões anônimas de acessar áreas de negócio.

Depois da instalação, execute os **Security Advisors** do Supabase. A liberação para produção exige que todo alerta esteja corrigido ou explicitamente justificado e revisado.

## 2. Atualização de uma produção existente

**Não reaplique `schema.sql`, `asset_management.sql` ou os scripts de instalação inicial sobre uma produção madura.** Uma produção que já recebeu migrations de suporte, agentes, colaboradores, loja, MFA ou plataforma possui dependências adicionais.

Para atualizar uma produção existente:

1. faça inventário dos objetos e migrations já instalados;
2. confirme quais RPCs `SECURITY DEFINER` são endpoints privilegiados intencionais e quais podem ser reduzidos;
3. aplique somente as migrations de hardening ainda ausentes e compatíveis com o estado atual;
4. use `security_hardening_v4.sql` como camada de compatibilidade para os helpers públicos e para separar usuários permanentes de sessões anônimas;
5. rode Security Advisors e testes funcionais após cada etapa;
6. não promova o frontend até concluir a validação do banco.

A migration v4 não altera dados de negócio. Ela mantém `public.current_tenant_id()` e `public.current_role()` como wrappers `SECURITY INVOKER`, revoga o endpoint antigo de branding e adiciona a policy `permanent_users_only` nas áreas que não devem ser acessíveis a usuários criados por `signInAnonymously()`.

## 3. Authentication

Em **Authentication > Providers > Email**, mantenha Email/Password habilitado. Em produção, mantenha confirmação de e-mail habilitada quando compatível com o fluxo de cadastro adotado.

O trigger `handle_new_auth_user()` cria o primeiro tenant ou associa o novo usuário a um convite. A função é usada pelo trigger de `auth.users` e não deve ser exposta como RPC para `anon` ou `authenticated`.

### Atendimento anônimo

O portal de suporte rápido usa `signInAnonymously()` de forma intencional. No Supabase, esses usuários assumem o papel PostgreSQL `authenticated`, mas possuem o claim JWT `is_anonymous=true`.

Por isso, **não desabilite o suporte visitante apenas para eliminar avisos do Advisor**. O hardening v4 usa uma policy RLS restritiva baseada em `is_anonymous` para bloquear sessões anônimas em inventário, administração, agente e loja, mantendo fora desse bloqueio as tabelas necessárias ao atendimento visitante, como `support_customers`, `support_tickets` e `support_ticket_messages`.

## 4. Frontend

`js/supabase-config.js` deve conter somente a Project URL e uma chave publicável (`sb_publishable_...`). Nunca use `service_role`, `sb_secret_...` ou qualquer segredo administrativo em HTML/JavaScript público.

## 5. Isolamento entre tenants

Cada usuário ativo possui um `tenant_id` em `public.profiles`. As policies RLS consultam helpers de tenant/perfil e restringem leitura/escrita ao tenant autenticado.

Perfis disponíveis incluem:

- `admin`: administra membros e altera inventário;
- `operador`: altera inventário sem administrar membros;
- `monitoramento`: somente leitura nas áreas previstas;
- perfis adicionais podem existir em módulos especializados, como loja e suporte.

Não crie policies baseadas apenas em `TO authenticated`. Toda policy de negócio precisa também verificar tenant e, quando aplicável, perfil, `auth.uid()` e se a sessão anônima é permitida naquele fluxo.

## 6. Modelo de dados

O modelo principal inclui:

- `tenants` e `profiles`;
- `tenant_invitations`;
- `tenant_inventory_state` como ponte temporária do legado;
- `sectors`;
- `assets`;
- `asset_movements`;
- `maintenance_records`;
- `audit_events`.

Produções maduras também podem incluir módulos de suporte, colaboradores, agentes, loja, plataforma e MFA. Todas as tabelas de negócio expostas devem manter RLS habilitado.

## 7. Migração do inventário legado

Após `security_hardening.sql` e antes de `security_hardening_v2.sql`, em uma instalação nova, um administrador autenticado pode executar:

```sql
select public.migrate_legacy_inventory();
```

A função roda como **SECURITY INVOKER**, portanto continua sujeita às policies RLS do chamador e só opera sobre o próprio tenant. Depois de `security_hardening_v2.sql`, a execução pelo papel `authenticated` fica bloqueada por segurança.

Em uma produção madura onde a migração legado já foi concluída, não reabra essa RPC.

## 8. Teste obrigatório antes de produção

Valide no mínimo:

1. Tenant A consegue ler seus próprios registros.
2. Tenant A não consegue ler `tenants`, `profiles`, inventário, ativos ou histórico do Tenant B.
3. Tenant A não consegue atualizar/inserir registros apontando para o Tenant B.
4. `monitoramento` não consegue gravar onde possui somente leitura.
5. `operador` não consegue administrar usuários/convites.
6. uma sessão sem login (`anon`) não possui acesso às tabelas de negócio.
7. uma sessão criada por `signInAnonymously()` acessa somente o fluxo de suporte permitido e não inventário/admin/agente/loja.
8. as funções de trigger não são executáveis pelo navegador.
9. os wrappers `public.current_tenant_id()` e `public.current_role()` são `SECURITY INVOKER`.
10. cada RPC `SECURITY DEFINER` exposta possui validação interna explícita e justificativa documentada.
11. Security Advisors não apresentam alertas não justificados.
12. o frontend não contém `service_role` nem chaves secretas.

## 9. Compatibilidade temporária

Enquanto os módulos antigos ainda dependem de APIs síncronas do navegador, `js/tenant-runtime.js` mantém `tenant_inventory_state` como ponte de compatibilidade. O objetivo final é ler e gravar diretamente nas tabelas relacionais e retirar o JSONB como fonte principal.
