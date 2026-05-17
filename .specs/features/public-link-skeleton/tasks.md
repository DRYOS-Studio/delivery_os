# public-link-skeleton Tasks

**Design**: `.specs/features/public-link-skeleton/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: public_links + RLS + trigger + index)
  T2 (regenerate types)

Phase 2 — Foundations:
  T3 (queries/publicLinks.ts + queries/public.ts)
  T4 (utils/getBaseUrl)

Phase 3 — Actions:
  T5 (actions/publicLinks: create + revoke + touchPublicLinkAccess helper)

Phase 4 — Proxy:
  T6 (proxy.ts: adicionar /public em PUBLIC_PREFIXES)

Phase 5 — Components admin:
  T7 (PublicLinksSection + CreatePublicLinkForm + RevokePublicLinkButton + CopyButton)

Phase 6 — Public view:
  T8 (layout /public/[token]/layout.tsx)
  T9 (page /public/[token]/page.tsx + Public* components: Hero, FrentesList, Timeline, AttachmentsList)
  T10 (route handler /public/[token]/attachments/[aid]/download)

Phase 7 — Integrate admin:
  T11 (PublicLinksSection em /operations/[id]/page.tsx)

Phase 8 — Ship:
  T12 (typecheck + build + smoke)
  T13 (DATABASE_SCHEMA.md)
  T14 (issue + PR + merge)
```

Caminho crítico: T1→T2→T3→T5→T6→T8→T9→T10→T11→T12→T14. ~75-90min.

---

## Task Breakdown

### T1: Migration `<ts>_public_links.sql`

**Done when**:
- [ ] `CREATE TABLE public_links` (id, operation_id FK CASCADE, token UNIQUE default gen_random_uuid(), label, last_accessed_at, revoked_at, expires_at, created_at, updated_at)
- [ ] Index `idx_public_links_operation_created`
- [ ] RLS + policy authenticated_full
- [ ] Trigger updated_at
- [ ] COMMENT ON TABLE + COMMENT ON COLUMN last_accessed_at
- [ ] Aplicado via MCP

---

### T2: Regen types

- [ ] generate_typescript_types MCP
- [ ] `public_links` Row no types.ts

---

### T3: Queries

- [ ] `src/lib/db/queries/publicLinks.ts`:
  - `PublicLinkRow`, `PublicLinkListItem`, `PublicLinkResolved` types
  - `listPublicLinksByOperation(operationId)` — ORDER BY created_at DESC
  - `getPublicLinkByToken(token)` — usa `createAdmin()`; retorna {id, operationId, revokedAt} ou null
- [ ] `src/lib/db/queries/public.ts`:
  - Todos via `createAdmin()` (bypassa RLS); shape específico view pública
  - `getOperationPublicView(operationId)` — incluindo frentes (filtra archived_at NULL)
  - `listPublicMeetings(operationId)` — visibility=cliente
  - `listPublicDecisions(operationId)` — visibility=cliente
  - `listPublicAttachments(operationId)` — meeting_id IS NULL

---

### T4: Helper getBaseUrl

- [ ] `src/lib/utils/url.ts`:
  - `getBaseUrl()` server-only — usa `headers().get('host')` + protocol https/http

---

### T5: Actions publicLinks

- [ ] `createPublicLinkAction(operationId, formData)`:
  - Guard auth
  - label opcional do formData
  - INSERT (token gerado pelo DB default)
  - RETURNING id, token
  - revalidatePath /operations/[id]
- [ ] `revokePublicLinkAction(linkId)`:
  - Guard + SELECT pra obter operation_id
  - UPDATE revoked_at = now() (idempotente)
  - revalidatePath
- [ ] `touchPublicLinkAccess(linkId)`:
  - **Helper interno** (não exportar como action `'use server'`); reuse via importação direta
  - Função async simples; usa createAdmin; UPDATE last_accessed_at = now()
  - Silent fail (try/catch wraper void)

---

### T6: Proxy public path

- [ ] `src/proxy.ts`: adicionar `/public` em `PUBLIC_PREFIXES`
- [ ] Verificar matcher continua excluindo o esperado

---

### T7: Componentes admin

