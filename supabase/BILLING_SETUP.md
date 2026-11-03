# Configuração da cobrança do RRN Manager

## Serviços implantados

- Edge Function `billing-api`: exige JWT Supabase válido e perfil administrador do workspace para alterar a assinatura.
- Edge Function `mercadopago-webhook`: endpoint público, mas só processa notificações com assinatura HMAC válida.
- O checkout usa a API de assinaturas do Mercado Pago (`POST /preapproval`) com valor definido no backend.
- O plano e os limites só são alterados após confirmação do Mercado Pago. O retorno do navegador não libera o acesso.

## Segredos obrigatórios no Supabase

No projeto RRN Manager, abra **Project Settings / Edge Functions / Secrets** e configure:

| Nome | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token da aplicação Mercado Pago. Comece com credenciais de teste. |
| `MP_WEBHOOK_SECRET` | Segredo HMAC gerado em Mercado Pago Developers > sua aplicação > Webhooks. |
| `APP_BASE_URL` | URL pública canônica do RRN Manager, sem barra no final. Neste projeto: `https://rrnmanager.vercel.app`. |

Não coloque esses valores no GitHub, no frontend, em mensagens ou em variáveis `VITE_` / `NEXT_PUBLIC_`.

O Supabase injeta as credenciais administrativas do projeto no runtime das Edge Functions. Não crie uma cópia delas no código.

## Mercado Pago

1. Crie ou selecione a aplicação de integração do RRN Manager no painel de desenvolvedores.
2. Use primeiro as credenciais de teste e uma conta compradora de teste.
3. Em Webhooks, gere/copiei o segredo de assinatura e salve como `MP_WEBHOOK_SECRET` no Supabase.
4. O checkout envia a URL de notificação diretamente na criação de cada assinatura:
   `https://tvfiicmwkddpswgbjyok.supabase.co/functions/v1/mercadopago-webhook`.
5. Teste criação, autorização, cancelamento e renovação de assinatura antes de substituir o Access Token de teste pelo de produção.

## Fluxo de teste

1. Crie um workspace novo pela página de cadastro. Ele recebe 7 dias de teste e o plano Starter.
2. Entre com o usuário administrador e abra **Plano e cobrança** no menu do sistema.
3. Escolha um plano. O Mercado Pago abre o checkout hospedado.
4. A assinatura só fica ativa quando o webhook assinado confirma o status `authorized`.
5. Confira no painel do Mercado Pago o recebimento do webhook e, no Supabase, a atualização em `tenant_subscriptions`.

## Observações

- Os três workspaces já existentes foram marcados como `grandfathered`, sem interrupção de acesso ou alteração dos dados.
- O teste grátis não solicita cartão. Se o cliente escolher um plano durante o teste, o checkout agenda a primeira cobrança para o fim do período de teste.
- O banco mantém leitura dos dados após o fim do período, mas bloqueia operações de escrita nos módulos centrais de inventário até reativação.
- O cancelamento é enviado ao Mercado Pago; o acesso pode continuar até o fim do período já pago, conforme a data informada pelo provedor.
- Os preços e limites iniciais estão cadastrados em `billing_plans` e podem ser alterados pelo administrador da plataforma após revisão comercial.
