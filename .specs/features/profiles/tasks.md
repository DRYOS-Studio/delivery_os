# profiles Tasks

**Design**: `.specs/features/profiles/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: enum + tabela + trigger + backfill + seed + RLS)
  T2 (regenerate types)

Phase 2 — Auth helpers + queries + actions:
  T3 (auth/server.ts: getProfile, requireProfile, requireAdmin, requireAdminAction, isAdmin)
  T4 (queries/profiles.ts: listProfiles)
  T5 (actions/profiles.ts: setUserRoleAction)

Phase 3 — Gating em actions destrutivas:
  T6 (adicionar requireAdminAction em 15 actions: archive×4, delete×7, villain×3, revokePublicLink)

Phase 4 — UI gating de info comercial:
  T7 (OperationHero: condicional MRR/Recorrência)
  T8 (OperationCard: condicional MRR/Recorrência)
  T9 (FinanceCards: early return)
  T10 (OperationForm: esconder inputs + hidden inputs preservando valores)

Phase 5 — UI gating de botões destrutivos:
  T11 (parent server components condicionalmente renderizam botões: archive em forms, × em rows)
  T12 (VillainCard esconde "Editar →"; /catalog/villains/[id]/edit guard)

Phase 6 — Painel admin:
  T13 (Sidebar busca profile + Pill role; SidebarNav esconde grupo Admin)
  T14 (/admin com requireAdmin; AdminUsersSection consolidada; SetUserRoleButton)

Phase 7 — Ship:
  T15 (typecheck + build + smoke como admin + smoke como member)
  T16 (DATABASE_SCHEMA.md)
  T17 (issue + PR + merge)
```

Caminho crítico: T1→T2→T3→T6→T7-T12 (paralelizável)→T14→T15→T17. ~120-150min (maior por número de pontos de toque).

---

## Task Breakdown

### T1: Migration `<ts>_profiles.sql`

**Done when**:
- [ ] DO $$ CREATE TYPE user_role (admin/member) idempotente
- [ ] CREATE TABLE profiles (id uuid PK FK auth.users CASCADE, role user_role NOT NULL default 'member', name text, created_at, updated_at)
- [ ] Trigger updated_at
- [ ] Function create_profile_for_new_user com SECURITY DEFINER
- [ ] Trigger AFTER INSERT ON auth.users
- [ ] Backfill INSERT pra users existentes sem profile
- [ ] Seed admin: UPDATE profiles role='admin' WHERE auth.users.email='rafaelemeth@gmail.com'
- [ ] RLS habilitado + 2 policies (SELECT all authenticated; UPDATE admin only via subquery)
- [ ] Aplicado via MCP

---

### T2: Regenerate types

- [ ] MCP generate_typescript_types
- [ ] Types: profiles Row, enum user_role

---

### T3: Auth helpers

- [ ] `src/lib/auth/server.ts` adiciona:
  - `Role` type
  - `ProfileLite` type
  - `getProfile()` — user + role (fallback 'member' se profile faltar)
  - `requireProfile(redirectToOnFail?)` — redirect /login se null
  - `requireAdmin(redirectOnFail='/')` — redirect / se member
  - `requireAdminAction()` — ActionResult; err 'forbidden' se member
- [ ] Helper puro `isAdmin(role)` exportado

---

### T4: queries/profiles.ts

- [ ] `ProfileListItem` type (id, email, name, role, createdAt)
- [ ] `listProfiles()` — JOIN com auth.users via createAdmin pra emails
- [ ] Order by created_at ASC

---

### T5: actions/profiles.ts

- [ ] `setUserRoleAction(targetUserId, newRole)`:
  - requireAdminAction
  - Self-demote check (targetUserId === current.user.id && newRole !== 'admin' → err `self_demote_blocked`)
  - UPDATE profiles SET role=newRole WHERE id=targetUserId
  - revalidatePath /admin

---

### T6: Gate em 15 actions destrutivas

**Padrão a aplicar**:
```ts
const userResult = await requireUserAction();
if (!userResult.ok) return userResult;
const adminGuard = await requireAdminAction();
if (!adminGuard.ok) return adminGuard;
```

Ou simplificar trocando `requireUserAction` por `requireAdminAction` (que já chama require user internamente).

**Lista**:
- [ ] archiveClientAction
- [ ] archiveOperationAction
- [ ] archiveFrenteAction
- [ ] archivePersonAction
- [ ] deleteAllocationAction
- [ ] deleteIncidentAction
- [ ] deleteMeetingAction
- [ ] deleteDecisionAction
- [ ] deleteAttachmentAction
- [ ] deleteOperationVillainAction
- [ ] deleteQuickWinAction
- [ ] archiveVillainAction
- [ ] restoreVillainAction
- [ ] updateVillainAction
- [ ] revokePublicLinkAction

---

### T7: OperationHero condicional MRR/Recorrência

- [ ] Adicionar prop `isAdmin: boolean`
- [ ] MetaChip "Recorrência" + "MRR" renderiza só se isAdmin
- [ ] Caller (`/operations/[id]/page.tsx`) busca profile + passa prop

---

### T8: OperationCard condicional

- [ ] Identificar onde MRR aparece no card
- [ ] Prop isAdmin; renderiza condicional
- [ ] Caller adapta

---

### T9: FinanceCards early return

