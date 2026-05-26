# Design: operation-members

**Spec:** [spec.md](./spec.md)
**Issue:** [#80](https://github.com/rafaelemeth/delivery_os/issues/80)
**Status:** DESIGN

---

## Decisões pendentes (resolvidas)

| ID | Decisão | Por quê |
|---|---|---|
| **D1** | **Helper function `can_see_operation(uuid)` (STABLE LANGUAGE SQL)** com EXISTS dentro. Policies chamam o helper, não duplicam EXISTS. | Postgres planner faz inline de SQL STABLE — sem custo perceptível. Legibilidade ganha em 15 policies. Tem PostgreSQL doc oficial recomendando esse padrão pra RLS. |
| **D2** | **`role_in_op` fora do MVP.** Tabela é só `(profile_id, operation_id)` + audit. | Não há use case agora; granularidade vem só quando aparecer dor real. |
| **D3** | **Página dedicada `/operations/[id]/settings/members`** (não drawer). | Consistente com pattern `/catalog/<x>/[id]/edit`. Mais simples SSR, sem JS bundle extra. |
| **D4** | **Server-side: combobox carrega lista completa de profiles non-admin não-membros desta op** numa Server Component (poucos members totais; usuário escolhe via `<select>`). | Filtro client-side por texto se necessário — `<input type="search">` no client wrapper. Sem `?q=` server roundtrip pra MVP. |

---

## Modelo de dados

### Tabela nova

```sql
CREATE TABLE IF NOT EXISTS public.operation_members (
  profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT pk_operation_members PRIMARY KEY (profile_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_operation_members_operation_id
  ON public.operation_members(operation_id);

COMMENT ON TABLE public.operation_members IS
  'auth/scope: vincula profile (member) a operação que ele pode ver. Admin vê tudo sem precisar de row aqui. INSERT/DELETE só por admin.';
```

PK composta `(profile_id, operation_id)` substitui a necessidade de coluna `id` + UNIQUE. Index reverso em `operation_id` pra listar members de uma Op.

### Helpers SQL

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_see_operation(op_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.operation_members
    WHERE profile_id = auth.uid() AND operation_id = op_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_see_operation(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_see_operation(uuid) TO authenticated;
```

`SECURITY DEFINER` permite `is_admin()` ler `profiles` mesmo quando o caller é member sem permissão de SELECT em outros profiles. `STABLE` permite o planner cachear no escopo da query.

### RLS — pattern

Todas as policies atuais (`authenticated_full_access` ou `<tabela>_authenticated_full` com `USING (true)`) serão **substituídas** por:

```sql
DROP POLICY IF EXISTS <policy_atual> ON public.<tabela>;

CREATE POLICY <tabela>_scoped_select ON public.<tabela>
  FOR SELECT TO authenticated
  USING ( <expr de visibilidade> );

CREATE POLICY <tabela>_scoped_mutate ON public.<tabela>
  FOR INSERT TO authenticated
  WITH CHECK ( <expr de visibilidade> );

CREATE POLICY <tabela>_scoped_update ON public.<tabela>
  FOR UPDATE TO authenticated
  USING ( <expr de visibilidade> )
  WITH CHECK ( <expr de visibilidade> );

CREATE POLICY <tabela>_scoped_delete ON public.<tabela>
  FOR DELETE TO authenticated
  USING ( <expr de visibilidade> );
```

Naming: `<tabela>_scoped_<cmd>` substitui o `_authenticated_full`. Migration name: `20260526190001_operation_members_scope.sql`.

### Expressões de visibilidade por tabela

| Tabela | USING expression |
|---|---|
| `operations` | `public.can_see_operation(id)` |
| `frentes` | `public.can_see_operation(operation_id)` |
| `briefings` | `public.can_see_operation(operation_id)` |
| `meetings` | `public.can_see_operation(operation_id)` |
| `decisions` | `public.can_see_operation(operation_id)` |
| `attachments` | `public.can_see_operation(operation_id)` |
| `operation_villains` | `public.can_see_operation(operation_id)` |
| `operation_villain_narratives` | `public.can_see_operation(operation_id)` |
| `quick_wins` | `public.can_see_operation(operation_id)` |
| `operation_costs` | `public.can_see_operation(operation_id)` |
| `public_links` | `public.can_see_operation(operation_id)` |
| `allocations` | `EXISTS (SELECT 1 FROM frentes f WHERE f.id = allocations.frente_id AND public.can_see_operation(f.operation_id))` |
| `tasks` | `EXISTS (SELECT 1 FROM frentes f WHERE f.id = tasks.frente_id AND public.can_see_operation(f.operation_id))` |
| `clients` | `public.is_admin() OR EXISTS (SELECT 1 FROM operations o WHERE o.client_id = clients.id AND public.can_see_operation(o.id))` |
| `persons` (internas) | `public.is_admin() OR EXISTS (SELECT 1 FROM allocations a JOIN frentes f ON f.id=a.frente_id WHERE a.person_id=persons.id AND public.can_see_operation(f.operation_id))` |
| `persons` (externas) | `... OR (kind='external' AND client_id IS NOT NULL AND EXISTS (SELECT 1 FROM operations o WHERE o.client_id=persons.client_id AND public.can_see_operation(o.id)))` |

`persons` precisa de **única policy SELECT** combinando os dois casos via OR.

### Tabelas com policies inalteradas

| Tabela | Razão |
|---|---|
| `villains` | Catálogo global. Mantém policy aberta a `authenticated`. |
| `service_products` | Catálogo global. |
| `quick_win_catalog` | Catálogo global. |
| `profiles` | Refinado (vide abaixo). |

### `profiles` — policy refinada

```sql
DROP POLICY IF EXISTS profiles_authenticated_select ON public.profiles;

CREATE POLICY profiles_scoped_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.operation_members om_self
      JOIN   public.operation_members om_other USING (operation_id)
      WHERE  om_self.profile_id  = auth.uid()
        AND  om_other.profile_id = profiles.id
    )
  );
```

Admin policy de UPDATE atual (`profiles_admin_update`) fica.

### `operation_members` — policy

```sql
ALTER TABLE public.operation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY om_admin_all ON public.operation_members
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY om_member_select_self ON public.operation_members
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());
```

Admin lê/escreve tudo. Member lê só rows que mencionam ele (pra UI mostrar "Você está em N operações" eventualmente).

---

## Server Actions

`src/lib/actions/operation-members.ts` (novo):

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { type ActionResult, ok, err, dbErr } from '@/lib/actions/_types';
import { createServer } from '@/lib/db/client';
import { requireAdminAction } from '@/lib/auth/server';

const addSchema = z.object({
  operation_id: z.string().uuid(),
  profile_id:   z.string().uuid(),
});

export async function addOperationMemberAction(
  input: z.infer<typeof addSchema>,
): Promise<ActionResult<{ profile_id: string }>> {
  const adminCheck = await requireAdminAction();
  if (!adminCheck.ok) return adminCheck;

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return err('Dados inválidos.', 'validation_failed');

  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Sessão expirada.', 'unauthenticated');

  const { error } = await supabase
    .from('operation_members')
    .insert({
      operation_id: parsed.data.operation_id,
      profile_id:   parsed.data.profile_id,
      created_by:   user.id,
    });

  if (error) {
    if (error.code === '23505') return err('Já é membro desta Operação.', 'already_member');
    return dbErr(error, 'addOperationMember');
  }

  revalidatePath(`/operations/${parsed.data.operation_id}/settings/members`);
  revalidatePath(`/operations`);
  return ok({ profile_id: parsed.data.profile_id });
}

export async function removeOperationMemberAction(
  input: z.infer<typeof addSchema>,
): Promise<ActionResult<{ profile_id: string }>> {
  const adminCheck = await requireAdminAction();
  if (!adminCheck.ok) return adminCheck;

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return err('Dados inválidos.', 'validation_failed');

  const supabase = await createServer();
  const { error } = await supabase
    .from('operation_members')
    .delete()
    .eq('operation_id', parsed.data.operation_id)
    .eq('profile_id',   parsed.data.profile_id);

  if (error) return dbErr(error, 'removeOperationMember');

  revalidatePath(`/operations/${parsed.data.operation_id}/settings/members`);
  revalidatePath(`/operations`);
  return ok({ profile_id: parsed.data.profile_id });
}
```

