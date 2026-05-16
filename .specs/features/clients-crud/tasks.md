# clients-crud Tasks

**Design**: `.specs/features/clients-crud/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Foundations (paralelo):
  T1 (zod install) ─┐
  T2 (clientSchema)  │
  T3 (slugify)       ├─→ done
  T4 (useDebouncedValue)

Phase 2 — Queries (paralelo, após T1):
  T5 (queries/clients)
  T6 (queries/operations refactor)
  T7 (queries/persons)

Phase 3 — Server Actions (após T2 + T5):
  T8 (actions/clients)

Phase 4 — Components (paralelo, após T3+T4+T8):
  T9 (ClientsSearch)
  T10 (ClientsTable)
  T11 (ClientForm)
  T12 (ExternalPersonsList)

Phase 5 — Pages (paralelo, após Phase 4):
  T13 (/clients page)
  T14 (/clients/new page)
  T15 (/clients/[id] page)
  T16 (/clients/[id]/edit page)

Phase 6 — Sidebar (após T5):
  T17 (Sidebar + SidebarNav update)

Phase 7 — Validate + ship:
  T18 (typecheck + build + screenshot)
  T19 (commit + push + PR)
```

Caminho crítico: T1 → T2 → T8 → T11 → T14 → T18 → T19.

---

## Task Breakdown

### T1: Instalar `zod`

**What**: validação compartilhada server+client.
**Where**: `package.json`
**Depends on**: None
**Tools**: Bash

**Done when**:
- [ ] `zod` em `dependencies` do `package.json`
- [ ] `npm run typecheck` passa

---

### T2: `src/lib/validators/client.ts` — Zod schema [P]

**What**: schema único pra create + update; tipo derivado exportado.
**Depends on**: T1
**Tools**: Write

**Done when**:
- [ ] Exporta `clientSchema = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/), notes: z.string().max(1000).optional().or(z.literal('').transform(()=>undefined)) })`
- [ ] Exporta `type ClientInput = z.infer<typeof clientSchema>`
- [ ] Mensagens de erro em pt-BR via `.refine` ou `.min(1, 'Nome obrigatório.')` etc

---

### T3: `src/lib/utils/slug.ts` — slugify [P]

**What**: helper puro `slugify(input: string): string`.
**Depends on**: None
**Tools**: Write

**Done when**:
- [ ] Função: lowercase → `normalize('NFD').replace(/\p{Diacritic}/gu, '')` → replace `/[^a-z0-9]+/g` por `-` → trim leading/trailing `-`
- [ ] Casos cobertos mentalmente: "Acme Co." → "acme-co"; "Beta Inc & Co" → "beta-inc-co"; "São Paulo" → "sao-paulo"; "  espaços  " → "espacos"
- [ ] Tipo de retorno explícito

---

### T4: `src/lib/hooks/useDebouncedValue.ts` [P]

**What**: hook genérico de debounce.
**Depends on**: None
**Tools**: Write

**Done when**:
- [ ] `'use client'`
- [ ] `function useDebouncedValue<T>(value: T, delay: number): T`
- [ ] `useEffect` com setTimeout + cleanup
- [ ] Type-safe

---

### T5: `src/lib/db/queries/clients.ts`

**What**: queries `listClients`, `getClient`, `countActiveClients`, `clientHasActiveOperations`.
**Depends on**: None técnica
**Tools**: Write

**Done when**:
- [ ] `type ClientListItem` exportado
- [ ] `type ClientDetail = Database['public']['Tables']['clients']['Row']`
- [ ] `listClients({ search? })`: select com embed `operations(id, archived_at, status)` + `persons!persons_client_id_fkey(id, archived_at, kind)`; filtra `archived_at IS NULL`; se `search`: `OR(name.ilike.%q%, slug.ilike.%q%)`. Map pra `ClientListItem` com contagens (ops onde `archived_at IS NULL AND status != 'arquivada'`; persons externas onde `kind='external' AND archived_at IS NULL`).
- [ ] `getClient(id)`: retorna null se não existe OR archived_at não-null
- [ ] `countActiveClients()`: `count('exact', { head: true })` com `archived_at IS NULL`
- [ ] `clientHasActiveOperations(id)`: count em operations onde `client_id=id AND archived_at IS NULL AND status != 'arquivada'`
- [ ] Erros lançam Error com contexto

