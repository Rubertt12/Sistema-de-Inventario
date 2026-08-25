# Configuração do backend multi-tenant

Esta branch usa **Supabase Auth + PostgreSQL + Row Level Security (RLS)** para separar os dados de cada organização.

## 1. Instalação do banco

No **SQL Editor** do Supabase, execute nesta ordem:

1. `supabase/schema.sql`
2. `supabase/asset_management.sql`
3. `supabase/migrate_legacy_inventory.sql`
4. `supabase/security_hardening.sql`
5. Se houver dados JSON legados para importar, autentique um administrador do tenant e execute `select public.migrate_legacy_inventory();` **neste ponto**.
6. `supabase/security_hardening_v2.sql`
7. `supabase/security_hardening_v3.sql`

O `security_hardening.sql` é obrigatório. Ele move os helpers privilegiados de tenant/perfil para um schema privado, remove execução anônima, recria as RPCs de auditoria e migração como `SECURITY INVOKER` e reduz a superfície exposta pelo Data API.

`security_hardening_v2.sql` bloqueia a RPC de migração para usuários comuns depois que a migração inicial estiver concluída. Por isso, se a importação do legado for necessária, faça-a entre as etapas 4 e 6.

Depois da instalação, execute os **Security Advisors** do Supabase. A liberação para produção exige zero alertas de segurança não justificados.

## 2. Authentication

Em **Authentication > Providers > Email**, mantenha Email/Password habilitado. Em produção, mantenha confirmação de e-mail habilitada.

O trigger `handle_new_auth_user()` cria o primeiro tenant ou associa o novo usuário a um convite. A função é usada pelo trigger de `auth.users` e não deve ser exposta como RPC para `anon` ou `authenticated`.

## 3. Frontend

`js/supabase-config.js` deve conter somente a Project URL e uma chave publicável (`sb_publishable_...`). Nunca use `service_role`, `sb_secret_...` ou qualquer segredo administrativo em HTML/JavaScript público.

## 4. Isolamento entre tenants

Cada usuário ativo possui um `tenant_id` em `public.profiles`. As policies RLS consultam helpers localizados no schema privado e restringem leitura/escrita ao tenant autenticado.

Perfis disponíveis:

- `admin`: administra membros e altera inventário;
- `operador`: altera inventário sem administrar membros;
- `monitoramento`: somente leitura.

Não crie policies baseadas apenas em `TO authenticated`. Toda policy de negócio precisa também verificar tenant e, quando aplicável, perfil e `auth.uid()`.

## 5. Modelo de dados

O modelo principal inclui:

- `tenants` e `profiles`;
- `tenant_invitations`;
- `tenant_inventory_state` como ponte temporária do legado;
- `sectors`;
- `assets`;
- `asset_movements`;
- `maintenance_records`;
- `audit_events`.

Todas as tabelas de negócio expostas devem manter RLS habilitado.

## 6. Migração do inventário legado

Após `security_hardening.sql` e antes de `security_hardening_v2.sql`, um administrador autenticado pode executar:

```sql
select public.migrate_legacy_inventory();
```

A função roda como **SECURITY INVOKER**, portanto continua sujeita às policies RLS do chamador e só opera sobre o próprio tenant. Depois de `security_hardening_v2.sql`, a execução pelo papel `authenticated` fica bloqueada por segurança.

## 7. Teste obrigatório antes de produção

Valide no mínimo:

1. Tenant A consegue ler seus próprios registros.
2. Tenant A não consegue ler `tenants`, `profiles`, inventário, ativos ou histórico do Tenant B.
3. Tenant A não consegue atualizar/inserir registros apontando para o Tenant B.
4. `monitoramento` não consegue gravar.
5. `operador` não consegue administrar usuários/convites.
6. `anon` não possui acesso às tabelas de negócio.
7. As funções de trigger não são executáveis pelo navegador.
8. Security Advisors não apresentam alertas de segurança pendentes.
9. O frontend não contém `service_role` nem chaves secretas.

## 8. Compatibilidade temporária

Enquanto os módulos antigos ainda dependem de APIs síncronas do navegador, `js/tenant-runtime.js` mantém `tenant_inventory_state` como ponte de compatibilidade. O objetivo final é ler e gravar diretamente nas tabelas relacionais e retirar o JSONB como fonte principal.
