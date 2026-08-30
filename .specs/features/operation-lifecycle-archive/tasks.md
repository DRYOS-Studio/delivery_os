# operation-lifecycle-archive Tasks

Ordem obrigatória: T1→T3 antes de qualquer TS (sem `gen:types` da branch, nada compila).
Cada task tem critério de verificação executável. AC citados por id (`./spec.md`).

## Bloco A — Banco

**T1. Migration 1 — enum terminal**
`ALTER TYPE … ADD VALUE IF NOT EXISTS 'concluida' | 'cancelada'` + `COMMENT ON COLUMN`.
→ **verificar:** na branch, `SELECT unnest(enum_range(NULL::operation_status))` retorna 6 valores
(`AC1`). Em prod **não** aplicar ainda — `ADD VALUE` não tem inverso.

**T2. Branch Supabase + `gen:types` da branch**
`create_branch` → aplicar T1 → **primeira chamada verifica `current_user`, `rolbypassrls` e
`pg_has_role(current_user,'authenticated','MEMBER')`** antes de confiar no papel.
→ **verificar:** a captura desses 3 valores entra no PR. Se `rolbypassrls` for true ou o `SET ROLE`
falhar, o bloco C do plano de prova cai para o script Node — decidir aqui, não na hora.

**T3. Migration 2 — 8 funções + 1 trigger**
3 cascatas, `restore_operation`, `restore_frente`, 2 de impacto, `tg_revoke_links_on_terminal()`;
todas `SECURITY INVOKER` + `SET search_path = public` + `is_admin()` + `REVOKE`/`GRANT` +
`COMMENT ON FUNCTION`.
→ **verificar:** `AC5`, `AC5b`, `AC6`, `AC7`, `AC8`, `AC10`, `AC12`, `AC16`, `AC20` na branch, sob o
papel apurado em T2. `AC15` idem. Pós-condição do `AC5` escrita como *nenhuma alocação de A1
satisfaz `end_date IS NULL OR end_date > current_date`*.

**T4. Fixture da branch**
2 `auth.users` → 2 `profiles` (admin + member) → `operation_members` → Cliente A (A1 `concluida`,
A2 `em_operacao` com link) e Cliente B (B1 com link). Alocações: 3 abertas, 1 fechada no passado,
1 com `end_date` futuro, 1 com `start_date` futuro.
→ **verificar:** `archive_operation_impact(A1)` = `{2, 6}`. Se der `{2,4}`, o fixture não tem as
duas alocações que separam os predicados — refazer antes de seguir.

**T5. Prova de `AC9` pelo caminho real**
Script Node com `@supabase/supabase-js`: sessão do member chama as 8 RPCs → `42501` nas 8; sessão
do admin → sucesso.
→ **verificar:** 8 recusas e 8 sucessos, capturados. **Não** aceitar prova por SQL — o papel do MCP
bypassa RLS.

## Bloco B — TypeScript núcleo

**T6. `src/lib/utils/operation-status.ts`**
Mapa `Record<Database["public"]["Enums"]["operation_status"], StatusMeta>` + `ACTIVE_STATUSES`,
`TERMINAL_STATUSES`, `isActiveStatus`, `statusLabel`, `statusPillVariant`, `selectableStatuses`.
→ **verificar:** `AC2` — adicionar valor ao enum em `types.ts` e confirmar que o `TS2741` aponta
**este** arquivo; reverter.

**T7. Queries — os 19 pontos de A3 + C6**
Predicados `OPERACAO_ATIVA` / `OPERACAO_VISIVEL`; `includeArchived` (D7); ponto 16
(`archivedOperations` deixa de ser complemento); pontos 17/18 (`area-grants`); ponto 19
(`getActiveOperations` com `scope`).
→ **verificar:** `AC3`, `AC11` (3 ramos), `AC11b` (margem coerente), `AC11c` via script Node com
sessão de admin.

**T8. Actions**
Remover pré-checks `actions/frentes.ts:159-165` e `actions/operations.ts:166-172`; archive/restore
→ `rpc`; mapa de erro com ramo default (`42501`/`23514`/`23515`/`P0002`/`P0004`/`PGRST202`/`22P02`);
guard de admin para escrever status terminal; **deletar os 2 órfãos** (`frenteHasActiveAllocations`,
`operationHasActiveFrentes`).
→ **verificar:** `npm run typecheck` limpo e `grep -rn "frenteHasActiveAllocations\|operationHasActiveFrentes" src/` → 0.

## Bloco C — UI

**T9. Forms** — botão incondicional + `disabled` + motivo + `isAdmin` nos três; `allowedStatus` de
`selectableStatuses(mode)`.
→ **verificar:** `AC12b` (conjunto exato por modo), `AC13`, `AC14`, `AC14c` com o app rodando;
`grep -rn 'canArchive &&' src/components/domain/` → 0.

**T10. Impacto na confirmação** — action com `requireAdminAction` + `createServer()`, chamando as 2
RPCs; `window.confirm` multi-linha.
→ **verificar:** `AC12` — o diálogo mostra `{2, 6}` no fixture.

**T11. Mapas de label** — os 4 passam a consumir `statusLabel`/`statusPillVariant`.
→ **verificar:** `npm run typecheck` limpo (hoje os 4 quebram com o enum novo).

**T12. Seções "Arquivados"** — `/clients`, `/operations` (com a cláusula do Cliente) e detalhe da
Operação (Frentes).
→ **verificar:** `AC17` com o app rodando.

**T13. Tarefas** — os 4 call-sites com `operations!fk_tasks_operation_id!inner`.
→ **verificar:** `AC19` — tarefa de Operação arquivada some das 4 superfícies **e** tarefa de área
continua aparecendo. Sem o `!inner` o filtro é no-op silencioso: conferir que remover o `!inner`
faz o AC reprovar.

## Bloco D — Fechamento

**T14. Doc-sync** — `DATABASE_SCHEMA.md` (:98, :390, :677 + 8 funções), `prd.md`, `STATE.md`
(AD-018), `CLAUDE.md` (invariante: `archived_at` só pela função de cascata).
→ **verificar:** cada arquivo citado tem diff no PR.

**T15. Deploy** — M1+M2 em prod **só após aprovação do PR** e imediatamente antes do merge;
`gen:types` re-rodado contra prod; `get_advisors security`.
→ **verificar:** advisors sem lint novo; `AC18` (arquivar A1 **pela UI**) refeito contra prod
limpo.