---

### T6: Refactor `src/lib/db/queries/operations.ts` pra filtro clientId

**What**: aceitar `options?: { clientId?: string }`.
**Depends on**: None
**Tools**: Edit

**Done when**:
- [ ] Assinatura: `async function getActiveOperations(options?: { clientId?: string }): Promise<OperationCardData[]>`
- [ ] Se `options?.clientId`, aplica `.eq('client_id', options.clientId)`
- [ ] Backward compat: chamada sem args funciona como hoje
- [ ] Existing callers (home `/`) continuam funcionando

---

### T7: `src/lib/db/queries/persons.ts` [P]

**What**: `getExternalPersonsByClient`.
**Depends on**: None
**Tools**: Write

**Done when**:
- [ ] `type ExternalPersonItem = { id: string; name: string; email: string | null; externalRole: string }`
- [ ] `async function getExternalPersonsByClient(clientId: string): Promise<ExternalPersonItem[]>` — filtra `kind='external' AND client_id=clientId AND archived_at IS NULL`. Order by name asc.

---

### T8: `src/lib/actions/clients.ts` — Server Actions

**What**: `createClientAction`, `updateClientAction`, `archiveClientAction`.
**Depends on**: T2, T5
**Tools**: Write

**Done when**:
- [ ] `'use server'`
- [ ] **`createClientAction(formData)`**:
  - Guard: `requireUserAction()` → propagate err se unauth
  - Parse via `clientSchema.safeParse({ name, slug, notes })` — error.issues → `err(firstIssue.message, 'validation_failed')`
  - Insert; catch 23505 (Postgres unique_violation, via `error.code`) → `err('Já existe Cliente com esse slug.', 'slug_taken')`
  - Sucesso → `ok({ id, slug })`
- [ ] **`updateClientAction(id, formData)`**:
  - Guard auth
  - Parse via Zod
  - Se slug mudou (vs valor atual no DB): chamar `clientHasActiveOperations(id)` → se sim, `err('Cliente tem Operações ativas; slug não pode mudar.', 'slug_locked')`
  - Update; 23505 → slug_taken
  - Sucesso → `ok({ id })`
- [ ] **`archiveClientAction(id)`**:
  - Guard auth
  - `clientHasActiveOperations(id)` → se sim, `err('Cliente tem Operações ativas. Arquive-as primeiro.', 'has_active_operations')`
  - `UPDATE clients SET archived_at = now() WHERE id = $1`
  - Sucesso → `ok(undefined)`
- [ ] Sem `throw` — só ActionResult

---

### T9: `src/components/domain/ClientsSearch.tsx` [P]

**What**: input de busca com debounce + URL replace.
**Depends on**: T4
**Tools**: Write

**Done when**:
- [ ] `'use client'`
- [ ] `useState(query)` inicial = `initialQuery` da prop
- [ ] `useDebouncedValue(query, 300)`
- [ ] `useEffect` que `router.replace('/clients?q=' + encoded)` ou `/clients` se vazio; pular o effect inicial (evitar replace na mount)
- [ ] Input com ícone `Search` Lucide (w-4 h-4 absolute left-3) + placeholder "Buscar por nome ou slug…"
- [ ] Estilo: `w-full max-w-md bg-card border border-line rounded pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-line-strong`

---

### T10: `src/components/domain/ClientsTable.tsx` [P]

**What**: tabela renderizando `ClientListItem[]`.
**Depends on**: None técnica (recebe data via prop)
**Tools**: Write

**Done when**:
- [ ] Server Component
- [ ] `<table class="w-full text-sm">` com:
  - `<thead>`: Nome, Slug, Operações ativas, Pessoas externas, Criado em, Ações
  - Headers: `font-mono text-[10px] uppercase tracking-wide text-mute font-medium pb-3 border-b border-line text-left`
- [ ] Linhas: `<tr class="border-b border-line hover:bg-surface transition-colors">`
- [ ] Colunas:
  - Nome em `text-ink font-medium`
  - Slug em `font-mono text-xs text-mute`
  - Pill com contagem ops e persons (`<Pill variant="neutral">{count}</Pill>`)
  - Data: `font-mono text-xs text-mute` em `DD/MM/YYYY`
  - Ações: `<Link href="/clients/{id}" class="text-oak hover:underline text-sm">Abrir</Link>`
