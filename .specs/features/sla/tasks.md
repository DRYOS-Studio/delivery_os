# sla Tasks

**Design**: `.specs/features/sla/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration unificada: ALTER ops + enums + tabela + RLS + trigger + CHECKs)
  T2 (regenerate types)

Phase 2 — Foundations:
  T3 (utils/sla.ts: BreachLevel + slaBreachLevel + slaBreachPill)
  T4 (validators: update operation.ts + novo incident.ts)
  T5 (queries: incidents.ts + update operations.ts pra incluir hours)

Phase 3 — Actions:
  T6 (actions/incidents.ts: create/update/delete)

Phase 4 — Components:
  T7 (IncidentForm)
  T8 (IncidentRow + SLASection)
  T9 (PublicSLAList)
  T10 (update OperationForm com 2 inputs)
  T11 (update OperationHero + PublicHero com MetaChips)

Phase 5 — Pages:
  T12 (incidents/new + /[iid]/edit pages)
  T13 (integrar SLASection em /operations/[id])
  T14 (integrar PublicSLAList em /public/[token])

Phase 6 — Ship:
  T15 (typecheck + build + smoke)
  T16 (DATABASE_SCHEMA.md)
  T17 (issue + PR + merge)
```

Caminho crítico: T1→T2→T3→T5→T6→T7→T8→T13→T15→T17. ~90-120min.

---

## Task Breakdown

### T1: Migration `<ts>_sla.sql`

**Done when**:
- [ ] ALTER operations adiciona response_hours, resolution_hours int nullable + 2 CHECKs (range 0-720) + COMMENT ON COLUMN nos 2
- [ ] CREATE TYPE sla_severity + sla_incident_status (DO $$ IF NOT EXISTS)
- [ ] CREATE TABLE sla_incidents + 4 CHECKs:
  - responded_at >= opened_at
  - resolved_at >= responded_at (se ambos NOT NULL)
  - status responded/resolved requer responded_at
  - status resolved requer resolved_at
- [ ] Index idx_sla_incidents_operation_opened (operation_id, opened_at DESC)
- [ ] COMMENT ON TABLE
- [ ] Trigger updated_at
- [ ] RLS + policy authenticated_full
- [ ] Aplicado via MCP

---

### T2: Regenerate types

- [ ] generate_typescript_types MCP
- [ ] Types: operations Row inclui response_hours, resolution_hours; sla_incidents Row + enums

---

### T3: Helper sla.ts

- [ ] `src/lib/utils/sla.ts`:
  - `BreachLevel` type
  - `IncidentForBreach`, `OpSLAConfig` types
  - `slaBreachLevel(incident, op)` — handle cancelled/resolved/responded/open + approaching (75%)
  - `slaBreachPill(level)` — null se ok; senão {text, variant}
  - `formatHours(h)` — "4h" / "1d 8h" se > 24

---

### T4: Validators

- [ ] Update `src/lib/validators/operation.ts`:
  - Adicionar response_hours, resolution_hours opcionais
  - preprocess string → int / undefined; min 0 max 720
- [ ] Novo `src/lib/validators/incident.ts`:
  - incidentSchema com title/description/severity/status/opened_at/responded_at/resolved_at
  - 2 refines pro status

---

### T5: Queries

- [ ] `src/lib/db/queries/incidents.ts` novo:
  - `IncidentRow`, `IncidentListItem` types
  - `listIncidentsByOperation(operationId, opts?: { excludeCancelled?: boolean })`
  - `getIncident(id)`
  - `countOpenIncidents(operationId)` — WHERE status='open'
  - `listPublicIncidents(operationId)` — usa createAdmin, WHERE status != 'cancelled'
  - Opener email via resolveAuthorEmails (reusa pattern)
- [ ] Update `src/lib/db/queries/operations.ts`:
  - `OperationDetail` ganha `responseHours: number | null`, `resolutionHours: number | null`
  - SELECT incluir response_hours, resolution_hours
  - `OperationCardData` se aplicável

---

### T6: Actions incidents

- [ ] `'use server'`; ActionResult
- [ ] `createIncidentAction(operationId, formData)`:
  - Guard + Zod + INSERT com opened_by
  - revalidatePath
