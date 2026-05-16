# frentes-crud Tasks

**Design**: `.specs/features/frentes-crud/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Foundations (paralelo):
  T1 (frenteSchema Zod)
  T2 (queries/frentes.ts + listInternalPersons em persons.ts)

Phase 2 — Server Actions:
  T3 (actions/frentes.ts — create/update/archive + auto-since)

Phase 3 — Components:
  T4 (FrenteForm RHF + cycle/end_date logic)
  T5 (FrentesListSection update: header button + Editar per row)

Phase 4 — Pages (paralelo após Phase 3):
  T6 (/operations/[id]/frentes/new)
  T7 (/operations/[id]/frentes/[fid]/edit)

Phase 5 — Operation detail update:
  T8 (passar operationId pra FrentesListSection)

Phase 6 — Ship:
  T9 (typecheck + build + smoke + screenshot)
  T10 (issue + commit + push + PR)
```

Caminho crítico: T1 → T3 → T4 → T6 → T9 → T10.

---

## Task Breakdown

### T1: `src/lib/validators/frente.ts`

**Done when**:
- [ ] `frenteSchema` com: name, cycle_type, domain, phase, actionable_status (min 15 + refine NOT IN FORBIDDEN), responsible_person_id (uuid opcional), start_date, end_date (preprocess empty → undefined)
- [ ] `.refine` cross-field: cycle C/E sem end_date; end_date ≥ start_date
- [ ] `FORBIDDEN` array idêntico ao CHECK do DB (5 strings)
- [ ] Mensagens pt-BR
- [ ] `type FrenteInput = z.input<...>` e `FrenteOutput = z.output<...>` exportados
- [ ] `npm run typecheck` passa

---

### T2: Queries — `queries/frentes.ts` + `listInternalPersons`

**Done when**:
- [ ] `src/lib/db/queries/frentes.ts` exporta:
  - `type FrenteRow = Database["public"]["Tables"]["frentes"]["Row"]`
  - `async function getFrente(id: string): Promise<FrenteRow | null>` — filtra `archived_at IS NULL`
  - `async function frenteHasActiveAllocations(id: string): Promise<boolean>` — count em allocations onde `frente_id=id`. Allocations não têm `archived_at` no schema; "ativas" = todas.
- [ ] `src/lib/db/queries/persons.ts` ganha `listInternalPersons(): Promise<InternalPersonItem[]>`:
  - `InternalPersonItem = { id, name }`
  - filtra `kind='internal' AND archived_at IS NULL`; order by name asc
- [ ] `npm run typecheck` passa

---

### T3: `src/lib/actions/frentes.ts`

**Done when**:
- [ ] `'use server'`
- [ ] `createFrenteAction(operationId, formData): Promise<ActionResult<{id}>>`:
  - Guard `requireUserAction`
  - Zod parse (FrenteOutput)
  - INSERT com `operation_id=operationId`; map 23503 → `invalid_fk`, 23514 → `check_violation` (fallback)
- [ ] `updateFrenteAction(id, formData): Promise<ActionResult<{id, operationId}>>`:
  - Guard + parse
  - `const current = await getFrente(id)`; null → `err('Frente não encontrada.', 'not_found')`
  - Comparar `current.actionable_status.trim().toLowerCase()` vs `new.actionable_status.trim().toLowerCase()`
  - Se diferente: incluir `actionable_status_since: new Date().toISOString()` no payload
  - UPDATE; retorna `ok({ id, operationId: current.operation_id })`
- [ ] `archiveFrenteAction(id): Promise<ActionResult<{operationId}>>`:
  - Guard
  - `frenteHasActiveAllocations(id)` → bloqueia com `has_active_allocations`
  - Fetch operation_id (precisa pro redirect)
  - `archived_at = now()`
- [ ] Sem `throw`; tudo ActionResult

---

### T4: `src/components/domain/FrenteForm.tsx`

**Done when**:
- [ ] `'use client'`; `useForm<FrenteInput, undefined, FrenteOutput>` + zodResolver
- [ ] Props discriminated:
  - `create`: `{ mode, operationId, internalPersons }`
  - `edit`: `{ mode, initialData: FrenteRow, operationId, internalPersons, canArchive }`
- [ ] Inputs (todos com label mono + Field helper já existente):
  - Nome (text)
  - Tipo de ciclo (select com labels longas "A — Finito puro", etc)
  - Domínio (select: Infra / Dados Analíticos / Dados Técnicos)
  - Fase (select)
  - Status acionável (textarea rows=3; erro Zod aparece embaixo)
  - Responsável (select; "—" pra null; options de `internalPersons`)
  - Data de início (date)
  - Data de fim (date; **disabled + hint quando cycle_type ∈ {c, e}**)
