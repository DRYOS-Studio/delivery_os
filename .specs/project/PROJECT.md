# DRYOS Delivery

**Vision:** Sistema operacional interno da DRYOS para gerir entrega de Core, Sparks e Studio — conecta Proposta → Implantação → Operação contínua → Renovação com narrativa dos 7 vilões da marca.
**For:** Time interno da DRYOS (Admin, Membro) + clientes via link público com token.
**Solves:** PMs genéricos (Asana, ClickUp, Monday, Notion) não modelam ciclo de vida estendido (Core/Spark não terminam), não conectam diagnóstico → entrega → relatório (vilões), e não separam Infra de Dados na entrega.

## Goals

- 100% das Operações ativas migradas pro Delivery em 30 dias após go-live; 100% das Frentes com status acionável atualizado ≥1x/semana.
- Zero credencial de cliente fora do Bitwarden e zero briefing em PDF do Drive em 90 dias.
- Vilões/quick wins viram gancho comercial em ≥50% das propostas em 6 meses.

## Tech Stack

**Core:**

- Framework: Next.js 16 (App Router, React 19)
- Language: TypeScript estrito (strict + noUncheckedIndexedAccess + noImplicitOverride + exactOptionalPropertyTypes)
- Database: Supabase Postgres (sem ORM, queries diretas + types gerados)

**Key dependencies:**

- Tailwind 4 (CSS-first via `@theme inline` em `globals.css`) + shadcn/ui customizado (Radix)
- Lucide React (ícones, stroke 1.75)
- Recharts (gráficos)
- next/font (Funnel Display + Onest + JetBrains Mono)
- Zod (validação)

**Integrações obrigatórias MVP:** Supabase Auth/Storage, Bitwarden Teams (API), Tally (webhook), Discord (webhook).

## Scope

**v1 (MVP, 5 semanas) inclui:**

- CRUD: Cliente, Operação, Frente, Pessoa, Alocação
- Ciclos da Frente A/B/C/D/E + domínios (Infra / Dados Analíticos / Dados Técnicos)
- Briefing vivo com histórico, Reuniões + Decisões (visibility), Diagnóstico + Vilões + Quick Wins
- Catálogo administrativo (vilões, quick wins, tipos de Frente, templates Tally, especialidades)
- Credenciais (referência Bitwarden), Anexos (Storage), SLA estruturado por Operação
- Status acionável validado no banco; Home, Operação aberta, Painel Admin, Link público com token
- Modo escuro replicando tratamento Core; Tally e Discord via webhook; papéis Admin/Membro/Visualizador externo

**Explicitly out of scope:**

- Cofre de senhas próprio, form builder próprio, chat interno, time tracking — Bitwarden/Tally/Discord/Toggl ficam fora
- ORM (Prisma/Drizzle), state management global pesado (Redux/Zustand padrão), CSS-in-JS, Framer Motion no MVP
- Heatmap visual de capacidade, IA gerando resumo de status, app móvel, multi-idioma, PDF mensal automático, cross-sell automatizado, Open Finance, embed do Cockpit

## Constraints

- Timeline: 5 semanas (cronograma em ROADMAP.md). Solo dev (Rafael).
- Technical: TypeScript estrito sem `any`. RLS em toda tabela. Status acionável validado no banco. Pills coloridas como sistema canônico de status (6 cores, sem expansão deliberada).
- Resources: Bitwarden Teams (~US$ 4/usuário/mês), Tally (free), Discord (free), Supabase free/pro, Vercel free/pro.

## Documentos canônicos

- `docs/prd.md` — PRD v1.1 (fonte da verdade do domínio e princípios)
- `docs/mockup-v2.html` — referência visual canônica
- `CLAUDE.md` — princípios, invariantes de implementação, convenções
- `.claude/skills/dryos-conventions/SKILL.md` — convenções de código detalhadas
- `.claude/skills/dryos-design-system/SKILL.md` — DS v2 (tokens, componentes, padrões)
