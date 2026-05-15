# DRYOS Delivery

Sistema operacional interno da DRYOS para gerir entrega de Core, Sparks e Studio. Conecta Proposta → Implantação → Operação contínua → Renovação, com narrativa dos 7 vilões da marca.

**Documento canônico:** `docs/prd.md`
**Referência visual canônica:** `docs/mockup-v2.html`

---

## Princípios não-negociáveis

Toda decisão de design e código passa por estes filtros antes de virar PR:

1. **Sistema é mapa, não cofre.** Bitwarden guarda senha. Delivery guarda referência.
2. **Decisão ≠ tarefa.** Decisão é registro perpétuo. Tarefa executa. Tabelas separadas.
3. **Operação não termina; Frentes vão e vêm.** Operação Core nunca tem `end_date`. Frentes têm.
4. **Status acionável obrigatório.** Format "aguardando X de Y desde Z". Validação no banco. "Em andamento" é bug.
5. **Tudo escrito como se cliente fosse ler.** Exceto explicitamente interno (flag `visibility`).
6. **Os 7 vilões são universo de marca.** Sem custom por cliente. Seed do banco, nunca delete (apenas archive).
7. **Não substituir o que funciona fora.** Toggl, GitHub, Discord, Cockpit ficam fora.
8. **Cream papel é padrão.** Modo escuro replica o tratamento Core do site (preto + sage).
9. **Pills coloridas são o sistema canônico de status.** 5 cores cobrem tudo (neutra, oak, sage, warning, critical). Adicionar nova é decisão deliberada, não improviso.
10. **Ícones são funcionais, nunca decorativos.** Lucide React, stroke 1.75.
11. **Hierarquia tipográfica calibrada.** Funnel Display 600-700 só pra hero/KPIs/nomes. Onest 500-600 em 14-16px no resto.

---

## Modelo de domínio (resumido)

```
Cliente
  └─ Operação (contrato comercial — preço, recorrência)
        └─ Frente (entrega — ciclo + domínio)
              ├─ Tipo de ciclo: A | B | C | D | E
              └─ Domínio: Infra | Dados Analíticos | Dados Técnicos
```

**Tipos de ciclo da Frente:**
- **A** Finito puro (Studio Custom)
- **B** Finito → recorrente (Studio com cláusula)
- **C** Contínuo desde o início (Core, Sparks)
- **D** Episódico recorrente (Edições de Studio Launch)
- **E** Contínuo de manutenção (Evergreen)

**Entidades principais:** Cliente, Operação, Frente, Pessoa (interna/externa), Alocação, Briefing, Reunião, Decisão, Vilão, Diagnóstico, Quick Win, Credencial (ref Bitwarden), Anexo, SLA, Template de Formulário, Notificação.

**Papéis:** Admin · Membro · Visualizador externo (token).

Detalhes completos em `docs/prd.md` seção 04.

---

## Stack técnico

| Camada | Escolha |
|---|---|
| Banco | Supabase Postgres (sem ORM, queries diretas + types gerados) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Frontend | Next.js 15 App Router |
| Estilo | Tailwind + shadcn/ui customizado |
| Ícones | Lucide React |
| Gráficos | Recharts |
| Tipografia | Funnel Display + Onest + JetBrains Mono (Google Fonts) |
| Hospedagem | Vercel |
| Cofre senhas | Bitwarden Teams (API) |
| Formulários | Tally (webhook) |
| Notificações | Discord (webhook) |
| Linguagem | TypeScript estrito (sem `any`) |

---

## Convenções de código

### TypeScript
- `strict: true` no tsconfig
- Sem `any` — usa `unknown` quando necessário
- Prefer `type` para shapes simples, `interface` para extensão
- Types do banco gerados via `supabase gen types typescript` em `src/lib/db/types.ts`