- [ ] `src/components/ui/CopyButton.tsx` — client; props { text, label? }; navigator.clipboard.writeText + "Copiado ✓" 2s
- [ ] `src/components/domain/CreatePublicLinkForm.tsx` — client; input label opcional + button "Gerar"; chama action; router.refresh
- [ ] `src/components/domain/RevokePublicLinkButton.tsx` — client; window.confirm + revokeAction + router.refresh
- [ ] `src/components/domain/PublicLinksSection.tsx` — server; props { links, operationId, baseUrl }:
  - Header h2 + Pill contagem
  - CreatePublicLinkForm inline
  - Lista cada link em Card: URL mono (font-mono) + label + datas + Pill Revogado + CopyButton + RevokeButton
  - Empty state

---

### T8: Layout /public/[token]/layout.tsx

- [ ] Sem sidebar; header simples com logo DRYOS
- [ ] Footer "Powered by DRYOS Delivery"
- [ ] Cream papel light (default)

---

### T9: Page + componentes Public*

- [ ] `src/app/public/[token]/page.tsx`:
  - `export const dynamic = "force-dynamic"`
  - UUID regex token; notFound se inválido
  - `getPublicLinkByToken(token)`; notFound se null OR revoked_at NOT NULL
  - `touchPublicLinkAccess(link.id)` — fire-and-forget (await mas try/catch silent)
  - Promise.all com 4 queries do public.ts
  - Renderiza 4 components Public*
- [ ] `PublicHero.tsx` server — nome Op + cliente + product_line + status pill (cream palette)
- [ ] `PublicFrentesList.tsx` server — lista compacta cada Frente: nome, pill cycle/domain, actionable_status, dias desde
- [ ] `PublicTimeline.tsx` server — merge meetings+decisions DESC, slice 8, items sem botões Edit (só conteúdo)
- [ ] `PublicAttachmentsList.tsx` server — lista anexos; download link aponta pra `/public/[token]/attachments/[id]/download`; **sem** DeleteButton

---

### T10: Route handler download público

- [ ] `src/app/public/[token]/attachments/[aid]/download/route.ts` GET:
  - Valida UUID token + aid
  - `getPublicLinkByToken(token)` → 404 se inválido/revoked
  - getAttachment(aid) → 404 se null
  - Valida `attachment.operation_id === link.operationId`
  - Se `attachment.meeting_id NOT NULL`: getMeeting; valida visibility='cliente'; senão 403
  - `createAdmin().storage.createSignedUrl(path, 300, { download: filename })`
  - 302 redirect

---

### T11: Integrar PublicLinksSection em /operations/[id]/page.tsx

- [ ] Promise.all adiciona `listPublicLinksByOperation(id)` + `getBaseUrl()`
- [ ] Renderiza `<PublicLinksSection links operationId baseUrl />` antes de FinanceCards
- [ ] Mantém placeholder "Credenciais" intocado

---

### T12: Typecheck + build + smoke

- [ ] typecheck + build verdes (rotas: 31 + 2 = 33)
- [ ] Smoke Acme/Core:
  - Gerar link com label "Cliente Acme"
  - Copiar URL → abrir em janela privada → carrega view pública
  - Frentes visíveis com actionable_status
  - Reunião "Kickoff" (visibility=cliente) aparece; reunião interna NÃO
  - Decisão visibility=cliente aparece; interna NÃO
  - Anexo da Op (sem meeting) listado; download funciona
  - Anexo de meeting cliente disponível pra download via /public/.../download
  - Revogar → recarregar URL → 404
  - last_accessed_at atualiza após visita
- [ ] Screenshots: section admin, view pública completa, 404

---

### T13: DATABASE_SCHEMA.md

- [ ] Adicionar `public_links` (12ª tabela)
- [ ] Atualizar índice
- [ ] Última análise 2026-05-17

---

### T14: Issue + commit + PR + merge

---

## Pre-Impl

Pace: reto T1→T12, pauso antes do PR. ~75-90min. Maior parte do tempo em T9 (4 components Public* + page).

**Riscos**:
- `force-dynamic` pode interagir com revalidatePath estranhamente — testar manualmente
- `touchPublicLinkAccess` em concurrent requests pode causar race trivial (ok — last write wins)
- View pública renderiza dados sensíveis; tripla validação no path do attachment download é crítica
