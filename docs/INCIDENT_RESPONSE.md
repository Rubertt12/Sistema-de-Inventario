# Plano de resposta a incidentes

## Classificação

- **Crítico:** acesso indevido entre empresas, vazamento de credencial privilegiada, perda ou alteração ampla de dados.
- **Alto:** comprometimento de uma conta administrativa, indisponibilidade prolongada ou falha de backup.
- **Médio:** abuso limitado, falha localizada ou exposição sem confirmação de acesso aos dados.
- **Baixo:** tentativa bloqueada, alerta preventivo ou erro sem impacto em confidencialidade, integridade ou disponibilidade.

## Resposta inicial

1. Registrar horário, pessoa que identificou, ambiente e evidências.
2. Preservar logs; não apagar ou editar evidências.
3. Conter o problema: revogar sessões, bloquear credenciais, pausar função ou restringir acesso afetado.
4. Identificar tenants, usuários, registros e período potencialmente afetados.
5. Corrigir a causa e testar em ambiente controlado.
6. Restaurar o serviço gradualmente e monitorar recorrência.
7. Documentar causa, impacto, ações e melhorias preventivas.

## Credencial exposta

- Revogar imediatamente a credencial.
- Criar uma nova credencial com privilégio mínimo.
- Buscar uso indevido nos logs desde a última data conhecida como segura.
- Invalidar sessões relacionadas quando aplicável.
- Nunca publicar o valor comprometido no chamado ou relatório.

## Possível violação de dados pessoais

O responsável jurídico deve avaliar impacto, titulares envolvidos e necessidade de comunicação conforme a LGPD e orientações vigentes da ANPD. Nenhuma comunicação externa deve minimizar ou ampliar o incidente sem evidências.

## Pós-incidente

Criar ações com responsável e prazo, adicionar teste de regressão e atualizar este plano quando a resposta revelar lacunas.
