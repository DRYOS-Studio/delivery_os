# Roadmap

**Current Milestone:** Semana 05 — Painel Admin + integrações + polimento
**Status:** Semanas 01–04 majoritariamente COMPLETE. Pendente: catálogo administrativo (parcial), integrações (Tally/Discord via n8n), dark-mode, polish-migration.

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

**catalog-admin** - PARTIAL

- ✅ Vilões (CRUD admin completo)
- ❌ Quick Wins catálogo editável (UI admin)
- ❌ Tipos de Frente (catálogo administrativo — hoje hard-coded)
- ❌ Templates Tally (entra junto com `tally-webhook` da semana 5)
- ❌ Especialidades (catálogo de specialties pra pessoas internas)

---

## Semana 05 — Painel Admin + integrações + polimento

**Goal:** Painel do Admin operacional, Tally/Discord integrados, app migrado pra Operações ativas reais.

### Features

**painel-admin** - COMPLETE (KPIs + atenção imediata + janela crítica + renovações + capacidade + vilões da carteira + pipeline)

**tally-webhook** - PLANNED

- Rota `app/api/webhooks/tally/route.ts`
- Ingestão via n8n (decisão arquitetural — n8n é o hub de webhooks)

**discord-notifications** - PLANNED

- Outbound via n8n (eventos: status parado +7d, decisão vencendo, SLA estourado, task overdue, Frente stale)

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
