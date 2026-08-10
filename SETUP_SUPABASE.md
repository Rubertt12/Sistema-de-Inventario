# Configuração do backend multi-tenant

Esta branch troca o cadastro e login em `localStorage` por **Supabase Auth + PostgreSQL + Row Level Security (RLS)**.

## 1. Criar o projeto

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Execute todo o arquivo `supabase/schema.sql`.
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
- `monitoramento`: acesso de leitura ao estado remoto do inventário.

## 5. Compatibilidade com o inventário atual

O código legado usa APIs síncronas do navegador. Para não reescrever todo o sistema nesta primeira evolução, `js/tenant-runtime.js` funciona como uma camada de compatibilidade:

- hidrata `setores` e `chamados` do tenant ao abrir o dashboard;
- mantém os dados locais necessários para os módulos antigos continuarem funcionando;
- sincroniza alterações para `tenant_inventory_state`;
- remove dados locais do tenant no logout;
- mantém `usuarioLogado` somente como objeto de compatibilidade, **sem senha**.

A evolução seguinte recomendada é normalizar setores, equipamentos e chamados em tabelas relacionais próprias e eliminar gradualmente o `localStorage` do inventário.

## 6. Teste mínimo

1. Crie a primeira organização e entre como administrador.
2. Cadastre um setor ou equipamento e recarregue o navegador.
3. Gere um convite em **Gestão de Usuários**.
4. Crie outro usuário usando esse convite.
5. Confirme que os dois usuários visualizam os dados do mesmo tenant.
6. Crie outra organização com outro e-mail.
7. Confirme que a segunda organização não visualiza dados da primeira.
8. Teste o perfil `monitoramento`; o RLS deve rejeitar gravações remotas.
