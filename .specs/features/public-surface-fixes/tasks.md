# Superfície Pública — Tasks

> Design: `./design.md` (gate ✅). Issue: #129. Branch: `feat/public-surface-fixes`.

## T1 — Migration `attachment_visibility` + types + doc
Enum `attachment_visibility ('interno','cliente')` + `attachments.visibility NOT NULL DEFAULT 'cliente'` + `COMMENT ON COLUMN`. Aplicar via MCP, re-aplicar (idempotência), `generate_typescript_types` → commit. `docs/DATABASE_SCHEMA.md`: coluna, linha da migration, nota D7 (anexo de meeting baixável-mas-não-listado, pré-existente).
**Verificação:** re-run sem erro; `types.ts` contém `attachment_visibility`; anexo existente = `cliente` no banco.

## T2 — Resolver null-contract + enforcement (D1, #7, #20)
`getPublicLinkByToken`: select + embed `operation:operations!fk_public_links_operation_id(archived_at)` (unwrap defensivo), retorna `null` se revogado OU `expires_at < now` (epoch, `<` estrito) OU op arquivada. `page.tsx` e download route checam só `!link` (remove check duplicado de `revokedAt`).
**Verificação:** grep confirma 2 consumidores atualizados; touch só roda pós-resolve válido; `tsc` verde.

## T3 — `fetchUpcomingTasks` server-side filter (D4, #3)
Embed `frente:frentes!fk_tasks_frente_id!inner(operation_id, archived_at)` + `.eq('frente.operation_id', operationId)` + `.is('frente.archived_at', null)` antes do limit; guard de 1 linha permanece no map (defesa em profundidade).
**Verificação:** T7 fixture pelo caminho real PostgREST.

## T4 — Filtros públicos de visibility (D3, #6)
`listPublicAttachments` + `.eq('visibility','cliente')`. Download route: ordem token → UUID → pertence à op → `visibility !== 'cliente'` → 404 → gate de meeting (403 vira **404**).
**Verificação:** T7 testes de download; nenhum 403 restante na rota pública.

## T5 — Camada de dados/ações de visibility (D5)
`ATTACHMENT_FIELDS` + `visibility` no tipo `AttachmentListItem` e mapper. `validators/attachment.ts`: `visibility` no upload (default `cliente`) + schema do toggle. `uploadAttachmentAction` persiste; nova `setAttachmentVisibilityAction` com `.select('id').maybeSingle()` → `not_found` se null.
**Verificação:** `tsc` verde; action retorna `not_found` pra uuid inexistente (teste manual via SQL/inspeção do código).

## T6 — UI (D5/D6)
`AttachmentUploadForm`: select de visibilidade (default `cliente`). Pill `Interno` (padrão `MeetingsDecisionsTimeline`) + botão toggle nas DUAS listas internas (tab Anexos da operação; anexos da meeting no edit). `PublicLinksSection`: pill/sufixo de expiração, precedência Revogado > Expirado > Ativo.
**Verificação:** build verde; DS respeitado (pill canônica, Lucide, sem cor nova).

## T7 — Validação integrada
(a) Fixture #3: 25 tasks futuras op B + 1 op A via SQL (cleanup garantido), query de PRODUÇÃO via script supabase-js/REST com a select string exata → tarefa de A volta. (b) #6: anexo interno some da lista pública (query real) e download → 404; cliente → 200; cliente em meeting interna → 404 (URL manual). (c) #7/#20: `expires_at` passado → página+download 404, `last_accessed_at` intocado, restore → 200; mesmo ciclo com archive/restore da op. (d) `npm run build` ou `tsc --noEmit`. (e) `get_advisors` ×2 sem lint novo.
**Verificação:** todos os observáveis acima registrados no PR.

## T8 — PR
Commit(s) imperativo en, PR `Closes #129` com docs listados + hand-off E2E de UI (upload com select, toggle, pill — Vercel). Gate `/code-review` no diff.
**Verificação:** PR aberto, review sem finding de correção pendente.

---
**Gate Fase 3 (auto-revisão):** T1 precede T2/T4/T5 (coluna+types); T2–T5 independentes entre si após T1; T6 depende de T5; T7 depende de tudo; cada task tem observável próprio. Atômicas: T2 toca 3 arquivos do mesmo contrato; T5 é a fatia dados→action; T6 só UI. ✅
