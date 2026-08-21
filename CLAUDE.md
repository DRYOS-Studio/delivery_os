# DRYOS Delivery

Sistema operacional interno da DRYOS para gerir entrega de Core, Sparks e Studio. Conecta Proposta → Implantação → Operação contínua → Renovação, com narrativa dos 7 vilões da marca.

**Documento canônico:** `docs/prd.md`
**Referência visual canônica:** `docs/mockup-v2.html`

---

## ⚠️ Antes de qualquer mudança de código: carregue `tlc-spec-driven`

**Toda mudança de código neste repo — feature, bug fix, refactor, chore — começa invocando a skill `tlc-spec-driven` antes de qualquer edit.**

A skill estrutura o trabalho em 4 fases (Specify → Design → Tasks → Implement+Validate) e mantém memória persistente entre sessões. Sem ela, decisões de design somem no histórico do chat e tarefas atômicas não ficam rastreáveis — caro num projeto com 17+ entidades, 5 sprints semanais e regras de domínio sutis (ciclos A-E, visibility de Decisão, status acionável validado no banco, soma de impacto de Quick Win capped por vilão).

### Como o agente deve agir

1. Ao receber pedido de mudança de código, **primeira ação** é chamar `Skill` com `skill: "tlc-spec-driven"` — antes de explorar código, antes de planejar, antes de editar.
2. Seguir o fluxo da skill (Specify → Design → Tasks → Implement+Validate).
3. Só pular se o usuário disser explicitamente "sem tlc", "direto", "skip spec-driven" ou equivalente.

### Quando NÃO carregar

- Perguntas de leitura/exploração ("o que faz X?", "onde mora Y?") — sem edit envolvido.
- Comandos one-off em `/tmp` ou scripts descartáveis que não viram commit.
- Quando já está dentro de um fluxo `tlc-spec-driven` ativo (não recarregar).
- Quando o usuário pedir explicitamente pra pular.

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
9. **Pills coloridas são o sistema canônico de status.** 6 cores cobrem tudo (neutra, oak, sage, ok, warning, critical). Adicionar nova é decisão deliberada, não improviso.
10. **Ícones são funcionais, nunca decorativos.** Lucide React, stroke 1.75.
11. **Hierarquia tipográfica calibrada.** Funnel Display 600-700 só pra hero/KPIs/nomes. Onest 500-600 em 14-16px no resto.

---

## Invariantes de implementação

Regras duras que valem no schema, nas queries e nas Server Actions. Diferente dos princípios (que são conceituais), aqui é o que o código e o banco precisam garantir. Quebrar = bug. Cada uma com a razão de existir.

