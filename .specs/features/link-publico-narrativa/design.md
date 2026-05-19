# link-publico-narrativa Design

**Spec**: `.specs/features/link-publico-narrativa/spec.md`
**Status**: Draft

---

## Architecture Overview

A aba "Visão" do `/public/[token]` é reescrita para renderizar 6 seções narrativas. Banner é fixo acima das tabs (universal pro link, não só Visão). Dados vêm de queries server-side (createAdmin bypassa RLS); narrativa por vilão é nova tabela editável internamente.

```
Internal: /operations/[id] (tab Vilões)
   └─ OperationVillainRow ──> "Editar narrativa do mês"
                                  └─ VillainNarrativeForm (modal)
                                       └─ upsertVillainNarrativeAction
                                              └─ INSERT/UPDATE operation_villain_narratives

External: /public/[token]
   ├─ PublicReportBanner (novo, fixo)
   ├─ TabsNav (existe)
   └─ tab "visao"
        ├─ PublicReportHero (novo) ← dados agregados
        ├─ PublicVillainsList (refactor) ← com narrative_text do mês
        ├─ PublicAchievementsList (refactor) ← filtra month
        ├─ PublicNextMovesList (novo) ← tasks + meetings
        └─ PublicTeamGrid (novo) ← allocations + persons
```

Defines current period via `getCurrentPeriod()` helper returning `{ yyyymm, monthLabel, monthIndex, year, prevYyyymm, prevMonthLabel }`. Mês corrente do servidor (BRT). Não exposto via query param no MVP.

---

## Code Reuse Analysis

### Existing components to leverage

| Component | Location | How to use |
|---|---|---|
| `PublicVillainsList` | `src/components/domain/PublicVillainsList.tsx` | **Refactor**: aceitar prop `narrativeByVillainId: Record<string, string>` e usar `narrative_text` em vez de `villain.description` quando disponível |
| `PublicAchievementsList` | `src/components/domain/PublicAchievementsList.tsx` | **Refactor**: trocar header pra "Conquistas do mês · `<Mês>` · `<N>`" e filtrar input pra QWs do período |
| `PublicHero` | `src/components/domain/PublicHero.tsx` | **Aposentar dentro da aba Visão** — substituído por `PublicReportHero`. Continua sendo usado nas outras tabs (Frentes/Reuniões/Anexos/SLA) como hero compacto. |
| `Card`, `Pill`, `Avatar`, `VillainProgressBar`, `resolveVillainIcon` | `src/components/ui/*`, `src/components/domain/*` | Reutilizar diretamente |
| `requireUserAction` | `src/lib/auth/server.ts` | Guard de auth no action de narrativa |
| `ActionResult<T>` | `src/lib/actions/_types.ts` | Padrão de retorno |
| `getInitials` | `src/lib/utils/initials.ts` | Avatares do time |
| `formatDateBR`, `relativeFromNow` | `src/lib/utils/date.ts` | Datas |
| `progressVariant`, `SEVERITY_LABEL`, `SEVERITY_VARIANT` | `src/lib/utils/severity.ts` | Pills de severidade e progresso |

### Integration points

| System | Integration method |
|---|---|
| `operation_villains` | Join com nova `operation_villain_narratives` em `listPublicVillainsForReport()` |
| `quick_wins` | Filtrar por `happened_at` no mês — adicionar parâmetro `period` em nova `listPublicQuickWinsByPeriod()` |
| `tasks` + `meetings` | Nova query agregadora `listPublicNextMoves(operationId, limit=4)` |
| `allocations` + `persons` | Nova query `listPublicTeam(operationId)` |
| `operations.start_date` | Computar "Mês N de operação" (fallback `created_at`) |

---

## Components

### `PublicReportBanner` (novo)

- **Purpose**: Header fixo de identidade do relatório
- **Location**: `src/components/domain/PublicReportBanner.tsx`
- **Interfaces**:
  - Props: `{ clientName: string; periodLabel: string }`
- **Dependencies**: Nenhuma — server component puro
- **Reuses**: tokens DS (oak/cream), font display

### `PublicReportHero` (novo)

- **Purpose**: Headline storytelling + lede + stat lateral de QWs do mês
- **Location**: `src/components/domain/PublicReportHero.tsx`
- **Interfaces**:
  - Props: `{ heroData: ReportHeroData }`
  - Type:
    ```ts
    type ReportHeroData = {
      monthLabel: string;
      monthIndex: number;          // "Mês N de operação"
      activeVillainsCount: number;
      topVillain: { name: string; progressPct: number } | null;
      qwCountCurrent: number;
      qwCountDelta: number | null;  // null se mês anterior não tem dados
      prevMonthLabel: string;
    };
    ```
