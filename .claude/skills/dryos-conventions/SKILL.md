---
name: dryos-conventions
description: Convenções de código, naming, estrutura de pastas, padrões de query Supabase e Git para o projeto DRYOS Delivery. Carregar SEMPRE antes de criar arquivos, escrever queries, modelar tabelas ou abrir PR. Define o que é canônico e o que está proibido.
---

# DRYOS Conventions

Esta skill é o contrato de implementação do DRYOS Delivery. Antes de qualquer código novo, ler integralmente.

## TypeScript

### Configuração obrigatória

`tsconfig.json` deve conter:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Regras duras

- **Nunca use `any`.** Em casos genuinamente desconhecidos, use `unknown` e narrow.
- **Não use `as` para forçar tipo.** Se precisar, narrow com guards ou Zod.
- **Não use `@ts-ignore` ou `@ts-expect-error`** sem comentário explicando o porquê.
- Prefira `type` para shapes (composição via `&`). Use `interface` apenas quando precisar de declaration merging.
- Funções públicas têm tipo de retorno explícito.

### Exemplo bom
```typescript
type OperationStatus = 'em_construcao' | 'em_operacao' | 'janela_critica' | 'arquivada';

type Operation = {
  id: string;
  client_id: string;
  status: OperationStatus;
  product_line: ProductLine;
  monthly_recurring_revenue: number | null;
  created_at: string;
};

export async function getActiveOperations(clientId: string): Promise<Operation[]> {
  const { data, error } = await supabase
    .from('operations')
    .select('*')
    .eq('client_id', clientId)
    .neq('status', 'arquivada');

  if (error) throw new DatabaseError(error.message);
  return data ?? [];
}
```

### Exemplo ruim
```typescript
// ❌ uso de any
export async function getOperations(): Promise<any> { ... }

// ❌ as Operation forçando tipo
const op = result as Operation;

// ❌ retorno implícito
export async function getOperations(clientId: string) { ... }
```

---

## Naming

### Camadas

| Tipo | Convenção | Exemplo |
|---|---|---|
| Componente React | PascalCase | `OperationCard.tsx` |
| Hook customizado | camelCase com prefix `use` | `useOperations.ts` |
| Type/Interface | PascalCase | `Operation`, `FrenteWithRelations` |
| Função utilitária | camelCase | `formatBRL`, `parseStatusActionable` |
| Constante | UPPER_SNAKE | `MAX_FRENTES_PER_OPERATION` |
| Arquivo não-componente | kebab-case | `status-validator.ts`, `discord-webhook.ts` |
| Tabela Postgres | snake_case plural | `operations`, `quick_wins`, `frente_allocations` |
| Coluna Postgres | snake_case | `created_at`, `client_id`, `monthly_recurring_revenue` |
| Enum Postgres | snake_case | `frente_cycle_type`, `meeting_visibility` |
| Migration | numerada + descritivo | `20260501000001_create_clients.sql` |

### Vocabulário do domínio

Sempre use os termos canônicos. Não inventar sinônimos:

- **Cliente** (nunca "customer", "conta")
- **Operação** (nunca "projeto", "deal", "engagement")
- **Frente** (nunca "tarefa", "workstream", "trilha")
- **Vilão** (nunca "problema", "pain point")
- **Quick Win** (nunca "entrega", "milestone", "conquista" no código — só na UI pública)
- **Briefing** (nunca "escopo", "spec")
- **Decisão** (nunca "deliberação", "resolução")
- **Status acionável** (nunca "status atual", "estado")

No código, em inglês padrão (`Client`, `Operation`, `Frente`, `Villain`, `QuickWin`, `Briefing`, `Decision`, `ActionableStatus`). Na UI, em português.

---

## Estrutura de pastas

```
/src
  /app
    /(app)/                    # Rotas autenticadas (Admin + Membro)
      /layout.tsx              # Layout com sidebar
      /page.tsx                # Home (3 listas)
      /admin/page.tsx          # Painel do Admin
      /operations/[id]/page.tsx
      /clients/[id]/page.tsx
      /catalog/                # Admin only
    /(public)/                 # Link público com token
      /share/[token]/page.tsx
    /api/
      /webhooks/tally/route.ts
      /webhooks/discord/route.ts
    /layout.tsx                # Layout root (fontes, providers)

  /components
    /ui/                       # Atoms — shadcn customizado
      Button.tsx
      Pill.tsx
      Card.tsx
      Avatar.tsx
      Icon.tsx
    /domain/                   # Componentes de domínio
      OperationCard.tsx
      VillainCard.tsx
      FrenteRow.tsx
      QuickWinCard.tsx
      MeetingTimeline.tsx
    /layout/
      Sidebar.tsx
      PageHeader.tsx

  /lib
    /db/
      client.ts                # createServerClient, createBrowserClient
      types.ts                 # Auto-gerado pelo supabase CLI
      queries/                 # Server-side query functions
        operations.ts
        villains.ts
        ...
    /utils/
      format.ts                # formatBRL, formatDate, formatRelative
      status.ts                # parseActionableStatus, validateStatusFormat
    /validators/
      operation.ts             # Zod schemas
      frente.ts
    /integrations/
      bitwarden.ts
      tally.ts
      discord.ts

  /styles
    globals.css

/supabase
  /migrations
    20260501000001_initial_schema.sql
    20260501000002_seed_villains.sql
    ...
  /seed
    villains.sql
    quick_win_catalog.sql

/docs
  prd.md
  mockup-v2.html

/.claude
  /skills
    /dryos-conventions/SKILL.md
    /dryos-design-system/SKILL.md
```

