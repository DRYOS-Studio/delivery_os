# profiles Specification

## Problem Statement

DRYOS Delivery cresceu de 1 usuário (eu, admin) pra 5 pessoas com tendência a escalar. Hoje RLS é uniforme `authenticated_full` em todas as 18 tabelas — qualquer login pode deletar Cliente, arquivar Operação, editar catálogo de vilões.

PRD §06 prevê 3 papéis: **Admin · Membro · Visualizador externo (token)**. Visualizador externo já vive em `/public/[token]`. Falta diferenciar Admin de Member dentro do app autenticado.

Inv. 14 do CLAUDE.md sempre antecipou: *"Guard de papel (Admin/Membro) entra quando a tabela `profiles` existir"*.

**Risco real:** member novato pode acidentalmente arquivar Operação ativa, editar quote canônica de vilão, revogar link público de cliente importante.

**Mudança de escopo nesta sessão:**
- Profiles vive **consolidado em `/admin`** (mesma rota do futuro painel-admin) como section "Usuários" — não rota dedicada.
- UI **esconde** botões destrutivos pra member (não só rejeita na action). Operacional puro nem vê a opção.

## Goals

- [ ] Tabela `profiles` (id PK FK `auth.users` CASCADE, role enum, name) + enum `user_role` (admin / member)
- [ ] Trigger AFTER INSERT em `auth.users` → cria profile com role='member'
- [ ] Backfill profiles existentes + seed `rafaelemeth@gmail.com` → admin
- [ ] Helpers server `getProfile`, `requireProfile`, `requireAdmin` (redirect), `requireAdminAction` (ActionResult)
- [ ] Sidebar mostra Pill role; **grupo "Admin" do nav escondido pra member**
- [ ] `/admin` ganha guard requireAdmin + section "Usuários" consolidada (lista profiles + promover/rebaixar)
- [ ] **UI esconde botões destrutivos pra member**: archive (clients, ops, frentes, persons, villains), delete (×) em allocations/incidents/anexos/meetings/decisions/op_villains/QWs, revoke public link, edit vilão (`/catalog/villains/[id]/edit`)
- [ ] Member **vê /catalog em modo leitura** (entende contexto de marca, sem botão Editar)
- [ ] Actions destrutivas mantêm `requireAdminAction` (defense-in-depth se UI vazar)
- [ ] Polices Postgres em `profiles`: SELECT all, UPDATE admin only, INSERT só via trigger
- [ ] **Info comercial admin-only**: `MRR` e `recurrence` ficam ocultos pra member em todos os lugares onde aparecem hoje (OperationHero, FinanceCards, OperationCard, OperationForm). UI condicional via `isAdmin` prop. PublicHero/PublicVillainsList/etc não mostram MRR mesmo pra admin (cliente externo nunca viu).

## Out of Scope

- **RLS refinado por role em outras tabelas** — gate só na UI/action. RLS continua `authenticated_full` em clients/operations/etc. Refator de 18 tabelas vira v2.
- **Viewer role** — só 2 papéis. Visualizador externo cobre `/public/[token]`.
- **Self-signup público** — quem chega entra como member via trigger; signup pela própria Supabase Auth ainda exige aprovação manual.
- **Permissions matrix granular** — sem groups, sem custom permissions. Admin = full + destrutivo; member = não-destrutivo.
- **Editor de display name** — campo existe; UI de edit fica pra v2.
- **Painel-admin métricas (vilão mais derrotado, MRR, etc)** — feature separada, não esta. Esta entrega só a base de `/admin` + section users.
- **Audit log promove/rebaixa** — não. `updated_at` cobre; integração Discord futura pode notificar.
- **Self-demote prevention** — sim (admin não pode rebaixar a si próprio; impede lock-out).
- **Avatar upload** — futuro.

---

## User Stories

### P1: Schema + trigger + seed ⭐ MVP

**Acceptance Criteria**:

1. Migration cria:
   - Enum `user_role` (admin/member)
   - Tabela `profiles` (id uuid PK FK auth.users CASCADE, role user_role NOT NULL default 'member', name text, created_at, updated_at)
   - Function + trigger AFTER INSERT em auth.users que insere profile com role='member'
   - Backfill: INSERT INTO profiles SELECT id, 'member' FROM auth.users WHERE id NOT IN (SELECT id FROM profiles)
   - Seed admin: UPDATE profiles SET role='admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'rafaelemeth@gmail.com')
2. RLS:
   - SELECT authenticated (todos veem todos — necessário pra section Users mostrar emails)
   - UPDATE admin only (policy `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'`)
   - INSERT bloqueado pra authenticated (só via trigger)
