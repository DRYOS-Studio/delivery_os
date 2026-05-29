# Tasks: discord-notifications

**Spec:** [spec.md](./spec.md) · **Design:** [design.md](./design.md) · **Issue:** [#90](https://github.com/rafaelemeth/delivery_os/issues/90)

**Branch:** `feat/discord-notifications-mvp` · **PR body:** `Closes #90` · single PR.

**Pré-checks confirmados:**
- `createAdmin()` existe em `src/lib/db/client.ts` ✅
- `vercel.json` não existe — vou criar ✅
- SLA actions em `src/lib/actions/incidents.ts` — `createIncidentAction`, `updateIncidentAction`, `deleteIncidentAction` ✅

---

## T1 — Migration
- `supabase/migrations/20260529150001_discord_notifications.sql`:
  - ALTER `operations` ADD COLUMN `notification_webhook_url text` + CHECK length > 0.
  - CREATE TABLE `notifications_log` + FK + CHECKs + index dedup.
  - RLS: admin-only SELECT/INSERT.
  - COMMENT em tabela e coluna.
- Aplicar via MCP `apply_migration`.
- **Verificação:** `SELECT * FROM pg_policies WHERE tablename='notifications_log';` mostra 2 policies.

## T2 — Regen types
- MCP `generate_typescript_types` → `src/lib/db/types.ts`.
- **Verificação:** types incluem `notifications_log` + `operations.notification_webhook_url`.

## T3 — Types & payload
- `src/lib/notifications/types.ts` — `NotificationEvent`, `SubjectKind`, `*Context`, `NotificationPayload`.
- `src/lib/notifications/payload.ts` — `buildFrenteStalePayload(...)`, `buildSlaBreachPayload(...)`.
- **Verificação:** typecheck.

## T4 — Dispatcher + dedup helper
- `src/lib/notifications/dispatcher.ts` — `dispatch(input)` com timeout 10s + log na tabela.
- `src/lib/notifications/dedup.ts` — `alreadySent({ operation_id, event_type, subject_id, windowMs })`.
- **Verificação:** typecheck.

## T5 — Detector frente_stale
- `src/lib/notifications/detectors/frente-stale.ts`:
  - `listStaleFrentesPendingNotification(supabase)` — JOIN ops + LEFT filter notifications_log 24h window.
- **Verificação:** typecheck. Smoke SQL: forçar frente stale e rodar query mental.

## T6 — Detector sla_breach
- `src/lib/notifications/detectors/sla-breach.ts`:
  - `detectSlaBreach(incident, operation)` — função pura.
  - `listOpenSlaIncidentsPendingNotification(supabase)` — itera todos abertos + dedup.
- **Verificação:** typecheck + unit-mental dos casos (responded null > response_hours; resolved null > resolution_hours).

## T7 — Cron route
- `src/app/api/cron/notifications/route.ts`:
  - GET handler com auth (CRON_SECRET + x-vercel-cron).
  - Roda detector stale + detector sla, dispara cada um.
  - Retorna JSON `{ stale: {...}, sla: {...} }`.
- `vercel.json` novo: cron schedule `0 11 * * *` (08:00 BRT).
- **Verificação:** typecheck. Curl manual (com header) num build local não dá pra testar cron real, mas pode chamar o endpoint.

## T8 — Sync SLA breach na action
- Modificar `updateIncidentAction` em `src/lib/actions/incidents.ts`:
  - Após o update, carregar incident + operation atualizados.
  - Rodar `detectSlaBreach`.
  - Se breach + URL configurada + dedup OK → `void dispatch(...)` fire-and-forget.
- **Verificação:** typecheck. Action retorna ok normal sem esperar dispatch.

## T9 — UI form field
- `OperationForm`: nova seção "Integrações" com input `notification_webhook_url` (type url).
- Validator `lib/validators/operation.ts`: campo opcional + `.url()` + transform `""→null`.
- **Verificação:** typecheck. Form renderiza no `/operations/[id]/edit`.

## T10 — Payload v1 doc
- `.specs/features/discord-notifications/payload-v1.md` — pro time do n8n:
  - shape JSON com exemplo populado de cada evento
  - campos obrigatórios vs opcionais
  - sugestão de mapeamento pro embed Discord (cor por severidade, link clicável)
- **Verificação:** doc lê.

## T11 — Env var + ROADMAP/STATE
- `.env.local.example` ganha `CRON_SECRET=`.
- `ROADMAP.md`: marcar `discord-notifications` COMPLETE com PR #N.
- `STATE.md`: current work atualizado.
- DS SKILL nota curta em "Integrações" sobre o campo no form.
- `docs/DATABASE_SCHEMA.md`: adicionar `notifications_log` + linha no índice por módulo.
- **Verificação:** docs lê.

## T12 — Smoke + PR
- Build + typecheck verde.
- Commit em inglês, push.
- `gh pr create` com `Closes #90`.
- PR body inclui:
  - Resumo do escopo
  - Passos de validação manual (precisa de URL `webhook.site` + frente forçada stale)
  - Nota: cron só roda em prod (Vercel)
  - Env var `CRON_SECRET` precisa ser setada no Vercel project

---

## DoD

- [ ] Migration aplicada (column + table + RLS)
- [ ] Types incluem novos campos
- [ ] Dispatch loga sempre (sucesso/falha) sem quebrar fluxo
- [ ] Cron endpoint roda com auth, retorna contagem
- [ ] Server Action SLA dispara sync com fire-and-forget
- [ ] Form admin tem campo URL na seção Integrações
- [ ] payload-v1.md pronto pro time n8n
- [ ] ROADMAP/STATE/SCHEMA/SKILL atualizados
- [ ] Build + typecheck verde
- [ ] #90 fechada via PR
