# operations-crud Design

**Spec**: `.specs/features/operations-crud/spec.md`
**Status**: Draft

---

## Architecture Overview

CRUD em 4 rotas + Hero oak component novo + 6 sections (algumas placeholder) no detalhe + Recharts pra sparkline financeiro + Sidebar update. Reusa padrões consolidados em `clients-crud` (ActionResult, Zod, useDebouncedValue, search server-side, ClientForm-style form).

```mermaid
graph TD
    Home["/page.tsx<br/>(Home) + 'Nova operação'"] --> NewBtn[Link /operations/new]
    Sidebar --> NavOps[/operations link + count]
    List[/operations page.tsx<br/>listOperations\(q\)] --> Table[OperationsTable]
    List --> Search[OperationsSearch 'use client']
    New[/operations/new] --> Form[OperationForm 'use client']
    Form -->|create| CreateAction[createOperationAction]
    Form -->|update| UpdateAction[updateOperationAction]
    Edit[/operations/[id]/edit] --> Form
    Detail[/operations/[id] page.tsx<br/>getOperation+frentes] --> Hero[OperationHero]
    Detail --> Frentes[FrentesListSection]
    Detail --> Finance[FinanceCards + Sparkline]
    Detail --> Placeholders[VillainsPlaceholder<br/>BriefingPlaceholder<br/>MeetingsPlaceholder<br/>CredentialsPlaceholder]
    CreateAction --> RedirectDetail
    UpdateAction --> RedirectDetail
    Archive[archiveOperationAction] --> RedirectList[/operations/]
```

---

## Code Reuse Analysis

### Existing

| Component | How |
|---|---|
| `Pill`, `Card`, `Button` (`src/components/ui/`) | Pills no hero/table, Card nas seções, Button no form |
| `PageHeader` | Lista + new + edit. Detalhe usa Hero custom em vez. |
| `cn` helper | classes condicionais |
| `useDebouncedValue` | Search input |
| `slugify` | N/A — operations não têm slug |
| `clientSchema` pattern (Zod) | Replicado em `operationSchema` |
| `ActionResult` + helpers | Toda action |
| `requireUserAction` | Guard nas actions |
| `createServer` | Queries server-side |
| `listClients` | Reuse no `OperationForm` pra select de Cliente |
| `getActiveOperations({clientId?})` | Já refatorada; não tocamos |
| Tokens DS v2 | Hero usa `bg-oak text-bg` + gradient via CSS inline |
| Sidebar pattern de countX | Estende com `operationsCount` |
| Lucide icons | `Briefcase` (sidebar), `Plus` (Nova), `ArrowLeft`, `Edit2`, `Archive`, `Calendar`, `DollarSign`, `Layers`, `Mail` (Briefing), `Users` (Reuniões) |

### Novos

| What | Where |
|---|---|
| `operationSchema` Zod | `src/lib/validators/operation.ts` |
| `parseMoneyBR(input): number` + `formatMoneyBR(value): string` | `src/lib/utils/money.ts` — reusará no detalhe + admin sem 05 |
| Recharts | `npm install recharts` — primeira vez |

---

## Components

### `src/lib/validators/operation.ts`

```ts
export const operationSchema = z.object({
  client_id: z.string().uuid('Cliente obrigatório.'),
  product_line: z.enum(['core', 'spark', 'studio']),
  name: z.string().trim().min(1, 'Nome obrigatório.').max(160),
  status: z.enum(['em_construcao', 'em_operacao', 'janela_critica']),
  recurrence: z.enum(['mensal', 'trimestral', 'anual', 'unica']).optional().or(z.literal('').transform(()=>undefined)),
  monthly_recurring_revenue: z.number().nullable().optional(),
  start_date: z.string().date().optional().or(z.literal('').transform(()=>undefined)),
  end_date: z.string().date().optional().or(z.literal('').transform(()=>undefined)),
}).refine((data) => !data.start_date || !data.end_date || data.start_date <= data.end_date, {
  message: 'Data de fim deve ser ≥ data de início.',
  path: ['end_date'],
});
```

### `src/lib/utils/money.ts`

- `formatMoneyBR(value: number | null): string` — "R$ 8.500,00" ou "—"
- `parseMoneyBR(input: string): number | null` — aceita "8500", "8.500,00", "8500.00", "R$ 8.500,00"; null se vazio

### `src/lib/db/queries/operations.ts` (estender)

```ts
// listagem completa pra tabela /operations
type OperationListItem = {
  id; name; clientName; clientSlug;
  productLine; status; recurrence;
  monthlyRecurringRevenue: number | null;
  startDate; endDate; createdAt;
  activeFrentes: number;
};
async function listOperations({ search? }): Promise<OperationListItem[]>

// detalhe denso
type OperationDetail = {
  id; name; productLine; status; recurrence;
  monthlyRecurringRevenue; startDate; endDate; createdAt;
  client: { id; name; slug };
  frentes: FrenteListItem[];
};
async function getOperation(id: string): Promise<OperationDetail | null>

async function countActiveOperations(): Promise<number>
async function operationHasActiveFrentes(id: string): Promise<boolean>
```

