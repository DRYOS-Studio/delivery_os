# Superfície Pública — Design

> Spec: `./spec.md` (aprovado pós-gate). Issue: #129.
> Entregável: 1 migration pequena + mudanças TS verticais (resolver, queries públicas,
> rota de download, 1 action nova, 2 forms/listas). Tudo dentro dos patterns existentes.

## Decisões de arquitetura (ADR — vira AD-016 no STATE.md)

**D1 — Resolver do token vira o ponto único de validade: retorna `null` pra link inválido.**
`getPublicLinkByToken` passa a selecionar
`id, operation_id, revoked_at, expires_at, operation:operations!fk_public_links_operation_id(archived_at)`
e retorna **null** quando `revoked_at IS NOT NULL` OU `expires_at < now` OU
`operation.archived_at IS NOT NULL`. Página e rota de download checam só `!link`
(hoje a página duplica `link.revokedAt !== null` — remove). Consequências:
- `touchPublicLinkAccess` só roda com link válido (ordem garantida — AC do spec).
- A comparação de expiry acontece em JS com **`<` estrito** (`new Date(expiresAt).getTime()
  < Date.now()` — expirado só quando JÁ passou; igualdade exata = válido, casando o
  spec AC4 `≥ agora`). Sempre parsear AMBOS os lados pra epoch — ISO com offset não
  ordena lexicograficamente (gate MINOR-5).
- Embed unwrap defensivo (`T | T[] | null`, mesmo padrão de `public-report.ts`) no
  resolver — `.maybeSingle()` vale pra row pai, não muda o shape do embed (gate INFO-6).
- Quem precisar do motivo da invalidade no futuro (analytics) muda o retorno pra
  discriminated union — hoje ninguém precisa; null é o contrato mais simples.

**D2 — Migration mínima: enum + coluna, sem policy nova.**
`attachment_visibility ('interno','cliente')` + `attachments.visibility NOT NULL
DEFAULT 'cliente'` + `COMMENT ON COLUMN` (semântica: controla SÓ a superfície pública;
interno ≠ permissão — membros veem tudo). `attachments_scoped_update` **já existe**
(`20260526190001:158`, `can_see_operation`) — o toggle de visibility já é autorizado
no banco; nada a criar. Trade-off aceito: a policy UPDATE é row-level (membro pode
tecnicamente alterar qualquer coluna via API) — estado pré-existente, não ampliado
por este design; a action layer só expõe o toggle.

**D3 — Regra composta no público, 404 uniforme.**
- `listPublicAttachments`: + `.eq('visibility','cliente')` (continua `meeting_id IS NULL`).
- Rota `/public/[token]/attachments/[aid]/download`: após o fetch do attachment,
  `visibility !== 'cliente'` → **404**; o gate de meeting existente muda de 403 → **404**
  (oráculo de existência eliminado). Ordem dos checks na rota: token resolve (null → 404)
  → UUID do aid → attachment pertence à op → visibility do anexo → gate de meeting.
- Rota interna `/api/attachments/[id]/download`: intocada (visibility-agnostic).

**D4 — Fix do next moves dentro da query, shape de retorno intacto.**
`fetchUpcomingTasks`: embed vira `frente:frentes!fk_tasks_frente_id!inner(operation_id, archived_at)`
+ `.eq('frente.operation_id', operationId)` + `.is('frente.archived_at', null)`,
mantendo `.is('area_id', null)`, `.neq('status','done')`, `.gte('due_date', today)`,
`.order('due_date')`, `.limit(20)`. O filtro JS deixa de ser load-bearing mas **um guard
de 1 linha permanece no map** (`f.operation_id === operationId`, mesmo padrão de
`listPublicTeam`) — defesa em profundidade (gate Fase 2 MAJOR-1: sem ele, qualquer
regressão futura no embed `!inner`/alias converte erro inofensivo em leak cross-tenant
no relatório do cliente). Guard `r.due_date !== null` preservado. Caps preservados:
20/fonte no fetch, 4 combinados no display (`listPublicNextMoves`).

**D5 — Action nova + upload com visibility.**
- `setAttachmentVisibilityAction(attachmentId, visibility)`: `requireUserAction` →
  Zod (`uuid` + `z.enum(['interno','cliente'])`) → `createServer` UPDATE da coluna
  **terminando em `.select('id').maybeSingle()`** — null → `err('Anexo não encontrado.',
  'not_found')` (gate Fase 2 MAJOR-3: RLS que filtra a row vira 0-row update SEM erro
  no supabase-js; sem o select, a action retornaria `ok` num no-op e a UI daria toast
  de sucesso falso — mesma razão do pre-fetch em `deleteAttachmentAction`) →
  `revalidatePath` da página da operação → `ActionResult<{id}>`. RLS scoped já cobre
  autorização por operação (USING + WITH CHECK confirmados ao vivo).
- `uploadAttachmentAction`: validator ganha `visibility` (enum, default `'cliente'`);
  insert persiste. Form (`AttachmentUploadForm`): select com 2 opções, default
  `cliente` — mesmo padrão visual dos selects de visibility de meeting/decision.
