# frentes-crud Design

**Spec**: `.specs/features/frentes-crud/spec.md`
**Status**: Draft

---

## Architecture Overview

CRUD contextual: 2 rotas dentro de `/operations/[id]/` + atualização da `FrentesListSection` (linha clicável + "Nova Frente" no header). Server Actions com auto-update do `actionable_status_since` na comparação old vs new. Validação espelhada Zod (client) + CHECK constraint (DB).

```mermaid
graph TD
    Detail[/operations/[id]] --> Section[FrentesListSection atualizada]
    Section --> NewBtn[+ Nova Frente]
    Section --> EditBtn[Editar por linha]
    NewBtn --> New[/operations/[id]/frentes/new]
    EditBtn --> Edit[/operations/[id]/frentes/[fid]/edit]
    New --> Form[FrenteForm 'use client']
    Edit --> Form
    Form -->|create| CreateAction[createFrenteAction]
    Form -->|update| UpdateAction[updateFrenteAction\n+ auto-update since]
    Form -->|archive| ArchiveAction[archiveFrenteAction\n+ guard allocations]
    Form -- responsible select --> Persons[listInternalPersons]
```

---

## Code Reuse Analysis

### Existing

| Component | How |
|---|---|
| `Pill`, `Card`, `Button` | Pills no form/list; Card/Button no form |
| `PageHeader` | Cada rota tem |
| `cn` helper | classes condicionais |
| `ActionResult` + helpers | Server Actions |
| `requireUserAction` | Guard auth |
| `createServer` | Queries server-side |
| `Database` types + enums (`frente_cycle_type`, `frente_domain`, `frente_phase`) | Tipos derivados |
| `FrentesListSection` | **Estende** com botão Editar por linha + handler na operação detail |
| `formatDateBR`, `formatDateShortBR` | Helpers |
| **`useForm + zodResolver` pattern** | Conforme skill `dryos-conventions` seção "Forms" (criada após L-003) |
| `OperationDetail.frentes` (já vem de getOperation) | Reuso na detail page; sem nova query |
| `getOperation(id)` | Page do form de edit puxa pra preencher |
| Validação status acionável | Pattern já documentado em skill `dryos-conventions` (linha ~271) — schema espelha CHECK do DB |

### Novos

| What | Where |
|---|---|
| `frenteSchema` Zod | `src/lib/validators/frente.ts` |
| `listInternalPersons()` | `src/lib/db/queries/persons.ts` (estende) |
| `getFrente(id)` | `src/lib/db/queries/frentes.ts` |
| `frenteHasActiveAllocations(id)` | `src/lib/db/queries/frentes.ts` |
| `createFrenteAction`, `updateFrenteAction`, `archiveFrenteAction` | `src/lib/actions/frentes.ts` |
| `FrenteForm` | `src/components/domain/FrenteForm.tsx` |

---

## Components

### `src/lib/validators/frente.ts`

```ts
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const FORBIDDEN_STATUS = [
  "em andamento",
  "em revisão",
  "pendente",
  "a fazer",
  "em progresso",
];

const dateString = z.preprocess(
  emptyToUndefined,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").optional(),
);

const responsiblePersonId = z.preprocess(
  emptyToUndefined,
  z.string().uuid("Responsável inválido.").optional(),
);

export const frenteSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório.").max(120),
  cycle_type: z.enum(["a", "b", "c", "d", "e"]),
  domain: z.enum(["infra", "dados_analiticos", "dados_tecnicos"]),
  phase: z.enum(["descoberta", "execucao", "entrega", "encerrada"]),
  actionable_status: z.string()
    .trim()
    .min(15, "Mínimo 15 caracteres.")
    .refine(
      (s) => !FORBIDDEN_STATUS.includes(s.toLowerCase()),
      'Status muito genérico. Use o formato "aguardando X de Y desde Z".',
    ),
  responsible_person_id: responsiblePersonId,
  start_date: dateString,
  end_date: dateString,
}).refine(
  (data) => !["c", "e"].includes(data.cycle_type) || !data.end_date,
  {
    message: "Ciclo C/E não pode ter data de fim. Remova-a.",
    path: ["end_date"],
  },
).refine(
  (data) => !data.start_date || !data.end_date || data.start_date <= data.end_date,
  { message: "Data de fim deve ser ≥ data de início.", path: ["end_date"] },
);

export type FrenteInput = z.input<typeof frenteSchema>;
export type FrenteOutput = z.output<typeof frenteSchema>;
```

### `src/lib/db/queries/frentes.ts`

```ts
export type FrenteRow = Database["public"]["Tables"]["frentes"]["Row"];

export async function getFrente(id: string): Promise<FrenteRow | null>;
export async function frenteHasActiveAllocations(id: string): Promise<boolean>;
```

### `src/lib/db/queries/persons.ts` (estender)

```ts
export type InternalPersonItem = { id: string; name: string };
export async function listInternalPersons(): Promise<InternalPersonItem[]>;
// filtra kind='internal' AND archived_at IS NULL; ordena por name
```

### `src/lib/actions/frentes.ts`

3 actions:

- `createFrenteAction(operationId: string, formData): Promise<ActionResult<{id: string}>>`
  - Guard auth → Zod parse → insert com `operation_id=operationId`, `actionable_status_since=now()` (já default no DB, mas explícito ajuda)
  - 23503 (FK violation) → `err('Operação ou Responsável inválido.', 'invalid_fk')`
  - 23514 (CHECK violation) → `err('Status acionável não atende às regras.', 'check_violation')` — fallback
