# allocations-crud Design

**Spec**: `.specs/features/allocations-crud/spec.md`

---

## Architecture Overview

CRUD compacto + extensão da FrenteEditPage com lista de alocações. Hard delete (sem soft). Routes contextuais. Padrões já estabelecidos: RHF + zodResolver, ActionResult, Avatar reuso, listInternalPersons reuso.

```mermaid
graph TD
    FrenteEdit[/operations/[id]/frentes/[fid]/edit]
    FrenteEdit -- form Frente --> ExistingForm[FrenteForm]
    FrenteEdit -- nova section --> Section[AllocationsSection]
    Section -- + Nova --> NewAlloc[/operations/[id]/frentes/[fid]/allocations/new]
    Section -- Editar --> EditAlloc[/operations/[id]/frentes/[fid]/allocations/[aid]/edit]
    NewAlloc --> Form[AllocationForm]
    EditAlloc --> Form
    Form -- create --> CreateAction[createAllocationAction]
    Form -- update --> UpdateAction[updateAllocationAction]
    Form -- delete --> DeleteAction[deleteAllocationAction]
```

---

## Code Reuse

| What | How |
|---|---|
| RHF + zodResolver | AllocationForm (pattern do skill) |
| ActionResult + helpers | Actions |
| `listInternalPersons()` | Select de Pessoa no form |
| Avatar + `getInitials` | AllocationsSection rows |
| `getFrente`, `getOperation` | Pages preload |
| `requireUserAction` | Guard nas 3 actions |
| `Pill`, `Card`, `Button` | UI |

---

## Componentes Novos

### `src/lib/validators/allocation.ts`

```ts
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const dateString = z.preprocess(
  emptyToUndefined,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").optional(),
);

const capacityNumber = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const normalized = v.replace(",", ".");
      const n = Number(normalized);
      return Number.isFinite(n) ? n : v;
    }
    return v;
  },
  z.number().min(0, "Capacidade min 0").max(100, "Capacidade max 100"),
);

export const allocationSchema = z.object({
  person_id: z.string().uuid("Pessoa obrigatória."),
  role: z.enum(["responsavel", "executor", "aprovador", "plantao"]),
  capacity_weekly_pct: capacityNumber,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data início obrigatória."),
  end_date: dateString,
}).refine(
  (d) => !d.end_date || d.start_date <= d.end_date,
  { message: "Data de fim ≥ início.", path: ["end_date"] },
);

export type AllocationInput = z.input<typeof allocationSchema>;
export type AllocationOutput = z.output<typeof allocationSchema>;
```

### `src/lib/db/queries/allocations.ts` (novo arquivo)

```ts
export type AllocationListItem = {
  id; role; capacityWeeklyPct; startDate; endDate;
  person: { id; name };
};

async function listAllocationsByFrente(frenteId: string): Promise<AllocationListItem[]>;
async function getAllocation(id: string): Promise<AllocationRow | null>;
```

### `src/lib/actions/allocations.ts`

3 actions:
- `createAllocationAction(operationId, frenteId, formData): ok({id})` — INSERT com `frente_id=frenteId`; map 23503 → invalid_person
- `updateAllocationAction(id, formData): ok({id})` — fetch current pra confirmar pertence à frente do path (via outer)
- `deleteAllocationAction(id): ok(undefined)` — fetch pra obter frenteId (pro redirect); **DELETE hard** (sem archived_at)

### `src/components/domain/AllocationForm.tsx`

Client component. RHF + zodResolver. Inputs: select Pessoa (disabled em edit), select Role, input number Capacity, dates. Botão "Remover" só em edit; window.confirm.

### `src/components/domain/AllocationsSection.tsx`

Server component (recebe pré-carregadas). Estrutura:
- Header: h2 "Alocações" + Pill contagem + "+ Nova alocação" sage size sm
- Empty state com CTA
- Lista: linha com Avatar(sm) + nome + Pill role + capacity% mono + dates compact + "Editar →"

### Pages

- `/operations/[id]/frentes/[fid]/allocations/new/page.tsx`
- `/operations/[id]/frentes/[fid]/allocations/[aid]/edit/page.tsx`

Ambas: preload `getOperation(id) + getFrente(fid) + listInternalPersons()` em paralelo. Edit também `getAllocation(aid)`. Validação cruzada: redirect se frente.operation_id !== id, se allocation.frente_id !== fid, etc.

### `src/app/(app)/operations/[id]/frentes/[fid]/edit/page.tsx` (modificação)

Renderiza `<AllocationsSection allocations={...} operationId frenteId />` depois do `<FrenteForm />`. Server fetcha `listAllocationsByFrente(fid)` antes.

---

## Data Models

Nenhum schema. Tipos derivados.

---

## Error Handling

| Scenario | Action | UI |
|---|---|---|
| capacity fora de 0-100 | Zod | inline |
| end < start | Zod refine | inline em end |
| person_id inválido (FK) | 23503 → `invalid_person` | inline person_id |
| Allocation id não pertence ao frente do path | redirect | — |
| Frente do path arquivada | redirect /operations | — |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Hard vs soft delete | **Hard** | Schema não tem `archived_at` em allocations; tabela é puro relacionamento |
| Person locked em edit | Sim | Pra trocar = nova alocação (consistência) |
| Capacity number BR-friendly | Aceita "50,5" via preprocess | Reuso do pattern de money parsing |
| Sem `listAllocationsByPerson` separado | NÃO; já temos `getPersonAllocations` | Reuso |
| Unique constraint (person×frente×role)? | NÃO criar | Aceita duplicata; Painel Admin futuro alerta capacidade |
| Confirm modal | `window.confirm` | Padrão consistente |
| Redirect pós-action | Volta pra Frente edit | Mantém contexto |
| Capacity sem Slider UI | Number input | Slider é polish; sem necessidade MVP |

---

## Notes

- **CASCADE valida via DB**: archive de Frente OU Pessoa derruba allocations relacionadas. Sem mudança aqui.
- **`docs/DATABASE_SCHEMA.md`**: sem mudança
- **Avatar component**: reusa sem-precisar criar nada
- **`listAllocationsByFrente`** complementa `getPersonAllocations` (a primeira pela ótica da Frente; segunda pela Pessoa)
