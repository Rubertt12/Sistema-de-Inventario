# Preview completo do RRN Manager

O preview automático da branch `agent/multi-tenant-professional-ui` possui um modo de demonstração local para permitir validar todo o procedimento antes da configuração do Supabase.

## Links

- Entrada: `https://sistema-de-inventario-git-agent-multi-4db8df-rubertts-projects.vercel.app/?demo=1`
- Dashboard direto: `https://sistema-de-inventario-git-agent-multi-4db8df-rubertts-projects.vercel.app/dashboard.html?demo=1`
- Gestão de usuários: `https://sistema-de-inventario-git-agent-multi-4db8df-rubertts-projects.vercel.app/usuarios.html?demo=1`

## O que o modo demo libera

- sessão local como Administrador;
- setores e equipamentos de exemplo;
- criação, edição, exclusão, transferência e drag & drop;
- manutenção e chamados;
- histórico/auditoria;
- lixeira e restauração;
- indicadores e relatórios;
- backup/importação/exportação;
- personalização visual;
- gestão simulada de usuários, perfis e convites;
- verificação e migração de backend simuladas.

O modo demo não cria usuários reais, não envia convites por e-mail e não grava dados no Supabase. Tudo permanece no navegador usado para acessar o preview.

O backend real continuará utilizando Supabase Auth, PostgreSQL e RLS quando a configuração for concluída.
