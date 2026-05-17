# attachments Specification

## Problem Statement

A camada "vivos" da sem 03 (briefing + meetings/decisions) registrou narrativa e contexto temporal. Falta o **suporte físico**: arquivos de referência que dão substrato pra decisões.

Casos concretos do MVP:
- Reunião de kickoff gera ata em PDF. Hoje vai pro Discord e some.
- Briefing referencia um diagrama de arquitetura. Sem anexo, virou descrição textual no campo `contexto`.
- Cliente manda contrato assinado, brief original, comprovante de pagamento → vivem no email/Drive, fora do sistema.
- Princípio do menor privilégio (Inv. 11): path do Storage prefixado com `operation_id/` permite RLS específica por Operação no futuro.

Esta feature traz Storage funcional + tabela `attachments` no DB. Não tenta indexar conteúdo nem substituir Drive — só guarda a referência viva.

## Goals

- [ ] Operações podem ter anexos (lista + upload + remover); cada anexo é um arquivo no Supabase Storage com metadata em `attachments`
- [ ] Reuniões também podem ter anexos (anexo da ata, slides) — via FK opcional `meeting_id`
- [ ] Storage bucket `attachments` privado; path no formato `<operation_id>/<uuid>-<filename>` pra preservar padrão de prefixo (Inv. 11)
- [ ] Section inline em `/operations/[id]` lista anexos da Operação (excluindo os linkados a meeting — esses aparecem inline em /meetings/[mid]/edit ou via link)
- [ ] Form de edit da Reunião ganha sub-section de anexos
- [ ] Limite 10MB por arquivo; sem whitelist de MIME no MVP
- [ ] **NÃO substituir** placeholder "Credenciais" — mantém intocado

## Out of Scope

- **Anexo em Frente / Decisão** — operation_id + meeting_id cobrem 80% do uso. Outros virão se demanda surgir.
- **Versionamento de anexo** — substituir arquivo = remove + upload de novo.
- **Preview inline de PDF/imagem** — só Download. Browser cuida se quiser abrir inline.
- **Compartilhamento externo (signed URL pra cliente)** — vem com `public-link-skeleton`. MVP: só authenticated.
- **Pasta/hierarquia** — flat list por Operação.
- **Tags / categorias** — campo `description` text livre cobre.
- **Drag-and-drop reorder** — exibição ordenada por `created_at DESC`; ordem manual não.
- **Whitelist MIME** — qualquer extensão. Limite só de tamanho.
- **Upload progress bar visual rica** — `disabled + "Enviando..."` durante submit basta no MVP.
- **Multi-upload simultâneo** — 1 arquivo por submit. Múltiplos = múltiplos submits.
- **Edit metadata após upload** — só `description` editável; substituir arquivo = remove+upload.
- **Soft delete** — hard delete (storage + DB). Princípio Operação arquivada → cascade decide o destino dos anexos.

---

## User Stories

### P1: Tabela `attachments` + Storage bucket ⭐ MVP

**User Story**: Como admin, quero subir um arquivo associado a uma Operação (opcionalmente a uma Reunião) e que ele fique acessível pra qualquer authenticated.

**Why P1**: Sem schema + storage, nada acontece.

**Acceptance Criteria**:

1. Bucket `attachments` privado criado via SQL `storage.buckets`
2. Storage policies (RLS): authenticated read + insert + delete; sem update (substituir = delete+upload)
3. Tabela `attachments`:
   - id uuid PK
   - operation_id uuid NOT NULL FK CASCADE
   - meeting_id uuid FK SET NULL (opcional)
   - storage_path text NOT NULL (formato `<operation_id>/<uuid>-<filename>`)
   - filename text NOT NULL (display name, com extensão)
   - mime_type text NOT NULL
   - size_bytes bigint NOT NULL CHECK > 0 AND <= 10485760 (10MB)
   - description text (opcional)
   - uploaded_by uuid FK auth.users SET NULL
   - created_at, updated_at timestamptz
4. RLS authenticated full crud + index (operation_id, created_at DESC)
5. Trigger updated_at em attachments

---

### P1: Upload action ⭐ MVP

**User Story**: Como admin, escolho um arquivo + descrição + (opcional) reunião → action faz upload no Storage e insere registro.

**Acceptance Criteria**:

1. Server action `uploadAttachmentAction(operationId, formData)`:
   - Guard auth → capture user.id
   - Lê `file: File` do FormData
   - Valida: file existe, size > 0 e <= 10MB, filename presente
   - Gera `storage_path = <operationId>/<crypto.randomUUID()>-<sanitizedFilename>`
   - Upload via `supabase.storage.from('attachments').upload(path, file)` — se falha, retorna dbErr
   - Insert em `attachments` com metadata + uploaded_by
   - Se DB insert falha, fazer **best-effort cleanup**: tenta `storage.remove([path])` mas ignora erro do cleanup
   - revalidatePath
   - ok({ id })
2. `deleteAttachmentAction(attachmentId)`:
   - Guard + getAttachment
   - DELETE no DB primeiro (referência some)
   - `storage.remove([storage_path])` (ignora erro — storage órfão é problema menor)
   - revalidatePath

---

### P1: AttachmentsSection na page da Operação ⭐ MVP