---

## Supabase

### Cliente

Dois clientes, nunca confundir:

```typescript
// src/lib/db/client.ts
import { createServerClient } from '@supabase/ssr';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

// Server Components, Server Actions, Route Handlers
export const createServer = () => createServerClient<Database>(...)

// Client Components
export const createBrowser = () => createBrowserClient<Database>(...)
```

#### ⚠️ Fronteira client/server: `tsc` não pega, só `npm run build`

`client.ts` importa `next/headers` (`cookies`) — **proibido em Client Component**. Um `'use client'` que importe (mesmo transitivamente) qualquer módulo que puxe `client.ts` quebra o build do Turbopack na Vercel. **`tsc --noEmit` passa mesmo assim** — ele não analisa a fronteira. Só `npm run build` pega.

Regra: **constante/type/util reaproveitado por Client Component vive em módulo puro** (`src/lib/utils/*`), nunca num `queries/*.ts` ou `actions/*.ts` que importe `client.ts`. Se um módulo de servidor precisa expor a mesma constante, ele **re-exporta** do módulo puro.

```typescript
// ❌ profile-areas.ts (servidor) exporta constante E importa createServer
//    → AreaTaskForm (client) importa a constante → next/headers no client → build quebra

// ✅ src/lib/utils/areas.ts — puro, sem import de servidor
export const AREA_LABELS = { ... };
// ✅ profile-areas.ts re-exporta pra callers de servidor
export { AREA_LABELS } from '@/lib/utils/areas';
// ✅ AreaTaskForm.tsx (client) importa do módulo puro
import { AREA_LABELS } from '@/lib/utils/areas';
```

**Sempre rodar `npm run build` (não só `typecheck`) antes de PR que toca em Client Component.**

### Queries

- Toda query fica em `src/lib/db/queries/<entity>.ts`
- Funções de query são puras (recebem cliente como parâmetro)
- Retornam tipos derivados de `Database['public']['Tables'][...]`
- Erros lançam exceção tipada — não retornam `null` silencioso