- [ ] `watch('cycle_type')` → quando muda pra C/E, força `setValue('end_date', '')` e desabilita input
- [ ] Submit: chama action; sucesso → `router.push('/operations/{operationId}')` + `router.refresh()`
- [ ] Pattern de busy = `isSubmitting || isArchiving` per L-003
- [ ] Error mapping: `validation_<field>` → setError; `invalid_fk` / `check_violation` / `has_active_allocations` → general
- [ ] Botões: Salvar / Cancelar (link volta pra operação) / Arquivar (edit + canArchive)

---

### T5: Update `FrentesListSection.tsx`

**Done when**:
- [ ] Props ganha `operationId: string`
- [ ] Header da section: além de h2 + Pill, agora `<Link href={\`/operations/${operationId}/frentes/new\`}><Button variant="sage" size="sm"><Plus />Nova Frente</Button></Link>` à direita
- [ ] Empty state agora: texto + `<Link href="...new"><Button variant="sage">Criar primeira Frente</Button></Link>`
- [ ] Cada `<li>` ganha um `<Link>` "Editar →" no canto direito (mesmo pattern de "Abrir →"); não tornar row clicável
- [ ] Grid columns ajustado pra acomodar a coluna nova (de 12 cols, talvez `col-span-1` no fim pra "Editar"). Layout específico fica a critério da estética.

---

### T6: `/operations/[id]/frentes/new/page.tsx`

**Done when**:
- [ ] Server component; params async; UUID validation no `id`; redirect/404 se inválido
- [ ] Preload `getOperation(id)` (pra header context) + `listInternalPersons()` em `Promise.all`
- [ ] PageHeader `title={\`Nova Frente — ${op.client.name}\`}` `subtitle={op.name}` + back link
- [ ] `<FrenteForm mode="create" operationId={id} internalPersons={persons} />`

---

### T7: `/operations/[id]/frentes/[fid]/edit/page.tsx`

**Done when**:
- [ ] params async; valida ambos UUIDs
- [ ] `Promise.all([getOperation(id), getFrente(fid), frenteHasActiveAllocations(fid), listInternalPersons()])`
- [ ] Se `!op || !frente || frente.archived_at` → `redirect('/operations/{id}')`
- [ ] `if (frente.operation_id !== id)` → redirect (segurança: id do path tem que bater)
- [ ] PageHeader `title={\`Editar Frente — ${frente.name}\`}` `subtitle={\`${op.client.name} · ${op.name}\`}`
- [ ] `<FrenteForm mode="edit" initialData={frente} operationId={id} internalPersons={persons} canArchive={!hasAlloc} />`

---

### T8: Update Operation Detail Page

**Done when**:
- [ ] `src/app/(app)/operations/[id]/page.tsx`: passa `operationId={op.id}` pro `<FrentesListSection ... />`

---

### T9: Typecheck + build + smoke + screenshot

**Done when**:
- [ ] `npm run typecheck` + `build` verdes
- [ ] Local: visitar detalhe de Acme → ver botão "Nova Frente"; click leva ao form. Submit cria. Volta no detalhe → vê 2 frentes. Editar uma → mudar nome sem tocar status → since preservado. Mudar status → since vira agora.
- [ ] Screenshots: detail com botão, form new, form edit, list com botões Editar

---

### T10: Issue + commit + push + PR

**Done when**: issue + branch `feat/frentes-crud` + 1 commit + PR com Closes #N.

---

## Tools Summary

| Task | Tools | Skill |
|---|---|---|
| T1 | Write | `dryos-conventions` (Forms section) |
| T2 | Write/Edit | `dryos-conventions` (Queries) |
| T3 | Write | `dryos-conventions` (Server Actions + Status acionável) |
| T4 | Write | `dryos-conventions` (Forms) + `dryos-design-system` |
| T5 | Edit | `dryos-design-system` |
| T6-T7 | Write | `dryos-design-system` |
| T8 | Edit | — |
| T9 | Bash + playwright | — |
| T10 | gh + git | — |

---

## Pre-Implementation Confirmation

Pace: reto T1→T9, pauso antes do T10/PR pra screenshot review. ~30-40min de fluxo (menor que operations-crud porque sem hero, sem sparkline, sem table).
