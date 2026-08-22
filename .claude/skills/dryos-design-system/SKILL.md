---
name: dryos-design-system
description: Design system v2 do DRYOS Delivery — tokens de cor, tipografia, componentes (Pill, Card, Avatar, Icon, KpiCard, OperationCard, VillainCard, MultiSelect, Hero), padrões de layout e modo escuro. Carregar SEMPRE antes de criar componentes UI, telas novas, gráficos, ou qualquer coisa visual. Define o que é canônico e o que está proibido visualmente.
---

# DRYOS Design System v2

Linguagem visual: **produto contemporâneo com personalidade DRYOS**. Mesma alma da marca (fontes editoriais, paleta oak/cream/sage), com vocabulário de produto SaaS de qualidade (Linear, Vercel, Stripe).

**Referência canônica:** `docs/mockup-v2.html` — abrir e inspecionar quando em dúvida.

---

## Tokens

### Cores (CSS vars)

Definir em `src/styles/globals.css`:

```css
:root {
  /* Backgrounds */
  --bg: #FAFAF8;
  --surface: #F2F2EE;
  --card: #FFFFFF;

  /* Inks */
  --ink: #0A0A0A;
  --ink-soft: #1A1A1A;
  --mute: #6B6B68;
  --mute-soft: #9A9A95;

  /* Marca */
  --oak: #1F3A2A;
  --oak-light: #4A6A52;
  --oak-50: #1F3A2A0F;     /* fundo pill oak */

  /* Ação */
  --sage: #93B596;
  --sage-bg: #93B59624;
  --sage-deep: #5C8866;     /* texto sage no light */

  /* Linhas */
  --line: rgba(26, 26, 26, 0.08);
  --line-strong: rgba(26, 26, 26, 0.14);

  /* Funcionais */
  --critical: #B33A3A;
  --critical-bg: #B33A3A1A;
  --warning: #B5751F;
  --warning-bg: #B5751F1A;
  --ok: #2F6B3D;
  --ok-bg: #2F6B3D1A;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 4px 20px rgba(0, 0, 0, 0.08);

  /* Radii */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --radius-pill: 99px;
}

body.dark {
  --bg: #0E0E0C;
  --surface: #1A1A18;
  --card: #1A1A18;
  --ink: #FAFAF8;
  --ink-soft: #E8E8E5;
  --oak: #93B596;          /* oak vira sage no dark pra contraste */
  --oak-light: #B5C9B6;
  --oak-50: #93B5961F;
  --mute: #9A9A95;
  --mute-soft: #6B6B68;
  --line: rgba(255, 255, 255, 0.08);
  --line-strong: rgba(255, 255, 255, 0.16);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
}
```

### Tailwind 4 — CSS-first config via `@theme`

**Tailwind 4 não usa mais `tailwind.config.ts`.** Tokens entram em `globals.css` num bloco `@theme inline { ... }` logo após `@import "tailwindcss";`. Cada `--color-X` vira a classe `bg-X`, `text-X`, `border-X`. Cada `--font-X` vira `font-X`. Cada `--radius-X` vira `rounded-X`. Cada `--shadow-X` vira `shadow-X`.

```css
/* src/styles/globals.css */
@import "tailwindcss";

:root {
  /* CSS vars dos tokens — ver bloco "Cores" acima. Definidos no :root pra suportar
     dark mode via `body.dark`. */
  --bg: #FAFAF8;
  --oak: #1F3A2A;
  /* ... resto dos tokens ... */
}

body.dark {
  --bg: #0E0E0C;
  --oak: #93B596;
  /* ... overrides dark ... */
}

/* Tokens expostos como classes Tailwind: */
@theme inline {
  /* Cores → classes bg-/text-/border-/ring- */
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-card: var(--card);
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-mute: var(--mute);
  --color-mute-soft: var(--mute-soft);
  --color-oak: var(--oak);
  --color-oak-light: var(--oak-light);
  --color-oak-50: var(--oak-50);
  --color-sage: var(--sage);
  --color-sage-bg: var(--sage-bg);
  --color-sage-deep: var(--sage-deep);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-critical: var(--critical);
  --color-critical-bg: var(--critical-bg);
  --color-warning: var(--warning);
  --color-warning-bg: var(--warning-bg);
  --color-ok: var(--ok);
  --color-ok-bg: var(--ok-bg);

  /* Fontes → classes font-display/body/mono. As vars `--font-funnel-display`,
     `--font-onest`, `--font-jetbrains-mono` vêm do next/font/google no layout. */
  --font-display: var(--font-funnel-display);
  --font-body: var(--font-onest);
  --font-mono: var(--font-jetbrains-mono);

  /* Radii → classes rounded-sm/DEFAULT/lg/pill */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --radius-pill: 99px;

  /* Shadows → classes shadow-sm/md/lg */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 4px 20px rgba(0, 0, 0, 0.08);
}
```