---

## Queries

`src/lib/db/queries/operation-members.ts` (novo):

```typescript
export async function listOperationMembers(operationId: string) {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from('operation_members')
    .select('profile_id, created_at, profiles:profile_id(id, name, role)')
    .eq('operation_id', operationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAssignableProfiles(operationId: string) {
  // Members que ainda NÃO são desta operação.
  const supabase = await createServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('role', 'member')
    .not('id', 'in', `(
      SELECT profile_id FROM operation_members WHERE operation_id = '${operationId}'
    )`);
  // SECURITY: operationId vem do route param (Next valida UUID); ainda assim, escapar via cast.
  if (error) throw error;
  return data ?? [];
}
```

**Nota:** `listAssignableProfiles` não pode usar `in` com subquery via supabase-js limpinho. Alternativa: rodar 2 queries (todos members + members já desta op) e diff em memória. Reescrita:

```typescript
export async function listAssignableProfiles(operationId: string) {
  const supabase = await createServer();
  const [{ data: all }, { data: existing }] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('role', 'member'),
    supabase.from('operation_members').select('profile_id').eq('operation_id', operationId),
  ]);
  const existingIds = new Set((existing ?? []).map((r) => r.profile_id));
  return (all ?? []).filter((p) => !existingIds.has(p.id));
}
```