### `src/lib/actions/operations.ts`

3 actions seguindo pattern de `clients.ts`:
- `createOperationAction(formData)`: parse Zod → INSERT → `ok({id, name})`
- `updateOperationAction(id, formData)`: same shape; `client_id` não pode mudar (ignora se passado)
- `archiveOperationAction(id)`: checa `operationHasActiveFrentes` → bloqueia se sim; senão `archived_at = now()`

### `src/components/domain/OperationsTable.tsx`

Server Component. Recebe `OperationListItem[]` + `hasSearch`. Estrutura igual a `ClientsTable` (table HTML simples com hover) com colunas do spec.

### `src/components/domain/OperationsSearch.tsx`

Idêntico ao `ClientsSearch` mas com placeholder "Buscar por operação ou cliente…" e endpoint `/operations`.

### `src/components/domain/OperationForm.tsx`

Client component. `mode = 'create' | 'edit'`. Inputs:
- Select Cliente (loads `clientsForSelect` prop)
- Select linha de produto
- Input nome com sugestão automática
- Select status (em_construcao + em_operacao em create; + janela_critica em edit)
- Select recurrence
- Input MRR (money parse on submit)
- Input start_date (type=date)
- Input end_date (type=date)
- Botões: Salvar (primary), Cancelar (ghost), Arquivar (ghost critical, só em edit + canArchive)

Estado:
- `nameTouched` boolean — auto-suggest `{clientName} {ProductLineLabel}` enquanto nameTouched=false e ambos client+line selecionados
- Erros mapeados por field
- `useTransition` pro submit; archive

### `src/components/domain/OperationHero.tsx`

Server Component (sem state, pode ser RSC). Bloco oak + gradient sage radial.

```tsx
<section className="relative bg-oak text-bg rounded-lg p-8 overflow-hidden mb-7">
  <div className="absolute -top-1/2 right-[-10%] w-3/5 h-[200%]
                  bg-[radial-gradient(circle,rgba(147,181,150,0.18),transparent_60%)]
                  pointer-events-none" />
  <div className="relative">
    <div className="flex items-start justify-between mb-5">
      <div className="font-mono text-[10px] uppercase tracking-wide opacity-60">
        clientes / {client.slug} / operação
      </div>
      <Link href={`/operations/${op.id}/edit`}>
        <Button variant="ghost" className="bg-white/10 hover:bg-white/20 text-bg border-white/20">
          <Edit2 /> Editar
        </Button>
      </Link>
    </div>
    <div className="flex items-center gap-2 mb-4">
      <span className="inline-flex ... bg-sage-bg text-sage-deep rounded-pill">● {ProductLineLabel}</span>
      <Pill variant={statusVariantOnDark}>{StatusLabel}</Pill>
    </div>
    <h1 className="font-display text-4xl font-semibold leading-tight">
      {client.name}
    </h1>
    <p className="font-body text-base opacity-70 mt-1">{op.name}</p>

    <div className="flex flex-wrap gap-x-7 gap-y-3 mt-7">
      <MetaChip label="Recorrência" value={recurrenceLabel(op.recurrence)} />
      <MetaChip label="MRR" value={formatMoneyBR(op.monthlyRecurringRevenue)} />
      <MetaChip label="Início" value={fmtDate(op.startDate)} />
      <MetaChip label="Fim" value={fmtDate(op.endDate)} />
      <MetaChip label="Criado" value={fmtDate(op.createdAt)} />
    </div>
  </div>
</section>
```

`MetaChip` interno: `<div><span class="font-mono text-[10px] uppercase tracking-wide opacity-60 block">{label}</span><span class="font-body text-sm font-medium">{value}</span></div>`

Pill status no hero: dentro do oak, precisa de variant que contrast. Eu uso bg `bg-white/15` + texto colorido pra warning/critical. **Decisão**: criar variant condicional inline, sem novo Pill variant.

### `src/components/domain/FrentesListSection.tsx`

Section com h2 + contagem. Lista frentes em rows compactas (não cards). Empty: "Nenhuma Frente nesta Operação."

### `src/components/domain/FinanceCards.tsx`

3 cards horizontais. O primeiro (MRR) tem sparkline.

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
  <Card>
    <Icon DollarSign /> <span>MRR</span>
    <h3 className="font-display text-3xl">R$ 8.500,00</h3>
    <Sparkline data={mockHistory(mrr)} />
    <span className="font-mono text-xs text-mute">últimos 6 meses</span>
  </Card>
  <Card>
    <Icon Repeat /> <span>Recorrência</span>
    <h3 className="font-display text-2xl">Mensal</h3>
  </Card>
  <Card>
    <Icon Calendar /> <span>Contrato</span>
    <h3 className="font-display text-base">DD/MM/AA → DD/MM/AA</h3>
  </Card>