**Como usar:**
- `<div className="bg-card text-ink-soft">` em vez de `bg-[var(--card)]`
- `<span className="font-mono text-[10px] text-mute">`
- `<button className="rounded-pill bg-oak-50 text-oak">`

**Adicionar token novo**: 1 linha em `:root` + 1 linha em `@theme inline`. Não tem mais arquivo separado pra editar.

**PostCSS plugin**: `postcss.config.mjs` usa `"@tailwindcss/postcss": {}` (gerado pelo create-next-app).

### Tipografia

Carregar via `next/font` em `src/app/layout.tsx`:

```typescript
import { Funnel_Display, Onest, JetBrains_Mono } from 'next/font/google';

const funnelDisplay = Funnel_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
});

const onest = Onest({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${funnelDisplay.variable} ${onest.variable} ${jetbrainsMono.variable}`}>
      <body className="font-body bg-bg text-ink-soft antialiased">
        {children}
      </body>
    </html>
  );
}
```

### Hierarquia tipográfica (princípio 11)

| Uso | Família | Peso | Tamanho |
|---|---|---|---|
| Hero da Operação (nome cliente) | Display | 600 | 2.5rem (40px) |
| KPI principal (valor) | Display | 700 | 1.875rem (30px) |
| Card de cliente | Display | 600 | 1.25rem (20px) |
| Título de seção | Display | 600 | 1.125rem (18px) |
| Título de card | Display | 600 | 14-16px |
| Corpo | Body | 400 | 14px |
| Corpo grande (lede pública) | Body | 400 | 16px |
| Botão | Body | 500 | 13px |
| Pill | Mono | 500 | 10-11px |
| Label (mono) | Mono | 500 | 10-11px |
| Sub mono (data, contagem) | Mono | 400 | 10-11px |

**Display é reservado.** Não usar pra hierarquia secundária. Em listas, tabelas, formulários: Onest 500-600 em 13-14px.

---

## Componentes canônicos

### Pill (status canônico)

Pill é o sistema canônico de status. Seis variantes. **Não criar nova variante sem aprovação.**

```typescript
// src/components/ui/Pill.tsx
import { cn } from '@/lib/utils';

type PillVariant = 'neutral' | 'oak' | 'sage' | 'ok' | 'warning' | 'critical';

type PillProps = {
  variant?: PillVariant;
  showDot?: boolean;
  children: React.ReactNode;
  className?: string;
};

const variants: Record<PillVariant, string> = {
  neutral: 'bg-surface text-mute',
  oak: 'bg-oak-50 text-oak',
  sage: 'bg-sage-bg text-sage-deep dark:text-sage',
  ok: 'bg-ok-bg text-ok',
  warning: 'bg-warning-bg text-warning',
  critical: 'bg-critical-bg text-critical',
};

