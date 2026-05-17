# attachments Tasks

**Design**: `.specs/features/attachments/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: bucket + storage policies + table + RLS + index + trigger)
  T2 (regenerate types)

Phase 2 — Foundations (paralelo):
  T3 (validators/attachment + utils/file.ts)
  T4 (queries/attachments)

Phase 3 — Action + Download:
  T5 (actions/attachments)
  T6 (route handler /api/attachments/[id]/download)

Phase 4 — Components:
  T7 (AttachmentUploadForm client)
  T8 (AttachmentsSection server + DeleteButton wrapper)
  T9 (MeetingsDecisionsTimeline aceita prop meetingAttachmentCounts)

Phase 5 — Pages:
  T10 (integrar section em /operations/[id])
  T11 (integrar section dentro de meeting edit)

Phase 6 — Ship:
  T12 (typecheck + build + smoke)
  T13 (DATABASE_SCHEMA.md update)
  T14 (issue + commit + PR + merge)
```

Caminho crítico: T1→T2→T4→T5→T6→T7→T8→T10/T11→T12→T14. ~60min.

---

## Task Breakdown

### T1: Migration

**Done when**:
- [ ] `INSERT INTO storage.buckets ... ON CONFLICT DO NOTHING` pro bucket `attachments` privado
- [ ] 3 storage policies: SELECT/INSERT/DELETE pra authenticated, condicional `bucket_id = 'attachments'`
- [ ] `CREATE TABLE attachments` (id, operation_id FK CASCADE, meeting_id FK SET NULL, storage_path, filename, mime_type, size_bytes, description, uploaded_by FK auth.users SET NULL, created_at, updated_at)
- [ ] CHECK `chk_attachments_size_range` (size > 0 AND ≤ 10485760)
- [ ] CHECK `chk_attachments_path_prefix` (storage_path LIKE operation_id::text || '/%')
- [ ] Index `idx_attachments_operation_created`
- [ ] Index parcial `idx_attachments_meeting_created` (WHERE meeting_id IS NOT NULL)
- [ ] RLS habilitado + policy authenticated_full
- [ ] Trigger updated_at
- [ ] COMMENT ON TABLE
- [ ] Aplicado via MCP

---

### T2: Regen types

- [ ] `generate_typescript_types` MCP
- [ ] `src/lib/db/types.ts` contém `attachments` Row

---

### T3: Validators + utils/file

- [ ] `src/lib/validators/attachment.ts`:
  - `attachmentUploadSchema`: filename, size_bytes, mime_type, description optional, meeting_id optional uuid
  - `AttachmentUploadInput`/`Output` exports
- [ ] `src/lib/utils/file.ts`:
  - `sanitizeFilename(name): string` — replace chars não-`[\w.\-]` por `_`
  - `formatBytes(n): string` — "1.2 MB"
  - `mimeCategory(mime): { label, lucideIconName }` — pdf/image/doc/file

---

### T4: Queries/attachments

- [ ] `AttachmentRow`, `AttachmentListItem` types
- [ ] `listAttachmentsByOperation(operationId, opts?: { meetingFilter?: 'none' | 'only' | 'all' })`:
  - `'none'` (default): WHERE meeting_id IS NULL
  - `'only'`: WHERE meeting_id IS NOT NULL
  - `'all'`: sem filtro
- [ ] `listAttachmentsByMeeting(meetingId): Promise<AttachmentListItem[]>`
- [ ] `countAttachmentsByMeeting(operationId): Promise<Map<string, number>>` — GROUP BY meeting_id WHERE meeting_id IS NOT NULL
- [ ] `getAttachment(id): Promise<AttachmentRow | null>`
- [ ] `uploaderEmail` resolvido via `createAdmin().auth.admin.getUserById()` (reusa pattern briefings)

---

### T5: Action attachments

