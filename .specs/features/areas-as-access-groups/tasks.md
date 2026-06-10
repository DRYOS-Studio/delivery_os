# Areas as Access Groups — Tasks

**Spec**: `spec.md` · **Design**: `design.md`

Agrupadas por PR. Cada task tem critério de verificação explícito. Dependência: PR1 → PR2 → PR3.

---

## PR1 — Backend / scope (migração + RLS + refactor de queries)

Issue própria. Critério global: tarefas de **entrega** 100% iguais; tarefa de área funciona via `area_id`; concessão respeita RLS via SQL; `npm run build` verde; `get_advisors` sem novo warning.

### T1.1 — Migration M-A: tabelas `areas` + `area_clients` + `area_operations`
- DDL das 3 tabelas (design §Data Models), FKs nomeadas, índices (`area_clients(area_id)`/`(client_id)`, `area_operations(area_id)`/`(operation_id)`), `COMMENT ON TABLE`.
- Seeds: `(slug='cs',name='CS')`, `(financeiro,Financeiro)`, `(juridico,Jurídico)` idempotentes (`ON CONFLICT (slug) DO NOTHING`).
- RLS: `areas` → `areas_admin_all` (admin CUD) + `areas_authenticated_select` (todos leem catálogo). `area_clients`/`area_operations` → admin all + select admin-only.
- **Verificação:** `SELECT * FROM areas` retorna 3 seeds; `\d areas` mostra RLS on; inserir area_client como non-admin falha.

### T1.2 — Migration M-B: enum `task_area` → FK `area_id` (ordem RT-M3)
- Seguir os 10 passos do design §M-B com `IF EXISTS`/`IF NOT EXISTS` em tudo destrutivo.
- Drop nominal das policies (lista RT-B2); preservar guard `kind='internal'` na `task_assignees_scoped_insert`.
- Drop+recreate funções: `area_can_reach_operation`, `is_area_granted`, `user_in_area`, `can_read_operation` (reescrita sem ramo de tasks), `can_see_task` (reescrita). Drop `can_see_area(task_area)`.
- `tasks.area`→`area_id` (FK, CHECK XOR sobre area_id, trigger imutável `OF area_id`, índices novos); `profile_areas.area`→`area_id` (PK nova); `enforce_task_parent` usa `NEW.area_id`.
- **Verificação:** `DO`-block de asserção (entrega sem frente ✗; área com frente ✗; área com parent ✗; trocar area_id ✗; backfill casou enum↔slug) com `RAISE EXCEPTION 'ASSERTIONS_PASSED'` + rollback. `get_advisors` security limpo.

### T1.3 — Migration M-C: RLS de grants nas tabelas operation-scoped
- Aplicar o mapa de RLS do design: `R` em frentes/quick_wins/villains/narratives/sla/briefings/allocations/briefing_versions/quick_win_impacts/clients/persons(internal); `R+vis` em decisions/meetings/meeting_attendees (predicado completo com `visibility='cliente'`); tasks (regra de tarefa); `operations` (can_read_operation já cobre). `diagnostics`/`operation_costs`/`public_links`/`attachments`/`profiles` **inalteradas**.
- **Verificação:** `DO`-block: criar área X, conceder cliente A, simular user da área (set `request.jwt.claims`) → vê operações de A, vê decisão `cliente` mas não `interno`, não vê diagnostics/costs/public_links. Rollback. Contagem de policies pós = esperado.

### T1.4 — `gen:types` + refactor `area`→`area_id` em queries/actions
- `npm run gen:types` (MCP). Atualizar `tasks.ts`, `dashboard.ts:78`, `public-report.ts:88`, `public.ts`, `actions/tasks.ts`, `actions/profile-areas.ts`, `validators/task.ts`, `utils/areas.ts` (`TaskArea` vira `{id,slug,name}`). Checklist RT-B1+.
- **Verificação:** `grep -rn '"area"' src/lib/db src/lib/actions` vazio; `npx tsc --noEmit` + `npm run build` verdes.

### T1.5 — Queries novas de áreas e concessões
- `queries/areas.ts` (`listAreas`, `listAreasWithCounts`), `queries/area-grants.ts` (`listAreaClients/Operations`, `listGrantableClients/Operations`), `profile-areas.ts` por `area_id`.
- **Verificação:** type-check; chamar `listAreas()` numa page server retorna seeds.

### T1.6 — Docs (contrato)
- Invariante 15 do CLAUDE.md (`area`→`area_id`, gating área+concessão). `docs/DATABASE_SCHEMA.md` (+3 tabelas, colunas novas, contagem/data). Mencionar no corpo do PR.
- **Verificação:** docs refletem o schema novo; `Closes #<issue>`.

---

## PR2 — Admin de áreas (CRUD + concessões)

Depende de PR1. Critério: admin cria/arquiva área e concede clientes/operações pela UI.

### T2.1 — Actions de áreas
- `actions/areas.ts`: `createAreaAction`/`updateAreaAction`/`archiveAreaAction` (requireAdmin, slug normalizado lower+sem acento+kebab, 23505→err tipado).
- **Verificação:** criar "Tráfego" ok; criar "trafego"/"Tráfego " → mesmo slug → 23505 tratado (não 500).

### T2.2 — Actions de concessão
- `actions/area-grants.ts`: grant/revoke client + grant/revoke operation (requireAdmin, insert idempotente, revalidatePath).
- **Verificação:** conceder cliente 2x → ok idempotente; revogar → some.

### T2.3 — UI hub `/admin/areas` + detalhe `[areaId]`
- `page.tsx` lista áreas (criar/arquivar) com contagem de membros/concessões. `[areaId]/page.tsx`: membros (`ProfileAreasManager` por área), concessões cliente (`MultiSelect`), concessões operação (`MultiSelect`). `AreaForm`, `AreaGrantsManager`.
- **Verificação:** `/verify` (Vercel): admin cria área, atribui membro, concede cliente; recarrega e persiste.

---

## PR3 — Painel read-only + tarefa de área dinâmica

Depende de PR1/PR2. Critério: membro de área vê painel concedido read-only; controles de escrita ausentes; tarefa de área usa áreas do banco.

### T3.1 — Read-only no painel de operação
- Helper `getOperationAccess(opId)` → `{ canWrite: boolean }` (canWrite = admin || operation_member). Server components escondem botões "Nova frente/Editar/Apagar" quando `!canWrite`.
- **Verificação:** `/verify`: membro de área (não-membro) abre op concedida → vê dados, sem botões de escrita; tentativa de action → erro de guard/RLS.

### T3.2 — `AreaTaskForm` + selects com áreas dinâmicas
- Form de tarefa de área lê options de `listAreas()` (não enum). `AreaTasksSection`/`MyTaskListItem` mostram `area.name`.
- **Verificação:** criar tarefa de área "Tráfego" (área nova) numa op concedida; pill mostra "Tráfego".

### T3.3 — Decisão/reunião: confirmar não-vazamento de `interno` pra área
- Conferir queries de decisões/reuniões do painel não forçam nada que contrarie a RLS; teste E2E.
- **Verificação:** `/verify`: membro de área vê decisão `cliente`, não vê `interno`.

### T3.4 — Docs finais
- `dryos-design-system` se houver componente novo (AreaGrantsManager). STATE.md AD-014 já gravado; marcar feature COMPLETE no fim.
- **Verificação:** docs atualizados; PR body lista o que mudou.
