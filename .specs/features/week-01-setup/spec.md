# week-01-setup Specification

## Problem Statement

Repo está com docs canônicos (PRD, CLAUDE.md, skills, mockup) mas zero código. Pra arrancar o MVP de 5 semanas, semana 1 precisa entregar a fundação: app Next.js rodando, tokens do DS carregados, fontes via `next/font`, estrutura de pastas que o restante do trabalho vai povoar, e schema base no Supabase com RLS pra Operações já poderem existir como dado. Sem essa base, nenhuma feature da semana 2+ tem onde aterrissar.

## Goals

- [ ] `npm run dev` sobe app vazio com fontes carregadas, modo claro com tokens DS aplicados, sem erro de typecheck.
- [ ] Migration `20260515000001_initial_schema.sql` cria 5 tabelas base (clients, operations, frentes, persons, allocations) + enums + CHECKs de invariantes + RLS habilitado em todas, idempotente, com `COMMENT ON TABLE` em cada uma.
- [ ] `npm run typecheck` passa sem erro. `npm run gen:types` produz `src/lib/db/types.ts` consistente com a migration.

## Out of Scope

- Auth (Supabase Auth, middleware, páginas de login) — entra como feature `auth` separada na semana 1
- Bitwarden integration — feature `bitwarden-integration` separada na semana 1
- CRUD UI das 5 entidades — semana 2
- Componentes DS (Pill, Card, etc) — semana 2 (`ui-foundation`)
- Outras entidades (Briefing, Reunião, Decisão, Vilão, Quick Win, Anexo, SLA, Credencial, Diagnóstico, Notificação, Template) — semanas 3-5
- Seed de vilões — semana 4
- Modo escuro funcional (tokens dark vão pro CSS mas não há toggle ainda) — entra no polish da semana 5
- Aplicar migration em projeto Supabase remoto — depende de decisão do usuário (B-001 em STATE.md); spec entrega SQL local

---

## User Stories

### P1: Bootstrap do app Next.js ⭐ MVP

**User Story**: Como dev solo do DRYOS, quero `npm run dev` subir um app Next.js 15 vazio com TypeScript estrito, Tailwind, e estrutura de pastas correta, pra que features das próximas semanas tenham onde aterrissar sem precisar repensar a base.

**Why P1**: Sem o bootstrap, não há onde colocar componentes, queries, migrations. É o piso de tudo.

**Acceptance Criteria**:

1. WHEN o dev roda `npm run dev` na raiz THEN o app SHALL iniciar em `http://localhost:3000` com página `/` renderizando texto placeholder (ex: "DRYOS Delivery — semana 01").
2. WHEN o dev roda `npm run typecheck` THEN o comando SHALL terminar com exit 0 sem erro de tipo.
3. WHEN o dev inspeciona `tsconfig.json` THEN SHALL conter `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`.
4. WHEN o dev inspeciona a árvore `/src` THEN SHALL existir a estrutura `app/(app)`, `app/(public)`, `app/api`, `components/ui`, `components/domain`, `components/layout`, `lib/db`, `lib/db/queries`, `lib/utils`, `lib/validators`, `lib/integrations`, `lib/actions`, `styles` (pastas presentes, mesmo que com placeholder `.gitkeep` quando vazias).
5. WHEN o dev inspeciona `package.json` THEN SHALL existir scripts `dev`, `build`, `start`, `typecheck`, `gen:types`. (ESLint não foi instalado pelo create-next-app via `--no-eslint`; sem script `lint` na sem 1.)
6. WHEN o dev inspeciona a raiz THEN **não** SHALL existir `tailwind.config.ts` (Tailwind 4 é CSS-first via `@theme` em `globals.css` — AD-005).

**Independent Test**: Clonar repo limpo, rodar `npm install && npm run typecheck && npm run dev`, abrir `localhost:3000`, ver placeholder. Pronto.

---

### P1: DS v2 — tokens, Tailwind e fontes carregadas ⭐ MVP

**User Story**: Como dev solo, quero os tokens de cor/radius/shadow do DS v2 disponíveis como CSS vars + Tailwind classes, e as 3 fontes (Funnel Display, Onest, JetBrains Mono) carregadas via `next/font`, pra que componentes futuros usem `bg-card`, `text-oak`, `font-display` direto sem reimplementar.

**Why P1**: Componentes da semana 2 assumem isso pronto. Se tokens forem inventados depois, todo componente terá que ser revisitado.

**Acceptance Criteria**:

