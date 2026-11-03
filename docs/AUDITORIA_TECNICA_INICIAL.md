# Auditoria técnica inicial — RRN Manager

Data: 2026-11-03
Branch: `chore/site-wide-quality-audit`
PR: https://github.com/Rubertt12/Sistema-de-Inventario/pull/28

## Inventário do repositório

- 305 arquivos no repositório.
- 17 páginas HTML principais (além dos templates de e-mail).
- 145 arquivos JavaScript.
- 86 folhas de estilo CSS.

## Achados confirmados

1. `npm test` era apenas um placeholder que sempre falhava.
2. A validação CI anterior verificava uma lista fixa de 15 scripts e só executava push em uma branch antiga.
3. O dashboard tem 35 atributos `style=` inline; a página da loja tem 10. Isso espalha apresentação entre HTML e CSS e dificulta manutenção.
4. A aplicação tem muitas folhas CSS de correção/cascata, inclusive mais de uma camada de consistência de tema. Isso exige consolidação por componente e por página, não remoção em massa.
5. As páginas não compartilham todas a mesma pilha de estilos/scripts: páginas públicas, autenticação, inventário e suporte têm necessidades distintas. A aplicação de tema deve ser validada por página, não injetada cegamente em todas.

## O que esta PR implementa

- Substitui o teste placeholder por um validador estático sem dependências adicionais.
- Verifica sintaxe de todos os arquivos JavaScript não minificados.
- Verifica balanceamento básico de blocos CSS.
- Verifica referências locais a assets em HTML.
- Faz o GitHub Actions executar em `main`, branches de manutenção e pull requests.

## Resultado da validação

O workflow executou com sucesso na branch desta PR em 2026-11-03.

## Próxima etapa recomendada

Executar revisão por tela em desktop e mobile, cobrindo White Mode e Dark Mode, estados vazios, carregamento, tabelas, formulários, menus e modais. Depois, refatorar os estilos duplicados em pequenos lotes, preservando a especificidade e os estados funcionais existentes.

## Limites desta auditoria

A validação estática não substitui testes visuais em navegador, testes autenticados, validação de permissões/RLS nem testes de fluxos com dados reais. Nenhum dado do Supabase, segredo, configuração de autenticação ou regra de negócio foi alterado nesta etapa.
