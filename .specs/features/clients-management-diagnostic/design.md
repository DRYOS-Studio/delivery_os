# Diagnóstico de Gestão (13 Dimensões) — Design

Issue: #166
Branch: feat/clients-management-diagnostic

## 1. Database Schema Design

### Tabela `public.diagnostics`

Evolução da tabela existente sem quebrar referências da `operations.diagnostic_id`:

```sql
-- 1. Remoção da constraint UNIQUE(client_id) para permitir múltiplos diagnósticos no tempo
ALTER TABLE public.diagnostics DROP CONSTRAINT IF EXISTS diagnostics_client_id_key;

-- 2. Relaxamento de notes NOT NULL (o questionário de 13 dimensões passa a ser a fonte principal)
ALTER TABLE public.diagnostics ALTER COLUMN notes DROP NOT NULL;
ALTER TABLE public.diagnostics DROP CONSTRAINT IF EXISTS chk_diagnostics_notes_length;
ALTER TABLE public.diagnostics ADD CONSTRAINT chk_diagnostics_notes_length
  CHECK (notes IS NULL OR (length(notes) >= 10 AND length(notes) <= 10000));

-- 3. Novas colunas estruturadas para o Diagnóstico de Gestão
ALTER TABLE public.diagnostics
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'completed')),
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS na_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS computed_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS action_plan jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Índice para busca do diagnóstico mais recente do cliente
CREATE INDEX IF NOT EXISTS idx_diagnostics_client_conducted
  ON public.diagnostics (client_id, conducted_at DESC, created_at DESC);
```

### Comentários Canônicos
```sql
COMMENT ON COLUMN public.diagnostics.status IS 'Status do diagnóstico: draft (em preenchimento) ou completed (finalizado).';
COMMENT ON COLUMN public.diagnostics.profile_data IS 'Dados de perfil: respondente, cargo, setor, faixa de colaboradores, faturamento, dores, objetivos.';
COMMENT ON COLUMN public.diagnostics.answers IS 'Respostas mapeadas por question_id: escala 1-5, índice de escolha única, ou array de múltiplas escolhas.';
COMMENT ON COLUMN public.diagnostics.na_answers IS 'Perguntas marcadas como Não sei / não se aplica (excluídas do cálculo).';
COMMENT ON COLUMN public.diagnostics.computed_scores IS 'Resultados calculados: scores das 13 dimensões (0-100), índice geral de maturidade (0-100) e nível (1-5).';
COMMENT ON COLUMN public.diagnostics.flags IS 'Sinais de alerta detectados pelas 23 regras de criticidade (alta/média).';
COMMENT ON COLUMN public.diagnostics.action_plan IS 'Plano de ação priorizado nas dimensões fracas (quick wins 30d, 90d, 12m).';
```

---

## 2. Modelagem de Domínio & Cálculos (`src/lib/`)

### A. Constantes de Domínio (`src/lib/constants/management-diagnostic.ts`)
- `LEVELS`: Níveis de maturidade 1 a 5 (Inicial, Informal, Definido, Gerenciado, Otimizado).
- `DIMS`: As 13 dimensões canônicas, contendo as 61 perguntas tipadas:
  - `scale` (com `low`, `high`, `rev?: boolean`)
  - `single` (com opções `[label, score | null]`)
  - `multi` (com opções `[label, key]`, `noscore?: boolean`)
- `PROFILE_FIELDS`: Metadados do respondente e empresa.
- `TXT`: Textos analíticos por dimensão em 3 faixas de pontuação (baixo: 1-2, médio: 3, alto: 4-5).
- `ACT`: Catálogo canônico de ações por dimensão (`qw`, `d90`, `m12`).
- `FLAGS_RULES`: Definição das 23 regras de sinais de alerta e condições booleanas.

### B. Funções Puras de Cálculo (`src/lib/utils/management-diagnostic.ts`)
- `computeDiagnostic(answers, naAnswers, profile)`:
  - Executa a normalização de cada pergunta ($s \in [1, 5]$).
  - Calcula a nota de cada dimensão ($\frac{\sum (s-1)/4}{N} \times 100$).
  - Calcula o Índice Geral de Maturidade e mapeia o Nível 1 a 5.
  - Avalia as 23 regras de sinais de alerta contra as respostas e gera a lista de flags.
  - Extrai as dimensões mais fracas e compõe o plano de ação priorizado.
  - Retorna o payload consolidado para salvar no banco.

---

## 3. Server Actions & Queries

### `src/lib/db/queries/diagnostics.ts`
- `getDiagnosticById(id: string)`: Retorna o diagnóstico completo com tipagem estrita.
- `getLatestDiagnosticByClient(clientId: string)`: Retorna o diagnóstico mais recente do cliente.
- `listDiagnosticsByClient(clientId: string)`: Lista histórico de diagnósticos do cliente (data, índice, nível, status).

### `src/lib/actions/diagnostics.ts`
- `saveDiagnosticDraftAction(clientId: string, diagnosticId: string | null, payload: DiagnosticDraftInput)`:
  - Salva rascunho (`status: 'draft'`).
  - Atualiza ou insere registro.
- `completeDiagnosticAction(clientId: string, diagnosticId: string | null, payload: DiagnosticCompleteInput)`:
  - Valida preenchimento mínimo.
  - Computa scores e flags server-side.
  - Grava com `status: 'completed'`.
  - Revalida caminhos `/clients/${clientId}` e `/clients/${clientId}/diagnostic`.

---

## 4. Arquitetura de UI (Design System DRYOS)

### Páginas:
1. **`/clients/[id]/diagnostic`**:
   - Se houver diagnóstico completed: exibe o relatório executivo diretamente.
   - Se houver apenas rascunho: botão para continuar rascunho.
   - Se não houver: link para iniciar novo diagnóstico.
2. **`/clients/[id]/diagnostic/new`**:
   - Criação de novo diagnóstico.
3. **`/clients/[id]/diagnostic/[diagnosticId]/edit`**:
   - Retomada de rascunho ou edição de diagnóstico existente.

### Componentes:
- **`ManagementDiagnosticWizard`**:
  - 15 passos (0: Identificação, 1-13: Dimensões, 14: Relatório).
  - Sidebar sticky com progresso (passos preenchidos, perguntas respondidas).
  - Suporte a seleção de escalas com pills interativas, opções simples e múltiplas.
  - Botão de "Não sei / não se aplica".
  - Autosave debounce via Server Action.
- **`ManagementDiagnosticReport`**:
  - Gauge de maturidade (Índice 0-100 e pill de Nível 1-5).
  - Resumo executivo em prosa.
  - Gráfico Radar SVG responsivo estilizado no tema DRYOS (cores oak `#1F3A2A` e sage `#93B596`).
  - Tabela de dimensões com barras de progresso proporcionais.
  - Top 3 Pontos Fortes e Lacunas Críticas.
  - Sinais de Alerta com tags de severidade.
  - Plano de Ação em 3 colunas (Quick Wins 30d, Estruturação 90d, Consolidação 6-12m).
  - Botão de impressão nativo com estilos `@media print` otimizados para A4.
- **`ClientDiagnosticSection`**:
  - Atualizado na página `/clients/[id]` para exibir:
    - Índice Geral de Maturidade e Pill de Nível.
    - Status de conclusão ou rascunho.
    - Destaques (Top pontos fortes e pontos fracos).
    - Contagem de alertas ativos.
    - Botões: "Ver relatório completo", "Novo diagnóstico" e histórico.