export function Pill({ variant = 'neutral', showDot, children, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5',
        'font-mono text-[10px] font-medium rounded-pill',
        'whitespace-nowrap',
        variants[variant],
        className
      )}
    >
      {showDot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
```

Uso semântico:
- `neutral` — info sem peso (contagem, prazo neutro)
- `oak` — linha de produto, marca, ênfase
- `sage` — saudável, expansão, positivo, conquista
- `ok` — sucesso confirmado (uptime OK, no prazo)
- `warning` — atenção, prazo apertado, decisão pendente
- `critical` — SLA em risco, sobrecarga, problema

### Card

Card é o container canônico:

```typescript
// src/components/ui/Card.tsx
type CardProps = {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
};

export function Card({ children, className, interactive }: CardProps) {
  return (
    <div
      className={cn(
        'bg-card border border-line rounded shadow-sm',
        'p-5',
        interactive && 'cursor-pointer transition-all hover:shadow-md hover:-translate-y-px hover:border-line-strong',
        className
      )}
    >
      {children}
    </div>
  );
}
```

### Avatar

```typescript
type AvatarProps = {
  initials: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'oak' | 'sage-deep' | 'oak-light';
};

const sizes = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

export function Avatar({ initials, size = 'md', color = 'oak' }: AvatarProps) {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center text-bg font-display font-semibold',
        sizes[size],
        color === 'oak' && 'bg-oak',
        color === 'sage-deep' && 'bg-sage-deep',
        color === 'oak-light' && 'bg-oak-light',
      )}
    >
      {initials}
    </div>
  );
}
```

### Ícones

**Sempre Lucide React.** Stroke 1.75, cor oak por padrão (ou herda do contexto).

```typescript
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

// Tamanhos canônicos
<AlertTriangle className="w-3.5 h-3.5" />   // sm
<AlertTriangle className="w-4 h-4" />        // md (padrão)
<AlertTriangle className="w-5 h-5" />        // lg

// Cor herda do contexto via text-* do Tailwind
<div className="text-oak"><AlertTriangle className="w-4 h-4" /></div>
```

**Proibido:**
- Ícones decorativos sem função semântica
- Ícones diferentes pro mesmo conceito em telas diferentes
- Ícones grandes (>20px) fora de hero/empty states

### Botão

Três variantes:

```typescript
type ButtonProps = {
  variant?: 'primary' | 'ghost' | 'sage';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  // ...props padrão de button
};

const variants = {
  primary: 'bg-ink text-bg hover:bg-oak',
  ghost: 'bg-card text-ink-soft border border-line-strong hover:bg-surface hover:border-ink',
  sage: 'bg-sage text-ink hover:bg-sage-deep hover:text-bg',
};

const sizes = {
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-3.5 py-2 text-[13px]',
};
```

### KpiCard

```typescript
type KpiCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  prefix?: string;        // 'R$'
  sparkline?: React.ReactNode;
  delta?: { value: string; tone: 'ok' | 'warning' | 'critical' | 'sage' };
  context?: string;
};
```

Estrutura visual: ícone no canto + pill de delta no canto direito → label → valor display gigante → sparkline preenchido → texto de contexto.

### OperationCard

Card de Operação na Home. Estrutura fixa:

1. Top: Pill da linha (oak) + Pill de status/countdown
2. Nome do cliente (Funnel Display 600, 1.25rem)
3. Status acionável + "desde Y" em mono pequeno
4. Footer: avatares empilhados + ação rápida ou pill secundária

### VillainCard

Card de vilão. Estrutura:

1. Top: avatar 48px (ilustração) + nome + citação em itálico
2. Progress: % gigante em display + delta em mono sage
3. Barra com gradiente `from-oak to-sage`
4. Footer: pill de severidade inicial

### CatalogViewToggle

Toggle segmented-control "Cards / Lista" usado nas páginas de catálogo (`/catalog`, `/catalog/products`, `/catalog/quick-wins`). Server component; persiste seleção via searchParam `?view=list` (sem param = cards, default).

```typescript
// src/components/ui/CatalogViewToggle.tsx
type CatalogView = 'cards' | 'list';

function normalizeCatalogView(raw: string | undefined): CatalogView;

