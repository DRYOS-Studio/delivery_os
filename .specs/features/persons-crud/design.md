# persons-crud Design

**Spec**: `.specs/features/persons-crud/spec.md`
**Status**: Draft

---

## Architecture Overview

CRUD em 4 rotas + Avatar component novo + atualizações em 3 componentes existentes (Sidebar, ExternalPersonsList, FrentesListSection). Form com Zod discriminated union por `kind`. Detail mostra alocações (interna) ou Operações do cliente (externa).

```mermaid
graph TD
    List[/persons + tabs kind] --> Search[PersonsSearch]
    List --> Tabs[PersonsTabs 'use client']
    List --> Table[PersonsTable + Avatar]
    New[/persons/new] --> Form[PersonForm 'use client']
    Edit[/persons/[id]/edit] --> Form
    Form -->|kind=internal| InternalFields[name + email + specialty]
    Form -->|kind=external| ExternalFields[name + email + external_role + client_id select]
    Detail[/persons/[id]] -->|internal| Allocs[Allocations grouped by Op]
    Detail -->|external| ClientOps[Client + Operations]
    Sidebar -- footer --> Avatar
    ExtPersList --> Avatar
    FrenteListSection --> Avatar
```

---

## Code Reuse Analysis

### Existing

| What | How |
|---|---|
| `Pill`, `Card`, `Button` | Form + lista |
| `PageHeader` | Cada rota |
| `cn` helper | Avatar variants |
| `ActionResult` + helpers | Actions |
| `requireUserAction` | Guards |
| `createServer` | Queries |
| `Database` types + `person_kind` enum | Tipos |
| `listClients` | Reuso no form (external precisa de client select) |
| `getActiveOperations({clientId})` | Reuso no detalhe de externa |
| `useDebouncedValue` | PersonsSearch |
| **RHF + zodResolver** | Form (skill `dryos-conventions` Forms section) |
| Pattern de search (`?q=` + replace) | PersonsSearch reaproveita ClientsSearch como template |

### Novos

| What | Where |
|---|---|
| `Avatar` component | `src/components/ui/Avatar.tsx` |
| `getInitials(name)` | `src/lib/utils/initials.ts` |
| `personSchema` (discriminated union) | `src/lib/validators/person.ts` |
| `listPersons({kind, search})`, `getPerson(id)`, `countActivePersons()`, `personHasActiveAllocations(id)`, `getPersonAllocations(personId)` | `src/lib/db/queries/persons.ts` (estende) |
| `createPersonAction`, `updatePersonAction`, `archivePersonAction` | `src/lib/actions/persons.ts` |
| `PersonForm`, `PersonsTable`, `PersonsSearch`, `PersonsTabs` | `src/components/domain/` |
| `getOperation` retorna `responsible_person:persons(name)` no embed | `src/lib/db/queries/operations.ts` modificar |

---

## Components

### `src/lib/utils/initials.ts`

```ts
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase();
  const first = words[0]!.charAt(0);
  const last = words[words.length - 1]!.charAt(0);
  return `${first}${last}`.toUpperCase();
}

export function initialsFromEmail(email: string | null | undefined): string {
  if (!email) return "?";
  const prefix = email.split("@")[0] ?? "";
  const parts = prefix.split(/[.\-_]/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}
```

### `src/components/ui/Avatar.tsx`

```tsx
import { cn } from "@/lib/utils/cn";

type AvatarProps = {
  initials: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'oak' | 'sage-deep' | 'oak-light';
  className?: string;
};

const SIZES = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};
const COLORS = {
  oak: "bg-oak text-bg",
  "sage-deep": "bg-sage-deep text-bg",
  "oak-light": "bg-oak-light text-bg",
};

export function Avatar({ initials, size = 'md', color = 'oak', className }: AvatarProps) {
  return (
    <div className={cn(
      "rounded-full flex items-center justify-center font-display font-semibold leading-none",
      SIZES[size], COLORS[color], className
    )} aria-hidden>
      {initials}
    </div>
  );
}
```

### `src/lib/validators/person.ts`

