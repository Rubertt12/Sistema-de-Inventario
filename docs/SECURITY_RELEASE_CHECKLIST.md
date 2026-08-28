# Checklist de segurança para publicação

Este checklist deve ser concluído antes de anunciar uma versão do RRN Manager como pronta para uso comercial.

## Banco e autenticação

- [ ] Executar os advisors de segurança e desempenho do Supabase.
- [ ] Confirmar RLS habilitada em todas as tabelas expostas do schema `public`.
- [ ] Testar que um usuário do tenant A não lê, altera ou exclui registros do tenant B.
- [ ] Revisar todas as funções `SECURITY DEFINER`, revogar `EXECUTE` de `PUBLIC` e `anon` quando não necessário.
- [ ] Confirmar que nenhuma view exposta ignora RLS; usar `security_invoker` quando aplicável.
- [ ] Confirmar que o frontend contém apenas chave publicável, nunca `service_role` ou `sb_secret`.
- [ ] Revisar URLs de redirecionamento do Auth e desativar origens não utilizadas.
- [ ] Habilitar proteção contra abuso no cadastro e recuperação de senha.

## Aplicação

- [ ] Executar `npm test` e exigir resultado sem falhas.
- [ ] Executar auditoria de dependências e corrigir vulnerabilidades altas ou críticas.
- [ ] Testar login, logout, expiração de sessão, MFA e recuperação de senha.
- [ ] Testar permissões de administrador, operador e visualizador.
- [ ] Testar exclusão, restauração, importação, exportação e histórico de ativos.
- [ ] Verificar cabeçalhos de segurança no domínio de produção.
- [ ] Confirmar que erros apresentados ao usuário não expõem SQL, tokens ou dados internos.

## Operação

- [ ] Confirmar backup automático ativo e registrar um teste de restauração.
- [ ] Definir responsável técnico e canal de incidentes.
- [ ] Configurar monitoramento de falhas de login, erros de API e indisponibilidade.
- [ ] Revisar logs para evitar armazenamento de senhas, tokens e dados excessivos.
- [ ] Definir prazo de retenção e exclusão de dados por tipo de registro.
- [ ] Aprovar Política de Privacidade e Termos de Uso preenchidos com os dados jurídicos reais.

## Evidências da versão

Registrar para cada publicação: data, commit, responsável, resultado dos testes, resultado dos advisors, teste de restauração e eventuais riscos aceitos.