type CatalogViewToggleProps = {
  basePath: string;   // ex: '/catalog/products'
  current: CatalogView;
};
```

Estrutura visual: dois `<Link>` envoltos por wrapper `bg-surface rounded-pill p-0.5`. Pill ativa fica `bg-card text-ink shadow-sm`; inativa fica `text-mute hover:text-ink`. Cada link tem ícone Lucide (`LayoutGrid` / `List`) 12px + label em font-mono 10px uppercase. `aria-current="page"` no ativo. Links com `prefetch={false}` e `scroll={false}` pra evitar saltos de viewport ao trocar modo.

Padrão de uso na página:

```tsx
const { view: viewRaw } = await searchParams;
const view = normalizeCatalogView(viewRaw);

<PageHeader actions={<CatalogViewToggle basePath="/catalog/products" current={view} />} />
{view === 'list' ? (
  <div className="bg-card border border-line rounded divide-y divide-line">
    {items.map((p) => <ProductRow key={p.id} product={p} />)}
  </div>
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {items.map((p) => <ProductCard key={p.id} product={p} />)}
  </div>
)}
```

**Quando aplicar:** páginas de catálogo administrativo (lista pode crescer >15 entradas). Listagens curtas de domínio (Frentes da Op, Quick Wins recentes) não precisam — usam só Card ou Row dedicado por contexto.

**Convenção dos Rows companheiros:** cada Card de catálogo tem um sibling `*Row` (ex: `VillainCard` / `VillainRow`, `ProductCard` / `ProductRow`, `QuickWinCatalogCard` / `QuickWinCatalogRow`). O Row usa grid `[2rem_1fr_auto]`: ícone 32px à esquerda, nome + metadados (pills/mono) wrap no meio, ações admin à direita. Wrapper externo `divide-y divide-line` sobre `Card` faz as bordas entre rows. Admin actions usam o mesmo `Archive*Button` do Card pra manter UX consistente.

---

### MultiSelect

Seletor múltiplo canônico (client component). Campo fechado mostrando os escolhidos como **chips removíveis**; ao abrir, um dropdown com **campo de busca** no topo + lista de **checkboxes**. Fecha em click-outside e ESC; ao abrir, foca a busca. Tailwind puro, sem libs externas (alinhado ao "Proibido" — sem Radix/headless, sem state global).

```typescript
// src/components/ui/MultiSelect.tsx
export type MultiSelectOption = { id: string; name: string };

type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;   // texto quando vazio (ex: '— sem responsável')
  disabled?: boolean;
  id?: string;            // liga ao <label htmlFor>
  emptyText?: string;     // quando options.length === 0
};
```

Estrutura visual: campo é um `<button>` (`bg-card border border-line rounded`, `min-h-[38px]`, `aria-haspopup="listbox"` + `aria-expanded`) com chips `bg-surface text-ink-soft rounded-pill` (cada um com `×` em `role="button"` que faz `stopPropagation`) e `ChevronDown` que rotaciona 180° no aberto. Dropdown: `absolute z-20 mt-1 w-full bg-card border border-line rounded shadow-md`; busca com ícone `Search` 14px; lista `max-h-52 overflow-y-auto` com `role="listbox" aria-multiselectable`. Check marcado = quadrado `bg-oak border-oak text-white` com ícone `Check`; desmarcado = `border-line`.

Padrão de uso (com react-hook-form `Controller`):

```tsx
<Controller
  control={control}
  name="assignee_person_ids"
  render={({ field }) => (
    <MultiSelect
      id="assignee_person_ids"
      options={assignees}
      value={field.value}
      onChange={field.onChange}
      disabled={isSubmitting}
      placeholder="— sem responsável"
    />
  )}
/>
```

**Quando aplicar:** qualquer campo de seleção N:N num form (responsáveis de Task, participantes, tags com catálogo). Substitui a anti-pill de checkboxes empilhados, que estourava o layout. Para seleção **única**, continuar com `<select>` nativo (ex: status, frente, tarefa-pai) — MultiSelect é só pra múltiplos.

---

## Padrões de layout

### Página padrão

```typescript
<div className="flex min-h-screen bg-bg">
  <Sidebar />
  <main className="flex-1 max-w-[1280px] p-7">
    <PageHeader title={...} subtitle={...} actions={...} />
    <Tabs />
    <Content />
  </main>
