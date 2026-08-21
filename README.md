# DRYOS Delivery

Sistema operacional interno da DRYOS para gerir entrega de Core, Sparks e
Studio. Conecta Proposta → Implantação → Operação contínua → Renovação, com a
narrativa dos 7 vilões da marca.

Não é um app público: acesso por login (Supabase Auth), com uma única
superfície aberta — o relatório do cliente em `/public/[token]`, servido por
token revogável.

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
| `npm run gen:types` | regenera `src/lib/db/types.ts` do schema vivo |

`gen:types` roda **depois de cada migration**, e o resultado é commitado.

## Documentação canônica

Leia antes de mexer no código — nesta ordem:

| Arquivo | Para quê |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | princípios, invariantes de implementação, convenções, ritual de PR |
| [`docs/prd.md`](docs/prd.md) | domínio, escopo, decisões de produto |
| [`docs/mockup-v2.html`](docs/mockup-v2.html) | referência visual canônica |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | catálogo de tabelas por módulo |
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