- [ ] `updateIncidentAction(incidentId, formData)`:
  - Guard + getIncident + Zod + UPDATE preservando opened_by/opened_at se aplicável
  - revalidatePath
- [ ] `deleteIncidentAction(incidentId)`:
  - Guard + getIncident + DELETE
  - revalidatePath

---

### T7: IncidentForm

- [ ] `'use client'`; RHF + zodResolver(incidentSchema)
- [ ] Props discriminadas create/edit
- [ ] Campos: title, description (textarea), severity (select), status (select), opened_at + responded_at + resolved_at (datetime-local)
- [ ] Submit → action → router.push /operations/[id]
- [ ] Edit: botão Remover (window.confirm + delete)
- [ ] Pattern busy

---

### T8: SLASection + IncidentRow

- [ ] `IncidentRow.tsx` server: linha com title (Link edit) + severity pill + status pill + breach pill + datas + author
- [ ] `SLASection.tsx` server:
  - Props: incidents, openCount, op (response_hours, resolution_hours), operationId
  - Header h2 "SLA & incidentes" + Pill openCount + Link "+ Registrar incidente"
  - Block promessa: "Resposta em até Xh · Resolução em até Yh" ou empty
  - Lista incidents via IncidentRow
  - Empty state

---

### T9: PublicSLAList

- [ ] Server; props: incidents (já filtrados), op SLA config
- [ ] Block promessa
- [ ] Lista incidents (sem botões edit/delete; com breach pill)
- [ ] Empty state

---

### T10: Update OperationForm

- [ ] 2 novos inputs lado a lado em grid: "Resposta (h)" + "Resolução (h)"
- [ ] register no RHF
- [ ] FormData incluir os 2 campos no submit
- [ ] Validação Zod já cobre

---

### T11: Update OperationHero + PublicHero

- [ ] `OperationHero`: 2 MetaChips condicionais "Resposta" + "Resolução" (mostra "Xh" ou "—")
- [ ] `PublicHero`: idem em variação adequada ao layout

---

### T12: Pages incidents

- [ ] `/src/app/(app)/operations/[id]/incidents/new/page.tsx`:
  - UUID guard
  - getOperation + redirect inválidos
  - PageHeader "Novo incidente" subtitle
  - IncidentForm mode=create
- [ ] `.../incidents/[iid]/edit/page.tsx`:
  - UUID guards id+iid
  - Promise.all(getOperation, getIncident)
  - Validar incident.operation_id === id
  - PageHeader "Editar incidente"
  - IncidentForm mode=edit

---

### T13: Integrar SLASection em /operations/[id]

- [ ] Promise.all adiciona listIncidentsByOperation + countOpenIncidents
- [ ] Renderiza `<SLASection />` antes de PublicLinksSection
- [ ] Passa op.responseHours, op.resolutionHours

---

### T14: Integrar PublicSLAList em /public/[token]

- [ ] Adicionar query listPublicIncidents no Promise.all
- [ ] Update getOperationPublicView pra incluir response_hours, resolution_hours
- [ ] Update PublicHero pra mostrar chips
- [ ] Renderiza `<PublicSLAList />` após PublicAttachmentsList

---

### T15: Typecheck + build + smoke

- [ ] typecheck + build verdes (rotas: 33 + 2 = 35)
- [ ] Smoke:
  - Editar Op definindo Resposta=4h, Resolução=24h → Hero mostra chips
  - Registrar incident severity=high → aparece com pill open
  - Edit: marcar responded_at 5h depois → breach response_breach
  - Marcar resolved_at 30h depois → breach resolution_breach
  - Cancelar incident → some breach
  - Public link: cliente vê SLA chips + incidents + breach
- [ ] Screenshots

---

### T16: DATABASE_SCHEMA.md

- [ ] Atualizar operations (campos novos)
- [ ] Adicionar sla_incidents + 2 enums
- [ ] Total 13 tabelas
- [ ] Migration na lista

---

### T17: Issue + commit + PR + merge

---

## Pre-Impl

Pace: reto T1→T15, pauso antes do PR. ~90-120min.

**Riscos**:
- Form com 3 datetime-local + status enum + 2 refines = complexo. Test transition cases mentalmente
- OperationDetail query update precisa cuidado pra não quebrar OperationHero
- Public attachments+incidents+meetings+frentes na mesma page pode ficar longa — aceitar