</div>
```

### Hero da Operação

Fundo oak sólido com gradiente sage radial. Texto cream. Pill da linha em sage abaixo do breadcrumb. Nome do cliente em display 2.5rem. Meta horizontal (4-5 itens) na faixa inferior.

```tsx
<section className="bg-oak text-bg rounded-lg p-8 relative overflow-hidden">
  <div className="absolute -top-1/2 right-[-10%] w-3/5 h-[200%]
                  bg-[radial-gradient(circle,rgba(147,181,150,0.15),transparent_60%)]
                  pointer-events-none" />
  {/* conteúdo */}
</section>
```

### Section card

Seções dentro da Operação aberta usam Cards com padding p-6:

```tsx
<Card className="p-6 mb-4">
  <SectionHeader title="Vilões em luta" count="3 ativos" action="Ver diagnóstico" />
  <VillainsGrid villains={...} />
</Card>
```

---

## Mobile patterns

DRYOS é primariamente desktop, mas precisa ser navegável em mobile (especialmente member em campo). Patterns canônicos abaixo — toda tela nova nasce com eles aplicados.

### Breakpoints

Tailwind default: `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`. Mobile-first sempre — escreva o base (mobile) primeiro, adicione `md:`/`lg:`/`xl:` pra refinar acima.

**Fronteira shell mobile/desktop:** `md` (768px). Abaixo: drawer + cards. Acima: sidebar fixa + tabelas.

### Shell — drawer pattern

Sidebar fixa de 220px funciona em desktop mas come a tela em mobile. Pattern:

- **Top-bar mobile** (`md:hidden sticky top-0 z-30`): logo "DRYOS Studio" + botão hamburger à direita. Altura `h-14`.
- **Sidebar desktop** (`hidden md:block`): wrapper externo aplica `fixed left-0 top-0 h-screen w-[220px]`. O componente `Sidebar` em si é puro conteúdo (`h-full w-full flex flex-col`).
- **Drawer mobile** (`md:hidden fixed inset-0 z-40`): backdrop `bg-ink/40` + painel `inset-y-0 left-0 w-[260px]` slide via `translate-x` (200ms). X interno no canto superior direito.
- **Fechamentos do drawer:** click no X, click no backdrop, tecla ESC, e auto-close ao navegar (`useEffect` em `usePathname`). Trava scroll do body enquanto aberto.
- **Main content:** `md:ml-[220px] p-4 md:p-7` (padding menor em mobile).

Composição:

```tsx
// app/(app)/layout.tsx
<MobileShell sidebar={<Sidebar />}>{children}</MobileShell>
```

`MobileShell` é Client Component (estado open); `Sidebar` segue Server Component (faz queries). Padrão Next 16: Client component recebe Server component via `children`/prop.

**Por que não `<dialog>` nativo?** Estilo conflita com tokens DS; controle de animação fica mais limpo com transform + state. Vale revisitar quando precisar de focus trap real (v2).

### Listas responsivas — tabela ↔ card list

**Padrão canônico:** abaixo de `md`, table some e cada linha vira card via `<MobileListItem>`.

```tsx
<>
  {/* Mobile: card list */}
  <ul className="md:hidden bg-card border border-line rounded shadow-sm overflow-hidden">
    {items.map((i) => (
      <MobileListItem
        key={i.id}
        href={`/.../${i.id}`}
        title={i.name}
        subtitle={`${i.client} · ${i.slug}`}
        pills={<><Pill>...</Pill><Pill>...</Pill></>}
        meta="X frentes · 16/05/2026"
        trailingValue={isAdmin ? formatMoneyBR(i.mrr) : undefined}
      />
    ))}
  </ul>

  {/* Desktop: table */}
  <div className="hidden md:block bg-card border border-line rounded shadow-sm overflow-hidden">
    <table>...</table>
  </div>
