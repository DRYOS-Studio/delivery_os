# week-01-setup Tasks

**Design**: `.specs/features/week-01-setup/design.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Bootstrap (Sequential)

```
T1 → T2 → T3
```

### Phase 2: DS foundation (Parallel after T3)

```
       ┌→ T4 ─┐
T3 ────┤      ├─→ T7
       └→ T6 ─┘
```

(T5 foi mergeada em T4 — Tailwind 4 é CSS-first, sem `tailwind.config.ts`. AD-005.)

### Phase 3: DB schema (Parallel with Phase 2)

```
T1 ──→ T8 ──→ T9 ──→ T10
```

T8/T9/T10 podem rodar em paralelo com T4-T7 (não dependem das pastas DS).

### Phase 4: Integration (Sequential)

```
T7, T10 ──→ T11 ──→ T12 ──→ T13
```

---

## Task Breakdown

### T1: Bootstrap em `/tmp` + copiar pra worktree + `npm install`

**What**: Bootstrap do projeto Next.js (latest = 16.2 + React 19.2 + Tailwind 4) em `/tmp/dryos-bootstrap`, copiar artefatos relevantes pra worktree, rodar `npm install`. Sobrescrever apenas o `CLAUDE.md` mínimo gerado; manter `AGENTS.md`.
**Where**: bootstrap em `/tmp/dryos-bootstrap`; destino: raiz do worktree.
**Depends on**: None
**Reuses**: CLI `create-next-app@latest`

**Tools**:
- Bash:
  - `rm -rf /tmp/dryos-bootstrap`
  - `npx --yes create-next-app@latest /tmp/dryos-bootstrap --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm --skip-install --yes`
  - Copiar arquivos da raiz (`package.json`, `package-lock.json` se existir, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `AGENTS.md`, `README.md`, `.gitignore`, `src/`, `public/`) — **exceto** o `CLAUDE.md` gerado (não copiar).
  - `npm install` na worktree

**Done when**:
- [ ] `package.json` na raiz com `next` (^16), `react` (^19), `tailwindcss` (^4), `@tailwindcss/postcss` (^4)
- [ ] `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` existem (defaults — vão ser reescritos em T6/T7/T4)
- [ ] `tsconfig.json` na raiz com `paths: { "@/*": ["./src/*"] }` (T2 vai adicionar flags estritas)
- [ ] `postcss.config.mjs` na raiz com `"@tailwindcss/postcss"`
- [ ] `next.config.ts` na raiz
- [ ] `next-env.d.ts` na raiz
- [ ] `AGENTS.md` na raiz (preservado, AD-006)
- [ ] `.gitignore` inclui `node_modules`, `.next`, `.env*.local`
- [ ] `node_modules/` populado após `npm install`
- [ ] `CLAUDE.md` do worktree **não foi sobrescrito** (continua com 404 linhas)
- [ ] **Sem `tailwind.config.ts`** (Tailwind 4 é CSS-first)

**Verify**:
```bash
test -f package.json && \
  test -d src/app && \
  test -f AGENTS.md && \
  test -f postcss.config.mjs && \
  grep -q "@/\*" tsconfig.json && \
  ! test -f tailwind.config.ts && \
  grep -q "Princípios não-negociáveis" CLAUDE.md && \
  echo OK
```

---

### T2: Ajustar `tsconfig.json` para estrito completo

**What**: Adicionar `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` ao `compilerOptions`.
**Where**: `tsconfig.json` (raiz)
**Depends on**: T1
**Reuses**: Snippet do skill `dryos-conventions` seção "TypeScript"

**Done when**:
- [ ] `compilerOptions.strict` = `true`
- [ ] `compilerOptions.noUncheckedIndexedAccess` = `true`
- [ ] `compilerOptions.noImplicitOverride` = `true`
- [ ] `compilerOptions.exactOptionalPropertyTypes` = `true`
- [ ] `npm run typecheck` (após T13 adicionar o script) passa sem erro

**Verify**:
```bash
node -e "const c=require('./tsconfig.json').compilerOptions; \
  process.exit(c.strict && c.noUncheckedIndexedAccess && c.noImplicitOverride && c.exactOptionalPropertyTypes ? 0 : 1)"
