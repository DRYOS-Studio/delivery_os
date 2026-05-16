# persons-crud Tasks

**Design**: `.specs/features/persons-crud/design.md`

---

## Execution Plan

```
Phase 1 — Foundations (paralelo):
  T1 (validators/person.ts Zod discriminated)
  T2 (utils/initials.ts)
  T3 (Avatar component)

Phase 2 — Queries + actions:
  T4 (queries/persons.ts estende: list, get, count, hasAllocations, getAllocations)
  T5 (queries/operations.ts: getOperation embed responsible_person)
  T6 (actions/persons.ts)

Phase 3 — Components:
  T7 (PersonsSearch)
  T8 (PersonsTabs)
  T9 (PersonsTable)
  T10 (PersonForm com conditional kind)
  T11 (PersonAllocationsSection + PersonClientSection)

Phase 4 — Pages:
  T12 (/persons list)
  T13 (/persons/new)
  T14 (/persons/[id] detail)
  T15 (/persons/[id]/edit)

Phase 5 — Updates em components existentes:
  T16 (Sidebar + SidebarNav: Avatar + Pessoas link + 4 counts)
  T17 (ExternalPersonsList: Avatar)
  T18 (FrentesListSection: Avatar responsible)

Phase 6 — Ship:
  T19 (typecheck + build + screenshots)
  T20 (issue + commit + push + PR)
```

Caminho crítico: T1 → T6 → T10 → T13 → T19 → T20.

---

## Task Breakdown

### T1: `src/lib/validators/person.ts` — Zod discriminated

**Done when**:
- [ ] Exporta `personSchema = z.discriminatedUnion('kind', [internalSchema, externalSchema])`
- [ ] `internalSchema`: name, email opcional, kind='internal', specialty min 1, undefined em external_role/client_id
- [ ] `externalSchema`: name, email opcional, kind='external', external_role min 1, client_id uuid, undefined em specialty
- [ ] `PersonInput = z.input<...>`, `PersonOutput = z.output<...>`
- [ ] Mensagens pt-BR
- [ ] `npm run typecheck` passa

---

### T2: `src/lib/utils/initials.ts`

**Done when**:
- [ ] `getInitials(name: string): string` — 2 letras se 2+ palavras, 1 letra se só 1; uppercase; "?" se vazio
- [ ] `initialsFromEmail(email: string | null): string` — splita prefixo por `.`/`-`/`_`; mesma lógica
- [ ] Casos teste mentais: "Rafael" → "R"; "Ana Lisboa" → "AL"; "  Maria   Silva   Santos  " → "MS"; "rafael@x" → "R"; "joao.silva@x" → "JS"

---

### T3: `src/components/ui/Avatar.tsx`

**Done when**:
- [ ] Props: `initials`, `size?`, `color?`, `className?`
- [ ] SIZES + COLORS maps per design
- [ ] `aria-hidden` (decorativo; nome adjacente carrega info)
- [ ] Render: `<div class="rounded-full flex items-center justify-center font-display font-semibold leading-none">{initials}</div>`

---

### T4: Queries persons (estende)

**Done when**:
- [ ] `type PersonListItem`, `PersonAllocationItem`, `PersonDetail` exportados
- [ ] `listPersons({kind?, search?})` — embed `client:clients(name)`; filtra `archived_at IS NULL`; aplica filtro kind se passado; ILIKE em name OR email se search
- [ ] `getPerson(id)` — null se 404/arquivada
- [ ] `countActivePersons()` — retorna `{internal, external, total}` (3 queries `head=true count exact` em paralelo OU 1 query group by kind se PostgREST permitir; mais simples: 3 paralelas)
- [ ] `personHasActiveAllocations(id)` — count em allocations
- [ ] `getPersonAllocations(personId)` — embed `frente:frentes!fk_allocations_frente_id(id, name, cycle_type, archived_at, operation:operations!fk_frentes_operation_id(id, name, archived_at, client:clients(name)))`. Filtra frente.archived_at IS NULL AND operation.archived_at IS NULL. Map pra `PersonAllocationItem[]`.