1. **Toda Frente PRECISA ter `operation_id`.** Frente órfã não existe. FK `NOT NULL`. Razão: princípio 03 (Operação contém Frentes). Frente solta corrompe a hierarquia de relatório.
2. **Toda Operação PRECISA ter `client_id`.** FK `NOT NULL`. Razão: princípio do domínio (Cliente → Operação → Frente). Operação sem Cliente quebra o link público e o painel agregado.
3. **Operação Tipo C/E nunca recebe `end_date` no fluxo.** Coluna existe mas `CHECK` permite null pra ciclos contínuos. Razão: princípio 03. Sistema não força fim onde não há fim.
4. **Status acionável validado no banco.** `frentes.actionable_status` tem `CHECK` de comprimento mínimo (≥15) + `CHECK` rejeitando lista de strings genéricas ("em andamento", "em revisão", "pendente", "a fazer", "em progresso"). Razão: princípio 04. Validar só no front é convite a desvio.
5. **Decisão tem `visibility` própria mesmo dentro de Reunião compartilhada.** `decisions.visibility` é coluna independente de `meetings.visibility`. Razão: princípio 05 + PRD §04. Reunião pode ser com cliente mas decisão específica pode ser interna.
6. **Vilão é seed do banco, nunca deletado — só `archived_at`.** 7 registros canônicos. Soft-delete via timestamp. Razão: princípio 06. Catálogo da marca é universo permanente; archive preserva histórico de Operações antigas.
7. **`operation_villains`: severidade inicial congelada; progresso atual mutável.** `initial_severity` é write-once (`UPDATE` bloqueado por trigger ou política). `progress_pct` aceita updates, mas capped 0-100 via `CHECK`. Razão: PRD §04. Severidade veio do diagnóstico — alterá-la depois rescreve história.
8. **Soma de impacto de Quick Win em vilão por Operação trava em 100%.** Trigger ou função `validate_villain_progress` rejeita Quick Win que faria `progress_pct + impact > 100` no respectivo `(operation_id, villain_id)`. Razão: PRD §04. Acima de 100% é nonsense de domínio.
9. **Credencial NUNCA armazena senha.** `credentials.bitwarden_item_id` + `credentials.bitwarden_vault_id` apontam para Bitwarden. Sem coluna `password`, `secret`, `value`. Razão: princípio 01. Construir cofre próprio foi descartado por risco.
10. **Pessoa.kind discrimina `internal` vs `external` com campos mutuamente exclusivos.** `internal` exige `specialty NOT NULL`; `external` exige `external_role NOT NULL` + `client_id NOT NULL`. `CHECK` cruzado. Razão: PRD §04. Pessoa interna sem especialidade ou externa sem cliente é dado quebrado.
11. **Anexo via Storage; path inclui `operation_id/`.** `attachments` tem `storage_path` no formato `<operation_id>/<file>`. RLS de Storage depende desse formato. Razão: replica padrão Casa Financeira / princípio do menor privilégio.
12. **RLS habilitado em TODA tabela.** Sem exceção. Nova tabela = `ENABLE ROW LEVEL SECURITY` + policies por papel na mesma migration. Razão: skill `dryos-conventions` + princípio do menor privilégio. Tabela sem RLS é vazamento esperando acontecer.
13. **Toda Server Action retorna `ActionResult<T>` — nunca `throw`.** Padrão detalhado em `## Server Actions` abaixo. Razão: throws viram 500 sem mensagem útil; `ActionResult` deixa UI tratar com toast/dialog específico.
14. **Toda Server Action que muta dado começa com guard de auth.** `supabase.auth.getUser()` → `err('Sessão expirada.')` se null. RLS é defense-in-depth, NÃO substituto: confiar só no RLS deixa actions retornarem dado vazio em vez de erro tipado. Guard de papel (Admin/Membro) entra quando a tabela `profiles` existir.
15. **Tarefa é XOR: entrega OU área.** `tasks` tem `CHECK ((area_id IS NULL AND frente_id IS NOT NULL) OR (area_id IS NOT NULL AND frente_id IS NULL))`. Tarefa de entrega = `frente_id` obrigatório, visível à Operação (`can_read_operation` = membro real OU área com concessão). Tarefa de área = sem Frente, no nível da Operação, FK `area_id` → `areas` (catálogo dinâmico, **não mais enum**), visível só a admin + quem é da área **com concessão da operação** (`user_in_area(area_id) AND area_can_reach_operation(area_id, operation_id)`). **Escopo não é mais global** (AD-014 sucede AD-013): a área só vê onde tem o cliente/operação concedido (`area_clients`/`area_operations`). `operation_id` sempre presente. `area_id` é write-once (trigger). Razão: tarefas de back-office não são de conhecimento total da Operação. **Toda query do `/public` filtra `area_id IS NULL`** — tarefa de área é interna e nunca vaza pro cliente.

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
| Frontend | Next.js 16 App Router (React 19) |
| Estilo | Tailwind 4 (CSS-first via `@theme`) + shadcn/ui customizado |
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

### Server Actions

Padrão de retorno único: `ActionResult<T>`. **Nunca `throw` em action.** Throws viram 500 sem mensagem útil; `ActionResult` deixa UI tratar com toast/dialog específico.

```typescript
// src/lib/actions/_types.ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const err = (error: string, code?: string): ActionResult<never> =>
  ({ ok: false, error, code });
export const dbErr = (error: { message: string }, context: string): ActionResult<never> =>
  ({ ok: false, error: `${context}: ${error.message}`, code: 'db_error' });
```

`code?` opcional pra erros tipados que a UI precisa diferenciar (ex: `unauthenticated`, `forbidden`, `not_found`, `validation_failed`, `state_conflict`).

**Toda Server Action que muta dado começa com guard de auth na primeira linha:**

```typescript
'use server';

export async function archiveOperation(id: string): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Sessão expirada.', 'unauthenticated');

  // ...validação Zod...
  // ...mutação...

  if (error) return dbErr(error, 'archiveOperation');
  revalidatePath(`/operations/${id}`);
  return ok({ id });
}
```

Guard de papel (Admin/Membro/Visualizador externo) entra quando a tabela `profiles` for criada — sem placeholder agora pra não criar dependência morta.

### Migrations