- Listagens internas: `ATTACHMENT_FIELDS` + tipo `AttachmentListItem` ganham
  `visibility`; pill `Interno` (mesmo tratamento de `MeetingsDecisionsTimeline` — ícone
  `Lock`, pill neutra) nas duas listas (tab Anexos + anexos da meeting no edit);
  botão de toggle (interno↔cliente) por item chamando a action nova.

**D6 — Expiry visível na listagem de admin.**
`PublicLinksSection`: além do estado `Revogado` existente, derivar
`isExpired = link.expiresAt !== null && new Date(link.expiresAt).getTime() < Date.now()`;
pill "Expirado" (mesma variante visual de revogado) ou sufixo "· Expira em DD/MM"
quando futuro. **Precedência: Revogado > Expirado > Ativo** — nunca duas pills de
estado simultâneas (gate MINOR-5). Dado já chega mapeado — só renderização.

**D7 — Comportamento pré-existente registrado (gate MINOR-4):** anexo de meeting
`cliente` em meeting `cliente` é **baixável mas não listado** no público
(`listPublicAttachments` filtra `meeting_id IS NULL`; nenhuma superfície pública
renderiza link de anexo de meeting — hoje 0 anexos de meeting existem). Não é leak
nem é ampliado por este design; documentar em `docs/DATABASE_SCHEMA.md` (seção
attachments) pra não ser "redescoberto" na próxima auditoria. O teste do AC4 monta a
URL de download manualmente (não há UI que a exponha).

**Dispensa do coupling-analysis (1 linha):** diff vertical pequeno seguindo patterns
existentes (query→action→form→pill); nenhuma fronteira de módulo nova — o the-fool
cobre o risco real (superfície pública).

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<ts>_attachment_visibility.sql` | enum + coluna + COMMENT (D2) |
| `src/lib/db/types.ts` | regen via MCP |
| `src/lib/db/queries/publicLinks.ts` | D1 (resolver: select + embed + null se inválido) |
| `src/app/public/[token]/page.tsx` | usa resolver null-contract; remove check duplicado |
| `src/app/public/[token]/attachments/[aid]/download/route.ts` | D1 + D3 (visibility, 403→404) |
| `src/lib/db/queries/public.ts` | `listPublicAttachments` + visibility filter |
| `src/lib/db/queries/public-report.ts` | D4 (fetchUpcomingTasks) |
| `src/lib/db/queries/attachments.ts` | `ATTACHMENT_FIELDS` + `visibility` no tipo/mapper |
| `src/lib/validators/attachment.ts` | `visibility` no schema de upload + schema do toggle |
| `src/lib/actions/attachments.ts` | upload persiste visibility + `setAttachmentVisibilityAction` |
| `src/components/domain/AttachmentUploadForm.tsx` | select de visibility |
| `src/components/domain/AttachmentsSection.tsx` (+ item) | pill Interno + toggle |
| página de edit de meeting (lista de anexos) | pill Interno (+ toggle se o componente for compartilhado) |
| `src/components/domain/PublicLinksSection.tsx` | D6 (estado de expiração) |
| `docs/DATABASE_SCHEMA.md` | coluna + migration na tabela |

## Plano de validação (Fase 4)

1. Migration via `apply_migration` + re-run idempotente; `generate_typescript_types` → commit; `npx tsc --noEmit` (ou `npm run build`) verde.
2. **#3 fixture** — dados via SQL, **query sob teste pelo caminho REAL** (gate Fase 2
   MAJOR-2): fixture de 25 tarefas futuras na op B + 1 na op A inserida via SQL (com
   cleanup), e o teste chama a query de PRODUÇÃO — script supabase-js descartável em
   `/tmp` (service key) ou chamada REST com a select string exata — provando que a
   tarefa de A volta. SQL "equivalente" NÃO serve: os dois modos de falha de deploy
   (path de filtro errado → PostgREST erro → 500 em TODO link público; `!inner`
   perdido → leak silencioso) só existem na camada PostgREST.
3. **#6**: via SQL/REST — anexo `interno` não aparece em `listPublicAttachments` (query equivalente) ; download público de anexo interno → 404; de anexo cliente → 200; anexo cliente em meeting interna → 404.
4. **#7/#20** (dados reais, reversível): setar `expires_at` passado num link de teste → curl página pública → 404; restaurar → 200. Arquivar op de teste (ou simular com fixture) → 404 → restore → 200. Confirmar `last_accessed_at` NÃO mudou durante os 404s.
5. `/code-review` no diff + smoke build; UI E2E (upload com visibility, toggle, pill) → Vercel preview/prod (hand-off usuário, padrão do projeto).
6. `get_advisors` (security + performance) — sem lint novo.

## Riscos

- **PostgREST embed filter**: `.eq('frente.operation_id', ...)` filtra a TABELA PAI só com `!inner` — manter o hint de FK no alias (validado em PRs anteriores do repo, vide STATE sobre sintaxe de embed testada via REST).
- **Resolver null-contract**: a página hoje distingue `!link || link.revokedAt !== null`; consumidores do resolver são só página + rota (verificar com grep antes de mudar).
- **Enum novo em types**: código existente insere sem `visibility` (default cobre); nenhum `select('*')` quebra com coluna nova.
- **`touchPublicLinkAccess` de link expirado**: passa a não rodar — comportamento desejado (AC), sem consumidor de `last_accessed_at` que dependa do contrário.