```ts
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email("E-mail inválido.").optional(),
);

const baseFields = {
  name: z.string().trim().min(1, "Nome obrigatório.").max(120),
  email: optionalEmail,
};

const internalSchema = z.object({
  ...baseFields,
  kind: z.literal("internal"),
  specialty: z.string().trim().min(1, "Especialidade obrigatória.").max(80),
  // discriminated guarantees these are absent:
  external_role: z.undefined().or(z.literal("").transform(() => undefined)).optional(),
  client_id: z.undefined().or(z.literal("").transform(() => undefined)).optional(),
});

const externalSchema = z.object({
  ...baseFields,
  kind: z.literal("external"),
  specialty: z.undefined().or(z.literal("").transform(() => undefined)).optional(),
  external_role: z.string().trim().min(1, "Papel externo obrigatório.").max(80),
  client_id: z.string().uuid("Cliente obrigatório."),
});

export const personSchema = z.discriminatedUnion("kind", [internalSchema, externalSchema]);
export type PersonInput = z.input<typeof personSchema>;
export type PersonOutput = z.output<typeof personSchema>;
```

### `src/lib/db/queries/persons.ts` (estende)

Já tem `getExternalPersonsByClient`, `listInternalPersons`. Adicionar:

- `type PersonListItem` com avatar fields
- `type PersonDetail` (full row)
- `async function listPersons({ kind?, search? }): Promise<PersonListItem[]>`
- `async function getPerson(id: string): Promise<PersonDetail | null>` — null se 404/arquivada
- `async function countActivePersons(): Promise<{internal: number; external: number; total: number}>` — agrega 3 contagens
- `async function personHasActiveAllocations(id: string): Promise<boolean>`
- `async function getPersonAllocations(personId: string): Promise<PersonAllocationItem[]>` — embed `frente:frentes(id, name, cycle_type, operation_id, operation:operations(id, name, client:clients(name)))`; filtra `archived_at IS NULL` em frente/op. Retorna array com Op + Frente + role + capacity.

### `src/lib/actions/persons.ts`

3 actions com pattern já estabelecido. Discriminated union no Zod parsing.

### `src/components/ui/Avatar.tsx` — vide acima

### `src/components/domain/PersonForm.tsx`

Client component com `useForm<PersonInput, undefined, PersonOutput>`. Estado `kind` via `watch('kind')` → renderiza condicionalmente especialty (internal) ou external_role+client_id (external). Quando `kind` muda, limpa campos do kind anterior via `setValue`.

Em edit: `kind` disabled (per spec).

### `src/components/domain/PersonsTable.tsx`

Server component. Recebe `PersonListItem[]` + `hasSearch` + `activeTab`. Colunas: Avatar (sm) + Nome + Pill kind + specialty/role + email + cliente.

### `src/components/domain/PersonsSearch.tsx`

Idêntico ao ClientsSearch.

### `src/components/domain/PersonsTabs.tsx`

Client component. 3 tabs: Internas/Externas/Todas. Update `router.push('/persons?kind=...&q=...')` mantendo `q`.

### `src/components/domain/PersonAllocationsSection.tsx` (interna)

Agrupa `PersonAllocationItem[]` por `operationId`. Renderiza header da Op + lista de Frentes embaixo (nome + Pill ciclo + role + capacity%).

### `src/components/domain/PersonClientSection.tsx` (externa)

Mostra card do Cliente vinculado + lista de Operações do Cliente (reusa `getActiveOperations({clientId})` + `OperationCard` em grid compacto).

### Pages

- `/persons/page.tsx` — Server, params `?kind=&q=`; `Promise.all([listPersons, countActivePersons])`; renderiza PageHeader + Tabs + Search + Table
- `/persons/new/page.tsx` — preload `listClients()` pro select externo; PersonForm mode=create
- `/persons/[id]/page.tsx` — getPerson; if internal: getPersonAllocations + render PersonAllocationsSection; if external: getActiveOperations({clientId: person.client_id}) + render PersonClientSection
- `/persons/[id]/edit/page.tsx` — getPerson + listClients (pro select); personHasActiveAllocations pra canArchive

### Sidebar updates

- `Sidebar.tsx`:
  - `Promise.all([getUser, countActiveClients, countActiveOperations, countActivePersons])` — agora 4-wide
  - Footer: `<Avatar initials={initialsFromEmail(email)} size="sm" color="oak" />` + email + LogOut
