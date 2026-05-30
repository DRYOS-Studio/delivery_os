# Roadmap

**Current Milestone:** Semana 05 — Painel Admin + integrações + polimento
**Status:** Semanas 01–04 COMPLETE (catalog-admin fechado, demais entregas + bônus). Pendente: integrações (Tally/Discord/SLA incidents via n8n), dark-mode, polish-migration.

---

## Semana 01 — Setup + Schema + Auth + Bitwarden

**Goal:** Repo arrancado em Next.js 16 + TypeScript estrito, DS v2 com tokens e fontes carregadas, estrutura de pastas pronta, schema base no Supabase com RLS, Auth funcionando, integração Bitwarden capaz de listar item.

### Features

**week-01-setup** - COMPLETE

- Bootstrap Next.js 16 (App Router, TS estrito, Tailwind 4, src/) — AD-005
- DS v2: tokens em `globals.css` + `@theme inline` (Tailwind 4 CSS-first)
- Fontes via `next/font` (Funnel Display, Onest, JetBrains Mono)
- Estrutura de pastas conforme `dryos-conventions` SKILL
- Migration inicial aplicada em projeto remoto `Delivery OS` (AD-007): 5 tabelas + 8 enums + CHECKs + RLS. Invariantes validados 5/5 OK_rejected via MCP `execute_sql`
- Types gerados via MCP em `src/lib/db/types.ts`
- Cliente Supabase tipado em `src/lib/db/client.ts` (createServer + createBrowser)
- Scripts npm: dev, build, typecheck, gen:types
- `.env.local.example` aponta pro projeto Delivery OS

**auth** - COMPLETE

- Supabase Auth com magic link por e-mail
- Middleware protegendo rotas `(app)`
- Páginas `/login` e `/logout`
- Hook `useUser` + helpers server-side

~~**bitwarden-integration**~~ — **DEFERRED to v2** (AD-009)

Removida do MVP: custo de Bitwarden Teams (US$ 4/usuário/mês) evitável agora. Volta na v2 com opções de cofre (Bitwarden Teams pago, Bitwarden Free pessoal, ou Vaultwarden self-host).

---

## Semana 02 — CRUD base + componentes DS

**Goal:** Time interno consegue criar/editar Cliente, Operação, Frente, Pessoa, Alocação via UI. Componentes base do DS (Pill, Card, Avatar, Icon, Button, KpiCard) prontos.

### Features

**home-and-ui-foundation** - COMPLETE (Pill, Card, Avatar, Icon, Button, Sidebar, PageHeader, useReveal)
**clients-crud** - COMPLETE
**operations-crud** - COMPLETE
**frentes-crud** - COMPLETE (state machine de ciclo A-E + status acionável validado)
**persons-crud** - COMPLETE
**allocations-crud** - COMPLETE

---

## Semana 03 — Briefing, Reuniões, SLA, link público (esqueleto)

**Goal:** Documentos vivos da Operação (Briefing, Reuniões, Decisões, Anexos, SLA) operacionais. Esqueleto do link público com token funcionando.

### Features

**briefing-vivo** - COMPLETE (com histórico de alterações + origem)
**meetings-decisions** - COMPLETE (visibility independente Reunião/Decisão)
**attachments** - COMPLETE (Supabase Storage, path `<operation_id>/`)
**sla** - COMPLETE (campos estruturados em operações)
**status-acionavel-polish** - COMPLETE (UI + validação no banco)
**public-link-skeleton** - COMPLETE (token RPC, view read-only)

---

## Semana 04 — Diagnóstico, Vilões, Quick Wins, Catálogo

**Goal:** Narrativa dos vilões funcional ponta a ponta: diagnóstico → vilões em luta na Operação → Quick Wins com impacto capped por vilão. Catálogo administrativo editável.

### Features

**villains-catalog** - COMPLETE (7 vilões canônicos seed + archive-only)
**diagnostico-quickwins** - COMPLETE (vilões detectados + severidade inicial congelada + Quick Wins com impacto capped 100% por vilão)
**operation-villains** - COMPLETE (progresso % derrotado, capped 0-100)

**catalog-admin** - COMPLETE (núcleo) · pendências adiadas