(Sem error handling explícito — confiar no throw do supabase-js se algo falhar.)

---

## UI

### Rota nova

`src/app/(app)/operations/[id]/settings/members/page.tsx`:
- Server Component.
- Chama `requireAdmin()` no topo → redirect pra `/operations/[id]` se não-admin.
- Carrega `listOperationMembers(id)` + `listAssignableProfiles(id)`.
- Renderiza:
  - `<PageHeader title="Members · {operation.name}" subtitle="N atribuídos">` com link "← Voltar pra Operação".
  - `<OperationMembersList items={members}>` — lista de cards/rows com nome + email + botão "Remover" (Server Action).
  - `<AddOperationMemberForm operationId={id} candidates={assignable}>` — `<select>` + botão "Adicionar".
- Empty state se members.length === 0.

### Componentes

`src/components/domain/OperationMembersList.tsx` (Server Component):
- Grid `[2rem_1fr_auto]` (avatar + nome/email + botão Remove).
- Botão "Remover" é Server Action form com confirmation via `onSubmit` (client wrapper pequeno).

`src/components/domain/AddOperationMemberForm.tsx` (Client Component):
- `useFormStatus` ou `useTransition`.
- `<select>` populado pelo prop `candidates`.
- Toast/inline message no retorno do action.

### Acesso pela Operação

Em `/operations/[id]/page.tsx` (operation detail), adicionar link "Members" (só pra admin) no `PageHeader` actions, ao lado dos outros links.

---

## Auth helpers

Já existe `requireAdminAction()` em `src/lib/auth/server.ts` (vide invariante 14). Verificar e usar. Se não existir, criar:

```typescript
export async function requireAdminAction(): Promise<ActionResult<{ userId: string }>> {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err('Sessão expirada.', 'unauthenticated');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) return dbErr(error, 'requireAdminAction');
  if (profile?.role !== 'admin') return err('Acesso negado.', 'forbidden');

  return ok({ userId: user.id });
}
```

E `requireAdmin()` (no-action variant) pra Server Components:

```typescript
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') notFound();
  return { userId: user.id };
}
```

---

## Plano de fases (refinado)

### Phase 1 — Núcleo (PR-A)

**Migration:** `20260526190001_operation_members_scope.sql` contendo:
1. `CREATE TABLE operation_members` + index + comment.
2. `CREATE FUNCTION is_admin()` + grants.
3. `CREATE FUNCTION can_see_operation()` + grants.
4. RLS rewrite em **operations + frentes + briefings + meetings + decisions + attachments + operation_villains + operation_villain_narratives + quick_wins + operation_costs + public_links + allocations + tasks** (todas as **diretas + allocations/tasks** via frente).
5. RLS para `operation_members` (admin all + member select self).

**Backend:**
6. Regenerar types via MCP.
7. `src/lib/db/queries/operation-members.ts` (listOperationMembers, listAssignableProfiles).
8. `src/lib/actions/operation-members.ts` (addOperationMemberAction, removeOperationMemberAction).
9. `src/lib/auth/server.ts` — confirmar `requireAdmin()` + `requireAdminAction()` existem; criar se não.

**UI:**
10. Page `/operations/[id]/settings/members/page.tsx`.
11. Component `OperationMembersList`.
12. Component `AddOperationMemberForm` (client).
13. Link "Members" no header de `/operations/[id]/page.tsx` (só admin).

**Smoke:**
14. Build + typecheck verde.
15. Verify manual com admin/member em Vercel preview.

**PR-A merge.**

### Phase 2 — Cascata (PR-B)

**Migration:** `20260527XXXXXX_operation_members_scope_indirect.sql`:
1. RLS rewrite em **clients** (admin OR EXISTS op visível).
2. RLS rewrite em **persons** (admin OR alocada em frente visível OR externa de cliente visível).
3. RLS rewrite em **profiles** (refinado).

**Backend:**
4. Validar `listClients`, `listPersons` ainda funcionam (devem — RLS faz o filtro).
5. Validar painel admin queries (`getPainelKpis` etc) — devem retornar números filtrados automaticamente.