- `SidebarNav.tsx`:
  - Nova prop `personsCount`
  - Adiciona "Pessoas" no grupo "Espaço de trabalho" com ícone `User2` (já temos `Users` pra Clientes; usar `UserCog` ou `Contact`)
  - Decisão: usar `Contact` da Lucide

### `FrentesListSection` update

- `OperationDetail.frentes` precisa de `responsibleName` no item.
- Modificar `getOperation`:
  - Embed `responsible_person:persons!fk_frentes_responsible_person_id(name)`
  - Adicionar `responsibleName: f.responsible_person?.name ?? null` em `FrenteListItem`
- `FrentesListSection`: renderiza `<Avatar size="sm" initials={getInitials(responsibleName)} />` antes do status acionável quando existe

### `ExternalPersonsList` update

- Cada `<li>` prepende `<Avatar size="sm" initials={getInitials(name)} />`

---

## Data Models

Nenhum schema novo. Tipos derivados.

```ts
export type PersonListItem = {
  id: string;
  name: string;
  kind: 'internal' | 'external';
  specialty: string | null;
  externalRole: string | null;
  email: string | null;
  clientId: string | null;
  clientName: string | null;
};

export type PersonAllocationItem = {
  allocationId: string;
  role: 'responsavel' | 'executor' | 'aprovador' | 'plantao';
  capacityWeeklyPct: number;
  frente: { id; name; cycleType };
  operation: { id; name; client: { name } };
};
```

---

## Error Handling Strategy

| Scenario | Action handling | UI |
|---|---|---|
| `kind=internal` com external_role/client_id (state stale) | Zod discriminated union rejeita | Mensagem field correspondente |
| `kind=external` sem client_id | Zod rejeita | client_id field |
| Email inválido | Zod | email field |
| FK violation (cliente arquivado) | 23503 → `err('Cliente inválido.', 'invalid_client')` | inline em client_id |
| CHECK violation (espelhando consistency) | 23514 → `err('Configuração inválida pra tipo selecionado.', 'check_violation')` | general |
| Archive interna com allocations | `has_active_allocations` | general |
| 404 / arquivada | `notFound()` ou redirect | Next 404 |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Zod schema | `z.discriminatedUnion('kind', [...])` | Espelha CHECK do DB; type narrowing automatico |
| Form conditional fields | `watch('kind')` + condicional render; `setValue` pra limpar campos do kind anterior em toggle | Padrão RHF |
| Edit kind disabled | Sim | Mudar kind = nova pessoa |
| Avatar sizes | sm/md/lg/xl per skill | Skill já especifica |
| Avatar initials helper | 2 funções: `getInitials(name)` + `initialsFromEmail` | Casos de uso distintos (Sidebar usa email; resto usa nome) |
| Tabs kind | 3 tabs clicáveis com URL state | Pattern de search; deeplinkable |
| Tabs UI | Client component `PersonsTabs` (precisa de pathname + searchParams pra preservar `q`) | Pattern já existe na Home (lá são estáticos; aqui clicáveis) |
| Detail interna: Alocações | Agrupado por Operação | Faz sentido pro user ("onde tô trabalhando") |
| Detail externa: lista Ops do cliente | Reusa OperationCard | DRY |
| FrentesListSection responsible avatar | Embed `responsible_person(name)` em `getOperation` | Uma query a mais no detalhe Op; aceitável |
| Sidebar footer Avatar | `initialsFromEmail` | Sem `profiles` ainda; quando vier, pegará nome real |
| Sidebar 4 counts em paralelo | `Promise.all` | Pattern atual |
| Person detail Hero estilo Operation? | NÃO — apenas Avatar + nome + Pill | Pessoa é entidade simples; hero oak é exagero |
| FK violation handler genérico | Sim, 23503/23514 mapeados | Mensagens amigáveis |

---

## Notes

- **`responsible_person` embed em `getOperation`**: adiciona ~50ms latência marginal; cabe
- **Em archive externa**: FK responsible_person_id em frentes faz SET NULL — frente perde responsável sem bloquear. Aceitar.
- **`docs/DATABASE_SCHEMA.md`**: sem mudança (sem nova tabela)
- **AGENTS.md note**: nada de novo Next 16 que afete essa feature