1. WHEN o dev inspeciona `src/styles/globals.css` THEN SHALL conter todas as CSS vars do skill `dryos-design-system` (block `Cores`): `--bg`, `--surface`, `--card`, `--ink`, `--ink-soft`, `--mute`, `--mute-soft`, `--oak`, `--oak-light`, `--oak-50`, `--sage`, `--sage-bg`, `--sage-deep`, `--line`, `--line-strong`, `--critical`, `--critical-bg`, `--warning`, `--warning-bg`, `--ok`, `--ok-bg`, `--shadow-sm/md/lg`, `--radius-sm/DEFAULT/lg/pill`.
2. WHEN o dev inspeciona `globals.css` THEN SHALL conter override `body.dark` com os tokens dark (oak → sage, etc).
3. WHEN o dev inspeciona `src/styles/globals.css` THEN SHALL conter bloco `@theme inline { --color-*, --font-display/body/mono, --radius-*, --shadow-* }` mapeando todas as vars de `:root` pra classes Tailwind 4 (`bg-bg`, `text-oak`, `font-display`, `rounded-pill`, etc). Sem `tailwind.config.ts` na raiz.
4. WHEN o dev inspeciona `src/app/layout.tsx` THEN SHALL importar `Funnel_Display`, `Onest`, `JetBrains_Mono` de `next/font/google` com `variable: '--font-display|body|mono'` e aplicar as 3 vars no `<html>`; `lang="pt-BR"`; `<body>` com classes `font-body bg-bg text-ink-soft antialiased`.
5. WHEN o dev abre `localhost:3000` e inspeciona THEN o body SHALL renderizar com fonte Onest e cores aplicadas dos tokens (não Times New Roman, não fundo branco puro).

**Independent Test**: Inspecionar `<body>` no devtools, ver `font-family: Onest...`, ver `background-color: rgb(250, 250, 248)` (= #FAFAF8 / `--bg`).

---

### P1: Migration inicial com 5 entidades base + RLS ⭐ MVP

**User Story**: Como dev solo, quero uma migration SQL que crie `clients`, `operations`, `frentes`, `persons`, `allocations` com tipos corretos, FKs, CHECKs dos invariantes do CLAUDE.md (status acionável, person.kind, progresso capped, etc), RLS habilitado e policies básicas de autenticado, pra que o banco já reflita o domínio antes do CRUD da semana 2.

**Why P1**: Schema antes da UI é princípio da DRYOS (decisão 13 do PRD: "Ambiente é Claude Code, não Lovable. Schema modelado antes da UI."). Atrasar isso = UI guessando o schema.

**Acceptance Criteria**:

1. WHEN o arquivo `supabase/migrations/20260515000001_initial_schema.sql` é aplicado em DB vazio THEN SHALL criar 5 tabelas: `clients`, `operations`, `frentes`, `persons`, `allocations` — todas em `public`.
2. WHEN a migration roda THEN SHALL criar os enums: `product_line` (`core` | `spark` | `studio`), `frente_cycle_type` (`a` | `b` | `c` | `d` | `e`), `frente_domain` (`infra` | `dados_analiticos` | `dados_tecnicos`), `operation_status` (`em_construcao` | `em_operacao` | `janela_critica` | `arquivada`), `frente_phase` (`descoberta` | `execucao` | `entrega` | `encerrada`), `person_kind` (`internal` | `external`), `allocation_role` (`responsavel` | `executor` | `aprovador` | `plantao`), `recurrence` (`mensal` | `trimestral` | `anual` | `unica`).
3. WHEN uma `frente` é inserida com `actionable_status` de comprimento <15 OU igual a um dos genéricos proibidos (`em andamento`, `em revisão`, `pendente`, `a fazer`, `em progresso`) THEN o INSERT SHALL falhar com violação de CHECK constraint (princípio 04 + Invariante 4).
4. WHEN uma `person` é inserida com `kind='internal'` e `specialty IS NULL` OR com `kind='external'` e (`external_role IS NULL` OR `client_id IS NULL`) THEN o INSERT SHALL falhar com violação de CHECK constraint (Invariante 10).
5. WHEN uma `allocation` é inserida com `capacity_weekly_pct` fora de [0, 100] THEN o INSERT SHALL falhar (Invariante 11).
6. WHEN qualquer das 5 tabelas é consultada THEN SHALL exigir auth (RLS habilitado, policy `auth.uid() IS NOT NULL` pra select/insert/update/delete). Sem usuário autenticado retorna vazio.
7. WHEN a migration é aplicada duas vezes em sequência THEN a segunda execução SHALL ser no-op (idempotente: `CREATE TYPE ... IF NOT EXISTS` ou `DO $$ ... EXCEPTION WHEN duplicate_object`; `CREATE TABLE IF NOT EXISTS`; `DROP POLICY IF EXISTS` + `CREATE POLICY`).
8. WHEN a migration é aplicada THEN cada tabela SHALL ter `COMMENT ON TABLE` com formato `<modulo>: <propósito>. <invariante se houver>.` (regra do CLAUDE.md).
9. WHEN a migration é aplicada THEN cada FK SHALL ter constraint nomeada (`fk_<tabela>_<coluna>`).
10. WHEN o dev roda `npm run gen:types` (ou MCP `generate_typescript_types`) após a migration THEN `src/lib/db/types.ts` SHALL conter tipos das 5 tabelas + enums.

**Independent Test**: Aplicar a migration em DB local (ou via MCP em projeto novo), rodar 4 INSERTs que devem falhar (status acionável curto, internal sem specialty, external sem client_id, capacity 150), rodar 1 INSERT válido em cada tabela respeitando FKs, query `SELECT * FROM clients` retorna o dado. Tudo em SQL puro, sem precisar do app.

---

### P2: `.env.local.example` documentado

**User Story**: Como dev solo (e qualquer outro que clone o repo), quero um `.env.local.example` listando as variáveis necessárias com comentário do que é cada uma, pra não ter que descobrir lendo código.

**Why P2**: Útil mas não bloqueia execução local — dev pode descobrir lendo o cliente Supabase. Vira P1 quando entrar segundo dev.

**Acceptance Criteria**:

1. WHEN o dev copia `.env.local.example` pra `.env.local` e preenche com valores reais do Supabase THEN o app SHALL conectar no Supabase sem variável faltando.
2. WHEN o arquivo é inspecionado THEN SHALL conter (com comentário 1-linha cada): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `ANON_KEY`), `SUPABASE_SECRET_KEY` (ou `SERVICE_ROLE_KEY`, server-only), `NEXT_PUBLIC_APP_URL`.

