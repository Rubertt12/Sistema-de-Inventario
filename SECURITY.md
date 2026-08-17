# Segurança do RRN Manager e RRN Agent

## Modelo do RRN Agent

O RRN Agent é um agente de inventário de endpoints. Ele não implementa controle remoto, terminal remoto, execução de comandos recebidos do servidor, VNC/RDP próprio ou serviço TCP de entrada.

A comunicação de inventário é iniciada pelo endpoint e enviada por HTTPS para o backend autorizado do RRN Manager.

## Controles implementados

- Endpoint do Agent restrito ao backend HTTPS autorizado do RRN Manager.
- Firewall do Windows configurado para bloquear conexões de entrada destinadas ao Core e ao Tray.
- Auditoria local fail-closed: se o processo do Agent entrar em estado TCP `LISTENING`, ele encerra a execução.
- Credencial individual por dispositivo; o backend armazena somente o hash do segredo.
- Segredo local protegido por Windows DPAPI (`LocalMachine`) e ACL restrita a `SYSTEM` e Administradores.
- Arquivo de status separado, somente leitura para usuários padrão.
- Sincronizações automáticas executadas por tarefa protegida do Windows.
- Enrollment temporário, com expiração e limite de usos.
- Revogação administrativa do Agent no RRN Manager.
- Atualizações com validação SHA-256, proteção contra downgrade e rollback.
- Instalador GUI e instalador PowerShell validam SHA-256 dos executáveis antes da instalação.
- Workflow de release com ações e dependências fixadas e execução concorrente serializada.
- Edge Function com autenticação própria por dispositivo, limite de payload, validação de formato e rate limiting.
- Row Level Security (RLS) e separação por tenant no Supabase.
- RPCs internos do Agent restritos ao `service_role`.
- Headers de segurança no frontend, incluindo CSP, HSTS, `nosniff` e proteção contra framing externo.

## Localização

A localização precisa usa o serviço de localização do Windows e depende de autorização do usuário no sistema operacional. Quando uma localização exata não está disponível, o backend pode registrar localização aproximada por IP público. O mapa global do RRN Manager agrupa/arredonda pontos para evitar expor coordenadas exatas de uma máquina individual.

## Princípio de privilégio mínimo

O Tray não precisa acessar o segredo do Agent. A credencial fica fora do contexto do usuário padrão e a rotina de inventário protegida é executada pela tarefa do Windows.

## Atualizações

Uma atualização só substitui Core/Tray após a validação dos hashes publicados. Se a substituição falhar, o atualizador tenta restaurar os binários anteriores. Downgrades automáticos são recusados.

## Limitações conhecidas / próximos passos

- Assinatura Authenticode dos executáveis depende de certificado de code signing confiável e ainda deve ser implementada antes de tratar a cadeia de distribuição como totalmente assinada.
- Nenhum software deve ser considerado invulnerável; as proteções deste documento reduzem a superfície de ataque e devem ser revisadas conforme o Agent evoluir.

## Regra de arquitetura

Funcionalidades futuras de acesso remoto ou execução remota não devem ser adicionadas ao Agent de inventário sem revisão separada de arquitetura, autenticação, autorização, auditoria e modelo de ameaça.
