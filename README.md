# DRYOS Delivery

Sistema operacional interno da DRYOS para gerir entrega de Core, Sparks e
Studio. Conecta Proposta → Implantação → Operação contínua → Renovação, com a
narrativa dos 7 vilões da marca.

Não é um app público: acesso por login (Supabase Auth), com uma única
superfície aberta — o relatório do cliente em `/public/[token]`, servido por
token revogável.

Na interface o produto se apresenta como **DRYOS Studio** — é a marca que o
usuário vê (PR #70). `DRYOS Delivery` é o sistema: repo, docs, `package.json`.
Os dois convivem de propósito; não "corrija" um pro outro.

## Stack

| Camada | Escolha |
|---|---|
| Frontend | Next.js 16 App Router (React 19), TypeScript estrito |
| Banco | Supabase Postgres — queries diretas, sem ORM, RLS em toda tabela |
| Auth / Storage | Supabase |
| Estilo | Tailwind 4 (CSS-first via `@theme`) + shadcn/ui customizado |
| Ícones / gráficos | Lucide React · Recharts |
| Tipografia | Funnel Display + Onest + JetBrains Mono via `next/font/google` |
| Hospedagem | Vercel |

Integrações que o sistema **não** substitui: Bitwarden (senhas), Tally
(formulários), Discord (chat), Toggl (tempo). Detalhe em `docs/prd.md`.

## Rodar local

```bash
npm install
cp .env.local.example .env.local   # preencher com as chaves do projeto Supabase
npm run dev                        # http://localhost:3000
```

Sem `.env.local` preenchido o app não sobe — `requiredEnv` lança na
inicialização do cliente Supabase, de propósito.

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (`src/**/*.test.ts`) |
| `npm run gen:types` | regenera `src/lib/db/types.ts` do schema vivo |

`gen:types` roda **depois de cada migration**, e o resultado é commitado.

**Notificações / cron:** defina `CRON_SECRET` e, para enviar o resumo diário agregado e usar webhook global quando a Operação não tem URL, `NOTIFICATION_WEBHOOK_URL` (HTTPS, ver `checkWebhookUrl`). Ver `docs/DATABASE_SCHEMA.md` (`notifications_log`).

**Convites / admin (service role):** em produção defina `SUPABASE_SERVICE_ROLE_KEY` (mesmo segredo que o Dashboard chama de *service_role*). Server Actions de `/admin` que convidam usuários leem essa variável; o nome legado `SUPABASE_SECRET_KEY` ainda é aceito como fallback. Nunca exponha no cliente.

**MCP / token de agente (`mcp_agt_`):** com JWT Signing Keys (ES256), o servidor troca o token estático por um **access token GoTrue** (service role + chave publicável; sem exportar chave privada). Legado HS256 ainda suportado via `SUPABASE_JWT_SECRET`. Ver `docs/agent-supabase.md` e `MCP_SESSION_STRATEGY`.

## Documentação canônica

Leia antes de mexer no código — nesta ordem:

| Arquivo | Para quê |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | princípios, invariantes de implementação, convenções, ritual de PR |
| [`docs/prd.md`](docs/prd.md) | domínio, escopo, decisões de produto |
| [`docs/mockup-v2.html`](docs/mockup-v2.html) | referência visual canônica |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | catálogo de tabelas por módulo |
| [`docs/agent-supabase.md`](docs/agent-supabase.md) | usuário agente (IA) e Supabase — papel, RLS, o que ler/escrever |
| [`docs/workflows/`](docs/workflows/) | fluxos end-to-end |
| [`docs/audits/`](docs/audits/) | auditorias — registro datado, não se edita |
| [`.specs/project/STATE.md`](.specs/project/STATE.md) | estado atual e histórico de decisões (AD-s) |
| `.claude/skills/` | convenções de código e design system, em detalhe |

## Como contribuir

O ritual está no `CLAUDE.md` e vale também pra humano:

1. Issue no GitHub **antes** de implementar.
2. Branch `feat/<area>-<descricao>` (ou `chore/`, `fix/`).
3. Commits em inglês, imperativo, minúsculo, sem ponto final.
4. Doc afetado atualizado no mesmo branch — documentação stale é bug.
5. PR com `Closes #N`, revisado antes do merge (auto-review serve).

Migrations nunca são editadas depois do commit: sempre uma nova, com RLS e
`COMMENT ON TABLE` na mesma migration.