- Versionadas em `supabase/migrations/`. Nome: `YYYYMMDDHHMMSS_<descricao_kebab>.sql` (timestamp UTC).
- Sempre posteriores à migration mais recente. Migrations **não são editadas** após commit — sempre cria uma nova.
- **Idempotência**: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP X IF EXISTS`. Policies e triggers: padrão `DROP + CREATE` ou `CREATE OR REPLACE`.
- **RLS na mesma migration que cria a tabela.** Nunca uma migration que cria tabela sem `ENABLE ROW LEVEL SECURITY` + policies por papel.
- **RLS via migration, nunca pela UI do Supabase.** UI não é versionada.
- **FKs nomeadas**: `CONSTRAINT fk_<tabela>_<coluna>` pra facilitar drops e leitura de erro.
- **`COMMENT ON TABLE` obrigatório**: `<modulo>: <propósito em 1 linha>. <invariante importante se houver>.`
- `COMMENT ON COLUMN` quando a coluna tiver semântica não-óbvia: enum string, flag com regra de negócio, denormalização intencional, write-once (ex: `initial_severity`), capped (ex: `progress_pct`).
- Seeds em `supabase/seed/` rodam após migrations.
- `npm run gen:types` chama `supabase gen types typescript` em `src/lib/db/types.ts`. Rodar **após cada migration**. Commitado (não no `.gitignore`).

### ⚠️ Antes de criar qualquer tabela no banco

**NUNCA crie uma tabela nova sem antes verificar se já existe uma que resolve o problema.**

O schema do MVP já parte de ~17 entidades + tabelas de junção (vide Modelo de domínio). Crescimento desordenado gera duplicação de função (ex: dois sistemas de "tags" em Frente, duas filas de notificação, dois stores de regras de visibility). Antes de qualquer migration que contenha `CREATE TABLE`, siga este checklist **na ordem**:

#### 1. Consulte o catálogo primeiro

Leia `docs/DATABASE_SCHEMA.md` — lista todas as tabelas vivas agrupadas por módulo (cliente, operação, frente, pessoa, briefing, reunião, vilão, quick win, credencial, anexo, notificação). Procure pelo domínio que você quer modelar. Se o arquivo ainda não existe, criá-lo é parte da primeira migration que adicionar tabela.

#### 2. Busque no banco vivo via Supabase MCP

```sql
-- Todas as tabelas do public
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;

-- Descrição da tabela
SELECT obj_description('public.<tabela>'::regclass);

-- Busca fuzzy por conceito
SELECT tablename, obj_description(('public.'||tablename)::regclass) AS descr
FROM pg_tables WHERE schemaname='public'
AND (tablename ILIKE '%<termo>%' OR obj_description(('public.'||tablename)::regclass) ILIKE '%<termo>%');
```

#### 3. Busque nas migrations (histórico)

```bash
grep -rEi "CREATE TABLE.*<conceito>" supabase/migrations/
grep -rEi "DROP TABLE.*<nome>|RENAME.*<nome>" supabase/migrations/
```

#### 4. Decisão

**Se já existe tabela com função similar:**
- Estenda ela (colunas, JSONB field, coluna discriminadora `type`/`kind`).
- View ou materialized view se o caso de uso for read-only com shape diferente.
- Tabela de junção N:N se for relacionamento, não entidade nova.

**Só crie tabela nova se:**
- Nenhuma existente cobre o domínio (confirmado nas 3 buscas acima).
- A extensão prejudica performance, normalização ou RLS.
- O novo conceito tem ciclo de vida próprio (CRUD independente, owner diferente).

#### 5. Ao criar tabela nova

Na mesma migration, logo após o `CREATE TABLE`:

```sql
CREATE TABLE public.nova_tabela (...);
COMMENT ON TABLE public.nova_tabela IS '<modulo>: <propósito em 1 linha>. <invariante se houver>.';
```

E atualizar `docs/DATABASE_SCHEMA.md`:
- Adicionar linha na seção do módulo.
- Atualizar contagem no "Índice por módulo".
- Atualizar data em "Última análise".

### Git
- Branch principal: `main`
- Branches de feature: `feat/<area>-<descricao-curta>` (ex: `feat/frente-status-validator`)
- Commits: imperativo, minúsculo, sem ponto final, em inglês
  - Bom: `add migration for villains seed`
  - Ruim: `Added villains migration.`
- PRs revisados antes de merge, mesmo solo (auto-review serve)

### Issue antes de PR

**Toda mudança que vai virar PR precisa ter uma issue no GitHub criada antes da implementação começar.** Vale pra features, bug fixes, refactors, docs e chores — qualquer coisa que vá pro `main`. Solo ou casal, issues servem como memória da decisão.

#### Como o agente deve agir

1. **Antes de codar**, propor título e corpo da issue (1 linha de título + 2-4 linhas de contexto/critério de aceite). Não rodar `gh` ainda.
2. **Esperar confirmação explícita** ("ok", "pode criar", etc).
3. Rodar `gh issue create --title "..." --body "..."` e capturar o número (`#N`).
4. Implementar a mudança.
5. Ao abrir o PR, **incluir `Closes #N` no corpo** pra fechar a issue automaticamente no merge.

