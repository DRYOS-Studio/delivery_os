# allocations-crud Tasks

**Design**: `.specs/features/allocations-crud/design.md`

---

## Execution Plan

```
Phase 1 — Foundations (paralelo):
  T1 (allocationSchema)
  T2 (queries/allocations.ts: listByFrente + getAllocation)

Phase 2 — Actions:
  T3 (actions/allocations.ts: create/update/delete)

Phase 3 — Components:
  T4 (AllocationForm RHF)
  T5 (AllocationsSection)

Phase 4 — Pages:
  T6 (/allocations/new page)
  T7 (/allocations/[aid]/edit page)

Phase 5 — Integrate:
  T8 (FrenteEditPage fetcha + renderiza AllocationsSection)

Phase 6 — Ship:
  T9 (typecheck + build + screenshots)
  T10 (issue + commit + push + PR)
```

Caminho crítico: T1→T3→T4→T6→T8→T9→T10. ~25-30min.

---

## Task Breakdown

### T1: `src/lib/validators/allocation.ts`

**Done when**:
- [ ] `allocationSchema` com person_id uuid, role enum, capacity_weekly_pct number 0..100 (preprocess BR), start_date required, end_date opcional
- [ ] Refine cross-field: end ≥ start
- [ ] `AllocationInput` + `AllocationOutput` exportados

---

### T2: `src/lib/db/queries/allocations.ts` (novo)

**Done when**:
- [ ] `type AllocationRow = Database["public"]["Tables"]["allocations"]["Row"]`
- [ ] `type AllocationListItem = { id, role, capacityWeeklyPct, startDate, endDate, person: {id, name} }`
- [ ] `listAllocationsByFrente(frenteId): Promise<AllocationListItem[]>` — embed `person:persons(id, name)`; filtra `person.archived_at IS NULL`; order by `role` asc
- [ ] `getAllocation(id): Promise<AllocationRow | null>`

---

### T3: `src/lib/actions/allocations.ts`

**Done when**:
- [ ] `'use server'`; pattern ActionResult
- [ ] `createAllocationAction(operationId, frenteId, formData): Promise<ActionResult<{id, frenteId, operationId}>>`:
  - Guard auth + Zod parse
  - INSERT com `frente_id=frenteId`, demais campos do parse
  - Map 23503 → `invalid_person`
- [ ] `updateAllocationAction(id, formData): Promise<ActionResult<{id, frenteId, operationId}>>`:
  - Guard + parse + getAllocation pra obter frente_id atual
  - UPDATE preservando frente_id e person_id (person_id locked em edit)
  - Buscar operation_id via getFrente(frente_id) pra redirect
- [ ] `deleteAllocationAction(id): Promise<ActionResult<{frenteId, operationId}>>`:
  - Guard + fetch atual (pra obter frente_id)
  - Buscar operation_id via getFrente(frente_id)
  - DELETE FROM allocations WHERE id=$1
- [ ] Sem `throw`

---

### T4: `src/components/domain/AllocationForm.tsx`

**Done when**:
- [ ] `'use client'`; RHF + zodResolver(allocationSchema)
- [ ] Discriminated props: `mode='create' { operationId, frenteId, internalPersons }` vs `mode='edit' { initialData, operationId, frenteId, internalPersons }`
- [ ] Inputs:
  - Select Pessoa (internalPersons; disabled em edit)
  - Select Role (4 opções com labels pt-BR)
  - Number/text input Capacidade (helper "% da semana 0-100")
  - Date input start_date (required, default hoje no create)
  - Date input end_date (opcional)
- [ ] Submit → action → router.push back pra `/operations/{operationId}/frentes/{frenteId}/edit`
- [ ] Botão "Remover" (edit only, ghost critical): window.confirm + deleteAction
- [ ] Pattern busy = isSubmitting || isDeleting
- [ ] Error mapping por field

---

### T5: `src/components/domain/AllocationsSection.tsx`

**Done when**:
- [ ] Server component; props `allocations: AllocationListItem[]`, `operationId`, `frenteId`
- [ ] Header: h2 "Alocações" + Pill contagem + "+ Nova alocação" sage size sm linkando `/operations/[id]/frentes/[fid]/allocations/new`
- [ ] Empty state com CTA
- [ ] Lista linhas: grid com Avatar(sm) + nome (link `/persons/[id]`) + Pill role + capacity% mono + dates compact + Link "Editar →"
- [ ] ROLE_LABEL + ROLE_VARIANT (reusa do PersonAllocationsSection)

---

### T6: `src/app/(app)/operations/[id]/frentes/[fid]/allocations/new/page.tsx`

**Done when**:
- [ ] UUID guards pra id e fid; redirect inválidos
- [ ] Promise.all(getOperation, getFrente, listInternalPersons); valida frente.operation_id === id
- [ ] PageHeader "Nova alocação" subtitle "{frente.name} · {op.name} · {client.name}"
- [ ] `<AllocationForm mode="create" operationId frenteId internalPersons />`

---

### T7: `.../allocations/[aid]/edit/page.tsx`

**Done when**:
- [ ] UUID guards id, fid, aid
- [ ] Promise.all(getOperation, getFrente, getAllocation(aid), listInternalPersons)
- [ ] Valida: frente.operation_id === id, allocation.frente_id === fid; redirect senão
- [ ] PageHeader "Editar alocação"
- [ ] `<AllocationForm mode="edit" initialData={allocation} ... />`

---

### T8: Modificar FrenteEditPage

**Done when**:
- [ ] `/operations/[id]/frentes/[fid]/edit/page.tsx` adiciona:
  - `const allocations = await listAllocationsByFrente(fid)` em Promise.all com os outros
  - Renderiza `<AllocationsSection allocations={allocations} operationId={id} frenteId={fid} />` depois do `<FrenteForm />`

---

### T9: Typecheck + build + smoke + screenshots

**Done when**:
- [ ] typecheck + build verdes (20 rotas: 18 + 2 novas)
- [ ] Local: visitar /operations/{acme}/frentes/{infra}/edit → ver AllocationsSection com Rafael 40%; criar Gabi aprovadora 20%; editar Rafael pra 30%; remover Gabi
- [ ] Screenshots: frente edit com section, allocations new, allocations edit

---

### T10: Issue + commit + push + PR

---

## Pre-Impl

Pace: reto T1→T9, pauso antes do T10/PR. ~25min.
