# meetings-decisions Tasks

**Design**: `.specs/features/meetings-decisions/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: 2 enums + meetings + meeting_attendees + decisions + RLS + triggers + indexes)
  T2 (regenerate types)

Phase 2 — Foundations (paralelo):
  T3 (validators: meeting + decision)
  T4 (constants/visibility + utils/datetime)
  T5 (queries: meetings + decisions + listAttendeeCandidates)

Phase 3 — Actions:
  T6 (actions/meetings: create/update/delete + handle attendees)
  T7 (actions/decisions: create/update/delete)

Phase 4 — Components:
  T8 (MeetingForm RHF + attendees multi-select)
  T9 (DecisionForm RHF + meeting select)
  T10 (MeetingsDecisionsTimeline server + merge+sort+slice)

Phase 5 — Pages:
  T11 (/meetings/new + [mid]/edit)
  T12 (/decisions/new + [did]/edit)
  T13 (substituir PlaceholderSection em /operations/[id] page por Timeline)

Phase 6 — Ship:
  T14 (typecheck + build + smoke)
  T15 (DATABASE_SCHEMA.md update)
  T16 (issue + commit + push + PR + merge)
```

Caminho crítico: T1→T2→T5→T6/T7→T8/T9→T13→T14→T16. ~60-90min (maior que briefing pelo escopo).

---

## Task Breakdown

### T1: Migration `<ts>_meetings_decisions.sql`

**Done when**:
- [ ] `CREATE TYPE meeting_visibility AS ENUM('interno','cliente')`
- [ ] `CREATE TYPE decision_visibility AS ENUM('interno','cliente')`
- [ ] `CREATE TABLE meetings` (id, operation_id FK CASCADE, title, scheduled_at, notes, visibility, created_at, updated_at)
- [ ] `CREATE INDEX idx_meetings_operation_scheduled` (operation_id, scheduled_at DESC)
- [ ] `CREATE TABLE meeting_attendees` (meeting_id FK CASCADE, person_id FK RESTRICT, created_at, PK composto)
- [ ] `CREATE TABLE decisions` (id, operation_id FK CASCADE NOT NULL, meeting_id FK SET NULL, title, context, decision, visibility default 'cliente', decided_at, created_at, updated_at)
- [ ] `CREATE INDEX idx_decisions_operation_decided` (operation_id, decided_at DESC)
- [ ] COMMENT ON TABLE em todas + COMMENT ON COLUMN decisions.visibility (Inv. 05)
- [ ] RLS habilitado nas 3
- [ ] Policies `_authenticated_full` nas 3
- [ ] Triggers updated_at em meetings + decisions (reusa função set_updated_at)
- [ ] Aplicado via MCP apply_migration

---

### T2: Regenerate types

**Done when**:
- [ ] `generate_typescript_types` via MCP
- [ ] `src/lib/db/types.ts` contém `meetings`, `meeting_attendees`, `decisions` Row types + enums `meeting_visibility`, `decision_visibility`

---

### T3: Validators

**Done when**:
- [ ] `src/lib/validators/meeting.ts`:
  - `meetingSchema`: title (min 3 max 200), scheduled_at (string min 1), notes optional max 5000, visibility enum, attendee_ids array uuid default []
  - `MeetingInput`/`MeetingOutput` exports
- [ ] `src/lib/validators/decision.ts`:
  - `decisionSchema`: title, context optional, decision (min 3 max 5000), visibility, decided_at, meeting_id optional uuid
  - `DecisionInput`/`DecisionOutput` exports

---

### T4: Constants + utils datetime

**Done when**:
- [ ] `src/lib/constants/visibility.ts`: `VISIBILITY_LABEL` + `VISIBILITY_VARIANT` (sage/warning)
- [ ] `src/lib/utils/datetime.ts`: `dateTimeLocalToISO`, `isoToDateTimeLocal`, `formatDateTimeBR`

---

### T5: Queries

**Done when**:
- [ ] `src/lib/db/queries/meetings.ts`:
  - `MeetingListItem`, `MeetingWithAttendees` types
  - `listMeetingsByOperation(operationId, limit=20)` — embed attendees via JOIN com `meeting_attendees!fk_..(person:persons(id, name, kind))`
  - `getMeeting(id)` retorna meeting + attendees array
  - `listAttendeeCandidates(clientId)` — `listInternalPersons()` + persons externas WHERE `client_id = clientId AND archived_at IS NULL`; retorna array `{id, name, kind}` ordenado kind/name
- [ ] `src/lib/db/queries/decisions.ts`:
  - `DecisionListItem` types
  - `listDecisionsByOperation(operationId, limit=20)` — embed meeting opcional
  - `getDecision(id)`

---

### T6: Actions/meetings.ts

**Done when**:
- [ ] `'use server'`; ActionResult
- [ ] `createMeetingAction(operationId, formData)`:
  - Guard + Zod parse
  - INSERT meeting RETURNING id
  - Se attendee_ids.length > 0: INSERT meeting_attendees em batch
  - Map 23503 → invalid_attendee
  - revalidatePath /operations/[id]