- `updateFrenteAction(id: string, formData): Promise<ActionResult<{id: string}>>`
  - Guard auth + Zod parse
  - **Compara `current.actionable_status` (trim+lower) com novo**; se diferente, adiciona `actionable_status_since: new Date().toISOString()` no UPDATE
  - Update demais campos
- `archiveFrenteAction(id: string): Promise<ActionResult<undefined>>`
  - Guard auth + `frenteHasActiveAllocations` → bloqueia
  - `archived_at = now()`

### `src/components/domain/FrenteForm.tsx`

Client component reusando o pattern documentado no skill (RHF + zodResolver + isSubmitting). Estrutura similar à `OperationForm`:

- Props: `mode = 'create' | 'edit'`; `operationId`, `cycleTypes/domains/phases` enum options (hardcoded); `internalPersons: { id; name }[]`; em edit: `initialData: FrenteRow`, `canArchive: boolean`
- `watch('cycle_type')` → disabled `end_date` quando C/E
- Submit: chama action; em sucesso `router.push('/operations/{operationId}')` + `router.refresh()`
- Error mapping: `validation_<field>`, `invalid_fk` → general, `has_active_allocations` → general

### `src/components/domain/FrentesListSection.tsx` (estender)

Adiciona:
- Header: além da `<h2>Frentes</h2>` + Pill, recebe prop `operationId` e renderiza `<Link href={\`/operations/${operationId}/frentes/new\`}><Button variant="sage" size="sm"><Plus />Nova Frente</Button></Link>`
- Cada `<li>` ganha link "Editar →" no canto direito (style igual ao "Abrir →" das tabelas). Não tornar row inteira clicável (Edit é destrutivo-leve; manter explícito).
- Empty state: além do "Nenhuma Frente nesta Operação.", botão "Criar primeira Frente"

### Pages

- `src/app/(app)/operations/[id]/frentes/new/page.tsx`
- `src/app/(app)/operations/[id]/frentes/[fid]/edit/page.tsx`

Cada uma: guard UUID nas params, preload `getOperation(id)` + `listInternalPersons()`, render `<FrenteForm ... />`. Edit também busca `getFrente(fid)` + `frenteHasActiveAllocations(fid)`.

---

## Data Models

Nenhum schema novo. Tipos derivados nas queries.

---

## Error Handling Strategy

| Scenario | Action | UI |
|---|---|---|
| Zod fail (status genérico, <15 chars) | `err('<msg>', 'validation_actionable_status')` | Inline embaixo do campo |
| Cycle C/E + end_date | Zod `.refine` | Inline em end_date |
| FK violation (operation/person inválido) | 23503 → `err('Operação ou Responsável inválido.', 'invalid_fk')` | Inline em responsible_person_id se possível, senão general |
| CHECK violation (status genérico passou client) | 23514 → `err('Status acionável não atende às regras.', 'check_violation')` | General; UI deveria ter pegado antes |
| Archive com allocations ativas | `has_active_allocations` | General |
| 404 (frente não existe / arquivada) | redirect `/operations/[id]` | — |
| Operation id ou frente id não-UUID | redirect `/operations` ou 404 | Next 404 |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Routing | `operations/[id]/frentes/{new,[fid]/edit}` | Mantém contexto Operação; sem rota standalone |
| Form library | RHF + zodResolver (pattern do skill) | Consistência |
| Status acionável "since" | Auto-update server-side comparando old vs new | Decisão do user (AskUser); single source of truth no server |
| End_date disable pra C/E | Sim via `watch('cycle_type')` + disabled | Princípio 03; previne state stale |
| Responsible select | Nullable; opções = internal persons | Decisão do user (AskUser) |
| Row clicável vs botão Editar | Botão explícito | Edit é menos imediato que Abrir (consultar); evita acidente |
| `actionable_status_since` no form | NÃO exposto ao user | Auto-managed; expor só confunde |
| Phase select | Livre (sem state machine) | Out of scope per spec |
| Bulk archive | NÃO | Out of scope per spec |
| Cycle type labels longas no select | "A — Finito puro" etc | Educa user sobre semântica do PRD |
| `actionable_status` textarea (não input) | Sim | Status acionável pode ter 100+ chars; textarea respira melhor |
| Sidebar: nada muda | Sem rota dedicada | Frentes vivem dentro de Operação |
| Empty state quando 0 internal persons | Helper text + nullable select | Persons-crud cuidará disso |
| Auto-suggest do nome (P2) | **Skip** mesmo se sobrar tempo | Domínio "Infra"/"Dados Analíticos" como nome funciona mas vira hardcode; aceitar input livre |

---

## Notes

- **`updateFrenteAction` precisa de `getFrente`** pra fazer a comparação; uma round-trip a mais que `updateClientAction`. Aceitável.
- **Comparação `trim+lowercase`** evita "atualizar since" por capitalização ou whitespace bobo. Match exato da regra do CHECK do DB.
- **`getOperation` no detail já retorna frentes**; sem nova query pra renderizar a section
- **Antes de criar tabela** (CLAUDE.md): NÃO criamos. Schema da semana 1 cobre.
- **`docs/DATABASE_SCHEMA.md`**: sem atualização (sem tabela nova; coluna nova, etc)