---

### T5: `getOperation` ganha `responsible_person` embed

**Done when**:
- [ ] `FrenteListItem` ganha `responsibleName: string | null`
- [ ] Embed em `getOperation`: `responsible_person:persons!fk_frentes_responsible_person_id(name)`
- [ ] Map: `responsibleName: f.responsible_person?.name ?? null`
- [ ] Compatibilidade: callers existentes continuam funcionando (campo opcional adicional)

---

### T6: `src/lib/actions/persons.ts`

**Done when**:
- [ ] `createPersonAction(formData)`:
  - Guard auth + Zod parse
  - INSERT com campos consistentes pelo kind
  - Map 23503 → invalid_client (FK), 23514 → check_violation (defesa)
- [ ] `updatePersonAction(id, formData)`:
  - Guard + parse
  - fetch current → erro se kind no formData ≠ current.kind (defesa contra state stale; kind disabled na UI mas validação extra)
  - UPDATE
- [ ] `archivePersonAction(id)`:
  - Guard
  - Se kind=internal e `personHasActiveAllocations` → `has_active_allocations`
  - Senão `archived_at=now()`

---

### T7: `PersonsSearch.tsx` [P]

**Done when**: clone de ClientsSearch com placeholder "Buscar por nome ou e-mail…" e URL `/persons?q=`. Mantém `kind` se existir no URL.

---

### T8: `PersonsTabs.tsx`

**Done when**:
- [ ] `'use client'`
- [ ] Props: `counts: {internal, external, total}`, `activeKind: 'internal'|'external'|'all'`, `currentQuery: string`
- [ ] Renderiza 3 pills clicáveis: Internas / Externas / Todas; ativa com `bg-card border border-line-strong`, inativa `bg-transparent text-mute`
- [ ] `usePathname` + `useRouter`; click → `router.push('/persons?kind=...&q=...')`

---

### T9: `PersonsTable.tsx` [P]

**Done when**:
- [ ] Server component; props `persons: PersonListItem[]`, `hasFilter: boolean` (true se kind!='all' ou q!='')
- [ ] Colunas: Avatar sm, Nome, Tipo (Pill oak=internal, sage=external), Especialidade/Papel (mono mute), E-mail (mailto), Cliente (— pra internas), Abrir →
- [ ] Empty state varia por hasFilter

---

### T10: `PersonForm.tsx`

**Done when**:
- [ ] `'use client'`; `useForm<PersonInput, undefined, PersonOutput>` + zodResolver(personSchema)
- [ ] Discriminated por `kind`; watch('kind') → renderiza condicional
- [ ] Em mudança de kind: `setValue('specialty', undefined)`, `setValue('external_role', undefined)`, `setValue('client_id', undefined)` antes de re-render
- [ ] Modes: create / edit (edit tem `kind` disabled)
- [ ] Props create: `clientsForSelect: {id,name}[]`
- [ ] Props edit: `initialData: PersonDetail`, `canArchive: boolean`, `clientsForSelect`
- [ ] Sucesso → `router.push('/persons/{id}')`
- [ ] Botão Arquivar: edit + canArchive; `window.confirm`
- [ ] Empty state se kind=external e clientsForSelect.length === 0: "Crie um Cliente primeiro" + link

---

### T11: `PersonAllocationsSection.tsx` + `PersonClientSection.tsx`

**Done when**:
- [ ] `PersonAllocationsSection`: recebe `allocations: PersonAllocationItem[]`. Agrupa por `operation.id`. Pra cada Op: header (nome + cliente) + lista de Frentes embaixo (`Frente name + Pill ciclo + Pill role + capacityPct%`). Empty: "Sem alocações ativas."
- [ ] `PersonClientSection`: recebe `client: {id, name, slug}` + `operations: OperationCardData[]`. Renderiza um row simples linkando ao cliente (`/clients/[id]`) + grid de OperationCard. Empty se 0 ops.