**Independent Test**: `cp .env.local.example .env.local`, preencher, `npm run dev`, sem warning de env faltando.

---

### P3: Cliente Supabase tipado em `src/lib/db/client.ts`

**User Story**: Como dev solo, quero helpers `createServer()` e `createBrowser()` em `src/lib/db/client.ts` tipados com `Database` de `types.ts`, pra que toda query da semana 2 já saia tipada.

**Why P3**: Pode aparecer junto da primeira query (semana 2). Mas se sair na semana 1 sem ônus, melhor.

**Acceptance Criteria**:

1. WHEN o dev importa `createServer` em uma Server Action THEN SHALL receber `SupabaseClient<Database>` tipado.
2. WHEN o dev tenta consultar tabela inexistente THEN o TypeScript SHALL acusar erro de tipo.

---

## Edge Cases

- WHEN a migration roda em DB que já tem alguma das 5 tabelas com schema diferente THEN SHALL falhar com mensagem clara (não corromper) — proteção via `CREATE TABLE IF NOT EXISTS` + ALTER explícito se mudança for necessária em migration futura.
- WHEN o dev roda `npm run dev` sem `.env.local` THEN o app SHALL subir mostrando claramente qual variável falta (validação no cliente Supabase ou log no console), não silenciosamente quebrar.
- WHEN `next/font` falha em baixar fontes (offline) THEN o app SHALL renderizar com fallback (`font-family: ui-sans-serif, system-ui`), não tela em branco.
- WHEN `gen:types` é rodado sem CLI Supabase instalado THEN o script SHALL mostrar mensagem de instalação (`npm install -g supabase` ou link).

---

## Success Criteria

How we know the feature is successful:

- [ ] `git clone`, `npm install`, `npm run dev` em <5 minutos resulta em app rodando.
- [ ] `npm run typecheck` retorna 0 issues.
- [ ] Migration aplicada em DB limpo cria as 5 tabelas + enums + policies sem erro.
- [ ] Inserts que violam invariantes (status genérico, person inconsistente, capacity fora de 0-100) são rejeitados pelo banco, não pelo app.
- [ ] `src/lib/db/types.ts` reflete o schema após `gen:types`.
- [ ] Inspecionar página `/` no browser mostra `font-family: Onest...` e background `#FAFAF8`.
