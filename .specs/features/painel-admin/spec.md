# painel-admin Specification

## Problem Statement

`/admin` hoje é só "Painel admin" + section "Usuários" + section "Vilões" — útil pra administrar, mas não responde nenhuma pergunta de negócio. Admin abre o app e quer ver, em 1 tela:

- **Quanto a operação inteira fatura hoje** (MRR total, top Clientes)
- **Onde estamos em risco** (Frentes stale, Operações sem status acionável, vilões mais frequentes)
- **Capacidade** (Pessoas ativas, alocações abertas)
- **Tração recente** (Quick Wins últimos 30d)

Hoje precisa abrir 4-5 telas e somar de cabeça. Painel agrega em server components com queries diretas + 2-3 gráficos Recharts.

Inv. 14 já garante que MRR e info comercial sensível ficam admin-only — painel pode mostrar livremente.

## Goals

- [ ] Rota nova `/admin/dashboard` com `requireAdmin()` guard
- [ ] Link no Sidebar group "Admin" (apenas pra admin) — entrada "Painel" ou "Dashboard"
- [ ] **Card MRR total** + **BarChart top 5 Clientes por MRR** (Recharts)
- [ ] **Cards de contagem** — Operações por status (Ativas/Arquivadas), Frentes por saúde (Saudáveis/Stale/Sem status acionável)
- [ ] **Section Vilões** — top 5 vilões por frequência (count em operation_villains) + Quick Wins criados últimos 30d (count + soma de impacto)
- [ ] **Section Pessoas** — count internas ativas, externas ativas, alocações abertas (sem `end_date`)
- [ ] Queries agregadas em `src/lib/db/queries/dashboard.ts` (nova) ou inline no page
- [ ] Sem filtros de período no MVP — só estado atual + "últimos 30d" hardcoded em QWs
- [ ] Server component puro (sem 'use client' no page); Recharts em wrapper client component

## Out of Scope

- **Filtros de período** (7d/30d/90d) — v2
- **Drill-down clicável** (clicar no card vai pra lista filtrada) — v2
- **Comparativo período anterior** (MRR vs mês passado) — v2
- **Export CSV** — v2
- **Real-time / refresh automático** — page é SSR, recarrega no F5
- **Member vê versão reduzida** — não. `/admin/dashboard` é admin-only puro. Member já não vê grupo Admin no sidebar.
- **Mover sections de /admin pra /admin/dashboard** — não. `/admin` continua com Usuários + Vilões. Dashboard é rota nova separada.
- **Métricas de SLA breach, anexos, briefings** — out. Foco: comercial + saúde + capacidade + tração.
- **Notificação Discord quando métrica passa threshold** — feature `discord-webhook` separada.
- **Tooltips com explicação de cada métrica** — manter rótulos auto-explicativos; sem help icons no MVP.
- **Skeleton loading state** — Suspense boundary opcional; sem fallback bonito no MVP.

---

## User Stories

### P1: Rota + guard + nav ⭐ MVP

**Acceptance Criteria**:

1. `src/app/(app)/admin/dashboard/page.tsx` chama `requireAdmin()` (já existente)
2. `SidebarNav.tsx` group "Admin" ganha item novo "Painel" com ícone `LayoutDashboard` (Lucide) apontando `/admin/dashboard`
3. Ordem do group Admin: **Painel** (novo) → Catálogo → Painel admin (`/admin`). Repensar nome: "Painel admin" vira "Admin" (rota /admin) pra evitar confusão.
4. Member não vê o item (já garantido pelo gate de grupo Admin)

---

### P1: Card MRR total + top Clientes ⭐ MVP

**Acceptance Criteria**:

1. Card grande no topo: "MRR total" — soma `monthly_recurring_revenue` de operations WHERE `archived_at IS NULL`
2. Formatação `formatCurrency(value)` (helper existente em `src/lib/utils/`)
3. Sub-label: "X operações ativas" (count)
4. **BarChart horizontal Recharts** — top 5 clientes por MRR somado das suas operações ativas
   - Eixo Y: nome do Cliente (truncated 20 chars)
   - Eixo X: MRR em R$
   - Cor única `sage` (ou similar do design system)
   - Sem grid, tooltip mostra valor formatado
5. Lista textual abaixo do gráfico opcional ("Outros: R$X" se houver > 5 clientes)

---

### P1: Cards de contagem operações + frentes ⭐ MVP

**Acceptance Criteria**:

1. Grid 2x2 ou row de 4 cards:
   - **Operações ativas** — count operations WHERE `archived_at IS NULL`
   - **Operações arquivadas** — count operations WHERE `archived_at IS NOT NULL` (já incluído em MRR card como sub? — não, separar)
   - **Frentes saudáveis** — count frentes WHERE `archived_at IS NULL AND actionable_status IS NOT NULL AND updated_at > now() - interval '14 days'`
   - **Frentes stale** — count frentes WHERE `archived_at IS NULL AND (actionable_status IS NULL OR updated_at <= now() - interval '14 days')`