</div>
```

### `src/components/domain/Sparkline.tsx`

Client Component (Recharts é client-only). Recebe `data: number[]`. Renderiza `<ResponsiveContainer><AreaChart>` com gradient sage→transparent.

### `src/components/domain/PlaceholderSection.tsx`

Section genérica pra Vilões/Briefing/Reuniões/Credenciais:

```tsx
type Props = { title: string; subtitle: string; comingIn: string };
// Renderiza Card simples com h2 + texto + pill "Em construção · {comingIn}"
```

Usado 4x no detalhe.

### Pages

- `src/app/(app)/operations/page.tsx` — lista (igual ao /clients)
- `src/app/(app)/operations/new/page.tsx` — preload `listClients()` p/ select; renderiza `<OperationForm mode="create" clientsForSelect={...} />`
- `src/app/(app)/operations/[id]/page.tsx` — substitui placeholder atual; renderiza Hero + Sections
- `src/app/(app)/operations/[id]/edit/page.tsx` — `<OperationForm mode="edit" ... />`

### Sidebar

- `Sidebar.tsx`: `const [user, clientsCount, operationsCount] = await Promise.all([getUser(), countActiveClients(), countActiveOperations()])`
- `SidebarNav.tsx`: prop `operationsCount`; novo NavItem em "Espaço de trabalho"

### Home `page.tsx` update

- PageHeader actions ganha `<Link href="/operations/new"><Button variant="sage">+ Nova operação</Button></Link>`

---

## Data Models

Nenhum schema novo. Tipos derivados nas queries (vide componente section acima).

---

## Error Handling Strategy

| Scenario | Action | UI |
|---|---|---|
| Cliente arquivado durante o submit | `err('Cliente não disponível.', 'invalid_client')` | Mensagem geral no top |
| MRR negativo | Zod refine → `err(...)` | Inline |
| end_date < start_date | Zod refine → `err(...)` | Inline em end_date |
| Status inválido (não-enum) | Zod rejeita | Inline |
| Archive com frentes ativas | `err(..., 'has_active_frentes')` | Mensagem geral |
| 404 (op não existe ou arquivada) | Detail `notFound()`; edit `redirect('/operations')` | Next 404 |
| FK violation client_id (cliente deletado teoricamente) | Postgres 23503 → `err('Cliente inválido.', 'invalid_client')` | Inline |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Hero como componente separado | Sim, `OperationHero` | Reutilizável se aparecer em outras telas (link público?) |
| Pill status no hero (dark bg) | Variants existentes + className override (bg-white/15, etc) | Não precisamos de Pill variants "dark mode" agora; override pontual aceita |
| Sparkline impl | Recharts `AreaChart` minimal | Já planejado pro Admin sem 05; bom investimento |
| Mock data pro sparkline | Array hardcoded a partir do MRR atual + jitter ±10% sobre 6 pontos | Sem histórico real ainda; transparent placeholder até `briefing-vivo` ou faturamento real existir |
| Cliente select | Native `<select>` | 5-20 clientes; combobox custom é over-engineering |
| Cliente em edit | disabled | Pra trocar = nova operação |
| Status "arquivada" no form | Esconde | Vem só pelo botão Arquivar |
| MRR input | Texto livre + parse no submit | Acessível; sem mask custom |
| Form library | **react-hook-form + @hookform/resolvers/zod** (decisão revisada) | Forms ficaram >5 campos com cross-field validation. RHF + Zod resolver elimina duplicação de mensagens entre client e server. ClientForm refatorado nesta feature pra manter consistência. |
| `OperationForm` client component recebe `clientsForSelect: { id; name }[]` via prop | Sim | Server Component da página faz fetch; passa pro client. Padrão Next 15+ |
| Placeholder sections | `PlaceholderSection` único e configurável | 4 lugares quase idênticos; DRY |
| Detail rendering completo (todas 6 sections) | Sim | Aprovado no spec; gives full visual da Operação aberta |
| Sidebar serve em paralelo `getUser + countClients + countOps` | Sim | `Promise.all` pra latência |
| Operação retorna 404 se arquivada | Sim | Consistência com clients-crud |
| Move `formatDateBR` pra `src/lib/utils/date.ts` | Sim — vinha duplicado em OperationCard + ClientsTable | Quick refactor que limpa antes de espalhar |

---

## Notes

- **`MetaChip` no Hero**: inline component dentro de `OperationHero.tsx` (não exporta, é detalhe interno)
- **Status "Em construção"** com pill `neutral` (cinza) no Hero contra fundo oak: o fundo `bg-surface` da Pill neutral fica claro demais. Override: `bg-white/15 text-bg/80`
- **Sparkline dados**: função `mockMrrHistory(currentMrr: number): number[]` retorna 6 valores com variação ±10% determinística (seedada com o id pra estabilidade entre reloads)
- **Antes de criar tabelas (CLAUDE.md rule)**: Esta feature **não cria tabelas**. Schema da semana 1 cobre tudo.
- **`docs/DATABASE_SCHEMA.md`** ainda não criado per CLAUDE.md; vou criar nesta feature já que adicionamos seed e crescemos consultas — uma boa hora pra começar.
