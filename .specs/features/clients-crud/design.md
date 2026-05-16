# clients-crud Design

**Spec**: `.specs/features/clients-crud/spec.md`
**Status**: Draft

---

## Architecture Overview

CRUD em 4 rotas + 1 atualização de Sidebar. Server Components fazem fetch (queries em `src/lib/db/queries/clients.ts`); Client Components só pra interação (form com `useTransition`, busca com URL update). Server Actions (`ActionResult`) pra mutations. Zod centraliza validação. Reusa `OperationCard` no detalhe.

```mermaid
graph TD
    Sidebar[Sidebar Server<br/>+ countActiveClients] --> NavLink[Clientes link + pill]
    List[/clients page.tsx<br/>Server: listClients\(q\)] --> Search[ClientsSearch 'use client'<br/>useTransition + router.replace]
    List --> Table[ClientsTable]
    New[/clients/new page.tsx] --> Form[ClientForm 'use client']
    Form -->|action| Create[createClientAction]
    Detail[/clients/[id] page.tsx<br/>Server: getClient + ops + persons] --> OpCard[OperationCard reuse]
    Detail --> PersonsList[ExternalPersonsList]
    Edit[/clients/[id]/edit page.tsx] --> Form
    Form -->|action when editing| Update[updateClientAction]
    Edit --> Archive[archiveClientAction button]
    Create --> RedirectDetail[/clients/{id}/]
    Update --> RedirectDetail
    Archive --> RedirectList[/clients/]
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component / Pattern | Location | How to Use |
|---|---|---|
| `Pill`, `Card`, `Button` | `src/components/ui/` | Tabela usa Pill pra contagens; form usa Button; cards de placeholder usam Card |
| `PageHeader` | `src/components/layout/PageHeader.tsx` | Cada rota tem PageHeader com título e actions opcionais |
| `cn` helper | `src/lib/utils/cn.ts` | Conditional classes em form/table |
| `OperationCard` + `OperationCardData` | `src/components/domain/OperationCard.tsx` + `src/lib/db/queries/operations.ts` | Detalhe do Cliente reusa; passa `clientId` filter pra query |
| `getActiveOperations` query | `src/lib/db/queries/operations.ts` | Refatorar pra aceitar `{ clientId?: string }` filter |
| `ActionResult` + `ok`/`err`/`dbErr` | `src/lib/actions/_types.ts` | Toda Server Action retorna |
| `requireUserAction` | `src/lib/auth/server.ts` | Guard de auth nas Server Actions |
| `createServer` | `src/lib/db/client.ts` | Queries server-side |
| `Database` types | `src/lib/db/types.ts` | Tipos derivados pra Client + Person |
| `SidebarNav` | `src/components/layout/SidebarNav.tsx` | Adicionar item "Clientes" no grupo "Espaço de trabalho" |
| Lucide icons | `lucide-react` | `Users` pra link Clientes, `Archive`/`Edit2`/`Plus` pras actions |

### New Patterns/Helpers Created

| What | Where | Why |
|---|---|---|
| `slugify(input)` | `src/lib/utils/slug.ts` | Auto-suggest de slug no form. Lowercase, kebab-case, sem acentos. |
| Zod schema `clientSchema` | `src/lib/validators/client.ts` | Validação compartilhada entre create + update; podia ficar inline mas eleva pattern pra reuso |
| Search debounce hook | `src/lib/hooks/useDebouncedValue.ts` | Hook puro de 30 linhas pra debounce 300ms; reusará nos próximos CRUDs |

---

## Components

### `src/lib/validators/client.ts`

- **Purpose**: Zod schema pra Cliente (create + update).
- **Location**: `src/lib/validators/client.ts`
- **Interfaces**:
  - `const clientSchema = z.object({ name: z.string().min(1).max(120), slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/), notes: z.string().max(1000).optional() })`
  - `type ClientInput = z.infer<typeof clientSchema>`
- **Dependencies**: `zod` (instalar)
- **Reuses**: nenhum

### `src/lib/utils/slug.ts`

- **Purpose**: `slugify(input)` — transforma "Acme Co." em "acme-co".
- **Location**: `src/lib/utils/slug.ts`
- **Interfaces**: `export function slugify(input: string): string`
- **Lógica**: lowercase → remove acentos via `normalize('NFD').replace(/[̀-ͯ]/g, '')` → replace non-alnum with hyphen → trim hyphens.

### `src/lib/hooks/useDebouncedValue.ts`

- **Purpose**: Hook React que debounça um valor por `delay` ms.
- **Location**: `src/lib/hooks/useDebouncedValue.ts`
- **Interfaces**: `function useDebouncedValue<T>(value: T, delay: number): T`
- **Lógica**: `setTimeout` em useEffect, clear no cleanup.

### `src/lib/db/queries/clients.ts`

- **Purpose**: queries de Cliente.
- **Location**: `src/lib/db/queries/clients.ts`
- **Interfaces**:
  - `type ClientListItem = { id, name, slug, notes, createdAt, operationsActive: number, externalPersons: number }`
  - `type ClientDetail = Database['public']['Tables']['clients']['Row']`
  - `async function listClients({ search?: string }): Promise<ClientListItem[]>` — filtra `archived_at IS NULL` + ILIKE quando search; embed `operations(id, archived_at, status)` e `persons!persons_client_id_fkey(id, archived_at)`; mapeia contagens (filtra ops onde `archived_at IS NULL AND status != 'arquivada'`)
  - `async function getClient(id: string): Promise<ClientDetail | null>` — retorna null se 404 ou se `archived_at IS NOT NULL`
  - `async function countActiveClients(): Promise<number>` — usado pela Sidebar
  - `async function clientHasActiveOperations(id: string): Promise<boolean>` — usado por archive + edit guards
- **Dependencies**: `createServer`, `Database`

### `src/lib/db/queries/operations.ts` (modificação)

- **Purpose**: aceitar filtro `clientId` em `getActiveOperations`.
- **Interfaces**:
  - `async function getActiveOperations(options?: { clientId?: string }): Promise<OperationCardData[]>` — backward compat (sem options = tudo, como hoje)
- **Reuses**: lógica atual, só adiciona `.eq('client_id', clientId)` condicionalmente

### `src/lib/db/queries/persons.ts`

- **Purpose**: list de pessoas externas por cliente.
- **Location**: `src/lib/db/queries/persons.ts`
- **Interfaces**:
  - `type ExternalPersonItem = { id, name, email, externalRole }`
  - `async function getExternalPersonsByClient(clientId: string): Promise<ExternalPersonItem[]>`

### `src/lib/actions/clients.ts`

- **Purpose**: Server Actions de Cliente.
- **Location**: `src/lib/actions/clients.ts`
- **Interfaces**:
  - `'use server'`
  - `createClientAction(formData): Promise<ActionResult<{ id: string; slug: string }>>` — valida via Zod; insert; map error 23505 (unique) → `err(..., 'slug_taken')`. Sucesso → `redirect('/clients/{id}')`. **Nota**: redirect dentro do action interrompe; pra integrar com `useTransition` no client, o action retorna `ok({id, slug})` e o **client component** faz o `router.push`. Isso permite UI mostrar loading + erros sem refresh.
  - `updateClientAction(id: string, formData): Promise<ActionResult<{ id: string }>>` — valida; checa `clientHasActiveOperations` se slug mudou (rejeita); update; mesmo error mapping
  - `archiveClientAction(id: string): Promise<ActionResult<void>>` — checa `clientHasActiveOperations`; rejeita se sim com `err(..., 'has_active_operations')`; senão setta `archived_at = now()`. Sucesso retorna `ok(undefined)`; client redireciona.
- **Dependencies**: `createServer`, Zod schema, `ActionResult`, `requireUserAction`

### `src/app/(app)/clients/page.tsx`

- **Purpose**: Lista com busca.
- **Location**: `src/app/(app)/clients/page.tsx`
- **Interfaces**: `async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> })`
- **Estrutura**:
  - Lê `searchParams.q`
  - `const clients = await listClients({ search: q })`
  - `const total = await countActiveClients()` (pra subtitle e pra empty state)
  - `<PageHeader title="Clientes" subtitle="{total} ativos" actions={<Link href="/clients/new"><Button variant="sage"><Plus /> Novo cliente</Button></Link>} />`
  - `<ClientsSearch initialQuery={q ?? ''} />` (client component que faz `router.replace` ao debouncear)
  - `<ClientsTable clients={clients} hasSearch={!!q} />`

### `src/components/domain/ClientsSearch.tsx`

- **Purpose**: Input de busca com debounce + URL update.
- **Location**: `src/components/domain/ClientsSearch.tsx`
- **Interfaces**: `function ClientsSearch({ initialQuery }: { initialQuery: string }): JSX.Element` — `'use client'`
- **Lógica**:
  - `useState(query)` + `useDebouncedValue(query, 300)`
  - `useEffect` que `router.replace(\`/clients?q=${debounced}\`)` quando debounced muda
  - Input com ícone `Search` (Lucide), placeholder "Buscar por nome ou slug…"

### `src/components/domain/ClientsTable.tsx`

- **Purpose**: Tabela de Clientes.
- **Location**: `src/components/domain/ClientsTable.tsx`
- **Interfaces**: `function ClientsTable({ clients, hasSearch }: { clients: ClientListItem[]; hasSearch: boolean }): JSX.Element`
- **Estrutura**:
  - Empty state se `clients.length === 0`: se `hasSearch` → "Nenhum Cliente para essa busca." + link limpar; senão → "Nenhum Cliente cadastrado." + botão Novo cliente
  - Tabela HTML simples: `<table class="w-full text-sm">` com `<thead class="text-left border-b border-line">` + linhas com `hover:bg-surface` + última coluna com `<Link href="/clients/{id}">Abrir</Link>`
  - Pills pra contagens; mono pra slug e data

### `src/components/domain/ClientForm.tsx`

- **Purpose**: Form de Cliente (create + edit).
- **Location**: `src/components/domain/ClientForm.tsx`
- **Interfaces**:
  - `'use client'`
  - `function ClientForm({ mode, initialData?, onArchive? }: ClientFormProps): JSX.Element`
  - `type ClientFormProps = { mode: 'create' } | { mode: 'edit'; initialData: ClientDetail; canChangeSlug: boolean; canArchive: boolean }`
- **Lógica**:
  - `useState` pra name, slug, notes; auto-update slug em onChange do name (só se slug ainda não foi tocado manualmente)
  - `useTransition` pro submit; chama `createClientAction` ou `updateClientAction` conforme mode
  - Erros do action exibidos abaixo do campo respectivo (mapping de `code` → field) ou no topo
  - Botão "Arquivar" só renderiza em edit + `canArchive=true`; usa `window.confirm` antes de chamar `archiveClientAction`
  - Em sucesso: `router.push('/clients/{id}')` (create) ou `router.refresh()` (edit) ou `router.push('/clients')` (archive)

### `src/components/domain/ExternalPersonsList.tsx`

- **Purpose**: Lista de pessoas externas no detalhe.
- **Location**: `src/components/domain/ExternalPersonsList.tsx`
- **Interfaces**: `function ExternalPersonsList({ persons }: { persons: ExternalPersonItem[] }): JSX.Element`
- **Estrutura**: lista de linhas em Card pequeno (ou simples row): nome + papel externo + e-mail (mailto se houver)

### `src/app/(app)/clients/new/page.tsx`

- **Purpose**: Rota /clients/new.
- **Interfaces**: `async function Page()`
- **Conteúdo**: `<PageHeader title="Novo cliente" />` + `<ClientForm mode="create" />`

### `src/app/(app)/clients/[id]/page.tsx`

- **Purpose**: Detalhe.
- **Interfaces**: `async function Page({ params })`
- **Estrutura**:
  - `const id = (await params).id`
  - `const client = await getClient(id)` — se null, `notFound()`
  - `const operations = await getActiveOperations({ clientId: id })`
  - `const persons = await getExternalPersonsByClient(id)`
  - PageHeader com nome + subtitle (slug + criado em) + botão Editar
  - Notes block (sage bg + border-left) se houver
  - Section Operações: grid de OperationCard
  - Section Pessoas externas: ExternalPersonsList

### `src/app/(app)/clients/[id]/edit/page.tsx`

- **Purpose**: Rota de edit.
- **Conteúdo**:
  - `const client = await getClient(id)` — se null OR arquivado, redirect pra `/clients`
  - `const hasOps = await clientHasActiveOperations(id)`
  - `<ClientForm mode="edit" initialData={client} canChangeSlug={!hasOps} canArchive={!hasOps} />`

### `src/components/layout/Sidebar.tsx` (modificação)

- **Purpose**: passar contagem de Clientes ativos pro SidebarNav.
- **Mudança**:
  - `const clientsCount = await countActiveClients()`
  - `<SidebarNav clientsCount={clientsCount} />`

### `src/components/layout/SidebarNav.tsx` (modificação)

- **Purpose**: adicionar "Clientes" + suporte a pill de contagem opcional por item.
- **Mudança**:
  - Tipo `NavItem` ganha `count?: number`
  - GROUPS atualizado: Espaço de trabalho ganha `{ href: '/clients', label: 'Clientes', icon: Users, count: clientsCount }` (passado via prop)
  - Render: se `count != null`, renderiza `<Pill variant="neutral">{count}</Pill>` à direita do label
  - Active state inclui `/clients/*`

---

## Data Models

Nenhum mudança de schema. Tipos derivados:

```ts
// src/lib/db/queries/clients.ts
import type { Database } from '@/lib/db/types';
type ClientRow = Database['public']['Tables']['clients']['Row'];

export type ClientDetail = ClientRow;
export type ClientListItem = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
  createdAt: string;
  operationsActive: number;
  externalPersons: number;
};
```

---

## Error Handling Strategy

| Error Scenario | Action handling | UI handling |
|---|---|---|
| Submit sem auth (cookie expirou) | `requireUserAction()` retorna `err(..., 'unauthenticated')` | Form mostra "Sessão expirada. Recarregue a página." |
| Slug duplicado | Postgres 23505 → `err('Já existe Cliente com esse slug.', 'slug_taken')` | Mensagem abaixo do campo slug |
| Validação Zod falha | Action retorna `err('<msg do zod>', 'validation_failed')` com primeira mensagem; ideal: estrutura mais rica de erros por campo, mas P1 fica simples | Mensagem no topo |
| Arquivar com ops ativas | `err('Cliente tem N Operações ativas. Arquive-as primeiro.', 'has_active_operations')` | Modal/alert no botão Arquivar |
| Slug change com ops ativas | `err('Cliente tem Operações ativas; slug não pode mudar.', 'slug_locked')` | Mensagem abaixo do campo |
| 404 (cliente não existe) | `getClient` retorna null → `notFound()` no page | Next 404 page |
| Erro genérico DB | `dbErr(error, 'createClientAction')` | Mensagem genérica no topo do form |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Search transport | URL query param `?q=` via `router.replace` | Server-side filtragem; deeplinkable; sem state global; acessível |
| Debounce | 300ms via custom hook | Padrão; balanço entre snap e network noise |
| Form library | Vanilla `useState` + `useTransition` | Sem react-hook-form pra MVP. Zod no Server Action valida. Trade-off: validação client-side só por `required` HTML; erros detalhados vêm do server. Aceitável pra forms pequenos. |
| Action retorno | `ActionResult` + client faz `router.push` em sucesso | Permite UI mostrar erro inline sem refresh; consistência com Invariante 13 |
| Slug uniqueness | DB constraint + erro 23505 mapeado | Sem AJAX async check no form (out of scope). Erro on submit. |
| Slug edit lock | App-level (`updateClientAction` verifica) | Mais cedo que o RLS; UX clara |
| Archive cascade behavior | Bloqueia se ops ativas; senão soft-delete | DB FK RESTRICT já protege; app dá mensagem amigável antes |
| Modal vs page (form) | Page | Spec aprovou; sem componente Modal ainda |
| Confirmação de arquivar | `window.confirm` | Pragmático; Modal custom fica pra v2 |
| Slug auto-suggest "freeze" | Track `slugTouched` boolean no form | Se user editou slug manualmente, parar de sobrescrever |
| Sidebar contagem inicialização | Sidebar vira `async` Server Component que faz query | Re-renderizada em cada navegação dentro do route group; aceitável; pode evoluir pra streaming |
| Reuso de `OperationCard` no detalhe | Sim, com `clientId` filter na query | DRY; visual consistente |
| Person list no detalhe | Componente novo (`ExternalPersonsList`) — não pega Avatar (defere) | Mostra nome + role + email; simples row |
| Where to put domain types | Dentro do arquivo de query (`clients.ts`) | Co-localizados; export type pra componentes |
| `zod` install | Sim, necessário aqui | Vai virar dep central pra forms. CLAUDE.md já cita Zod no skill. |

---

## Notes

- **Sidebar query em layout**: Sidebar é renderizada em `(app)/layout.tsx`. Toda nav dentro do route group re-roda o layout, e portanto a query `countActiveClients`. Para Next 16 com Turbopack isso é eficiente (cached por request).
- **Não esquecer**: ao adicionar link Clientes na Sidebar, manter "Home" como item primeiro. Sidebar grupos: Espaço de trabalho = [Home, Clientes]; Admin = [Catálogo, Painel].
- **`/clients/[id]/edit` arquivado**: redirect pra `/clients` se cliente arquivado (não 404, porque ID válido — só não-acessível).
- **Performance**: 3 queries no detalhe (client, operations, persons) — paraleliza com `Promise.all`. Importante.