```

---

### T3: Criar estrutura de pastas conforme `dryos-conventions`

**What**: Criar todas as pastas listadas no skill, com `.gitkeep` nas vazias.
**Where**: `src/app/(app)/`, `src/app/(public)/`, `src/app/api/webhooks/tally/`, `src/app/api/webhooks/discord/`, `src/components/ui/`, `src/components/domain/`, `src/components/layout/`, `src/lib/db/queries/`, `src/lib/utils/`, `src/lib/validators/`, `src/lib/integrations/`, `src/lib/actions/`, `src/styles/`, `supabase/migrations/`, `supabase/seed/`, `docs/` (se ainda não existe)
**Depends on**: T1
**Reuses**: Árvore do skill `dryos-conventions`

**Tools**: Bash (`mkdir -p` + `touch .gitkeep`)

**Done when**:
- [ ] Todas as 17+ pastas existem
- [ ] Pastas vazias têm `.gitkeep`
- [ ] `git status -uall` lista as novas pastas

**Verify**:
```bash
for p in src/app/{(app),(public),api/webhooks/tally,api/webhooks/discord} \
         src/components/{ui,domain,layout} \
         src/lib/{db,db/queries,utils,validators,integrations,actions} \
         src/styles supabase/{migrations,seed}; do
  test -d "$p" || { echo "MISSING $p"; exit 1; }