**User Story**: Em /operations/[id], abaixo da timeline de reuniões/decisões, vejo lista de anexos vinculados à Op (não-meeting), com upload inline.

**Why P1**: Sem UI não há feature.

**Acceptance Criteria**:

1. Server section component que lista `attachments` da Operação onde `meeting_id IS NULL`
2. Header: h2 "Anexos" + Pill contagem + Button "Enviar arquivo" abrindo um inline form (client component) com file input + description + submit
3. Empty state: card "Nenhum anexo. Suba um arquivo pra começar."
4. Cada linha: ícone por MIME (PDF, image, doc, file genérico), filename (link de download via signed URL on-demand), description, tamanho formatado, autor, data relativa, botão "×" (window.confirm + delete action)
5. Download via Link `/api/attachments/[id]/download` — Route Handler que gera signed URL com TTL curto (5min) e redireciona

---

### P1: Anexos linkados a Reunião ⭐ MVP

**User Story**: No edit da Reunião, posso anexar arquivos específicos a ela (ata, slides).

**Acceptance Criteria**:

1. MeetingForm `/meetings/[mid]/edit` ganha section adicional `<MeetingAttachmentsSection meetingId operationId attachments />`
2. Mesma UI da AttachmentsSection da Operação, mas passa `meetingId` na action de upload
3. Timeline em /operations/[id] (componente já existe) ganha pequeno badge "📎 N" nos meeting items que têm anexos
4. Filter: AttachmentsSection da Operação **exclui** anexos com `meeting_id NOT NULL`

---

### P1: Limite 10MB + erro inline ⭐ MVP

**User Story**: Tentando subir arquivo > 10MB, vejo erro claro sem submit.

**Acceptance Criteria**:

1. Validação client (FileReader OU file.size diretamente no JS) antes de submit
2. Validação server idem (CHECK no DB é última linha)
3. Erro UI: "Arquivo maior que 10MB"

---

### P2: Edit description sem trocar arquivo

Pula MVP. Substituir descrição = remover + reupload com nova descrição.

---

### P3: Preview inline de imagem/PDF

Pula. Download é suficiente.

---

## Edge Cases

- **Upload sem session** → guard rejeita; action retorna err unauthenticated.
- **Filename com chars exóticos / espaços** → sanitiza (replace `/[^\w.\-]/g` por `_`) antes de compor path. Display preserva original.
- **Mesmo filename subido 2x** → ok, UUID prefixa o path. Cada upload tem path único.
- **DB insert falha após upload** → action tenta `storage.remove` best-effort; órfão raro é aceito (pequeno custo + auditoria futura limpa).
- **Storage remove falha** → DB delete já aconteceu; órfão é aceito (mesmo princípio).
- **Operação arquivada (`archived_at NOT NULL`)** → bloquear upload novo via redirect na page; download/list permanece.
- **CASCADE de Operation deletada** → DB derruba attachments; Storage **não** é limpo automaticamente (sem trigger). Aceitável no MVP — assume Op nunca é deletada de fato (só archived).
- **meeting_id de outra Operation** → action valida que meeting.operation_id === operationId; senão err `invalid_meeting`.
- **File vazio (0 bytes)** → CHECK rejeita; UI mostra erro.

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] Acme/Core: upload de PDF (2MB) sem meeting → aparece em AttachmentsSection
- [ ] Upload de outro PDF linkado à reunião "Kickoff" → aparece **dentro** do meeting edit, **não** na section da Operação
- [ ] Timeline mostra "📎 1" no item da reunião com anexo
- [ ] Tentar upload 15MB → erro inline
- [ ] Download via link → arquivo baixa corretamente
- [ ] Remover anexo → some da UI e do Storage (verificar via dashboard)
- [ ] Screenshots: section vazia, section com 2 anexos, meeting edit com anexos, erro de tamanho

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Polimórfico ou tabela única | Operation + Meeting (operation_id NOT NULL + meeting_id NULL) | Cobre 80%; sem complexidade de discriminador |
| Storage path format | `<operation_id>/<uuid>-<sanitized_filename>` | Inv. 11 (prefixo por Operação); UUID evita colisão; filename ajuda debug |
| Storage policy | Authenticated full read/write/delete | Sem profiles ainda; refinar depois |
| MIME whitelist | Não | User sabe o que sobe; CHECK só em size |
| Tamanho máx | 10MB (10485760 bytes) | Cobre PDF/imagem/doc; vídeo bloqueado |
| Download | Signed URL via Route Handler `/api/attachments/[id]/download` | TTL curto (5min); não expõe storage URL direto |
| Upload progress | Não | "Enviando..." disable basta |
| Multi-upload | Não | 1 por submit |
| Substituir arquivo | Delete + upload novo | Sem versão histórica |
| Edit metadata | Só description (ou nem isso — pula MVP) | Reupload é caminho |
| Hard delete | Sim | CASCADE de Op + best-effort storage cleanup |
| Storage orphans | Aceitos | Limpeza periódica pode entrar v2; raros |
| Polimorfismo Frente/Decisão | Não | Pula até demanda real |
| Created_by FK | auth.users SET NULL | Preserva registro se user removido |
| Substituir placeholder "Credenciais" | NÃO | Mantém intocado por solicitação explícita |