#### Quando pular

- Mudanças que **não** viram PR (experimentos locais, scripts one-off em `/tmp`, exploração sem commit).
- Quando o usuário **explicitamente** disser "sem issue" ou referenciar uma issue existente ("usa a #123").

---

## ⚠️ Documentação como contrato

A pasta `docs/` é a **referência viva** do sistema. Serve dois públicos: o time (decisões e mental model) e AI agents (referência antes de mexer no código).

**Documentação stale é bug.** Toda PR que muda comportamento descrito em `docs/` atualiza o doc no mesmo commit.

### Mapeamento mudança → arquivo a atualizar

| Tipo de mudança | Atualizar |
|---|---|
| Migration nova | `docs/DATABASE_SCHEMA.md` (criar na primeira) + `docs/architecture/02-domain-model.md` quando existir |
| Server Action nova ou alterada | `docs/architecture/03-server-actions.md` quando existir |
| Rota/página nova ou removida | `docs/architecture/04-ui-routes.md` quando existir |
| Mudança de fluxo end-to-end | `docs/workflows/<nome>.md` correspondente |
| Mudança de princípio, stack, integração ou escopo | `docs/prd.md` (canônico) |
| Componente DS novo ou variante de Pill nova | `.claude/skills/dryos-design-system/SKILL.md` |
| Convenção de código nova | `.claude/skills/dryos-conventions/SKILL.md` |

Estado real do que existe hoje em `docs/`:

| Arquivo | Estado |
|---|---|
| `docs/prd.md` | vivo — canônico de domínio, princípios, escopo |
| `docs/mockup-v2.html` | vivo — canônico visual |
| `docs/DATABASE_SCHEMA.md` | vivo — catálogo de tabelas por módulo |
| `docs/workflows/tarefas.md` | vivo — único workflow escrito |
| `docs/audits/AUDIT-<data>.md` | registro datado — **não editar**, é a foto daquele dia |
| `docs/architecture/*` | **não existe** — criar conforme a área ganhar peso |

Registro datado (`docs/audits/`, `.specs/features/*`) não se reconcilia com o código: era verdade na data e o valor dele é justamente isso. Doc vivo que divergiu do código é bug e se corrige.

### Como o agente deve agir

1. **Antes de mexer numa área**, ler o doc correspondente em `docs/` (ou a skill relevante) pra entender estado atual e invariantes.
2. **Ao implementar**, atualizar o doc afetado no mesmo branch.
3. **No PR**, descrever no body quais docs/skills foram alterados (ou justificar se nenhum foi).
4. **Não documentar especulação** — só o que ficou de fato no código.

### Quando pular

- PR de fix trivial que não muda comportamento descrito (typo, dep bump). Mesmo assim, checar se o doc cita versão/comportamento antigo.
- Refactor interno sem mudança de superfície externa (assinatura de Server Action, rota, schema).

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

### Supabase MCP

Usar proativamente em vez de pedir pro usuário rodar comandos. Funções preferidas:

- `apply_migration` — aplicar SQL versionado (preferida sobre `execute_sql` quando for schema change).
- `execute_sql` — query ad-hoc, busca em `pg_tables`, debug.
- `list_tables` / `list_migrations` — antes de criar tabela (vide checklist acima).
- `generate_typescript_types` — após cada migration; substitui `npm run gen:types` localmente.
- `get_advisors` — checar warnings de segurança/performance antes de PR de schema.
- `deploy_edge_function` — quando precisar de webhook ou cron (Tally, Discord).
- `list_branches` / `create_branch` / `merge_branch` — Supabase branches pra testar migration antes de produção.

### Browser / preview MCP

- **Claude_Preview** — preview do app local sem sair do agente. Útil pra validar UI antes de PR.
- **Claude_in_Chrome** — testar fluxo real no browser (auth, link público com token).

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

`— Última revisão: agosto 2026`