- [ ] Empty state se 0 clientes: ver spec (varia por hasSearch)

---

### T11: `src/components/domain/ClientForm.tsx`

**What**: form reusable pra create + edit.
**Depends on**: T2 (validator), T3 (slugify), T8 (actions)
**Tools**: Write

**Done when**:
- [ ] `'use client'`
- [ ] Props discriminated union: `{ mode: 'create' } | { mode: 'edit'; initialData: ClientDetail; canChangeSlug: boolean; canArchive: boolean }`
- [ ] State: `name`, `slug`, `notes`, `slugTouched`, `errors: Partial<Record<'name'|'slug'|'notes'|'general', string>>`
- [ ] onChange de name: se `!slugTouched`, atualiza slug com `slugify(name)`
- [ ] onChange de slug: setta `slugTouched=true`
- [ ] Submit via `useTransition`:
  - Call `createClientAction` ou `updateClientAction`
  - Map error code → field:
    - `validation_failed` → general
    - `slug_taken` → slug field
    - `slug_locked` → slug field
    - `unauthenticated` → general
    - default → general
  - Sucesso: `router.push('/clients/' + result.data.id)`
- [ ] Botões: Salvar (primary), Cancelar (ghost, Link voltando), Arquivar (ghost text-critical, só em edit + canArchive)
- [ ] Arquivar: `window.confirm('Arquivar este Cliente?')` → `archiveClientAction(id)` → router.push('/clients')
- [ ] Input de slug fica `disabled` se mode=edit AND `canChangeSlug=false`; mensagem helper "Slug não pode mudar enquanto houver Operações ativas."
- [ ] Helper text de slug: "minúsculas, números e hífens"

---

### T12: `src/components/domain/ExternalPersonsList.tsx` [P]

**What**: lista de pessoas externas no detalhe.
**Depends on**: T7 (type)
**Tools**: Write

**Done when**:
- [ ] Props: `{ persons: ExternalPersonItem[] }`
- [ ] Server Component
- [ ] Se 0: `<p class="text-mute text-sm">Nenhuma pessoa externa cadastrada.</p>`
- [ ] Senão: lista de Cards pequenos ou rows: nome (`font-body text-sm text-ink`) + papel (`font-mono text-xs text-mute`) + email (mailto se houver, `text-oak hover:underline text-sm`)
- [ ] Grid 1/2/3 cols ou stack vertical — escolher stack pra simplicidade

---

### T13: `src/app/(app)/clients/page.tsx`

**What**: rota /clients.
**Depends on**: T5, T9, T10
**Tools**: Write

**Done when**:
- [ ] Server Component async; `searchParams: Promise<{ q?: string }>`
- [ ] `const { q } = await searchParams`
- [ ] `const [clients, total] = await Promise.all([listClients({ search: q }), countActiveClients()])`
- [ ] `<PageHeader title="Clientes" subtitle={\`${total} ${total === 1 ? 'cliente ativo' : 'clientes ativos'}\`} actions={...} />`
- [ ] `<ClientsSearch initialQuery={q ?? ''} />` (margem inferior)
- [ ] `<ClientsTable clients={clients} hasSearch={!!q} />`
- [ ] Build verde

---

### T14: `src/app/(app)/clients/new/page.tsx` [P]

**What**: rota /clients/new.
**Depends on**: T11
**Tools**: Write

**Done when**:
- [ ] PageHeader title="Novo cliente" + back link
- [ ] `<ClientForm mode="create" />`
- [ ] Build verde

---

### T15: `src/app/(app)/clients/[id]/page.tsx`

**What**: detalhe.
**Depends on**: T5, T6, T7, T10 (OperationCard reuse), T12
**Tools**: Write

