# Roadmap

**Current Milestone:** Semana 01 — Setup + Schema + Auth
**Status:** In Progress (week-01-setup COMPLETE; auth + bitwarden-integration PLANNED)

---

## Semana 01 — Setup + Schema + Auth + Bitwarden

**Goal:** Repo arrancado em Next.js 15 + TypeScript estrito, DS v2 com tokens e fontes carregadas, estrutura de pastas pronta, schema base no Supabase com RLS, Auth funcionando, integração Bitwarden capaz de listar item.
**Target:** Fim da semana 01 do MVP.

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

**auth** - PLANNED

- Supabase Auth (email magic link como mínimo)
- Middleware de proteção de rotas em `(app)`
- Páginas de login/logout
- Hook `useUser` + helper server-side

**bitwarden-integration** - PLANNED

- Cliente Bitwarden API (`src/lib/integrations/bitwarden.ts`)
- Tabela `credentials` referenciando `bitwarden_item_id` + `bitwarden_vault_id`
- Sanity check: listar vaults / items via API

---

## Semana 02 — CRUD base + componentes DS

**Goal:** Time interno consegue criar/editar Cliente, Operação, Frente, Pessoa, Alocação via UI. Componentes base do DS (Pill, Card, Avatar, Icon, Button, KpiCard) prontos.

### Features

**ui-foundation** - PLANNED

- Componentes UI: `Pill`, `Card`, `Avatar`, `Icon`, `Button`
- Layout: `Sidebar`, `PageHeader`
- Hook `useReveal` + CSS

**clients-crud** - PLANNED
**operations-crud** - PLANNED
**frentes-crud** - PLANNED (com state machine de ciclo A-E + status acionável validado)
**persons-crud** - PLANNED
**allocations-crud** - PLANNED

---

## Semana 03 — Briefing, Reuniões, SLA, link público (esqueleto)

**Goal:** Documentos vivos da Operação (Briefing, Reuniões, Decisões, Anexos, SLA) operacionais. Esqueleto do link público com token funcionando.

### Features

**briefing-vivo** - PLANNED (com histórico de alterações + origem)
**meetings-decisions** - PLANNED (com visibility independente Reunião/Decisão)
**attachments** - PLANNED (Supabase Storage, path `<operation_id>/`)
**sla** - PLANNED (campos estruturados em operações)
**status-acionavel** - PLANNED (UI + validação no banco)
**public-link-skeleton** - PLANNED (token RPC, view read-only)

---

## Semana 04 — Diagnóstico, Vilões, Quick Wins, Catálogo

**Goal:** Narrativa dos vilões funcional ponta a ponta: diagnóstico → vilões em luta na Operação → Quick Wins com impacto capped por vilão. Catálogo administrativo editável.

### Features

**villains-seed** - PLANNED (7 vilões canônicos, archive-only)
**diagnostic** - PLANNED (vilões detectados + severidade inicial congelada)
**operation-villains** - PLANNED (progresso % derrotado, capped 0-100)
**quick-wins** - PLANNED (catálogo + impacto, soma capped em 100% por vilão)
**catalog-admin** - PLANNED (vilões, quick wins, tipos de Frente, templates Tally, especialidades)

---

## Semana 05 — Painel Admin + integrações + polimento

**Goal:** Painel do Admin operacional, Tally/Discord integrados, app migrado pra Operações ativas reais.

### Features

**admin-panel** - PLANNED (KPIs + atenção imediata + janela crítica + renovações + capacidade + vilões da carteira + pipeline)
**tally-webhook** - PLANNED (rota `app/api/webhooks/tally/route.ts`)
**discord-notifications** - PLANNED (eventos: status parado +7d, decisão vencendo, SLA estourado, etc)
**dark-mode** - PLANNED (replica tratamento Core do site)
**polish-migration** - PLANNED (migração de Operações ativas + ajustes finais)

---

## Future Considerations (v2+)

- Heatmap visual de capacidade (dado já existe)
- IA gerando resumo automático de status (Claude API)
- Integração Toggl (horas por Frente)
- Integração GitHub (link Frente ↔ repositório)
- Embed/deep link Cockpit do Lançamento nas Edições Tipo D
- App móvel / PWA
- PDF mensal automático
- Cross-sell automatizado
- Open Finance (não aplicável — herança de outro projeto, ignorar)
- Multi-idioma
- Vaultwarden self-host (alternativa Bitwarden se mensalidade incomodar)