- [ ] `'use server'`; ActionResult
- [ ] `uploadAttachmentAction(operationId, formData)`:
  - Guard auth
  - Lê file:File do FormData
  - Valida via Zod (filename, size, mime)
  - Se meeting_id presente: `getMeeting` + check operation_id === operationId
  - Sanitize filename + compõe path `<opId>/<uuid>-<sanitized>`
  - Storage upload
  - DB insert; se falha → cleanup storage best-effort
  - revalidatePath /operations/[id] (+ meeting edit se aplicável)
  - ok({ id, operationId })
- [ ] `deleteAttachmentAction(attachmentId)`:
  - Guard + getAttachment
  - DB delete
  - storage.remove best-effort
  - revalidatePath
  - ok({ operationId })

---

### T6: Route handler download

- [ ] `src/app/api/attachments/[id]/download/route.ts` exporta `GET`
- [ ] Guard authenticated via getUser; 401 se ausente
- [ ] getAttachment; 404 se não existe
- [ ] supabase.storage.createSignedUrl(path, 300)
- [ ] Redirect 302 pra signedUrl

---

### T7: AttachmentUploadForm

- [ ] `'use client'`
- [ ] Props: operationId, meetingId? (opcional)
- [ ] file input + description (textarea) + Button "Enviar"
- [ ] Validação client de size <= 10MB antes de submit
- [ ] Submit constrói FormData manual (file + description + meeting_id se prop presente) → uploadAttachmentAction
- [ ] router.refresh em sucesso; toast/inline erro
- [ ] busy state via local useState (sem RHF)
- [ ] Reset input após sucesso

---

### T8: AttachmentsSection + DeleteAttachmentButton

- [ ] `AttachmentsSection` server component:
  - Props: attachments[], operationId, meetingId? (opcional — afeta heading + form)
  - Header h2 + Pill contagem + collapsible UploadForm (client wrapper)
  - Empty state
  - Lista linhas com icon + filename link (`/api/attachments/[id]/download`) + description + size + autor + data relativa + DeleteButton
- [ ] `DeleteAttachmentButton` client:
  - Props: id, label?
  - window.confirm → deleteAttachmentAction → router.refresh
  - busy state

---

### T9: MeetingsDecisionsTimeline ext

- [ ] Aceita prop opcional `meetingAttachmentCounts?: Map<string, number>`
- [ ] Renderiza pequeno badge "📎 N" no item de meeting que tem count > 0

---

### T10: Integrar em /operations/[id]/page

- [ ] Promise.all adiciona:
  - `listAttachmentsByOperation(id)` (default: só sem meeting)
  - `countAttachmentsByMeeting(id)`
- [ ] Renderiza `<AttachmentsSection attachments operationId />` após Timeline e antes de FinanceCards
- [ ] Passa `meetingAttachmentCounts` pro Timeline
- [ ] **Não** mexe no Placeholder "Credenciais"

---

### T11: Integrar em meeting edit

- [ ] `/operations/[id]/meetings/[mid]/edit/page.tsx`:
  - Promise.all adiciona `listAttachmentsByMeeting(mid)`
  - Após `<MeetingForm />` renderiza `<AttachmentsSection attachments operationId meetingId={mid} />`

---

### T12: Typecheck + build + smoke

- [ ] typecheck + build verdes (rotas: 30 + 1 nova route handler = 31)
- [ ] Smoke local Acme/Core:
  - Upload PDF 2MB sem meeting → aparece em /operations/[id]
  - Upload PDF linkado à reunião Kickoff → aparece dentro do meeting edit, **não** na section da Op
  - Timeline mostra "📎 1" no item da Kickoff
  - Tentar upload 15MB → erro inline
  - Click filename → baixa
  - Delete → some da UI e Storage
- [ ] Screenshots: section vazia, section com 2 anexos, meeting edit com anexo, erro de tamanho

---

### T13: DATABASE_SCHEMA.md

- [ ] Adicionar `attachments` (11ª tabela)
- [ ] Menção ao bucket `attachments` na seção de tabelas
- [ ] Atualizar índice (10 → 11)
- [ ] Última análise = 2026-05-17

---

### T14: Issue + commit + PR + merge

---

## Pre-Impl

Pace: reto T1→T12, pauso antes do PR. ~60min.