3. Trigger `set_profiles_updated_at`

---

### P1: Helpers de auth ⭐ MVP

**Acceptance Criteria**:

1. `src/lib/auth/server.ts` ganha:
   - `getProfile()` → {user, role} | null
   - `requireProfile()` → redirect /login se null
   - `requireAdmin(redirectToOnFail?)` → redirect / se member
   - `requireAdminAction()` → ActionResult; err `forbidden` se member
2. Helper puro `isAdmin(role)`

---

### P1: Sidebar com Pill role + nav admin escondido ⭐ MVP

**Acceptance Criteria**:

1. Sidebar.tsx busca profile via getProfile (server)
2. Mostra Pill `sage` "Admin" ou `neutral` "Member" ao lado do email
3. Passa `isAdmin` prop pra SidebarNav (client)
4. **SidebarNav esconde o grupo inteiro "Admin"** (`/catalog`, `/admin`) se `!isAdmin`
5. Quer dizer: member não vê "Catálogo" nem "Painel" no nav. Acessa /catalog só via URL direta (que renderiza em leitura).

---

### P1: /admin consolidado ⭐ MVP

**Acceptance Criteria**:

1. `/admin/page.tsx` chama `requireAdmin()` → redirect / se member
2. PageHeader "Painel admin" + section "Usuários":
   - Lista todos profiles
   - Cada linha: Avatar + email + name + Pill role + botão Promover/Rebaixar
   - Self-demote bloqueado (botão disabled + tooltip)
3. Outras sections (vilão mais derrotado, MRR, etc) ficam pra feature `painel-admin` futura — esta só estabelece a casa.

---

### P1: UI esconde botões destrutivos pra member ⭐ MVP

**Acceptance Criteria**:

1. Componentes server passam `isAdmin: boolean` prop pra client components que renderizam botão destrutivo. Server resolve via getProfile().
2. Botões escondidos pra member:
   - ArchiveClientButton, ArchiveOperationButton, ArchiveFrenteButton (form Archive section), ArchivePersonButton
   - ArchiveVillainButton (em /catalog/villains/[id]/edit)
   - RemoveAllocationButton, RemoveOperationVillainButton, RemoveQuickWinButton, DeleteAttachmentButton, RevokePublicLinkButton
   - Delete buttons em MeetingForm/DecisionForm/IncidentForm (mode edit)
3. **/catalog/villains/[id]/edit como member** → redirect /catalog. Página em si admin-only.
4. **/catalog** acessível a member, mostra grid de villains sem links "Editar →" (resolve via prop)
5. Botão "Editar →" em VillainCard fica oculto pra member

---

### P1: UI esconde info comercial pra member ⭐ MVP

**User Story**: Como time operacional, não preciso (e não devo) ver MRR/recorrência das Operações.

**Acceptance Criteria**:

1. `isAdmin: boolean` prop chega aos componentes que mostram info comercial
2. **OperationHero**: MetaChip "MRR" e MetaChip "Recorrência" escondidos pra member; demais (SLA, datas, criado) continuam
3. **FinanceCards**: section inteira escondida pra member em `/operations/[id]`
4. **OperationCard** (em /operations + /clients/[id]): campo MRR + recurrence escondidos pra member; demais campos do card normais
5. **OperationForm**: inputs "MRR" e "Recorrência" escondidos pra member em mode edit; member ainda submete form com os outros campos. Action preserva valores existentes (não envia esses campos = não muda no DB).
   - Detalhe técnico: form precisa **enviar** os valores atuais como hidden inputs OU action precisa fazer merge com current state (não sobrescrever com vazio).
   - Decisão: hidden inputs (mais simples, escopo mínimo).
6. **Public view** (`/public/[token]`): MRR já não aparece hoje em PublicHero (verificado); manter assim. SLA continua visível (cliente sabe o que foi prometido).
7. **Operations table de admin** (se houver) — não há lista MRR exposta agora além do OperationCard.

---

### P1: Gate em actions destrutivas (defense-in-depth) ⭐ MVP

**Acceptance Criteria**:

1. Em todas as actions destrutivas listadas (12 actions), adicionar `requireAdminAction` após `requireUserAction`
2. Member que escapou da UI (URL direta) → action retorna `err('Acesso restrito a admin.', 'forbidden')`
3. UI já oculta botão, então action serve só como safety net

---

### P1: setUserRoleAction com guards ⭐ MVP

**Acceptance Criteria**:

1. Action `setUserRoleAction(targetUserId, newRole)`:
   - `requireAdminAction`
   - Se `targetUserId === user.id && newRole !== 'admin'` → err `self_demote_blocked`
   - UPDATE profiles SET role=newRole WHERE id=targetUserId
   - revalidatePath /admin
