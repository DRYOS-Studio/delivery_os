# Feature: operation-members

**Issue:** [#80](https://github.com/rafaelemeth/delivery_os/issues/80)
**Status:** SPEC
**Created:** 2026-05-26

---

## Objetivo

Restringir visibilidade do app por Operação. Hoje qualquer usuário com `profiles.role='member'` enxerga todas as Operações, Clientes, Pessoas e Painel. Passar a:

- **Member:** vê apenas Operações em que foi explicitamente atribuído por um Admin.
- **Admin:** vê tudo (bypass do filtro).

Cascata pra todas as tabelas-filhas da Operação + Clientes/Pessoas relacionados + Painel.

## Por que

Onboarding de membros externos (ex: Gabriel, contratado pra trabalhar em 1-2 Operações) sem expor a carteira inteira da DRYOS. Princípio do menor privilégio. Também prepara o terreno pra `Visualizador externo` (token), que reusa parte do mecanismo.

## Personas

- **Admin (Gabriela, Rafael):** mantém o controle de quem vê o quê. Atribui/desatribui members às Operações. Vê tudo.
- **Member (Gabriel, futuros contratados):** vê só o que foi explicitamente concedido. Default = vê nada.

## Casos de uso

### UC1 — Admin atribui member a uma Operação
Admin entra em `/operations/[id]/settings/members`, busca por email/nome, clica em "Adicionar". Member passa a ver aquela Operação no `/operations` e nos lugares cascateados.

### UC2 — Admin remove member de uma Operação
Mesma página, clica no "Remover" do membro. Member perde acesso imediato (próxima query já filtra).

### UC3 — Member faz login pela primeira vez
Member com 0 atribuições vê:
- `/operations` → lista vazia com mensagem "Você ainda não foi atribuído a nenhuma Operação. Procure um admin."
- `/clients` → lista vazia, mesma mensagem.
- `/persons` → lista vazia.
- `/` (painel) → KPIs zerados ou um estado vazio dedicado.
- Catálogos (vilões/produtos/quick-wins) — visíveis (são globais).
- Tenta acessar `/operations/<id>` que não é dele → 404 (não 403 — não revela que existe).

### UC4 — Member tenta editar Operação que não é dele via API direta
RLS bloqueia. Server Action retorna `err('Operação não encontrada.', 'not_found')` — sem distinguir de "não existe".

### UC5 — Admin promove member existente a admin
`profiles.role = 'admin'`. Member passa a ver tudo (mesmo sem `operation_members`).

## Requisitos funcionais

### RF1 — Modelo
- Tabela `operation_members(profile_id uuid FK profiles, operation_id uuid FK operations, created_at timestamptz default now(), created_by uuid FK profiles)`.
- UNIQUE(profile_id, operation_id).
- Index em (profile_id) e (operation_id) pra RLS rápido.
- ON DELETE CASCADE em ambos os FKs (se profile ou operation forem deletados, o link some).

### RF2 — Helpers SQL
- Function `public.is_admin()` retorna boolean — `SELECT role='admin' FROM profiles WHERE id=auth.uid()`. STABLE, SECURITY DEFINER.
- Function `public.can_see_operation(uuid)` retorna boolean — `is_admin() OR EXISTS(SELECT 1 FROM operation_members WHERE profile_id=auth.uid() AND operation_id=$1)`. STABLE.

### RF3 — RLS diretas (tabelas com `operation_id`)
Substituir/adicionar policy `SELECT`/`UPDATE`/`DELETE` em:
- `operations` (própria — `can_see_operation(id)`)
- `frentes`
- `briefings`
- `meetings`
- `decisions`
- `attachments`
- `operation_villains`
- `operation_villain_narratives`
- `quick_wins`
- `allocations` (via frente)
- `tasks` (via frente)
- `operation_costs`
- `public_links`
- `sla_incidents` (quando existir; vide Fase 2 do `sla-incidents-ingest`)

`INSERT` segue regra de papel (admin OR member da operação destino).

### RF4 — RLS indiretas
- `clients` — `is_admin() OR EXISTS(SELECT 1 FROM operations o WHERE o.client_id=clients.id AND can_see_operation(o.id))`.
- `persons` (interna) — `is_admin() OR EXISTS(SELECT 1 FROM allocations a JOIN frentes f ON f.id=a.frente_id WHERE a.person_id=persons.id AND can_see_operation(f.operation_id))`.
- `persons` (externa) — `is_admin() OR (client_id IS NOT NULL AND EXISTS(SELECT 1 FROM operations o WHERE o.client_id=persons.client_id AND can_see_operation(o.id)))`.

### RF5 — Tabelas globais (sem filtro)
- `villains`, `service_products`, `quick_win_catalog` — leitura aberta a `authenticated`. Mantém policies atuais.

### RF6 — `profiles`
- Admin lê todos.
- Member lê **a si mesmo** + **profiles vinculados a operações visíveis** (colegas via `operation_members`).

### RF7 — UI admin de atribuição
Nova rota `/operations/[id]/settings/members` (gated por `requireAdminAction`):
- Lista atual de members atribuídos (nome + email + "Remover").
- Combobox/select pra adicionar (busca por email/nome em `profiles` com `role='member'`).
- Server actions `addOperationMember(operationId, profileId)` e `removeOperationMember(operationId, profileId)` retornando `ActionResult`.
- Sem auto-assign de admin (admin vê tudo já).

### RF8 — Operations list filtrada
`/operations` (page) já usa query Supabase; RLS deve fazer todo o trabalho. Confirmar que `lib/db/queries/operations.ts` não usa service-role implícito.

### RF9 — Painel admin
KPIs vêm de queries existentes. RLS cascateia automático. **Validar** que `painel-admin` (já COMPLETE) reflete escopo via testes manuais com member vs admin logado.

### RF10 — Estados vazios
Cada lista (`/operations`, `/clients`, `/persons`) ganha mensagem específica pra "sem atribuições" vs "não cadastrado ainda". Diferenciador: se `is_admin()` retorna false E count=0 → mensagem de "procure um admin".

## Não-objetivos (fora de escopo)

- ❌ Permissões granulares dentro da Operação (ler vs editar Frente X). Tudo-ou-nada por Operação no MVP.
- ❌ Atribuição em massa (CSV import).
- ❌ Convite por email pra member novo (Gabriel já existe; provisionamento manual segue).
- ❌ Audit log de quem atribuiu quem (created_by já guarda — UI dedicada só na v2).
- ❌ Notificação ao member quando é atribuído (entra em `discord-notifications` quando essa feature rolar).
- ❌ Visualizador externo (token) — feature separada (já existe `public_links`).
- ❌ Bypass via service-role pra background jobs — quando aparecer (cron, webhook), trata caso a caso.

## Critérios de aceite (high-level)

- [ ] Gabriel (member) loga e vê 0 Operações até ser atribuído.
- [ ] Gabriela (admin) atribui Gabriel a 1 Operação via UI; ele recarrega e vê 1.
- [ ] Gabriel acessa direto URL de Operação que não é dele → 404.
- [ ] Gabriel vê só os Clientes/Pessoas das suas Operações.
- [ ] Painel mostra KPIs filtrados pra Gabriel; Gabriela vê tudo.
- [ ] Catálogos (vilões/produtos/QW) seguem visíveis pra todos.
- [ ] Remover Gabriel de Operação retira o acesso na hora.
- [ ] Build verde, typecheck verde, zero console error.

## Fases

1. **Phase 1 — Núcleo:** Schema (`operation_members` + helpers `is_admin()` + `can_see_operation()`) + RLS das diretas + UI admin de atribuição + filtro funcional em `/operations`.
2. **Phase 2 — Cascata:** RLS indiretas (clients, persons) + painel admin validado + estados vazios.
3. **Phase 3 — Polish:** Mensagens 404 vs 403, badge "X operações atribuídas" no `/profile` se houver, copy review.

PR por fase (3 PRs).

## Riscos & mitigações

- **R1 — RLS quebra queries existentes:** Toda Server Action que assume "vê tudo" precisa ser revisada. Mitigação: rodar suite manual pós-Phase 1 com user admin antes de testar como member.
- **R2 — Performance de RLS com EXISTS aninhado:** Em queries cascateadas (clients via operations) pode degradar. Mitigação: index em `operation_members(profile_id)` + `operations(client_id)`. Validar com EXPLAIN se sentir lentidão.
- **R3 — Triggers em SECURITY DEFINER fazem bypass:** `create_profile_on_user_signup` e similares rodam como definer; não afetam SELECT mas atenção em DELETE/UPDATE futuros.
- **R4 — Member já é Pessoa interna alocada:** Não acontece hoje (Gabriel é só auth user). Quando virar Pessoa, `persons.profile_id` pode entrar como ponte. Fora do escopo dessa feature.
- **R5 — Service-role bypass em algum lugar:** `painel-admin` usa queries comuns (client criado via `createServer()`); não service-role. Confirmar antes de implementar.

## Decisões pendentes pra Design

- **D1:** RLS via policy `USING (can_see_operation(operation_id))` ou direto via EXISTS na policy? (Performance vs legibilidade.)
- **D2:** `operation_members.role_in_op` (text) entra agora ou v2? Spec atual diz não.
- **D3:** UI: `/operations/[id]/settings/members` é página dedicada ou um Drawer/Modal a partir da Operação?
- **D4:** Como combobox de busca de profiles funciona — server-side com `?q=`, ou client-side com lista completa pré-carregada (poucos members)?