**Done when**:
- [ ] `const id = (await params).id`
- [ ] `const client = await getClient(id)` — se null, `notFound()`
- [ ] `const [operations, persons] = await Promise.all([getActiveOperations({ clientId: id }), getExternalPersonsByClient(id)])`
- [ ] PageHeader title={client.name} subtitle={\`${client.slug} · criado em ${formatDateBR(client.created_at)}\`} actions={<Link href="/clients/{id}/edit"><Button variant="ghost"><Edit2 /> Editar</Button></Link>}
- [ ] Notes block se `client.notes`: `<div class="bg-sage-bg border-l-2 border-sage-deep p-4 mb-6"><p class="font-body text-sm text-ink-soft">{notes}</p></div>`
- [ ] Section Operações: h2 `font-display text-lg mb-3` + contagem em pill; grid de OperationCard ou empty state
- [ ] Section Pessoas externas: h2 + `<ExternalPersonsList persons={persons} />`
- [ ] Build verde

---

### T16: `src/app/(app)/clients/[id]/edit/page.tsx`

**What**: rota de edit.
**Depends on**: T5, T11
**Tools**: Write

**Done when**:
- [ ] `const client = await getClient(id)`; if (!client) `redirect('/clients')` (não 404 — id pode ser válido mas arquivado)
- [ ] `const hasOps = await clientHasActiveOperations(id)`
- [ ] PageHeader title={\`Editar — ${client.name}\`}
- [ ] `<ClientForm mode="edit" initialData={client} canChangeSlug={!hasOps} canArchive={!hasOps} />`
- [ ] Build verde

---

### T17: Sidebar update — link Clientes + contagem

**What**: passar `clientsCount` pro SidebarNav e adicionar item.
**Depends on**: T5 (`countActiveClients`)
**Tools**: Edit (Sidebar.tsx + SidebarNav.tsx)

**Done when**:
- [ ] `Sidebar.tsx`: chama `await countActiveClients()`; passa `clientsCount` pra `<SidebarNav clientsCount={clientsCount} />`
- [ ] `SidebarNav.tsx`: 
  - Props `{ clientsCount?: number }`
  - Tipo `NavItem` ganha `count?: number` opcional
  - GROUPS: "Espaço de trabalho" agora tem `[Home, Clientes]` — Clientes com `icon: Users`, `count: clientsCount`
  - Render: se `count != null`, adiciona `<Pill variant="neutral" className="ml-auto">{count}</Pill>`
  - Active state: `pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))`
- [ ] `npm run typecheck` passa

---

### T18: Build + smoke local + screenshot

**What**: validar tudo.
**Depends on**: T1-T17
**Tools**: Bash, playwright

**Done when**:
- [ ] `npm run typecheck` + `npm run build` verdes
- [ ] `npm run dev` sobe; visitar `/clients` mostra os 3 do seed
- [ ] Busca "acm" filtra
- [ ] Criar "Teste S.A." → vira "teste-sa" → redirect detalhe
- [ ] Detalhe mostra OperationCard + lista persons
- [ ] Editar → salva
- [ ] Tentar arquivar → bloqueia (Acme tem op)
- [ ] Sidebar mostra Clientes (4) ou similar
- [ ] Screenshot pra confirmar visual

---

### T19: Issue + commit + push + PR

**What**: ship.
**Depends on**: T18
**Tools**: gh, git, Bash

**Done when**:
- [ ] Issue criada com escopo da feature
- [ ] Branch `feat/clients-crud` (criada de origin/main) com 1 commit cohesivo
- [ ] PR aberto com `Closes #N`

---

## Tools Summary

| Task | Tools | Skill |
|---|---|---|
| T1 | Bash | — |
| T2 | Write | `dryos-conventions` |
| T3 | Write | — |
| T4 | Write | — |
| T5 | Write | `dryos-conventions` (Queries Supabase) |
| T6 | Edit | — |
| T7 | Write | `dryos-conventions` |
| T8 | Write | `dryos-conventions` (Server Actions) |
| T9 | Write | — |
| T10 | Write | `dryos-design-system` |
| T11 | Write | `dryos-design-system` + `dryos-conventions` |
| T12 | Write | `dryos-design-system` |
| T13-T16 | Write | `dryos-design-system` |
| T17 | Edit | — |
| T18 | Bash + playwright | — |
| T19 | gh + git | — |

---

## Pace pra implementação

Sugiro reto T1-T18 (pauso antes do T19 pra você revisar antes do PR), estimo ~30-40 min. OK?