- ✅ Vilões (CRUD admin em `/catalog/villains` — entregue antes)
- ✅ Produtos/Serviços DRYOS (`/catalog/products`, 12 seeds, FK opcional em Frente — #66 / PR #72)
- ✅ Quick Wins catálogo (`/catalog/quick-wins`, 21 seeds, pré-fill no form de QW da Operação — #64 / PR #75)
- ↩ Tipos de Frente — **descartado como catálogo**. Decisão: enum A-E permanece fixo no banco; labels polidos para legibilidade via #65 / PR #71 (`Tipo C · Contínuo`).
- ⏳ Templates Tally — entra junto com `tally-webhook` da semana 5
- ⏳ Especialidades — adiado pra v2 (texto livre em `persons.specialty` segue suficiente)

---

## Semana 05 — Painel Admin + integrações + polimento

**Goal:** Painel do Admin operacional, Tally/Discord integrados, app migrado pra Operações ativas reais.

### Features

**painel-admin** - COMPLETE (KPIs + atenção imediata + janela crítica + renovações + capacidade + vilões da carteira + pipeline)

**tally-webhook** - PLANNED

- Rota `app/api/webhooks/tally/route.ts`
- Ingestão via n8n (decisão arquitetural — n8n é o hub de webhooks)

**discord-notifications** - COMPLETE (#90) — MVP com 2 eventos

- Outbound via n8n: `frente_stale` (cron diário 08:00 BRT, > 7 dias parado) e `sla_breach` (sync em Server Action + safety net no cron)
- Coluna `operations.notification_webhook_url` (per-Op) + tabela `notifications_log` (audit + dedup 24h)
- Módulo `src/lib/notifications/` (types/payload/dispatcher/detectors/triggers) + payload canônico versionado (`v: 1`)
- Cron `/api/cron/notifications` autenticado por `CRON_SECRET` (Vercel Cron)
- Os 3 eventos restantes (task overdue, decisão vencendo, status parado op-level) entram em issue futura sem refazer a infra

**sla-incidents-ingest** - PLANNED (novo — não estava no roadmap original)

- Ingestão de incidentes de clientes via webhook (inbound via n8n, shared secret)

**dark-mode** - PLANNED (replica tratamento Core do site — preto + sage)

**polish-migration** - PLANNED (migração de Operações ativas reais + ajustes finais + perf + error boundaries)

---

## Bônus implementados fora do roadmap original

Features que entraram durante a execução do MVP e não estavam previstas:

- **profiles** — gating Admin/Membro via tabela `profiles` (habilita `requireAdminAction`)
- **tasks** — gestão de tarefas vinculadas a Frente (status + assignee + tags + opcional Quick Win/incident)
- **clients-enrich** — CNPJ, contato, endereço, sumário no cadastro de Cliente
- **operation-tabs** — organização de `/operations/[id]` em abas (Visão, Vilões, Quick Wins, Frentes, Briefing, Reuniões, Decisões, Custos)
- **operation-costs** — custo fixo mensal + ad-hoc (mensal/única) + alocações com cálculo automático
- **salary-based-costs** — derivação de taxa horária a partir de salário + horas contratadas + valor mensal fechado por alocação
- **link-publico-narrativa** (#67 / PR #68) — 6 seções do relatório premium em `/public/[token]` aba Visão; narrativa por vilão versionada por mês via `operation_villain_narratives`
- **public-report-polish + DRYOS Studio rebrand** (#69 / PR #70) — hero gradient verde, vilões 3-col, conquistas grid, time alocado; sistema renomeado de "DRYOS Delivery" para "DRYOS Studio"
- **frente-cycle-labels** (#65 / PR #71) — helper `formatCycleType{Short,Long}` substitui "TIPO C" sozinho por "Tipo C · Contínuo" em todas as pills/badges
- **service-products-catalog** (#66 / PR #72) — novo catálogo de produtos DRYOS com FK opcional em Frente + auto-fill de cycle_type
- **sidebar-catalog-submenu** (#73 / PR #74) — "Catálogos" vira nav expandível com Vilões/Produtos/Quick Wins como sub-items
- **quick-wins-catalog** (#64 / PR #75) — entregue dentro do catalog-admin acima, listado aqui pra cross-reference
- **catalog-view-toggle** (#76 / PR #77) — toggle Cards/Lista nas 3 páginas de catálogo via searchParam `?view=`
- **operation-members** (#80 / PRs #81 + #82 + #83) — gating de visibilidade por Operação: member só vê Operações atribuídas (tabela `operation_members` + helpers `is_admin()`/`can_see_operation()`), admin vê tudo; RLS reescrita em ~20 tabelas (diretas + cascata clients/persons/profiles); UI admin em `/operations/[id]/settings/members`; estados vazios diferenciados; MRR oculto pra member
- **home-dashboard** (#84 / PR #85) — Home (`/`) reescrita como dashboard grid 2 colunas role-aware: faixa de KPIs (admin com MRR/margem, member enxuto), tabs de status funcionais (`?status=`), coluna principal com Atenção + cards, sidebar com vilões da carteira + Quick Wins. Reusa componentes do `/admin/dashboard` (que segue como deep-dive)
- **mobile-responsive** (#86 / PRs #87 + #88 + #89) — app navegável em mobile/tablet sem zoom horizontal. Shell: `MobileShell` + drawer slide-in (ESC/backdrop/click-outside/auto-close). Listas: novo `MobileListItem` reusável; 3 tables → card list em mobile; 4 grids 12-col stack via `flex-col + md:grid` + truque `md:contents`. Polish: PageHeader wrap, MetricCard text responsive, HomeSidebar grid tablet, TabsNav snap. DS SKILL ganhou seção "Mobile patterns" canônica

---

## Future Considerations (v2+)

- **Credenciais (`bitwarden-integration`)** — AD-009. Avaliar Bitwarden Teams (US$ 4/usr/mês), Bitwarden Free (solo only), ou Vaultwarden self-host. Tabela `credentials` entra junto.
- **DRYOS como Operação interna** — separação de cliente interno vs externo (flag `operations.is_internal` ou `clients.kind` + view `external_operations`). Adiado até agregados de cliente começarem a poluir (sessão 2026-05-18).
- Heatmap visual de capacidade (dado já existe)
- IA gerando resumo automático de status (Claude API)
- Integração Toggl (horas por Frente)
- Integração GitHub (link Frente ↔ repositório)
- Embed/deep link Cockpit do Lançamento nas Edições Tipo D
- App móvel / PWA
- PDF mensal automático
- Cross-sell automatizado
- Multi-idioma
- Vaultwarden self-host (alternativa Bitwarden se mensalidade incomodar)