**UI:**
6. Estados vazios diferenciados em `/clients`, `/persons`, `/` (painel) — texto "Você ainda não foi atribuído..." quando member tem count=0.

**Smoke:**
7. Member logado vê só seus clientes/pessoas/painel zerado/parcial.
8. Admin vê tudo.

**PR-B merge.**

### Phase 3 — Polish (PR-C)

1. 404 vs 403 consistentes em rotas protegidas.
2. Copy review nas mensagens vazias.
3. Badge "X operações" no `/profile` (se a página existe).
4. Atualizar `.specs/project/ROADMAP.md` com a feature na seção "Bônus" (#80 / PR-A/B/C).
5. Atualizar `docs/DATABASE_SCHEMA.md` com `operation_members`.
6. Eventualmente refletir em `.claude/skills/dryos-conventions/SKILL.md` o pattern de RLS scoped.

**PR-C merge.**

---

## Riscos & mitigações detalhados

### R1 — RLS quebra queries existentes
**Cenário:** Server Action `archiveOperation()` chamada por admin antes da feature funciona; depois talvez funciona, mas Server Action chamada por member num operationId que ele vê retorna sucesso, e num que não vê, RLS retorna 0 rows. Action precisa detectar e retornar `not_found`.

**Mitigação:**
- Em todo `.update().eq('id', ...).select('id').maybeSingle()` que retorna null, retornar `err('Operação não encontrada.', 'not_found')`.
- Revisar todas as Server Actions em `src/lib/actions/operations.ts`, `frentes.ts`, etc.
- Validar smoke pós-Phase 1: admin completa fluxo normal; member não vê o que não deve.

### R2 — Performance
**Cenário:** RLS em `clients` que faz EXISTS em `operations` filtradas por `can_see_operation()` que faz EXISTS em `operation_members`. Plano: 3 nested loops.

**Mitigação:**
- Index em `operation_members(profile_id)` (já no schema, via PK composta).
- Index em `operation_members(operation_id)` (explícito no design).
- Index em `operations(client_id)` (verificar; criar se não existir).
- Postgres planner com STABLE/SECURITY DEFINER costuma inlinear. Validar com `EXPLAIN ANALYZE` se sentir > 200ms.

### R3 — `public_links` ainda funciona pra visualizador externo (token)?
**Cenário:** `/public/[token]` lê via `public_link_view` ou similar (RPC/view). Se a query passa pelo `auth.uid()=null` (visitante anônimo), `can_see_operation()` retorna false → link público quebra.

**Mitigação:**
- Confirmar como `/public/[token]` lê dados hoje (provavelmente via RPC `SECURITY DEFINER` que bypassa RLS).
- Se for direct table access via authenticated role, criar policy adicional: `OR EXISTS (SELECT 1 FROM public_links pl WHERE pl.token=current_setting('app.public_token', true) AND pl.operation_id=<col>)` — fora do escopo desta feature; já está coberto pela arquitetura atual.

### R4 — Service-role bypass em jobs
Hoje sem cron/job. Quando aparecer, criar cliente Supabase com service-role-key e usar só em código server-side controlado.

### R5 — Member atribuído depois é desligado
Cascata: deleta row de `operation_members`; queries seguintes não veem mais. Sem invalidação de session (member continua logado, mas filtros automáticos pegam na próxima query).

---

## Validação manual final

Checklist a rodar **no Vercel preview** após PR-B merge (PR-A só), com 3 perfis: admin (Rafael), admin (Gabriela), member (Gabriel):

1. Admin Rafael cria nova Operação. Aparece no `/operations` dele e da Gabriela. **Gabriel não vê.**
2. Rafael vai em `/operations/<id>/settings/members`, adiciona Gabriel. Gabriel recarrega → vê 1 Operação.
3. Gabriel tenta `/operations/<id_que_nao_e_dele>` direto na URL → 404.
4. Rafael remove Gabriel. Gabriel recarrega → vê 0.
5. Gabriel tenta `/clients` → vazio (até voltar a ter Op atribuída).
6. Painel da Gabriela ≠ painel do Gabriel quando Gabriel tem 1 Op.
7. Catálogos (vilões/produtos/QW) visíveis pra todos os 3.

---

## Decisões abertas pra Tasks

- **T-D1:** Estrutura do `tasks.md` por fase ou um único com phases sub-headed? Padrão DRYOS: um único, sub-headed.
- **T-D2:** Phase 1 entra como 1 PR único ou subdivide migration vs UI? Padrão DRYOS: 1 PR por fase. (Phase 1 = 1 PR.)