done && echo OK
```

---

### T4: Escrever `src/styles/globals.css` com tokens DS v2 + `@theme inline` [P]

**What**: Substituir o `globals.css` default pelo bloco completo do skill DS v2 — `@import "tailwindcss"`, CSS vars `:root` light + `body.dark` overrides, e bloco `@theme inline` mapeando vars pra classes Tailwind 4. Mover de `src/app/globals.css` (default do create-next-app) pra `src/styles/globals.css`; ajustar import no `layout.tsx` em T6.
**Where**: `src/styles/globals.css`
**Depends on**: T3
**Reuses**: Skill `dryos-design-system` seções "Cores" (vars) + "Tailwind 4 — CSS-first config" (`@theme inline`) verbatim

**Done when**:
- [ ] Topo: `@import "tailwindcss";`
- [ ] Bloco `:root { --bg: #FAFAF8; --oak: #1F3A2A; ... }` com TODAS as vars (bg, surface, card, ink, ink-soft, mute, mute-soft, oak, oak-light, oak-50, sage, sage-bg, sage-deep, line, line-strong, critical, critical-bg, warning, warning-bg, ok, ok-bg, shadow-sm/md/lg, radius-sm/DEFAULT/lg/pill)
- [ ] Bloco `body.dark { ... }` com overrides
- [ ] Bloco `@theme inline { ... }` mapeando: `--color-*` pra cada cor, `--font-display/body/mono` lendo vars do next/font, `--radius-*`, `--shadow-*`
- [ ] Arquivo antigo `src/app/globals.css` removido (ou esvaziado se ainda referenciado)

**Verify**:
```bash
grep -q "^  --bg: #FAFAF8;" src/styles/globals.css && \
  grep -q "^  --oak: #1F3A2A;" src/styles/globals.css && \
  grep -q "^body.dark" src/styles/globals.css && \
  grep -q "^@theme inline" src/styles/globals.css && \
  grep -q "--color-oak: var(--oak);" src/styles/globals.css && echo OK
```

**Nota**: T5 da versão anterior foi mergeada aqui. Sem `tailwind.config.ts` em Tailwind 4.

---

### T6: Reescrever `src/app/layout.tsx` com next/font e tokens [P]

**What**: Substituir o layout default pelo snippet adaptado do skill DS — 3 fontes via `next/font/google` (Funnel Display, Onest, JetBrains Mono) como CSS vars `--font-funnel-display`/`--font-onest`/`--font-jetbrains-mono`, `lang="pt-BR"`, body com classes `font-body bg-bg text-ink-soft antialiased`. Importar `../styles/globals.css`.
**Where**: `src/app/layout.tsx`
**Depends on**: T3, T4 (precisa do globals.css em `src/styles/`)
**Reuses**: Skill `dryos-design-system` seção "Tipografia" snippet `RootLayout`

**Done when**:
- [ ] Imports `Funnel_Display`, `Onest`, `JetBrains_Mono` de `next/font/google`
- [ ] Cada fonte com `subsets: ['latin']`, `weight: [...]`, `variable: '--font-funnel-display'`/`'--font-onest'`/`'--font-jetbrains-mono'`, `display: 'swap'`
- [ ] `<html lang="pt-BR">` com classes das 3 vars
- [ ] `<body className="font-body bg-bg text-ink-soft antialiased">`
- [ ] `metadata` exportado com `title: 'DRYOS Delivery'` e `description: 'Sistema operacional interno da DRYOS.'`
- [ ] Import `../styles/globals.css` no topo (em vez de `./globals.css` default)
- [ ] Compatível com APIs do Next 16 (consultar `node_modules/next/dist/docs/` se houver dúvida — AD-006)

**Verify**: `npm run dev`, abrir `localhost:3000`, devtools mostra `font-family: 'Onest'` no body e `background-color: rgb(250, 250, 248)`.

---

### T7: Substituir `src/app/page.tsx` por placeholder

**What**: Página inicial mínima que prova que app sobe com fontes/tokens aplicados.
**Where**: `src/app/page.tsx`
**Depends on**: T4, T5, T6
**Reuses**: Nada (placeholder)

**Done when**:
- [ ] Renderiza `<main className="p-7"><h1 className="font-display text-2xl text-ink">DRYOS Delivery</h1><p className="font-mono text-xs text-mute mt-2">— semana 01 · setup</p></main>` ou similar
- [ ] Sem componentes shadcn (não temos ainda)
- [ ] `npm run dev` sobe sem erro

**Verify**:
```bash
npm run typecheck
```
+ visual: `localhost:3000` mostra "DRYOS Delivery" em Funnel Display, "— semana 01 · setup" em mono.

---

### T8: Escrever migration `20260515000001_initial_schema.sql`

**What**: Migration SQL completa: enums, 5 tabelas, FKs nomeadas, CHECKs dos invariantes, trigger updated_at, COMMENTs, RLS, policies básicas. Idempotente.
**Where**: `supabase/migrations/20260515000001_initial_schema.sql`
**Depends on**: T1 (precisa de `supabase/migrations/` da T3 também, mas T3 vem cedo)
**Reuses**: Skill `dryos-conventions` (CHECK status acionável), CLAUDE.md Invariantes 1, 2, 4, 10, 11, 12, design.md "Data Models" seção inteira

**Tools**: Write (apenas SQL local; aplicação remota = T11)

**Done when**:
- [ ] Cria os 8 enums via `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` (product_line, frente_cycle_type, frente_domain, operation_status, frente_phase, person_kind, allocation_role, recurrence)
- [ ] Cria função `public.set_updated_at()` via `CREATE OR REPLACE`
- [ ] Cria 5 tabelas com `CREATE TABLE IF NOT EXISTS`: `clients`, `operations`, `frentes`, `persons`, `allocations`
- [ ] Cada tabela com FKs nomeadas (`fk_<tabela>_<coluna>`) e ON DELETE conforme design
- [ ] CHECK do status acionável em `frentes` (2 constraints: comprimento + lista de genéricos)
- [ ] CHECK de consistência em `persons` (kind/specialty/external_role/client_id mutuamente exclusivos)
- [ ] CHECK de `capacity_weekly_pct` BETWEEN 0 AND 100 em `allocations`
- [ ] Trigger `trg_<tabela>_updated_at` em cada tabela com `updated_at` (todas exceto `allocations` se a gente quiser; mas pus em todas)
- [ ] `COMMENT ON TABLE` em cada uma (formato do CLAUDE.md)
- [ ] `ENABLE ROW LEVEL SECURITY` nas 5
- [ ] Policy `authenticated_full_access FOR ALL TO authenticated USING (true) WITH CHECK (true)` em cada (via `DROP POLICY IF EXISTS` + `CREATE POLICY`)

**Verify**: T9 cobre — aplicar e testar.

---

### T9: Validar migration em DB local (Supabase CLI ou MCP em projeto novo)

**What**: Aplicar a migration e rodar bateria de testes (acceptance criteria do spec P1 #3).
**Where**: Supabase local (via `supabase init` + `supabase start`) OU projeto Supabase via MCP — depende de B-001 resolvido.
**Depends on**: T8 (e decisão B-001)
**Reuses**: N/A

**Tools**:
- Bash: `supabase init`, `supabase start`, `supabase db reset`, OU
- Supabase MCP: `apply_migration` + `execute_sql`

**Done when**:
- [ ] Migration aplica em DB limpo sem erro
- [ ] INSERT em `frentes` com `actionable_status='em andamento'` falha com erro `23514`
- [ ] INSERT em `frentes` com `actionable_status='ok'` (12 chars) falha (length)
- [ ] INSERT em `persons (kind='internal', specialty='Dev')` aceita
- [ ] INSERT em `persons (kind='internal', specialty=null)` falha
- [ ] INSERT em `persons (kind='external', external_role='Diretor', client_id=null)` falha
- [ ] INSERT em `allocations (capacity_weekly_pct=150)` falha
- [ ] Migration aplicada duas vezes seguidas: segunda é no-op (sem erro)
- [ ] `SELECT obj_description('public.clients'::regclass)` retorna comentário

**Verify**:
```sql
-- bateria de testes em supabase/seed/test_invariants.sql (descartável)
INSERT INTO public.clients (name, slug) VALUES ('Acme', 'acme') RETURNING id;
-- ... (script completo escrito em T9)
```

---

### T10: Gerar `src/lib/db/types.ts` via Supabase CLI/MCP

**What**: Rodar `supabase gen types typescript` apontando pro DB com a migration aplicada; commitar o output.
**Where**: `src/lib/db/types.ts`
**Depends on**: T9 (migration aplicada)
**Reuses**: CLI Supabase ou MCP `generate_typescript_types`

**Done when**:
- [ ] `src/lib/db/types.ts` existe e contém `export type Database = { ... }`
- [ ] Tipos das 5 tabelas presentes (`Database['public']['Tables']['clients']['Row']`, etc)
- [ ] Tipos dos 8 enums presentes
- [ ] `npm run typecheck` passa

**Verify**:
```bash
grep -q "clients:" src/lib/db/types.ts && \
  grep -q "frentes:" src/lib/db/types.ts && \
  grep -q "frente_cycle_type" src/lib/db/types.ts && echo OK
```

---

### T11: Criar `src/lib/db/client.ts` com `createServer`/`createBrowser` (P2)

**What**: Helpers tipados pra criar cliente Supabase no server e no browser usando `@supabase/ssr`.
**Where**: `src/lib/db/client.ts`
**Depends on**: T10
**Reuses**: Pattern do skill `dryos-conventions` seção "Supabase / Cliente"

**Tools**: Bash (`npm install @supabase/ssr @supabase/supabase-js`)

**Done when**:
- [ ] Função `createServer(): Promise<SupabaseClient<Database>>` lê cookies de `next/headers` (`cookies()`)
- [ ] Função `createBrowser(): SupabaseClient<Database>` usa env vars públicas
- [ ] Tipos importados de `./types`
- [ ] `npm run typecheck` passa

**Verify**:
```bash
node -e "require('typescript').createProgram(['src/lib/db/client.ts'], {strict: true, noEmit: true}).emit()" 2>&1 | grep -q "error" && exit 1 || echo OK
```

---

### T12: Escrever `.env.local.example` documentado (P2)

**What**: Arquivo template com as variáveis do MVP semana 1.
**Where**: `.env.local.example` (raiz)
**Depends on**: T11 (pra confirmar quais vars o cliente usa)
**Reuses**: CLAUDE.md seção "Stack técnico" + design

**Done when**:
- [ ] Linhas (cada com comentário 1-linha):
  - `NEXT_PUBLIC_SUPABASE_URL=` (URL do projeto Supabase)
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` (anon/publishable key — usada no browser)
  - `SUPABASE_SECRET_KEY=` (service role — server-only, NUNCA expor)
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000` (base URL pra links públicos)
- [ ] `.env.local` adicionado ao `.gitignore` (já vem do create-next-app, mas confirmar)

**Verify**:
```bash
grep -q "^NEXT_PUBLIC_SUPABASE_URL=" .env.local.example && \
  grep -q "^SUPABASE_SECRET_KEY=" .env.local.example && \
  grep -q "^\.env\*\.local" .gitignore && echo OK
```

---

### T13: Ajustar scripts `package.json`

**What**: Adicionar `typecheck` e `gen:types` aos scripts (create-next-app já dá `dev`, `build`, `start`, `lint`).
**Where**: `package.json`
**Depends on**: T1
**Reuses**: CLAUDE.md + design

**Done when**:
- [ ] `scripts.typecheck` = `"tsc --noEmit"`
- [ ] `scripts["gen:types"]` = `"supabase gen types typescript --linked > src/lib/db/types.ts"` (ou `--local` se preferir)
- [ ] `scripts.dev`, `build`, `start`, `lint` mantidos

**Verify**:
```bash
node -e "const s=require('./package.json').scripts; \
  process.exit(s.typecheck && s['gen:types'] ? 0 : 1)"
```

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2 ──→ T3

Phase 2 (após T3, paralelo):
    ├── T4 [P]  (globals.css)
    ├── T5 [P]  (tailwind.config.ts)
    └── T6 [P]  (layout.tsx)  ← depende também de T4 pra import
                          → T7 (page.tsx placeholder)

Phase 3 (paralelo com Phase 2, após T1):
  T8 (migration) ──→ T9 (aplicar+validar) ──→ T10 (gen types)

Phase 4 (após T7 e T10):
  T11 (db/client.ts) ──→ T12 (.env.example) ──→ T13 (package.json scripts)
```

Caminho crítico: T1 → T2 → T3 → T6 → T7 (DS) **OR** T1 → T8 → T9 → T10 → T11 → T12 → T13 (DB). T9 (validar migration remota) é o que mais variabilidade tem por causa do B-001.

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1 create-next-app | 1 comando + ajuste pós | ✅ Granular |
| T2 tsconfig estrito | 1 arquivo, 4 flags | ✅ Granular |
| T3 estrutura pastas | 17 mkdirs | ✅ Granular (cohesivo) |
| T4 globals.css | 1 arquivo | ✅ Granular |
| T5 tailwind config | 1 arquivo | ✅ Granular |
| T6 layout.tsx | 1 arquivo | ✅ Granular |
| T7 page.tsx | 1 arquivo | ✅ Granular |
| T8 migration SQL | 1 arquivo (grande, mas atômico — não dá pra split sem quebrar transação implícita) | ✅ Granular (cohesivo) |
| T9 validar migration | 1 ação (apply + bateria) | ✅ Granular |
| T10 gen types | 1 comando | ✅ Granular |
| T11 db/client.ts | 1 arquivo | ✅ Granular |
| T12 .env.example | 1 arquivo | ✅ Granular |
| T13 package.json scripts | 1 arquivo | ✅ Granular |

---

## Tools Summary

| Task | MCP | Skill |
|---|---|---|
| T1 | NONE (Bash + npx) | NONE |
| T2 | NONE | `dryos-conventions` (TypeScript) |
| T3 | NONE (Bash) | `dryos-conventions` (Estrutura de pastas) |
| T4 | NONE (Write) | `dryos-design-system` (Cores + "Tailwind 4 CSS-first") |
| T5 | ~~merged em T4~~ | — |
| T6 | NONE (Write) | `dryos-design-system` (Tipografia) |
| T7 | NONE (Write) | NONE |
| T8 | NONE (Write, SQL local) | `dryos-conventions` (Status acionável, Supabase) |
| T9 | Supabase CLI local (`supabase start && supabase db reset`) — B-001 resolvido como local Docker | NONE |
| T10 | Supabase CLI local (`supabase gen types typescript --local`) | NONE |
| T11 | NONE (Write + Bash npm install) | `dryos-conventions` (Supabase / Cliente) |
| T12 | NONE (Write) | NONE |
| T13 | NONE (Edit) | NONE |

---

## Open Questions Before Implementation

1. **B-001 Supabase MCP (project-alvo)**: T9/T10 dependem. Caminhos possíveis:
   - **(a)** Usuário passa `project_ref` existente → apply via MCP
   - **(b)** Criar projeto novo via MCP (precisa `org_id`, nome, região)
   - **(c)** Rodar Supabase local via Docker (`supabase init && supabase start`) — autônomo, sem decisão remota; gera types via CLI local; bom pra desenvolver, ainda precisa decidir projeto remoto antes do deploy
2. **Aprovar tasks**: começar implementação pela Phase 1 (T1 → T2 → T3)? Ou prefere revisar mais alguma task antes?
