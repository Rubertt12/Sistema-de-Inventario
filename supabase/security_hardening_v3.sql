-- RRN Manager · hardening de privilégios e superfície do Data API
-- Aplicar somente depois de security_hardening.sql e security_hardening_v2.sql.
--
-- Objetivos:
--   1. impedir exposição automática de objetos futuros;
--   2. remover privilégios DDL/DCL desnecessários dos papéis do navegador;
--   3. tornar o acesso anônimo opt-in;
--   4. manter públicas somente as RPCs realmente usadas antes do login.
--
-- Este arquivo não altera dados e não desabilita RLS.

-- Objetos futuros criados pelo papel postgres passam a ser privados por padrão.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Os defaults do papel supabase_admin são gerenciados pela plataforma e não
-- podem ser alterados pelo papel postgres deste projeto.

-- O Data API nunca precisa permitir TRUNCATE, REFERENCES ou TRIGGER ao navegador.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- Acesso direto anônimo a tabelas é negado por padrão.
-- O portal público precisa somente localizar portais habilitados; o restante passa
-- por RPCs com retorno limitado.
revoke all privileges on all tables in schema public from anon;
grant select on table public.support_portals to anon;

-- Usuários anônimos não devem manipular sequences. Usuários autenticados mantêm
-- somente os privilégios necessários para colunas identity/serial.
revoke all privileges on all sequences in schema public from anon;
revoke update on all sequences in schema public from authenticated;

-- Remove a herança implícita de EXECUTE concedida ao pseudo-papel PUBLIC.
revoke execute on all functions in schema public from public;

-- Acesso anônimo a RPCs é opt-in. A versão antiga de branding deixa de ser uma
-- segunda superfície pública; o frontend usa exclusivamente a versão v2.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_public_tenant_branding_v2(text) to anon;
grant execute on function public.get_support_chat_bot_config(text) to anon;

-- Funções de trigger e manutenção interna não são endpoints do navegador.
revoke execute on function public.handle_new_auth_user() from anon, authenticated;
revoke execute on function public.touch_updated_at() from anon, authenticated;
revoke execute on function public.support_touch_updated_at() from anon, authenticated;
revoke execute on function public.support_prepare_ticket() from anon, authenticated;
revoke execute on function public.support_prepare_message() from anon, authenticated;
revoke execute on function public.support_after_message() from anon, authenticated;
revoke execute on function public.support_after_ticket_queue() from anon, authenticated;
revoke execute on function public.support_detect_initial_maintenance() from anon, authenticated;
revoke execute on function public.support_log_ticket_event() from anon, authenticated;
revoke execute on function public.support_queue_ticket_asset() from anon, authenticated;
revoke execute on function public.support_sync_customer_collaborator() from anon, authenticated;
revoke execute on function public.support_sync_inventory_collaborators() from anon, authenticated;
revoke execute on function public.support_validate_ticket_assignment() from anon, authenticated;
revoke execute on function public.migrate_legacy_inventory() from anon, authenticated;

-- Tabelas internas sem policies permanecem inacessíveis pelo Data API.
revoke all privileges on table public.agent_security_rate_limits from anon, authenticated;
revoke all privileges on table public.mfa_trusted_devices from anon, authenticated;