2. Cada card: número grande (Funnel Display) + label + Pill colorida pelo estado (sage saudável, warning stale, neutral neutros)
3. Threshold "14 dias" hardcoded no MVP. Mover pra config v2.

---

### P1: Section Vilões + Quick Wins ⭐ MVP

**Acceptance Criteria**:

1. **Top 5 vilões por frequência**:
   - Query: `SELECT villain_id, count(*) FROM operation_villains JOIN villains ON ... WHERE villains.archived_at IS NULL GROUP BY villain_id ORDER BY count DESC LIMIT 5`
   - Render: lista simples (nome do vilão + count "N operações") OU BarChart horizontal Recharts (mesmo padrão dos clientes)
   - Decisão: BarChart (consistência visual)
2. **Quick Wins últimos 30d**:
   - Card "Quick Wins (30d)" — count `created_at > now() - interval '30 days'`
   - Card "Impacto somado (30d)" — sum de impacts JSONB... **complicado por causa do shape**. Decisão de design.md.
   - Fallback: só count no MVP; impacto somado fica pra v2.

---

### P1: Section Pessoas + Alocações ⭐ MVP

**Acceptance Criteria**:

1. Cards:
   - **Pessoas internas** — count persons WHERE `kind='internal' AND archived_at IS NULL`
   - **Pessoas externas** — count persons WHERE `kind='external' AND archived_at IS NULL`
   - **Alocações abertas** — count allocations WHERE `end_date IS NULL`
2. Pills neutral; sem gráfico (números simples)

---

### P2: Skeleton loading

Suspense boundary com fallback simples. Não-bloqueante.

### P3: Filtros de período, drill-down, export

Fora do MVP.

---

## Edge Cases

- **Nenhuma operação ativa** → MRR R$ 0, BarChart vazio (placeholder "Sem operações ativas")
- **Nenhum vilão registrado** → section vilões mostra "Catálogo ainda vazio nas operações"
- **Nenhuma alocação aberta** → card mostra 0 (não esconder)
- **MRR null em alguma operação** → tratar como 0 (COALESCE no SQL)
- **Cliente com 0 operações ativas mas existe** → não aparece no top 5 (filtro implícito)
- **Member acessa /admin/dashboard via URL** → requireAdmin redirect /
- **Frente nunca atualizada (`updated_at = created_at`)** → conta como saudável se < 14d, stale se >= 14d. Aceito.
- **Performance**: 4-6 queries paralelas via `Promise.all` no page. ~20 ops, ~50 frentes, ~30 pessoas no cenário atual → < 100ms total.

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] `/admin/dashboard` como admin renderiza: MRR card, BarChart clientes, 4 cards contagem, BarChart vilões, 2 cards QW, 3 cards pessoas
- [ ] `/admin/dashboard` como member redireciona /
- [ ] Sidebar group Admin como admin mostra "Painel" + "Catálogo" + "Admin"
- [ ] Sidebar group Admin como member: oculto (já garantido pelo gate existente)
- [ ] MRR total bate com soma manual via SQL `SELECT sum(monthly_recurring_revenue) FROM operations WHERE archived_at IS NULL`
- [ ] Top clientes ordenados corretamente (maior MRR primeiro)
- [ ] Frentes stale conta corretamente (criar uma Frente sem update há 15d em fixture)
- [ ] Queries todas em `Promise.all` (verificar no diff)
- [ ] Recharts renderiza no client (componente wrapper marcado `'use client'`)
- [ ] Screenshots: dashboard completo admin

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Rota | `/admin/dashboard` (nova) | Mantém `/admin` com seções existentes; dashboard separado é menos friction |
| Member vê? | Não, admin only | Métricas comerciais sensíveis |
| Filtros de período | Não no MVP | Escopo enxuto; aceito MVP simples |
| Drill-down clicável | Não no MVP | v2 |
| Threshold stale | 14 dias hardcoded | Razoável pra ciclo semanal/quinzenal; revisita v2 |
| Top N clientes/vilões | 5 | Suficiente; tela não vira lista infinita |
| Gráfico de QW por impacto | Não — só count 30d | Soma de impacts JSONB é complexa; v2 |
| Recharts vs lista | BarChart pra clientes + vilões; cards pra restante | Visual coerente; cards de contagem não precisam de gráfico |
| Query layer | `src/lib/db/queries/dashboard.ts` (novo arquivo) | Agregações específicas; reutilizável |
| Server vs client | Page server; Recharts em wrapper client | Padrão Next; Recharts precisa de window |
| Suspense skeleton | Não no MVP | Page é rápida (<100ms estimado) |
| Real-time refresh | Não | SSR + F5 cobre |
| Sidebar item nome | "Painel" | Curto; "Dashboard" também aceitável — decidir no design |
| Renomear `/admin` no nav? | Sim — "Painel admin" → "Admin" | Evita confusão com novo "Painel" |
| Ordem do nav Admin | Painel → Catálogo → Admin | Métrica primeiro (mais consultado), config depois |
| Empty states | Sim, em cada section | Sem dados reais hoje além das fixtures |