- **Dependencies**: Tokens DS, `lucide-react` (ícone raio)
- **Reuses**: `Pill`

### `PublicNextMovesList` (novo)

- **Purpose**: Lista numerada de tasks + meetings futuras, máx 4
- **Location**: `src/components/domain/PublicNextMovesList.tsx`
- **Interfaces**:
  - Props: `{ items: NextMoveItem[] }`
  - Type:
    ```ts
    type NextMoveItem = {
      id: string;
      kind: 'task' | 'meeting';
      title: string;
      date: string;       // ISO
      etaLabel: string;   // já formatado: "Hoje" | "Amanhã" | "Sex" | "DD/MM"
    };
    ```
- **Reuses**: nada além de tokens

### `PublicTeamGrid` (novo)

- **Purpose**: Cards do time alocado (internal + external)
- **Location**: `src/components/domain/PublicTeamGrid.tsx`
- **Interfaces**:
  - Props: `{ people: TeamPerson[] }`
  - Type:
    ```ts
    type TeamPerson = {
      personId: string;
      name: string;
      roleLabel: string;  // person.specialty ou person.external_role
      kind: 'internal' | 'external';
    };
    ```
- **Reuses**: `Avatar`, `getInitials`

### `VillainNarrativeForm` (novo — admin side)

- **Purpose**: Form de edição da narrativa de um vilão pro mês corrente
- **Location**: `src/components/domain/VillainNarrativeForm.tsx`
- **Interfaces**:
  - Props: `{ operationVillainId: string; villainName: string; period: string; existingText: string | null }`
- **Reuses**: `Button`, react-hook-form + `zodResolver`

### `PublicVillainsList` (refactor)

- **Mudança**: aceita `narrativeByVillainId?: Record<string, string>` opcional. Quando presente e tem entrada pro `item.villain.id`, exibe `narrative_text` no lugar de `villain.description`. Fallback mantém comportamento atual.

### `PublicAchievementsList` (refactor)

- **Mudança**: header passa a aceitar prop `headerLabel: string` (default mantém "Conquistas recentes" pra backwards-compat se for usado fora). Caller passa "Conquistas do mês · `<Mês>` · `<N>`" quando aplicável.
- Empty state copy melhorado conforme spec.

---

## Data Models

### `operation_villain_narratives` (nova tabela)

```sql
CREATE TABLE public.operation_villain_narratives (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id      uuid NOT NULL,
  villain_id        uuid NOT NULL,
  period_yyyymm     text NOT NULL,
  narrative_text    text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_ovn_operation_id FOREIGN KEY (operation_id)
    REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ovn_villain_id FOREIGN KEY (villain_id)
    REFERENCES public.villains(id) ON DELETE RESTRICT,
  CONSTRAINT ovn_period_format
    CHECK (period_yyyymm ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT ovn_narrative_min_length
    CHECK (length(trim(narrative_text)) >= 20),
  CONSTRAINT ovn_unique_per_period
    UNIQUE (operation_id, villain_id, period_yyyymm)
);

CREATE INDEX idx_ovn_op_period
  ON public.operation_villain_narratives (operation_id, period_yyyymm);

ALTER TABLE public.operation_villain_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY ovn_authenticated_full
  ON public.operation_villain_narratives
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ovn_updated_at
  BEFORE UPDATE ON public.operation_villain_narratives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.operation_villain_narratives IS
  'public-report: narrativa textual do progresso de um vilao naquela Operacao em um mes especifico. Editavel pelo time interno; lida no link publico. UNIQUE(operation_id, villain_id, period_yyyymm).';
```

**Relationships**: pertence a `operations` (CASCADE — apagar op apaga narrativas); referencia `villains` (RESTRICT — não deletar vilão com narrativas).

---

## New queries

| Query | Location | Returns |
|---|---|---|
| `getReportContext(operationId, period)` | `src/lib/db/queries/public-report.ts` | `{ heroData, villainsWithNarrative, qwsOfMonth, nextMoves, team }` — agregador batched (1 Promise.all) |
| `listVillainNarratives(operationId, period)` | `src/lib/db/queries/villain-narratives.ts` | `Record<villainId, narrativeText>` |
| `getVillainNarrative(operationVillainId, period)` | mesmo arquivo | `{ text: string } \| null` — pro form admin |
| `listPublicQuickWinsByPeriod(operationId, yyyymm)` | `src/lib/db/queries/quick-wins.ts` | refactor de `listPublicQuickWins` aceitando filtro opcional |
| `countQuickWinsByPeriod(operationId, yyyymm)` | mesmo arquivo | `number` — pro hero stat |
| `listPublicNextMoves(operationId, limit)` | `src/lib/db/queries/public-report.ts` | `NextMoveItem[]` |
| `listPublicTeam(operationId)` | mesmo arquivo | `TeamPerson[]` |

