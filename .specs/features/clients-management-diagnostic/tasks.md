# Diagnóstico de Gestão (13 Dimensões) — Tasks

Issue: #166
Branch: feat/clients-management-diagnostic

## Task List

- [x] **T1: Migration & Schema Update**
  - Criar migration `supabase/migrations/20261016110000_management_diagnostics.sql`
  - Remover constraint `UNIQUE(client_id)` em `diagnostics`
  - Tornar `notes` nullable com check condicional
  - Adicionar colunas `status`, `version`, `profile_data`, `answers`, `na_answers`, `computed_scores`, `flags`, `action_plan`
  - Criar índice `idx_diagnostics_client_conducted`
  - Atualizar `docs/DATABASE_SCHEMA.md` com as novas colunas
  - *Critério de verificação:* Arquivo SQL válido, idempotente, com `COMMENT ON COLUMN` e doc sincronizado.

- [x] **T2: Constantes de Domínio e Motor de Cálculo**
  - Criar `src/lib/constants/management-diagnostic.ts` com as 13 dimensões (`DIMS`), 61 perguntas, perfis, textos (`TXT`), ações (`ACT`), sinais de alerta (`FLAGS`) e níveis (`LEVELS`)
  - Criar `src/lib/utils/management-diagnostic.ts` com funções puras de pontuação, detecção de flags e montagem do plano de ação
  - *Critério de verificação:* Cálculos matemáticos idênticos ao protótipo HTML (média normalizada de 0 a 100, Níveis 1 a 5, flags de criticidade).

- [x] **T3: Validadores Zod e Tipagem**
  - Criar `src/lib/validators/management-diagnostic.ts` com schemas para perfil, respostas e payload de rascunho/conclusão
  - Adicionar interfaces TypeScript para `ManagementDiagnosticData`, `ComputedScores`, `DiagnosticFlag` e `ActionPlan`
  - *Critério de verificação:* Validação estrita sem `any`.

- [x] **T4: Queries e Server Actions**
  - Atualizar `src/lib/db/queries/diagnostics.ts`:
    - `getDiagnosticById(id: string)`
    - `getLatestDiagnosticByClient(clientId: string)`
    - `listDiagnosticsByClient(clientId: string)`
  - Atualizar `src/lib/actions/diagnostics.ts`:
    - `saveManagementDiagnosticAction`: persistência de rascunho e conclusão com cálculo server-side
  - *Critério de verificação:* Actions retornando `ActionResult<T>`, guards de autenticação e revalidação de caminhos.

- [x] **T5: Componentes de UI (Design System DRYOS)**
  - Criar `src/components/domain/ManagementDiagnosticReport.tsx` (Gauge de maturidade, Radar SVG responsivo nas cores oak/sage, tabela de dimensões, sinais de alerta, plano de ação e layout de impressão `@media print`)
  - Criar `src/components/domain/ManagementDiagnosticWizard.tsx` (Navegação em 15 etapas, barra de progresso, perguntas de escala/única/múltipla, N/A, autosave debounce)
  - Atualizar `src/components/domain/ClientDiagnosticSection.tsx` na página do cliente
  - *Critério de verificação:* Estilização coerente com Tailwind 4, fontes Funnel Display e Onest, responsividade mobile/desktop.

- [x] **T6: Rotas e Páginas Next.js**
  - Criar `/clients/[id]/diagnostic/page.tsx` para exibir o relatório completo
  - Criar `/clients/[id]/diagnostic/new/page.tsx` para iniciar novo diagnóstico
  - Criar `/clients/[id]/diagnostic/[diagnosticId]/edit/page.tsx` para retomar ou editar
  - Atualizar `/clients/[id]/diagnostic/edit/page.tsx` para redirecionamento transparente
  - *Critério de verificação:* Fluxo de navegação sem dead ends, botões de ação e cancelamento claros.

- [x] **T7: Verificação e Build**
  - Executar `npm run typecheck`
  - Garantir ausência de erros de lint e regressões
  - Executar `npm run build`
  - *Critério de verificação:* `tsc --noEmit` e `next build` passando 100% limpos.