2. Botão na UI com window.confirm("Promover X a admin?" ou "Rebaixar X a member?")

---

### P2: Edit display name por self

Pula. Admin pode mexer via Supabase Dashboard se urgir.

### P3: Avatar upload

Pula. initialsFromEmail cobre.

---

## Edge Cases

- **Member acessa /admin via URL direta** → requireAdmin redirect /
- **Member acessa /catalog via URL direta** → renderiza grid em leitura (sem botões Editar)
- **Member acessa /catalog/villains/[id]/edit via URL direta** → requireAdmin redirect /catalog (ou /). Decisão: /catalog (contexto preservado).
- **Member tenta action destrutiva via DevTools** → action retorna `forbidden`
- **Admin rebaixa a si próprio** → action retorna `self_demote_blocked`
- **Último admin tenta se rebaixar** → mesmo gate above (não-self protection é genérica e cobre)
- **Trigger falha em signup** → user fica sem profile temporariamente; backfill manual SQL resolve. Edge raro.
- **Service role (Supabase Dashboard)** → bypass de tudo. Aceito (escape hatch).
- **Auth.users deletado** → CASCADE drop profile

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] SQL: rafaelemeth@gmail.com role='admin'; novos users role='member'
- [ ] Sidebar como admin: Pill "Admin" + grupo "Admin" visível
- [ ] Sidebar como member: Pill "Member" + grupo "Admin" oculto
- [ ] /admin como admin: lista users + promover/rebaixar funciona
- [ ] /admin como member: redirect /
- [ ] /catalog como member: 7 vilões visíveis, sem botão Editar
- [ ] /operations/[id] como member: sem botões archive/×/Remover/Revogar nas sections
- [ ] /operations/[id] como member: **sem MRR no Hero, sem FinanceCards, sem Recorrência**
- [ ] /operations + /clients/[id] como member: cards de Op sem MRR/recorrência
- [ ] OperationForm como member: sem inputs MRR/Recorrência; submit preserva valores existentes
- [ ] Tentar deletar QW via DevTools como member → toast `forbidden`
- [ ] Self-demote bloqueado no botão
- [ ] Screenshots: sidebar Admin vs Member, /admin com users, /catalog leitura, /operations[id] modo member

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Roles | admin / member | Time pequeno; viewer = /public/[token] |
| RLS em outras tabelas | Não no MVP | Gate UI/action suficiente pra time alinhado |
| RLS em profiles | Sim (SELECT all + UPDATE admin only) | Tabela sensível |
| Profiles na rota /admin | Sim, section consolidada | Pedido do usuário; menos páginas |
| UI esconde destrutivos pra member | Sim | Pedido do usuário; member operacional puro |
| Defense-in-depth na action | Sim | Não confiar só na UI |
| Member vê /catalog em leitura | Sim | Inv. 06 espírito: vilões são canon que todos conhecem |
| /catalog edit como member | Redirect | Edição é admin only |
| Self-demote | Bloqueado | Prevenir lock-out acidental |
| Default novo user | member | Conservador |
| Trigger auto-create | Sim | UX sem fricção |
| Backfill rafaelemeth admin | Sim (idempotent) | Single source na migration |
| Tabela em public schema | Sim | Default |
| name field obrigatório? | Não, nullable | Email já identifica |
| Avatar | Não | initialsFromEmail cobre |
| Painel admin métricas | Out of scope | Feature separada `painel-admin` depois |
| Resposta `forbidden` na action | code='forbidden' | Pattern consistente |
| revokePublicLinkAction gated? | Sim | Revogar é destrutivo (cliente perde acesso) |
| updateVillainAction gated? | Sim | Catálogo canon (Inv. 06) |
| createPublicLinkAction gated? | Não | Onboarding cliente é rotina |
| Member pode criar Op/Frente/Pessoa/Briefing/QW/Meeting/Decision/Incident/Attachment? | Sim | Não-destrutivo; rotina |
| Member pode editar (não-destrutivo)? | Sim, exceto vilões catálogo | |
| Member pode editar MRR/Recorrência? | **NÃO** — inputs ocultos; action preserva valores | Pedido do usuário; informação comercial sensível |
| Member vê MRR em /operations/[id]? | NÃO — MetaChip oculto | |
| Member vê FinanceCards? | NÃO — section oculta | |
| Member vê MRR em OperationCard? | NÃO — campo oculto | |
| Cliente externo (/public) vê MRR? | Já não vê hoje; mantém | Cliente sabe o contrato; sistema não relembra |