- [ ] `updateMeetingAction(meetingId, formData)`:
  - Guard + parse + getMeeting (pra obter operation_id)
  - UPDATE meeting
  - DELETE attendees existentes + INSERT novos (simples diff)
  - revalidatePath
- [ ] `deleteMeetingAction(meetingId)`:
  - Guard + getMeeting
  - DELETE (CASCADE derruba attendees)
  - revalidatePath

---

### T7: Actions/decisions.ts

**Done when**:
- [ ] `createDecisionAction(operationId, formData)`:
  - Guard + parse
  - Se meeting_id presente: validar que pertence à operation; senão err `invalid_meeting`
  - INSERT
- [ ] `updateDecisionAction(decisionId, formData)`:
  - Guard + parse + getDecision (pra obter operation_id)
  - Mesma validação meeting_id
  - UPDATE
- [ ] `deleteDecisionAction(decisionId)`:
  - Hard delete

---

### T8: MeetingForm.tsx

**Done when**:
- [ ] `'use client'`; RHF + zodResolver
- [ ] Props create/edit discriminadas
- [ ] Campos: title, scheduled_at (datetime-local), visibility (radio com 2 opções + pills inline), notes textarea
- [ ] Attendees: 2 sub-seções "Internas" + "Externas {cliente}", cada uma com checkboxes
- [ ] Edit: botão Remover (ghost critical + window.confirm)
- [ ] Submit → router.push /operations/[id]

---

### T9: DecisionForm.tsx

**Done when**:
- [ ] Mesma estrutura
- [ ] Campos: title, decided_at (datetime-local), visibility radio, context textarea, decision textarea (rows 8, required)
- [ ] meeting_id select com lista de reuniões da Op (passado via prop) — placeholder "Sem reunião associada"
- [ ] Edit: Remover

---

### T10: MeetingsDecisionsTimeline.tsx

**Done when**:
- [ ] Server component; props `meetings`, `decisions`, `operationId`
- [ ] Merge + sort DESC + slice 8
- [ ] Header: h2 + Pill contagem total + 2 Links "+ Reunião" + "+ Decisão"
- [ ] Empty state com 2 CTAs
- [ ] Cada item:
  - Ícone (CalendarDays meeting / Gavel decision) — Lucide
  - Pill visibility (VISIBILITY_VARIANT) + Lock/Users icon
  - Título (font-display) + data relativa mono
  - Preview 120 chars (notes pra meeting; primeiro de [context, decision] pra decision)
  - Link "Editar →"
- [ ] CSS: border-left + dot connector visual

---

### T11: Pages meetings

**Done when**:
- [ ] `src/app/(app)/operations/[id]/meetings/new/page.tsx`:
  - UUID guard
  - Promise.all(getOperation, listAttendeeCandidates(op.client.id))
  - PageHeader + `<MeetingForm mode="create" />`
- [ ] `.../meetings/[mid]/edit/page.tsx`:
  - UUID guards id+mid
  - Promise.all(getOperation, getMeeting, listAttendeeCandidates)
  - Validar meeting.operation_id === id
  - PageHeader + `<MeetingForm mode="edit" initialData attendees ... />`

---

### T12: Pages decisions

**Done when**:
- [ ] `.../decisions/new/page.tsx`:
  - UUID guard
  - Promise.all(getOperation, listMeetingsByOperation pra meeting_id select)
  - PageHeader + `<DecisionForm mode="create" />`
- [ ] `.../decisions/[did]/edit/page.tsx`:
  - UUID guards id+did
  - Promise.all(getOperation, getDecision, listMeetingsByOperation)
  - Validar decision.operation_id === id
  - PageHeader + `<DecisionForm mode="edit" />`

---

### T13: Integrar Timeline em /operations/[id]

**Done when**:
- [ ] Page chama listMeetingsByOperation + listDecisionsByOperation em paralelo
- [ ] Substitui `<PlaceholderSection title="Reuniões e decisões" />` por `<MeetingsDecisionsTimeline />`

---

### T14: Typecheck + build + smoke

**Done when**:
- [ ] typecheck + build verdes (rotas: 26 + 4 novas = 30)
- [ ] Smoke local Acme/Core:
  - Criar reunião "Kickoff" com Rafael (interno) + Gabi externa, visibility cliente
  - Criar decisão linkada à reunião, visibility interno
  - Criar decisão standalone, visibility cliente
  - Timeline mostra 3 itens
  - Remover reunião → decisão sobrevive
- [ ] Screenshots: timeline com itens, meeting form, decision form

---

### T15: DATABASE_SCHEMA.md

**Done when**:
- [ ] Adicionar 3 tabelas + 2 enums
- [ ] Atualizar índice: 7 → 10 tabelas
- [ ] Última análise = 2026-05-17 (mesmo dia)

---

### T16: Issue + commit + push + PR + merge

---

## Pre-Impl

Pace: reto T1→T14, pauso antes do PR. ~60-90min.