### Naming
- Componentes: PascalCase (`OperationCard.tsx`)
- Hooks: camelCase começando com `use` (`useOperations.ts`)
- Tipos/Interfaces: PascalCase (`Operation`, `FrenteWithRelations`)
- Funções utilitárias: camelCase (`formatCurrency`)
- Arquivos não-componente: kebab-case (`status-validator.ts`)
- Tabelas Postgres: snake_case plural (`operations`, `quick_wins`)
- Colunas: snake_case (`created_at`, `client_id`)
- Enums no banco: snake_case (`frente_cycle_type`)

### Estrutura de pastas
```
/src
  /app                 # Next.js App Router
    /(app)             # Rotas autenticadas
    /(public)          # Link público com token
    /api               # Webhooks (Tally, Discord)
  /components
    /ui                # shadcn/ui customizado (Button, Pill, Card)
    /domain            # Componentes de domínio (OperationCard, VillainCard)
  /lib
    /db                # Cliente Supabase, types, queries
    /utils             # Utilitários puros
    /validators        # Validações Zod
  /styles              # globals.css com tokens
/supabase
  /migrations          # Migrations versionadas
  /seed                # Seeds (vilões, catálogo de quick wins)
/docs
  prd.md
  mockup-v2.html
```

### Queries Supabase
- Sempre via cliente tipado em `src/lib/db/client.ts`
- RLS habilitado em todas as tabelas (princípio do menor privilégio)
- Policies escritas em SQL, versionadas em migration
- Mutations via Server Actions (Next.js) ou Route Handlers
- Sem SDK ORM (Prisma/Drizzle) — Supabase client direto

### Git
- Branch principal: `main`
- Branches de feature: `feat/<area>-<descricao-curta>` (ex: `feat/frente-status-validator`)
- Commits: imperativo, minúsculo, sem ponto final
  - Bom: `add migration for villains seed`
  - Ruim: `Added villains migration.`
- PRs revisados antes de merge, mesmo solo (auto-review serve)

---

## O que NÃO construir

Estas decisões são contrato. Se a tentação surgir num PR, recusar:

- ❌ Gerenciador de senhas próprio → Bitwarden
- ❌ Form builder próprio → Tally
- ❌ Chat interno → Discord
- ❌ Time tracking → Toggl (futuro)
- ❌ ORM com migrations gerencidas pelo ORM → Supabase migrations puras
- ❌ State management global pesado (Redux, Zustand) — começa com server state + React state local
- ❌ CSS-in-JS (styled-components, emotion) — Tailwind puro
- ❌ Framer Motion no MVP — só IntersectionObserver pra reveal animations

---

## Skills locais

Antes de criar componente ou rodar query, Claude lê:

- `.claude/skills/dryos-conventions/SKILL.md` — convenções de código detalhadas
- `.claude/skills/dryos-design-system/SKILL.md` — DS v2 com tokens, componentes, padrões

---

## MCP servers conectados

- **Supabase MCP** — Claude pode listar tabelas, rodar migrations, executar SQL via MCP. Use proativamente em vez de pedir pro usuário rodar comandos.

---

## Pra cada sessão

Comece toda sessão de trabalho lendo:
1. Este arquivo (já carregado automaticamente)
2. `docs/prd.md` se precisar de detalhe de domínio
3. `docs/mockup-v2.html` se precisar de referência visual
4. Skills em `.claude/skills/` quando for criar código

Em caso de dúvida sobre uma decisão de design ou modelo, **consulta o PRD antes de pedir clarificação ao usuário** — provavelmente já está respondido lá.

---

## Cronograma do MVP (5 semanas)

| Sem | Foco |
|---|---|
| 01 | Setup + Schema + Auth + Bitwarden integration |
| 02 | CRUD base (Cliente, Operação, Frente, Pessoa, Alocação) + componentes base DS |
| 03 | Briefing, Reuniões, Decisões, Anexos, SLA, status acionável, link público (esqueleto) |
| 04 | Diagnóstico, Vilões, Quick Wins, Catálogo administrativo |
| 05 | Painel Admin + Tally + Discord + polimento + migração |

---

`— Última revisão: maio 2026`