Decisão: criar `public-report.ts` como agregador da view do relatório evita scatter de helpers e centraliza a regra "mês corrente do servidor". `quick-wins.ts` apenas ganha filtro de período.

---

## Server actions

### `upsertVillainNarrativeAction`

- **Location**: `src/lib/actions/villain-narratives.ts`
- **Signature**: `(operationVillainId: string, formData: FormData) => Promise<ActionResult<{ id: string }>>`
- **Body**:
  - `requireUserAction()` → guard
  - Parse `narrative_text` + `period_yyyymm` do formData
  - Zod schema valida (≥20 chars, formato YYYY-MM)
  - Fetch `operation_villain` pra pegar `operation_id` + `villain_id`
  - Upsert via `INSERT … ON CONFLICT (operation_id, villain_id, period_yyyymm) DO UPDATE SET narrative_text = EXCLUDED.narrative_text, updated_at = now()`
  - `revalidatePath('/operations/[id]')` + `revalidatePath('/public/[token]')` (latter requer descobrir tokens — pode ser global `revalidateTag('public-reports')` se quisermos otimizar, mas MVP usa `revalidatePath` direto)
  - Return `ok({ id })`

---

## Helpers

### `src/lib/utils/period.ts` (novo)

```ts
export type Period = {
  yyyymm: string;          // "2026-05"
  year: number;
  month: number;           // 1-12
  monthLabel: string;      // "Maio"
  monthLabelShort: string; // "Mai"
  prevYyyymm: string;
  prevMonthLabel: string;
};

export function getCurrentPeriod(now?: Date): Period;
export function periodFromString(yyyymm: string): Period | null;
export function operationMonthIndex(startDate: string | null, createdAt: string, now?: Date): number;
```

### `src/lib/utils/eta.ts` (novo)

```ts
// Devolve "Hoje", "Amanhã", "Sex", "DD/MM" conforme distância da data alvo.
export function formatEtaLabel(targetDate: string, now?: Date): string;
```

---

## Error Handling

| Scenario | Handling | User impact |
|---|---|---|
| Narrativa < 20 chars | Form mostra erro; action retorna `err('Mínimo 20 caracteres.', 'validation_narrative_text')` | Vê erro no form, salva bloqueado |
| Não-autenticado tenta salvar narrativa | `err('Sessão expirada.', 'unauthenticated')` | Redirect login (UI pattern existente) |
| Vilão arquivado durante o mês | Continua aparecendo no relatório se `progress_pct > 0` (filtra no query) | Cliente vê narrativa normalmente |
| Operação sem `start_date` | Fallback pra `created_at` no cálculo do `monthIndex` | Hero ainda mostra "Mês N" coerente |
| Hero sem vilão com progresso > 0 | Headline fallback "A jornada acabou de começar" | Sem regressão |
| Mês sem QWs nem tasks/meetings nem alocações | Sections vazias são omitidas (return `<></>`) | Relatório mostra só Banner + Hero |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Onde mora narrativa por vilão | Tabela nova `operation_villain_narratives` com UNIQUE(op, vilão, mês) | Permite histórico mensal sem migration futura. Update via ON CONFLICT é atômico. |
| Identificador do período | Texto `YYYY-MM` com CHECK regex | Simples, queryable, ordenável lexicograficamente. Alternativa `tstzrange` é overkill pro caso. |
| Mês corrente | Calculado server-side (BRT) | Determinístico. Param `?month=` fica P2. |
| Hero stat sem mês anterior | Mostrar "—" como delta | Não quebra layout; sinaliza falta de baseline. |
| `PublicHero` antigo | Mantém em outras tabs | Já cumpre papel de header compacto; trocar tudo seria churn. |
| Revalidação após salvar narrativa | `revalidatePath('/operations/[id]')` + `revalidatePath('/public/[token]', 'page')` | MVP. Tagged cache (`revalidateTag`) entra se virar gargalo. |
| ETA label | Function pura (não i18n lib) | Apenas pt-BR no MVP; meia dúzia de strings. |
| Animação reveal | Reusa CSS `.reveal` + `.in` já existente | Zero custo extra. |
| Layout dark | Reusa `body.dark` flag já implementado | Sem refactor. |