- [ ] Prop isAdmin → return null se !isAdmin
- [ ] Caller passa prop

---

### T10: OperationForm sem MRR/Recorrência pra member

- [ ] Prop `isAdmin: boolean`
- [ ] Em modo edit, se !isAdmin:
  - Esconder Field MRR
  - Esconder Field Recorrência
  - Render `<input type="hidden" name="monthly_recurring_revenue" value={current_mrr}>` e equivalente recurrence (current_recurrence ?? "")
- [ ] Caller (operations new/edit pages) busca profile + passa
- [ ] Em create, member não cria Op? Decisão: member pode criar mas sem MRR/Recorrência (deixa em branco; admin completa depois). Ou bloquear create de Op pra member? **Decisão MVP**: member pode criar Op (fluxo operacional), campos comerciais vão em branco/padrão.

---

### T11: Botões destrutivos ocultos via parent server

Componentes parent servidor renderizam conditionally:

- [ ] **FrenteForm** "Arquivar" button — server parent passa prop ou condicional
- [ ] **OperationForm** "Arquivar" button — idem
- [ ] **ClientForm/PersonForm** Archive buttons — idem
- [ ] **AllocationForm** "Remover" — idem
- [ ] **MeetingForm** edit Remover — idem
- [ ] **DecisionForm** edit Remover — idem
- [ ] **IncidentForm** edit Remover — idem
- [ ] **RemoveOperationVillainButton** — parent passa flag
- [ ] **RemoveQuickWinButton** — idem
- [ ] **DeleteAttachmentButton** — idem
- [ ] **RevokePublicLinkButton** — idem
- [ ] **ArchiveVillainButton** — idem (em catalog edit)

**Estratégia**: cada client component aceita `isAdmin: boolean` prop opcional (default false); retorna null se !isAdmin. Parent server passa explicit prop.

---

### T12: VillainCard "Editar →" + catalog edit guard

- [ ] VillainCard aceita prop `isAdmin`; oculta Link "Editar →" se !isAdmin
- [ ] `/catalog/page.tsx` busca profile + passa isAdmin pros cards
- [ ] `/catalog/villains/[id]/edit/page.tsx` chama requireAdmin (redirect /catalog se member)

---

### T13: Sidebar com role + nav admin condicional

- [ ] `Sidebar.tsx` (server) busca profile via getProfile
- [ ] Renderiza Pill `sage` "Admin" ou `neutral` "Member" perto do email
- [ ] Passa `isAdmin` boolean pro SidebarNav
- [ ] `SidebarNav.tsx` aceita prop `isAdmin`; filtra grupos pra esconder "Admin" se !isAdmin

---

### T14: /admin consolidado com AdminUsersSection

- [ ] `/admin/page.tsx`:
  - `await requireAdmin()` no topo (redirect / se member)
  - PageHeader "Painel admin"
  - Renderiza `<AdminUsersSection profiles={...} currentUserId={user.id} />`
- [ ] `AdminUsersSection.tsx` server:
  - Props: profiles, currentUserId
  - Header h2 "Usuários" + Pill contagem
  - Lista linhas: Avatar + email + name + Pill role + SetUserRoleButton
- [ ] `SetUserRoleButton.tsx` client:
  - Props: targetUserId, currentRole, isSelf
  - Botão "Promover" se member, "Rebaixar" se admin
  - disabled se isSelf
  - window.confirm + action

---

### T15: Typecheck + build + smoke

- [ ] Build verde (rotas: 37; sem novas obrigatórias)
- [ ] Smoke como admin:
  - Sidebar: Pill "Admin", grupo Admin visível
  - /admin acessa, vê lista users
  - Promove um member → vira admin
  - Operações: vê MRR no Hero/Card/FinanceCards, botões archive/× visíveis
  - /catalog: vê "Editar →"
- [ ] Smoke como member (criar segundo user fake ou promover/rebaixar admin):
  - Sidebar: Pill "Member", grupo Admin oculto
  - /admin → redirect /
  - /catalog: vê 7 vilões sem "Editar →"
  - /catalog/villains/[id]/edit URL direta → redirect /catalog
  - /operations/[id]: SEM MRR Hero, SEM FinanceCards, SEM botões archive/×/Remover/Revogar
  - OperationForm edit: SEM inputs MRR/Recorrência; submit preserva valores
  - DevTools tentar delete: toast `forbidden`
- [ ] Screenshots ambos perfis

---

### T16: DATABASE_SCHEMA.md

- [ ] Adicionar `profiles` (19ª)
- [ ] Enum user_role na lista
- [ ] Migration na lista
- [ ] Última análise = 2026-05-17

---

### T17: Issue + PR + merge

---

## Pre-Impl

Pace: reto T1→T15, pauso antes do PR. ~120-150min.

**Riscos**:
- T11: muitos pontos de toque (12+ componentes/botões); risco de esquecer algum. Manter checklist.
- T10 hidden inputs: validar que form HTML envia valores corretamente; testar update sem alterar MRR/Recorrência.
- T13 SidebarNav: hoje recebe counts numéricos; agora vai filtrar grupos. Cuidado com client/server props.
- T6: 15 actions tocadas; mecânico mas extenso. Padrão consistente ajuda.
- Trigger SECURITY DEFINER: testar em produção (rafaelemeth deve continuar admin após apply).
