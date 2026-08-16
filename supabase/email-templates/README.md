# Templates de e-mail — RRN Manager

Estes arquivos reproduzem a identidade visual usada pelo RRN Manager nos e-mails enviados pelo Supabase Auth.

## Templates usados hoje

| Fluxo no RRN | Template no Supabase | Arquivo | Assunto sugerido |
| --- | --- | --- | --- |
| Confirmação de cadastro | Confirm signup | `confirmation.html` | `Confirme seu e-mail | RRN Manager` |
| Recuperação de senha | Reset password | `recovery.html` | `Redefinição de senha | RRN Manager` |
| Código de contingência por e-mail | Magic Link / OTP | `magic_link.html` | `Seu código de acesso | RRN Manager` |

## Aplicação no projeto hospedado

No projeto **RRN Manager** do Supabase, abra `Authentication > Email Templates`, selecione cada fluxo da tabela e copie o HTML do arquivo correspondente.

### Importante para o fallback por e-mail

O arquivo `magic_link.html` usa somente `{{ .Token }}` e **não** usa `{{ .ConfirmationURL }}`. Isso força o `signInWithOtp()` a entregar um código numérico em vez de um link mágico.

O código JavaScript usa `shouldCreateUser: false`, então a contingência nunca cria uma nova conta por engano.

## Segurança

O fallback por e-mail foi desenhado para liberar o acesso operacional quando o usuário está temporariamente sem o aplicativo autenticador. Ele não transforma o e-mail em fator MFA nativo do Supabase. Operações críticas que exigem `aal2` continuam dependendo de TOTP/Phone MFA nativo.

Para produção, revise também no Supabase:

- expiração do OTP;
- limite de reenvio;
- SMTP personalizado;
- remetente e domínio autenticados.