---

### T12: `/persons/page.tsx`

**Done when**:
- [ ] Server; `searchParams: Promise<{kind?: 'internal'|'external'|'all', q?: string}>`
- [ ] `const { kind = 'all', q } = await searchParams`
- [ ] `const [persons, counts] = await Promise.all([listPersons({ kind: kind==='all'?undefined:kind, search: q }), countActivePersons()])`
- [ ] PageHeader (sage button "+ Nova pessoa") + PersonsTabs + PersonsSearch + PersonsTable
- [ ] Build verde

---

### T13: `/persons/new/page.tsx` [P]

**Done when**:
- [ ] Preload `listClients()`
- [ ] PageHeader + `PersonForm mode="create" clientsForSelect={...}`

---

### T14: `/persons/[id]/page.tsx`

**Done when**:
- [ ] UUID guard; getPerson; notFound se null
- [ ] Header: `<Avatar size="lg">{initials}</Avatar>` + nome em display 2.5rem + Pill kind + specialty/role mono
- [ ] PageHeader actions: Link Editar
- [ ] Se email: bloco `<a mailto>`
- [ ] Se internal: `getPersonAllocations(id)` + `<PersonAllocationsSection ... />`
- [ ] Se external: `getActiveOperations({clientId: person.client_id})` + `<PersonClientSection ... />` com client + ops

---

### T15: `/persons/[id]/edit/page.tsx`

**Done when**:
- [ ] getPerson; redirect persons se null/arquivada
- [ ] listClients (pro select; mesmo disabled, simplifica reuso)
- [ ] personHasActiveAllocations pra canArchive
- [ ] `<PersonForm mode="edit" initialData={person} canArchive={...} clientsForSelect={...} />`

---

### T16: Sidebar + SidebarNav update

**Done when**:
- [ ] `Sidebar.tsx`: `Promise.all([getUser, countActiveClients, countActiveOperations, countActivePersons])` — countActivePersons retorna o objeto agregado; usar `.total`
- [ ] Footer: `<Avatar size="sm" initials={initialsFromEmail(email)} color="oak" />` + email truncado + LogOut
- [ ] `SidebarNav.tsx`: prop `personsCount?: number`; item novo "Pessoas" com icon `Contact` em "Espaço de trabalho" depois de Operações

---

### T17: ExternalPersonsList update

**Done when**:
- [ ] Cada `<li>` prepende `<Avatar size="sm" initials={getInitials(name)} />`
- [ ] Layout ajustado pra acomodar (flex grid)

---

### T18: FrentesListSection update

**Done when**:
- [ ] Recebe `responsibleName` nas linhas (vem de FrenteListItem já estendido em T5)
- [ ] Se `responsibleName`, renderiza `<Avatar size="sm" initials={getInitials(responsibleName)} />` antes do status acionável (ou ao lado das pills — escolher visualmente)

---

### T19: Typecheck + build + screenshots

**Done when**:
- [ ] typecheck + build verdes
- [ ] Local: visitar /persons → 2 internas; clicar tab Externas → 0; criar externa "Maria — Diretora @ Acme"; ver detalhe Maria → Cliente + Ops; ver detalhe Rafael → 2 alocações agrupadas; Sidebar mostra "Pessoas (3)" e Avatar no footer; Detalhe Acme: ExternalPersonsList com avatar Maria; Detalhe Acme Core: Avatar do responsável na Infra (se houver — Acme Core tem Frente Infra com responsible_person_id, dependendo do seed; verificar)
- [ ] Screenshots: list, new, detail-internal, detail-external, sidebar atualizada

---

### T20: Issue + commit + push + PR

---

## Pre-Implementation

Pace: reto T1→T19, pauso antes do T20/PR. ~40-50min (feature média; muitos arquivos pequenos + Avatar reusado em 3 lugares).
