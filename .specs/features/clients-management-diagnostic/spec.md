# Diagnóstico de Gestão (13 Dimensões) — Specification

Issue: #166
Branch: feat/clients-management-diagnostic

## Problem Statement

Atualmente, o diagnóstico do cliente em `/clients/[id]/diagnostic` é apenas um formulário rudimentar com 3 campos: notas em texto livre, produto recomendado e data de realização. 

Na prática operacional da DRYOS, o Diagnóstico de Gestão é uma ferramenta fundamental de avaliação de maturidade da empresa em 13 dimensões estratégicas e operacionais, composta por 61 perguntas, cálculo de maturidade geral e por dimensão (0-100, Níveis 1 a 5), 23 regras de sinais de alerta (severidades Alta e Média) e plano de ação estruturado em 3 horizontes (Quick Wins 30d, Estruturação 90d e Consolidação 6-12m).

Existe um protótipo funcional em HTML (`diagnostico-de-gestao.html`), mas ele salva apenas em `localStorage` do navegador e não é integrado ao banco de dados do sistema nem ao histórico do cliente.

## Goals

- [ ] **Persistência no Banco**: Armazenar diagnósticos completos vinculados ao `client_id`, gravando dados de identificação (`profile_data`), respostas às 61 perguntas (`answers`), perguntas marcadas como N/A (`na_answers`), notas calculadas por dimensão e gerais (`computed_scores`), alertas identificados (`flags`), status (`draft` / `completed`) e data de realização.
- [ ] **Múltiplos Diagnósticos por Cliente**: Permitir histórico de diagnósticos para um mesmo cliente (ex: Diagnóstico inicial vs. Reavaliações semestrais/anuais), removendo a restrição de unicidade rígida (`UNIQUE(client_id)`).
- [ ] **Wizard de Preenchimento (Design System DRYOS)**: Fluxo passo a passo em 15 etapas (Identificação → 13 Dimensões → Relatório) com navegação fluida, progresso, suporte a mobile, autosave/rascunho no banco e layout 100% aderente ao Design System (Tailwind 4, Funnel Display, Onest, JetBrains Mono, pílulas canônicas).
- [ ] **Relatório Executivo & Visual**: Visualização do relatório completo com Gauge de Maturidade, badge de Nível (1 a 5), Resumo Executivo, Gráfico Radar SVG responsivo, tabela por dimensão com barras coloridas, Top 3 Pontos Fortes e Lacunas Críticas, Sinais de Alerta com severidades e Plano de Ação em 3 colunas.
- [ ] **Integração na Tela do Cliente**: Na página `/clients/[id]`, exibir a seção de Diagnóstico atualizada com os resultados mais recentes (índice, nível, destaques e status) e ações diretas para "Ver Relatório", "Continuar Rascunho", "Editar" ou "Novo Diagnóstico".

## Out of Scope

- Edição dinâmica do catálogo de perguntas por tela admin (as 13 dimensões, textos, pesos e regras de alerta são fixados no código como constantes de domínio TypeScript, espelhando a metodologia canônica).
- Ingestão automática externa via formulários públicos desautenticados nesta primeira versão (o preenchimento é autenticado pelo time da DRYOS em conjunto com o cliente).
- Exportação PDF via biblioteca de backend (impressão nativa via `window.print()` estilizada com CSS `@media print` já cobre a geração de PDF fiel).

---

## User Stories

### P1: Persistência e Recuperação de Diagnósticos Completos ⭐ MVP

**User Story**: Como consultor da DRYOS, quero que as respostas, notas e dados de identificação do diagnóstico fiquem salvos no banco Supabase associados ao cliente, para que a equipe possa consultar e atualizar o diagnóstico a qualquer momento sem risco de perda de dados.

**Acceptance Criteria**:
1. GIVEN um cliente cadastrado no sistema, WHEN um diagnóstico for salvo (seja como rascunho ou finalizado), THEN todos os campos de perfil, respostas das 61 perguntas e resultados calculados SHALL ser gravados na tabela `diagnostics`.
2. GIVEN um diagnóstico existente, WHEN o usuário acessar a página de edição, THEN todos os dados previamente respondidos SHALL ser carregados no formulário.
3. GIVEN a consulta de um cliente, WHEN existirem diagnósticos, THEN a query SHALL retornar os dados ordenados por data mais recente (`conducted_at DESC, created_at DESC`).

### P2: Wizard Interativo de 15 Etapas com Autosave ⭐ MVP

**User Story**: Como usuário preenchendo o diagnóstico, quero navegar entre as 13 dimensões e a identificação de forma organizada, podendo responder perguntas de escala, múltipla escolha e escolha simples, com salvamento do progresso, para que o preenchimento de 20-30 minutos seja agradável e seguro.

**Acceptance Criteria**:
1. GIVEN o formulário de diagnóstico, WHEN o usuário responder perguntas ou avançar etapas, THEN o estado SHALL ser persistido como rascunho (`status = 'draft'`).
2. GIVEN perguntas dos tipos `scale`, `single` e `multi`, WHEN o usuário interagir, THEN as seleções visuais SHALL refletir o estado de acordo com as regras de pontuação (incluindo escala reversa para itens como dependência do dono).
3. GIVEN qualquer pergunta pontuável, WHEN o usuário clicar em "Não sei / não se aplica", THEN a pergunta SHALL ser desmarcada das respostas ativas e excluída do cálculo de pontuação da dimensão.

### P3: Relatório Executivo e Sinais de Alerta ⭐ MVP

**User Story**: Como consultor e cliente, quero visualizar o relatório consolidado com gráfico radar, notas de maturidade, sinais de alerta e plano de ação estruturado, para que tenhamos clareza visual dos gargalos operacionais e próximos passos.

**Acceptance Criteria**:
1. GIVEN um diagnóstico com respostas, WHEN a etapa final (Relatório) for aberta, THEN o sistema SHALL computar:
   - Nota de cada dimensão (0 a 100) baseada na média normalizada das questões respondidas.
   - Índice geral de maturidade (0 a 100) e Nível (1: Inicial a 5: Otimizado).
   - Radar SVG responsivo com as 13 dimensões e notas.
   - Sinais de alerta disparados pelas 23 regras condicionais com severidade (`alta` ou `média`).
   - Plano de ação derivado das dimensões com menor pontuação dividido em Quick Wins (30d), 90d e 6-12m.
2. GIVEN o relatório aberto, WHEN o usuário clicar em "Imprimir / Salvar PDF", THEN o layout de impressão SHALL ocultar menus/navegação e formatar o relatório em páginas A4 legíveis.

### P4: Atualização da Seção de Diagnóstico em `/clients/[id]` ⭐ MVP

**User Story**: Como membro visualizando a ficha do cliente, quero ver imediatamente o índice de maturidade, o nível alcançado, a data de condução e botões de ação para abrir o relatório ou iniciar um novo diagnóstico.

**Acceptance Criteria**:
1. GIVEN um cliente com diagnóstico concluído, WHEN a página `/clients/[id]` for exibida, THEN o card de diagnóstico SHALL mostrar o índice geral (ex: 64/100), nível de maturidade, top 3 dimensões fortes/fracas e quantidade de alertas.
2. GIVEN um cliente com diagnóstico em rascunho, WHEN a página `/clients/[id]` for exibida, THEN SHALL indicar "Rascunho em andamento" com atalho para continuar preenchimento.
3. GIVEN um cliente sem diagnóstico, WHEN a página for exibida, THEN SHALL manter empty state convidando a iniciar o primeiro diagnóstico.