```typescript
// src/lib/db/queries/operations.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

type Op = Database['public']['Tables']['operations']['Row'];

export async function getOperationsByStatus(
  supabase: SupabaseClient<Database>,
  status: Op['status']
): Promise<Op[]> {
  const { data, error } = await supabase
    .from('operations')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getOperationsByStatus: ${error.message}`);
  return data ?? [];
}
```

### Mutations

- Server Actions para mutations vindas da UI
- Route Handlers para webhooks externos (Tally, Discord)
- Validação Zod antes de tocar o banco
- Revalidate path apropriado depois de mutation

### RLS (Row Level Security)

- **RLS habilitado em todas as tabelas. Sem exceção.**
- Policies versionadas em migrations SQL
- Admin: pode tudo
- Membro: vê apenas Operações em que foi atribuído (`operation_members`) — vide "RLS scoped por Operação" abaixo
- Visualizador público: lê apenas via função RPC / `createAdmin` (service-role) que valida token

### RLS scoped por Operação (pattern canônico, #80)

A visibilidade do app é gated por Operação. **Toda tabela com `operation_id` (ou alcançável via FK) filtra por `can_see_operation()`.**

- **Helpers SQL** (SECURITY DEFINER, STABLE, `SET search_path = public`):
  - `is_admin()` → `profiles.role='admin'` do `auth.uid()`.
  - `can_see_operation(op_id uuid)` → `is_admin() OR EXISTS(operation_members WHERE profile_id=auth.uid() AND operation_id=op_id)`.
- **Tabela com `operation_id` direto:** `USING (public.can_see_operation(operation_id))`.
- **Tabela-neta (via frente):** `USING (EXISTS (SELECT 1 FROM frentes f WHERE f.id = <tabela>.frente_id AND public.can_see_operation(f.operation_id)))`.
- **Tabela indireta (clients/persons):** `USING (public.is_admin() OR EXISTS(...))` via operações visíveis.
- **Catálogos globais** (`villains`, `service_products`, `quick_win_catalog`): **NÃO scoped** no SELECT — leitura aberta a `authenticated` (universo de marca, não dado de cliente). **Escrita é `is_admin()`** (INSERT/UPDATE) e **DELETE não tem policy** (archive-only via `archived_at`, Inv. 06) — desde `20260611040158_rls_hardening` (#127).
- **Mutação:** policies `*_scoped_<cmd>` separadas por comando (select/insert/update/delete). Tabelas só-admin (clients/persons/diagnostics) usam `is_admin()` no insert/update/delete.
- **Gotcha:** RLS é PERMISSIVE por padrão → múltiplas policies pro mesmo comando são **OR'd**. Ao reescrever, **DROP todas as policies antigas** (`authenticated_full_access`, `<tabela>_authenticated_*`) senão a aberta anula o scoping.
- **Naming:** `<tabela>_scoped_select|insert|update|delete`. UI admin de atribuição em `/operations/[id]/settings/members`.
- **Storage (`storage.objects`):** policies espelham o RLS da tabela `attachments` — prefixo `<operation_id>/` parseado com **CASE + regex de UUID antes do cast** (cast cru estoura exceção por linha; o planner pode reordenar AND, então o guard PRECISA ser CASE), gated por `can_see_operation`. Path malformado = deny-all. Sem policy UPDATE (move/copy dessincronizam `attachments.storage_path`).

### Grants de função (pattern desde #127 / `20260611040158`)

- O default ACL **global** do `postgres` revoga EXECUTE de PUBLIC e concede a `service_role` — **função nova criada por migration nasce `{postgres=X, service_role=X}`**: sem EXECUTE de anon, authenticated ou PUBLIC (validado empiricamente com função-probe).
- Helper de RLS novo (SECURITY DEFINER chamado em policy): **precisa** de `GRANT EXECUTE ON FUNCTION ... TO authenticated` explícito na migration, senão toda policy que o chama falha com "permission denied for function" pra membros (as migrations de helpers já seguem isso).
- Função de trigger/event trigger: **nenhum grant** — trigger dispara com o privilégio do dono, EXECUTE do caller é irrelevante.
- RPC pública deliberada (não existe hoje): grant explícito a `anon` com justificativa na migration.
- **Gotcha 1:** `REVOKE FROM anon` em função existente é no-op se `PUBLIC` mantém o grant implícito de criação — anon herda via PUBLIC. Revogar dos dois.
- **Gotcha 2:** `ALTER DEFAULT PRIVILEGES IN SCHEMA ... REVOKE` **não remove** o built-in PUBLIC EXECUTE (entrada por-schema só ADICIONA grants — nota da doc do Postgres). Só a entrada **global** (sem `IN SCHEMA`) substitui o built-in.

### Migrations

- Versionadas em `supabase/migrations/`
- Nome: `YYYYMMDDHHMMSS_descricao.sql`
- Cada migration é **idempotente** quando possível (`CREATE TABLE IF NOT EXISTS`)
- Migrations não são editadas após commit — sempre cria uma nova
- Seeds em `supabase/seed/` rodam após migrations

### Types

- `npm run gen:types` chama `supabase gen types typescript --local > src/lib/db/types.ts`
- Rodar **após cada migration**
- `types.ts` é commitado (não está no .gitignore)

---

## Forms

Padrão canônico desde a feature `operations-crud`: **react-hook-form + zodResolver**. Schema único em `src/lib/validators/<entity>.ts` reaproveitado server-side pelo Server Action.

### Pattern

```typescript
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function MyForm(props: Props) {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Input, undefined, Output>({
    resolver: zodResolver(mySchema),
    defaultValues,
  });

  const busy = isSubmitting || isArchiving;

  async function onSubmit(data: Output) {
    setGeneralError(null);
    const fd = new FormData();
    // ... populate fd from data
    const result = await myAction(fd);
    if (result.ok) {
      router.push(`/path/${result.data.id}`);
      router.refresh();
      return;
    }
    // map result.code → setError(field) or setGeneralError
  }

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

### Regras

- **NÃO usar `useTransition`** pra wrapping de submit que vai navegar (L-003 em STATE.md: `isPending` fica preso após `router.push`)
- Loading state = `formState.isSubmitting` do RHF. Ações secundárias (Arquivar) usam `useState` local.
- Combina os dois em `busy = isSubmitting || isArchiving` pros `disabled` dos inputs.
- **Schema com `z.preprocess`** pra converter `""` em `undefined` (Zod `.transform()` quebra typing com RHF + `exactOptionalPropertyTypes`):
  ```typescript
  const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
  const optionalEnum = z.preprocess(emptyToUndefined, z.enum([...]).optional());
  ```
- **`useForm<Input, Context, Output>`** com generics explícitos quando o schema tem transformations (input ≠ output). `Input = z.input<typeof schema>`, `Output = z.output<typeof schema>`.
- Server Actions retornam `ActionResult<T>` com `code` tipado; client mapeia `code` → `setError('field', { message })` ou `setGeneralError`.
- Erros do banco (`23505 unique_violation`, `23503 fk_violation`) ficam no Server Action; client recebe `err(message, code)` já tratado.
- Em sucesso: `router.push` + `router.refresh()`. O componente desmonta antes de re-renderizar; não precisa resetar state.
- **Sem `react-hook-form/Controller`** por enquanto — inputs nativos via `register()` funcionam pra todos os campos atuais. Promover se precisar integrar com componente complexo (combobox, date picker).

### Auto-suggest entre campos

`useEffect` lendo `watch(field)`. Track `touched` em `useState` pra parar de sobrescrever quando user editou manualmente:

```typescript
const watchedName = watch("name");
useEffect(() => {
  if (slugTouched) return;
  setValue("slug", slugify(watchedName ?? ""), { shouldDirty: true });
}, [watchedName, slugTouched, setValue]);
```

### Confirmação destrutiva

`window.confirm("...")` direto. Modal custom fica pra v2 quando houver mais ações destrutivas.

---

## Status acionável (validação)

O princípio 04 exige formato específico. Implementação obrigatória:

```typescript
// src/lib/utils/status.ts
const ACTIONABLE_STATUS_PATTERN = /^(Aguardando|Em |Bloqueado|Saudável).+/i;
const FORBIDDEN_GENERIC = ['em andamento', 'em revisão', 'pendente', 'a fazer'];

export function isActionableStatus(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length < 15) return false;
  if (FORBIDDEN_GENERIC.some(g => trimmed === g)) return false;
  return true;
}
```

E no banco:
```sql
ALTER TABLE frentes
  ADD CONSTRAINT actionable_status_min_length
  CHECK (char_length(actionable_status) >= 15);

ALTER TABLE frentes
  ADD CONSTRAINT actionable_status_not_generic
  CHECK (
    lower(trim(actionable_status)) NOT IN
    ('em andamento', 'em revisão', 'pendente', 'a fazer', 'em progresso')
  );
```

---

## Git

### Branching

- `main` — produção, sempre deployable
- `feat/<area>-<descricao>` — features novas
- `fix/<area>-<descricao>` — correções
- `chore/<descricao>` — manutenção, deps, etc

### Commits

Mensagens em **inglês**, **imperativo**, **minúsculo**, **sem ponto final**.

**Bons:**
```
add migration for villains seed
implement actionable status validator
fix discord webhook payload format
refactor operation queries to use server client
```

**Ruins:**
```
Added migration for villains.        ❌ tempo passado + ponto
Fixed bug                           ❌ vago
WIP                                 ❌ não commitar WIP
asdfasdf                           ❌ óbvio
```

### Pull Requests

- Mesmo solo, abre PR e revisa antes de merge
- Título no mesmo formato dos commits
- Descrição responde 3 perguntas:
  1. O que muda?
  2. Por quê?
  3. Como testei?

### Conventional commits (opcional, recomendado)

```
feat: add villain progress tracking
fix: correct sage color in dark mode
chore: bump next to 15.0.3
refactor: extract status validation to lib
docs: update prd with villain decisions
```

---

## Performance / Acessibilidade

### Performance

- Server Components por padrão. Client Components só quando precisa de estado/interação
- Imagens via `next/image` (sem `<img>` direto)
- Fontes via `next/font` (sem `<link>` Google Fonts no html)
- Suspense boundaries em queries longas
- Não busca dado no client se pode buscar no server

### Acessibilidade

- Todo botão é `<button>` (não `<div onClick>`)
- Todo link interno é `<Link>` do Next (não `<a href>` para rotas internas)
- Imagens decorativas: `alt=""`. Imagens informativas: `alt` descritivo.
- Contraste mínimo WCAG AA — DS v2 já garante isso, mas valida cores customizadas
- Foco visível sempre (não removendo `outline` sem alternativa)
- Aria labels em ícones que não têm texto adjacente

---

## Pré-PR checklist

Antes de abrir PR:

- [ ] `npm run typecheck` passa sem erro
- [ ] `npm run build` passa **se tocou em Client Component** (`tsc` não pega violação de fronteira client/server — só o build do Turbopack)
- [ ] `npm run lint` passa sem erro
- [ ] `npm run gen:types` rodado se tocou em migration
- [ ] Migrations idempotentes
- [ ] RLS policies revisadas se tocou em tabela nova
- [ ] Componentes novos lidos pela skill `dryos-design-system`
- [ ] Sem `any`, sem `as`, sem `@ts-ignore`
- [ ] Sem console.log esquecido
- [ ] Texto da UI em português, código em inglês

---

`— Última revisão: maio 2026`