</>
```

`MobileListItem` slots:
- `href` (obrigatório) — vira `<Link>` na linha inteira
- `title` — texto principal, `font-medium text-ink`
- `subtitle?` — mono `text-[10px] text-mute`
- `pills?` — slot pra `<Pill>`s inline (status, tipo, linha)
- `meta?` — texto auxiliar mono pequeno
- `trailingValue?` — valor à direita (MRR pra admin, contagem, etc.)

Sempre renderiza `ChevronRight` à direita pra afford clique.

### Grids responsivos — `flex-col` mobile ↔ `grid-cols-N` desktop

Para listas com layout estruturado (ex: FrentesListSection com 12 colunas):

```tsx
<li className="flex flex-col gap-2 px-4 py-3 md:grid md:grid-cols-12 md:gap-3 md:items-center">
  <div className="md:col-span-3">{title}</div>
  <div className="flex flex-wrap items-center gap-2 md:contents">
    <div className="md:col-span-1"><Pill>...</Pill></div>
    <div className="md:col-span-2"><Pill>...</Pill></div>
  </div>
  ...
</li>
```

**Regras:**
- `md:contents` no wrapper agrupa pills num row visível no mobile, mas no `md:` os filhos viram direct grid children (ignora o wrapper).
- `flex flex-wrap gap-2` no mobile evita overflow horizontal.
- Headers de "tabela" (linha de títulos das colunas) ficam `hidden md:grid`.
- `md:truncate` (não `truncate`) — no mobile prefira wrap natural.
- Elementos vazios ("—") podem ficar `hidden md:inline` pra não criar espaço inútil no mobile.

### PageHeader actions

Padrão: `flex flex-wrap items-center gap-2`. Nunca `flex-nowrap` — botões adicionais (admin) devem quebrar linha sem cortar.

---

## Modo escuro

Toggle via `body.dark` ou via Next.js theme provider.

**Regras:**
- Oak vira sage pra contraste preservado
- Hero da Operação perde o oak sólido; vira surface escuro com border
- Pills mantêm as mesmas cores funcionais
- Texto sage no light é `sage-deep`. No dark, vira `sage` puro.

---

## Proibido

Tentações comuns que violam o DS:

- ❌ Sombras grandes ou múltiplas camadas — só `shadow-sm`/`shadow-md`
- ❌ Bordas arredondadas em valores fora dos tokens (8px, 12px, 16px) — usar `rounded-sm/rounded/rounded-lg/rounded-pill`
- ❌ Cores fora da paleta — sempre via var ou Tailwind token
- ❌ Texto em peso 800-900 — peso máximo é 700
- ❌ Cores funcionais (critical/warning/ok) em superfícies grandes — só em pills e ícones pequenos
- ❌ Gradientes coloridos chamativos — só oak→sage nas barras de progresso, oak→escuro no hero público
- ❌ Animação de bounce, spin, pulse em UI (só em loaders) — só fade + translateY
- ❌ Ícones em cores Pantone (azul, vermelho vivo) — sempre herda do contexto
- ❌ Cores no fundo de pill diferentes dos `--*-bg` definidos
- ❌ Tamanho de fonte fora da hierarquia da tabela
- ❌ Display font em texto corrido longo
- ❌ Botão com mais de 13px de texto (parece amador)
- ❌ Inputs nativos sem estilo customizado
- ❌ Tabelas com zebra striping (alternando cor de linha) — usar hover

---

## Reveal animation

Único movimento padronizado. Aplicado em entrada de tela e troca de tela:

```typescript
// src/lib/hooks/useReveal.ts
export function useReveal() {
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('in'), i * 60);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
```

CSS:
```css
.reveal {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.in { opacity: 1; transform: translateY(0); }
```

Usar `<div className="reveal">` em seções principais. Não exagerar — só primeira camada de conteúdo da tela.

---

## Validação antes de componente novo

Antes de criar componente, responder:

1. **Existe um componente canônico que serve?** Pill, Card, Avatar, Icon, Button, KpiCard são prontos. Não duplicar.
2. **A cor escolhida está nos tokens?** Se não, use o token mais próximo. Não adicionar token novo sem aprovação.
3. **O peso/tamanho da fonte está na hierarquia?** Se não, ajustar para o valor canônico.
4. **O componente respeita o princípio 09 (pill canônico) e 10 (ícone funcional)?**
5. **Tem versão dark coerente?**

---

`— Última revisão: maio 2026`
